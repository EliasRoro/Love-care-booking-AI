/* ==========================================================================
   CareNest — central configuration
   --------------------------------------------------------------------------
   WORKING BRAND NAME: "CareNest" is a placeholder and NOT finalized.
   Change BRAND_NAME below and the whole site updates.
   ========================================================================== */

const CONFIG = {
  // -- Brand (working name, not finalized) ---------------------------------
  BRAND_NAME: "CareNest",
  TAGLINE: "Verified PSWs, on demand.",

  // -- Business model -------------------------------------------------------
  // Platform commission per booking (0.20 = 20%). PSW keeps the rest.
  COMMISSION_RATE: 0.20,
  // Default hourly rate shown to families (CAD). Actual rate is set per booking.
  DEFAULT_HOURLY_RATE: 35,

  // -- Supabase backend (FILL THESE IN — see DEPLOY.md) ----------------------
  SUPABASE_URL: "https://fwgdelmxjtsozazpjmko.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY", // public anon key from Supabase dashboard

  // -- Service areas (GTA to start; edit freely) -----------------------------
  SERVICE_AREAS: [
    "Toronto",
    "North York",
    "Scarborough",
    "Etobicoke",
    "Mississauga",
    "Brampton",
    "Markham",
    "Richmond Hill",
    "Vaughan",
    "Oakville"
  ],

  // -- Document types collected from PSW applicants --------------------------
  DOC_TYPES: [
    { key: "psw_certificate",   label: "PSW certificate / diploma",        expiry: false, required: true },
    { key: "cpr_first_aid",     label: "CPR + First Aid certification",    expiry: true,  required: true },
    { key: "vulnerable_sector", label: "Vulnerable Sector Check",          expiry: true,  required: true },
    { key: "hscpoa",            label: "HSCPOA registration proof",        expiry: false, required: true },
    { key: "photo_id",          label: "Government photo ID",              expiry: false, required: true }
  ],

  // -- Booking statuses -------------------------------------------------------
  BOOKING_STATUSES: ["requested", "accepted", "in_progress", "completed", "cancelled"],

  // -- Contact (placeholder until business email/phone exist) -----------------
  CONTACT_EMAIL: "hello@example.com",   // <-- replace with business email
  CONTACT_PHONE: "(416) 555-0100"        // <-- replace with business phone
};

// Make brand name available to every page without editing HTML.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-brand]").forEach(el => {
    el.textContent = CONFIG.BRAND_NAME;
  });
  const year = new Date().getFullYear();
  document.querySelectorAll("[data-year]").forEach(el => {
    el.textContent = year;
  });
});
