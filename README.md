# Love-Care-Support — Uber-style PSW marketplace

> Working brand name — "Love-Care-Support" is **not finalized**. It lives in one constant (`BRAND_NAME` in `js/config.js`); change it there and redeploy.

An Uber-like marketplace web app for Ontario home care: families book verified Personal Support Workers for in-home visits; PSWs work as **independent contractors**; the platform takes a ~20% commission per booking and carries blanket liability insurance covering PSWs during booked jobs.

**Stack (all free tier, $0 budget):** vanilla HTML/CSS/JS (no build step) + Supabase (Postgres + Auth + Storage) via CDN. Deploy the folder as-is to Netlify, Vercel, or Cloudflare Pages.

---

## Project structure

```
├── index.html              # Landing page + guided booking assistant (chat widget)
├── book.html               # Family booking request form → bookings (status=requested)
├── join.html               # PSW contractor application + document uploads
├── admin.html              # Admin login + dashboard (verification queue, bookings,
│                           #   PSW roster, payouts, reviews, smart-match assignment)
├── css/styles.css          # Design system — mobile-first, no frameworks
├── js/
│   ├── config.js           # BRAND_NAME, COMMISSION_RATE, Supabase keys, service areas
│   ├── supabase-client.js  # Supabase singleton + reference-code generator
│   ├── matching.js         # REAL rule-based smart matching (scorePSWs)
│   └── assistant.js        # REAL rule-based FAQ chat (guided, not an LLM)
├── supabase/
│   └── schema.sql          # Full Postgres schema + RLS + storage bucket
├── DEPLOY.md               # Step-by-step: zero → live
└── README.md               # This file
```

---

## Data model (summary)

| Table | Purpose |
|---|---|
| `clients` | Family contact records from booking requests |
| `psws` | Contractor PSW profiles: status (`applied`→`verifying`→`active`/`suspended`/`rejected`), languages, specializations, rating |
| `documents` | Metadata for verification files (PSW cert, CPR/First Aid, Vulnerable Sector Check, HSCPOA proof, photo ID) with expiry dates + verification status. Files live in the private `psw-documents` storage bucket. |
| `bookings` | Care requests: lifecycle `requested`→`accepted`→`in_progress`→`completed`→`cancelled`; stores hourly rate + commission snapshot per booking |
| `payments` | Auto-created when a booking completes: total, platform fee, PSW payout, payout status |
| `reviews` | 1–5 star ratings; a trigger keeps `psws.rating_avg` in sync |
| `admin_users` | Supabase Auth UIDs allowed into the admin console |

**Security model:** anonymous visitors can *submit* (INSERT bookings, clients, PSW applications, document metadata, file uploads) but can never *read* anyone's data. Only rows in `admin_users` can read/manage. Documents are in a private bucket; the admin opens them via 5-minute signed URLs.

---

## What's real right now (honest AI status)

- ✅ **Smart matching v1** (`js/matching.js`): a genuine, explainable scoring function — specialization overlap (40), language match (25), availability overlap (15), rating (10), experience/completed bookings (10). Used in the admin "Assign" flow as "suggested matches," labeled `smart matching v1`. No fake AI.
- ✅ **Certification expiry automation**: admin Overview flags verified documents expiring within 30 days or already expired.
- ✅ **Guided booking assistant** (`js/assistant.js`): a real keyword-based FAQ chat on the landing page. The UI labels it a "guided assistant — not a human." It does not pretend to be an LLM.

## AI roadmap (planned — NOT implemented, NOT faked)

- [ ] **Phase 2a — LLM document checks:** send uploaded certificates to a vision model to extract expiry dates and flag suspicious documents, pre-filling the verification checklist. Integration point: `join.html` upload handler → new edge function → `documents.verification_status`.
- [ ] **Phase 2b — Care-note intelligence:** PSW voice/text notes after visits → LLM summary for families + anomaly flags (e.g., sudden confusion). Needs new `visit_notes` table + family notification flow.
- [ ] **Phase 2c — Demand prediction:** forecast busy periods from historical bookings; nudge PSWs to open availability.
- [ ] **Phase 2d — Learned matching:** once real outcome data exists (completed bookings × ratings), train/weight the matcher on it instead of hand-tuned weights.

These map cleanly onto the grant-funded Track 2 (SR&ED-eligible R&D: genuine technological uncertainty in matching and document verification).

---

## PHIPA & data-minimization notes

Ontario's *Personal Health Information Protection Act* (PHIPA) governs personal health information. This app is designed defensively:

1. **Data minimization:** the public booking form deliberately does **not** ask for diagnoses, medications, or health history — only care *types* and logistics. Sensitive details are discussed privately during confirmation.
2. **Private by default:** all personal data sits behind RLS; anonymous users can write but never read.
3. **Documents locked down:** verification files are in a private bucket, admin-only, opened via expiring signed URLs. Clients never see them — only "✓ verified" outcomes.
4. **No tracking:** no analytics, no third-party trackers in v1.

**Still required before real launch:** a lawyer-reviewed privacy policy, PHIPA practices review, and the platform's own data-retention/deletion procedure. This README is not legal advice.

---

## Business rules baked in

- **PSWs are independent contractors.** Stated on the site, confirmed by checkbox on `join.html`. They set availability, accept/decline freely. (Get the contractor agreement lawyer-reviewed — misclassification is the #1 legal risk.)
- **Non-medical scope only.** The site explicitly lists what PSWs do and don't do — no medications, no wound care, no nursing tasks.
- **Platform carries insurance.** Copy states the blanket liability policy covers PSWs during booked jobs (PSWs can't reasonably afford individual policies).
- **Commission:** 20% default, one constant (`COMMISSION_RATE`), snapshotted per booking so rate changes don't rewrite history.

---

## Roadmap

- [ ] v1.1 — client/PSW login (magic links) so families can see their bookings and PSWs can manage availability
- [ ] v1.2 — online payments (Stripe) instead of manual payout tracking
- [ ] v1.3 — in-app reviews after completed visits (schema + trigger already support it)
- [ ] v2 — native iOS/Android apps (React Native) on the same Supabase backend
- [ ] Track 2 — grant-funded AI platform (see AI roadmap above)
