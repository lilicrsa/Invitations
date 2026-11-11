// Reçoit les événements Stripe (signature vérifiée), publie l'invitation payée et envoie l'e-mail des liens.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = (Deno.env.get("SITE_URL") ?? "https://maisonopaline-invitations.fr/").replace(/\/?$/, "/");
const te = new TextEncoder();

async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"], sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const k = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(`${t}.${raw}`)));
  const hex = [...mac].map((x) => x.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((a, c, i) => a | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

async function sendMail(to: string, links: { inv: string; rep?: string }): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return false;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222"><h2>Votre invitation est en ligne ✨</h2>
<p>Merci pour votre commande chez Maison Opaline.</p>
<p><b>Lien de votre invitation</b> (à envoyer à vos invités) :<br><a href="${links.inv}">${links.inv}</a></p>
${links.rep ? `<p><b>Lien de suivi des réponses</b> (à garder pour vous) :<br><a href="${links.rep}">${links.rep}</a></p>` : ""}
<p>Conservez cet e-mail. Une question ? Répondez à ce message ou écrivez-nous depuis le site.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: "Votre invitation Maison Opaline est en ligne", html }),
  });
  if (!r.ok) console.error("resend", r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("stripe-signature") ?? "", secret))) return new Response("bad signature", { status: 400 });

  const ev = JSON.parse(raw);
  if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return new Response("ignored", { status: 200 });
  const s = ev.data.object;
  if (s.payment_status !== "paid") return new Response("not paid", { status: 200 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const email = s.customer_details?.email ?? s.customer_email ?? "";
  const { error } = await db.rpc("_fulfill_order", { p_session: s.id, p_payment_intent: s.payment_intent ?? "", p_email: email, p_name: s.customer_details?.name ?? "" });
  if (error) {
    console.error("fulfill", error.message);
    await db.from("orders").update({ error: error.message.slice(0, 200) }).eq("stripe_session_id", s.id);
    return new Response("fulfill error", { status: 500 }); // Stripe réessaiera
  }

  const { data: l } = await db.rpc("get_order_links", { p_session: s.id });
  if (l?.status === "paid") {
    const sent = await sendMail(l.email, { inv: `${SITE}${l.theme}/index.html?i=${l.slug}`, rep: l.formula === "sig" ? `${SITE}reponses.html?t=${l.token}` : undefined });
    if (sent) await db.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("stripe_session_id", s.id);
  }
  return new Response("ok", { status: 200 });
});
