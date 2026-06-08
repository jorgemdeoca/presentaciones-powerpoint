import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuth } from "@/lib/auth-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) return data;

    const { data: created, error } = await supabase
      .from("user_settings")
      .insert({ user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        style: z.string().optional(),
        palette: z.string().optional(),
        font_pair: z.string().optional(),
        aspect_ratio: z.string().optional(),
        default_language: z.string().optional(),
        default_tone: z.string().optional(),
        default_slide_count: z.number().int().min(3).max(30).optional(),
        purpose: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("user_settings").insert({ user_id: userId, ...data });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_settings")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
