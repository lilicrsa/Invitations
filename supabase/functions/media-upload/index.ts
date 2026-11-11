// Délivre une URL d'envoi à usage unique pour un fichier d'un brouillon Prestige (photo ou mini-vidéo).
// Contrôles côté serveur : brouillon valide, modèle Prestige, type, taille, emplacement. Le navigateur envoie ensuite le fichier directement au stockage.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const PRESTIGE_THEMES = ["galerie"];
const PHOTO = { types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }, maxMB: 10 };
const CLIP = { types: { "video/mp4": "mp4", "video/quicktime": "mov" }, maxMB: 15 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const code = String(b.code ?? ""), slot = String(b.slot ?? ""), type = String(b.type ?? ""), size = Number(b.size), idx = Number(b.index);
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return json({ error: "bad_code" }, 400);
  if (slot !== "frames" && slot !== "card_photo") return json({ error: "bad_slot" }, 400);
  if (!Number.isInteger(idx) || idx < 0 || idx > 11) return json({ error: "bad_index" }, 400);
  const photoExt = (PHOTO.types as Record<string, string>)[type], clipExt = (CLIP.types as Record<string, string>)[type];
  if (!photoExt && !(slot === "frames" && clipExt)) return json({ error: "bad_type" }, 400);
  const lim = photoExt ? PHOTO.maxMB : CLIP.maxMB;
  if (!Number.isFinite(size) || size <= 0 || size > lim * 1048576) return json({ error: "too_big" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: d } = await db.from("drafts").select("code,theme,status,expires_at").eq("code", code).maybeSingle();
  if (!d || new Date(d.expires_at) < new Date() || d.status === "published") return json({ error: "draft" }, 404);
  if (!PRESTIGE_THEMES.includes(d.theme)) return json({ error: "not_prestige" }, 400);

  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const path = `drafts/${code}/${slot}-${idx}-${rand}.${photoExt ?? clipExt}`;
  const { data, error } = await db.storage.from("invitation-media").createSignedUploadUrl(path);
  if (error || !data) { console.error("signed", error?.message); return json({ error: "storage" }, 502); }
  return json({ url: data.signedUrl, path, kind: photoExt ? "photo" : "video" });
});
