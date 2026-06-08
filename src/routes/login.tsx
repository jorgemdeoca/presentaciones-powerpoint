import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/components/AuthProvider";
import { formatAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión · SlideForge" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (!loading && user) {
    return <Navigate to="/" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
      if (mode === "login") {
        toast.success("Sesión iniciada");
        navigate({ to: "/" });
      } else {
        toast.success("Cuenta creada. Si no pide confirmación por email, ya puedes entrar.");
        navigate({ to: "/" });
      }
    } catch (err: unknown) {
      toast.error(formatAuthError(err), { duration: 8000 });
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md glass rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">SlideForge</h1>
            <p className="text-xs text-muted-foreground">Presentaciones premium con IA</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signInWithGoogle().catch((e) => toast.error(formatAuthError(e)))}
          className="w-full py-2.5 rounded-md border border-border hover:bg-accent text-sm font-medium"
        >
          Continuar con Google
        </button>

        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-card px-2 relative z-10">o con email</span>
          <div className="absolute inset-x-0 top-1/2 border-t border-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>

        <p className="text-[11px] text-muted-foreground/80 leading-relaxed border-t border-border pt-4">
          En desarrollo, si ves «email rate limit», usa Google o en Supabase desactiva{" "}
          <strong>Confirm email</strong> (Authentication → Providers → Email).
        </p>
      </div>
    </div>
  );
}
