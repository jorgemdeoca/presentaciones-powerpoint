import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Plus, Settings, Sparkles, LogOut, Activity } from "lucide-react";
import { useAuth, signOut } from "@/components/AuthProvider";
import { toast } from "sonner";

const items = [
  { to: "/", label: "Biblioteca", icon: Home },
  { to: "/new", label: "Crear", icon: Plus },
  { to: "/tokens", label: "Uso de Tokens", icon: Activity },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al cerrar sesión");
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">SlideForge</div>
            <div className="text-xs text-muted-foreground">IA · Presentaciones</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((it) => {
          const active = path === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--primary)]"
                  : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80"
              }`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 px-3 space-y-2">
        <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
