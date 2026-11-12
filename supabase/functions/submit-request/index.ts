// Enregistre la demande d'un client (file d'attente) puis envoie, si Resend est configuré, un accusé au client et une alerte à l'administratrice.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = (Deno.env.get("SITE_URL") ?? "https://maisonopaline-invitations.fr/").replace(/\/?$/, "/");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const NAMES: Record<string, string> = { ess: "Essentiel", sig: "Signature", pre: "Prestige" };

function layout(inner: string) {
  return `<div style="background:#f6f1e7;padding:24px 0"><div style="font-family:Georgia,serif;max-width:540px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;color:#2a2230">
<div style="background:#0a0e1c;color:#ecd9ae;text-align:center;padding:18px;font-size:22px;letter-spacing:.06em">Maison Opaline</div>
<div style="padding:22px 26px;font:15px/1.6 Arial,sans-serif">${inner}</div></div></div>`;
}
async function mail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !to) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const code = String(b.code ?? ""), email = String(b.email ?? "").trim(), formula = String(b.formula ?? "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return json({ error: "bad_code" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) return json({ error: "bad_email" }, 400);
  if (!["ess", "sig", "pre"].includes(formula)) return json({ error: "bad_formula" }, 400);
  if (b.accepted_terms !== true) return json({ error: "terms" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("drafts").select("id", { count: "exact", head: true }).gte("requested_at", since);
  if ((count ?? 0) > 60) return json({ error: "busy" }, 429);

  const { data, error } = await db.rpc("submit_request", { p_code: code, p_formula: formula, p_email: email });
  if (error) { console.error("submit", error.message); return json({ error: /draft|status|price/.test(error.message) ? "draft" : "failed" }, error.message.includes("draft") ? 404 : 400); }
  if (data?.already) return json({ ok: true, already: true });

  const title = data?.title || data?.host || "votre invitation";
  const preview = `${SITE}commande.html?d=${code}`;
  await mail(email, "Votre demande est bien enregistrée — Maison Opaline", layout(
    `<p>Bonjour,</p><p>Merci ! Votre demande pour l’invitation <b>« ${esc(title)} »</b> (formule ${NAMES[formula]}) est bien enregistrée.</p>
<p>Elle est dans notre file d’attente : nous la vérifions, puis <b>vous recevez un e-mail sous quelques jours</b> pour valider votre demande et passer au paiement. Aucun paiement n’a été demandé pour le moment.</p>
<p>Votre code de suivi : <b>${esc(code)}</b><br><a href="${preview}">Revoir ma demande</a></p><p style="color:#6a5f55;font-size:13px">Vous pouvez répondre à cet e-mail pour toute question.</p>`),
    Deno.env.get("ADMIN_EMAIL") ?? undefined);
  const admin = Deno.env.get("ADMIN_EMAIL");
  if (admin) await mail(admin, `Nouvelle demande : ${title} (${data?.theme}, ${NAMES[formula]})`, layout(
    `<p><b>Nouvelle demande à valider</b></p><p>${esc(title)} · ${esc(data?.theme)} · ${NAMES[formula]}<br>Client : ${esc(email)}</p><p><a href="${SITE}admin.html">Ouvrir l’administration</a></p>`));
  return json({ ok: true });
});
