/** Mensajes amigables para errores de Supabase Auth */
export function formatAuthError(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "Error de autenticación";

  const lower = msg.toLowerCase();

  if (lower.includes("email rate limit") || lower.includes("rate limit exceeded")) {
    return "Límite de correos de Supabase alcanzado. Espera ~1 hora, usa «Continuar con Google», o desactiva la confirmación por email en el panel de Supabase (ver README).";
  }
  if (lower.includes("user already registered")) {
    return "Ese email ya está registrado. Usa «Iniciar sesión» en lugar de crear cuenta.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirma tu email desde el enlace que te envió Supabase, o desactiva «Confirm email» en desarrollo.";
  }

  return msg;
}
