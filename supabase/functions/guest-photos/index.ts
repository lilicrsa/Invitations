// Photos envoyées par les invités d'une invitation Prestige.
// "request" : contrôle (invitation Prestige publiée, 30 photos max par invité, plafond global) puis délivre une URL d'envoi à usage unique.
// "done"    : confirme qu'une photo a bien été envoyée (elle devient visible pour les mariés).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PER_GUEST = 30, PER_INVITATION = 600, MAX_MB = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const action = String(b.action ?? "request"), slug = String(b.slug ?? ""), gk = String(b.guest_key ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(slug) || !/^[A-Za-z0-9_-]{8,64}$/.test(gk)) return json({ error: "bad_request" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: inv } = await db.from("invitations").select("id,is_published,is_demo,guest_photos_enabled,expires_at").eq("slug", slug).maybeSingle();
  if (!inv || inv.is_demo || !inv.is_published || !inv.guest_photos_enabled || (inv.expires_at && new Date(inv.expires_at) < new Date())) return json({ error: "unavailable" }, 404);

  if (action === "done") {
    const id = String(b.id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "bad_request" }, 400);
    await db.from("guest_photos").update({ uploaded: true }).eq("id", id).eq("invitation_id", inv.id).eq("guest_key", gk);
    const { count } = await db.from("guest_photos").select("id", { count: "exact", head: true }).eq("invitation_id", inv.id).eq("guest_key", gk).eq("uploaded", true);
    return json({ ok: true, count: count ?? 0, max: PER_GUEST });
  }

  const type = String(b.type ?? ""), size = Number(b.size), name = String(b.name ?? "").trim().slice(0, 60);
  const ext = TYPES[type];
  if (!ext) return json({ error: "bad_type" }, 400);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_MB * 1048576) return json({ error: "too_big" }, 400);

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const cnt = async (q: any) => (await q).count ?? 0;
  const mine = await cnt(db.from("guest_photos").select("id", { count: "exact", head: true }).eq("invitation_id", inv.id).eq("guest_key", gk).or(`uploaded.eq.true,created_at.gt.${since}`));
  if (mine >= PER_GUEST) return json({ error: "limit", max: PER_GUEST }, 429);
  const all = await cnt(db.from("guest_photos").select("id", { count: "exact", head: true }).eq("invitation_id", inv.id).or(`uploaded.eq.true,created_at.gt.${since}`));
  if (all >= PER_INVITATION) return json({ error: "full" }, 429);

  const path = `${inv.id}/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
  const { data, error } = await db.storage.from("guest-photos").createSignedUploadUrl(path);
  if (error || !data) { console.error("signed", error?.message); return json({ error: "storage" }, 502); }
  const { data: row, error: e2 } = await db.from("guest_photos").insert({ invitation_id: inv.id, guest_key: gk, guest_name: name || null, path }).select("id").single();
  if (e2 || !row) { console.error("insert", e2?.message); return json({ error: "storage" }, 502); }
  return json({ url: data.signedUrl, id: row.id, left: PER_GUEST - mine - 1 });
});
