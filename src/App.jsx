import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================================
   ApplyAI — AI-powered job search engine & application command center
   Single-file React app. localStorage persistence. No backend required.
   Swap the API keys below to enable live data.
   ========================================================================== */

const RAPIDAPI_KEY = ""; // rapidapi.com -> JSearch subscription
const CLAUDE_KEY = ""; // console.anthropic.com -> API Keys
const GMAIL_CID = ""; // console.cloud.google.com -> OAuth 2.0 Client ID (Web)
const EMAILJS_SERVICE_ID = "";
const EMAILJS_TEMPLATE_ID = "";
const EMAILJS_PUBLIC_KEY = "";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

/* ----------------------------------------------------------------------------
   Global CSS (injected once into <head>)
   -------------------------------------------------------------------------- */
const CSS = `
:root{
  --bg:#07090F; --s0:#0B0F1A; --s1:#101622; --s2:#172030; --s3:#1F2D40; --s4:#2A3D55;
  --am:#F5A623; --am2:#FBBF24; --tx:#EEF2F8; --tm:#8A99B2; --td:#4A5A70;
  --gr:#10B981; --rd:#F43F5E; --bl:#3B82F6; --pu:#8B5CF6; --te:#06B6D4;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
body{
  background:var(--bg); color:var(--tx); font-family:'Inter',system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; font-size:14px;
}
.syne{font-family:'Syne',sans-serif; letter-spacing:-.5px}
a{color:inherit}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-thumb{background:var(--s3);border-radius:8px}
::-webkit-scrollbar-track{background:transparent}
input,textarea,select,button{font-family:inherit}
input,textarea,select{
  background:var(--s2); border:1px solid var(--s3); color:var(--tx);
  border-radius:10px; padding:10px 12px; font-size:13px; outline:none; width:100%;
  transition:border-color .18s ease, box-shadow .18s ease;
}
input:focus,textarea:focus,select:focus{border-color:var(--am); box-shadow:0 0 0 3px rgba(245,166,35,.12)}
button{cursor:pointer; border:none; background:none; color:inherit}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fadeUp{animation:fadeUp .25s ease both}
.st>*{animation:fadeUp .25s ease both}
.st>*:nth-child(1){animation-delay:.03s}
.st>*:nth-child(2){animation-delay:.06s}
.st>*:nth-child(3){animation-delay:.09s}
.st>*:nth-child(4){animation-delay:.12s}
.st>*:nth-child(5){animation-delay:.15s}
.st>*:nth-child(6){animation-delay:.18s}
.st>*:nth-child(7){animation-delay:.21s}
.st>*:nth-child(8){animation-delay:.24s}
@keyframes pop{0%{transform:scale(1)}45%{transform:scale(1.5);color:var(--am)}100%{transform:scale(1)}}
.pop{animation:pop .4s cubic-bezier(.34,1.56,.64,1)}
@keyframes rip{from{transform:scale(0);opacity:.5}to{transform:scale(2.6);opacity:0}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(245,166,35,.5)}50%{box-shadow:0 0 22px 6px rgba(245,166,35,.35)}}
.glow{animation:glow 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.pulse{animation:pulse 1.8s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.spin{animation:spin 1s linear infinite}
@keyframes typing{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.ripBtn{position:relative;overflow:hidden}
.card{background:var(--s1);border:1px solid var(--s3);border-radius:14px;transition:border-color .18s ease, transform .18s ease, background .18s ease}
.card:hover{border-color:var(--s4)}
.pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;font-size:11px;font-weight:600;padding:3px 9px;white-space:nowrap}
.lnk{display:inline-flex;align-items:center;gap:3px;border-radius:8px;font-size:11px;font-weight:600;padding:5px 9px;text-decoration:none;transition:transform .12s ease, filter .12s ease;border:1px solid var(--s3)}
.lnk:hover{transform:translateY(-1px);filter:brightness(1.15)}
.tag{display:inline-flex;align-items:center;border-radius:8px;font-size:11px;font-weight:500;padding:4px 9px;margin:3px 3px 0 0}
`;

/* ----------------------------------------------------------------------------
   Utilities
   -------------------------------------------------------------------------- */
const ls = {
  get: (k, d = null) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const hoursAgo = (iso) => {
  if (!iso) return 999;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
};

const timeAgo = (iso) => {
  const h = hoursAgo(iso);
  if (h < 1) return Math.max(1, Math.round(h * 60)) + "m ago";
  if (h < 24) return Math.round(h) + "h ago";
  const d = Math.round(h / 24);
  if (d < 7) return d + "d ago";
  return Math.round(d / 7) + "w ago";
};

const parseJ = (txt) => {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {}
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return null;
};

const profileStr = (p) => {
  if (!p) return "No profile available.";
  return [
    "Skills: " + (p.skills || []).join(", "),
    "Seniority: " + (p.seniority || "n/a") + " (" + (p.yearsExp || 0) + " yrs)",
    "Experience: " + (p.experience || []).slice(0, 4).join("; "),
    "Strengths: " + (p.strengths || []).join(", "),
    "Education: " + (p.education || []).join("; "),
  ].join("\n");
};

const COUNTRY_FLAGS = {
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Australia: "🇦🇺",
  UAE: "🇦🇪",
  Europe: "🇪🇺",
  Canada: "🇨🇦",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Morocco: "🇲🇦",
  Netherlands: "🇳🇱",
};
const flagFor = (c) => COUNTRY_FLAGS[c] || "🌍";

const DEFAULT_COUNTRIES = [
  { name: "United States", flag: "🇺🇸", target: 5 },
  { name: "United Kingdom", flag: "🇬🇧", target: 3 },
  { name: "Australia", flag: "🇦🇺", target: 2 },
  { name: "UAE", flag: "🇦🇪", target: 2 },
  { name: "Europe", flag: "🇪🇺", target: 3 },
];

/* ----------------------------------------------------------------------------
   Claude API helper
   -------------------------------------------------------------------------- */
async function ai(system, user, max = 600) {
  if (!CLAUDE_KEY) throw new Error("Claude key not configured");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": CLAUDE_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: max,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error("Claude error " + r.status);
  const d = await r.json();
  return (d.content && d.content[0] && d.content[0].text) || "";
}

/* ----------------------------------------------------------------------------
   JSearch job aggregation
   -------------------------------------------------------------------------- */
async function searchJobs(role, field, countries, onProgress) {
  const results = [];
  const seen = new Set();

  for (const country of countries.slice(0, 4)) {
    const queries = [`${role} ${country}`, `${field} ${country}`, `${role}`];

    for (const query of queries) {
      onProgress(`Searching: ${query}...`);
      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(
        query
      )}&num_results=10&date_posted=week&country=${encodeURIComponent(country)}`;

      try {
        const resp = await fetch(url, {
          headers: {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const jobs = data.data || [];
        if (jobs.length === 0) continue;

        for (const j of jobs) {
          if (!j.job_title || !j.employer_name) continue;
          if (seen.has(j.job_id)) continue;
          seen.add(j.job_id);

          const directLink = j.job_apply_link || j.job_google_link || null;

          results.push({
            id: j.job_id,
            title: j.job_title,
            company: j.employer_name,
            logo: j.employer_logo,
            location: j.job_city
              ? `${j.job_city}, ${j.job_country}`
              : j.job_country || country,
            country,
            remote: !!j.job_is_remote,
            type: j.job_employment_type || "Full-time",
            salary: j.job_min_salary
              ? `$${Math.round(j.job_min_salary / 1000)}k–$${Math.round(
                  (j.job_max_salary || j.job_min_salary * 1.3) / 1000
                )}k`
              : null,
            posted: j.job_posted_at_datetime_utc || new Date().toISOString(),
            applyUrl:
              directLink ||
              `https://www.google.com/search?q=${encodeURIComponent(
                j.job_title + " " + j.employer_name + " job apply"
              )}`,
            applySource: directLink ? "Direct" : "Google",
            linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
              j.job_title
            )}&location=${encodeURIComponent(j.job_country || country)}`,
            indeedUrl: `https://www.indeed.com/jobs?q=${encodeURIComponent(
              j.job_title
            )}&l=${encodeURIComponent(j.job_country || country)}`,
            desc: (j.job_description || "").slice(0, 1400),
            qualifications: ((j.job_highlights &&
              j.job_highlights.Qualifications) ||
              []).slice(0, 6),
            benefits: ((j.job_highlights && j.job_highlights.Benefits) ||
              []).slice(0, 4),
            responsibilities: ((j.job_highlights &&
              j.job_highlights.Responsibilities) ||
              []).slice(0, 4),
            score: null,
          });
        }

        if (results.filter((r) => r.country === country).length >= 6) break;
      } catch (e) {
        console.error("Search error:", e);
      }
    }
  }

  results.sort((a, b) => new Date(b.posted) - new Date(a.posted));
  return results;
}

// Builds real job-board search URLs as a fallback when JSearch returns nothing.
function fallbackJobs(role, field, countries) {
  const out = [];
  countries.slice(0, 4).forEach((country, ci) => {
    [role, field].forEach((q, qi) => {
      const id = `fb-${ci}-${qi}`;
      out.push({
        id,
        title: `${q} roles in ${country}`,
        company: "Browse live listings",
        logo: null,
        location: country,
        country,
        remote: false,
        type: "Full-time",
        salary: null,
        posted: new Date().toISOString(),
        applyUrl: `https://www.google.com/search?q=${encodeURIComponent(
          q + " jobs " + country
        )}`,
        applySource: "Google",
        linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
          q
        )}&location=${encodeURIComponent(country)}`,
        indeedUrl: `https://www.indeed.com/jobs?q=${encodeURIComponent(
          q
        )}&l=${encodeURIComponent(country)}`,
        desc:
          "Live job-board search links for " +
          q +
          " in " +
          country +
          ". Add your RapidAPI / JSearch key to load individual postings with AI match scores.",
        qualifications: [],
        benefits: [],
        responsibilities: [],
        score: null,
        fallback: true,
      });
    });
  });
  return out;
}

/* ----------------------------------------------------------------------------
   Reusable atoms
   -------------------------------------------------------------------------- */
function Spin({ size = 14, color = "var(--am)" }) {
  return (
    <span
      className="spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        verticalAlign: "middle",
      }}
    />
  );
}

function Ripple({ children, onClick, style, className = "", disabled }) {
  const ref = useRef(null);
  const fire = (e) => {
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const s = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      s.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.4);pointer-events:none;width:${size}px;height:${size}px;left:${
        e.clientX - rect.left - size / 2
      }px;top:${e.clientY - rect.top - size / 2}px;animation:rip .45s ease-out`;
      el.appendChild(s);
      setTimeout(() => s.remove(), 460);
    }
    if (onClick && !disabled) onClick(e);
  };
  return (
    <button
      ref={ref}
      onClick={fire}
      disabled={disabled}
      className={"ripBtn " + className}
      style={{ opacity: disabled ? 0.55 : 1, ...style }}
    >
      {children}
    </button>
  );
}

