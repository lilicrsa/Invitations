// Crée une session de paiement Stripe pour un brouillon. Prix lus en base (jamais envoyés par le navigateur).
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = (Deno.env.get("SITE_URL") ?? "https://maisonopaline-invitations.fr/").replace(/\/?$/, "/");
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const NAMES: Record<string, string> = { ess: "Essentiel", sig: "Signature", pre: "Prestige" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  let b: any; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const code = String(b.code ?? "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return json({ error: "bad_code" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: d } = await db.from("drafts").select("code,theme,data,status,expires_at,email,formula,validated_at").eq("code", code).maybeSingle();
  if (!d || new Date(d.expires_at) < new Date() || d.status === "published") return json({ error: "draft" }, 404);
  // Le paiement n'est possible qu'après validation de la demande (valable 30 jours).
  if (d.status !== "validated" || !d.validated_at || Date.now() - new Date(d.validated_at).getTime() > 30 * 86400_000) return json({ error: "not_validated" }, 403);
  const email = String(d.email ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400);
  const formula = ["ess","sig","pre"].includes(d.formula) ? d.formula : "ess";
  if (formula === "pre") {
    const m: any[] = Array.isArray(d.data?.media) ? d.data.media : [];
    let need = 6; // nombre de cadres du modèle, lu dans <modèle>/slots.json ; 6 si le fichier est injoignable
    try { const r0 = await fetch(`${SITE}${d.theme}/slots.json`); if (r0.ok) { const j0 = await r0.json(); if (Number.isInteger(j0.frames) && j0.frames > 0) need = j0.frames; } } catch (_) { /* valeur par défaut */ }
    if (m.filter((x) => x.slot === "frames").length < need || !m.some((x) => x.slot === "card_photo")) return json({ error: "media" }, 400);
  }
  const { data: p } = await db.from("prices").select("amount_cents").eq("theme", d.theme).eq("formula", formula).maybeSingle();
  if (!p) return json({ error: "price" }, 400);

  const f = new URLSearchParams({
    mode: "payment", locale: "fr", customer_email: email,
    "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(p.amount_cents),
    "line_items[0][price_data][product_data][name]": `Maison Opaline — invitation ${NAMES[formula]}`,
    success_url: `${SITE}merci.html?s={CHECKOUT_SESSION_ID}`, cancel_url: `${SITE}commande.html?d=${code}`,
    "metadata[draft_code]": code, "metadata[formula]": formula,
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: f,
  });
  const s = await r.json();
  if (!r.ok || !s.id) { console.error("stripe", r.status, s?.error?.message); return json({ error: "stripe" }, 502); }

  await db.from("orders").insert({ draft_code: code, email, formula, theme: d.theme, amount_cents: p.amount_cents, stripe_session_id: s.id });
  return json({ url: s.url });
});
