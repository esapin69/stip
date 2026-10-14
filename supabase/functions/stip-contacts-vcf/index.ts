import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,x-stip-session",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const digits = (value: unknown) => clean(value).replace(/\D/g, "");
function gheCode(value: unknown) {
  const match = clean(value).match(/^GHE\s*0*(\d{1,3})$/i);
  return match ? String(Number(match[1])).padStart(2, "0") : "";
}
function gheLabel(value: unknown) {
  const code = gheCode(value);
  return code ? `GHE ${code}` : clean(value);
}
function vcardEsc(value: unknown) {
  return clean(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function csvEsc(value: unknown) {
  const raw = clean(value);
  // Avoid importing data as formulas when opened by spreadsheet software.
  const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function makeCard(p: Record<string, unknown>) {
  const first = clean(p.prenom), last = clean(p.nom);
  const code = gheCode(p.ghe);
  const fullName = [first, last].filter(Boolean).join(" ").trim() || clean(p.alias) || "Contact GHE";
  const name = code ? `GHE ${code} - ${fullName}` : fullName;
  return [
    "BEGIN:VCARD", "VERSION:3.0",
    `N:${vcardEsc(last)};${vcardEsc(first)};;;`,
    `FN:${vcardEsc(name)}`,
    code ? `NICKNAME:${vcardEsc(`GHE ${code},${code}`)}` : "",
    p.role_metier ? `TITLE:${vcardEsc(p.role_metier)}` : "",
    p.telephone ? `TEL;TYPE=CELL:${digits(p.telephone)}` : "",
    p.email_pro ? `EMAIL;TYPE=WORK:${vcardEsc(p.email_pro)}` : "",
    code ? `ORG:GHE` : "",
    code ? `NOTE:${vcardEsc(`Numéro GHE ${code}`)}` : "",
    "END:VCARD",
  ].filter(Boolean).join("\r\n");
}
function makeServiceCard(s: Record<string, unknown>) {
  const name = ["GHE", clean(s.service)].filter(Boolean).join(" - ");
  return [
    "BEGIN:VCARD","VERSION:3.0",`N:${vcardEsc(name)};;;;`,`FN:${vcardEsc(name)}`,
    s.telephone_externe ? `TEL;TYPE=WORK:${digits(s.telephone_externe)}` : "",
    s.email ? `EMAIL;TYPE=WORK:${vcardEsc(s.email)}` : "",
    s.poste_interne ? `NOTE:${vcardEsc(`Poste interne ${s.poste_interne}`)}` : "",
    "END:VCARD"
  ].filter(Boolean).join("\r\n");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "GET") return new Response("Méthode non autorisée", {status:405,headers:cors});
  const format = new URL(req.url).searchParams.get("format")?.toLowerCase() === "csv" ? "csv" : "vcf";
  const {data: people, error: peopleError} = await db.from("contacts_ghe")
    .select("categorie,ghe,nom,prenom,alias,telephone,email_pro,role_metier")
    .eq("actif", true).order("ordre").order("nom");
  if (peopleError) return new Response("Annuaire indisponible", {status:500,headers:cors});
  const {data: services, error: servicesError} = await db.from("services_ghe")
    .select("service,site,telephone_externe,poste_interne,email,remarque").order("service");
  if (servicesError) return new Response("Services indisponibles", {status:500,headers:cors});
  const contacts = (people || []).filter((person) => person.categorie !== "service" && clean(person.nom).toLowerCase() !== "prénom");
  if (format === "csv") {
    const columns = ["Catégorie","GHE","Numéro GHE","Nom","Prénom","Téléphone","Fonction","Email professionnel","Service"];
    const bodyRows = [
      ...contacts.map((p) => [p.categorie || "personne",gheLabel(p.ghe),gheCode(p.ghe),p.nom,p.prenom,p.telephone,p.role_metier,p.email_pro,""]),
      ...(services || []).map((s) => ["service","","",s.service,"",s.telephone_externe,s.remarque,s.email,s.site]),
    ];
    const csv = "\uFEFF" + [columns, ...bodyRows].map((row) => row.map(csvEsc).join(";")).join("\r\n") + "\r\n";
    return new Response(csv, {headers:{...cors,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="Annuaire-GHE-complet.csv"'}});
  }
  const cards = [...contacts.map(makeCard),...(services || []).map(makeServiceCard)];
  return new Response(cards.join("\r\n") + "\r\n", {headers:{...cors,"Content-Type":"text/vcard; charset=utf-8","Content-Disposition":'attachment; filename="Annuaire-GHE-complet.vcf"'}});
});