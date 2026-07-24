import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const SinapseSchema = z.object({
  name: z.string().min(1),
  tone: z.string().min(1),
  rules: z.string().min(1),
});

const SettingsInput = z.object({
  drive_folder_id: z.string().nullable().optional(),
  drive_root_name: z.string().min(1).optional(),
  sinapse_weekday: z.number().int().min(0).max(6).optional(),
  sinapse_config: SinapseSchema.optional(),
});

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { settings: data };
});

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SettingsInput.parse(data))
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    const { data: current } = await supabase
      .from("settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    if (!current) {
      const { error } = await supabase.from("settings").insert({ singleton: true, ...data });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("settings").update(data).eq("id", current.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
