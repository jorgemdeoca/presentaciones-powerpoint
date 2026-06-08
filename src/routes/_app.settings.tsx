import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { PALETTE_META, PALETTE_OPTIONS, VISUAL_STYLE_OPTIONS } from "@/lib/theme";
import { toast } from "sonner";

const settingsQ = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Ajustes · SlideForge" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQ),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQ);
  const update = useServerFn(updateSettings);
  const qc = useQueryClient();
  const [s, setS] = useState({ ...data, purpose: data.purpose ?? "work" });

  async function save() {
    await update({
      data: {
        style: s.style, palette: s.palette, font_pair: s.font_pair, aspect_ratio: s.aspect_ratio,
        default_language: s.default_language, default_tone: s.default_tone,
        default_slide_count: s.default_slide_count, purpose: s.purpose,
      },
    });
    qc.invalidateQueries({ queryKey: ["settings"] });
    toast.success("Ajustes guardados");
  }

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Ajustes</h1>
      <p className="text-muted-foreground mb-8">Valores por defecto para nuevas presentaciones.</p>

      <div className="glass rounded-2xl p-6 space-y-5">
        <Row label="Propósito">
          <select value={s.purpose} onChange={(e) => setS({ ...s, purpose: e.target.value })} className="input">
            <option value="work">Trabajo</option>
            <option value="academic">Académico</option>
            <option value="pitch">Pitch / inversores</option>
            <option value="education">Educativo</option>
            <option value="marketing">Marketing</option>
            <option value="personal">Personal</option>
          </select>
        </Row>
        <Row label="Estilo visual">
          <select value={s.style} onChange={(e) => setS({ ...s, style: e.target.value })} className="input">
            {VISUAL_STYLE_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {id.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Paleta">
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {PALETTE_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setS({ ...s, palette: p })}
                className={`px-3 py-1.5 rounded-md text-xs border ${s.palette === p ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {PALETTE_META[p]?.name ?? p}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Idioma">
          <select value={s.default_language} onChange={(e) => setS({ ...s, default_language: e.target.value })} className="input">
            <option value="es">Español</option><option value="en">English</option><option value="fr">Français</option>
          </select>
        </Row>
        <Row label="Tono">
          <select value={s.default_tone} onChange={(e) => setS({ ...s, default_tone: e.target.value })} className="input">
            <option value="professional">Profesional</option><option value="casual">Cercano</option>
            <option value="academic">Académico</option><option value="energetic">Enérgico</option>
          </select>
        </Row>
        <Row label="Nº de slides por defecto">
          <input type="number" min={3} max={20} value={s.default_slide_count}
            onChange={(e) => setS({ ...s, default_slide_count: parseInt(e.target.value) })} className="input" />
        </Row>
        <Row label="Proporción">
          <select value={s.aspect_ratio} onChange={(e) => setS({ ...s, aspect_ratio: e.target.value })} className="input">
            <option value="16:9">16:9</option><option value="4:3">4:3</option>
          </select>
        </Row>

        <button onClick={save} className="w-full py-2.5 rounded-md font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
          Guardar
        </button>
      </div>
      <style>{`.input{width:100%;padding:0.5rem 0.75rem;border-radius:0.375rem;background:var(--input);border:1px solid var(--border);color:var(--foreground);}`}</style>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <label className="text-sm font-medium md:col-span-1">{label}</label>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}
