// Lit la boîte contact@ (IMAP, lecture seule) et copie les nouveaux messages dans la table mail_messages.
// Client IMAP minimal écrit à la main (TLS natif Deno) : imapflow se bloquait au téléchargement dans ce runtime.
import { createClient } from "npm:@supabase/supabase-js@2";
import PostalMime from "npm:postal-mime@2.4.3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DOMAIN = "maisonopaline-invitations.fr";
const KNOWN = ["commande", "devis", "paiement", "support", "presse", "contact"];
const enc = new TextEncoder(), dec = new TextDecoder();
const withTimeout = <T>(p: Promise<T>, ms: number, label: string) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("délai dépassé : " + label)), ms))]);

function aliasOf(p: any): string {
  const addrs: string[] = [];
  for (const k of ["to", "cc"]) for (const a of (p[k] ?? [])) addrs.push(String(a.address ?? "").toLowerCase());
  for (const h of (p.headers ?? [])) if (["delivered-to", "x-original-to", "envelope-to"].includes(String(h.key).toLowerCase())) addrs.push(String(h.value).toLowerCase());
  const mine = addrs.map((a) => a.match(/([a-z0-9._-]+)@maisonopaline-invitations\.fr/)?.[1]).filter(Boolean) as string[];
  const pick = mine.find((l) => l !== "contact" && KNOWN.includes(l)) ?? mine.find((l) => KNOWN.includes(l)) ?? "contact";
  return `${pick}@${DOMAIN}`;
}

class Imap {
  conn!: Deno.TlsConn; buf = new Uint8Array(0); n = 0;
  async open(host: string) { this.conn = await Deno.connectTls({ hostname: host, port: 993 }); await this.line(); }
  private async fill() {
    const tmp = new Uint8Array(65536); const k = await this.conn.read(tmp);
    if (k === null) throw new Error("connexion fermée par le serveur");
    const nb = new Uint8Array(this.buf.length + k); nb.set(this.buf); nb.set(tmp.subarray(0, k), this.buf.length); this.buf = nb;
  }
  private async line(): Promise<string> {
    for (;;) {
      for (let i = 0; i + 1 < this.buf.length; i++) if (this.buf[i] === 13 && this.buf[i + 1] === 10) { const l = dec.decode(this.buf.slice(0, i)); this.buf = this.buf.slice(i + 2); return l; }
      await this.fill();
    }
  }
  private async bytes(len: number): Promise<Uint8Array> {
    while (this.buf.length < len) await this.fill();
    const o = this.buf.slice(0, len); this.buf = this.buf.slice(len); return o;
  }
  async cmd(c: string): Promise<{ line: string; lit?: Uint8Array }[]> {
    const tag = "A" + (++this.n);
    await this.conn.write(enc.encode(`${tag} ${c}\r\n`));
    const out: { line: string; lit?: Uint8Array }[] = [];
    for (;;) {
      let l = await this.line(), lit: Uint8Array | undefined;
      const m = l.match(/\{(\d+)\}$/);
      if (m) { lit = await this.bytes(Number(m[1])); l += " " + await this.line(); }
      if (l.startsWith(tag + " ")) { if (!/^\S+ OK/.test(l)) throw new Error("IMAP : " + l.slice(0, 120)); return out; }
      out.push({ line: l, lit });
    }
  }
  close() { try { this.conn.close(); } catch (_) { /* ignore */ } }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const pass = Deno.env.get("IMAP_PASSWORD");
  if (!pass) return json({ ok: false, error: "IMAP_PASSWORD manquant" }, 200);
  let force = false; try { force = (await req.json())?.force === true; } catch (_) { /* corps vide */ }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: st } = await db.from("mail_sync_state").select("*").eq("id", 1).single();
  if (!force && st?.last_run && Date.now() - new Date(st.last_run).getTime() < 45_000) return json({ ok: true, skipped: true });
  const step = async (s: string) => { await db.from("mail_sync_state").update({ last_run: new Date().toISOString(), last_error: "étape : " + s }).eq("id", 1); };
  await step("connexion");

  const imap = new Imap();
  let added = 0, lastUid = Number(st?.last_uid ?? 0);
  try {
    await withTimeout(imap.open(Deno.env.get("IMAP_HOST") ?? "imap.mail.ovh.net"), 15000, "connexion IMAP");
    const user = Deno.env.get("IMAP_USER") ?? `contact@${DOMAIN}`;
    const q = (s: string) => '"' + s.replace(/[\\"]/g, "\\$&") + '"';
    await withTimeout(imap.cmd(`LOGIN ${q(user)} ${q(pass)}`), 15000, "identification");
    await withTimeout(imap.cmd("SELECT INBOX"), 15000, "ouverture INBOX");
    const res = await withTimeout(imap.cmd(lastUid > 0 ? `UID SEARCH UID ${lastUid + 1}:*` : "UID SEARCH ALL"), 15000, "recherche");
    let uids = res.filter((r) => r.line.startsWith("* SEARCH")).flatMap((r) => r.line.slice(8).trim().split(/\s+/).filter(Boolean).map(Number)).filter((u) => u > lastUid).sort((a, b) => a - b);
    uids = uids.slice(-200);
    await step(`${uids.length} nouveau(x) message(s)`);
    const rows: any[] = [];
    for (const uid of uids) {
      const r = await withTimeout(imap.cmd(`UID FETCH ${uid} (BODY.PEEK[])`), 20000, "téléchargement du message " + uid);
      const lit = r.find((x) => x.lit)?.lit;
      if (!lit) { lastUid = Math.max(lastUid, uid); continue; }
      const p: any = await withTimeout(new PostalMime().parse(lit), 10000, "analyse du message " + uid);
      const body = String(p.text || String(p.html || "").replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ")).slice(0, 20000);
      rows.push({
        message_id: p.messageId ?? `uid-${uid}@imap`, in_reply_to: p.inReplyTo ?? null, direction: "in",
        alias: aliasOf(p), from_addr: String(p.from?.address ?? "").toLowerCase(), from_name: p.from?.name || null,
        to_addr: p.to?.[0]?.address ?? null, subject: String(p.subject ?? "(sans objet)").slice(0, 300),
        body_text: body, received_at: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
      });
      lastUid = Math.max(lastUid, uid);
    }
    if (rows.length) {
      const { error } = await db.from("mail_messages").upsert(rows, { onConflict: "message_id", ignoreDuplicates: true });
      if (error) throw error; added = rows.length;
    }
    try { await imap.cmd("LOGOUT"); } catch (_) { /* ignore */ }
    imap.close();
    await db.from("mail_sync_state").update({ last_uid: lastUid, last_error: null }).eq("id", 1);
    return json({ ok: true, added });
  } catch (e) {
    const msg = String((e as any)?.message ?? e).slice(0, 300);
    console.error("mail-sync", msg);
    await db.from("mail_sync_state").update({ last_error: msg }).eq("id", 1);
    imap.close();
    return json({ ok: false, error: msg });
  }
});
