// Lit la boîte contact@ (IMAP, lecture seule) et copie les nouveaux messages dans la table mail_messages.
// Appelée toutes les 5 minutes par pg_cron et par le bouton « Actualiser » de l'admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.172";
import { simpleParser } from "npm:mailparser@3.7.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DOMAIN = "maisonopaline-invitations.fr";
const KNOWN = ["commande", "devis", "paiement", "support", "presse", "contact"];

function aliasOf(p: any): string {
  const addrs: string[] = [];
  for (const k of ["to", "cc"]) for (const a of (p[k]?.value ?? [])) addrs.push(String(a.address ?? "").toLowerCase());
  for (const h of ["delivered-to", "x-original-to", "envelope-to"]) { const v = p.headers?.get(h); if (v) addrs.push(String(typeof v === "string" ? v : v.text ?? "").toLowerCase()); }
  const mine = addrs.map((a) => a.match(/([a-z0-9._-]+)@maisonopaline-invitations\.fr/)?.[1]).filter(Boolean) as string[];
  const pick = mine.find((l) => l !== "contact" && KNOWN.includes(l)) ?? mine.find((l) => KNOWN.includes(l)) ?? "contact";
  return `${pick}@${DOMAIN}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const pass = Deno.env.get("IMAP_PASSWORD");
  if (!pass) return json({ ok: false, error: "IMAP_PASSWORD manquant" }, 200);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: st } = await db.from("mail_sync_state").select("*").eq("id", 1).single();
  if (st?.last_run && Date.now() - new Date(st.last_run).getTime() < 45_000) return json({ ok: true, skipped: true });
  await db.from("mail_sync_state").update({ last_run: new Date().toISOString() }).eq("id", 1);

  const client = new ImapFlow({
    host: Deno.env.get("IMAP_HOST") ?? "imap.mail.ovh.net", port: 993, secure: true,
    auth: { user: Deno.env.get("IMAP_USER") ?? `contact@${DOMAIN}`, pass }, logger: false,
  });
  let added = 0, lastUid = Number(st?.last_uid ?? 0);
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = (client.mailbox as any).exists ?? 0;
      const range = lastUid > 0 ? `${lastUid + 1}:*` : `${Math.max(1, total - 199)}:*`;
      const rows: any[] = [];
      for await (const m of client.fetch(range, { uid: true, source: true }, { uid: lastUid > 0 })) {
        if (m.uid <= lastUid) continue;
        const p: any = await simpleParser(m.source);
        const from = p.from?.value?.[0];
        const body = (p.text || String(p.html || "").replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ")).slice(0, 20000);
        rows.push({
          message_id: p.messageId ?? `uid-${m.uid}@imap`, in_reply_to: p.inReplyTo ?? null, direction: "in",
          alias: aliasOf(p), from_addr: String(from?.address ?? "").toLowerCase(), from_name: from?.name ?? null,
          to_addr: p.to?.value?.[0]?.address ?? null, subject: String(p.subject ?? "(sans objet)").slice(0, 300),
          body_text: body, received_at: (p.date ?? new Date()).toISOString(),
        });
        lastUid = Math.max(lastUid, m.uid);
      }
      if (rows.length) {
        const { error, count } = await db.from("mail_messages").upsert(rows, { onConflict: "message_id", ignoreDuplicates: true, count: "exact" });
        if (error) throw error; added = count ?? rows.length;
      }
    } finally { lock.release(); }
    await client.logout();
    await db.from("mail_sync_state").update({ last_uid: lastUid, last_error: null }).eq("id", 1);
    return json({ ok: true, added });
  } catch (e) {
    const msg = String((e as any)?.message ?? e).slice(0, 300);
    console.error("mail-sync", msg);
    await db.from("mail_sync_state").update({ last_error: msg }).eq("id", 1);
    try { await client.close(); } catch (_) { /* ignore */ }
    return json({ ok: false, error: msg });
  }
});
