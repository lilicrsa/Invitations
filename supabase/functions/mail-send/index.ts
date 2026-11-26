// Réponse depuis l'admin : envoie un e-mail via Resend depuis l'alias choisi et le range dans mail_messages.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DOMAIN = "maisonopaline-invitations.fr";
const ALIASES = ["contact", "commande", "devis", "paiement", "support", "presse"];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "auth" }, 401);
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: ok } = await user.rpc("is_admin");
  if (!ok) return json({ error: "forbidden" }, 403);

  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const to = String(b.to ?? "").trim().toLowerCase(), subject = String(b.subject ?? "").trim().slice(0, 300), text = String(b.text ?? "").trim().slice(0, 20000);
  const local = String(b.alias ?? "contact").split("@")[0].toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !text || !ALIASES.includes(local)) return json({ error: "bad_request" }, 400);
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "resend_not_configured" }, 400);

  const from = `Maison Opaline <${local}@${DOMAIN}>`;
  const headers: Record<string, string> = {};
  if (b.in_reply_to) { headers["In-Reply-To"] = String(b.in_reply_to); headers["References"] = String(b.in_reply_to); }
  const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#2a2230;white-space:pre-wrap">${esc(text)}</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html, reply_to: `${local}@${DOMAIN}`, headers }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("resend", r.status, JSON.stringify(j)); return json({ error: "send_failed", detail: j?.message ?? r.status }, 502); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await db.from("mail_messages").insert({
    message_id: `<out-${j.id}@resend>`, in_reply_to: b.in_reply_to ?? null, direction: "out", alias: `${local}@${DOMAIN}`,
    from_addr: `${local}@${DOMAIN}`, from_name: "Maison Opaline", to_addr: to, subject, body_text: text, status: "done",
    category: local, draft_code: b.draft_code ?? null,
  });
  return json({ ok: true });
});
