import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { getAuth } from "@/lib/auth-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatText } from "./ai.server";
import { deleteReferenceStorage, uploadPath } from "./storage.server";

export const listReferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data, error } = await supabase
      .from("references")
      .select("id, name, kind, summary, file_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTextReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      name: z.string().min(1).max(200),
      text: z.string().min(1).max(50000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const summary = await chatText({
      system:
        "Resume el siguiente texto en español en 4-6 frases destacando los puntos clave útiles para crear una presentación.",
      user: data.text.slice(0, 12000),
    });
    const { data: row, error } = await supabase
      .from("references")
      .insert({
        user_id: userId,
        name: data.name,
        kind: "text",
        extracted_text: data.text,
        summary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createFileReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      name: z.string().min(1).max(200),
      kind: z.enum(["pdf", "image", "doc", "text"]).default("text"),
      fileBase64: z.string().min(1),
      mimeType: z.string().default("application/octet-stream"),
      extractedText: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const buffer = Buffer.from(data.fileBase64, "base64");
    const ext = data.name.includes(".") ? data.name.split(".").pop() : "bin";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const path = uploadPath(userId, filename);
    const up = await supabase.storage
      .from("uploads")
      .upload(path, buffer, { contentType: data.mimeType, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = supabase.storage.from("uploads").getPublicUrl(path);
    const text = (data.extractedText ?? "").slice(0, 50000);
    let summary = "";
    if (text.length > 20) {
      summary = await chatText({
        system:
          "Resume en español en 4-6 frases este documento, destacando datos, cifras y temas útiles para una presentación.",
        user: text.slice(0, 12000),
      }).catch(() => "");
    } else if (data.kind === "image") {
      summary = "Imagen de referencia visual.";
    }
    const { data: row, error } = await supabase
      .from("references")
      .insert({
        user_id: userId,
        name: data.name,
        kind: data.kind,
        file_url: pub.publicUrl,
        extracted_text: text,
        summary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = getAuth({ context });
    const { data: ref } = await supabase
      .from("references")
      .select("file_url")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    await deleteReferenceStorage(supabase, ref?.file_url);
    const { error } = await supabase
      .from("references")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