function Modal({ open, onClose, children, width = 520 }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,5,10,.72)",
        backdropFilter: "blur(6px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fadeUp"
        style={{
          background: "var(--s1)",
          border: "1px solid var(--s3)",
          borderRadius: 18,
          width: "100%",
          maxWidth: width,
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 40px 100px rgba(0,0,0,.7)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ScoreRing({ score, size = 42 }) {
  const has = typeof score === "number";
  const v = has ? score : 0;
  const stroke = size < 46 ? 3.5 : 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (v / 100) * c;
  const color = v >= 75 ? "var(--gr)" : v >= 55 ? "var(--am)" : "var(--rd)";
  return (
    <div
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--s3)"
          strokeWidth={stroke}
        />
        {has && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            style={{ transition: "stroke-dashoffset .8s ease, stroke .4s ease" }}
          />
        )}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size < 46 ? 11 : 13,
          fontWeight: 700,
          color: has ? color : "var(--td)",
        }}
      >
        {has ? v : "··"}
      </div>
    </div>
  );
}

function ApplyButton({ job, full, label }) {
  const direct = job.applySource === "Direct";
  return (
    <a
      href={job.applyUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="lnk"
      style={{
        background: "var(--am)",
        color: "#1a1206",
        borderColor: "var(--am)",
        fontWeight: 700,
        justifyContent: "center",
        width: full ? "100%" : "auto",
        padding: full ? "11px 14px" : "5px 9px",
        fontSize: full ? 13 : 11,
      }}
    >
      🔗 {label || (direct ? "Apply Directly" : "Apply (via Google)")} ↗
    </a>
  );
}

const STATUS_META = {
  Applied: { c: "var(--bl)", i: "📨" },
  Viewed: { c: "var(--te)", i: "👀" },
  "Interview Scheduled": { c: "var(--pu)", i: "🎯" },
  Offer: { c: "var(--gr)", i: "🎉" },
  Rejected: { c: "var(--rd)", i: "❌" },
  Ghosted: { c: "var(--td)", i: "👻" },
};

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.Applied;
  return (
    <span
      className="pill"
      style={{ background: m.c + "22", color: m.c, border: `1px solid ${m.c}55` }}
    >
      {m.i} {status}
    </span>
  );
}

