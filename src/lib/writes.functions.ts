import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "./supa-admin.server";

const BUCKET = "reality-media";

const ParticipantInput = z.object({
  id: z.string().uuid().optional(),
  persona_name: z.string().min(1),
  instagram_username: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export const upsertParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ParticipantInput.parse(d))
  .handler(async ({ data }) => {
    const db = getAdmin();
    const record = {
      persona_name: data.persona_name.trim(),
      instagram_username: data.instagram_username.trim().replace(/^@+/, "").toLowerCase(),
      notes: data.notes?.trim() || null,
    };
    if (data.id) {
      const { error } = await db.from("participants").update(record).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("participants").insert(record);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = getAdmin();
    const { error } = await db.from("participants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertParticipants = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      records: z
        .array(
          z.object({
            persona_name: z.string().min(1),
            instagram_username: z.string().min(1),
            notes: z.string().nullable().optional(),
          }),
        )
        .min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = getAdmin();
    const records = data.records.map((r) => ({
      persona_name: r.persona_name.trim(),
      instagram_username: r.instagram_username.trim().replace(/^@+/, "").toLowerCase(),
      notes: r.notes?.trim() || null,
    }));
    const { error } = await db
      .from("participants")
      .upsert(records, { onConflict: "instagram_username" });
    if (error) throw new Error(error.message);
    return { count: records.length };
  });

const Kind = z.enum(["post", "reel", "story", "text", "other"]);

export const insertContentItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      participant_id: z.string().uuid().nullable().optional(),
      content_date: z.string(),
      kind: Kind,
      caption: z.string().nullable().optional(),
      transcript: z.string().nullable().optional(),
      source_url: z.string().nullable().optional(),
      file_path: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = getAdmin();
    const { error } = await db.from("content_items").insert({
      participant_id: data.participant_id ?? null,
      content_date: data.content_date,
      kind: data.kind,
      caption: data.caption?.trim() || null,
      transcript: data.transcript?.trim() || null,
      source_url: data.source_url?.trim() || null,
      file_path: data.file_path ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkInsertContentItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      records: z
        .array(
          z.object({
            participant_id: z.string().uuid().nullable().optional(),
            content_date: z.string(),
            kind: Kind,
            caption: z.string().nullable().optional(),
            transcript: z.string().nullable().optional(),
            source_url: z.string().nullable().optional(),
          }),
        )
        .min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = getAdmin();
    const { error } = await db.from("content_items").insert(
      data.records.map((r) => ({
        participant_id: r.participant_id ?? null,
        content_date: r.content_date,
        kind: r.kind,
        caption: r.caption ?? null,
        transcript: r.transcript ?? null,
        source_url: r.source_url ?? null,
      })),
    );
    if (error) throw new Error(error.message);
    return { count: data.records.length };
  });

export const deleteContentItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      file_path: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = getAdmin();
    if (data.file_path) {
      await db.storage.from(BUCKET).remove([data.file_path]);
    }
    const { error } = await db.from("content_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const db = getAdmin();
    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUploadUrl(data.path);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL de upload");
    return { path: signed.path, token: signed.token };
  });

export const getMediaSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const db = getAdmin();
    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 3600);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL");
    return { url: signed.signedUrl };
  });
