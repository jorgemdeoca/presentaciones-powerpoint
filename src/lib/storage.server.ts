import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function deletePresentationStorage(
  supabase: SupabaseClient<Database>,
  userId: string,
  presentationId: string,
) {
  const prefix = `${userId}/${presentationId}`;
  const { data: files } = await supabase.storage.from("slide-images").list(`${userId}/${presentationId}`);
  if (files?.length) {
    await supabase.storage
      .from("slide-images")
      .remove(files.map((f) => `${prefix}/${f.name}`));
  }
}

export async function deleteReferenceStorage(
  supabase: SupabaseClient<Database>,
  fileUrl: string | null | undefined,
) {
  if (!fileUrl) return;
  try {
    const url = new URL(fileUrl);
    const marker = "/object/public/uploads/";
    const idx = url.pathname.indexOf(marker);
    if (idx >= 0) {
      const path = decodeURIComponent(url.pathname.slice(idx + marker.length));
      if (path) await supabase.storage.from("uploads").remove([path]);
    }
  } catch {
    // ignore malformed URLs
  }
}

export function slideImagePath(userId: string, presentationId: string, slideId: string) {
  return `${userId}/${presentationId}/${slideId}.png`;
}

export function uploadPath(userId: string, filename: string) {
  return `${userId}/${filename}`;
}
