import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPresentation, updateSlide, regenerateSlideImage } from "@/lib/presentations.functions";
import { exportPdf, exportPptx } from "@/lib/export";
import { SlideRenderer, type SlideData } from "@/components/slides/SlideRenderer";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { ArrowLeft, CheckCircle2, Download, ImageIcon, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor · SlideForge" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  loader: ({ context, params }) => {
    const opts = queryOptions({
      queryKey: ["presentation", params.id],
      queryFn: () => getPresentation({ data: { id: params.id } }),
    });
    return context.queryClient.ensureQueryData(opts);
  },
  component: Editor,
});

function Editor() {
  const { id } = Route.useParams();
  const opts = queryOptions({
    queryKey: ["presentation", id],
    queryFn: () => getPresentation({ data: { id } }),
  });
  const { data } = useSuspenseQuery(opts);
  const qc = useQueryClient();
  const update = useServerFn(updateSlide);
  const regen = useServerFn(regenerateSlideImage);
  const [active, setActive] = useState(0);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenState, setRegenState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [regenMessage, setRegenMessage] = useState<string>("");

  const slides = data.slides;
  const pres = data.presentation!;
  const current = slides[active];
  const paletteId = (pres.theme as { palette?: string })?.palette ?? "azul_electrico_grafito";

  async function save(field: string, value: unknown) {
    if (!current) return;
    await update({ data: { id: current.id, [field]: value } } as Parameters<typeof update>[0]);
    qc.invalidateQueries({ queryKey: ["presentation", id] });
  }

  async function regenerateImage() {
    if (!current) return;
    setRegenLoading(true);
    setRegenState("loading");
    setRegenMessage("Generando una nueva imagen para esta slide...");
    try {
      await regen({ data: { slideId: current.id } });
      qc.invalidateQueries({ queryKey: ["presentation", id] });
      qc.invalidateQueries({ queryKey: ["presentations"] });
      setRegenState("success");
      setRegenMessage("Imagen actualizada correctamente.");
      toast.success("Imagen regenerada");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error regenerando imagen";
      setRegenState("error");
      setRegenMessage(message);
      toast.error(message);
    }
    setRegenLoading(false);
  }

  return (
    <div className="flex h-screen">
      <div className="w-56 shrink-0 border-r border-border bg-card/50 overflow-y-auto">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Biblioteca
        </Link>
        <div className="px-3 pb-3 space-y-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              className={`w-full aspect-video rounded-md border-2 overflow-hidden text-left ${
                i === active ? "border-primary" : "border-border"
              }`}
            >
              {s.image_url ? (
                <img src={s.image_url} alt="" className="w-full h-full object-cover opacity-70" />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                  {s.title}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur z-10">
          <h1 className="font-semibold truncate">{pres.title}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                exportPptx(pres as Parameters<typeof exportPptx>[0], slides as Parameters<typeof exportPptx>[1]);
                trackEvent("export_pptx", { presentationId: id });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm"
            >
              <Download className="h-4 w-4" /> PPTX
            </button>
            <button
              onClick={() => {
                exportPdf(pres as Parameters<typeof exportPdf>[0], slides as Parameters<typeof exportPdf>[1]);
                trackEvent("export_pdf", { presentationId: id });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-sm"
            >
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
        </header>

        {current && (
          <div key={current.id} className="p-6 max-w-4xl mx-auto space-y-4">
            <div className="relative group">
              <SlideRenderer
                slide={current as unknown as SlideData}
                paletteId={paletteId}
                editable
                onTitleChange={(v) => save("title", v)}
                onSubtitleChange={(v) => save("subtitle", v)}
                onBulletsChange={(v) => save("bullets", v)}
              />
              <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 max-w-[320px]">
                {(regenState === "loading" || regenState === "error" || regenState === "success") && (
                  <div className="rounded-md border border-border bg-background/92 backdrop-blur px-3 py-2 text-[11px] shadow-lg">
                    <div className="flex items-start gap-2">
                      {regenState === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin mt-0.5" />}
                      {regenState === "success" && <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500" />}
                      {regenState === "error" && <TriangleAlert className="h-3.5 w-3.5 mt-0.5 text-destructive" />}
                      <div>
                        <p className="font-medium text-foreground">
                          {regenState === "loading"
                            ? "Regenerando imagen"
                            : regenState === "success"
                              ? "Imagen lista"
                              : "No se pudo regenerar"}
                        </p>
                        <p className="text-muted-foreground mt-0.5">{regenMessage}</p>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={regenerateImage}
                  disabled={regenLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-background/88 backdrop-blur hover:bg-background shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity disabled:opacity-70"
                >
                  {regenLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  {regenLoading ? "Regenerando..." : "Regenerar imagen"}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Haz clic en el texto de la slide para editarlo directamente
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
