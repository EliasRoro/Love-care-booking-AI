/* ==========================================================================
   Smart matching v1 — REAL rule-based scoring (no fake AI).
   --------------------------------------------------------------------------
   scorePSWs(booking, psws) ranks active PSWs for a booking request.
   Used by the admin dashboard when assigning a PSW ("suggested matches").

   Weights (total 100):
     - Specialization overlap ......... 40
     - Language match ................. 25
     - Availability overlap ........... 15
     - Average rating ................. 10
     - Completed bookings (trust) ..... 10

   This is a transparent, explainable v1. Phase 2 (see README) may add
   learned models on top — but only with real outcome data.
   ========================================================================== */

const MATCH_WEIGHTS = {
  specialization: 40,
  language: 25,
  availability: 15,
  rating: 10,
  experience: 10
};

// Map booking service_types -> PSW specialization keys
const SERVICE_TO_SPEC = {
  personal_care: "personal_care",
  mobility: "mobility",
  meal_prep: "meal_prep",
  companionship: "companionship",
  dementia: "dementia",
  light_housekeeping: "personal_care" // closest available specialization
};

function normalizeWords(s) {
  return (s || "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/**
 * Score a single PSW against a booking. Returns { score, reasons[] }.
 * booking: { service_types[], needed_languages[], city, preferred_times }
 * psw:     { id, full_name, city, service_areas[], languages[], specializations[],
 *            rating_avg, ratings_count, experience_years, availability {text} }
 */
function scorePSW(booking, psw) {
  let score = 0;
  const reasons = [];

  // 1. Specialization overlap (40)
  const neededSpecs = (booking.service_types || [])
    .map(st => SERVICE_TO_SPEC[st])
    .filter(Boolean);
  const pswSpecs = (psw.specializations || []).map(s => s.toLowerCase());
  const matchedSpecs = neededSpecs.filter(ns => pswSpecs.includes(ns));
  if (neededSpecs.length > 0) {
    const frac = matchedSpecs.length / neededSpecs.length;
    const pts = Math.round(MATCH_WEIGHTS.specialization * frac);
    score += pts;
    if (matchedSpecs.length > 0) reasons.push(`Specializations match: ${matchedSpecs.join(", ")} (+${pts})`);
    else reasons.push(`No specialization overlap (+0)`);
  } else {
    score += MATCH_WEIGHTS.specialization;
    reasons.push("No special care needs specified (+40)");
  }

  // 2. Language match (25)
  const neededLangs = (booking.needed_languages || []).map(l => l.toLowerCase());
  const pswLangs = (psw.languages || []).map(l => l.toLowerCase());
  if (neededLangs.length > 0) {
    const matchedLangs = neededLangs.filter(nl =>
      pswLangs.some(pl => pl.includes(nl) || nl.includes(pl))
    );
    const frac = matchedLangs.length / neededLangs.length;
    const pts = Math.round(MATCH_WEIGHTS.language * frac);
    score += pts;
    if (matchedLangs.length > 0) reasons.push(`Speaks ${matchedLangs.join(", ")} (+${pts})`);
    else reasons.push(`Language preference not matched (+0)`);
  } else {
    score += MATCH_WEIGHTS.language;
    reasons.push("No language preference (+25)");
  }

  // 3. Availability overlap (15) — keyword overlap between request and PSW's stated availability
  const bookingWords = new Set(normalizeWords(booking.preferred_times));
  const availWords = new Set(normalizeWords(psw.availability && psw.availability.text));
  const dayWords = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday",
                    "mon","tue","wed","thu","fri","sat","sun","weekday","weekdays","weekend","weekends",
                    "morning","afternoon","evening","night","overnight"];
  const overlap = dayWords.filter(w => bookingWords.has(w) && availWords.has(w));
  if (overlap.length > 0) {
    const pts = Math.min(MATCH_WEIGHTS.availability, overlap.length * 5);
    score += pts;
    reasons.push(`Availability overlap: ${overlap.join(", ")} (+${pts})`);
  } else {
    reasons.push("No clear availability overlap — confirm manually (+0)");
  }

  // 4. Rating (10) — scaled 0..5 stars
  const rating = parseFloat(psw.rating_avg) || 0;
  const ratingPts = Math.round(MATCH_WEIGHTS.rating * Math.min(1, rating / 5));
  score += ratingPts;
  if (rating > 0) reasons.push(`Rated ${rating.toFixed(1)}/5 (+${ratingPts})`);
  else reasons.push("No ratings yet (+0)");

  // 5. Experience / completed bookings (10)
  const completed = parseInt(psw.ratings_count, 10) || 0;
  const yrs = parseInt(psw.experience_years, 10) || 0;
  const trustSignal = Math.min(1, completed / 20) * 0.6 + Math.min(1, yrs / 10) * 0.4;
  const expPts = Math.round(MATCH_WEIGHTS.experience * trustSignal);
  score += expPts;
  reasons.push(`${yrs} yrs experience, ${completed} completed bookings (+${expPts})`);

  // Small bonus: same city as the booking
  if (psw.city && booking.city && psw.city.toLowerCase() === booking.city.toLowerCase()) {
    score += 3;
    reasons.push("Same city (+3)");
  } else if (psw.service_areas && booking.city &&
             psw.service_areas.map(a => a.toLowerCase()).includes(booking.city.toLowerCase())) {
    score += 3;
    reasons.push("Serves this area (+3)");
  }

  return { score: Math.min(103, score), reasons };
}

/**
 * Rank PSWs for a booking, best first.
 * Returns [{ psw, score, reasons }] sorted by score desc.
 * Only considers PSWs with status 'active' unless includeInactive is true.
 */
function scorePSWs(booking, psws, includeInactive = false) {
  const pool = includeInactive ? psws : psws.filter(p => p.status === "active");
  return pool
    .map(psw => {
      const { score, reasons } = scorePSW(booking, psw);
      return { psw, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

// Export for admin.html (also works as a module in Node for testing)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { scorePSW, scorePSWs, MATCH_WEIGHTS };
}
