import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileSearch, ListTree, Layout, ImageIcon, Sparkles, Loader2, AlertCircle } from "lucide-react";
import {
  getGenerationStatus,
  processPresentationGeneration,
} from "@/lib/presentations.functions";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { redirect } from "@tanstack/react-router";

type PhaseId = "analyze" | "extract" | "design" | "images" | "assemble";

const PHASES: { id: PhaseId; title: string; description: string; icon: typeof FileSearch }[] = [
  {
    id: "analyze",
    title: "Analizando información",
    description: "Leyendo el documento y/o tu chat para entender el tema, el tono y las ideas centrales.",
    icon: FileSearch,
  },
  {
    id: "extract",
    title: "Extrayendo lo esencial",
    description: "Identificando título, subtítulos, partes de desarrollo, métricas, citas y comparativas.",
    icon: ListTree,
  },
  {
    id: "design",
    title: "Diseñando cada slide",
    description: "Asignando layout, tamaño y posición de imágenes, tipografía, paleta y tonos.",
    icon: Layout,
  },
  {
    id: "images",
    title: "Generando imágenes",
    description: "Creando o buscando una imagen por slide, relacionada al tema, con texto en español si lo lleva.",
    icon: ImageIcon,
  },
  {
    id: "assemble",
    title: "Ensamblando presentación",
    description: "Montando cada slide con su contenido final listo para editar.",
    icon: Sparkles,
  },
];

function parseStep(step: string | null | undefined): { phase: PhaseId; current?: number; total?: number } {
  if (!step) return { phase: "analyze" };
  if (step.startsWith("images:")) {
    const [, prog] = step.split(":");
    const [c, t] = (prog ?? "").split("/").map((n) => parseInt(n, 10));
    return { phase: "images", current: c, total: t };
  }
  switch (step) {
    case "planning":
    case "analyzing":
      return { phase: "analyze" };
    case "writing":
    case "structuring":
      return { phase: "extract" };
    case "designing":
      return { phase: "design" };
    case "generating_images":
      return { phase: "images" };
    case "assembling":
    case "ready":
      return { phase: "assemble" };
    default:
      return { phase: "analyze" };
  }
}

export const Route = createFileRoute("/generating/$id")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  validateSearch: (s: Record<string, unknown>) => ({
    config: typeof s.config === "string" ? s.config : undefined,
  }),
  component: GeneratingPage,
});

function GeneratingPage() {
  const { id } = Route.useParams();
  const { config: configRaw } = Route.useSearch();
  const navigate = useNavigate();
  const getStatus = useServerFn(getGenerationStatus);
  const process = useServerFn(processPresentationGeneration);
  const started = useRef(false);
  const [currentPhase, setCurrentPhase] = useState<PhaseId>("analyze");
  const [imgProgress, setImgProgress] = useState<{ current?: number; total?: number }>({});
  const [error, setError] = useState<string | null>(null);
  const [lastChangeAt, setLastChangeAt] = useState<number>(Date.now());
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!configRaw || started.current) return;
    started.current = true;
    const config = JSON.parse(configRaw);
    trackEvent("generation_started", { presentationId: id });

    process({ data: { presentationId: id, config } })
      .then(() => {
        trackEvent("generation_completed", { presentationId: id });
        // No navegamos aquí: dejamos que el polling confirme status=ready
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        // Dejamos que la BD sea la fuente de verdad del estado; aquí sólo registramos.
        trackEvent("generation_failed", { presentationId: id, error: msg });
      });
  }, [configRaw, id, navigate, process]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await getStatus({ data: { id } });
        if (status?.generation_step) {
          const parsed = parseStep(status.generation_step);
          const next = parsed.phase;
          setImgProgress({ current: parsed.current, total: parsed.total });
          setCurrentPhase((prev) => {
            if (prev !== next) setLastChangeAt(Date.now());
            return next;
          });
        }
        if (status?.status === "ready") {
          navigate({ to: "/editor/$id", params: { id } });
        }
        if (status?.status === "failed") {
          setError(status.generation_error ?? "La generación falló");
          clearInterval(interval);
        }
      } catch {
        /* ignore poll errors */
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [getStatus, id, navigate]);

  useEffect(() => {
    const t = setInterval(() => {
      setStalled(Date.now() - lastChangeAt > 20_000);
    }, 2000);
    return () => clearInterval(t);
  }, [lastChangeAt]);

  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Creando tu presentación</h1>
          <p className="text-sm text-muted-foreground">
            La IA está trabajando por fases. Esto puede tardar 1–2 minutos.
          </p>
        </div>

        <div className="space-y-3">
          {PHASES.map((phase, idx) => {
            const done = idx < currentIndex || (currentPhase === "assemble" && idx === 3);
            const active = idx === currentIndex && !error;
            const pending = idx > currentIndex;
            const Icon = phase.icon;
            return (
              <div
                key={phase.id}
                className={[
                  "rounded-xl border p-4 transition-all flex gap-4 items-start",
                  active && "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]",
                  done && "border-emerald-500/40 bg-emerald-500/5",
                  pending && "border-border bg-card/30 opacity-60",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div
                  className={[
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    done && "bg-emerald-500/20 text-emerald-400",
                    active && "bg-primary/20 text-primary",
                    pending && "bg-muted text-muted-foreground",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {done ? (
                    <Check className="h-5 w-5" />
                  ) : active ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className={[
                        "font-semibold text-sm",
                        active && "text-primary",
                        done && "text-emerald-400",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      Fase {idx + 1}: {phase.title}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {done ? "Completado" : active ? "En curso" : "Pendiente"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {phase.description}
                  </p>
                  {active && phase.id === "images" && imgProgress.total ? (
                    <div className="mt-2">
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${Math.round(((imgProgress.current ?? 0) / imgProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Slide {imgProgress.current} de {imgProgress.total}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm text-destructive">La generación falló</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
              <button
                onClick={() => navigate({ to: "/new" })}
                className="mt-3 text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:opacity-90"
              >
                Volver a crear
              </button>
            </div>
          </div>
        )}
        {!error && stalled && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
            ⏳ Esta fase está tardando más de lo habitual. La IA sigue trabajando — los documentos grandes o muchas imágenes pueden tomar 2-3 minutos. No cierres la ventana.
          </div>
        )}
      </div>
    </div>
  );
}
