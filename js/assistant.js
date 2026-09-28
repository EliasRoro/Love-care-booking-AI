/* ==========================================================================
   Guided booking assistant — REAL rule-based FAQ chat (no fake AI).
   --------------------------------------------------------------------------
   This is a keyword-driven helper, honestly labeled in the UI as a
   "guided assistant". It does not pretend to be human and does not
   claim LLM capabilities. Phase 2 may connect a real model (see README).
   ========================================================================== */

(function () {
  const BRAND = () => (typeof CONFIG !== "undefined" ? CONFIG.BRAND_NAME : "Love-Care-Support");

  const FAQS = [
    {
      keys: ["price", "cost", "much", "rate", "fee", "charge", "pay"],
      answer: () => `Families pay one simple hourly rate (currently $${CONFIG.DEFAULT_HOURLY_RATE}/hr). Your PSW keeps about 80% — the rest covers our verification, insurance, matching, and payments. No hidden fees, no contracts. You only pay for completed visits.`
    },
    {
      keys: ["verif", "trust", "background", "check", "certificate", "safe", "safety"],
      answer: () => `Every PSW must clear 5 checks before their first booking: a PSW certificate from an accredited Ontario program, current CPR + First Aid, a Vulnerable Sector Check (police background check), HSCPOA registration (Ontario's PSW registry), and government photo ID plus references we actually call.`
    },
    {
      keys: ["insur", "liabilit", "protect", "accident", "wrong"],
      answer: () => `Every booking is covered by ${BRAND()}'s blanket liability insurance at no cost to you or the PSW. PSWs earning hourly wages can't reasonably buy their own policies, so we carry it for everyone during booked visits.`
    },
    {
      keys: ["service", "offer", "what do", "include", "help with", "bathing", "meal"],
      answer: () => `Our PSWs help with non-medical home support: personal care (bathing, dressing), mobility support, meal prep, companionship, light housekeeping, and dementia support. By law they never administer medications, do wound care, or perform nursing tasks.`
    },
    {
      keys: ["book", "request", "schedule", "appointment", "start", "how do i"],
      answer: () => `Tap "Book care" above and fill out the 2-minute request form — what kind of help you need and your preferred times. We'll call or email you to confirm and match a verified PSW, usually within a few hours.`
    },
    {
      keys: ["psw", "join", "work", "job", "apply", "contractor", "hire"],
      answer: () => `PSWs join as independent contractors: set your own hours, accept the jobs you want, keep ~80% of every booking, and every visit is insured by us. Tap "Join as a PSW" and upload your documents — verification takes 1–3 business days.`
    },
    {
      keys: ["area", "where", "city", "location", "serve", "gta", "toronto"],
      answer: () => `We currently serve the Greater Toronto Area: ${CONFIG.SERVICE_AREAS.join(", ")}. More areas coming as we grow.`
    },
    {
      keys: ["cancel", "refund", "reschedule"],
      answer: () => `Life happens — you can cancel or reschedule a booking by contacting us directly. You only ever pay for completed visits.`
    },
    {
      keys: ["human", "person", "someone", "call", "phone", "contact", "email"],
      answer: () => `You can reach our team at ${CONFIG.CONTACT_EMAIL} or ${CONFIG.CONTACT_PHONE}. I'm just a guided helper — a real person will get back to you.`
    },
    {
      keys: ["hi", "hello", "hey"],
      answer: () => `Hi there! I'm the ${BRAND()} guided helper. Ask me about pricing, services, verification, insurance, or how booking works.`
    }
  ];

  const FALLBACK = () => `I'm a simple guided helper and I didn't catch that. Try asking about pricing, services, verification, insurance, or booking — or reach us at ${CONFIG.CONTACT_EMAIL}.`;

  function findAnswer(text) {
    const t = text.toLowerCase();
    for (const faq of FAQS) {
      if (faq.keys.some(k => t.includes(k))) return faq.answer();
    }
    return FALLBACK();
  }

  function init() {
    const fab = document.getElementById("chatFab");
    const panel = document.getElementById("chatPanel");
    const body = document.getElementById("chatBody");
    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");
    if (!fab || !panel) return;

    let greeted = false;

    function addMsg(text, who) {
      const div = document.createElement("div");
      div.className = "chat-msg " + who;
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    function addQuickReplies() {
      const wrap = document.createElement("div");
      wrap.className = "chat-quick";
      ["How much does it cost?", "Is it safe?", "What services?", "How do I book?"].forEach(q => {
        const b = document.createElement("button");
        b.textContent = q;
        b.addEventListener("click", () => { input.value = q; doSend(); });
        wrap.appendChild(b);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }

    function doSend() {
      const text = input.value.trim();
      if (!text) return;
      addMsg(text, "user");
      input.value = "";
      setTimeout(() => addMsg(findAnswer(text), "bot"), 350);
    }

    fab.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open") && !greeted) {
        greeted = true;
        addMsg(`Hi! I'm the ${BRAND()} guided helper — not a human, just quick answers. What would you like to know?`, "bot");
        addQuickReplies();
      }
    });
    send.addEventListener("click", doSend);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSend(); });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
