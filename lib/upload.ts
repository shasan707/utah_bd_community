import { getSupabase } from "@/lib/supabase";

/** Uploads a file to the public "photos" bucket and returns its permanent URL. */
export async function uploadPhoto(file: File, folder: string): Promise<string> {
  const supabase = getSupabase();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("photos").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
