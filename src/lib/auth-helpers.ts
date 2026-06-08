import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export function getAuth(ctx: { context: unknown }): AuthContext {
  const auth = ctx.context as AuthContext | undefined;
  if (!auth?.userId || !auth?.supabase) {
    throw new Error("Unauthorized: sesión requerida");
  }
  return auth;
}
