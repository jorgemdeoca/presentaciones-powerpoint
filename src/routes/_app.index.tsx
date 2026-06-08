import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPresentations, deletePresentation, getPresentation } from "@/lib/presentations.functions";
import { exportPdf, exportPptx } from "@/lib/export";
import { Download, FileText, Pencil, Plus, Trash2, Sparkles, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const presentationsQuery = queryOptions({
  queryKey: ["presentations"],
  queryFn: () => listPresentations(),
});

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Biblioteca · SlideForge" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(presentationsQuery),
  component: Library,
});

function Library() {
  const { data } = useSuspenseQuery(presentationsQuery);
  const qc = useQueryClient();
  const router = useRouter();
  const del = useServerFn(deletePresentation);
  const get = useServerFn(getPresentation);

  async function handleExport(id: string, kind: "pdf" | "pptx") {
    try {
      const { presentation, slides } = await get({ data: { id } });
      if (!presentation) return;
      if (kind === "pdf") await exportPdf(presentation as any, slides as any);
      else await exportPptx(presentation as any, slides as any);
    } catch (e: any) {
      toast.error(e.message ?? "Error al exportar");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta presentación?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["presentations"] });
    router.invalidate();
    toast.success("Eliminada");
  }

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <header className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Mi biblioteca</h1>
          <p className="text-muted-foreground mt-1">Todas tus presentaciones generadas con IA.</p>
        </div>
        <Link
          to="/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" /> Nueva presentación
        </Link>
      </header>

      {data.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Aún no hay presentaciones</h2>
          <p className="text-muted-foreground mb-6">Crea la primera con IA en menos de un minuto.</p>
          <Link to="/new" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus className="h-4 w-4" /> Crear ahora
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass rounded-2xl overflow-hidden group hover:shadow-[var(--shadow-glow)] transition-shadow"
            >
              <Link to="/editor/$id" params={{ id: p.id }} className="block aspect-video bg-secondary relative overflow-hidden">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <FileText className="h-12 w-12" />
                  </div>
                )}
                {p.status === "generating" && (
                  <span className="absolute top-3 left-3 text-xs px-2 py-1 rounded-full bg-background/80 backdrop-blur">Generando…</span>
                )}
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport(p.id, "pptx")}>
                        <Download className="h-4 w-4 mr-2" /> Descargar PPTX
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(p.id, "pdf")}>
                        <Download className="h-4 w-4 mr-2" /> Descargar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to="/editor/$id" params={{ id: p.id }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs font-medium">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                  <button onClick={() => handleExport(p.id, "pptx")} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs font-medium">
                    <Download className="h-3.5 w-3.5" /> PPTX
                  </button>
                  <button onClick={() => handleExport(p.id, "pdf")} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs font-medium">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