function Section({ title, children, style }) {
  return (
    <div style={style}>
      <div
        className="syne"
        style={{ fontSize: 13, fontWeight: 800, color: "var(--tm)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0 }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Onboarding (4-step modal)
   -------------------------------------------------------------------------- */
function Onboarding({ onDone, addToast }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(ls.get("onboard_email", "") || "");
  const [field, setField] = useState("");
  const [role, setRole] = useState("");
  const [countries, setCountries] = useState(
    DEFAULT_COUNTRIES.map((c) => ({ ...c }))
  );
  const [newCountry, setNewCountry] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvName, setCvName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [profile, setProfile] = useState(null);

  const addCountry = (n) => {
    const nm = n.trim();
    if (!nm || countries.find((c) => c.name.toLowerCase() === nm.toLowerCase()))
      return;
    setCountries([...countries, { name: nm, flag: flagFor(nm), target: 3 }]);
    setNewCountry("");
  };

  const handleFile = async (file) => {
    if (!file) return;
    setCvName(file.name);
    const text = await file.text();
    setCvText(text);
    setExtracting(true);
    try {
      const raw = await ai(
        "You extract structured professional profiles from CVs.",
        `Extract structured professional profile from this CV. Return ONLY a valid JSON object (no markdown) with keys: skills (string[]), experience (string[]), education (string[]), achievements (string[]), languages (string[]), strengths (string[]), yearsExp (number), seniority (string like Junior/Mid/Senior), preferredRoles (string[]).\n\nCV:\n${text.slice(
          0,
          6000
        )}`,
        900
      );
      const p = parseJ(raw);
      if (p) {
        setProfile(p);
        addToast(
          `✅ AI Profile Ready — ${(p.skills || []).length} skills`,
          "gr"
        );
      } else {
        addToast("Could not parse CV — using basic profile", "rd");
        setProfile(basicProfile(text));
      }
    } catch (e) {
      addToast("Add a Claude key to auto-extract — saved raw CV", "am");
      setProfile(basicProfile(text));
    }
    setExtracting(false);
  };

  const basicProfile = (text) => ({
    skills: [],
    experience: [],
    education: [],
    achievements: [],
    languages: [],
    strengths: [],
    yearsExp: 0,
    seniority: "Mid",
    preferredRoles: [],
    raw: text.slice(0, 2000),
  });

  const reqNotif = () => {
    if ("Notification" in window)
      Notification.requestPermission().then((p) => {
        if (p === "granted") addToast("🔔 Notifications enabled", "gr");
      });
  };

  const canNext = () => {
    if (step === 0) return name && email && field && role;
    if (step === 1) return countries.length > 0;
    return true;
  };

  const finish = () => {
    const user = {
      name,
      email: email.trim(),
      field,
      role,
      countries,
      profile: profile || basicProfile(""),
      created: Date.now(),
    };
    ls.set("user", user);
    onDone(user);
  };

  const Progress = (
    <div style={{ display: "flex", gap: 6, padding: "20px 26px 0" }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 4,
            background: i <= step ? "var(--am)" : "var(--s3)",
            transition: "background .4s ease",
          }}
        />
      ))}
    </div>
  );

  return (
    <Modal open onClose={() => {}} width={560}>
      {Progress}
      <div style={{ padding: 26 }}>
        {step === 0 && (
          <div className="st">
            <div className="syne" style={{ fontSize: 24, fontWeight: 800 }}>
              Welcome to ApplyAI ✨
            </div>
            <div style={{ color: "var(--tm)", margin: "6px 0 20px" }}>
              Your AI-powered job search command center.
            </div>
            <Lbl t="Full name" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            <Lbl t="Email address" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" />
            <Lbl t="Target field" />
            <input value={field} onChange={(e) => setField(e.target.value)} placeholder="Aerospace Engineering" />
            <Lbl t="Target role" />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Drone Engineer" />
          </div>
        )}

        {step === 1 && (
          <div className="st">
            <div className="syne" style={{ fontSize: 22, fontWeight: 800 }}>
              Where are you searching?
            </div>
            <div style={{ color: "var(--tm)", margin: "6px 0 16px" }}>
              Pick target countries and your daily application goal for each.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {countries.map((c, i) => (
                <div
                  key={c.name}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}
                >
                  <span style={{ fontSize: 18 }}>{c.flag}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: "var(--tm)", fontSize: 12 }}>daily</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={c.target}
                    onChange={(e) => {
                      const v = Math.min(50, Math.max(1, +e.target.value || 1));
                      setCountries(countries.map((x, xi) => (xi === i ? { ...x, target: v } : x)));
                    }}
                    style={{ width: 64, textAlign: "center" }}
                  />
                  <button
                    onClick={() => setCountries(countries.filter((_, xi) => xi !== i))}
                    style={{ color: "var(--rd)", fontSize: 18, padding: "0 4px" }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCountry(newCountry)}
                placeholder="Add a country (e.g. Canada)"
              />
              <Ripple onClick={() => addCountry(newCountry)} style={{ background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 10, padding: "0 16px", fontWeight: 600 }}>
                Add
              </Ripple>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {Object.keys(COUNTRY_FLAGS).map((n) => (
                <button
                  key={n}
                  onClick={() => addCountry(n)}
                  className="tag"
                  style={{ background: "var(--s2)", color: "var(--tm)", border: "1px solid var(--s3)" }}
                >
                  {flagFor(n)} {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="st">
            <div className="syne" style={{ fontSize: 22, fontWeight: 800 }}>
              Upload your CV
            </div>
            <div style={{ color: "var(--tm)", margin: "6px 0 16px" }}>
              AI extracts your skills & experience to score every job for you.
            </div>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
              }}
              style={{
                display: "block",
                border: "2px dashed var(--s4)",
                borderRadius: 14,
                padding: "34px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: "var(--s0)",
              }}
            >
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <div style={{ fontSize: 32 }}>📄</div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>
                {cvName || "Drag & drop or click to upload"}
              </div>
              <div style={{ color: "var(--td)", fontSize: 12, marginTop: 4 }}>
                PDF, DOCX or TXT
              </div>
            </label>

            {extracting && (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, color: "var(--am)" }}>
                <Spin /> Extracting your profile with AI...
              </div>
            )}

            {profile && !extracting && (
              <div style={{ marginTop: 16 }} className="fadeUp">
                <div
                  className="pill"
                  style={{ background: "#10B98122", color: "var(--gr)", border: "1px solid #10B98155", fontSize: 12 }}
                >
                  ✅ AI Profile Ready — {(profile.skills || []).length} skills · {profile.yearsExp || 0}y exp
                </div>
                <div style={{ marginTop: 10 }}>
                  {(profile.skills || []).slice(0, 14).map((s, i) => (
                    <span key={i} className="tag" style={{ background: "#10B98118", color: "var(--gr)" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Ripple
              onClick={reqNotif}
              style={{ marginTop: 16, background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 10, padding: "10px 16px", fontWeight: 600 }}
            >
              🔔 Enable Notifications
            </Ripple>
          </div>
        )}

        {step === 3 && (
          <div className="st" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🚀</div>
            <div className="syne" style={{ fontSize: 24, fontWeight: 800, marginTop: 8 }}>
              Ready to launch
            </div>
            <div style={{ color: "var(--tm)", margin: "10px 0 18px" }}>
              We'll search <b style={{ color: "var(--am)" }}>{role}</b> roles in{" "}
              <b style={{ color: "var(--am)" }}>{field}</b> across{" "}
              {countries.length} countries and score every match against your CV.
            </div>
            <div className="card" style={{ padding: 14, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
              <Row k="👤 Candidate" v={name} />
              <Row k="✉️ Email" v={email} />
              <Row k="🎯 Target" v={`${role} · ${field}`} />
              <Row k="🌍 Countries" v={countries.map((c) => c.flag).join(" ")} />
              <Row k="🧠 AI Profile" v={profile ? `${(profile.skills || []).length} skills` : "Basic"} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <Ripple
              onClick={() => setStep(step - 1)}
              style={{ background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 10, padding: "11px 20px", fontWeight: 600 }}
            >
              Back
            </Ripple>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <Ripple
              onClick={() => canNext() && setStep(step + 1)}
              disabled={!canNext()}
              style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "11px 26px", fontWeight: 700 }}
            >
              Continue →
            </Ripple>
          ) : (
            <Ripple
              onClick={finish}
              style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "11px 26px", fontWeight: 700 }}
            >
              Launch ApplyAI ✨
            </Ripple>
          )}
        </div>
      </div>
    </Modal>
  );
}

const Lbl = ({ t }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tm)", margin: "14px 0 6px" }}>{t}</div>
);
const Row = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
    <span style={{ color: "var(--tm)" }}>{k}</span>
    <span style={{ fontWeight: 600 }}>{v}</span>
  </div>
);

/* ----------------------------------------------------------------------------
   Sidebar
   -------------------------------------------------------------------------- */
function Sidebar({ view, setView, user, apps, gmail }) {
  const items = [
    ["feed", "🔍", "Job Feed"],
    ["matches", "⭐", "My Matches"],
    ["tracker", "📋", "Tracker", apps.length],
    ["resume", "📄", "Resume AI"],
    ["insider", "🤝", "Insider"],
    ["orion", "🤖", "Orion AI"],
    ["dashboard", "📊", "Dashboard"],
    ["settings", "⚙️", "Settings"],
  ];
  return (
    <div
      style={{
        width: 210,
        background: "var(--s0)",
        borderRight: "1px solid var(--s3)",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: "20px 18px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div
          className="syne glow"
          style={{
            width: 30, height: 30, borderRadius: 9, background: "var(--am)", color: "#1a1206",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16,
          }}
        >
          A
        </div>
        <div className="syne" style={{ fontSize: 18, fontWeight: 800 }}>ApplyAI</div>
      </div>

      <div style={{ flex: 1, padding: "4px 10px", overflowY: "auto" }}>
        {items.map(([k, icon, label, badge]) => {
          const active = view === k;
          return (
            <button
              key={k}
              onClick={() => setView(k)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10, marginBottom: 2, fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--am)" : "var(--tm)",
                background: active ? "rgba(245,166,35,.1)" : "transparent",
                transition: "background .15s ease, color .15s ease",
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {badge ? (
                <span
                  className="pill"
                  style={{ background: "var(--s3)", color: "var(--tx)", fontSize: 10, padding: "1px 7px" }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--s3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: gmail ? "var(--gr)" : "var(--td)", marginBottom: 12 }}>
          <span className={gmail ? "pulse" : ""} style={{ width: 7, height: 7, borderRadius: "50%", background: gmail ? "var(--gr)" : "var(--td)" }} />
          {gmail ? "Gmail tracking active" : "Gmail not connected"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: "50%", background: "var(--am)", color: "#1a1206",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0,
            }}
          >
            {(user.name || "?")[0].toUpperCase()}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user.name}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--tm)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user.email}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   AI tool runner (shared modal for cover letter / ATS / tailor / interview)
   -------------------------------------------------------------------------- */
function useAiTool(addToast) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState("");

  const run = async (t, system, prompt, max = 900) => {
    setTitle(t);
    setOpen(true);
    setLoading(true);
    setOut("");
    try {
      const r = await ai(system, prompt, max);
      setOut(r);
    } catch (e) {
      setOut("⚠️ Add your Claude API key at the top of the file to use this tool.");
    }
    setLoading(false);
  };

  const node = (
    <Modal open={open} onClose={() => setOpen(false)} width={600}>
      <div style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="syne" style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <button onClick={() => setOpen(false)} style={{ fontSize: 20, color: "var(--tm)" }}>×</button>
        </div>
        <div style={{ marginTop: 14, minHeight: 120 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--am)" }}>
              <Spin /> Generating with AI...
            </div>
          ) : (
            <pre
              style={{
                whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6,
                color: "var(--tx)", background: "var(--s0)", padding: 14, borderRadius: 12, border: "1px solid var(--s3)",
              }}
            >
              {out}
            </pre>
          )}
        </div>
        {!loading && out && (
          <Ripple
            onClick={() => {
              navigator.clipboard.writeText(out);
              addToast("Copied to clipboard", "gr");
            }}
            style={{ marginTop: 12, background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "9px 18px", fontWeight: 700 }}
          >
            📋 Copy
          </Ripple>
        )}
      </div>
    </Modal>
  );

  return { run, node };
}

/* ----------------------------------------------------------------------------
   Job Feed
   -------------------------------------------------------------------------- */
function JobFeed({ user, jobs, scores, setView, logApp, isLogged, status, scoring, onSearch, addToast }) {
  const [q, setQ] = useState(`${user.role} ${user.field}`);
  const [sel, setSel] = useState(null);
  const [remoteFilter, setRemoteFilter] = useState("All");
  const [fresh, setFresh] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [countryFilter, setCountryFilter] = useState("All");
  const [swipe, setSwipe] = useState(false);
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [swipeAnim, setSwipeAnim] = useState("");
  const tool = useAiTool(addToast);

  const scored = jobs.map((j) => ({ ...j, ...(scores[j.id] || {}) }));

  const ranked = [...scored].sort((a, b) => {
    const fa = Math.max(0, 100 - hoursAgo(a.posted) * 3.5);
    const fb = Math.max(0, 100 - hoursAgo(b.posted) * 3.5);
    const wa = (a.score || 50) * 0.65 + fa * 0.35;
    const wb = (b.score || 50) * 0.65 + fb * 0.35;
    return wb - wa;
  });
  const topIds = new Set(ranked.slice(0, 3).map((j) => j.id));

  const filtered = ranked.filter((j) => {
    if (remoteFilter === "Remote" && !j.remote) return false;
    if (remoteFilter === "On-site" && j.remote) return false;
    if (fresh && hoursAgo(j.posted) >= 8) return false;
    if (minScore && (j.score || 0) < minScore) return false;
    if (countryFilter !== "All" && j.country !== countryFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!sel && filtered.length) setSel(filtered[0].id);
  }, [filtered.length]); // eslint-disable-line

  const selJob = filtered.find((j) => j.id === sel) || scored.find((j) => j.id === sel);

  const runTool = (kind, job) => {
    const ps = profileStr(user.profile);
    if (kind === "cover")
      tool.run(
        "✍️ Cover Letter",
        "Expert cover letter writer. No generic AI phrases. Mention the company by name. Personal and specific.",
        `Write a personalized cover letter for ${user.name} applying to ${job.title} at ${job.company}.\nCandidate profile:\n${ps}\nJob: ${job.desc.slice(0, 600)}`
      );
    if (kind === "ats")
      tool.run(
        "🎯 ATS Gap Analysis",
        "ATS optimization expert.",
        `Analyze gaps between this candidate and job. Sections: ✅ MATCHED KEYWORDS, ❌ MISSING KEYWORDS (exact phrases), ATS SCORE /100, TOP 3 RESUME TWEAKS.\nProfile:\n${ps}\nJob:\n${job.title} at ${job.company}\n${job.desc.slice(0, 700)}`
      );
    if (kind === "insider") setView("insider", job.company);
    if (kind === "tailor")
      tool.run(
        "📝 Tailor CV",
        "Resume tailoring expert. Inject ATS keywords naturally. Keep all facts true.",
        `Rewrite the 5 most impactful resume bullets for this candidate targeting this job. Keep facts true, inject ATS keywords.\nProfile:\n${ps}\nJob:\n${job.title}\n${job.desc.slice(0, 600)}`
      );
    if (kind === "prep")
      tool.run(
        "🎯 Interview Prep",
        "Interview coach. Be specific and practical.",
        `Prepare ${user.name} for an interview for ${job.title} at ${job.company}. Give: 5 likely questions with angle, 3 talking points from their background, 2 smart questions to ask.\nProfile:\n${ps}`
      );
  };

  /* ---- Swipe mode ---- */
  if (swipe) {
    const list = filtered;
    const j = list[swipeIdx];
    const doSwipe = (dir) => {
      if (!j) return;
      setSwipeAnim(dir);
      if (dir === "right") {
        logApp(j);
        window.open(j.applyUrl, "_blank");
      }
      setTimeout(() => {
        setSwipeAnim("");
        setSwipeIdx((i) => Math.min(i + 1, list.length));
      }, 380);
    };
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <Toolbar
          q={q} setQ={setQ} onSearch={() => onSearch(q)} swipe={swipe} setSwipe={setSwipe} status={status}
        />
        <div style={{ textAlign: "center", color: "var(--tm)", fontSize: 12, margin: "8px 0 16px" }}>
          {Math.min(swipeIdx + 1, list.length)} / {list.length} · ranked by AI match + recency
        </div>
        {j ? (
          <div
            className="card"
            style={{
              padding: 22,
              transform:
                swipeAnim === "right"
                  ? "translateX(140%) rotate(15deg)"
                  : swipeAnim === "left"
                  ? "translateX(-140%) rotate(-15deg)"
                  : "none",
              transition: "transform .38s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="syne" style={{ fontSize: 19, fontWeight: 800 }}>{j.title}</div>
                <div style={{ color: "var(--am)", fontWeight: 600, marginTop: 2 }}>{j.company}</div>
                <div style={{ color: "var(--tm)", fontSize: 12, marginTop: 4 }}>
                  📍 {j.location} · {timeAgo(j.posted)}
                </div>
              </div>
              <ScoreRing score={j.score} size={52} />
            </div>
            {j.summary && (
              <div style={{ marginTop: 12, color: "var(--tm)", fontStyle: "italic", fontSize: 13 }}>{j.summary}</div>
            )}
            <div
              style={{
                marginTop: 14, fontSize: 12.5, color: "var(--tm)", lineHeight: 1.6,
                maxHeight: 220, overflow: "hidden",
              }}
            >
              {j.desc}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
            🎉 You've reviewed every job. Search again for fresh listings.
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 22 }}>
          <CircleBtn onClick={() => doSwipe("left")} color="var(--rd)" label="❌" />
          <CircleBtn onClick={() => setSwipeIdx((i) => Math.min(i + 1, list.length))} color="var(--tm)" label="⏭" />
          <CircleBtn onClick={() => doSwipe("right")} color="var(--gr)" label="✅" />
        </div>
        {tool.node}
      </div>
    );
  }

  /* ---- List mode ---- */
  return (
    <div style={{ padding: 22, height: "100vh", display: "flex", flexDirection: "column" }}>
      <Toolbar q={q} setQ={setQ} onSearch={() => onSearch(q)} swipe={swipe} setSwipe={setSwipe} status={status} />

      {/* status line */}
      <div style={{ fontSize: 12.5, color: "var(--tm)", margin: "10px 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {status.loading ? (
          <>
            <Spin /> <span>{status.msg}</span>
          </>
        ) : scoring > 0 ? (
          <>
            <Spin /> <span>AI scoring {scoring} jobs...</span>
          </>
        ) : (
          <span>
            {jobs.length} jobs{status.updated ? ` · updated ${timeAgo(status.updated)}` : ""} · from LinkedIn, Indeed, Glassdoor & more via JSearch
          </span>
        )}
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {["All", "Remote", "On-site"].map((r) => (
          <FilterPill key={r} active={remoteFilter === r} onClick={() => setRemoteFilter(r)}>{r}</FilterPill>
        ))}
        <FilterPill active={fresh} onClick={() => setFresh(!fresh)} color="var(--te)">⚡ Under 8h</FilterPill>
        <select value={minScore} onChange={(e) => setMinScore(+e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}>
          <option value={0}>Any match</option>
          <option value={60}>60%+</option>
          <option value={75}>75%+ only</option>
        </select>
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}>
          <option value="All">All countries</option>
          {user.countries.map((c) => (
            <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {/* list */}
        <div className="st" style={{ flex: 1, overflowY: "auto", paddingRight: 4, minWidth: 0 }}>
          {filtered.length === 0 && !status.loading && (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
              No jobs yet. <button onClick={() => onSearch(q)} style={{ color: "var(--am)", fontWeight: 700 }}>Search Now →</button>
            </div>
          )}
          {filtered.map((j) => (
            <JobCard
              key={j.id}
              j={j}
              top={topIds.has(j.id)}
              rank={ranked.indexOf(j) + 1}
              selected={sel === j.id}
              onSelect={() => setSel(j.id)}
              logged={isLogged(j.id)}
              onLog={() => logApp(j)}
            />
          ))}
        </div>

        {/* detail */}
        {selJob && (
          <JobDetail
            key={selJob.id}
            j={selJob}
            logged={isLogged(selJob.id)}
            onLog={() => logApp(selJob)}
            runTool={runTool}
          />
        )}
      </div>
      {tool.node}
    </div>
  );
}

function Toolbar({ q, setQ, onSearch, swipe, setSwipe, status }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ position: "relative", flex: 1 }}>
        <span style={{ position: "absolute", left: 12, top: 10, color: "var(--tm)" }}>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          style={{ paddingLeft: 34 }}
          placeholder="Search jobs..."
        />
      </div>
      <Ripple
        onClick={onSearch}
        disabled={status.loading}
        style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "10px 22px", fontWeight: 700, whiteSpace: "nowrap" }}
      >
        {status.loading ? <Spin color="#1a1206" /> : "Search"}
      </Ripple>
      <Ripple
        onClick={() => setSwipe(!swipe)}
        style={{
          background: swipe ? "var(--am)" : "var(--s2)", color: swipe ? "#1a1206" : "var(--tm)",
          border: "1px solid var(--s3)", borderRadius: 10, padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap",
        }}
      >
        {swipe ? "📋 List" : "🃏 Swipe"}
      </Ripple>
    </div>
  );
}

function FilterPill({ children, active, onClick, color = "var(--am)" }) {
  return (
    <button
      onClick={onClick}
      className="pill"
      style={{
        background: active ? color + "22" : "var(--s2)",
        color: active ? color : "var(--tm)",
        border: `1px solid ${active ? color + "66" : "var(--s3)"}`,
        padding: "6px 12px", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function JobLinks({ j, small }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <ApplyButton job={j} label={small ? "Apply" : undefined} />
      <a href={j.linkedinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="lnk" style={{ background: "#3B82F618", color: "var(--bl)", borderColor: "#3B82F644" }}>
        LinkedIn ↗
      </a>
      <a href={j.indeedUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="lnk" style={{ background: "#8B5CF618", color: "var(--pu)", borderColor: "#8B5CF644" }}>
        Indeed ↗
      </a>
    </div>
  );
}

function JobCard({ j, top, rank, selected, onSelect, logged, onLog }) {
  const fresh = hoursAgo(j.posted) < 8;
  return (
    <div
      onClick={onSelect}
      className="card"
      style={{
        padding: 13, marginBottom: 10, cursor: "pointer",
        borderColor: selected ? "var(--am)" : "var(--s3)",
        background: selected ? "var(--s2)" : "var(--s1)",
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
            {top && <span className="pill" style={{ background: "#F5A62322", color: "var(--am)", border: "1px solid #F5A62355" }}>#{rank} Top Match</span>}
            {fresh ? (
              <span className="pill" style={{ background: "#06B6D422", color: "var(--te)" }}>⚡ {timeAgo(j.posted)}</span>
            ) : (
              <span style={{ fontSize: 11, color: "var(--td)" }}>{timeAgo(j.posted)}</span>
            )}
            {j.remote && <span className="pill" style={{ background: "var(--s3)", color: "var(--tm)" }}>🌐 Remote</span>}
            <span className="pill" style={{ background: "var(--s3)", color: "var(--tm)" }}>{j.type}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
          <div style={{ color: "var(--am)", fontSize: 12, fontWeight: 600, marginTop: 1 }}>{j.company}</div>
          <div style={{ fontSize: 11.5, color: "var(--tm)", marginTop: 3 }}>
            📍 {j.location}
            {j.salary && <span style={{ color: "var(--gr)" }}> · 💰 {j.salary}</span>}
          </div>
          <div style={{ marginTop: 8 }}>
            <JobLinks j={j} small />
          </div>
          {j.summary && (
            <div style={{ marginTop: 7, fontSize: 11.5, fontStyle: "italic", color: "var(--tm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {j.summary}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <ScoreRing score={j.score} size={42} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLog();
            }}
            title="Log application"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: logged ? "#10B98122" : "var(--s2)",
              color: logged ? "var(--gr)" : "var(--tm)",
              border: `1px solid ${logged ? "#10B98155" : "var(--s3)"}`,
              fontSize: 13,
            }}
          >
            {logged ? "✓" : "📋"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobDetail({ j, logged, onLog, runTool }) {
  const lvl =
    !j.score ? null : j.score >= 75 ? ["🟢 Strong Match", "var(--gr)"] : j.score >= 60 ? ["🟡 Good Match", "var(--am)"] : j.score >= 45 ? ["🟠 Fair Match", "var(--am)"] : ["🔴 Weak Match", "var(--rd)"];
  return (
    <div className="fadeUp" style={{ width: 360, flexShrink: 0, overflowY: "auto", paddingRight: 2 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {j.logo ? (
            <img src={j.logo} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", background: "#fff" }} onError={(e) => (e.target.style.display = "none")} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--s2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏢</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{j.title}</div>
            <div style={{ color: "var(--am)", fontSize: 13, fontWeight: 600, marginTop: 2 }}>{j.company}</div>
            <div style={{ fontSize: 11.5, color: "var(--tm)", marginTop: 2 }}>
              📍 {j.location} {j.remote && "· 🌐 Remote"}
            </div>
          </div>
          <ScoreRing score={j.score} size={52} />
        </div>

        {lvl && (
          <div style={{ marginTop: 14, padding: 12, background: "var(--s0)", borderRadius: 12, border: "1px solid var(--s3)" }}>
            <div style={{ fontWeight: 700, color: lvl[1] }}>{lvl[0]}</div>
            {j.summary && <div style={{ fontSize: 12.5, color: "var(--tm)", marginTop: 5, lineHeight: 1.5 }}>{j.summary}</div>}
            {(j.highlights || []).length > 0 && (
              <div style={{ marginTop: 6 }}>
                {j.highlights.map((h, i) => (
                  <span key={i} className="tag" style={{ background: "#F5A62318", color: "var(--am)" }}>{h}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          <Fact k="💰 Salary" v={j.salary || "Not listed"} />
          <Fact k="📋 Type" v={j.type} />
          <Fact k="⚡ Posted" v={timeAgo(j.posted)} />
          <Fact k="🌍 Country" v={`${flagFor(j.country)} ${j.country}`} />
        </div>

        <div style={{ marginTop: 14 }}>
          <ApplyButton job={j} full label={j.applySource === "Direct" ? "Apply Now — Direct Link" : "Apply (via Google Search)"} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <a href={j.linkedinUrl} target="_blank" rel="noreferrer" className="lnk" style={{ flex: 1, justifyContent: "center", background: "#3B82F618", color: "var(--bl)", borderColor: "#3B82F644" }}>LinkedIn ↗</a>
            <a href={j.indeedUrl} target="_blank" rel="noreferrer" className="lnk" style={{ flex: 1, justifyContent: "center", background: "#8B5CF618", color: "var(--pu)", borderColor: "#8B5CF644" }}>Indeed ↗</a>
          </div>
        </div>

        <Ripple
          onClick={onLog}
          style={{
            width: "100%", marginTop: 10, borderRadius: 10, padding: "10px", fontWeight: 700,
            background: logged ? "#10B98122" : "var(--s2)", color: logged ? "var(--gr)" : "var(--tx)",
            border: `1px solid ${logged ? "#10B98155" : "var(--s3)"}`,
          }}
        >
          {logged ? "✓ Application Logged" : "📋 Log This Application"}
        </Ripple>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 10 }}>
          {[["✍️ Cover Letter", "cover"], ["🎯 ATS Gap", "ats"], ["🤝 Insider", "insider"], ["📝 Tailor CV", "tailor"], ["🎯 Interview Prep", "prep"]].map(([l, k]) => (
            <button
              key={k}
              onClick={() => runTool(k, j)}
              className="card"
              style={{ padding: "9px 8px", fontSize: 11.5, fontWeight: 600, color: "var(--tm)", textAlign: "center" }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 10.5, color: "var(--td)", wordBreak: "break-all" }}>
          🔗 <a href={j.applyUrl} target="_blank" rel="noreferrer" style={{ color: "var(--tm)" }}>{j.applyUrl.slice(0, 60)}...</a>
        </div>

        {j.qualifications.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="syne" style={{ fontSize: 12, fontWeight: 800, color: "var(--tm)", marginBottom: 6 }}>REQUIREMENTS</div>
            {j.qualifications.map((q, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--tm)", display: "flex", gap: 7, marginBottom: 5, lineHeight: 1.4 }}>
                <span style={{ color: "var(--am)" }}>✓</span> {q}
              </div>
            ))}
          </div>
        )}

        {j.benefits.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="syne" style={{ fontSize: 12, fontWeight: 800, color: "var(--tm)", marginBottom: 6 }}>BENEFITS</div>
            {j.benefits.map((b, i) => (
              <span key={i} className="tag" style={{ background: "#10B98118", color: "var(--gr)" }}>{b}</span>
            ))}
          </div>
        )}

        {j.desc && (
          <div style={{ marginTop: 14 }}>
            <div className="syne" style={{ fontSize: 12, fontWeight: 800, color: "var(--tm)", marginBottom: 6 }}>DESCRIPTION</div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12, lineHeight: 1.6, color: "var(--tm)" }}>{j.desc.slice(0, 1400)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

const Fact = ({ k, v }) => (
  <div style={{ background: "var(--s0)", borderRadius: 10, padding: "8px 10px", border: "1px solid var(--s3)" }}>
    <div style={{ fontSize: 10.5, color: "var(--td)" }}>{k}</div>
    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
  </div>
);

function CircleBtn({ onClick, color, label }) {
  return (
    <Ripple
      onClick={onClick}
      style={{
        width: 58, height: 58, borderRadius: "50%", fontSize: 22,
        background: "var(--s1)", border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {label}
    </Ripple>
  );
}

/* ----------------------------------------------------------------------------
   My Matches
   -------------------------------------------------------------------------- */
function MyMatches({ jobs, scores, logApp, isLogged }) {
  const matches = jobs
    .map((j) => ({ ...j, ...(scores[j.id] || {}) }))
    .filter((j) => (j.score || 0) >= 60)
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{ padding: 24 }}>
      <div className="syne" style={{ fontSize: 26, fontWeight: 800 }}>⭐ My Matches</div>
      <div style={{ color: "var(--tm)", margin: "4px 0 20px" }}>
        {matches.length} jobs scoring 60%+ against your CV
      </div>
      {matches.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
          No 60%+ matches yet — jobs are still being scored. Check the Job Feed.
        </div>
      ) : (
        <div className="st" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
          {matches.map((j) => (
            <div key={j.id} className="card" style={{ padding: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3 }}>{j.title}</div>
                  <div style={{ color: "var(--am)", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{j.company}</div>
                  <div style={{ fontSize: 11.5, color: "var(--tm)", marginTop: 3 }}>📍 {j.location}{j.salary && ` · 💰 ${j.salary}`}</div>
                </div>
                <ScoreRing score={j.score} size={46} />
              </div>
              {j.summary && <div style={{ marginTop: 9, fontSize: 12, fontStyle: "italic", color: "var(--tm)" }}>{j.summary}</div>}
              {(j.highlights || []).length > 0 && (
                <div style={{ marginTop: 5 }}>
                  {j.highlights.slice(0, 3).map((h, i) => (
                    <span key={i} className="tag" style={{ background: "#F5A62318", color: "var(--am)" }}>{h}</span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 11, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <JobLinks j={j} small />
                <button
                  onClick={() => logApp(j)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: isLogged(j.id) ? "#10B98122" : "var(--s2)",
                    color: isLogged(j.id) ? "var(--gr)" : "var(--tm)",
                    border: `1px solid ${isLogged(j.id) ? "#10B98155" : "var(--s3)"}`,
                  }}
                >
                  {isLogged(j.id) ? "✓" : "📋"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Tracker
   -------------------------------------------------------------------------- */
function Tracker({ user, apps, setApps, gmail, connectGmail, scanInbox, addToast }) {
  const [filter, setFilter] = useState("All");
  const [prep, setPrep] = useState(null);
  const tool = useAiTool(addToast);

  const stats = {
    Applied: apps.filter((a) => a.status === "Applied").length,
    Interviews: apps.filter((a) => a.status === "Interview Scheduled").length,
    Offers: apps.filter((a) => a.status === "Offer").length,
    Rejected: apps.filter((a) => a.status === "Rejected").length,
  };

  const filtered = filter === "All" ? apps : apps.filter((a) => a.status === filter);

  const setStatus = (id, status) => {
    setApps(apps.map((a) => (a.id === id ? { ...a, status } : a)));
    if (status === "Interview Scheduled") {
      const a = apps.find((x) => x.id === id);
      runPrep(a);
    }
  };

  const runPrep = (a) => {
    if (!a) return;
    tool.run(
      "🎯 Interview Prep — " + a.company,
      "Interview coach. Be specific.",
      `Prepare ${user.name} for an interview for ${a.title} at ${a.company}. Give 5 likely questions, 3 talking points from their background, 2 questions to ask.\nProfile:\n${profileStr(user.profile)}`
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="syne" style={{ fontSize: 26, fontWeight: 800 }}>
          📋 Tracker <span style={{ fontSize: 14, color: "var(--tm)" }}>· {apps.length} applications</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {gmail ? (
            <>
              <span className="pill" style={{ background: "#10B98122", color: "var(--gr)", padding: "8px 12px" }}>
                <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gr)", display: "inline-block" }} /> Gmail active
              </span>
              <Ripple onClick={scanInbox} style={{ background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 10, padding: "8px 14px", fontWeight: 600 }}>Scan now</Ripple>
            </>
          ) : (
            <Ripple onClick={connectGmail} style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "8px 16px", fontWeight: 700 }}>📬 Connect Gmail</Ripple>
          )}
        </div>
      </div>

      {!gmail && (
        <div className="card" style={{ marginTop: 14, padding: 13, background: "var(--s2)", fontSize: 12.5, color: "var(--tm)" }}>
          📬 Connect Gmail to auto-track replies — ApplyAI scans your inbox every 15 min and detects interview invites, offers and rejections automatically.
        </div>
      )}

      <div className="st" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, margin: "18px 0" }}>
        <StatCard label="Applied" value={stats.Applied} color="var(--bl)" />
        <StatCard label="Interviews" value={stats.Interviews} color="var(--pu)" />
        <StatCard label="Offers" value={stats.Offers} color="var(--gr)" />
        <StatCard label="Rejected" value={stats.Rejected} color="var(--rd)" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {["All", "Applied", "Viewed", "Interview Scheduled", "Offer", "Rejected", "Ghosted"].map((f) => (
          <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
          No applications {filter !== "All" ? `with status "${filter}"` : "yet"}. Log jobs from the Job Feed.
        </div>
      ) : (
        <div className="st" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((a) => (
            <div key={a.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{a.title}</span>
                    <StatusPill status={a.status} />
                    {typeof a.score === "number" && <span style={{ fontSize: 11.5, color: "var(--tm)" }}>{a.score}% match</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--tm)", marginTop: 3 }}>
                    <span style={{ color: "var(--am)", fontWeight: 600 }}>{a.company}</span> · {flagFor(a.country)} {a.country} · {new Date(a.dateApplied).toLocaleDateString()}
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <JobLinks j={a} small />
                  </div>
                  {a.note && (
                    <div style={{ marginTop: 9, padding: 9, background: "#8B5CF618", border: "1px solid #8B5CF644", borderRadius: 9, fontSize: 12, color: "var(--tx)" }}>
                      📨 {a.note}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end" }}>
                  <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} style={{ width: "auto", fontSize: 12, padding: "6px 8px" }}>
                    {Object.keys(STATUS_META).map((s) => <option key={s}>{s}</option>)}
                  </select>
                  {a.status === "Interview Scheduled" && (
                    <Ripple onClick={() => runPrep(a)} style={{ background: "#8B5CF622", color: "var(--pu)", border: "1px solid #8B5CF655", borderRadius: 9, padding: "6px 12px", fontWeight: 600, fontSize: 12 }}>🎯 Prep</Ripple>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tool.node}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="syne" style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--tm)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Resume AI
   -------------------------------------------------------------------------- */
function ResumeAI({ user, addToast }) {
  const [tab, setTab] = useState(0);
  const tabs = ["📝 Tailor Resume", "🎯 ATS Checker", "✍️ Cover Letter", "🧠 My Profile"];
  const [jd, setJd] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const ps = profileStr(user.profile);

  const run = async (system, prompt, max = 900) => {
    setLoading(true);
    setOut("");
    try {
      setOut(await ai(system, prompt, max));
    } catch {
      setOut("⚠️ Add your Claude API key at the top of the file to use this tool.");
    }
    setLoading(false);
  };

  const go = () => {
    if (tab === 0) run("Resume tailoring expert. Inject ATS keywords naturally. Keep all facts true.", `Rewrite the 5 most impactful resume bullets for this candidate against the job. Keep facts true.\nProfile:\n${ps}\nJob description:\n${jd}`);
    if (tab === 1) run("ATS optimization expert.", `Analyze this resume vs job. Return numbered sections: 1) ✅ MATCHED KEYWORDS 2) ❌ MISSING KEYWORDS (exact phrases) 3) ATS SCORE /100 4) TOP 3 RESUME TWEAKS 5) FORMATTING TIPS.\nProfile:\n${ps}\nJob:\n${jd}`);
    if (tab === 2) run("Expert cover letter writer. No generic AI phrases. Mention the company by name.", `Write a personalized cover letter for ${user.name}.\nProfile:\n${ps}\nJob:\n${jd}`);
  };

  const p = user.profile || {};

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div className="syne" style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>📄 Resume AI</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setOut(""); }} className="pill" style={{ padding: "8px 14px", background: tab === i ? "#F5A62322" : "var(--s2)", color: tab === i ? "var(--am)" : "var(--tm)", border: `1px solid ${tab === i ? "#F5A62355" : "var(--s3)"}` }}>
            {t}
          </button>
        ))}
      </div>

      {tab < 3 ? (
        <div className="st">
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description here..." style={{ minHeight: 130, resize: "vertical" }} />
          <Ripple onClick={go} disabled={!jd || loading} style={{ marginTop: 12, background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "10px 22px", fontWeight: 700 }}>
            {loading ? <Spin color="#1a1206" /> : tabs[tab].split(" ").slice(1).join(" ")}
          </Ripple>
          {(out || loading) && (
            <div className="card" style={{ marginTop: 16, padding: 16 }}>
              {loading ? (
                <div style={{ display: "flex", gap: 8, color: "var(--am)" }}><Spin /> Generating...</div>
              ) : (
                <>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}>{out}</pre>
                  <Ripple onClick={() => { navigator.clipboard.writeText(out); addToast("Copied", "gr"); }} style={{ marginTop: 12, background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 9, padding: "8px 16px", fontWeight: 600 }}>📋 Copy</Ripple>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="st">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
            <StatCard label="Years Exp" value={p.yearsExp || 0} color="var(--am)" />
            <StatCard label="Seniority" value={p.seniority || "—"} color="var(--pu)" />
            <StatCard label="Skills" value={(p.skills || []).length} color="var(--gr)" />
          </div>
          {[["Skills", p.skills], ["Strengths", p.strengths], ["Experience", p.experience], ["Education", p.education], ["Achievements", p.achievements], ["Languages", p.languages]].map(([title, arr]) =>
            (arr || []).length ? (
              <Section key={title} title={title} style={{ marginBottom: 16 }}>
                <div>
                  {arr.map((x, i) => (
                    <span key={i} className="tag" style={{ background: "#F5A62318", color: "var(--am)" }}>{x}</span>
                  ))}
                </div>
              </Section>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Insider
   -------------------------------------------------------------------------- */
function Insider({ user, jobs, preset, addToast }) {
  const [company, setCompany] = useState(preset || "");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preset) setCompany(preset);
  }, [preset]);

  const companies = [...new Set(jobs.map((j) => j.company))].slice(0, 12);

  const go = async () => {
    if (!company) return;
    setLoading(true);
    setOut("");
    try {
      const r = await ai(
        "Expert networking strategist. Be specific and realistic.",
        `Provide for ${company}:\n1) EXACT TITLES to target for referrals (3-4 roles)\n2) LINKEDIN SEARCH STRING (copy-paste ready)\n3) PERSONALIZED OUTREACH EMAIL — mention ${company} and ${user.name}'s background specifically, 5-6 sentences max\n4) FOLLOW-UP TIMING & STRATEGY\n5) WHAT TO SAY IN THE CONVERSATION (2-3 natural openers)\n\nCandidate: ${user.name}, targeting ${user.role}.\nProfile:\n${profileStr(user.profile)}`,
        1100
      );
      setOut(r);
    } catch {
      setOut("⚠️ Add your Claude API key at the top of the file to use this tool.");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div className="syne" style={{ fontSize: 26, fontWeight: 800 }}>🤝 Insider Connections</div>
      <div style={{ color: "var(--tm)", margin: "4px 0 18px" }}>Get a referral strategy & outreach email for any company.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="Company name (e.g. SpaceX)" />
        <Ripple onClick={go} disabled={!company || loading} style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "10px 22px", fontWeight: 700, whiteSpace: "nowrap" }}>
          {loading ? <Spin color="#1a1206" /> : "Generate"}
        </Ripple>
      </div>
      {companies.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {companies.map((c) => (
            <button key={c} onClick={() => setCompany(c)} className="tag" style={{ background: "var(--s2)", color: "var(--tm)", border: "1px solid var(--s3)" }}>{c}</button>
          ))}
        </div>
      )}
      {(out || loading) && (
        <div className="card fadeUp" style={{ marginTop: 18, padding: 18 }}>
          {loading ? (
            <div style={{ display: "flex", gap: 8, color: "var(--am)" }}><Spin /> Building your networking strategy...</div>
          ) : (
            <>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.65 }}>{out}</pre>
              <Ripple onClick={() => { navigator.clipboard.writeText(out); addToast("Copied", "gr"); }} style={{ marginTop: 12, background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 9, padding: "8px 16px", fontWeight: 600 }}>📋 Copy</Ripple>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Orion AI Chat
   -------------------------------------------------------------------------- */
function OrionChat({ user }) {
  const [msgs, setMsgs] = useState(
    ls.get("orion_chat", [{ role: "assistant", content: `Hi ${user.name.split(" ")[0]}! I'm Orion, your AI career coach. Ask me anything about your ${user.role} search — salary, referrals, interviews, CV gaps. What's on your mind?` }])
  );
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    ls.set("orion_chat", msgs);
    endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  const send = async (text) => {
    const t = (text || input).trim();
    if (!t || typing) return;
    const next = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setInput("");
    setTyping(true);
    try {
      const history = next.slice(-8).map((m) => `${m.role === "user" ? "User" : "Orion"}: ${m.content}`).join("\n");
      const r = await ai(
        `You are Orion, an expert AI career coach for ${user.name} who is targeting ${user.role} roles in ${user.field}. Be concise (3-5 sentences), specific, warm and encouraging. Always give actionable advice. Use the user's profile context when relevant.\nProfile:\n${profileStr(user.profile)}`,
        history,
        500
      );
      setMsgs([...next, { role: "assistant", content: r }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "⚠️ Add your Claude API key at the top of the file so I can respond." }]);
    }
    setTyping(false);
  };

  const suggestions = ["How do I negotiate a higher salary?", "Best way to get a referral?", "How do I explain a CV gap?"];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--s3)" }}>
        <div className="glow" style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, var(--am), var(--am2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🤖</div>
        <div>
          <div className="syne" style={{ fontSize: 16, fontWeight: 800 }}>Orion</div>
          <div style={{ fontSize: 11.5, color: "var(--gr)", display: "flex", alignItems: "center", gap: 5 }}>
            <span className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gr)" }} /> AI Career Coach · 24/7
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", maxWidth: 820, width: "100%", margin: "0 auto" }}>
        {msgs.map((m, i) => (
          <div key={i} className="fadeUp" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 14, gap: 9 }}>
            {m.role === "assistant" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--s2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>}
            <div
              style={{
                maxWidth: "76%", padding: "11px 14px", fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--am)" : "var(--s2)",
                color: m.role === "user" ? "#1a1206" : "var(--tx)",
                borderRadius: 14,
                borderBottomRightRadius: m.role === "user" ? 3 : 14,
                borderBottomLeftRadius: m.role === "assistant" ? 3 : 14,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--s2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ background: "var(--s2)", borderRadius: 14, padding: "13px 16px", display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--tm)", animation: `typing 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: "14px 24px 20px", maxWidth: 820, width: "100%", margin: "0 auto" }}>
        {msgs.length < 3 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => setInput(s)} className="tag" style={{ background: "var(--s2)", color: "var(--tm)", border: "1px solid var(--s3)" }}>{s}</button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Orion anything about your job search…"
            rows={1}
            style={{ resize: "none", minHeight: 44 }}
          />
          <Ripple onClick={() => send()} style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "0 20px", fontWeight: 700, fontSize: 18 }}>→</Ripple>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Dashboard
   -------------------------------------------------------------------------- */
function Dashboard({ user, apps, counters, setCounters }) {
  const today = todayStr();
  const todayCounts = counters[today] || {};
  const firstName = user.name.split(" ")[0];
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";

  const totalTarget = user.countries.reduce((s, c) => s + c.target, 0);
  const totalToday = user.countries.reduce((s, c) => s + (todayCounts[c.name] || 0), 0);
  const allMet = totalToday >= totalTarget;

  const weekStats = apps.filter((a) => hoursAgo(a.dateApplied) < 168).length;

  const bump = (country, delta) => {
    const cur = todayCounts[country] || 0;
    const v = Math.max(0, cur + delta);
    setCounters({ ...counters, [today]: { ...todayCounts, [country]: v } });
  };

  // 7-day strip
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const c = counters[ds] || {};
    const total = Object.values(c).reduce((s, n) => s + n, 0);
    days.push({ ds, label: "MTWTFSS"[d.getDay() === 0 ? 6 : d.getDay() - 1], total, today: ds === today });
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="syne" style={{ fontSize: 26, fontWeight: 800 }}>{greet}, {firstName} 👋</div>
          <div style={{ color: "var(--tm)", marginTop: 2 }}>{user.role} · {user.field}</div>
        </div>
        <span className="pill" style={{ background: allMet ? "#10B98122" : "#F5A62322", color: allMet ? "var(--gr)" : "var(--am)", padding: "9px 16px", fontSize: 13 }}>
          {totalToday} / {totalTarget} today {allMet ? "✓" : ""}
        </span>
      </div>

      <div className="st" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, margin: "20px 0" }}>
        <StatCard label="This Week" value={weekStats} color="var(--am)" />
        <StatCard label="Total Logged" value={apps.length} color="var(--bl)" />
        <StatCard label="Interviews" value={apps.filter((a) => a.status === "Interview Scheduled").length} color="var(--pu)" />
        <StatCard label="Offers" value={apps.filter((a) => a.status === "Offer").length} color="var(--gr)" />
      </div>

      <Section title="Daily Application Targets" style={{ marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
          {user.countries.map((c) => {
            const cur = todayCounts[c.name] || 0;
            const met = cur >= c.target;
            return (
              <div key={c.name} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.flag} {c.name}</div>
                  <div style={{ fontSize: 11.5, color: met ? "var(--gr)" : "var(--tm)" }}>{cur}/{c.target} {met && "✓"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
                  <Ripple onClick={() => bump(c.name, -1)} style={{ width: 32, height: 32, borderRadius: 9, background: "var(--s2)", border: "1px solid var(--s3)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>−</Ripple>
                  <AnimNum value={cur} />
                  <Ripple onClick={() => bump(c.name, 1)} style={{ width: 32, height: 32, borderRadius: 9, background: "var(--am)", color: "#1a1206", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</Ripple>
                </div>
                <div style={{ height: 6, background: "var(--s2)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (cur / c.target) * 100)}%`, background: met ? "var(--gr)" : "var(--am)", transition: "width .4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Last 7 Days">
        <div style={{ display: "flex", gap: 8 }}>
          {days.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div
                className="card"
                style={{
                  padding: "12px 4px",
                  border: d.today ? "1px solid var(--am)" : "1px solid var(--s3)",
                  background: d.total ? "#F5A62318" : "var(--s1)",
                }}
              >
                <div className="syne" style={{ fontSize: 18, fontWeight: 800, color: d.total ? "var(--am)" : "var(--td)" }}>{d.total}</div>
              </div>
              <div style={{ fontSize: 11, color: d.today ? "var(--am)" : "var(--tm)", marginTop: 5 }}>{d.label}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function AnimNum({ value }) {
  const [v, setV] = useState(value);
  const ref = useRef(null);
  useEffect(() => {
    if (value !== v) {
      setV(value);
      if (ref.current) {
        ref.current.classList.remove("pop");
        void ref.current.offsetWidth;
        ref.current.classList.add("pop");
      }
    }
  }, [value]); // eslint-disable-line
  return (
    <span ref={ref} className="syne" style={{ flex: 1, textAlign: "center", fontSize: 24, fontWeight: 800 }}>
      {v}
    </span>
  );
}

/* ----------------------------------------------------------------------------
   Settings
   -------------------------------------------------------------------------- */
function Settings({ user, setUser, gmail, connectGmail, addToast, clearScores }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [field, setField] = useState(user.field);
  const [role, setRole] = useState(user.role);
  const [countries, setCountries] = useState(user.countries.map((c) => ({ ...c })));
  const [extracting, setExtracting] = useState(false);

  const save = () => {
    const u = { ...user, name, email: email.trim(), field, role, countries };
    setUser(u);
    ls.set("user", u);
    addToast("Settings saved", "gr");
  };

  const reupload = async (file) => {
    if (!file) return;
    setExtracting(true);
    try {
      const text = await file.text();
      const raw = await ai(
        "You extract structured professional profiles from CVs.",
        `Extract structured professional profile from this CV. Return ONLY a valid JSON object (no markdown) with keys: skills (string[]), experience (string[]), education (string[]), achievements (string[]), languages (string[]), strengths (string[]), yearsExp (number), seniority (string), preferredRoles (string[]).\n\nCV:\n${text.slice(0, 6000)}`,
        900
      );
      const p = parseJ(raw);
      if (p) {
        const u = { ...user, name, email, field, role, countries, profile: p };
        setUser(u);
        ls.set("user", u);
        clearScores();
        addToast(`✅ New profile — ${(p.skills || []).length} skills · jobs will re-score`, "gr");
      } else addToast("Could not parse CV", "rd");
    } catch {
      addToast("Add a Claude key to extract profile", "am");
    }
    setExtracting(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 680 }}>
      <div className="syne" style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>⚙️ Settings</div>

      <Section title="Profile" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><Lbl t="Name" /><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Lbl t="Email" /><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Lbl t="Target field" /><input value={field} onChange={(e) => setField(e.target.value)} /></div>
          <div><Lbl t="Target role" /><input value={role} onChange={(e) => setRole(e.target.value)} /></div>
        </div>
      </Section>

      <Section title="Daily Targets" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {countries.map((c, i) => (
            <div key={c.name} className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
              <span>{c.flag}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
              <input type="number" min={1} max={50} value={c.target} onChange={(e) => setCountries(countries.map((x, xi) => (xi === i ? { ...x, target: Math.max(1, +e.target.value || 1) } : x)))} style={{ width: 64, textAlign: "center" }} />
              <button onClick={() => setCountries(countries.filter((_, xi) => xi !== i))} style={{ color: "var(--rd)", fontSize: 18 }}>×</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="CV / AI Profile" style={{ marginBottom: 24 }}>
        <label style={{ display: "inline-block", background: "var(--s2)", border: "1px solid var(--s3)", borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
          {extracting ? <><Spin /> Extracting...</> : "📄 Re-upload CV"}
          <input type="file" accept=".pdf,.docx,.txt,.md" style={{ display: "none" }} onChange={(e) => reupload(e.target.files[0])} />
        </label>
        <div style={{ fontSize: 12, color: "var(--tm)", marginTop: 8 }}>Re-uploading regenerates your AI profile and clears job scores so everything re-scores against the new CV.</div>
      </Section>

      <Section title="Integrations" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <IntegRow icon="🔍" name="JSearch / RapidAPI" ok={!!RAPIDAPI_KEY} okLabel="Connected" badLabel="⚠️ Add key at top of file" />
          <IntegRow icon="🤖" name="Claude AI" ok={!!CLAUDE_KEY} okLabel="Active" badLabel="⚠️ Add key at top of file" />
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
            <span>📬</span>
            <span style={{ flex: 1, fontWeight: 600 }}>Gmail</span>
            {gmail ? (
              <span style={{ fontSize: 12, color: "var(--gr)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gr)" }} /> Connected
              </span>
            ) : (
              <Ripple onClick={connectGmail} style={{ background: "var(--am)", color: "#1a1206", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12 }}>Connect Gmail</Ripple>
            )}
          </div>
        </div>
      </Section>

      <div style={{ display: "flex", gap: 10 }}>
        <Ripple onClick={save} style={{ background: "var(--am)", color: "#1a1206", borderRadius: 10, padding: "11px 24px", fontWeight: 700 }}>Save Changes</Ripple>
        <Ripple
          onClick={() => {
            if (window.confirm("Reset ApplyAI? This clears ALL data — profile, jobs, applications, scores.")) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          style={{ background: "#F43F5E22", color: "var(--rd)", border: "1px solid #F43F5E55", borderRadius: 10, padding: "11px 24px", fontWeight: 700 }}
        >
          Reset App
        </Ripple>
      </div>
    </div>
  );
}

function IntegRow({ icon, name, ok, okLabel, badLabel }) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
      <span>{icon}</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{name}</span>
      <span style={{ fontSize: 12, color: ok ? "var(--gr)" : "var(--am)" }}>{ok ? okLabel : badLabel}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */
function Toasts({ toasts }) {
  const colors = { am: "var(--am)", gr: "var(--gr)", rd: "var(--rd)" };
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 300, display: "flex", flexDirection: "column", gap: 8, maxWidth: 340 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fadeUp"
          style={{
            background: "rgba(16,22,34,.85)", backdropFilter: "blur(10px)",
            border: `1px solid ${colors[t.type] || "var(--am)"}55`,
            borderLeft: `3px solid ${colors[t.type] || "var(--am)"}`,
            borderRadius: 12, padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "var(--tx)",
            boxShadow: "0 12px 40px rgba(0,0,0,.4)",
          }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   Root App
   ========================================================================== */
export default function App() {
  const [user, setUser] = useState(() => ls.get("user", null));
  const [view, setView] = useState("feed");
  const [insiderPreset, setInsiderPreset] = useState("");
  const [jobs, setJobs] = useState(() => ls.get("jobs", []));
  const [scores, setScores] = useState(() => ls.get("scores", {}));
  const [apps, setApps] = useState(() => ls.get("applications", []));
  const [counters, setCounters] = useState(() => ls.get("counters", {}));
  const [toasts, setToasts] = useState([]);
  const [gmail, setGmail] = useState(() => {
    const t = ls.get("gmail_token", null);
    return t && t.expiry > Date.now();
  });
  const [status, setStatus] = useState({ loading: false, msg: "", updated: ls.get("lastFetch", null) });
  const [scoring, setScoring] = useState(0);

  const styleRef = useRef(false);
  useEffect(() => {
    if (styleRef.current) return;
    styleRef.current = true;
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  // persist
  useEffect(() => ls.set("jobs", jobs), [jobs]);
  useEffect(() => ls.set("scores", scores), [scores]);
  useEffect(() => ls.set("applications", apps), [apps]);
  useEffect(() => ls.set("counters", counters), [counters]);

  const addToast = useCallback((msg, type = "am") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [{ msg, type, id }, ...t].slice(0, 4));
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("ApplyAI", { body: msg });
      } catch {}
    }
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
  }, []);

  /* ---- Search + score ---- */
  const runSearch = useCallback(
    async (query) => {
      if (!user) return;
      const role = query || `${user.role} ${user.field}`;
      setStatus({ loading: true, msg: "Searching...", updated: status.updated });
      let results = [];
      if (RAPIDAPI_KEY) {
        results = await searchJobs(role, user.field, user.countries.map((c) => c.name), (msg) =>
          setStatus((s) => ({ ...s, loading: true, msg }))
        );
      }
      if (!results.length) {
        results = fallbackJobs(user.role, user.field, user.countries.map((c) => c.name));
        if (!RAPIDAPI_KEY) addToast("Add a RapidAPI/JSearch key for live postings — showing job-board search links", "am");
      }
      const now = new Date().toISOString();
      setJobs(results);
      setStatus({ loading: false, msg: "", updated: now });
      ls.set("lastFetch", now);
      scoreJobs(results);
    },
    [user, status.updated] // eslint-disable-line
  );

  const scoreJobs = useCallback(
    async (list) => {
      if (!CLAUDE_KEY || !user) return;
      const unscored = list.filter((j) => !j.fallback && !ls.get("scores", {})[j.id]).slice(0, 15);
      if (!unscored.length) return;
      setScoring(unscored.length);
      const ps = profileStr(user.profile);
      let left = unscored.length;
      for (const job of unscored) {
        try {
          const raw = await ai(
            "You are a precise job-match scorer. Return ONLY a valid JSON object with: score (integer 0-100), summary (string, max 15 words), highlights (array of 2-3 short strength strings).",
            `CANDIDATE PROFILE:\n${ps}\nJOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nDescription: ${job.desc.slice(0, 600)}`,
            450
          );
          const p = parseJ(raw);
          if (p && typeof p.score === "number") {
            setScores((prev) => {
              const next = { ...prev, [job.id]: { score: Math.round(p.score), summary: p.summary || "", highlights: p.highlights || [] } };
              ls.set("scores", next);
              return next;
            });
          }
        } catch {}
        left--;
        setScoring(left);
        await new Promise((r) => setTimeout(r, 220));
      }
      setScoring(0);
    },
    [user]
  );

  // auto-search on mount / staleness + 30-min refresh
  useEffect(() => {
    if (!user) return;
    const last = ls.get("lastFetch", null);
    const stale = !last || Date.now() - new Date(last).getTime() > 30 * 60 * 1000;
    if (stale) runSearch();
    else if (jobs.length) scoreJobs(jobs);
    const iv = setInterval(() => runSearch(), 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [user]); // eslint-disable-line

  /* ---- Applications ---- */
  const isLogged = useCallback((id) => apps.some((a) => a.jobId === id), [apps]);

  const logApp = useCallback(
    (job) => {
      if (apps.some((a) => a.jobId === job.id)) {
        addToast("Already in your tracker", "am");
        return;
      }
      const sc = ls.get("scores", {})[job.id];
      const app = {
        id: "app-" + Date.now() + Math.random().toString(36).slice(2, 6),
        jobId: job.id,
        title: job.title,
        company: job.company,
        country: job.country,
        applyUrl: job.applyUrl,
        applySource: job.applySource,
        linkedinUrl: job.linkedinUrl,
        indeedUrl: job.indeedUrl,
        status: "Applied",
        dateApplied: new Date().toISOString(),
        score: sc ? sc.score : (scores[job.id] && scores[job.id].score) || null,
        note: "",
      };
      setApps((a) => [app, ...a]);
      // count toward today's quota for that country
      const today = todayStr();
      setCounters((c) => {
        const day = c[today] || {};
        return { ...c, [today]: { ...day, [job.country]: (day[job.country] || 0) + 1 } };
      });
      addToast(`📋 Logged: ${job.title} @ ${job.company}`, "gr");
    },
    [apps, scores, addToast]
  );

  /* ---- Gmail ---- */
  const gsiReady = useRef(false);
  const loadGsi = () =>
    new Promise((resolve) => {
      if (window.google && window.google.accounts) return resolve();
      if (gsiReady.current) {
        const check = setInterval(() => {
          if (window.google && window.google.accounts) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        return;
      }
      gsiReady.current = true;
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

  const scanInbox = useCallback(
    async (token) => {
      const tok = token || (ls.get("gmail_token", {}) || {}).access_token;
      if (!tok) return;
      try {
        const listResp = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=" +
            encodeURIComponent("subject:(application OR interview OR offer OR position OR opportunity OR assessment OR hiring) newer_than:30d") +
            "&maxResults=20",
          { headers: { Authorization: "Bearer " + tok } }
        );
        if (!listResp.ok) return;
        const list = await listResp.json();
        const messages = list.messages || [];
        const curApps = ls.get("applications", []);
        for (const m of messages.slice(0, 15)) {
          const md = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
            { headers: { Authorization: "Bearer " + tok } }
          ).then((r) => r.json());
          const headers = (md.payload && md.payload.headers) || [];
          const subject = (headers.find((h) => h.name === "Subject") || {}).value || "";
          const from = (headers.find((h) => h.name === "From") || {}).value || "";
          const snippet = md.snippet || "";
          const match = curApps.find((a) => from.toLowerCase().includes(a.company.toLowerCase().split(" ")[0]) || subject.toLowerCase().includes(a.company.toLowerCase().split(" ")[0]));
          if (!match || !CLAUDE_KEY) continue;
          try {
            const raw = await ai(
              "Email classifier for job applications. Return ONLY valid JSON: {status: one of 'Applied'/'Viewed'/'Interview Scheduled'/'Offer'/'Rejected'/'Ghosted', confidence: number 0-100, note: string one-sentence summary}",
              `From: ${from}\nSubject: ${subject}\nSnippet: ${snippet}`,
              350
            );
            const p = parseJ(raw);
            if (p && p.confidence > 65 && p.status !== match.status) {
              setApps((prev) => prev.map((a) => (a.id === match.id ? { ...a, status: p.status, note: p.note || a.note } : a)));
              addToast(`📨 ${match.company}: ${p.note}`, "gr");
            }
          } catch {}
        }
      } catch (e) {
        console.error("Gmail scan", e);
      }
    },
    [addToast]
  );

  const connectGmail = useCallback(async () => {
    if (!GMAIL_CID) {
      addToast("Add a Gmail OAuth Client ID at the top of the file", "am");
      return;
    }
    await loadGsi();
    window.google.accounts.oauth2
      .initTokenClient({
        client_id: GMAIL_CID,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        callback: (resp) => {
          if (resp.error) return;
          const token = { access_token: resp.access_token, expiry: Date.now() + (resp.expires_in || 3600) * 1000 };
          ls.set("gmail_token", token);
          setGmail(true);
          addToast("🟢 Gmail connected — scanning inbox", "gr");
          scanInbox(resp.access_token);
        },
      })
      .requestAccessToken();
  }, [addToast, scanInbox]);

  // periodic Gmail scan every 15 min
  useEffect(() => {
    if (!gmail) return;
    scanInbox();
    const iv = setInterval(() => scanInbox(), 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [gmail]); // eslint-disable-line

  /* ---- 11AM reminder ---- */
  useEffect(() => {
    if (!user) return;
    const check = () => {
      const now = new Date();
      const today = todayStr();
      const fired = ls.get("reminderFired", null);
      if (fired && fired !== today) ls.set("reminderFired", null);
      if (now.getHours() === 11 && now.getMinutes() < 5 && ls.get("reminderFired", null) !== today) {
        const day = (ls.get("counters", {})[today]) || {};
        const left = user.countries.map((c) => ({ c, n: c.target - (day[c.name] || 0) })).filter((x) => x.n > 0);
        if (left.length) {
          const msg = "⏰ " + left.map((x) => `${x.c.name}: ${x.n} left`).join(" | ");
          addToast(msg, "am");
          ls.set("reminderFired", today);
        }
      }
    };
    const iv = setInterval(check, 60 * 1000);
    check();
    return () => clearInterval(iv);
  }, [user, addToast]);

  const clearScores = useCallback(() => {
    setScores({});
    ls.set("scores", {});
    ls.set("lastFetch", null);
  }, []);

  const goView = (v, preset) => {
    if (v === "insider" && preset) setInsiderPreset(preset);
    setView(v);
  };

  if (!user) {
    return (
      <>
        <Toasts toasts={toasts} />
        <Onboarding
          onDone={(u) => {
            setUser(u);
            setView("feed");
          }}
          addToast={addToast}
        />
      </>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Toasts toasts={toasts} />
      <Sidebar view={view} setView={goView} user={user} apps={apps} gmail={gmail} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {view === "feed" && (
          <JobFeed
            user={user}
            jobs={jobs}
            scores={scores}
            setView={goView}
            logApp={logApp}
            isLogged={isLogged}
            status={status}
            scoring={scoring}
            onSearch={runSearch}
            addToast={addToast}
          />
        )}
        {view === "matches" && <MyMatches jobs={jobs} scores={scores} logApp={logApp} isLogged={isLogged} />}
        {view === "tracker" && (
          <Tracker user={user} apps={apps} setApps={setApps} gmail={gmail} connectGmail={connectGmail} scanInbox={() => scanInbox()} addToast={addToast} />
        )}
        {view === "resume" && <ResumeAI user={user} addToast={addToast} />}
        {view === "insider" && <Insider user={user} jobs={jobs} preset={insiderPreset} addToast={addToast} />}
        {view === "orion" && <OrionChat user={user} />}
        {view === "dashboard" && <Dashboard user={user} apps={apps} counters={counters} setCounters={setCounters} />}
        {view === "settings" && (
          <Settings user={user} setUser={setUser} gmail={gmail} connectGmail={connectGmail} addToast={addToast} clearScores={clearScores} />
        )}
      </div>
    </div>
  );
}
