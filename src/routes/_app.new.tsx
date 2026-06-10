import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { initPresentationGeneration } from "@/lib/presentations.functions";
import { trackEvent } from "@/lib/analytics";
import {
  listReferences, createTextReference, createFileReference, deleteReference,
} from "@/lib/references.functions";
import { getSettings } from "@/lib/settings.functions";
import { PALETTE_META, PALETTE_OPTIONS, VISUAL_STYLE_OPTIONS, getPaletteMeta } from "@/lib/theme";
import { Sparkles, Loader2, Upload, Paperclip, Send, X, FileText, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const refsQ = queryOptions({ queryKey: ["references"], queryFn: () => listReferences() });
const settingsQ = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/_app/new")({
  head: () => ({ meta: [{ title: "Crear · SlideForge" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(refsQ),
      context.queryClient.ensureQueryData(settingsQ),
    ]);
  },
  component: NewPresentation,
});

type Msg = { role: "user" | "assistant"; content: string };

function NewPresentation() {
  const { data: refs } = useSuspenseQuery(refsQ);
  const { data: settings } = useSuspenseQuery(settingsQ);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const initGen = useServerFn(initPresentationGeneration);
  const createText = useServerFn(createTextReference);
  const createFile = useServerFn(createFileReference);
  const delRef = useServerFn(deleteReference);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chat, setChat] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Cuéntame qué presentación quieres crear. Puedes adjuntar documentos o imágenes como referencia con el clip ↓.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);

  // generation settings
  const [slideCount, setSlideCount] = useState(settings.default_slide_count);
  const [language, setLanguage] = useState(settings.default_language);
  const [tone, setTone] = useState(settings.default_tone);
  const [style, setStyle] = useState(
    VISUAL_STYLE_OPTIONS.includes(settings.style as (typeof VISUAL_STYLE_OPTIONS)[number])
      ? settings.style
      : "minimalista",
  );
  const [palette, setPalette] = useState(
    PALETTE_OPTIONS.includes(settings.palette) ? settings.palette : "azul_electrico_grafito",
  );
  const [purpose, setPurpose] = useState(settings.purpose ?? "work");
  const [imgAI, setImgAI] = useState(true);
  const [imgWeb, setImgWeb] = useState(false);
  const [slideCountMode, setSlideCountMode] = useState<"manual" | "range" | "auto">("manual");
  const [slideRange, setSlideRange] = useState<[number, number]>([6, 12]);

  function refineWith(msg: string) {
    const updated = [...chat, { role: "user" as const, content: msg }];
    setChat([
      ...updated,
      { role: "assistant", content: "Anotado. Puedes seguir refinando o pulsar **Generar** cuando estés listo." },
    ]);
  }

  function send() {
    const t = input.trim();
    if (!t) return;
    refineWith(t);
    setInput("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    for (const file of files) {
      try {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} supera 20MB`);
          continue;
        }
        const buf = await file.arrayBuffer();
        const u8 = new Uint8Array(buf);
        // Chunked base64 (evita "Maximum call stack size exceeded")
        let bin = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < u8.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
        }
        const b64 = btoa(bin);
        const isImg = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        let extractedText = "";
        if (file.type.startsWith("text/") || /\.(md|txt|csv)$/i.test(file.name)) {
          extractedText = new TextDecoder().decode(u8);
        }
        const created = await createFile({
          data: {
            name: file.name,
            kind: isImg ? "image" : isPdf ? "pdf" : "text",
            fileBase64: b64,
            mimeType: file.type || "application/octet-stream",
            extractedText,
          },
        });
        setSelectedRefs((s) => [...s, created.id]);
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            content: `📎 He añadido **${file.name}** como referencia${created.summary ? `. Resumen: ${created.summary}` : "."}`,
          },
        ]);
      } catch (err: any) {
        toast.error(err.message ?? "Error subiendo archivo");
      }
    }
    qc.invalidateQueries({ queryKey: ["references"] });
    setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generate() {
    // Compile prompt from chat user messages
    const userParts = chat.filter((m) => m.role === "user").map((m) => m.content);
    const prompt = userParts.join("\n\n") || input.trim();
    if (!prompt || prompt.length < 3) {
      toast.error("Cuéntame primero qué presentación quieres");
      return;
    }
    if (!imgAI && !imgWeb) {
      toast.error("Selecciona al menos una fuente de imágenes (IA o Web)");
      return;
    }
    setBusy(true);
    // Calcular nº efectivo según modo
    const effectiveCount =
      slideCountMode === "auto"
        ? 10
        : slideCountMode === "range"
          ? Math.round((slideRange[0] + slideRange[1]) / 2)
          : slideCount;
    const config = {
      prompt,
      slideCount: effectiveCount,
      slideCountMode,
      slideCountRange: slideCountMode === "range" ? slideRange : undefined,
      language,
      tone,
      visualStyle: style,
      palette,
      purpose,
      referenceIds: selectedRefs,
      withImages: imgAI || imgWeb,
      imageSources: { ai: imgAI, web: imgWeb },
      cinematicLevel: "medio" as const,
    };
    try {
      const res = await initGen({ data: config });
      trackEvent("generation_started", { presentationId: res.id });
      navigate({
        to: "/generating/$id",
        params: { id: res.id },
        search: { config: JSON.stringify(config) },
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error generando");
      setBusy(false);
    }
  }

  async function removeRef(id: string) {
    await delRef({ data: { id } });
    setSelectedRefs((s) => s.filter((x) => x !== id));
    qc.invalidateQueries({ queryKey: ["references"] });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-0 h-screen">
      {/* CHAT */}
      <div className="flex flex-col h-screen border-r border-border">
        <header className="px-6 py-4 border-b border-border">
          <h1 className="text-xl font-bold">Crear presentación</h1>
          <p className="text-xs text-muted-foreground">Conversa con la IA y sube documentos o imágenes</p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {chat.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "glass rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {selectedRefs.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {refs
                .filter((r) => selectedRefs.includes(r.id))
                .map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary">
                    {r.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {r.name}
                    <button onClick={() => removeRef(r.id)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="glass rounded-2xl p-2 flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-accent shrink-0"
              title="Adjuntar archivo o imagen"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={onFile}
              accept="image/*,.pdf,.txt,.md,.csv,.doc,.docx"
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Describe el tema de tu presentación…"
              className="flex-1 resize-none bg-transparent px-2 py-2 text-sm focus:outline-none max-h-32"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-secondary hover:bg-accent shrink-0 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="mt-3 w-full py-3 rounded-lg font-medium text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Generando…" : "Generar presentación"}
          </button>
        </div>
      </div>

      {/* SETTINGS PANEL */}
      <aside className="h-screen overflow-y-auto bg-card/30 p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Opciones</h2>

        <Field label="Propósito">
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input">
            <option value="work">Trabajo</option>
            <option value="academic">Académico</option>
            <option value="pitch">Pitch / inversores</option>
            <option value="education">Educativo</option>
            <option value="marketing">Marketing</option>
            <option value="personal">Personal</option>
          </select>
        </Field>

        <Field label="Nº de slides">
          <div className="flex gap-1 mb-2">
            {(["manual", "range", "auto"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSlideCountMode(m)}
                className={`flex-1 text-xs py-1.5 rounded-md border ${slideCountMode === m ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              >
                {m === "manual" ? "Manual" : m === "range" ? "Rango" : "Auto IA"}
              </button>
            ))}
          </div>
          {slideCountMode === "manual" && (
            <input type="number" min={3} max={40} value={slideCount}
              onChange={(e) => setSlideCount(parseInt(e.target.value) || 8)} className="input" />
          )}
          {slideCountMode === "range" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-10 text-muted-foreground">Min</span>
                <input type="number" min={3} max={40} value={slideRange[0]}
                  onChange={(e) => setSlideRange([parseInt(e.target.value) || 3, slideRange[1]])}
                  className="input" />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-10 text-muted-foreground">Max</span>
                <input type="number" min={3} max={40} value={slideRange[1]}
                  onChange={(e) => setSlideRange([slideRange[0], parseInt(e.target.value) || 12])}
                  className="input" />
              </div>
              <p className="text-[10px] text-muted-foreground">La IA elegirá entre {slideRange[0]} y {slideRange[1]} slides según el contenido.</p>
            </div>
          )}
          {slideCountMode === "auto" && (
            <p className="text-xs text-muted-foreground p-2 rounded-md bg-primary/5 border border-primary/20">
              ✨ La IA decidirá el número óptimo de slides analizando tu contenido.
            </p>
          )}
        </Field>

        <Field label="Idioma">
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input">
            <option value="es">Español</option><option value="en">English</option><option value="fr">Français</option>
          </select>
        </Field>

        <Field label="Tono">
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="input">
            <option value="professional">Profesional</option>
            <option value="casual">Cercano</option>
            <option value="academic">Académico</option>
            <option value="energetic">Enérgico</option>
          </select>
        </Field>

        <Field label="Estilo visual">
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="input">
            {VISUAL_STYLE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Paleta">
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {PALETTE_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPalette(p)}
                title={getPaletteMeta(p).purpose}
                className={`px-2.5 py-1 rounded-md text-xs border ${palette === p ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {PALETTE_META[p]?.name ?? p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Fuente de imágenes">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={imgAI} onChange={(e) => setImgAI(e.target.checked)} />
              <span>🎨 Generar con IA <span className="text-xs text-muted-foreground">(conceptos, fondos)</span></span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={imgWeb} onChange={(e) => setImgWeb(e.target.checked)} />
              <span>🔍 Buscar en la web <span className="text-xs text-muted-foreground">(fotos reales)</span></span>
            </label>
            {imgAI && imgWeb && (
              <p className="text-[10px] text-muted-foreground">La IA elegirá la mejor fuente para cada slide.</p>
            )}
          </div>
        </Field>

        <style>{`.input{width:100%;padding:0.5rem 0.75rem;border-radius:0.375rem;background:var(--input);border:1px solid var(--border);color:var(--foreground);font-size:0.875rem;}`}</style>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5 text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
