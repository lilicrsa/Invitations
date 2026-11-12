// Validation / refus d'une demande par l'administratrice : met à jour le statut puis envoie l'e-mail au client (si Resend est configuré).
// Sinon renvoie le texte prêt à copier pour l'envoyer depuis la boîte mail habituelle.
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
async function mail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !to) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, ...(Deno.env.get("ADMIN_EMAIL") ? { reply_to: Deno.env.get("ADMIN_EMAIL") } : {}) }),
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "auth" }, 401);
  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const code = String(b.code ?? ""), action = String(b.action ?? ""), note = String(b.note ?? "").slice(0, 500);
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code) || !["validate", "refuse"].includes(action)) return json({ error: "bad_request" }, 400);

  // Appel avec le jeton de l'utilisatrice : la fonction SQL vérifie qu'elle est administratrice.
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: d, error } = await user.rpc("admin_review_draft", { p_code: code, p_action: action, p_note: note });
  if (error || !d) return json({ error: /forbidden/.test(error?.message ?? "") ? "forbidden" : "failed" }, /forbidden/.test(error?.message ?? "") ? 403 : 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: p } = await db.from("prices").select("amount_cents").eq("theme", d.theme).eq("formula", d.formula).maybeSingle();
  const price = p ? `${(p.amount_cents / 100).toLocaleString("fr-FR")} €` : "";
  const title = d.title || d.host || "votre invitation";
  const link = `${SITE}commande.html?d=${code}`;
  let subject: string, html: string, text: string;
  if (action === "validate") {
    subject = "Votre demande est validée — passez au paiement";
    html = layout(`<p>Bonjour,</p><p>Bonne nouvelle : votre demande pour l’invitation <b>« ${esc(title)} »</b> est <b>validée</b> 🎉</p>
<p>Il ne reste qu’à régler pour la publier : formule <b>${NAMES[d.formula] ?? ""}</b>${price ? ` · <b>${price}</b>` : ""}.</p>
<p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#c8963a;color:#fff;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:bold">Payer et publier mon invitation</a></p>
<p>Lien valable 30 jours. Dès le paiement, votre lien d’invitation vous est envoyé${d.formula === "ess" ? "" : " et vous accédez au suivi des réponses"}.</p><p>À très vite,<br><i>Maison Opaline</i></p>`);
    text = `Bonjour,\n\nBonne nouvelle : votre demande pour l'invitation « ${title} » est validée.\nIl ne reste qu'à régler pour la publier (formule ${NAMES[d.formula] ?? ""}${price ? ", " + price : ""}) :\n${link}\n\nLien valable 30 jours.\n\nÀ très vite,\nMaison Opaline`;
  } else {
    subject = "À propos de votre demande — Maison Opaline";
    html = layout(`<p>Bonjour,</p><p>Nous avons bien étudié votre demande pour l’invitation <b>« ${esc(title)} »</b>, mais nous ne pouvons pas la publier en l’état.</p>${note ? `<p>${esc(note)}</p>` : ""}<p>Aucun paiement n’a été pris. Vous pouvez nous répondre à cet e-mail pour en discuter.</p><p><i>Maison Opaline</i></p>`);
    text = `Bonjour,\n\nNous avons bien étudié votre demande pour l'invitation « ${title} », mais nous ne pouvons pas la publier en l'état.\n${note ? "\n" + note + "\n" : ""}\nAucun paiement n'a été pris. Répondez à cet e-mail pour en discuter.\n\nMaison Opaline`;
  }
  const sent = await mail(d.email, subject, html);
  return json({ ok: true, sent, to: d.email, subject, text, link: action === "validate" ? link : null });
});
