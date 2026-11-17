// Envoi automatique (tâche planifiée quotidienne) : 7 jours après la date de l'événement, les mariés reçoivent par e-mail
// un lien de téléchargement (valable 30 jours) vers un ZIP de toutes les photos de leurs invités. Plusieurs ZIP si volumineux.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Zip, ZipPassThrough } from "npm:fflate@0.8.2";

const SITE = (Deno.env.get("SITE_URL") ?? "https://maisonopaline-invitations.fr/").replace(/\/?$/, "/");
const DAYS_AFTER = 7, PART_BYTES = 35 * 1048576, LINK_SECONDS = 30 * 86400;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function mail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !to) return false;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html }) });
  if (!r.ok) console.error("resend", r.status, await r.text());
  return r.ok;
}

async function buildZip(parts: { name: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []; let done: () => void; const fin = new Promise<void>((r) => (done = r));
  const z = new Zip((err, chunk, final) => { if (err) throw err; chunks.push(chunk); if (final) done(); });
  for (const p of parts) { const f = new ZipPassThrough(p.name); z.add(f); f.push(p.data, true); }
  z.end(); await fin;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sent0 = req.headers.get("x-cron-key") ?? "";
  const { data: sec } = sent0 ? await db.from("cron_secret").select("k").eq("k", sent0).maybeSingle() : { data: null };
  if (!sec) return new Response("forbidden", { status: 403 });
  const limit = new Date(Date.now() - DAYS_AFTER * 86400_000).toISOString().slice(0, 10);
  const { data: invs } = await db.from("invitations").select("id,title,theme,event_date,response_token").eq("guest_photos_enabled", true).is("photos_zip_sent_at", null).not("event_date", "is", null).lte("event_date", limit).limit(5);
  const report: unknown[] = [];
  for (const inv of invs ?? []) {
    const { data: photos } = await db.from("guest_photos").select("path,guest_name").eq("invitation_id", inv.id).eq("uploaded", true).order("created_at");
    const { data: o } = await db.from("orders").select("email").eq("invitation_id", inv.id).eq("status", "paid").limit(1).maybeSingle();
    const to = o?.email ?? "";
    if (!photos?.length) { await db.from("invitations").update({ photos_zip_sent_at: new Date().toISOString() }).eq("id", inv.id); report.push({ id: inv.id, photos: 0 }); continue; }
    if (!to) { report.push({ id: inv.id, error: "no_email" }); continue; }

    const links: string[] = []; let batch: { name: string; data: Uint8Array }[] = [], size = 0, n = 0, ok = true;
    const flush = async () => {
      if (!batch.length) return;
      const zip = await buildZip(batch); const zp = `${inv.id}/photos-invites-${links.length + 1}.zip`;
      const up = await db.storage.from("guest-zips").upload(zp, zip, { contentType: "application/zip", upsert: true });
      if (up.error) { console.error("zip upload", up.error.message); ok = false; return; }
      const s = await db.storage.from("guest-zips").createSignedUrl(zp, LINK_SECONDS);
      if (s.error || !s.data) { ok = false; return; }
      links.push(s.data.signedUrl); batch = []; size = 0;
    };
    for (const p of photos) {
      const dl = await db.storage.from("guest-photos").download(p.path);
      if (dl.error || !dl.data) continue;
      const data = new Uint8Array(await dl.data.arrayBuffer()); n++;
      const who = (p.guest_name ?? "invite").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 24) || "invite";
      batch.push({ name: `${String(n).padStart(3, "0")}-${who}.${p.path.split(".").pop()}`, data }); size += data.length;
      if (size >= PART_BYTES) await flush();
    }
    await flush();
    if (!ok || !links.length) { report.push({ id: inv.id, error: "zip" }); continue; }

    const title = inv.title || "votre événement";
    const list = links.map((u, i) => `<p style="margin:.4rem 0"><a href="${u}" style="background:#E6D5AB;color:#0A0E1D;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">Télécharger${links.length > 1 ? ` la partie ${i + 1}/${links.length}` : " toutes les photos"}</a></p>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222"><h2>Les photos de vos invités 📸</h2>
<p>Voici les <b>${n} photo${n > 1 ? "s" : ""}</b> partagées par vos invités pour <b>${esc(title)}</b>.</p>${list}
<p style="color:#666;font-size:13px">Ces liens sont valables 30 jours : pensez à enregistrer les photos. Vous pouvez aussi les retrouver, tant que votre invitation est en ligne, sur votre <a href="${SITE}reponses.html?t=${inv.response_token}">page de suivi</a>.</p>
<p style="color:#666;font-size:13px">Merci de ne pas répondre directement à cet e-mail.</p></div>`;
    const sent = await mail(to, `Les photos de vos invités — ${title}`, html);
    if (sent) await db.from("invitations").update({ photos_zip_sent_at: new Date().toISOString() }).eq("id", inv.id);
    report.push({ id: inv.id, photos: n, parts: links.length, sent });
  }
  return new Response(JSON.stringify({ ok: true, report }), { headers: { "Content-Type": "application/json" } });
});
