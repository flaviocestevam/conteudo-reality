import { createFileRoute } from "@tanstack/react-router";
import { getAdmin } from "@/lib/supa-admin.server";
import { z } from "zod";

const Body = z.object({
  date: z.string(),
  items: z
    .array(
      z.object({
        persona_username: z.string().optional(),
        kind: z.enum(["post", "reel", "story", "text", "other"]).default("other"),
        caption: z.string().optional(),
        transcript: z.string().optional(),
        source_url: z.string().url().optional(),
      }),
    )
    .min(1),
});

export const Route = createFileRoute("/api/public/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INTAKE_SECRET;
        const provided = request.headers.get("x-intake-secret");
        if (!secret || provided !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Invalid body", details: (e as Error).message }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const supabase = getAdmin();

        // Resolve participant handles → ids
        const handles = Array.from(
          new Set(
            parsed.items
              .map((i) => i.persona_username?.replace(/^@+/, "").toLowerCase())
              .filter(Boolean) as string[],
          ),
        );
        const byHandle = new Map<string, string>();
        if (handles.length) {
          const { data: parts } = await supabase
            .from("participants")
            .select("id, instagram_username")
            .in("instagram_username", handles);
          for (const p of parts ?? []) byHandle.set(p.instagram_username, p.id);
        }

        const rows = parsed.items.map((it) => ({
          participant_id: it.persona_username
            ? byHandle.get(it.persona_username.replace(/^@+/, "").toLowerCase()) ?? null
            : null,
          content_date: parsed.date,
          kind: it.kind,
          caption: it.caption ?? null,
          transcript: it.transcript ?? null,
          source_url: it.source_url ?? null,
        }));
        const { error } = await supabase.from("content_items").insert(rows);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
