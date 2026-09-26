/* Ascent v2 · personal life roadmap app
   Data lives in Supabase; only the owner's account can read or write it. */
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";

/* ---------------- config ---------------- */
const SUPABASE_URL = "https://vdzpmoulolbvuxwrisxp.supabase.co";
const SUPABASE_KEY = "sb_publishable_J3TUDWm-312uxTUUXRrY0w_rmOgfXzg"; // publishable key: safe to be public
/* Personal text (name, reasons) lives in your private Supabase settings, never in this public code.
   Main fills ME after sign-in; the sign-in page only ever shows "Ascent". */
const ME = { ar: "", en: "", why: [] };
function fillMe(s) {
  const p = (s && s.me) || {};
  ME.ar = p.nameAr || ""; ME.en = p.nameEn || ""; ME.why = Array.isArray(p.why) ? p.why.filter(Boolean) : [];
}
const meAr = () => ME.ar || "ASCENT";
const meEn = () => (ME.en || "ASCENT").toUpperCase();
const lsGet = (k, dflt) => { try { const v = localStorage.getItem(k); return v === null ? dflt : v; } catch (e) { return dflt; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const MOTION = lsGet("ascent-motion", "calm");               // on | calm | off
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches || MOTION === "off";
const CALM = REDUCE || MOTION === "calm";
const MOBILE = matchMedia("(pointer:coarse)").matches || innerWidth < 700;
document.documentElement.setAttribute("data-motion", REDUCE ? "off" : MOTION);
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const DEFAULT_SETTINGS = { investRisk: "Aggressive", budget: 200, categories: ["Food", "Transport", "Smokes", "Other"], ord: "2028-09-30", studyStart: "2027-01-01", studyTarget: 240, guiltFree: 20, income: null };
const STAGES = [
  { n: "01", t: "Stop the bleeding", w: "Clear all BNPL and credit", g: "$300 buffer, no new credit, loans paid down." },
  { n: "02", t: "Stable", w: "Clear every debt", g: "Network+, first money to your parents, about $4,000 saved." },
  { n: "03", t: "Build", w: "Fill the emergency fund", g: "Six months of expenses saved, investing on autopilot, a trip a year." },
  { n: "04", t: "Big items", w: "Parents, home, family", g: "Your parents' Hajj, their renovation, BTO, wedding." },
  { n: "05", t: "Freedom", w: "Long term", g: "Parents fully supported. $1M+." },
];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------------- helpers ---------------- */
const fmt = (n, d = 0) => (Number(n) < 0 ? "-$" : "$") + Math.abs(Number(n || 0)).toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d });
const money = n => fmt(n, Math.abs(Number(n) % 1) > 0.001 ? 2 : 0);
const r2 = n => Math.round(Number(n) * 100) / 100;
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ym = d => ymd(d).slice(0, 7);
const parseDate = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d || 1); };
const cap = s => s.charAt(0) + s.slice(1).toLowerCase();
const dayLabel = d => `${DAYS[d.getDay()]} ${d.getDate()} ${cap(MONTHS[d.getMonth()])}`;
const monthLabel = key => { const [y, m] = key.split("-"); return `${MONTHS[+m - 1]} ${y}`; };
const monthLong = key => { const [y, m] = key.split("-"); return `${cap(MONTHS[+m - 1])} ${y}`; };
const diffDays = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
const taskUnlock = t => { const d = parseDate(t.due_date); d.setDate(d.getDate() - 7); return d; }; // tasks open 7 days before they're due
const dayYr = d => dayLabel(d) + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
const taskLocked = (t, today) => !!t.due_date && !t.done && taskUnlock(t) > today;
const rowDate = r => { const [y, m] = r.month_date.split("-").map(Number); const dim = new Date(y, m, 0).getDate(); return new Date(y, m - 1, Math.min(r.due_day || 1, dim)); };
const groupOf = r => (r.category === "Telco" ? "Phone contracts" : r.entity_name);
const isOblig = r => r.category !== "Income";
const isRecurring = r => r.category === "Bill" || r.category === "Parents"; // monthly bills + money to parents: paid out, but not debt
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ Math.random() * 16 >> c / 4).toString(16)));
const potName = p => p.name.replace(/^Goal: /, "").replace(" (IBKR)", "");
const ago = iso => { if (!iso) return ""; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 2 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
const num = v => { const x = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(x) ? NaN : x; };

/* ---------------- tiny synth (off by default) ---------------- */
const Sound = { on: false, ctx: null,
  tone(f, d = .08, type = "sine", v = .05, when = 0) {
    if (!this.on) return;
    try {
      const c = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  },
  tick() { this.tone(1400, .03, "square", .015); },
  check() { this.tone(660, .09, "triangle", .05); this.tone(990, .14, "triangle", .05, .07); },
  chord() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 1.2, "triangle", .045, i * .09)); },
};

/* ---------------- offline cache + write queue ---------------- */
const CKEY = "ascent-cache-v2", QKEY = "ascent-queue-v2";
const readCache = () => { try { return JSON.parse(localStorage.getItem(CKEY) || "null"); } catch (e) { return null; } };
const readQueue = () => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch (e) { return []; } };
const saveQueue = q => lsSet(QKEY, JSON.stringify(q));
const isNetErr = e => !!e && (e instanceof TypeError || /fetch|network|load failed|offline|timed? ?out/i.test(e.message || String(e)));
async function exec(op) {
  let q = sb.from(op.table);
  if (op.t === "insert") q = q.insert(op.row);
  else if (op.t === "upsert") q = q.upsert(op.row);
  else if (op.t === "update") q = q.update(op.patch);
  else if (op.t === "delete") q = q.delete();
  (op.f || []).forEach(([k, c, v]) => { q = q[k](c, v); });
  const { error } = await q;
  if (error) { const e = new Error(error.message || "Save failed"); e.net = isNetErr(error); throw e; }
}
/* ---------------- small building blocks ---------------- */
const Tick = ({ s = 14 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

function Odometer({ value }) {
  const s = Math.round(value).toLocaleString("en-SG");
  return (
    <span className="odo" aria-label={"$" + s}>
      {s.split("").map((ch, i) => /\d/.test(ch)
        ? <span className="col" key={s.length - i}><span style={{ transform: `translateY(${-Number(ch) * 10}%)`, transitionDelay: i * 45 + "ms" }}>{"0123456789".split("").map(d => <i key={d}>{d}</i>)}</span></span>
        : <span className="st" key={"s" + (s.length - i)}>{ch}</span>)}
    </span>
  );
}

function Count({ to, d = 0, prefix = "$", dur = 1200 }) {
  const [v, setV] = useState(REDUCE ? to : 0); const from = useRef(REDUCE ? to : 0);
  useEffect(() => {
    const a = from.current, t0 = performance.now(); let raf;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); setV(a + (to - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = to; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className="num">{prefix}{v.toLocaleString("en-SG", { minimumFractionDigits: d, maximumFractionDigits: d })}</span>;
}

function Marquee({ items, className = "", dir = -1, speed = .35 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (CALM) return;
    const el = ref.current; if (!el) return;
    let x = 0, last = scrollY, v = 0, raf = 0, half = el.scrollWidth / 2, on = true, prev = performance.now();
    const ro = new ResizeObserver(() => { half = el.scrollWidth / 2; }); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on && !raf) { prev = performance.now(); raf = requestAnimationFrame(loop); } }); io.observe(el.parentElement || el);
    const loop = now => {
      if (!on || document.hidden) { raf = 0; return; }
      const k = Math.min(3, (now - prev) / 16.7); prev = now;
      const dy = scrollY - last; last = scrollY; v = v * .9 + Math.min(40, Math.abs(dy)) * .12;
      x += dir * (speed + v) * k;
      if (half > 0) { if (x <= -half) x += half; if (x > 0) x -= half; }
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`; raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);
  const row = items.map((t, i) => <span key={i} className={(i % 2 ? "" : "outline") + (/[؀-ۿ]/.test(t) ? " ar" : "")} dir="auto">{t}</span>);
  return <div ref={ref} className={"marquee " + className} aria-hidden="true">{row}{row}</div>;
}

function Scramble({ text }) {
  const [out, setOut] = useState(text); const ref = useRef(null);
  useEffect(() => {
    if (CALM || !ref.current) return;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#%";
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now(), dur = 900;
      const step = t => {
        const k = Math.min(1, (t - t0) / dur);
        setOut(text.split("").map((c, i) => c === " " || i < k * text.length ? c : chars[(Math.random() * chars.length) | 0]).join(""));
        if (k < 1) requestAnimationFrame(step); else setOut(text);
      };
      requestAnimationFrame(step);
    }, { threshold: .6 });
    io.observe(ref.current); return () => io.disconnect();
  }, []);
  return <h2 ref={ref} aria-label={text}>{out}</h2>;
}

function useReveal(dep) {
  useEffect(() => {
    if (CALM || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove("pre"); io.unobserve(e.target); } }), { threshold: .08 });
    document.querySelectorAll(".reveal:not([data-seen])").forEach(el => { el.setAttribute("data-seen", "1"); if (el.getBoundingClientRect().top > innerHeight * .92) { el.classList.add("pre"); io.observe(el); } });
    return () => io.disconnect();
  }, [dep]);
}

function Ring({ pct }) {
  const r = 38, c = 2 * Math.PI * r; const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(Math.min(100, pct)), 300); return () => clearTimeout(t); }, [pct]);
  return (
    <svg viewBox="0 0 92 92" aria-hidden="true">
      <circle className="track2" cx="46" cy="46" r={r} fill="none" strokeWidth="3" />
      <circle className="ring" cx="46" cy="46" r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(.02, p / 100))} transform="rotate(-90 46 46)" />
      <text x="46" y="51" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="700" fill="currentColor">{Math.round(pct)}%</text>
    </svg>
  );
}

/* ---------------- the mountain ---------------- */
/* The lone samurai (seen from behind). Poses: stand (Money), kneel (Invest, guarding), walk (Career), sit (Life, meditating). */
/* ---------------- overlays ---------------- */
function Party({ x, y, kicker, line1, line2, text, onDone }) {
  const cv = useRef(null);
  useEffect(() => {
    buzz([40, 60, 40, 60, 140]); Sound.chord();
    if (REDUCE) return;
    const c = cv.current, ctx = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr, col = cssVar("--bg") || "#fff";
    const P = Array.from({ length: 150 }, () => ({ x: W / 2, y: H * .5, vx: (Math.random() - .5) * 28 * dpr, vy: (-Math.random() * 24 - 4) * dpr, s: (Math.random() * 8 + 3) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .35 }));
    let t = 0, raf; const start = performance.now();
    const draw = now => {
      if (now - start < 900) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H); t++;
      for (const p of P) { p.vy += .5 * dpr; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - t / 160); ctx.fillStyle = col; ctx.fillRect(-p.s / 2, -p.s / 5, p.s, p.s / 2.5); ctx.restore(); }
      if (t < 160) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);
  const tag = (line1 + " " + line2).toUpperCase() + " —";
  return (
    <div className="party" style={{ "--x": x + "px", "--y": y + "px" }} role="dialog" aria-label={line1 + " " + line2}>
      <Marquee className="p1" items={[tag, "KEEP CLIMBING —", tag, "KEEP CLIMBING —"]} speed={1.2} />
      <Marquee className="p2" items={[meAr(), "ONE STEP HIGHER —", meAr(), "ONE STEP HIGHER —"]} dir={1} speed={1.2} />
      <canvas ref={cv} />
      <div className="pc">
        <div className="k">{kicker}</div>
        <h3><span>{line1}</span><span>{line2}</span></h3>
        <p>{text}</p>
        <button onClick={onDone}>Keep climbing</button>
      </div>
    </div>
  );
}

/* A spiral galaxy drawn on canvas: rotating arms, nebula glow, a dark core with a bright ring.
   `warp` flies you into the centre (used for the portal and the end of the loader). */
function Loader({ ready, onDone, jdm }) {
  const [n, setN] = useState(0); const [out, setOut] = useState(false);
  const readyRef = useRef(ready); readyRef.current = ready;
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => {
    const t0 = performance.now(); let raf;
    const step = t => {
      const k = Math.min(readyRef.current ? 1 : .9, (t - t0) / 1800);
      setN(Math.round((1 - Math.pow(1 - k, 3)) * 100));
      if (k >= 1) { setOut(true); setTimeout(() => doneRef.current(), 1100); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, []);
  if (jdm) return (
    <div className={"ug-load" + (out ? " out" : "")} role="status" aria-label="Loading">
      <UGLogo />
      <span className="ug-hud">Loading your garage</span>
      <div className="ug-ld"><i style={{ width: n + "%" }} /></div>
      <div className="ug-lnum">{String(n).padStart(3, "0")}<small>%</small></div>
    </div>
  );
}

/* number pad sheet, used for spending and pot balances */
function NumSheet({ title, hint, cats, initial = "", cta, onClose, onSave }) {
  const [a, setA] = useState(initial); const [cat, setCat] = useState(cats ? cats[0] : null);
  const press = k => { buzz(6); Sound.tick(); setA(x => k === "⌫" ? x.slice(0, -1) : (k === "." && x.includes(".")) || x.length > 7 ? x : x + k); };
  const val = parseFloat(a);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <h4>{title}</h4>{hint && <p className="hint">{hint}</p>}
        <div className="amt">${a || "0"}</div>
        {cats && <div className="cats">{cats.map(c => <button key={c} className={"cat" + (c === cat ? " on" : "")} onClick={() => { Sound.tick(); setCat(c); }}>{c}</button>)}</div>}
        <div className="pad">{["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(k => <button key={k} onClick={() => press(k)}>{k}</button>)}</div>
        <button className="solid" disabled={isNaN(val) || (cats && val <= 0)} onClick={() => onSave(val, cat)}>{typeof cta === "function" ? cta(cat) : cta}</button>
      </div>
    </div>
  );
}

function StudySheet({ onClose, onSave }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Log study">
        <h4>Log a study session</h4><p className="hint">Network+ · watch, then build it in Packet Tracer</p>
        <div className="opts">{[30, 60, 90, 120].map(m => <button key={m} className="cat" onClick={() => onSave(m)}>{m < 60 ? m + " min" : m / 60 + " h"}</button>)}</div>
        <button className="solid" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}


/* ---------------- Claude, the assistant ---------------- */
const CHIPS = ["What should I do next?", "How am I doing?", "What's due this week?", "Log $5 food", "Weekly review", "I feel like trading"];
function Assistant({ open, onClose, onChanged, seed }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(() => { try { return localStorage.getItem("ascent-speak") === "1"; } catch (e) { return false; } });
  const endRef = useRef(null), recRef = useRef(null), loadedRef = useRef(false), speakRef = useRef(speak), busyRef = useRef(false);
  speakRef.current = speak;
  useEffect(() => { try { localStorage.setItem("ascent-speak", speak ? "1" : "0"); } catch (e) {} }, [speak]);
  useEffect(() => {
    if (!open || loadedRef.current) return; loadedRef.current = true;
    sb.from("ascent_chat").select("role,content,created_at").order("created_at", { ascending: false }).limit(30).then(({ data }) => { if (data) setMsgs(m => [...data.reverse(), ...m]); });
  }, [open]);
  useEffect(() => { if (open && endRef.current) endRef.current.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "end" }); }, [msgs, busy, open]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  const say = t => {
    if (!speakRef.current || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/[*_#`>]/g, "")); u.lang = "en-GB"; u.rate = 1.03; speechSynthesis.speak(u); } catch (e) {}
  };
  const send = async t => {
    const text = (t ?? input).trim(); if (!text || busyRef.current) return;
    busyRef.current = true; setBusy(true); setInput(""); setMsgs(m => [...m, { role: "user", content: text }]);
    let reply = "";
    try {
      const { data, error } = await sb.functions.invoke("claude", { body: { message: text } });
      if (error) {
        let detail = ""; try { detail = (await error.context.json()).error || ""; } catch (e) {}
        const raw = (error.message || "") + " " + detail;
        reply = /not found|404|Failed to send|FunctionsFetchError|relay/i.test(raw) && !detail ? "I'm not switched on yet. Follow ASSISTANT-SETUP.md to deploy me, then try again." : "I couldn't answer that: " + (detail || error.message);
      } else if (data && data.error) reply = "I couldn't answer that: " + data.error;
      else { reply = data.reply; if (data.actions && data.actions.length) onChanged(); }
    } catch (e) { reply = "I couldn't reach the server. Check your connection and try again."; }
    setMsgs(m => [...m, { role: "assistant", content: reply }]); say(reply); Sound.check();
    busyRef.current = false; setBusy(false);
  };
  useEffect(() => { if (open && seed && seed.text) send(seed.text); }, [seed]);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const toggleMic = () => {
    if (!SR) { setMsgs(m => [...m, { role: "assistant", content: "Voice input doesn't work in this browser. Try Chrome or Safari, or type instead." }]); return; }
    if (listening) { recRef.current && recRef.current.stop(); return; }
    const r = new SR(); r.lang = "en-SG"; r.interimResults = true; r.continuous = false; let final = "";
    r.onresult = e => { let txt = ""; for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) final = txt; } setInput(txt); };
    r.onend = () => { setListening(false); if (final.trim()) send(final); };
    r.onerror = () => setListening(false);
    recRef.current = r; setListening(true); buzz(10); try { speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    try { r.start(); } catch (e) { setListening(false); }
  };
  if (!open) return null;
  return (
    <div className="ai" role="dialog" aria-label="Talk to Claude">
      <div className="ai-head">
        <div className={"ai-orb" + (busy || listening ? " live" : "")} aria-hidden="true" />
        <div className="ai-title"><b>Claude</b><span>{listening ? "Listening…" : busy ? "Thinking…" : "Knows your plan and your numbers"}</span></div>
        <button className="icon-btn" aria-label={speak ? "Stop reading replies aloud" : "Read replies aloud"} aria-pressed={speak} onClick={() => { setSpeak(!speak); try { speechSynthesis.cancel(); } catch (e) {} }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" />{speak ? <path d="M16 9a4 4 0 010 6" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>
        </button>
        <button className="icon-btn" aria-label="Close" onClick={() => { try { speechSynthesis.cancel(); } catch (e) {} onClose(); }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>
      <div className="ai-body">
        {msgs.length === 0 && !busy && <div className="ai-empty">{ME.ar && <div className="ar" dir="rtl">{ME.ar}</div>}<p>Ask me anything about your plan, or tell me what you did. "Spent $4.50 on lunch." "Mark Singtel paid." "How much is left on Grab?"</p></div>}
        {msgs.map((m, i) => <div key={i} className={"bub " + m.role}>{m.content}</div>)}
        {busy && <div className="bub assistant typing" aria-label="Claude is thinking"><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      <div className="ai-chips">{CHIPS.map(c => <button key={c} onClick={() => send(c)} disabled={busy}>{c}</button>)}</div>
      <form className="ai-input" onSubmit={e => { e.preventDefault(); send(); }}>
        <button type="button" className={"mic" + (listening ? " on" : "")} aria-label={listening ? "Stop listening" : "Speak"} onClick={toggleMic}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
        </button>
        <input className="field" id="ai-text" placeholder={listening ? "Listening…" : "Message Claude"} value={input} onChange={e => setInput(e.target.value)} autoComplete="off" />
        <button className="send" aria-label="Send" disabled={!input.trim() || busy}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </form>
    </div>
  );
}

/* ---------------- urge: ride it out ---------------- */
function Urge({ left, streak, beaten, onClose, onBeaten, onTalk }) {
  const [secs, setSecs] = useState(600);
  const [phase, setPhase] = useState("in");
  useEffect(() => { const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setPhase(p => p === "in" ? "out" : "in"), 4000); return () => clearInterval(t); }, []);
  useEffect(() => { buzz(20); }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  return (
    <div className="urge" role="dialog" aria-label="Ride out the urge">
      <div className="urge-in">
        <div className="caps mute">Pause</div>
        <div className={"breath-ring " + phase}><span>{phase === "in" ? "Breathe in" : "Breathe out"}</span></div>
        <div className="urge-timer num">{secs > 0 ? `${mm}:${ss}` : "10 minutes done"}</div>
        <p className="mute">{secs > 0 ? "Urges peak and pass. Wait this out before you decide anything." : "You waited it out. Notice it's weaker now."}</p>
        <ul className="urge-list">
          <li><b className="num">{fmt(left, 2)}</b> still to clear. A deposit makes that number bigger.</li>
          <li><b>Day {streak}</b> trading-free{beaten ? `, and ${beaten} urge${beaten === 1 ? "" : "s"} beaten before this one` : ""}.</li>
          {ME.why.length ? ME.why.map((w, i) => <li key={i}>{w}</li>) : <li>Remember why you started. Add your own reasons in Settings.</li>}
        </ul>
        <div className="urge-actions">
          <button className="solid" onClick={onTalk}>Talk to Claude</button>
          <button className="cta" onClick={onBeaten}>I rode it out</button>
        </div>
        <p className="urge-help">Text your friend. Or call NAMS on <b className="num">6389 2200</b> (walk-ins welcome).</p>
        <button className="signout" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}


/* pinned sideways stages */
function Stages({ currentIdx }) {
  const sec = useRef(null), track = useRef(null), bar = useRef(null);
  useEffect(() => {
    const on = () => {
      const s = sec.current, t = track.current; if (!s || !t) return;
      const r = s.getBoundingClientRect(), total = s.offsetHeight - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      t.style.transform = `translate3d(${-p * Math.max(0, t.scrollWidth - innerWidth + 36)}px,0,0)`;
      if (bar.current) bar.current.style.width = p * 100 + "%";
    };
    let ticking = false;
    const tick = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; on(); }); } };
    on(); addEventListener("scroll", tick, { passive: true }); addEventListener("resize", tick);
    return () => { removeEventListener("scroll", tick); removeEventListener("resize", tick); };
  }, []);
  return (
    <section className="pin" id="ascent" ref={sec} style={{ height: REDUCE ? "auto" : "300svh" }}>
      <div className="sticky" style={REDUCE ? { position: "static", height: "auto" } : null}>
        <div className="wrap"><div className="sechead"><Scramble text="THE ASCENT" /><span className="idx">5 stages<br />keep scrolling</span></div></div>
        <div className="track" ref={track}>
          {STAGES.map((s, i) => (
            <article key={s.n} className={"stage" + (i === currentIdx ? " now" : "")}>
              {i === currentIdx && <span className="here">YOU</span>}
              <div className={"no" + (i === currentIdx ? "" : " outline")}>{s.n}</div>
              <div><div className="w">{s.w}</div><h3>{s.t}</h3><p>{s.g}</p></div>
            </article>
          ))}
        </div>
        <div className="pbar"><i ref={bar} /></div>
      </div>
    </section>
  );
}


/* ---------------- generic sheet ---------------- */
function Sheet({ title, hint, onClose, children, wide }) {
  useEffect(() => { const k = e => { if (e.key === "Escape") onClose(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  return (
    <div className="scrim" onClick={onClose}>
      <div className={"sheet form-sheet" + (wide ? " wide" : "")} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-top"><h4>{title}</h4><button className="icon-btn" aria-label="Close" onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
        {hint && <p className="hint">{hint}</p>}
        {children}
      </div>
    </div>
  );
}
const Field = ({ id, label, ...p }) => <div className="fld"><label className="caps mute" htmlFor={id}>{label}</label><input id={id} className="field" {...p} /></div>;

/* ---------------- add a debt ---------------- */
const DEBT_TYPES = [["Loan", "Personal Loan", "Debt"], ["BNPL", "Credit Facility", "Debt"], ["Credit card", "Credit Facility", "Debt"], ["Phone contract", "Phone Contract", "Telco"], ["Other", "Other", "Debt"]];
function DebtSheet({ names, onClose, onSave }) {
  const [name, setName] = useState(""); const [type, setType] = useState("BNPL");
  const [monthly, setMonthly] = useState(""); const [count, setCount] = useState(""); const [last, setLast] = useState("");
  const [first, setFirst] = useState(ymd(addDays(new Date(), 7))); const [kind, setKind] = useState("existing");
  const [busy, setBusy] = useState(false);
  const m = num(monthly), n = parseInt(count, 10), l = last === "" ? m : num(last);
  const dup = names.some(x => x.toLowerCase() === name.trim().toLowerCase());
  const ok = name.trim() && !dup && m > 0 && n > 0 && n <= 240 && l > 0 && /^\d{4}-\d{2}-\d{2}$/.test(first);
  const total = ok ? r2(m * (n - 1) + l) : 0;
  const lastLabel = ok ? (() => { const f = parseDate(first); return monthLabel(ym(new Date(f.getFullYear(), f.getMonth() + n - 1, 1))); })() : "";
  return (
    <Sheet title="Add a debt" hint="Put in the monthly payment and how many are left. The app schedules each one." onClose={onClose}>
      <form className="grid-form" onSubmit={async e => { e.preventDefault(); if (!ok || busy) return; setBusy(true); await onSave({ name: name.trim(), type, m, n, l, first, kind }); setBusy(false); }}>
        <Field id="dn" label="Name" placeholder="e.g. Atome, Singtel (9123 4567)" value={name} onChange={e => setName(e.target.value)} />
        {dup && <p className="note-new">You already have a debt called that. Use a different name, e.g. add the last 4 digits.</p>}
        <div className="caps mute">Type</div>
        <div className="typechips">{DEBT_TYPES.map(([t]) => <button type="button" key={t} className={"cat" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t}</button>)}</div>
        <div className="two">
          <Field id="dm" label="Monthly payment ($)" inputMode="decimal" placeholder="50" value={monthly} onChange={e => setMonthly(e.target.value)} />
          <Field id="dc" label="Payments left" inputMode="numeric" placeholder="12" value={count} onChange={e => setCount(e.target.value.replace(/[^0-9]/g, ""))} />
        </div>
        <div className="two">
          <Field id="df" label="Next payment date" type="date" value={first} onChange={e => setFirst(e.target.value)} />
          <Field id="dl" label="Last payment (if different)" inputMode="decimal" placeholder="optional" value={last} onChange={e => setLast(e.target.value)} />
        </div>
        <div className="caps mute">This debt is</div>
        <div className="typechips">
          <button type="button" className={"cat" + (kind === "existing" ? " on" : "")} onClick={() => setKind("existing")}>One I already had</button>
          <button type="button" className={"cat" + (kind === "new" ? " on" : "")} onClick={() => setKind("new")}>New borrowing</button>
        </div>
        {kind === "new" && <p className="note-new">That breaks rule 1: no new credit. Log it honestly anyway, because hiding it makes it worse. Then talk to Claude or your friend about how it happened.</p>}
        <div className="preview">{ok ? <>{n} payment{n > 1 ? "s" : ""}{l !== m && n > 1 ? <> ({n - 1} × {fmt(m, 2)} + last {fmt(l, 2)})</> : <> of {fmt(m, 2)}</>} = <b className="num">{fmt(total, 2)}</b> · last one {lastLabel}</> : "Fill in the name, monthly payment and number of payments."}</div>
        <button className="solid" disabled={!ok || busy}>{busy ? "Saving…" : "Add debt"}</button>
      </form>
    </Sheet>
  );
}

/* ---------------- one debt: every payment, pay extra, pay off, rename, remove ---------------- */
function DebtDetail({ entity, rows, today, onClose, act }) {
  const [mode, setMode] = useState(""); const [extra, setExtra] = useState(""); const [rename, setRename] = useState(entity);
  const [edit, setEdit] = useState(null);
  const left = rows.filter(r => !r.is_cleared).reduce((s, r) => s + Number(r.amount_due), 0);
  const paid = rows.filter(r => r.is_cleared).reduce((s, r) => s + Number(r.amount_due), 0);
  const x = num(extra);
  return (
    <Sheet title={entity} hint={`${fmt(left, 2)} left · ${fmt(paid, 2)} paid · ${rows.filter(r => !r.is_cleared).length} payments to go`} onClose={onClose} wide>
      <div className="meter"><i style={{ width: Math.min(100, paid / Math.max(1, paid + left) * 100) + "%" }} /></div>
      {left > 0 && <div className="minis">
        <button className={"chip-btn" + (mode === "extra" ? " solid2" : "")} onClick={() => setMode(mode === "extra" ? "" : "extra")}>Pay extra</button>
        <button className={"chip-btn" + (mode === "off" ? " solid2" : "")} onClick={() => setMode(mode === "off" ? "" : "off")}>Pay off now</button>
        <button className={"chip-btn" + (mode === "dates" ? " solid2" : "")} onClick={() => setMode(mode === "dates" ? "" : "dates")}>Change dates</button>
        <button className={"chip-btn" + (mode === "rename" ? " solid2" : "")} onClick={() => setMode(mode === "rename" ? "" : "rename")}>Rename</button>
        <button className={"chip-btn" + (mode === "remove" ? " solid2" : "")} onClick={() => setMode(mode === "remove" ? "" : "remove")}>Remove</button>
      </div>}
      {mode === "extra" && <div className="box">
        <p className="mute small">You pay more than the normal amount now. The app takes it off the <b>last</b> payments, so this debt finishes sooner.</p>
        <div className="two"><Field id="xa" label="Extra amount ($)" inputMode="decimal" value={extra} onChange={e => setExtra(e.target.value)} placeholder="100" /><div className="fld"><span className="caps mute">&nbsp;</span><button className="solid" disabled={!(x > 0 && x <= left + .001)} onClick={() => { act.payExtra(entity, r2(x)); setMode(""); setExtra(""); }}>Record {x > 0 ? fmt(x, 2) : ""}</button></div></div>
        {x > left + .001 && <p className="note-new">That's more than the {fmt(left, 2)} left. Use "Pay off now" instead.</p>}
      </div>}
      {mode === "off" && <div className="confirm"><span>Mark all {fmt(left, 2)} as paid today?</span><button className="danger" onClick={() => { act.payOff(entity); onClose(); }}>Yes, paid off</button><button className="chip-btn" onClick={() => setMode("")}>Cancel</button></div>}
      {mode === "dates" && <BulkDates rows={rows} act={act} onDone={() => setMode("")} />}
      {mode === "rename" && <div className="box"><div className="two"><Field id="rn" label="New name" value={rename} onChange={e => setRename(e.target.value)} /><div className="fld"><span className="caps mute">&nbsp;</span><button className="solid" disabled={!rename.trim() || rename.trim() === entity} onClick={() => { act.renameDebt(entity, rename.trim()); onClose(); }}>Save name</button></div></div></div>}
      {mode === "remove" && <div className="confirm"><span>Remove the {rows.filter(r => !r.is_cleared).length} unpaid payments? Paid ones stay in your history.</span><button className="danger" onClick={() => { act.removeDebt(entity); onClose(); }}>Remove</button><button className="chip-btn" onClick={() => setMode("")}>Cancel</button></div>}
      <div className="caps mute" style={{ marginTop: 14 }}>Payments · tap the circle to mark paid, tap the amount to edit</div>
      <div className="pay-list">
        {rows.map(r => {
          const dt = rowDate(r);
          return (
            <div key={r.id} className={"pay" + (r.is_cleared ? " done" : "") + (!r.is_cleared && dt < today ? " late" : "")}>
              <button className="ck2" aria-label={r.is_cleared ? "Mark unpaid" : "Mark paid"} onClick={() => act.toggleRow(r)}>{r.is_cleared ? <Tick /> : null}</button>
              <span className="pd">{dayLabel(dt)}{r.note ? <em> · {r.note}</em> : null}{r.is_cleared && r.paid_on ? <em> · paid {dayLabel(parseDate(r.paid_on))}</em> : null}</span>
              {edit && edit.id === r.id
                ? <span className="pe"><input className="field mini" inputMode="decimal" value={edit.amt} onChange={e => setEdit({ ...edit, amt: e.target.value })} aria-label="Amount" /><input className="field mini" type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} aria-label="Due date" /><button className="chip-btn solid2" onClick={() => { const a = num(edit.amt); if (a > 0 && edit.date) { act.editRow(r, a, edit.date); setEdit(null); } }}>Save</button></span>
                : <button className="pa num" onClick={() => setEdit({ id: r.id, amt: String(r.amount_due), date: ymd(dt) })}>{fmt(r.amount_due, 2)}</button>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------------- income ---------------- */
function IncomeSheet({ rows, settings, today, onClose, act }) {
  const upcoming = rows.filter(r => !r.is_cleared).sort((a, b) => rowDate(a) - rowDate(b));
  const cur = settings.income || (upcoming[0] ? { amount: Number(upcoming[0].amount_due), day: upcoming[0].due_day || 10 } : { amount: 790, day: 10 });
  const [amt, setAmt] = useState(String(cur.amount)); const [day, setDay] = useState(String(cur.day)); const [from, setFrom] = useState(ym(today));
  const [oName, setOName] = useState(""); const [oAmt, setOAmt] = useState("");
  const a = num(amt), dd = parseInt(day, 10), oa = num(oAmt);
  return (
    <Sheet title="Income" hint="Your allowance repeats every month automatically, for as long as you use the app." onClose={onClose} wide>
      <div className="box">
        <div className="caps mute">Monthly allowance / salary</div>
        <div className="three">
          <Field id="ia" label="Amount ($)" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} />
          <Field id="id" label="Pay day (1–31)" inputMode="numeric" value={day} onChange={e => setDay(e.target.value.replace(/[^0-9]/g, ""))} />
          <Field id="if" label="Starting from" type="month" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <button className="solid" disabled={!(a > 0 && dd >= 1 && dd <= 31 && /^\d{4}-\d{2}$/.test(from))} onClick={() => { act.setIncome(a, dd, from); onClose(); }}>Save allowance</button>
        <p className="mute small">Changes every unpaid month from {monthLong(from || ym(today))} onward. Months already received stay as they were.</p>
      </div>
      <div className="box">
        <div className="caps mute">One-off money in (ang bao, part-time, refund)</div>
        <div className="two"><Field id="on" label="From" value={oName} onChange={e => setOName(e.target.value)} placeholder="e.g. Ang bao" /><Field id="oa" label="Amount ($)" inputMode="decimal" value={oAmt} onChange={e => setOAmt(e.target.value)} /></div>
        <button className="solid" disabled={!(oName.trim() && oa > 0)} onClick={() => { act.addIncome(oName.trim(), oa); onClose(); }}>Add {oa > 0 ? fmt(oa, 2) : ""} to cash</button>
      </div>
      <div className="caps mute">Next paydays</div>
      <div className="recent">{upcoming.slice(0, 6).map(r => <div key={r.id}><span>{dayLabel(rowDate(r))} · {r.entity_name === "Inflow" ? "Allowance" : r.entity_name}</span><span><span className="num">+{fmt(r.amount_due, 2)}</span><button className="linkbtn" onClick={() => act.removeIncome(r)} aria-label="Remove this income">Remove</button></span></div>)}</div>
    </Sheet>
  );
}

/* ---------------- cash in bank ---------------- */
function CashSheet({ cash, onClose, onSave }) {
  const [v, setV] = useState(cash == null ? "" : String(cash));
  const x = num(v);
  return (
    <Sheet title="Cash in your bank" hint="Open your bank app and type what's there now, not counting money you've put in savings pots. After this, paying bills, logging spending and payday update it for you." onClose={onClose}>
      <Field id="cb" label="Balance ($)" inputMode="decimal" autoFocus value={v} onChange={e => setV(e.target.value)} placeholder="172" />
      <button className="solid" disabled={isNaN(x)} onClick={() => onSave(r2(x))}>Save balance</button>
    </Sheet>
  );
}

/* ---------------- savings pot ---------------- */
function PotSheet({ pot, moves, onClose, act }) {
  const [mode, setMode] = useState("add"); const [amt, setAmt] = useState(""); const [reason, setReason] = useState("");
  const [goal, setGoal] = useState(pot.goal == null ? "" : String(pot.goal)); const [note, setNote] = useState(pot.note || ""); const [nm, setNm] = useState(pot.name);
  const a = num(amt), bal = Number(pot.balance) || 0;
  const hist = moves.filter(m => m.pot_id === pot.id).sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  return (
    <Sheet title={potName(pot)} hint={`${fmt(bal, 2)}${pot.goal ? " of " + fmt(pot.goal) : ""}${pot.note ? " · " + pot.note : ""}`} onClose={onClose} wide>
      <div className="typechips">
        <button className={"cat" + (mode === "add" ? " on" : "")} onClick={() => setMode("add")}>Add money</button>
        <button className={"cat" + (mode === "take" ? " on" : "")} onClick={() => setMode("take")}>Take out</button>
        <button className={"cat" + (mode === "edit" ? " on" : "")} onClick={() => setMode("edit")}>Edit pot</button>
      </div>
      {mode !== "edit" ? <div className="box">
        <div className="two"><Field id="pa" label="Amount ($)" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} /><Field id="pr" label={mode === "take" ? "Reason (required)" : "Note (optional)"} value={reason} onChange={e => setReason(e.target.value)} placeholder={mode === "take" ? "e.g. Doctor visit" : "e.g. Payday"} /></div>
        {mode === "take" && a > bal && <p className="note-new">Only {fmt(bal, 2)} is in this pot.</p>}
        <button className="solid" disabled={!(a > 0) || (mode === "take" && (!reason.trim() || a > bal + .001))} onClick={() => { act.potMove(pot, mode === "add" ? r2(a) : -r2(a), reason.trim() || (mode === "add" ? "Added" : "")); onClose(); }}>{mode === "add" ? "Move into pot" : "Take out to cash"}</button>
        <p className="mute small">{mode === "add" ? "Moves money from your cash into this pot." : "Moves it back into your cash, with the reason saved. Refill it when you can."}</p>
      </div> : <div className="box">
        <Field id="pn" label="Name" value={nm} onChange={e => setNm(e.target.value)} />
        <div className="two"><Field id="pg" label="Goal ($)" inputMode="decimal" value={goal} onChange={e => setGoal(e.target.value)} placeholder="none" /><Field id="po" label="Note" value={note} onChange={e => setNote(e.target.value)} /></div>
        <button className="solid" disabled={!nm.trim()} onClick={() => { act.editPot(pot, { name: nm.trim(), goal: goal === "" ? null : num(goal), note: note || null }); onClose(); }}>Save pot</button>
      </div>}
      <div className="caps mute" style={{ marginTop: 12 }}>History</div>
      <div className="recent">{hist.length ? hist.slice(0, 12).map(m => <div key={m.id}><span>{dayLabel(new Date(m.created_at))}{m.reason ? " · " + m.reason : ""}</span><span className="num">{m.amount > 0 ? "+" : ""}{fmt(m.amount, 2)}</span></div>) : <div><span>No moves yet.</span><span /></div>}</div>
    </Sheet>
  );
}
function NewPotSheet({ onClose, onSave }) {
  const [nm, setNm] = useState(""); const [goal, setGoal] = useState(""); const [note, setNote] = useState("");
  return (
    <Sheet title="New savings pot" onClose={onClose}>
      <Field id="nn" label="Name" value={nm} onChange={e => setNm(e.target.value)} placeholder="e.g. Parents' Hajj" />
      <div className="two"><Field id="ng" label="Goal ($)" inputMode="decimal" value={goal} onChange={e => setGoal(e.target.value)} /><Field id="nt" label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. By 2034" /></div>
      <button className="solid" disabled={!nm.trim()} onClick={() => onSave({ name: nm.trim(), goal: goal === "" ? null : num(goal), note: note || null })}>Create pot</button>
    </Sheet>
  );
}

/* ---------------- task edit ---------------- */
function TaskSheet({ task, onClose, act }) {
  const [t, setT] = useState(task.title); const [due, setDue] = useState(task.due_date || ""); const [del, setDel] = useState(false);
  return (
    <Sheet title="Edit task" onClose={onClose}>
      <Field id="tt" label="Task" value={t} onChange={e => setT(e.target.value)} />
      <Field id="td" label="Due date (optional)" type="date" value={due} onChange={e => setDue(e.target.value)} />
      <button className="solid" disabled={!t.trim()} onClick={() => { act.editTask(task, { title: t.trim(), due_date: due || null }); onClose(); }}>Save</button>
      {!del ? <button className="linkbtn" onClick={() => setDel(true)}>Delete task</button>
        : <div className="confirm"><span>Delete this task?</span><button className="danger" onClick={() => { act.deleteTask(task); onClose(); }}>Delete</button><button className="chip-btn" onClick={() => setDel(false)}>Cancel</button></div>}
    </Sheet>
  );
}

/* ---------------- spend entry edit ---------------- */
function SpendEditSheet({ entry, cats, onClose, act }) {
  const [a, setA] = useState(String(entry.amount)); const [c, setC] = useState(entry.category); const [dt, setDt] = useState(entry.spent_on);
  const x = num(a);
  return (
    <Sheet title="Edit spending" onClose={onClose}>
      <div className="two"><Field id="sa" label="Amount ($)" inputMode="decimal" value={a} onChange={e => setA(e.target.value)} /><Field id="sd" label="Date" type="date" value={dt} onChange={e => setDt(e.target.value)} /></div>
      <div className="typechips">{[...new Set([...cats, entry.category])].map(k => <button key={k} className={"cat" + (c === k ? " on" : "")} onClick={() => setC(k)}>{k}</button>)}</div>
      <button className="solid" disabled={!(x > 0) || !dt} onClick={() => { act.editSpend(entry, { amount: r2(x), category: c, spent_on: dt }); onClose(); }}>Save</button>
      <button className="linkbtn" onClick={() => { act.deleteSpend(entry); onClose(); }}>Delete this entry</button>
    </Sheet>
  );
}

/* ---------------- payday split ---------------- */
function PaydaySheet({ amount, bills, nextDate, settings, pots, onClose, onConfirm }) {
  const firstOpen = pots.find(p => p.goal && Number(p.balance) < Number(p.goal)) || pots[0];
  const [living, setLiving] = useState(String(settings.budget)); const [fun, setFun] = useState(String(settings.guiltFree));
  const leftover = r2(amount - bills - (num(living) || 0) - (num(fun) || 0));
  const [save, setSave] = useState(String(Math.max(0, leftover))); const [potId, setPotId] = useState(firstOpen ? firstOpen.id : "");
  useEffect(() => { setSave(String(Math.max(0, leftover))); }, [living, fun]);
  const s = num(save) || 0, rest = r2(leftover - s);
  return (
    <Sheet title={`Payday · +${fmt(amount, 2)}`} hint="Give every dollar a job before it disappears." onClose={onClose} wide>
      <div className="split">
        <div className="srow"><span>Bills until {nextDate ? dayLabel(nextDate) : "next payday"}</span><b className="num">{fmt(bills, 2)}</b></div>
        <div className="srow"><span>Living money (food, transport, smokes)</span><input className="field mini" inputMode="decimal" value={living} onChange={e => setLiving(e.target.value)} aria-label="Living money" /></div>
        <div className="srow"><span>Guilt-free money</span><input className="field mini" inputMode="decimal" value={fun} onChange={e => setFun(e.target.value)} aria-label="Guilt-free money" /></div>
        <div className="srow"><span>Save into <select className="field mini" value={potId} onChange={e => setPotId(e.target.value)} aria-label="Savings pot">{pots.map(p => <option key={p.id} value={p.id}>{potName(p)}</option>)}</select></span><input className="field mini" inputMode="decimal" value={save} onChange={e => setSave(e.target.value)} aria-label="Amount to save" /></div>
        <div className="srow total"><span>Left unassigned</span><b className={"num" + (rest < 0 ? " neg" : "")}>{fmt(rest, 2)}</b></div>
      </div>
      {leftover < 0 && <p className="note-new">This pay doesn't cover bills plus living money. You're short {fmt(-leftover, 2)}. Cut living money or talk it through with Claude.</p>}
      <button className="solid" disabled={rest < -0.005} onClick={() => onConfirm({ potId, save: r2(s) })}>{s > 0 ? `Confirm · move ${fmt(s, 2)} to savings` : "Confirm"}</button>
      <p className="mute small">Bills and living money stay in your cash. Only the savings amount moves to the pot.</p>
    </Sheet>
  );
}

/* ---------------- milestone add ---------------- */
function MilestoneSheet({ onClose, onSave }) {
  const [t, setT] = useState(""); const [when, setWhen] = useState("");
  return (
    <Sheet title="Add a milestone" hint="Anything worth celebrating: a cert, a job, your parents' Hajj, a number saved." onClose={onClose}>
      <Field id="mt" label="Milestone" value={t} onChange={e => setT(e.target.value)} placeholder="e.g. Security+ passed" />
      <Field id="mw" label="Target month" type="month" value={when} onChange={e => setWhen(e.target.value)} />
      <button className="solid" disabled={!t.trim()} onClick={() => onSave({ title: t.trim(), target_label: when ? monthLong(when) : null, target_date: when ? when + "-28" : null })}>Add milestone</button>
    </Sheet>
  );
}

/* ---------------- settings ---------------- */
function SettingsSheet({ settings, state, onClose, act, onExport, telegramTest }) {
  const [budget, setBudget] = useState(String(settings.budget)); const [cats, setCats] = useState(settings.categories.join(", "));
  const [ord, setOrd] = useState(settings.ord); const [since, setSince] = useState(state.trading_free_since || ymd(new Date()));
  const [study, setStudy] = useState(settings.studyStart); const [target, setTarget] = useState(String(settings.studyTarget / 60));
  const [fun, setFun] = useState(String(settings.guiltFree)); const [motion, setMotion] = useState(MOTION);
  const [tg, setTg] = useState("");
  const me0 = settings.me || {};
  const [nEn, setNEn] = useState(me0.nameEn || ""); const [nAr, setNAr] = useState(me0.nameAr || "");
  const [why, setWhy] = useState((me0.why || []).join("\n"));
  return (
    <Sheet title="Settings" onClose={onClose} wide>
      <div className="box">
        <div className="caps mute">Money</div>
        <div className="two"><Field id="sb" label="Monthly living budget ($)" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} /><Field id="sg" label="Guilt-free per month ($)" inputMode="decimal" value={fun} onChange={e => setFun(e.target.value)} /></div>
        <Field id="sc" label="Spending categories (comma separated)" value={cats} onChange={e => setCats(e.target.value)} />
      </div>
      <div className="box">
        <div className="caps mute">Dates</div>
        <div className="two"><Field id="so" label="ORD date" type="date" value={ord} onChange={e => setOrd(e.target.value)} /><Field id="ss" label="Trading-free since" type="date" value={since} onChange={e => setSince(e.target.value)} /></div>
        <div className="two"><Field id="st" label="Study starts" type="date" value={study} onChange={e => setStudy(e.target.value)} /><Field id="sh" label="Study hours per week" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} /></div>
      </div>
      <div className="box">
        <div className="caps mute">About you (private)</div>
        <p className="mute small">Saved only in your locked database, never in the app's public code. The sign-in page just says Ascent.</p>
        <div className="two"><Field id="sne" label="Name on the app" value={nEn} onChange={e => setNEn(e.target.value)} /><Field id="sna" label="Name in Arabic" dir="rtl" lang="ar" value={nAr} onChange={e => setNAr(e.target.value)} /></div>
        <div className="fld"><label className="caps mute" htmlFor="swy">Your reasons, one per line (shown when you feel like trading)</label>
          <textarea id="swy" className="field" rows={4} value={why} onChange={e => setWhy(e.target.value)} /></div>
      </div>
      <button className="solid" onClick={() => {
        const c = cats.split(",").map(x => x.trim()).filter(Boolean);
        act.saveSettings({ me: { nameEn: nEn.trim(), nameAr: nAr.trim(), why: why.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8) }, budget: num(budget) || 200, guiltFree: num(fun) || 0, categories: c.length ? c.slice(0, 8) : DEFAULT_SETTINGS.categories, ord: ord || DEFAULT_SETTINGS.ord, studyStart: study || DEFAULT_SETTINGS.studyStart, studyTarget: Math.round((num(target) || 4) * 60) }, since);
        onClose();
      }}>Save settings</button>
      <div className="box">
        <div className="caps mute">Animations (reloads the app)</div>
        <div className="typechips">{[["on", "Full"], ["calm", "Calm"], ["off", "Off"]].map(([k, l]) => <button key={k} className={"cat" + (motion === k ? " on" : "")} onClick={() => { setMotion(k); lsSet("ascent-motion", k); setTimeout(() => location.reload(), 200); }}>{l}</button>)}</div>
        <p className="mute small">Calm keeps the look but stops the moving text, rotating mountain and leaves. Off removes all motion.</p>
      </div>
      <div className="box">
        <div className="caps mute">Telegram reminders</div>
        <p className="mute small">One message at 8pm when something is coming up: bills, payday, dated to-dos and milestones. Set up with TELEGRAM-GUIDE.md.</p>
        <button className="chip-btn" onClick={async () => { setTg("Sending…"); setTg(await telegramTest()); }}>Send a test message</button> <span className="mute small">{tg}</span>
      </div>
      <LockSettings />
      <div className="box">
        <div className="caps mute">Backup</div>
        <p className="mute small">Download everything once a month and keep it in Google Drive. Supabase's free plan doesn't back up for you.</p>
        <div className="minis"><button className="chip-btn solid2" onClick={() => onExport("json")}>Download full backup</button><button className="chip-btn" onClick={() => onExport("csv")}>Spending as CSV</button></div>
      </div>
    </Sheet>
  );
}

/* ---------------- login, reset password ---------------- */
function NewPassword({ onDone }) {
  const [pw, setPw] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <div className="gate">
      <form className="gate-card" onSubmit={async e => { e.preventDefault(); setBusy(true); const { error } = await sb.auth.updateUser({ password: pw }); setBusy(false); if (error) setMsg(error.message); else { history.replaceState(null, "", location.pathname); onDone(); } }}>
        <div className="mono" aria-hidden="true">W</div>
        <h1>New password.</h1>
        <label className="caps mute" htmlFor="np">New password (8+ characters)</label>
        <input id="np" className="field" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={e => setPw(e.target.value)} />
        <div className="err" role="alert">{msg}</div>
        <button className="solid" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </div>
  );
}

/* ---------------- move many payment dates at once ---------------- */
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const onDay = (dt, day) => new Date(dt.getFullYear(), dt.getMonth(), Math.min(day, dim(dt.getFullYear(), dt.getMonth())));
function BulkDates({ rows, act, onDone }) {
  const unpaid = rows.filter(r => !r.is_cleared).sort((a, b) => rowDate(a) - rowDate(b));
  const [sel, setSel] = useState(() => new Set(unpaid.map(r => r.id)));
  const [how, setHow] = useState("day"); const [day, setDay] = useState(String(unpaid[0] ? rowDate(unpaid[0]).getDate() : 1));
  const [first, setFirst] = useState(unpaid[0] ? ymd(rowDate(unpaid[0])) : "");
  const picked = unpaid.filter(r => sel.has(r.id));
  const dn = Math.round(num(day));
  const plan = picked.map((r, i) => {
    if (how === "day") return dn >= 1 && dn <= 31 ? [r, onDay(rowDate(r), dn)] : null;
    if (!first) return null; const f = parseDate(first); return [r, onDay(new Date(f.getFullYear(), f.getMonth() + i, 1), f.getDate())];
  }).filter(Boolean);
  const changed = plan.filter(([r, dt]) => ymd(dt) !== ymd(rowDate(r)));
  const tog = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="box">
      <p className="mute small">Tick the payments to move, then pick how. Paid ones never change.</p>
      <div className="minis"><button className="chip-btn" onClick={() => setSel(new Set(unpaid.map(r => r.id)))}>All unpaid ({unpaid.length})</button><button className="chip-btn" onClick={() => setSel(new Set())}>None</button></div>
      <div className="bulk-list">{unpaid.map(r => <label key={r.id} className={"bulk-row" + (sel.has(r.id) ? " on" : "")}><input type="checkbox" checked={sel.has(r.id)} onChange={() => tog(r.id)} /><span>{dayLabel(rowDate(r))} {rowDate(r).getFullYear()}</span><b className="num">{fmt(r.amount_due, 2)}</b></label>)}</div>
      <div className="cats" style={{ gridTemplateColumns: "1fr 1fr", margin: "12px 0" }}>
        <button className={"cat" + (how === "day" ? " on" : "")} onClick={() => setHow("day")}>Same day each month</button>
        <button className={"cat" + (how === "start" ? " on" : "")} onClick={() => setHow("start")}>Start date, then monthly</button>
      </div>
      {how === "day" ? <Field id="bd" label="Due on day (1–31)" inputMode="numeric" value={day} onChange={e => setDay(e.target.value)} />
        : <Field id="bf" label="First payment date" type="date" value={first} onChange={e => setFirst(e.target.value)} />}
      <p className="mute small" style={{ margin: "8px 0" }}>{changed.length ? `${changed.length} payment${changed.length > 1 ? "s" : ""} will move · first ${dayLabel(changed[0][1])} ${changed[0][1].getFullYear()}${changed.length > 1 ? ` · last ${dayLabel(changed[changed.length - 1][1])} ${changed[changed.length - 1][1].getFullYear()}` : ""}` : "Nothing to change yet."}</p>
      <button className="solid" disabled={!changed.length} onClick={() => { act.bulkDates(changed.map(([r, dt]) => [r, ymd(dt)])); onDone(); }}>Move {changed.length || ""} payment{changed.length === 1 ? "" : "s"}</button>
    </div>
  );
}
/* every debt + phone line on one screen: set a monthly day, or open one to change single payments — one save */
function DueDaysSheet({ ents, onClose, act }) {
  const list = Object.values(ents).map(e => { const up = e.rows.filter(r => !r.is_cleared).sort((a, b) => rowDate(a) - rowDate(b)); return up.length ? { name: e.name, telco: e.cat === "Telco", up, day: rowDate(up[0]).getDate(), mixed: new Set(up.map(r => rowDate(r).getDate())).size > 1 } : null; }).filter(Boolean)
    .sort((a, b) => (a.telco - b.telco) || a.name.localeCompare(b.name));
  const [v, setV] = useState(() => Object.fromEntries(list.map(e => [e.name, String(e.day)])));
  const [ov, setOv] = useState({}); // single-payment overrides: id -> "YYYY-MM-DD"
  const [open, setOpen] = useState(null); const [touched, setTouched] = useState({});
  const target = (e, r) => { if (ov[r.id]) return parseDate(ov[r.id]); const dd = Math.round(num(v[e.name])); return touched[e.name] && dd >= 1 && dd <= 31 ? onDay(rowDate(r), dd) : rowDate(r); };
  const todo = list.flatMap(e => e.up.map(r => [r, target(e, r)]).filter(([r, dt]) => ymd(dt) !== ymd(rowDate(r))));
  const nDebts = new Set(todo.map(([r]) => r.entity_name)).size;
  const moved = e => todo.filter(([r]) => r.entity_name === e.name).length;
  const row = e => (
    <div key={e.name} className={"dd-item" + (open === e.name ? " open" : "")}>
      <div className="dd-row">
        <button className="dd-name" aria-expanded={open === e.name} onClick={() => setOpen(open === e.name ? null : e.name)}>
          <b>{open === e.name ? "▾" : "▸"} {e.name}</b>
          <small className="mute">{e.up.length} unpaid · next {dayLabel(rowDate(e.up[0]))}{e.mixed ? " · days differ" : ""}{moved(e) ? <em className="gr"> · {moved(e)} will move</em> : null}</small>
        </button>
        <input className="field mini" inputMode="numeric" aria-label={`${e.name} due day every month`} value={v[e.name]} onChange={ev => { const val = ev.target.value; setV({ ...v, [e.name]: val }); setTouched({ ...touched, [e.name]: true }); setOv(o => { const n = { ...o }; e.up.forEach(r => delete n[r.id]); return n; }); }} />
      </div>
      {open === e.name && <div className="dd-pays">
        {e.up.map(r => (
          <label key={r.id} className={"dd-pay" + (ymd(target(e, r)) !== ymd(rowDate(r)) ? " ch" : "")}>
            <span className="num">{fmt(r.amount_due, 2)}</span>
            <input className="field mini" type="date" value={ymd(target(e, r))} onChange={ev => ev.target.value && setOv({ ...ov, [r.id]: ev.target.value })} aria-label={`${e.name} payment of ${fmt(r.amount_due, 2)}`} />
          </label>
        ))}
      </div>}
    </div>
  );
  const debts = list.filter(e => !e.telco), phones = list.filter(e => e.telco);
  return (
    <Sheet title="Due dates" hint="Type a day to move all of a debt's unpaid payments, or tap a name to change single payments. Everything saves in one go." onClose={onClose} wide>
      {debts.length > 0 && <><div className="caps mute dd-h">Debts</div><div className="dd-list">{debts.map(row)}</div></>}
      {phones.length > 0 && <><div className="caps mute dd-h">Phone lines</div><div className="dd-list">{phones.map(row)}</div></>}
      <button className="solid" style={{ marginTop: 14 }} disabled={!todo.length} onClick={() => { act.bulkDates(todo.map(([r, dt]) => [r, ymd(dt)])); onClose(); }}>{todo.length ? `Save · move ${todo.length} payment${todo.length > 1 ? "s" : ""} across ${nDebts} ${nDebts > 1 ? "debts & lines" : "debt"}` : "No changes yet"}</button>
    </Sheet>
  );
}

/* ================= Bills · Parents · Habits (v15) ================= */
/* Bills and money-to-parents are monthly rows in cashflow_schedule (category "Bill" / "Parents").
   Templates live in ascent_state.settings; the app keeps 12 months of rows ahead. */
const PARENTS_NAME = "Mum & Dad";
const PARENTS_DEFAULT = { on: true, amount: 30, day: 11, start: "2027-09" };
function recurringRowsNeeded(sched, settings, today) {
  const rows = [], cur = ym(today), horizon = ym(addMonths(today, 12));
  const need = (name, cat, amount, day, from) => {
    const have = new Set(sched.filter(r => r.category === cat && r.entity_name === name && !r.note).map(r => r.month_date.slice(0, 7)));
    let k = from > cur ? from : cur;
    for (let i = 0; i < 40 && k <= horizon; i++) {
      if (!have.has(k)) rows.push({ id: uid(), month_date: k + "-01", entity_name: name, category: cat, amount_due: r2(amount), is_cleared: false, due_day: day });
      k = ym(addMonths(parseDate(k + "-01"), 1));
    }
  };
  (settings.bills || []).forEach(b => { if (b.name && b.amount > 0) need(b.name, "Bill", b.amount, b.day || 1, b.from || cur); });
  const p = { ...PARENTS_DEFAULT, ...(settings.parents || {}) };
  if (p.on && p.amount > 0) need(PARENTS_NAME, "Parents", p.amount, p.day || 11, p.start || PARENTS_DEFAULT.start);
  return rows;
}
const BILL_IDEAS = [["Phone top-up", 15], ["SAFRA", 10], ["Spotify", 11], ["Insurance", 30], ["Gym", 20], ["iCloud", 1.3]];

/* ---------- Money → Bills ---------- */
function BillsSection({ d, settings, today, act, setSheet }) {
  const key = ym(today);
  const bills = settings.bills || [];
  const rowOf = name => d.sched.find(r => r.category === "Bill" && r.entity_name === name && r.month_date.slice(0, 7) === key);
  const thisMonth = bills.map(b => rowOf(b.name)).filter(Boolean);
  const total = thisMonth.reduce((s, r) => s + Number(r.amount_due), 0), paid = thisMonth.filter(r => r.is_cleared).length;
  return (
    <section className="block wrap" id="bills">
      <div className="sechead"><Scramble text="BILLS" /><span className="idx">monthly · not debt<br />{paid}/{thisMonth.length} paid</span></div>
      <div className="stats reveal"><div><div className="v">{fmt(total)}</div><div className="l">This month</div></div><div><div className="v">{bills.length}</div><div className="l">Bills</div></div><div><div className="v">{fmt(total * 12)}</div><div className="l">A year</div></div></div>
      <div className="reveal" style={{ marginTop: 10 }}>
        {bills.length === 0 && <div className="empty">No bills yet. Add your best guess now, fix the amounts after October.</div>}
        {bills.map(b => { const r = rowOf(b.name); return (
          <div className="qwrap" key={b.id}>
            <button className={"quest" + (r && r.is_cleared ? " done" : "")} onClick={e => r && act.toggleRow(r, e)} disabled={!r}>
              <span className="i">{String(b.day).padStart(2, "0")}</span>
              <span><div className="t">{b.name}</div><div className="m">Every month on the {ordinal(b.day)}{r && !r.is_cleared && rowDate(r) < today ? " · overdue" : ""}</div></span>
              <span className="a">{fmt(r ? r.amount_due : b.amount, 2)}</span><span className="ck"><Tick /></span>
            </button>
            <button className="qedit" aria-label={"Edit " + b.name} onClick={() => setSheet({ type: "bill", bill: b })}>⋯</button>
          </div>); })}
        <div className="minis"><button className="chip-btn solid2" onClick={() => setSheet({ type: "bill", bill: null })}>+ Add a bill</button></div>
      </div>
    </section>
  );
}
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
function BillSheet({ bill, bills, today, onClose, act }) {
  const [name, setName] = useState(bill ? bill.name : ""); const [amt, setAmt] = useState(bill ? String(bill.amount) : "");
  const [day, setDay] = useState(String(bill ? bill.day : 1)); const [sure, setSure] = useState(false);
  const a = num(amt), dd = Math.round(num(day)), nm = name.trim();
  const dup = bills.some(b => b.name.toLowerCase() === nm.toLowerCase() && (!bill || b.id !== bill.id));
  const ok = nm && a > 0 && dd >= 1 && dd <= 31 && !dup;
  return (
    <Sheet title={bill ? bill.name : "Add a bill"} hint="Repeats every month. Changes apply from this month on; paid months stay as they were." onClose={onClose}>
      {!bill && <div className="minis">{BILL_IDEAS.filter(([n]) => !bills.some(b => b.name === n)).map(([n, v]) => <button key={n} className="chip-btn" onClick={() => { setName(n); setAmt(String(v)); }}>{n}</button>)}</div>}
      <Field id="bn" label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Phone top-up" />
      <div className="two"><Field id="ba" label="Amount ($, a guess is fine)" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} placeholder="15" /><Field id="bd2" label="Day of month" inputMode="numeric" value={day} onChange={e => setDay(e.target.value)} /></div>
      {dup && <p className="note-new">You already have a bill called {nm}.</p>}
      <button className="solid" disabled={!ok} onClick={() => { act.saveBill({ id: bill ? bill.id : uid(), name: nm, amount: r2(a), day: dd, from: bill ? bill.from : ym(today) }, bill); onClose(); }}>{bill ? "Save changes" : "Add bill"}</button>
      {bill && (sure ? <div className="confirm" style={{ marginTop: 10 }}><span>Stop this bill? Unpaid months are removed; paid ones stay in history.</span><button className="danger" onClick={() => { act.removeBill(bill); onClose(); }}>Stop bill</button><button className="chip-btn" onClick={() => setSure(false)}>Cancel</button></div>
        : <div className="minis" style={{ marginTop: 10 }}><button className="chip-btn" onClick={() => setSure(true)}>Stop this bill</button></div>)}
    </Sheet>
  );
}

/* ---------- Money → Parents ---------- */
function ParentsSection({ d, settings, today, act, setSheet }) {
  const p = { ...PARENTS_DEFAULT, ...(settings.parents || {}) };
  const rows = d.sched.filter(r => r.category === "Parents").sort((a, b) => rowDate(a) - rowDate(b));
  const given = rows.filter(r => r.is_cleared);
  const total = given.reduce((s, r) => s + Number(r.amount_due), 0);
  const cur = rows.find(r => r.month_date.slice(0, 7) === ym(today) && !r.note);
  const started = ym(today) >= p.start;
  const months = new Set(given.map(r => (r.paid_on || r.month_date).slice(0, 7))).size;
  return (
    <section className="block wrap" id="parents">
      <div className="sechead"><Scramble text="MUM & DAD" /><span className="idx">money you give<br />every month</span></div>
      <div className="safe reveal">
        <div className="row"><span className="caps mute">Given so far</span><span className="caps mute">{months} month{months === 1 ? "" : "s"}</span></div>
        <div className="safe-v">{fmt(total)}</div>
        <div className="safe-sub">{!p.on ? "Paused." : started ? <>{fmt(p.amount)} on the {ordinal(p.day)} every month.</> : <>🔒 Starts <b>{monthLong(p.start)}</b> · {fmt(p.amount)} a month (Stage 2 of the plan).</>}</div>
      </div>
      <div className="reveal" style={{ marginTop: 10 }}>
        {cur && <div className="qwrap"><button className={"quest" + (cur.is_cleared ? " done" : "")} onClick={e => act.toggleRow(cur, e)}>
          <span className="i">♥</span><span><div className="t">Give {PARENTS_NAME} · {monthLong(ym(today))}</div><div className="m">Due {dayLabel(rowDate(cur))}</div></span><span className="a">{fmt(cur.amount_due, 2)}</span><span className="ck"><Tick /></span></button><span /></div>}
        <div className="minis">
          <button className="chip-btn solid2" onClick={() => setSheet({ type: "parents-extra" })}>+ Give extra</button>
          <button className="chip-btn" onClick={() => setSheet({ type: "parents-plan" })}>Change plan</button>
        </div>
        {given.length > 0 && <div className="recent" style={{ marginTop: 12 }}>
          {given.slice(-12).reverse().map(r => <div key={r.id}><span>{dayLabel(parseDate(r.paid_on || r.month_date))}{r.note ? " · " + r.note : ""}</span><span className="num">{fmt(r.amount_due, 2)}</span></div>)}
        </div>}
      </div>
    </section>
  );
}
function ParentsPlanSheet({ settings, onClose, act }) {
  const p = { ...PARENTS_DEFAULT, ...(settings.parents || {}) };
  const [amt, setAmt] = useState(String(p.amount)); const [day, setDay] = useState(String(p.day)); const [start, setStart] = useState(p.start + "-01"); const [on, setOn] = useState(p.on);
  const a = num(amt), dd = Math.round(num(day));
  return (
    <Sheet title="Money for Mum & Dad" hint="The plan: $30–50 a month from Sep 2027, once your loans are cleared. It's counted in safe-to-spend like a bill." onClose={onClose}>
      <div className="cats" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 10 }}><button className={"cat" + (on ? " on" : "")} onClick={() => setOn(true)}>On</button><button className={"cat" + (!on ? " on" : "")} onClick={() => setOn(false)}>Paused</button></div>
      <div className="two"><Field id="pa" label="Amount each month ($)" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} /><Field id="pd" label="Day of month" inputMode="numeric" value={day} onChange={e => setDay(e.target.value)} /></div>
      <Field id="ps" label="Start month" type="date" value={start} onChange={e => setStart(e.target.value)} />
      <button className="solid" style={{ marginTop: 10 }} disabled={!(a > 0 && dd >= 1 && dd <= 31 && start)} onClick={() => { act.saveParents({ on, amount: r2(a), day: dd, start: start.slice(0, 7) }); onClose(); }}>Save plan</button>
    </Sheet>
  );
}

/* ---------- Life → Habits ---------- */
const HABIT_IDEAS = ["Solat 5 times", "Exercise 20 min", "No trading apps", "Read Quran", "Study 30 min", "Sleep before 12"];
const habitStreak = (h, log, today) => {
  let n = 0, dt = new Date(today);
  if (!(log[ymd(dt)] || []).includes(h.id)) dt = addDays(dt, -1); // today not ticked yet doesn't break it
  while ((log[ymd(dt)] || []).includes(h.id)) { n++; dt = addDays(dt, -1); }
  return n;
};
function HabitsSection({ settings, today, act }) {
  const habits = settings.habits || [], log = settings.habitLog || {};
  const t = ymd(today), doneToday = log[t] || [];
  const [adding, setAdding] = useState(false); const [nm, setNm] = useState(""); const [edit, setEdit] = useState(false);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const all = habits.length && habits.every(h => doneToday.includes(h.id));
  return (
    <section className="block wrap" id="habits">
      <div className="sechead"><Scramble text="HABITS" /><span className="idx">today<br />{doneToday.filter(id => habits.some(h => h.id === id)).length}/{habits.length} done</span></div>
      <div className="reveal">
        {habits.length === 0 && <div className="empty">Pick 2–4 small things you'll do every day. They count in your monthly report card.</div>}
        {habits.map(h => { const on = doneToday.includes(h.id), st = habitStreak(h, log, today); return (
          <div className="qwrap" key={h.id}>
            <button className={"quest" + (on ? " done" : "")} aria-pressed={on} onClick={() => act.toggleHabit(h.id)}>
              <span className="i">{st > 0 ? "🔥" : "·"}</span>
              <span><div className="t">{h.name}</div><div className="m hb-week">{week.map(dt => <i key={ymd(dt)} className={(log[ymd(dt)] || []).includes(h.id) ? "on" : ""} title={dayLabel(dt)} />)}<em>{st} day{st === 1 ? "" : "s"}</em></div></span>
              <span className="a" /><span className="ck"><Tick /></span>
            </button>
            {edit ? <button className="qedit" aria-label={"Remove " + h.name} onClick={() => act.removeHabit(h.id)}>✕</button> : <span />}
          </div>); })}
        {all ? <div className="ug-hud" style={{ color: "var(--gr)", margin: "8px 0" }}>All done today. Clean lap. ✓</div> : null}
        {adding ? <div className="box" style={{ marginTop: 10 }}>
          <div className="minis">{HABIT_IDEAS.filter(x => !habits.some(h => h.name === x)).map(x => <button key={x} className="chip-btn" onClick={() => setNm(x)}>{x}</button>)}</div>
          <div className="addrow"><input className="field" placeholder="New habit…" value={nm} onChange={e => setNm(e.target.value)} aria-label="New habit" />
            <button className="cta" disabled={!nm.trim()} onClick={() => { act.addHabit(nm.trim()); setNm(""); setAdding(false); }}>Add</button></div>
        </div> : <div className="minis">
          {habits.length < 6 && <button className="chip-btn solid2" onClick={() => setAdding(true)}>+ Add a habit</button>}
          {habits.length > 0 && <button className="chip-btn" onClick={() => setEdit(!edit)}>{edit ? "Done" : "Remove habits"}</button>}
        </div>}
      </div>
    </section>
  );
}
/* habits share of the report card: ticks / possible ticks in that month */
function habitScore(settings, key, today) {
  const habits = settings.habits || [], log = settings.habitLog || {};
  if (!habits.length) return null;
  const [y, m] = key.split("-").map(Number), end = key === ym(today) ? today : new Date(y, m, 0);
  let can = 0, did = 0;
  for (let dt = new Date(y, m - 1, 1); dt <= end; dt = addDays(dt, 1)) {
    const k = ymd(dt), on = log[k] || [];
    habits.forEach(h => { if (!h.since || h.since <= k) { can++; if (on.includes(h.id)) did++; } });
  }
  return can ? { did, can } : null;
}

/* ---------------- Guide: next steps + how-to (works without AI) ---------------- */
const HOWTO = [
  { q: "Add a debt (BNPL, PayLater, loan, phone contract)", k: "add debt new bnpl paylater grab atome loan owe borrow phone", a: ["Money → + Add a debt.", "Name it (must be different from existing debts, e.g. GrabFood), pick the type.", "Monthly payment, how many payments are left, next payment date.", "One-off? Set payments left to 1.", "Pick 'One I already had' or 'New borrowing' honestly, then Add debt."], go: "debt", btn: "Add a debt" },
  { q: "Mark a bill as paid", k: "pay paid tick bill installment done", a: ["In This week, tap the bill. It fills black and your cash goes down.", "Wrong tap? Press Undo within 7 seconds.", "Paying one that isn't due yet? Money → tap the debt → tap the circle next to that payment."], go: "scroll:week", btn: "Go to This week" },
  { q: "Pay extra, or pay a debt off early", k: "extra early pay off lump sum finish sooner izzat", a: ["Money → tap the debt.", "Pay extra: type the amount. It's taken off the last payments, so the debt ends sooner.", "Pay off now: marks everything left as paid today."], go: "scroll:debts", btn: "Go to Money" },
  { q: "Change a payment's amount or date", k: "edit change amount date wrong payment", a: ["Money → tap the debt.", "Tap the amount next to the payment, change amount or date, Save."], go: "scroll:debts", btn: "Go to Money" },
  { q: "Log what I spent", k: "spend spent log food transport smokes cigarette money", a: ["Tap Log (top bar) or Money → Log spend.", "Type the amount, pick a category, Save.", "Made a mistake? Money → tap the entry → edit or delete."], go: "spend", btn: "Log spending" },
  { q: "Update how much cash I have", k: "cash bank balance update safe", a: ["Open your bank app and check the balance.", "This week → Update cash (or Money → Cash in bank). Type it, Save.", "Do this once a week; the app keeps it in sync in between."], go: "cash", btn: "Update cash" },
  { q: "What does 'Safe to spend' mean?", k: "safe to spend meaning per day short", a: ["Your cash minus every bill due before your next payday.", "It's what you can spend without missing a bill. The per-day figure spreads it until payday.", "If it's red, you're short: line up backup cover before the bill date."], go: "scroll:week", btn: "See it" },
  { q: "Payday: what to do when my allowance arrives", k: "payday allowance salary arrive split budget", a: ["Tick 'Allowance arrives' in This week when the money lands.", "The payday screen opens: bills, living money, guilt-free money, savings.", "Confirm, and your savings amount moves into the pot you chose."], go: "scroll:week", btn: "Go to This week" },
  { q: "Change my allowance, or add ang bao / part-time money", k: "income allowance change 1015 rank ang bao part time extra money", a: ["Money → Income.", "Allowance: new amount, pay day, and from which month. Save.", "One-off money: name + amount. It's added to your cash."], go: "income", btn: "Open Income" },
  { q: "Save money into a pot, or take some out", k: "pot savings buffer emergency save take out withdraw", a: ["Money → tap the pot circle.", "Add money moves it from cash into the pot.", "Take out needs a reason (e.g. Doctor). It moves back to cash and is kept in the pot's history."], go: "scroll:debts", btn: "Go to Money" },
  { q: "Create a new savings pot", k: "new pot hajj wedding bto goal create", a: ["Money → New pot (the dashed circle).", "Name, goal, note. Create."], go: "new-pot", btn: "New pot" },
  { q: "Add, edit or delete a task", k: "task todo add edit delete reminder", a: ["This week → type in 'Add a task…', optional date, Add.", "Tap ⋯ on a task to edit or delete it.", "Tick it to mark done. Done tasks are under 'Show done'."], go: "scroll:week", btn: "Go to This week" },
  { q: "Milestones: add one or tick one", k: "milestone goal achievement add tick", a: ["Streaks → Milestones. Tap one, then confirm to mark done.", "Some tick themselves (e.g. 'CIMB cleared').", "+ Add a milestone for anything in the future, even 2040."], go: "ms", btn: "Add a milestone" },
  { q: "I feel like trading", k: "trade trading urge gold xauusd deposit broker", a: ["Tap 'I feel like trading' in Streaks.", "Wait out the 10-minute timer. Breathe with the circle.", "Text your friend. NAMS: 6389 2200 (walk-ins welcome)."], go: "urge", btn: "Open it now" },
  { q: "I slipped and traded", k: "slipped relapse traded lost reset streak", a: ["It happens. It isn't the end.", "Streaks → 'I slipped. Reset my streak.'", "Log any new debt honestly, then tell your friend. Tomorrow is day 1."], go: "scroll:streaks", btn: "Go to Streaks" },
  { q: "Log a study session", k: "study network+ comptia hours learn", a: ["Streaks → Log a session → pick how long.", "Target and start date are in Settings."], go: "study", btn: "Log study" },
  { q: "Change budget, categories, ORD date, animations", k: "settings budget categories ord date animation calm motion eyes", a: ["Menu (☰) → Settings.", "Budget, guilt-free money, categories, ORD, streak start, study.", "Animations: Full, Calm or Off."], go: "settings", btn: "Open Settings" },
  { q: "Back up my data", k: "backup export download csv safe", a: ["Menu → Backup (or Settings → Download full backup).", "Do it once a month and keep the file in Google Drive."], go: "backup", btn: "Download backup" },
  { q: "The four worlds", k: "worlds tabs money invest career life portal dock switch", a: ["The bar at the bottom switches worlds: Money (bills, debts, pots), Invest (the Grove), Career (study, path, to-dos) and Life (streak, family, milestones).", "Invest levels up by months planted in a row, never by prices."], go: "scroll:grove", btn: "Visit the Grove" },
  { q: "Log spending from the home screen", k: "shortcut home screen quick log spend fast pause urge", a: ["Android: press and hold the Ascent icon, then tap Log spend (or Pause). Drag it out to make its own icon.", "iPhone: open the app in Safari with ?do=spend at the end of the address, then Share → Add to Home Screen. That icon opens straight to Log spending."], go: "spend", btn: "Log spend now" },
  { q: "Change the name or reasons shown", k: "name arabic reasons why private settings about you", a: ["Settings → About you.", "These live only in your locked database, not in the public code."], go: "settings", btn: "Open Settings" },
  { q: "Telegram reminders", k: "telegram reminder bot notification 8pm", a: ["Set up once with TELEGRAM-GUIDE.md.", "You get one message at 8pm when something is coming up: bills due tomorrow, payday, to-dos (30 days, 7 days and 1 day before, and when overdue) and milestones (30 and 7 days before).", "Any to-do you give a date is reminded automatically.", "Test: Settings → Send a test message."], go: "settings", btn: "Open Settings" },
  { q: "Undo a mistake", k: "undo mistake wrong tap", a: ["After ticking anything, press Undo on the black bar (7 seconds).", "Later: tap it again to untick, or edit it (Money → tap the debt/entry)."], go: null },
  { q: "No signal in camp", k: "offline signal camp no internet sync", a: ["The app still opens and shows your last data.", "Anything you tick or log is saved on your phone and syncs when you're back online."], go: null },
  { q: "Forgot my password", k: "password forgot reset login sign in", a: ["On the sign-in screen tap 'Forgot password?'.", "Open the email link on your phone and set a new password."], go: null },
];

function nextSteps(d, calc, settings, status) {
  const out = []; const today = startOfDay(new Date());
  if (status === "setup") out.push({ t: "Finish the database update", s: "Run supabase-v2.sql in Supabase, then reload.", go: null });
  if (calc.cash == null) out.push({ t: "Set your cash", s: "Check your bank app and type the balance. Then 'Safe to spend' works.", go: "cash", btn: "Set cash" });
  calc.obl.filter(r => !r.is_cleared && r._dt < today).slice(0, 2).forEach(r => out.push({ t: `Overdue: ${r.entity_name} ${fmt(r.amount_due, 2)}`, s: `Was due ${dayLabel(r._dt)}. Pay it, then tick it. If you already paid, just tick it.`, go: "tick:" + r.id, btn: "Mark paid" }));
  calc.inc.filter(r => !r.is_cleared && r._dt <= today && r._dt >= addDays(today, -5)).slice(0, 1).forEach(r => out.push({ t: "Did your allowance arrive?", s: `Expected ${dayLabel(r._dt)} (+${fmt(r.amount_due)}). Tick it when it lands to split it.`, go: "tick:" + r.id, btn: "It arrived" }));
  if (calc.safe != null && calc.safe < 0) out.push({ t: `You're short ${fmt(-calc.safe, 2)} before payday`, s: "Line up backup cover (your friend) now, before the bill date. Don't use PayLater.", go: "scroll:week", btn: "See bills" });
  calc.obl.filter(r => !r.is_cleared && r._dt >= today && r._dt <= addDays(today, 3)).slice(0, 2).forEach(r => out.push({ t: `Pay ${r.entity_name} ${fmt(r.amount_due, 2)}`, s: `Due ${dayLabel(r._dt)}. Tick it once paid.`, go: "tick:" + r.id, btn: "Mark paid" }));
  if (d.state.cash_updated_at && Date.now() - new Date(d.state.cash_updated_at) > 7 * 864e5) out.push({ t: "Check your cash", s: `Last set ${ago(d.state.cash_updated_at)}. Match it to your bank app.`, go: "cash", btn: "Update cash" });
  const buf = d.pots.find(p => /buffer/i.test(p.name));
  if (buf && buf.goal && Number(buf.balance) < Number(buf.goal) && calc.safe != null && calc.safe > 60) {
    const amt = Math.max(5, Math.floor(Math.min(calc.safe - 40, Number(buf.goal) - Number(buf.balance)) / 5) * 5);
    out.push({ t: `Move ${fmt(amt)} into your Buffer`, s: `${fmt(buf.balance)} of ${fmt(buf.goal)}. You can spare it and still cover bills.`, go: "pot:" + buf.id, btn: "Open Buffer" });
  }
  const lastSpend = d.spend[0] ? parseDate(d.spend[0].spent_on) : null;
  if (!lastSpend || diffDays(today, lastSpend) >= 3) out.push({ t: "Log what you've spent", s: lastSpend ? `Nothing logged since ${dayLabel(lastSpend)}.` : "Nothing logged yet this month.", go: "spend", btn: "Log spending" });
  if (today >= parseDate(settings.studyStart) && calc.studyWeek < settings.studyTarget && [0, 6].includes(today.getDay())) out.push({ t: "Study session", s: `${(calc.studyWeek / 60).toFixed(1)} of ${settings.studyTarget / 60} h this week.`, go: "study", btn: "Log study" });
  const lb = Number(lsGet("ascent-last-backup", "0"));
  if (Date.now() - lb > 30 * 864e5) out.push({ t: "Download a backup", s: lb ? `Last one ${ago(new Date(lb).toISOString())}.` : "You haven't made one yet.", go: "backup", btn: "Back up" });
  return out;
}

function Guide({ steps, aiState, onClose, onGo, onAskClaude }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(null);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = HOWTO.filter(h => !words.length || words.every(w => (h.q + " " + h.k).toLowerCase().includes(w)));
  return (
    <div className="ai guide" role="dialog" aria-label="Guide">
      <div className="ai-head">
        <div className="g-icon" aria-hidden="true">?</div>
        <div className="ai-title"><b>Guide</b><span>What to do next, and how</span></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>
      <div className="ai-body g-body">
        <button className={"ask-claude" + (aiState === "ready" ? "" : " off")} onClick={onAskClaude}>
          <span className="ai-orb" aria-hidden="true" />
          <span><b>{aiState === "ready" ? "Ask Claude" : "Claude · switches on in December"}</b><small>{aiState === "ready" ? "Ask anything, or tell it what happened. It can do it for you." : "Until then, this guide and the Claude app (Life Changing project) have you covered."}</small></span>
        </button>

        <div className="caps mute g-h">Your next steps</div>
        {steps.length === 0 ? <div className="g-step done"><b>All clear.</b><span>Nothing needs you today. Keep your streak going.</span></div>
          : steps.slice(0, 4).map((s, i) => (
            <div className="g-step" key={i}>
              <span className="g-n">{i + 1}</span>
              <span className="g-t"><b>{s.t}</b><span>{s.s}</span></span>
              {s.go && <button className="chip-btn solid2" onClick={() => onGo(s.go)}>{s.btn || "Go"}</button>}
            </div>
          ))}

        <div className="caps mute g-h">How do I…</div>
        <input className="field" id="gq" placeholder="Search, e.g. debt, payday, pot, trading" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" />
        <div className="g-list">
          {list.map((h, i) => (
            <div className={"g-item" + (open === h.q ? " open" : "")} key={h.q}>
              <button className="g-q" onClick={() => setOpen(open === h.q ? null : h.q)} aria-expanded={open === h.q}><span>{h.q}</span><span aria-hidden="true">{open === h.q ? "−" : "+"}</span></button>
              {open === h.q && <div className="g-a">
                <ol>{h.a.map((x, j) => <li key={j}>{x}</li>)}</ol>
                {h.go && <button className="chip-btn solid2" onClick={() => onGo(h.go)}>{h.btn}</button>}
              </div>}
            </div>
          ))}
          {list.length === 0 && <p className="mute">Nothing matches. Try another word{aiState === "ready" ? ", or ask Claude" : ""}.</p>}
        </div>
      </div>
    </div>
  );
}

/* ================= WORLDS: Money · Invest · Career · Life ================= */
const WORLDS = [
  { id: "money", name: "Money", sub: "Home world", glyph: "◐", marq: "ASCENT" },
  { id: "invest", name: "Invest", sub: "The ringed giant", glyph: "◍", marq: "ORBIT" },
  { id: "career", name: "Career", sub: "The red frontier", glyph: "◉", marq: "FRONTIER" },
  { id: "life", name: "Life", sub: "The ocean world", glyph: "○", marq: "STAY FREE" },
];
const worldOf = id => WORLDS.find(w => w.id === id) || WORLDS[0];
/* which world a to-do or milestone belongs to (uses the optional `area` column, else the words in it) */
const areaOf = x => x.area || (/invest|stashaway|ibkr|syfe/i.test(x.title) ? "invest"
  : /network\+|security\+|suss|job|sponsor|study|cert|bmt|degree|safra|ntuc|exam|interview|resume|cv\b/i.test(x.title) ? "career"
  : /ippt|broker|trading|kept the|parent|mum|dad|hajj|friend|wedding|bto/i.test(x.title) ? "life" : "money");

/* ---------- world switcher ---------- */
const prevKey = k => { const [y, m] = k.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };

/* ================= INVEST: The Grove ================= */
const OWN = [
  { k: "Shares", t: "Growth", p: "Part-owner of hundreds of Shariah-screened companies in the US, other rich countries and emerging markets. Grows the most, drops the most." },
  { k: "Sukuk", t: "Steady income", p: "Co-ownership of real assets (roads, buildings, power) paying a share of the rent, about 4–5% a year lately. Calmer than shares." },
  { k: "Gold", t: "Shock absorber", p: "Often holds up when shares fall. Doesn't pay income; it's there to cushion." },
];
const OWN_NAMES = ["Nvidia", "Apple", "Microsoft", "Alphabet", "Broadcom", "Tesla", "AMD", "Eli Lilly"];
const LEARN = [
  { t: "What DCA really does", p: "Same amount, same day, every month. When prices are low your $50 automatically buys more units; when high, fewer. You never have to decide anything, which is the point." },
  { t: "Three jobs: shares, sukuk, gold", p: "Shares grow, sukuk pay steady income, gold cushions crashes. Your risk level only changes how much of each. Aggressive = mostly shares." },
  { t: "What makes it Shariah", p: "Screens remove interest-based finance, alcohol, pork, gambling and companies with too much debt (roughly over 30% of their value). Sukuk replace interest with a share of real rent or profit." },
  { t: "Fees are a silent tax", p: "About 1% a year sounds small. On $10,000 that's $100 every year, compounding for decades. Low, automatic, boring beats clever." },
  { t: "Bad years are normal", p: "Drops of 20–35% have come every few years in history, and markets have always recovered given time, though nothing is guaranteed. In a crash your job is to do nothing. The same $50 goes in." },
  { t: "Where a fund lives matters", p: "US-listed funds (like SPUS) lose 30% of dividends to US tax for Singaporeans, and US holdings above US$60,000 can face US estate tax. Irish-domiciled funds cut the dividend tax to about 15% and avoid that estate risk." },
  { t: "Let rebalancing happen", p: "When shares race ahead, StashAway trims them back to your mix and tops up sukuk and gold. You never need to time it yourself." },
  { t: "Scale with salary, not with hype", p: "After ORD, raise the percentage (8%, then 20%) when your pay rises. Never raise it because markets are hot or 'cheap'." },
];
const INVEST_RX = /stashaway|invest|ibkr|interactive brokers/i;
const LEVELS = [
  { at: 0, name: "Stardust" }, { at: 1, name: "Comet" }, { at: 3, name: "Moon" }, { at: 6, name: "Planet" },
  { at: 12, name: "Ringed giant" }, { at: 24, name: "Star" }, { at: 60, name: "Nebula" }, { at: 120, name: "Galaxy" },
];
function investInfo(d, today) {
  const pot = d.pots.find(p => INVEST_RX.test(p.name)) || null;
  const moves = pot ? d.moves.filter(m => m.pot_id === pot.id && Number(m.amount) > 0) : [];
  const months = new Set(moves.map(m => String(m.created_at).slice(0, 7)));
  const now = ym(today);
  let k = months.has(now) ? now : prevKey(now), streak = 0;
  while (months.has(k)) { streak++; k = prevKey(k); }
  const planted = moves.reduce((s, m) => s + Number(m.amount), 0);
  const n = months.size;
  let li = 0; LEVELS.forEach((l, i) => { if (n >= l.at) li = i; });
  const next = LEVELS[li + 1] || null;
  return { pot, moves, planted, n, streak, thisMonth: months.has(now), li, level: LEVELS[li], next, toNext: next ? next.at - n : 0, pct: next ? (n - LEVELS[li].at) / (next.at - LEVELS[li].at) * 100 : 100 };
}
const BADGES = [
  { t: "First launch", ok: i => i.n >= 1 }, { t: "3 in a row", ok: i => i.streak >= 3 }, { t: "6 in a row", ok: i => i.streak >= 6 },
  { t: "A full year", ok: i => i.streak >= 12 }, { t: "$1k invested", ok: i => i.planted >= 1000 }, { t: "$5k invested", ok: i => i.planted >= 5000 },
  { t: "Two years", ok: i => i.n >= 24 }, { t: "$25k invested", ok: i => i.planted >= 25000 },
];
function InvestWorld({ d, calc, settings, today, act, setSheet, flash }) {
  const inv = investInfo(d, today);
  const start = parseDate(settings.investStart || "2027-09-01");
  const open = today >= start;
  const monthly = Number(settings.investMonthly) || 50;
  const buffer = d.pots.find(p => /buffer/i.test(p.name));
  const quests = [
    { t: "All BNPL and credit cleared", ok: calc.creditLeft < .005 && calc.debts.length > 0 },
    { t: "$300 buffer in the bank", ok: !!buffer && Number(buffer.balance) >= Number(buffer.goal || 300) },
    { t: "Investing pot set up", ok: !!inv.pot },
    { t: `Opening day: ${dayYr(start)}`, ok: open },
  ];
  const todos = d.tasks.filter(t => !t.done && areaOf(t) === "invest");
  const reviewMonth = [2, 8].includes(today.getMonth()); // March and September
  const val = settings.investValue;
  return (
    <>
      <main>
        <section className="block wrap" id="grove">
          <div className="sechead"><Scramble text="THIS MONTH" /><span className="idx">you level up by<br />showing up, not by prices</span></div>
            <div className="budget reveal">
              <div className="row"><span className="caps mute">Level {inv.li + 1} · {inv.level.name}</span><span className="caps mute">{settings.investRisk || "Aggressive"}</span></div>
              <div className="safe-v">{inv.n} <small className="mute" style={{ fontSize: 14 }}>month{inv.n === 1 ? "" : "s"} invested</small></div>
              <div className="row"><span className="caps mute">{inv.next ? `Next: ${inv.next.name}` : "Max level"}</span><span className="caps mute">{inv.next ? `${inv.toNext} month${inv.toNext === 1 ? "" : "s"} to go` : "legend"}</span></div>
              <div className="meter"><i style={{ width: Math.min(100, inv.pct) + "%" }} /></div>
              {!open ? <p className="mute small">Investing opens {dayYr(start)}. Until then, clear the launch checklist.</p>
                : inv.thisMonth ? <p className="w-ok">Invested this month. Nothing else to do: don't check, don't top up.</p>
                  : <p className="mute small">This month's investment isn't in yet. Put in the fixed amount, the same as every month.</p>}
              <div className="minis">
                {open && inv.pot && !inv.thisMonth && <button className="chip-btn solid2" onClick={() => setSheet({ type: "plant" })}>Invest {fmt(monthly)} this month</button>}
                {!inv.pot && <button className="chip-btn solid2" onClick={() => act.addPot({ name: "StashAway Shariah", goal: 650, note: "$50/month from Sep 2027 · automatic" })}>Create the investing pot</button>}
              </div>
              <p className="mute small" style={{ marginTop: 10 }}>StashAway Shariah Global · {settings.investRisk || "Aggressive"} · shares + sukuk + gold · {fmt(monthly)} a month</p>
            </div>
            <div className="budget reveal" style={{ marginTop: 12 }}>
              {(() => { const ord = parseDate(settings.ord || "2028-09-30"); const mdiff = (x, y) => (y.getFullYear() - x.getFullYear()) * 12 + y.getMonth() - x.getMonth();
                let left = Math.max(0, mdiff(today < start ? start : today, ord) + 1); if (today >= start && inv.thisMonth) left = Math.max(0, left - 1);
                const due = today < start ? 0 : mdiff(start, today) + 1; const pace = inv.planted + monthly * left;
                return <>
                  <div className="row"><span className="caps mute">On track</span><span className="caps mute">contributions only</span></div>
                  <div className="row"><span className="v">{fmt(inv.planted)}</span><span className="num">{today < start ? "starts " + monthLabel(ym(start)) : `${inv.n} of ${due} month${due === 1 ? "" : "s"} in`}</span></div>
                  <div className="meter"><i style={{ width: Math.min(100, pace ? inv.planted / pace * 100 : 0) + "%" }} /></div>
                  <p className="mute small">On pace for about <b>{fmt(pace)}</b> put in by ORD ({monthLabel(ym(ord))}). Market ups and downs aren't counted, on purpose.</p>
                </>; })()}
            </div>
        </section>
        <section className="block wrap" id="checklist">
          <div className="sechead"><Scramble text="CHECKLIST" /><span className="idx">before<br />opening day</span></div>
            <div className="budget reveal">
              {quests.map(q => <div key={q.t} className={"quest-line" + (q.ok ? " ok" : "")}><span className="qk">{q.ok ? "✓" : "·"}</span>{q.t}</div>)}
              {todos.map(t => { const lk = taskLocked(t, today); return <button key={t.id} className={"quest-line todo-line" + (lk ? " locked" : "")} onClick={() => act.toggleTask(t)}><span className="qk">{lk ? "🔒" : "○"}</span>{t.title}{t.due_date ? " · " + dayLabel(parseDate(t.due_date)) : ""}{lk ? ` · unlocks ${dayYr(taskUnlock(t))}` : ""}</button>; })}
            </div>
        </section>
        <section className="block wrap" id="own">
          <div className="sechead"><Scramble text="WHAT YOU OWN" /><span className="idx">three parts<br />one portfolio</span></div>
          <div className="own-grid reveal">
            {OWN.map(o => <div key={o.t} className="budget own"><div className="caps mute">{o.k}</div><h4>{o.t}</h4><p className="mute small">{o.p}</p></div>)}
          </div>
          <div className="budget reveal" style={{ marginTop: 12 }}>
            <div className="caps mute">Biggest names in US Shariah funds</div>
            <div className="own-names">{OWN_NAMES.map(n => <span key={n}>{n}</span>)}</div>
            <p className="mute small">Shariah screens remove banks and other interest-based finance, alcohol, pork, gambling and heavily indebted companies. Exact funds: StashAway app → your portfolio → breakdown. Look at review time only.</p>
          </div>
        </section>
        <section className="block wrap" id="learn">
          <div className="sechead"><Scramble text="LEARN" /><span className="idx">{LEARN.filter((_, i) => i <= inv.li).length} of {LEARN.length}<br />unlock by levelling up</span></div>
          <div className="reveal">
            {LEARN.map((c, i) => { const on = i <= inv.li; return (
              <details key={c.t} className={"hist learn" + (on ? "" : " locked")} open={on && i === inv.li}>
                <summary><span className="hm">{on ? String(i + 1).padStart(2, "0") : "🔒"} · {c.t}</span><span className="num">{on ? "" : "Level " + (i + 1) + " · " + LEVELS[i].name}</span></summary>
                {on && <p className="small" style={{ margin: "4px 0 10px", lineHeight: 1.55 }}>{c.p}</p>}
              </details>); })}
          </div>
        </section>
        <section className="block wrap" id="badges">
          <div className="sechead"><Scramble text="BADGES" /><span className="idx">{BADGES.filter(b => b.ok(inv)).length} of {BADGES.length}</span></div>
          <div className="badges reveal">{BADGES.map(b => <div key={b.t} className={"badge" + (b.ok(inv) ? " got" : "")}><span aria-hidden="true">{b.ok(inv) ? "✦" : "○"}</span>{b.t}</div>)}</div>
          {inv.moves.length > 0 && <div className="recent reveal" style={{ marginTop: 18 }}>
            {inv.moves.slice(0, 12).map(m => <div key={m.id}><span className="rowbtn">{dayLabel(new Date(m.created_at))} · {m.reason || "Planted"}</span><span className="num">+{money(Number(m.amount))}</span></div>)}
          </div>}
        </section>
        <section className="block wrap" id="rules">
          <div className="sechead"><Scramble text="ORBIT RULES" /><span className="idx">investing,<br />not trading</span></div>
          <ol className="rules reveal">
            <li>A fixed amount, on a fixed day, every month. Nothing more.</li>
            <li>Extra money only at the review in March and September, and only from money with no other job.</li>
            <li>Never from the buffer, the Degree pot or Mum &amp; Dad's money.</li>
            <li>No single stocks, no price alerts, no checking in between.</li>
            <li>A drop is not a signal. The same amount goes in; it simply buys more units.</li>
          </ol>
        </section>
        <section className="block wrap" id="review">
          <div className="sechead"><Scramble text="REVIEW" /><span className="idx">March &amp;<br />September only</span></div>
          <div className="budget reveal">
            <div className="row"><span className="caps mute">Value check</span><span className="caps mute">March &amp; September only</span></div>
            <div className="row"><span className="v">{val ? fmt(val.amount) : "—"}</span><span className="num">{val ? "checked " + dayLabel(parseDate(val.at)) : "no review yet"}</span></div>
            {(() => { const gain = val ? val.amount - inv.planted : null; const extras = inv.moves.filter(mv => { const mo = new Date(mv.created_at).getMonth(); return ![2, 8].includes(mo) && !/monthly/i.test(mv.reason || ""); }).length;
              const due = today < start ? 0 : (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth() + (inv.thisMonth ? 1 : 0);
              return <div className="rev-grid">
                <div><span className="caps mute">Put in</span><b>{fmt(inv.planted)}</b></div>
                <div><span className="caps mute">Months</span><b>{inv.n}</b></div>
                <div><span className="caps mute">Average</span><b>{inv.n ? fmt(inv.planted / inv.n) : "—"}</b></div>
                <div><span className="caps mute">Up / down</span><b className={gain == null ? "" : gain >= 0 ? "gr" : "pk"}>{gain == null ? "—" : (gain >= 0 ? "+" : "−") + fmt(Math.abs(gain))}</b></div>
                <div><span className="caps mute">Fees, max/yr</span><b>{val ? "≈" + fmt(val.amount * .012) : "—"}</b></div>
                <div><span className="caps mute">Rules</span><b className={extras || due - inv.n > 0 ? "pk" : "gr"}>{extras ? `${extras} extra top-up${extras > 1 ? "s" : ""}` : due - inv.n > 0 ? `${due - inv.n} missed` : "Kept ✓"}</b></div>
              </div>; })()}
            <p className="mute small">{reviewMonth ? "It's review month. Look once, write the number here, close the app." : "Not a review month. The number can wait."}</p>
            {reviewMonth && <div className="minis"><button className="chip-btn" onClick={() => setSheet({ type: "invest-value" })}>Log this review's value</button></div>}
          </div>
        </section>
      </main>
    </>
  );
}

/* ================= CAREER: Terminal ================= */
const EMPLOYERS = [
  ["Government tech & security", "GovTech · CSA · HTX · DSTA"],
  ["Banks & finance", "DBS · OCBC · UOB · SGX"],
  ["Critical infrastructure", "SP Group · PUB · LTA · SMRT · PSA · Changi Airport Group"],
  ["Telco & large IT", "Singtel · NCS · StarHub · ST Engineering"],
];
function CareerWorld({ d, calc, settings, today, act, setSheet, newTask, setNewTask, newDue, setNewDue, hasArea }) {
  const studyOpen = today >= parseDate(settings.studyStart);
  const target = settings.studyTarget || 240;
  // weekly streak: weeks (Mon–Sun) that hit the target, counting back from last full week
  const monday = dt => addDays(dt, -((dt.getDay() + 6) % 7));
  const wk = {}; d.study.forEach(s => { const k = ymd(monday(parseDate(s.studied_on))); wk[k] = (wk[k] || 0) + Number(s.minutes); });
  let streak = 0, w = addDays(monday(today), -7); while ((wk[ymd(w)] || 0) >= target) { streak++; w = addDays(w, -7); }
  if ((wk[ymd(monday(today))] || 0) >= target) streak++;
  const totalH = d.study.reduce((s, x) => s + Number(x.minutes), 0) / 60;
  const path = d.ms.filter(m => areaOf(m) === "career").sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const nextP = path.find(m => !m.done);
  const exam = path.find(m => !m.done && /passed/i.test(m.title) && m.target_date);
  const examDays = exam ? diffDays(parseDate(exam.target_date), today) : null;
  const todos = d.tasks.filter(t => !t.done && areaOf(t) === "career").sort((a, b) => String(a.due_date || "9").localeCompare(String(b.due_date || "9")));
  const who = (ME.en || "wan").toLowerCase().split(" ")[0];
  return (
    <>
      <main>
        <section className="block wrap" id="study">
          <div className="sechead"><Scramble text="STUDY" /><span className="idx">{streak} week streak<br />target {target / 60} h a week</span></div>
          <div className="duo">
            <div className="budget reveal">
              {studyOpen ? <>
                <div className="row"><span className="caps mute">This week</span><span className="caps mute">{Math.max(0, (target - calc.studyWeek) / 60).toFixed(1)} h to go</span></div>
                <div className="row"><span className="v">{(calc.studyWeek / 60).toFixed(calc.studyWeek % 60 ? 1 : 0)} h</span><span className="num">of {target / 60} h</span></div>
                <div className="meter"><i style={{ width: Math.min(100, calc.studyWeek / target * 100) + "%" }} /></div>
              </> : <div className="row"><span className="caps mute">Study</span><span className="mute" style={{ fontSize: 13 }}>Starts {dayLabel(parseDate(settings.studyStart))}. Rest until then.</span></div>}
              <div className="minis"><button className="chip-btn solid2" onClick={() => setSheet({ type: "study" })}>Log a session</button></div>
            </div>
            <div className="budget reveal">
              <div className="caps mute">The rule</div>
              <p className="small">Type it yourself. Explain each line. AI is the tutor, not the answer.</p>
              <p className="mute small">Weekends: Saturday morning + Sunday before book-in. Miss a week? Adjust, don't abandon.</p>
            </div>
          </div>
        </section>
        <section className="block wrap" id="path">
          <div className="sechead"><Scramble text="THE PATH" /><span className="idx">{path.filter(m => m.done).length} of {path.length}<br />checkpoints</span></div>
          <div className="reveal term-list">
            {path.length === 0 && <div className="empty">No career checkpoints yet. Run career-update.sql, or add one in Life → Milestones.</div>}
            {path.map(m => <div key={m.id} className={"tl" + (m.done ? " done" : nextP && nextP.id === m.id ? " next" : "")}><span className="tk">{m.done ? "[x]" : nextP && nextP.id === m.id ? "[>]" : "[ ]"}</span><span className="tt">{m.title}</span><span className="td">{m.target_label}</span></div>)}
          </div>
        </section>
        <section className="block wrap" id="todo">
          <div className="sechead"><Scramble text="CAREER TO-DOS" /><span className="idx">reminded on Telegram<br />30 · 7 · 1 days before</span></div>
          <div className="reveal">
            {!hasArea && <div className="empty">Run worlds-setup.sql in Supabase so new to-dos you add here stay in Career.</div>}
            {todos.length === 0 && <div className="empty">Nothing open. Add the next thing below.</div>}
            {todos.map(t => <div className="qwrap" key={t.id}>
              {(() => { const lk = taskLocked(t, today); return <button className={"quest" + (lk ? " locked" : "")} aria-disabled={lk} onClick={() => act.toggleTask(t)}><span className="i">{lk ? "⛓" : ">"}</span><span><div className="t">{t.title}</div><div className="m">{t.due_date ? dayLabel(parseDate(t.due_date)) + " " + parseDate(t.due_date).getFullYear() : "Anytime"}{lk ? <em className="lk"> · unlocks {dayYr(taskUnlock(t))}</em> : null}</div></span><span className="a" /><span className="ck">{lk ? <span aria-hidden="true">🔒</span> : <Tick />}</span></button>; })()}
              <button className="qedit" aria-label={"More options for " + t.title} onClick={() => setSheet({ type: "task", task: t })}>⋯</button>
            </div>)}
            <form className="addrow" onSubmit={e => { e.preventDefault(); const t = newTask.trim(); if (!t) return; act.addTask(t, newDue, hasArea ? "career" : undefined); setNewTask(""); setNewDue(""); }}>
              <input className="field" placeholder="Add a career to-do…" value={newTask} onChange={e => setNewTask(e.target.value)} aria-label="New career to-do" />
              <input className="field" type="date" value={newDue} onChange={e => setNewDue(e.target.value)} aria-label="Due date (optional)" />
              <button className="cta" disabled={!newTask.trim()}>Add</button>
            </form>
          </div>
        </section>
        <section className="block wrap" id="employers">
          <div className="sechead"><Scramble text="WHERE TO LOOK" /><span className="idx">office hours ·<br />no healthcare</span></div>
          <div className="reveal">
            {EMPLOYERS.map(([s, e]) => <div className="debt" key={s}><span className="n">{s}</span><span /><span className="e">{e}</span></div>)}
            <p className="mute small" style={{ marginTop: 14 }}>Ask every one: is this role office hours? Do you sponsor part-time degrees? What's the bond?</p>
          </div>
        </section>
      </main>
    </>
  );
}

/* ================= LIFE: Dawn ================= */
const FAMILY_RX = /mum|dad|parent|hajj|travel|wedding|bto|renov|family/i;
function LifeWorld({ d, calc, settings, today, act, setSheet, setUrge, confirmReset, setConfirmReset, resetStreak, msAsk, setMsAsk }) {
  const since = parseDate(d.state.trading_free_since || ymd(today));
  const ordDays = Math.max(0, diffDays(parseDate(settings.ord), today));
  const fam = d.pots.filter(p => FAMILY_RX.test(p.name));
  const [filter, setFilter] = useState("all");
  const ms = d.ms.filter(m => filter === "all" || areaOf(m) === filter);
  const nextMs = d.ms.find(m => !m.done);
  const sunUp = Math.min(1, calc.streak / 365);
  return (
    <>
      <main>
        <section className="block wrap" id="streak">
          <div className="sechead"><Scramble text="STREAK" /><span className="idx">trading-free<br />only you see this</span></div>
            <div className="streak reveal">
              <div className="safe-v">Day {calc.streak}</div>
              <div className="mute small" style={{ marginBottom: 10 }}>Since {dayLabel(since)} {since.getFullYear()}</div>
              <div className="week">{Array.from({ length: 7 }, (_, i) => { const dt = addDays(today, i - 6); return <span key={i} className={diffDays(dt, since) >= 0 ? "on" : ""}>{DAYS[dt.getDay()].charAt(0)}</span>; })}</div>
              <div className="minis">
                <button className="chip-btn solid2" onClick={() => setUrge(true)}>I feel like trading</button>
                <span className="mute" style={{ fontSize: 12.5, alignSelf: "center" }}>Urges beaten: <b className="num" style={{ color: "var(--ink)" }}>{Number(d.state.urges_beaten) || 0}</b></span>
              </div>
              {!confirmReset
                ? <div><button className="signout" onClick={() => setConfirmReset(true)}>I slipped. Reset my streak.</button></div>
                : <div className="confirm"><span>A slip isn't the end. Reset, then tell your friend.</span><button className="danger" onClick={resetStreak}>Reset to day 1</button><button className="chip-btn" onClick={() => setConfirmReset(false)}>Cancel</button></div>}
            </div>
        </section>
        <section className="block wrap" id="why">
          <div className="sechead"><Scramble text="WHY" /><span className="idx">your reasons<br />read them often</span></div>
            <div className="budget reveal why">
              <div className="caps mute">Why you're doing this</div>
              {ME.why.length ? <ul>{ME.why.map((w, i) => <li key={i}>{w}</li>)}</ul> : <p className="mute small">Add your reasons in Settings → About you. They show here and when an urge hits.</p>}
              <div className="minis"><button className="chip-btn" onClick={() => setSheet({ type: "settings" })}>Edit reasons</button></div>
            </div>
        </section>
        <HabitsSection settings={settings} today={today} act={act} />
        <section className="block wrap" id="family">
          <div className="sechead"><Scramble text="FAMILY & DREAMS" /><span className="idx">Mum &amp; Dad first</span></div>
          <div className="pots reveal">
            {fam.map(p => (
              <button className="pot" key={p.id} onClick={() => setSheet({ type: "pot", pot: p })} aria-label={`Open ${potName(p)}`}>
                <Ring pct={p.goal ? Number(p.balance) / Number(p.goal) * 100 : 0} />
                <b>{potName(p)}</b><small>{fmt(p.balance)}{p.goal ? " / " + fmt(p.goal) : ""}{p.note ? " · " + p.note : ""}</small>
              </button>
            ))}
            <button className="pot pot-new" onClick={() => setSheet({ type: "new-pot" })}><span className="plus">+</span><b>New dream</b><small>Hajj, renovation, BTO…</small></button>
          </div>
          <p className="mute small reveal" style={{ marginTop: 12 }}>Stages 4–5 of the plan live here: your parents' Hajj, their renovation, BTO, a wedding. Each gets a pot when its time comes.</p>
        </section>
        <section className="block wrap" id="milestones">
          <div className="sechead"><Scramble text="THE JOURNEY" /><span className="idx">{d.ms.filter(m => m.done).length} of {d.ms.length}<br />some tick themselves</span></div>
          <div className="typechips reveal" style={{ marginBottom: 8 }}>{[["all", "All"], ...WORLDS.map(w => [w.id, w.name])].map(([k, l]) => <button key={k} className={"cat" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>)}</div>
          <div className="reveal">
            {ms.map(m => (
              <div key={m.id}>
                <button className={"ms" + (m.done ? " done" : "") + (nextMs && nextMs.id === m.id ? " next" : "")} onClick={() => setMsAsk(msAsk === m.id ? null : m.id)} aria-pressed={!!m.done}>
                  <span><div className="t">{m.title}</div><div className="m">{m.target_label}{m.auto_rule ? " · ticks itself" : ""} · {worldOf(areaOf(m)).name}</div></span><span />
                  <span className="ck">✓</span>
                </button>
                {msAsk === m.id && <div className="confirm"><span>{m.done ? "Mark as not done?" : "Mark as done?"}</span><button className="danger" style={{ background: "var(--ink)", color: "var(--bg)" }} onClick={e => act.toggleMs(m, e)}>Yes</button><button className="chip-btn" onClick={() => setMsAsk(null)}>Cancel</button></div>}
              </div>
            ))}
            <div className="minis"><button className="chip-btn solid2" onClick={() => setSheet({ type: "ms" })}>+ Add a milestone</button></div>
          </div>
        </section>
      </main>
    </>
  );
}

/* ================= UNDERGROUND: game-menu shell (v11) ================= */
/* menu sounds, synthesised (no files). On by default; the mute button remembers your choice. */
Sound.on = lsGet("ascent-sfx", "off") === "on";
Object.assign(Sound, {
  sweep(f1, f2, dur, type = "square", vol = .04, delay = 0) {
    if (!this.on) return;
    try { const c = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)()); if (c.state === "suspended") c.resume();
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) {} },
  whoosh() {
    if (!this.on) return;
    try { const c = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)()); if (c.state === "suspended") c.resume();
      const n = Math.floor(c.sampleRate * .24), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(600, c.currentTime); f.frequency.exponentialRampToValueAtTime(3200, c.currentTime + .2); g.gain.value = .16; s.connect(f).connect(g).connect(c.destination); s.start();
    } catch (e) {} },
  move() { this.whoosh(); this.sweep(880, 1320, .06, "square", .022); },
  select() { this.sweep(660, 990, .08, "square", .045); this.sweep(990, 1480, .12, "square", .035, .07); this.sweep(70, 190, .45, "sawtooth", .045, .05); },
  back() { this.sweep(700, 350, .12, "triangle", .055); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.sweep(f, f * 1.01, .18, "square", .035, i * .07)); },
});
const setSfx = on => { Sound.on = on; lsSet("ascent-sfx", on ? "on" : "off"); if (on) Sound.tick(); };

/* the four stages: what each carousel card and stage bar shows */
const UG_TABS = {
  money: [["week", "Week"], ["climb", "Climb"], ["debts", "Debts"], ["bills", "Bills"], ["spend", "Spend"], ["pots", "Pots"], ["parents", "Parents"], ["history", "History"]],
  invest: [["grove", "This month"], ["checklist", "Checklist"], ["own", "Own"], ["learn", "Learn"], ["badges", "Badges"], ["rules", "Rules"], ["review", "Review"]],
  career: [["study", "Study"], ["path", "Path"], ["todo", "To-dos"], ["employers", "Jobs"]],
  life: [["streak", "Streak"], ["why", "Why"], ["habits", "Habits"], ["family", "Family"], ["milestones", "Journey"]],
};
const ugTabOf = id => (id === "ascent" || id === "top" ? "climb" : id === "streaks" ? "streak" : id);
const UG_IMG = id => `https://images.unsplash.com/photo-${id}?w=${innerWidth > 900 ? 900 : 640}&q=62&auto=format&fit=crop`;
function ugCards(d, calc, settings, today) {
  const inv = investInfo(d, today);
  const start = parseDate(settings.investStart || "2027-09-01"), open = today >= start;
  const path = d.ms.filter(m => areaOf(m) === "career").sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const nextP = path.find(m => !m.done), doneP = path.filter(m => m.done).length;
  const studyH = (calc.studyWeek / 60).toFixed(calc.studyWeek % 60 ? 1 : 0);
  const climbed = Math.max(0, Math.round((1 - calc.remaining / calc.totalAll) * 100));
  return [
    { k: "money", jp: "お金", t: "Money", tag: "Clear debt · buy freedom", img: "1758881606455-26cc1c2c8de4", l: "Debt cleared", v: `${fmt(calc.remaining)} left`, pill: `${climbed}%`, p: climbed, c: "gr",
      say: [{ t: "Money. " }, { t: fmt(calc.remaining), b: 1 }, { t: " left" + (calc.safe != null ? ", " : ".") }, ...(calc.safe != null ? [{ t: fmt(calc.safe), b: 1 }, { t: " safe to spend." }] : [])] },
    { k: "invest", jp: "投資", t: "Invest", tag: "Show up · level up", img: "1578215560516-474d84f62ec3", l: `Level ${inv.li + 1} · ${inv.level.name}`, v: open ? `${inv.n} mo in` : monthLabel(ym(start)), pill: `LV ${inv.li + 1}`, p: open ? inv.pct : 0, c: "cy",
      lock: open ? null : `Unlocks ${monthLabel(ym(start))}`,
      say: open ? [{ t: "Invest. " }, { t: inv.thisMonth ? "This month is in." : "This month isn't in yet.", b: 1 }] : [{ t: "Invest unlocks " }, { t: monthLong(ym(start)), b: 1 }, { t: ". Launch checklist first." }] },
    { k: "career", jp: "仕事", t: "Career", tag: "Study · certify · climb", img: "1547981609-ad4e1dde4d41", l: "Checkpoints", v: `${doneP} / ${path.length}`, pill: `${doneP}/${path.length}`, p: path.length ? doneP / path.length * 100 : 0, c: "cy",
      say: [{ t: "Career. Next: " }, { t: nextP ? nextP.title : "all done", b: 1 }, { t: `. ${studyH} h this week.` }] },
    { k: "life", jp: "人生", t: "Life", tag: "Faith · family · freedom", img: "1604604994333-f1b0e9471186", l: "Trading-free", v: `Day ${String(calc.streak).padStart(2, "0")}`, pill: `Day ${calc.streak}`, p: Math.min(100, calc.streak / 90 * 100), c: "gr",
      say: [{ t: "Life. " }, { t: `Day ${calc.streak}`, b: 1 }, { t: " trading-free. Proud of you." }] },
  ];
}

/* background: navy night, light streaks rushing past, a moving grid floor */
function UGBg() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, cx = cv.getContext("2d"); let W, H, DPR, st = [], raf, last = 0, t0 = performance.now();
    const phone = innerWidth < 700, fps = phone ? 30 : 60;
    const nsk = rand => { const h = Math.random(); return { x: rand ? Math.random() * W : -W * .3, y: H * (.12 + Math.random() * .85), l: (60 + Math.random() * 260) * DPR, v: (4 + Math.random() * 14) * DPR * (60 / fps), w: (Math.random() * 1.8 + .4) * DPR, c: h < .55 ? "63,230,255" : h < .8 ? "139,92,255" : "255,95,162", a: .12 + Math.random() * .4 }; };
    const size = () => { DPR = Math.min(devicePixelRatio || 1, phone ? 1 : 1.5); W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; st = Array.from({ length: phone ? 22 : 46 }, () => nsk(true)); };
    const draw = now => {
      const t = (now - t0) / 1000, g = cx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#040a1a"); g.addColorStop(.55, "#06112a"); g.addColorStop(1, "#02050c"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      const hz = H * .62; cx.strokeStyle = "rgba(63,230,255,.09)"; cx.lineWidth = DPR;
      for (let i = -14; i <= 14; i++) { cx.beginPath(); cx.moveTo(W / 2 + i * W * .02, hz); cx.lineTo(W / 2 + i * W * .22, H); cx.stroke(); }
      for (let k = 0; k < 12; k++) { const p = (k + (REDUCE ? 0 : (t * .6) % 1)) / 12, y = hz + (H - hz) * p * p; cx.globalAlpha = p; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
      cx.globalAlpha = 1;
      const hg = cx.createLinearGradient(0, hz - 60 * DPR, 0, hz + 40 * DPR); hg.addColorStop(0, "rgba(139,92,255,0)"); hg.addColorStop(.6, "rgba(139,92,255,.16)"); hg.addColorStop(1, "rgba(63,230,255,0)"); cx.fillStyle = hg; cx.fillRect(0, hz - 60 * DPR, W, 100 * DPR);
      for (const s of st) { const gr = cx.createLinearGradient(s.x - s.l, 0, s.x, 0); gr.addColorStop(0, `rgba(${s.c},0)`); gr.addColorStop(1, `rgba(${s.c},${s.a})`);
        cx.strokeStyle = gr; cx.lineWidth = s.w; cx.beginPath(); cx.moveTo(s.x - s.l, s.y); cx.lineTo(s.x, s.y); cx.stroke();
        if (!REDUCE) { s.x += s.v * (CALM ? .35 : 1); if (s.x - s.l > W) Object.assign(s, nsk(false)); } }
    };
    const loop = now => { raf = requestAnimationFrame(loop); if (document.hidden || now - last < 1000 / fps - 2) return; last = now; draw(now); };
    size(); draw(performance.now()); if (!REDUCE) raf = requestAnimationFrame(loop);
    const rs = () => { size(); draw(performance.now()); }; addEventListener("resize", rs);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", rs); };
  }, []);
  return <><canvas className="ug-bg" ref={ref} aria-hidden="true" /><div className="ug-vig" aria-hidden="true" /><div className="ug-scan" aria-hidden="true" /></>;
}

function UGLogo({ small }) { return <div className={"ug-logo chrome" + (small ? " sm" : "")}>ASCENT<small>上昇</small></div>; }
function UGIcon({ k }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (k === "snd") return <svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a4 4 0 010 6" /></svg>;
  if (k === "mute") return <svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l5 6M22 9l-5 6" /></svg>;
  if (k === "out") return <svg {...p}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>;
  if (k === "menu") return <svg {...p}><path d="M4 7h16M4 12h16M4 17h10" /></svg>;
  return null;
}
function SfxBtn() {
  const [on, setOn] = useState(Sound.on);
  return <button className="ug-icon" aria-label={on ? "Mute sounds" : "Turn sounds on"} aria-pressed={on} onClick={() => { setSfx(!on); setOn(!on); }}><UGIcon k={on ? "snd" : "mute"} /></button>;
}
function UGClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 20000); return () => clearInterval(i); }, []);
  return <div className="ug-pill"><i className="gr">●</i>{t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}<span className="hide-xs"> SGT</span></div>;
}
function Segs({ p, c = "gr", n = 20 }) {
  const on = Math.max(p > 0 ? 1 : 0, Math.round(p / (100 / n)));
  return <div className={"ug-seg " + c} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}</div>;
}
function TypeLine({ parts }) {
  const [n, setN] = useState(0);
  const total = parts.reduce((s, p) => s + p.t.length, 0);
  useEffect(() => { setN(CALM ? total : 0); if (CALM) return; let i = 0; const t = setInterval(() => { i++; setN(i); if (i % 4 === 0) Sound.tick(); if (i >= total) clearInterval(t); }, 18); return () => clearInterval(t); }, [parts]);
  let left = n;
  return <>{parts.map((p, i) => { const s = p.t.slice(0, Math.max(0, left)); left -= p.t.length; return p.b ? <b key={i}>{s}</b> : <span key={i}>{s}</span>; })}<span className="ug-caret" /></>;
}
function UGWipe({ title, sub, onMid, onDone }) {
  useEffect(() => { const a = setTimeout(onMid, REDUCE ? 0 : 520), b = setTimeout(onDone, REDUCE ? 0 : 1150); return () => { clearTimeout(a); clearTimeout(b); }; }, []);
  return <div className="ug-wipe" aria-hidden="true"><div><div className="ug-t chrome">{title}</div><div className="ug-hud">{sub}</div><div className="ug-ld"><i /></div></div></div>;
}

/* ---------- sign-in ---------- */
function Gate() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [mode, setMode] = useState("in"); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { document.documentElement.setAttribute("data-world", "ug"); }, []);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setMsg(""); Sound.select();
    try {
      if (mode === "forgot") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        setMsg("Check your email for a reset link. Open it on this phone.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      }
    } catch (err) { Sound.back(); setMsg(err.message || "Something went wrong. Check your connection and try again."); }
    setBusy(false);
  };
  const sw = m => { Sound.move(); setMode(m); setMsg(""); };
  return (
    <div className="ug-screen ug-login">
      <div className="ug-banner"><img src="ascent-banner.jpg" alt="" /><div className="ug-flare" /></div>
      <div className="ug-lbot"><div className="ug-linner">
        <h1 className="ug-t chrome ug-ltitle">Ascent</h1>
        <div className="ug-hud ug-lsub">Underground · <span className="cy">one month at a time</span></div>
        <form className="ug-panel" onSubmit={submit}>
          <label className="ug-fld"><span className="ug-hud">Driver ID · email</span><input className="ug-in" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          {mode !== "forgot" && <label className="ug-fld"><span className="ug-hud">Key · password</span><input className="ug-in" type="password" autoComplete="current-password" minLength={8} required value={pw} onChange={e => setPw(e.target.value)} /></label>}
          <div className="ug-err" role="alert">{msg}</div>
          <button className="ug-btn" disabled={busy}>{busy ? "Loading…" : mode === "forgot" ? "Send reset link" : "Press start"} <span className="key">A</span></button>
          <div className="ug-links">
            {mode === "in" ? <><button type="button" onClick={() => sw("forgot")}>Forgot password?</button><span>Private garage</span></>
              : <button type="button" onClick={() => sw("in")}>Back to sign in</button>}
          </div>
        </form>
      </div></div>
    </div>
  );
}

/* ---------- main menu: swipe carousel ---------- */
function Hub({ d, calc, settings, today, world, onEnter, onSignOut, onUrge }) {
  const cards = ugCards(d, calc, settings, today);
  const [idx, setIdx] = useState(() => Math.max(0, cards.findIndex(c => c.k === world)));
  const [narrow, setNarrow] = useState(innerWidth < 900);
  const name = ME.en ? ME.en.split(" ").slice(-1)[0] : "";
  const h = new Date().getHours(), tod = h < 5 ? "Up late" : h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  const greet = useMemo(() => [{ t: tod + ", " }, { t: "master", b: 1 }, { t: ". Which stage today?" }], []);
  const [line, setLine] = useState(greet);
  useEffect(() => { const r = () => setNarrow(innerWidth < 900); addEventListener("resize", r); return () => removeEventListener("resize", r); }, []);
  const to = i => { const n = (i + cards.length) % cards.length; if (n === idx) return; Sound.move(); buzz(6); setIdx(n); setLine(cards[n].say); };
  const enter = () => onEnter(cards[idx]);
  useEffect(() => {
    const k = e => { if (/input|textarea|select/i.test(e.target.tagName) || document.querySelector(".ug-rep,.ug-lock,.urge")) return;
      if (e.key === "ArrowRight") to(idx + 1); else if (e.key === "ArrowLeft") to(idx - 1); else if (e.key === "Enter") enter(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
  const sx = useRef(null);
  const gap = narrow ? innerWidth * .62 : 400;
  return (
    <div className="ug-screen ug-menu">
      <div className="ug-top">
        <UGLogo small /><div className="ug-sp" />
        <div className="ug-clockw"><UGClock /></div>
        <button className="ug-pill ug-urge" onClick={onUrge}>Urge?</button>
        <SfxBtn />
        <button className="ug-icon" aria-label="Sign out" onClick={onSignOut}><UGIcon k="out" /></button>
      </div>
      <div className="ug-side">
        <div className="ug-hero"><img src="ascent-hero.jpg" alt="" /><div className="ug-hello"><div className="ug-hud">Welcome back</div><div className="ug-t chrome">{name || "Master"}</div></div></div>
        <div className="ug-say" aria-live="polite"><TypeLine parts={line} /></div>
      </div>
      <div className="ug-car" onPointerDown={e => { sx.current = e.clientX; }} onPointerUp={e => { if (sx.current == null) return; const dx = e.clientX - sx.current; sx.current = null; if (Math.abs(dx) > 40) to(idx + (dx < 0 ? 1 : -1)); }}>
        {cards.map((c, i) => {
          let o = i - idx; const a = Math.abs(o);
          return (
            <div key={c.k} className={"ug-card" + (a ? "" : " act")} role="button" tabIndex={a ? -1 : 0} aria-label={`Stage ${i + 1}: ${c.t}. ${c.l} ${c.v}`}
              style={{ transform: `translate(-50%,-50%) translateX(${o * gap}px) translateZ(${-a * 160}px) rotateY(${-o * 28}deg) scale(${1 - a * .08})`, opacity: a > 1 ? 0 : 1 - a * .45, zIndex: 10 - a, filter: a ? "brightness(.5) saturate(.6)" : "none", pointerEvents: a > 1 ? "none" : "auto" }}
              onClick={() => (i === idx ? enter() : to(i))}>
              <div className="face">
                <div className="img" style={{ backgroundImage: `url('${UG_IMG(c.img)}')` }} /><div className="tint" /><div className="fade" />
                <div className="num">STAGE 0{i + 1}</div><div className="kj">{c.jp}</div>
                <div className="body">
                  <h2 className="ug-t chrome">{c.t}</h2><div className="ug-hud ug-tagl">{c.tag}</div>
                  <div className="ug-stat"><span>{c.l}</span><b>{c.v}</b></div><Segs p={c.p} c={c.c} />
                  <div className="go ug-hud">{c.lock ? <span className="lock">⛓ {c.lock}</span> : <span className="cy">Ready</span>}<span>Enter <span className="cy">A</span></span></div>
                </div>
              </div>
            </div>
          );
        })}
        <button className="ug-arrow l" aria-label="Previous stage" onClick={e => { e.stopPropagation(); to(idx - 1); }}>‹</button>
        <button className="ug-arrow r" aria-label="Next stage" onClick={e => { e.stopPropagation(); to(idx + 1); }}>›</button>
      </div>
      <div className="ug-dots">{cards.map((c, i) => <button key={c.k} aria-label={c.t} className={i === idx ? "on" : ""} onClick={() => to(i)} />)}</div>
      <div className="ug-prompt ug-hud"><span><kbd>◀ ▶</kbd> swipe</span><span><kbd>A</kbd> tap to enter</span></div>
    </div>
  );
}

/* ---------- inside a stage: header + game tabs ---------- */
function StageBar({ card, tabs, tab, onTab, onBack, onMenu, onSpend, onGuide, steps }) {
  const i = tabs.findIndex(t => t[0] === tab);
  const ref = useRef(null);
  useEffect(() => { const el = ref.current && ref.current.querySelector(".on"); el && el.scrollIntoView && el.scrollIntoView({ block: "nearest", inline: "center", behavior: CALM ? "auto" : "smooth" }); }, [tab]);
  return (
    <div className="ug-stagebar">
      <div className="ug-top">
        <button className="ug-back" onClick={onBack} aria-label="Back to the main menu"><kbd>B</kbd><span className="ug-t chrome">{card.t}</span></button>
        <div className="ug-sp" />
        <div className="ug-pill hide-xs"><span className="ug-hud">{card.jp}</span><span className={card.c}>{card.pill}</span></div>
        <button className="ug-cta" onClick={onSpend}>+ Spend</button>
        <button className="ug-icon ug-help" aria-label={`Guide: ${steps} next step${steps === 1 ? "" : "s"}`} onClick={onGuide}>?{steps > 0 && <b>{Math.min(9, steps)}</b>}</button>
        <button className="ug-icon" aria-label="Pause menu" onClick={onMenu}><UGIcon k="menu" /></button>
      </div>
      <div className="ug-tabs">
        <button className="ug-kbd" aria-label="Previous tab" onClick={() => onTab(tabs[Math.max(0, i - 1)][0])}>L1</button>
        <div className="tb" ref={ref} role="tablist">{tabs.map(([id, l]) => <button key={id} role="tab" aria-selected={id === tab} className={"ug-tab" + (id === tab ? " on" : "")} onClick={() => onTab(id)}>{l}</button>)}</div>
        <button className="ug-kbd" aria-label="Next tab" onClick={() => onTab(tabs[Math.min(tabs.length - 1, i + 1)][0])}>R1</button>
      </div>
    </div>
  );
}

/* ---------- app lock: optional 4-digit PIN, stored hashed on this device only ---------- */
const PIN_KEY = "ascent-pin";
const pinOn = () => !!lsGet(PIN_KEY, "");
async function pinHash(pin) {
  let salt = lsGet("ascent-pin-salt", ""); if (!salt) { salt = uid(); lsSet("ascent-pin-salt", salt); }
  const s = salt + ":" + pin;
  try { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); }
  catch (e) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "x" + (h >>> 0).toString(16); }
}
function PinPad({ mode, onDone, onCancel, onForgot }) {
  const [pin, setPin] = useState(""); const [first, setFirst] = useState(null);
  const [msg, setMsg] = useState(""); const [shake, setShake] = useState(0);
  const [wait, setWait] = useState(0); const fails = useRef(Number(lsGet("ascent-pin-fails", "0")) || 0);
  useEffect(() => { if (!wait) return; const t = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000); return () => clearInterval(t); }, [!!wait]);
  const title = mode === "unlock" ? "Locked" : first ? "Confirm PIN" : "New PIN";
  const sub = mode === "unlock" ? (wait ? `Too many tries. Wait ${wait}s.` : "Enter your 4-digit PIN") : first ? "Type the same 4 digits again" : "Pick 4 digits you'll remember";
  const bad = t => { Sound.back(); buzz([40, 40, 40]); setShake(s => s + 1); setMsg(t); setPin(""); };
  const full = async p => {
    if (mode === "unlock") {
      if (await pinHash(p) === lsGet(PIN_KEY, "")) { fails.current = 0; lsSet("ascent-pin-fails", "0"); Sound.select(); onDone(); return; }
      fails.current++; lsSet("ascent-pin-fails", String(fails.current));
      if (fails.current % 5 === 0) setWait(30);
      bad("Wrong PIN"); return;
    }
    if (!first) { Sound.tick(); setFirst(p); setPin(""); setMsg(""); return; }
    if (p !== first) { setFirst(null); bad("Didn't match. Start again."); return; }
    lsSet(PIN_KEY, await pinHash(p)); lsSet("ascent-pin-fails", "0"); Sound.win(); onDone();
  };
  const press = k => {
    if (wait) return;
    if (k === "del") { setPin(p => p.slice(0, -1)); Sound.tick(); return; }
    if (pin.length >= 4) return;
    const p = pin + k; setPin(p); Sound.tick(); buzz(5); setMsg("");
    if (p.length === 4) setTimeout(() => full(p), 120);
  };
  useEffect(() => { const k = e => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("del"); else if (e.key === "Escape" && onCancel) onCancel(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  return (
    <div className="ug-lock" role="dialog" aria-modal="true" aria-label={title}>
      <img src="ascent-hero.jpg" alt="" className="ug-lock-bg" />
      <div className="ug-lock-in">
        <UGLogo small />
        <h2 className="ug-t chrome">{title}</h2>
        <div className="ug-hud">{sub}</div>
        <div className={"ug-dots4" + (shake ? " shake" : "")} key={shake}>{[0, 1, 2, 3].map(i => <i key={i} className={i < pin.length ? "on" : ""} />)}</div>
        <div className="ug-lock-msg" role="alert">{msg}</div>
        <div className="ug-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(k => <button key={k} onClick={() => press(k)}>{k}</button>)}
          <span />
          <button onClick={() => press("0")}>0</button>
          <button aria-label="Delete" onClick={() => press("del")}>⌫</button>
        </div>
        {mode === "unlock" ? <button className="ug-lock-link" onClick={onForgot}>Forgot PIN? Sign out and sign back in</button>
          : <button className="ug-lock-link" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
function LockSettings() {
  const [on, setOn] = useState(pinOn()); const [setting, setSetting] = useState(false);
  return (
    <div className="box">
      <div className="caps mute">App lock</div>
      <p className="mute small">{on ? "PIN is on for this device. It's asked when the app opens, and after a minute away." : "Ask for a 4-digit PIN when the app opens on this device, so nobody else can see your money."}</p>
      <div className="minis">
        <button className="chip-btn solid2" onClick={() => setSetting(true)}>{on ? "Change PIN" : "Set a PIN"}</button>
        {on && <button className="chip-btn" onClick={() => { lsSet(PIN_KEY, ""); setOn(false); Sound.back(); }}>Turn lock off</button>}
      </div>
      {setting && <PinPad mode="set" onDone={() => { setSetting(false); setOn(true); }} onCancel={() => setSetting(false)} />}
    </div>
  );
}

/* ---------- monthly report card: race-results screen ---------- */
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const RANK_MSG = {
  S: "Perfect run, master. That's how champions drive.",
  A: "Strong month. Clean up one thing and it's an S.",
  B: "Solid. You stayed on the road. Cleaner lines next month.",
  C: "Rough month. It happens. Refuel, reset, go again.",
};
function monthReport(d, settings, key, today) {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1), end = new Date(y, m, 0), days = end.getDate();
  const live = key === ym(today), upto = live ? today : end, sofar = live ? today.getDate() : days;
  const inKey = s => String(s || "").slice(0, 7) === key;
  const due = d.sched.filter(r => isOblig(r) && inKey(r.month_date) && rowDate(r) <= upto);
  const onTime = due.filter(r => r.is_cleared && (!r.paid_on || parseDate(r.paid_on) <= rowDate(r)));
  const spend = d.spend.filter(s => inKey(s.spent_on)).reduce((a, s) => a + Number(s.amount), 0);
  const budget = Number(settings.budget) || 0;
  const studyMin = d.study.filter(s => inKey(s.studied_on)).reduce((a, s) => a + s.minutes, 0);
  const sStart = parseDate(settings.studyStart || "2099-01-01");
  const studyDays = sStart > upto ? 0 : diffDays(upto, sStart > start ? sStart : start) + 1;
  const target = (Number(settings.studyTarget) || 240) * studyDays / 7;
  const since = parseDate(d.state.trading_free_since || ymd(today));
  const free = since > upto ? 0 : Math.min(sofar, diffDays(upto, since > start ? since : start) + 1);
  const paid = d.sched.filter(r => r.is_cleared && isOblig(r) && inKey(r.paid_on || r.month_date)).reduce((a, r) => a + Number(r.amount_due), 0);
  const moves = d.moves.filter(x => inKey(ymd(new Date(x.created_at))) && Number(x.amount) > 0);
  const inv = investInfo(d, today);
  const invested = inv.pot ? moves.filter(x => x.pot_id === inv.pot.id).reduce((a, x) => a + Number(x.amount), 0) : 0;
  const saved = moves.reduce((a, x) => a + Number(x.amount), 0) - invested;
  const ms = d.ms.filter(x => x.done && x.done_at && inKey(ymd(new Date(x.done_at)))).map(x => x.title);
  const hrs = v => (v / 60).toFixed(v % 60 ? 1 : 0);
  const rows = [
    { k: "bills", l: "Bills paid on time", v: `${onTime.length} / ${due.length}`, p: due.length ? onTime.length / due.length : null, w: 30 },
    { k: "free", l: "Trading-free days", v: `${free} / ${sofar}`, p: free / sofar, w: 30 },
    { k: "budget", l: "Spent vs budget", v: `${fmt(spend)} / ${fmt(budget)}`, p: budget ? (spend <= budget ? 1 : Math.max(0, 1 - (spend - budget) / budget)) : null, w: 25 },
    { k: "study", l: "Study hours", v: `${hrs(studyMin)} / ${hrs(target)} h`, p: studyDays ? Math.min(1, studyMin / Math.max(1, target)) : null, w: 15 },
  ];
  const hb = habitScore(settings, key, today);
  rows.push({ k: "habits", l: "Daily habits kept", v: hb ? `${hb.did} / ${hb.can}` : "", p: hb ? hb.did / hb.can : null, w: 15 });
  const scored = rows.filter(r => r.p != null), tw = scored.reduce((a, r) => a + r.w, 0);
  const score = tw ? scored.reduce((a, r) => a + r.p * r.w, 0) / tw : 1;
  const rank = score >= .95 ? "S" : score >= .8 ? "A" : score >= .6 ? "B" : "C";
  const weak = scored.filter(r => r.p < 1).sort((a, b) => a.p * a.w - b.p * b.w)[0];
  return { key, live, rank, score: Math.round(score * 100), rows, paid, saved, invested, ms, weak: weak ? weak.l : null };
}
/* what gets frozen once a month is over */
const snapReport = r => ({ rank: r.rank, score: r.score, rows: r.rows.map(x => [x.k, x.l, x.v, x.p == null ? null : Math.round(x.p * 100) / 100, x.w]), paid: r2(r.paid), saved: r2(r.saved), invested: r2(r.invested), ms: r.ms, weak: r.weak });
const unsnap = (key, s) => ({ key, live: false, rank: s.rank, score: s.score, rows: s.rows.map(([k, l, v, p, w]) => ({ k, l, v, p, w })), paid: s.paid || 0, saved: s.saved || 0, invested: s.invested || 0, ms: s.ms || [], weak: s.weak || null });

function ReportCard({ rep, onClose, onPrev, onNext }) {
  useEffect(() => {
    const t = setTimeout(() => { if (rep.rank === "S" || rep.rank === "A") Sound.win(); else Sound.select(); buzz([20, 40, 60]); }, CALM ? 0 : 1500);
    const k = e => { if (e.key === "Escape" || e.key === "Enter") onClose(); else if (e.key === "ArrowLeft" && onPrev) onPrev(); else if (e.key === "ArrowRight" && onNext) onNext(); };
    addEventListener("keydown", k); return () => { clearTimeout(t); removeEventListener("keydown", k); };
  }, [rep.key]);
  const [y, m] = rep.key.split("-");
  const hi = [rep.paid > 0 && ["Debt & bills paid", fmt(rep.paid)], rep.saved > 0 && ["Into savings", fmt(rep.saved)], rep.invested > 0 && ["Invested", fmt(rep.invested)]].filter(Boolean);
  return (
    <div className="ug-rep" role="dialog" aria-modal="true" aria-label={`Report card ${monthLong(rep.key)}`} key={rep.key}>
      <div className="ug-rep-in">
        <div className="ug-rep-head">
          {onPrev ? <button className="ug-arrow l" aria-label="Previous month" onClick={onPrev}>‹</button> : <span />}
          <div>
            <div className="ug-hud">{rep.live ? "This month so far" : "Month results"}</div>
            <div className="ug-t chrome ug-rep-m">{MONTH_FULL[Number(m) - 1]} <small>{y}</small></div>
          </div>
          {onNext ? <button className="ug-arrow r" aria-label="Next month" onClick={onNext}>›</button> : <span />}
        </div>
        <div className={"ug-rank r-" + rep.rank} aria-label={`Rank ${rep.rank}, ${rep.score} percent`}><b>{rep.rank}</b><span>{rep.score}%</span></div>
        <div className="ug-rep-rows">
          {rep.rows.map((r, i) => (
            <div key={r.k} className={"ug-rep-row" + (r.p == null ? " na" : r.p >= 1 ? " ok" : "")} style={{ animationDelay: (CALM ? 0 : .25 + i * .22) + "s" }}>
              <div className="ug-stat"><span>{r.l}</span><b>{r.p == null ? "—" : r.v}</b></div>
              {r.p == null ? <div className="ug-hud">Not counted this month</div> : <Segs p={r.p * 100} c={r.p >= 1 ? "gr" : "cy"} />}
            </div>
          ))}
        </div>
        {(hi.length > 0 || rep.ms.length > 0) && <div className="ug-rep-hi">
          {hi.map(([l, v]) => <div key={l}><span className="ug-hud">{l}</span><b>{v}</b></div>)}
          {rep.ms.map(t => <div key={t} className="ms"><span className="gr">★</span> {t}</div>)}
        </div>}
        <p className="ug-rep-msg">{RANK_MSG[rep.rank]}{rep.weak && rep.rank !== "S" ? <> Focus next: <b>{rep.weak.toLowerCase()}</b>.</> : null}</p>
        <button className="ug-btn" onClick={onClose}>Continue <span className="key">A</span></button>
      </div>
    </div>
  );
}

/* ---------------- data store: live, cached for offline, queued writes ---------------- */
function useStore(session) {
  const first = useRef(readCache());
  const [d, setD] = useState(first.current ? first.current.d : null);
  const [cacheAt, setCacheAt] = useState(first.current ? first.current.at : null);
  const [status, setStatus] = useState("");
  const [queued, setQueued] = useState(readQueue().length);
  const load = useCallback(async () => {
    try {
      const r = await Promise.all([
        sb.from("cashflow_schedule").select("*").order("month_date").order("due_day"),
        sb.from("wealth_portfolio").select("*"),
        sb.from("ascent_tasks").select("*").order("due_date", { nullsFirst: true }),
        sb.from("ascent_spend").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
        sb.from("ascent_study").select("*"),
        sb.from("ascent_state").select("*").eq("id", 1).maybeSingle(),
        sb.from("ascent_milestones").select("*").order("sort"),
        sb.from("ascent_pot_moves").select("*").order("created_at", { ascending: false }),
        sb.from("liabilities").select("name,type,is_active"),
      ]);
      const bad = r.find(x => x.error);
      if (bad) {
        const m = bad.error.message || "";
        if (isNetErr(bad.error)) { setStatus("offline"); return; }
        const setup = /pot_moves|does not exist|schema cache|column/i.test(m);
        setStatus(setup ? "setup" : "Couldn't load: " + m);
        if (!/pot_moves/.test(m)) return;
      } else setStatus("");
      const nd = {
        sched: r[0].data || [], pots: (r[1].data || []).slice().sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99)),
        tasks: r[2].data || [], spend: r[3].data || [], study: r[4].data || [],
        state: r[5].data || { id: 1, trading_free_since: ymd(new Date()), settings: {} }, ms: r[6].data || [],
        moves: r[7].data || [], libs: r[8].data || [],
      };
      const at = Date.now(); setD(nd); setCacheAt(at); lsSet(CKEY, JSON.stringify({ at, d: nd }));
    } catch (e) { setStatus(isNetErr(e) ? "offline" : "Couldn't load: " + e.message); }
  }, []);
  const flush = useCallback(async () => {
    let q = readQueue(); if (!q.length) return;
    while (q.length) {
      try { await exec(q[0]); q = q.slice(1); saveQueue(q); }
      catch (e) { if (e.net) break; q = q.slice(1); saveQueue(q); }
    }
    setQueued(q.length);
  }, []);
  const write = useCallback(async ops => {
    const push = rest => { const q = [...readQueue(), ...rest]; saveQueue(q); setQueued(q.length); return "queued"; };
    if (!navigator.onLine) return push(ops);
    for (let i = 0; i < ops.length; i++) {
      try { await exec(ops[i]); } catch (e) { if (e.net) return push(ops.slice(i)); throw e; }
    }
    return "ok";
  }, []);
  useEffect(() => {
    if (!session) return;
    (async () => { await flush(); await load(); })();
    const on = async () => { await flush(); await load(); };
    addEventListener("online", on);
    const vis = () => { if (!document.hidden) on(); };
    document.addEventListener("visibilitychange", vis);
    return () => { removeEventListener("online", on); document.removeEventListener("visibilitychange", vis); };
  }, [session]);
  useEffect(() => { if (d) lsSet(CKEY, JSON.stringify({ at: cacheAt || Date.now(), d })); }, [d]);
  return { d, setD, status, setStatus, cacheAt, queued, load, write };
}

/* ---------------- main app ---------------- */
function Main({ session, mode, setMode }) {
  const { d, setD, status, cacheAt, queued, load, write } = useStore(session);
  const firstToday = lsGet("ascent-loader-day", "") !== ymd(new Date());
  const quick = useRef(new URLSearchParams(location.search).get("do")); // home-screen shortcut: ?do=spend | ?do=urge
  const viaShortcut = useRef(!!quick.current);
  const [loaded, setLoaded] = useState(!!quick.current || !(firstToday && MOTION !== "off"));
  const [menu, setMenu] = useState(false);
  const [sound, setSound] = useState(Sound.on);
  const [sheet, setSheet] = useState(null);
  const [party, setParty] = useState(null);
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState("");
  const [hideNav, setHideNav] = useState(false);
  const [tm, setTm] = useState(0);
  const [newTask, setNewTask] = useState(""); const [newDue, setNewDue] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [aiOpen, setAiOpen] = useState(false); const [aiSeed, setAiSeed] = useState(null);
  const [guide, setGuide] = useState(false);
  const [aiState, setAiState] = useState(lsGet("ascent-ai", "unknown"));
  const [urge, setUrge] = useState(false);
  const [world, setWorld] = useState(() => { const w = lsGet("ascent-world", "money"); return WORLDS.some(x => x.id === w) ? w : "money"; });
  const [portal, setPortal] = useState(null);
  const [view, setView] = useState(quick.current ? "world" : "hub"); // the main menu shows on every open, except home-screen shortcuts
  const [wipe, setWipe] = useState(null);
  const [report, setReport] = useState(null); // "YYYY-MM" of the report card being shown
  const [tab, setTabRaw] = useState(() => lsGet("ascent-tab-" + world, ""));
  const tabs = UG_TABS[world] || UG_TABS.money;
  const curTab = tabs.some(t => t[0] === tab) ? tab : tabs[0][0];
  const pagesRef = useRef(null);
  const setTab = (id, quiet) => { if (id === curTab) return; if (!quiet) { Sound.move(); buzz(6); } const dir = tabs.findIndex(t => t[0] === id) > tabs.findIndex(t => t[0] === curTab) ? 1 : -1; if (pagesRef.current) { pagesRef.current.style.setProperty("--dir", dir); pagesRef.current.scrollTop = 0; } setTabRaw(id); lsSet("ascent-tab-" + world, id); };
  useEffect(() => { const el = pagesRef.current; if (!el || CALM) return; el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }, [curTab, world, view]);
  useLayoutEffect(() => { const h = document.documentElement; h.setAttribute("data-world", "ug"); h.setAttribute("data-stage", view === "hub" ? "menu" : world); lsSet("ascent-world", world); }, [world, view]);
  const goHub = () => { buzz(10); Sound.back(); setMenu(false); setWipe({ title: "Garage", sub: "ホーム · main menu", mid: () => { setView("hub"); } }); };
  const enterStage = c => { buzz(14); Sound.select(); setWipe({ title: c.t, sub: c.jp + " · loading stage", mid: () => { setWorld(c.k); setView("world"); setTm(0); } }); };
  const goWorld = (id, x, y, then) => {
    setMenu(false);
    if (view === "world" && id === world) { if (then) then(); return; }
    const c = { money: ["Money", "お金"], invest: ["Invest", "投資"], career: ["Career", "仕事"], life: ["Life", "人生"] }[id];
    buzz(12); Sound.select();
    setWipe({ title: c[0], sub: c[1] + " · loading stage", mid: () => { setWorld(id); setView("world"); if (then) setTimeout(then, 60); } });
  };
  useEffect(() => {
    if (!d || !quick.current) return;
    const q = quick.current; quick.current = null;
    // Inside the installed app, tidy the address. In a normal browser tab keep ?do= so "Add to Home Screen" saves the shortcut.
    if (matchMedia("(display-mode: standalone)").matches) { try { history.replaceState(null, "", location.pathname); } catch (e) {} }
    if (q === "spend") { setWorld("money"); setSheet({ type: "spend" }); } else if (q === "urge") setUrge(true);
  }, [d]);
  useEffect(() => {
    if (view !== "world") return;
    const k = e => { if (/input|textarea|select/i.test(e.target.tagName) || sheet || urge || guide || aiOpen || report || document.querySelector(".ug-lock")) return;
      const i = tabs.findIndex(t => t[0] === curTab);
      if ((e.key === "ArrowRight" || e.key === "e") && tabs[i + 1]) setTab(tabs[i + 1][0]);
      else if ((e.key === "ArrowLeft" || e.key === "q") && tabs[i - 1]) setTab(tabs[i - 1][0]);
      else if (e.key === "Escape" && !menu) goHub(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });
  /* phone back button: close what's open, then go back to the main menu, then (twice) leave */
  const backRef = useRef(null); const closeRepRef = useRef(null);
  backRef.current = () => {
    if (report) { closeRepRef.current ? closeRepRef.current() : setReport(null); return true; }
    if (urge) { setUrge(false); return true; }
    if (aiOpen) { setAiOpen(false); return true; }
    if (guide) { setGuide(false); return true; }
    if (sheet) { setSheet(null); return true; }
    if (menu) { setMenu(false); return true; }
    if (view === "world") { goHub(); return true; }
    return false;
  };
  useEffect(() => {
    const arm = () => { try { if (!history.state || !history.state.ascent) history.pushState({ ascent: 1 }, ""); } catch (e) {} };
    arm();
    let exitTry = 0;
    const pop = () => {
      if (document.querySelector(".ug-lock")) { arm(); return; }
      if (backRef.current && backRef.current()) { arm(); return; }
      if (Date.now() - exitTry > 2500) { exitTry = Date.now(); setToast("Press back again to exit"); setTimeout(() => setToast(t => t === "Press back again to exit" ? "" : t), 2400); arm(); return; }
      history.back();
    };
    addEventListener("popstate", pop); return () => removeEventListener("popstate", pop);
  }, []);
  const [showDone, setShowDone] = useState(false); const [showLater, setShowLater] = useState(false);
  const [msAsk, setMsAsk] = useState(null);
  const [histN, setHistN] = useState(6);
  const cashRef = useRef(null);
  useReveal((d ? "y" : "n") + world);

  useEffect(() => {
    let last = scrollY, ticking = false, hideR = false, actR = "";
    const run = () => {
      ticking = false;
      const y = scrollY, hide = y > last + 2 ? y > 300 : y < last - 2 ? false : hideR; last = y;
      if (hide !== hideR) { hideR = hide; setHideNav(hide); }
      let cur = ""; ["week", "ascent", "debts", "history", "grove", "badges", "rules", "study", "path", "todo", "employers", "streak", "family", "milestones"].forEach(id => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < innerHeight * .4) cur = id; });
      if (cur !== actR) { actR = cur; setActive(cur); }
    };
    const on = () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } };
    addEventListener("scroll", on, { passive: true }); return () => removeEventListener("scroll", on);
  }, []);

  /* is the Claude assistant switched on? */
  const checkAi = useCallback(async () => {
    try {
      const { data, error } = await sb.functions.invoke("claude", { body: { ping: true } });
      const s = error ? "off" : data && data.configured ? "ready" : "nokey";
      setAiState(s); lsSet("ascent-ai", s); lsSet("ascent-ai-at", String(Date.now())); return s;
    } catch (e) { setAiState("off"); return "off"; }
  }, []);
  useEffect(() => { if (Date.now() - Number(lsGet("ascent-ai-at", "0")) > 6 * 3600 * 1000 && navigator.onLine) checkAi(); }, []);

  const toastT = useRef(0), undoT = useRef(0);
  const flash = m => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2600); };
  const showUndo = (msg, fn) => { setUndo({ msg, fn, id: Date.now() }); clearTimeout(undoT.current); undoT.current = setTimeout(() => setUndo(null), 7000); };
  const fail = e => { setErr("Didn't save: " + (e?.message || "check your connection") + "."); setTimeout(() => setErr(""), 5000); load(); };
  const commit = async ops => {
    try { const r = await write(ops); if (r === "queued") flash("Saved on your phone. It syncs when you have signal."); return true; }
    catch (e) { fail(e); return false; }
  };

  const settings = { ...DEFAULT_SETTINGS, ...((d && d.state && d.state.settings) || {}) };
  fillMe(settings);
  const today = startOfDay(new Date());
  cashRef.current = d && d.state && d.state.cash_balance != null ? Number(d.state.cash_balance) : null;
  const cashOps = delta => {
    if (cashRef.current == null || !delta) return [];
    const v = r2(cashRef.current + delta); cashRef.current = v;
    setD(x => ({ ...x, state: { ...x.state, cash_balance: v } }));
    return [{ t: "update", table: "ascent_state", patch: { cash_balance: v }, f: [["eq", "id", 1]] }];
  };

  /* ----- everything derived ----- */
  const calc = useMemo(() => {
    if (!d) return null;
    const monthKey = ym(today);
    const sched = d.sched.map(r => ({ ...r, _dt: rowDate(r) }));
    const out = sched.filter(isOblig), inc = sched.filter(r => !isOblig(r)); // everything you pay
    const obl = out.filter(r => !isRecurring(r));                                  // debts only (bills + parents aren't debt)
    const A = r => Number(r.amount_due);
    const totalAll = obl.reduce((s, r) => s + A(r), 0) || 1;
    const remaining = obl.filter(r => !r.is_cleared).reduce((s, r) => s + A(r), 0);
    const ents = {};
    obl.forEach(r => {
      const e = ents[r.entity_name] || (ents[r.entity_name] = { name: r.entity_name, cat: r.category, rows: [], left: 0, total: 0, last: "" });
      e.rows.push(r); e.total += A(r); if (!r.is_cleared) { e.left += A(r); if (r.month_date > e.last) e.last = r.month_date; }
    });
    Object.values(ents).forEach(e => e.rows.sort((a, b) => a._dt - b._dt));
    const debts = Object.values(ents).filter(e => e.cat !== "Telco").sort((a, b) => (a.left < .005) - (b.left < .005) || a.left - b.left);
    const phones = Object.values(ents).filter(e => e.cat === "Telco").sort((a, b) => a.name.localeCompare(b.name));
    const phoneLeft = phones.reduce((s, e) => s + e.left, 0), phoneTotal = phones.reduce((s, e) => s + e.total, 0);
    const phoneLast = phones.reduce((m, e) => e.last > m ? e.last : m, "");
    const personal = new Set(d.libs.filter(l => /personal/i.test(l.type || "")).map(l => l.name));
    const creditLeft = debts.filter(e => !personal.has(e.name)).reduce((s, e) => s + e.left, 0);
    const potsSum = d.pots.reduce((s, p) => s + (Number(p.balance) || 0), 0);
    const emergency = d.pots.find(p => /emergency/i.test(p.name));
    const s1 = creditLeft < .005, s2 = s1 && remaining < .005, s3 = s2 && !!emergency && !!emergency.goal && Number(emergency.balance) >= Number(emergency.goal), s4 = s3 && !!settings.stage4Done;
    const stageIdx = !s1 ? 0 : !s2 ? 1 : !s3 ? 2 : !s4 ? 3 : 4;
    const upcomingPay = inc.filter(r => !r.is_cleared && r._dt >= addDays(today, -5)).sort((a, b) => a._dt - b._dt);
    const nextPay = upcomingPay[0];
    const payDate = nextPay ? (nextPay._dt < today ? today : nextPay._dt) : addDays(today, 30);
    const dueBefore = out.filter(r => !r.is_cleared && r._dt < payDate).reduce((s, r) => s + A(r), 0);
    const cash = d.state.cash_balance == null ? null : Number(d.state.cash_balance);
    const safe = cash == null ? null : cash - dueBefore;
    const daysToPay = Math.max(1, diffDays(payDate, today));
    const end = addDays(today, 7);
    const week = [];
    sched.forEach(r => {
      const late = !r.is_cleared && r._dt < today, inWin = r._dt >= today && r._dt <= end, recentDone = r.is_cleared && r._dt >= addDays(today, -3) && r._dt <= end;
      if (late || inWin || recentDone) week.push({ kind: isOblig(r) ? "bill" : "income", id: r.id, row: r, date: r._dt, late, done: r.is_cleared, title: r.category === "Parents" ? "Give " + r.entity_name : isOblig(r) ? "Pay " + r.entity_name : (r.entity_name === "Inflow" ? "Allowance arrives" : r.entity_name), amt: A(r) });
    });
    const tasksOpen = d.tasks.filter(t => !t.done), tasksDone = d.tasks.filter(t => t.done).sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));
    tasksOpen.forEach(t => { const dt = t.due_date ? parseDate(t.due_date) : null; if (!dt || dt <= end) week.push({ kind: "task", id: t.id, row: t, date: dt, late: dt && dt < today, done: false, title: t.title }); });
    tasksDone.forEach(t => { if (t.done_at && diffDays(today, new Date(t.done_at)) <= 1) week.push({ kind: "task", id: t.id, row: t, date: t.due_date ? parseDate(t.due_date) : null, late: false, done: true, title: t.title }); });
    week.sort((a, b) => (a.done - b.done) || ((a.date ? +a.date : 0) - (b.date ? +b.date : 0)));
    const later = tasksOpen.filter(t => t.due_date && parseDate(t.due_date) > end);
    const soon = sched.filter(r => !r.is_cleared && r._dt > end && r._dt <= addDays(end, 30)).sort((a, b) => a._dt - b._dt);
    const spentMonth = d.spend.filter(s => s.spent_on.slice(0, 7) === monthKey);
    const spentTotal = spentMonth.reduce((s, x) => s + Number(x.amount), 0);
    const byCat = {}; spentMonth.forEach(s => byCat[s.category] = (byCat[s.category] || 0) + Number(s.amount));
    const mon = addDays(today, -((today.getDay() + 6) % 7));
    const studyWeek = d.study.filter(s => parseDate(s.studied_on) >= mon).reduce((s, x) => s + x.minutes, 0);
    const streak = Math.max(1, diffDays(today, parseDate(d.state.trading_free_since || ymd(today))) + 1);
    // time machine
    const lastKey = sched.reduce((m, r) => r.month_date.slice(0, 7) > m ? r.month_date.slice(0, 7) : m, monthKey);
    const endKey = [lastKey, ym(addMonths(today, 24))].sort()[1];
    const months = []; for (let i = 0; ; i++) { const k = ym(addMonths(today, i)); months.push(k); if (k >= endKey || i > 400) break; }
    const lastIncKey = inc.reduce((m, r) => r.month_date.slice(0, 7) > m ? r.month_date.slice(0, 7) : m, "");
    const incAmt = settings.income ? settings.income.amount : (inc.length ? A(inc[inc.length - 1]) : 0);
    const leftAfter = key => obl.filter(r => !r.is_cleared && r.month_date.slice(0, 7) > key).reduce((s, r) => s + A(r), 0);
    const proj = {}; let run = potsSum + (cash || 0);
    months.forEach(k => {
      const cur = k === monthKey;
      const iM = inc.filter(r => r.month_date.slice(0, 7) === k && (!cur || !r.is_cleared)).reduce((s, r) => s + A(r), 0) || (k > lastIncKey ? incAmt : 0);
      const oM = out.filter(r => r.month_date.slice(0, 7) === k && !r.is_cleared).reduce((s, r) => s + A(r), 0);
      const live = cur ? Math.max(0, settings.budget - spentTotal) : settings.budget + settings.guiltFree;
      run += iM - oM - live; proj[k] = run;
    });
    const events = {};
    debts.forEach(e => { if (e.left > .005) (events[e.last.slice(0, 7)] = events[e.last.slice(0, 7)] || []).push(e.name + " cleared"); });
    if (phoneLeft > .005) (events[phoneLast.slice(0, 7)] = events[phoneLast.slice(0, 7)] || []).push("Phone contracts done");
    d.ms.forEach(m => { if (!m.done && m.target_date) { const k = String(m.target_date).slice(0, 7); (events[k] = events[k] || []).push(m.title.split(":")[0]); } });
    // history
    const H = {};
    const h = k => H[k] || (H[k] = { key: k, paid: 0, income: 0, spend: 0, byCat: {}, study: 0, saved: 0, out: 0, n: 0 });
    sched.forEach(r => { if (!r.is_cleared) return; const k = (r.paid_on || r.month_date).slice(0, 7); if (k > monthKey) return; const x = h(k); if (isOblig(r)) x.paid += A(r); else x.income += A(r); x.n++; });
    d.spend.forEach(s => { const x = h(s.spent_on.slice(0, 7)); x.spend += Number(s.amount); x.byCat[s.category] = (x.byCat[s.category] || 0) + Number(s.amount); });
    d.study.forEach(s => { h(s.studied_on.slice(0, 7)).study += s.minutes; });
    d.moves.forEach(m => { const x = h(ymd(new Date(m.created_at)).slice(0, 7)); if (Number(m.amount) > 0) x.saved += Number(m.amount); else x.out -= Number(m.amount); });
    const history = Object.values(H).filter(x => x.key <= monthKey).sort((a, b) => b.key.localeCompare(a.key));
    return { monthKey, out, obl, inc, ents, debts, phones, phoneLeft, phoneTotal, phoneLast, totalAll, remaining, creditLeft, potsSum, stageIdx, nextPay, payDate, dueBefore, cash, safe, daysToPay, week, later, tasksDone, soon, spentTotal, byCat, studyWeek, streak, months, leftAfter, proj, events, history, netWorth: potsSum + (cash || 0) - remaining };
  }, [d]);

  /* ----- keep the allowance going forward, month after month ----- */
  const incomeGuard = useRef(false);
  useEffect(() => {
    if (!d || !calc || incomeGuard.current || status === "offline" || !navigator.onLine) return;
    const flows = d.sched.filter(r => r.category === "Income" && r.entity_name === "Inflow").sort((a, b) => a.month_date.localeCompare(b.month_date));
    const base = settings.income || (flows.length ? { amount: Number(flows[flows.length - 1].amount_due), day: flows[flows.length - 1].due_day || 10 } : null);
    if (!base) return;
    incomeGuard.current = true;
    const bad = flows.filter(r => !r.is_cleared && r.month_date < "2026-10-01");       // allowance only started with NS
    if (bad.length) {
      setD(x => ({ ...x, sched: x.sched.filter(r => !bad.some(b => b.id === r.id)) }));
      write(bad.map(b => ({ t: "delete", table: "cashflow_schedule", f: [["eq", "id", b.id]] }))).catch(() => {});
    }
    const lastKey = flows.length ? flows[flows.length - 1].month_date.slice(0, 7) : ym(addMonths(today, -1));
    const target = ym(addMonths(today, 12)), rows = [];
    for (let i = 1; i < 400; i++) { const k = ym(addMonths(parseDate(lastKey + "-01"), i)); if (k > target) break; rows.push({ id: uid(), month_date: k + "-01", entity_name: "Inflow", category: "Income", amount_due: base.amount, is_cleared: false, due_day: base.day }); }
    if (!rows.length) return;
    setD(x => ({ ...x, sched: [...x.sched, ...rows] }));
    write([{ t: "insert", table: "cashflow_schedule", row: rows }]).catch(() => {});
  }, [d, calc]);

  /* ----- milestones that tick themselves ----- */
  const autoBusy = useRef(false);
  const ruleMet = rule => {
    const [k, a, b] = String(rule).split(":");
    if (k === "debt" && a === "all") return calc.remaining < .005 && calc.totalAll > 1;
    if (k === "debt") { const e = Object.values(calc.ents).find(x => x.name.toLowerCase().startsWith(a.toLowerCase())); return !!e && e.total > 0 && e.left < .005; }
    if (k === "credit") return calc.creditLeft < .005 && calc.debts.length > 0;
    if (k === "pot") { const p = d.pots.find(x => x.name.toLowerCase().includes(a.toLowerCase())); return !!p && Number(p.balance) >= Number(b); }
    if (k === "savings") return calc.potsSum >= Number(a);
    return false;
  };
  const msParty = (m, x, y) => { const words = m.title.split(":")[0].split(" "); const half = Math.ceil(words.length / 2); return { x, y, kicker: "MILESTONE" + (m.target_label ? " · " + m.target_label.toUpperCase() : ""), line1: words.slice(0, half).join(" ").toUpperCase(), line2: (words.slice(half).join(" ") || "DONE.").toUpperCase(), text: m.title }; };
  useEffect(() => {
    if (!d || !calc || autoBusy.current) return;
    const hit = d.ms.find(m => !m.done && m.auto_rule && ruleMet(m.auto_rule));
    if (!hit) return;
    autoBusy.current = true;
    const patch = { done: true, done_at: new Date().toISOString() };
    setD(x => ({ ...x, ms: x.ms.map(y => y.id === hit.id ? { ...y, ...patch } : y) }));
    write([{ t: "update", table: "ascent_milestones", patch, f: [["eq", "id", hit.id]] }]).catch(() => {}).finally(() => { autoBusy.current = false; });
    setTimeout(() => setParty(p => p || msParty(hit, innerWidth / 2, innerHeight / 2)), 1200);
  }, [d, calc]);

  /* keep 12 months of bill + parents rows ahead */
  const recurSig = useRef("");
  useEffect(() => {
    if (!d || !calc || status === "offline" || !navigator.onLine) return;
    const st = { ...DEFAULT_SETTINGS, ...((d.state && d.state.settings) || {}) };
    const sig = JSON.stringify([st.bills || [], st.parents || null, ym(today), d.sched.length]);
    if (recurSig.current === sig) return; recurSig.current = sig;
    const rows = recurringRowsNeeded(d.sched, st, today);
    if (!rows.length) return;
    setD(x => ({ ...x, sched: [...x.sched, ...rows] }));
    write([{ t: "insert", table: "cashflow_schedule", row: rows }]).catch(() => {});
  }, [d, calc]);

  /* new month: show last month's report card once */
  const repGuard = useRef(false);
  useEffect(() => {
    if (!d || !calc || !loaded || repGuard.current || viaShortcut.current) return;
    repGuard.current = true;
    const prev = ym(addMonths(today, -1));
    if ((settings.reports || {})[prev] || !calc.history.some(h => h.key === prev)) return;
    setTimeout(() => setReport(prev), 800);
  }, [d, calc, loaded]);

  if (!d || !calc) return (
    <>{!loaded && <Loader jdm ready={false} onDone={() => {}} />}
      {status && <div className="status">{status === "offline" ? "No connection, and nothing saved on this phone yet. Connect once to load your data." : status === "setup" ? "Almost there: run supabase-v2.sql in Supabase, then reload." : status}</div>}</>
  );

  /* ----- actions ----- */
  const localRow = (id, patch) => setD(x => ({ ...x, sched: x.sched.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const clearedParty = (name, total, x, y) => setTimeout(() => setParty({ x, y, kicker: "DEBT CLEARED · " + monthLabel(calc.monthKey), line1: name.toUpperCase(), line2: "GONE.", text: `${fmt(total, 2)} paid off. Remember this feeling.` }), 700);
  const act = {
    toggleRow: async (r, ev, silent) => {
      const next = !r.is_cleared, amt = Number(r.amount_due), patch = { is_cleared: next, paid_on: next ? ymd(today) : null };
      localRow(r.id, patch);
      const delta = isOblig(r) ? (next ? -amt : amt) : (next ? amt : -amt);
      const ok = await commit([{ t: "update", table: "cashflow_schedule", patch, f: [["eq", "id", r.id]] }, ...cashOps(delta)]);
      if (!ok || silent) return;
      if (next) {
        Sound.check(); buzz(15);
        showUndo(isOblig(r) ? `${r.entity_name} ${fmt(amt, 2)} marked paid` : `+${fmt(amt, 2)} received`, () => act.toggleRow({ ...r, ...patch }, null, true));
        if (isOblig(r)) {
          const e = calc.ents[r.entity_name]; const left = e ? e.rows.filter(x => x.id !== r.id && !x.is_cleared).reduce((s, x) => s + Number(x.amount_due), 0) : 1;
          if (left < .005 && e) clearedParty(r.entity_name, e.total, ev ? ev.clientX : innerWidth / 2, ev ? ev.clientY : innerHeight / 2);
        } else {
          const after = calc.inc.filter(x => !x.is_cleared && x._dt > rowDate(r)).sort((a, b) => a._dt - b._dt)[0];
          const until = after ? after._dt : addDays(today, 30);
          const bills = calc.obl.filter(x => !x.is_cleared && x._dt < until).reduce((s, x) => s + Number(x.amount_due), 0);
          setTimeout(() => setSheet({ type: "payday", amount: amt, bills, nextDate: after ? after._dt : null }), 500);
        }
      } else if (!silent) flash("Marked as not paid");
    },
    payExtra: async (entity, x) => {
      const e = calc.ents[entity]; if (!e) return;
      const unpaid = e.rows.filter(r => !r.is_cleared).slice().reverse();
      const extraRow = { id: uid(), month_date: calc.monthKey + "-01", entity_name: entity, category: e.cat, amount_due: x, is_cleared: true, due_day: today.getDate(), paid_on: ymd(today), note: "Extra payment" };
      const ops = [{ t: "insert", table: "cashflow_schedule", row: extraRow }]; let rest = x; const dels = [], ups = {};
      for (const r of unpaid) { if (rest < .005) break; const a = Number(r.amount_due); if (a <= rest + .005) { dels.push(r.id); rest = r2(rest - a); ops.push({ t: "delete", table: "cashflow_schedule", f: [["eq", "id", r.id]] }); } else { ups[r.id] = r2(a - rest); ops.push({ t: "update", table: "cashflow_schedule", patch: { amount_due: r2(a - rest) }, f: [["eq", "id", r.id]] }); rest = 0; } }
      setD(s => ({ ...s, sched: [...s.sched.filter(r => !dels.includes(r.id)).map(r => ups[r.id] != null ? { ...r, amount_due: ups[r.id] } : r), extraRow] }));
      if (await commit([...ops, ...cashOps(-x)])) { Sound.check(); flash(`Extra ${fmt(x, 2)} recorded. ${entity} finishes sooner.`); if (x >= e.left - .005) clearedParty(entity, e.total, innerWidth / 2, innerHeight / 2); }
    },
    payOff: async entity => {
      const e = calc.ents[entity]; if (!e) return; const ids = e.rows.filter(r => !r.is_cleared).map(r => r.id); const patch = { is_cleared: true, paid_on: ymd(today) };
      setD(s => ({ ...s, sched: s.sched.map(r => ids.includes(r.id) ? { ...r, ...patch } : r) }));
      if (await commit([...ids.map(id => ({ t: "update", table: "cashflow_schedule", patch, f: [["eq", "id", id]] })), ...cashOps(-e.left)])) clearedParty(entity, e.total, innerWidth / 2, innerHeight / 2);
    },
    editRow: async (r, amount, dateStr) => {
      const dt = parseDate(dateStr), patch = { amount_due: r2(amount), month_date: ym(dt) + "-01", due_day: dt.getDate() };
      localRow(r.id, patch);
      if (await commit([{ t: "update", table: "cashflow_schedule", patch, f: [["eq", "id", r.id]] }, ...(r.is_cleared ? cashOps(-(r2(amount) - Number(r.amount_due))) : [])])) flash("Payment updated");
    },
    bulkDates: async list => { // [[row, "YYYY-MM-DD"], ...]
      const patches = list.map(([r, ds]) => { const dt = parseDate(ds); return [r.id, { month_date: ym(dt) + "-01", due_day: dt.getDate() }]; });
      const P = Object.fromEntries(patches);
      setD(x => ({ ...x, sched: x.sched.map(r => P[r.id] ? { ...r, ...P[r.id] } : r) }));
      if (await commit(patches.map(([id, patch]) => ({ t: "update", table: "cashflow_schedule", patch, f: [["eq", "id", id]] })))) { Sound.check(); flash(`${patches.length} payment${patches.length > 1 ? "s" : ""} moved`); }
    },
    renameDebt: async (from, to) => {
      setD(s => ({ ...s, sched: s.sched.map(r => r.entity_name === from && isOblig(r) ? { ...r, entity_name: to } : r) }));
      if (await commit([{ t: "update", table: "cashflow_schedule", patch: { entity_name: to }, f: [["eq", "entity_name", from], ["neq", "category", "Income"]] }, { t: "update", table: "liabilities", patch: { name: to }, f: [["eq", "name", from]] }])) flash(`Renamed to ${to}`);
    },
    removeDebt: async entity => {
      setD(s => ({ ...s, sched: s.sched.filter(r => !(r.entity_name === entity && isOblig(r) && !r.is_cleared)) }));
      if (await commit([{ t: "delete", table: "cashflow_schedule", f: [["eq", "entity_name", entity], ["eq", "is_cleared", false], ["neq", "category", "Income"]] }, { t: "update", table: "liabilities", patch: { is_active: false }, f: [["eq", "name", entity]] }])) flash(`${entity} removed`);
    },
    addDebt: async ({ name, type, m, n, l, first, kind }) => {
      const f = parseDate(first), day = f.getDate(), t = DEBT_TYPES.find(x => x[0] === type) || DEBT_TYPES[4];
      const rows = Array.from({ length: n }, (_, i) => ({ id: uid(), month_date: ym(new Date(f.getFullYear(), f.getMonth() + i, 1)) + "-01", entity_name: name, category: t[2], amount_due: r2(i === n - 1 ? l : m), is_cleared: false, due_day: day }));
      const total = r2(rows.reduce((s, r) => s + r.amount_due, 0));
      setSheet(null); setD(s => ({ ...s, sched: [...s.sched, ...rows] }));
      if (await commit([{ t: "insert", table: "cashflow_schedule", row: rows }, { t: "insert", table: "liabilities", row: { id: uid(), name, total_balance: total, type: t[1], is_active: true, total_limit: total, due_day: day } }]))
        { Sound.check(); flash(kind === "new" ? `${name} added. Honest logging counts.` : `${name} added: ${n} payments, ${fmt(total, 2)}`); }
    },
    setIncome: async (amount, day, fromKey) => {
      const s2 = { ...settings, income: { amount: r2(amount), day } };
      setD(s => ({ ...s, state: { ...s.state, settings: s2 }, sched: s.sched.map(r => r.category === "Income" && r.entity_name === "Inflow" && !r.is_cleared && r.month_date.slice(0, 7) >= fromKey ? { ...r, amount_due: r2(amount), due_day: day } : r) }));
      incomeGuard.current = false;
      if (await commit([{ t: "update", table: "cashflow_schedule", patch: { amount_due: r2(amount), due_day: day }, f: [["eq", "category", "Income"], ["eq", "entity_name", "Inflow"], ["eq", "is_cleared", false], ["gte", "month_date", fromKey + "-01"]] }, { t: "update", table: "ascent_state", patch: { settings: s2 }, f: [["eq", "id", 1]] }])) flash(`Allowance set to ${fmt(amount, 2)} from ${monthLong(fromKey)}`);
    },
    removeIncome: async r => {
      setD(s => ({ ...s, sched: s.sched.filter(x => x.id !== r.id) }));
      if (await commit([{ t: "delete", table: "cashflow_schedule", f: [["eq", "id", r.id]] }])) flash("Income removed");
    },
    addIncome: async (name, a) => {
      const row = { id: uid(), month_date: calc.monthKey + "-01", entity_name: name, category: "Income", amount_due: r2(a), is_cleared: true, due_day: today.getDate(), paid_on: ymd(today) };
      setD(s => ({ ...s, sched: [...s.sched, row] }));
      if (await commit([{ t: "insert", table: "cashflow_schedule", row }, ...cashOps(a)])) { Sound.check(); flash(`+${fmt(a, 2)} from ${name}`); }
    },
    setCash: async v => {
      setSheet(null); cashRef.current = v; const patch = { cash_balance: v, cash_updated_at: new Date().toISOString() };
      setD(s => ({ ...s, state: { ...s.state, ...patch } }));
      if (await commit([{ t: "update", table: "ascent_state", patch, f: [["eq", "id", 1]] }])) flash(`Cash set to ${fmt(v, 2)}`);
    },
    logSpend: async (amount, category) => {
      setSheet(null); const row = { id: uid(), amount: r2(amount), category, spent_on: ymd(today) };
      setD(s => ({ ...s, spend: [row, ...s.spend] }));
      if (await commit([{ t: "insert", table: "ascent_spend", row }, ...cashOps(-amount)])) { Sound.check(); showUndo(`Logged ${fmt(amount, 2)} on ${category.toLowerCase()}`, () => act.deleteSpend(row, true)); }
    },
    editSpend: async (e, patch) => {
      setD(s => ({ ...s, spend: s.spend.map(x => x.id === e.id ? { ...x, ...patch } : x) }));
      if (await commit([{ t: "update", table: "ascent_spend", patch, f: [["eq", "id", e.id]] }, ...cashOps(-(patch.amount - Number(e.amount)))])) flash("Updated");
    },
    deleteSpend: async (e, quiet) => {
      setD(s => ({ ...s, spend: s.spend.filter(x => x.id !== e.id) }));
      if (await commit([{ t: "delete", table: "ascent_spend", f: [["eq", "id", e.id]] }, ...cashOps(Number(e.amount))]) && !quiet) flash("Entry deleted");
    },
    potMove: async (pot, amt, reason) => {
      const bal = r2((Number(pot.balance) || 0) + amt), mv = { id: uid(), pot_id: pot.id, amount: amt, reason: reason || null, created_at: new Date().toISOString() };
      setD(s => ({ ...s, pots: s.pots.map(p => p.id === pot.id ? { ...p, balance: bal } : p), moves: [mv, ...s.moves] }));
      const { created_at, ...mvRow } = mv;
      if (await commit([{ t: "insert", table: "ascent_pot_moves", row: mvRow }, { t: "update", table: "wealth_portfolio", patch: { balance: bal }, f: [["eq", "id", pot.id]] }, ...cashOps(-amt)])) {
        Sound.check();
        if (pot.goal && Number(pot.balance) < Number(pot.goal) && bal >= Number(pot.goal)) setParty({ x: innerWidth / 2, y: innerHeight / 2, kicker: "GOAL REACHED", line1: potName(pot).toUpperCase(), line2: "FULL.", text: `${fmt(bal)} of ${fmt(pot.goal)}. That pot is done.` });
        else flash(amt > 0 ? `${fmt(amt, 2)} into ${potName(pot)}` : `${fmt(-amt, 2)} out of ${potName(pot)}: ${reason}`);
      }
    },
    editPot: async (pot, patch) => { setD(s => ({ ...s, pots: s.pots.map(p => p.id === pot.id ? { ...p, ...patch } : p) })); if (await commit([{ t: "update", table: "wealth_portfolio", patch, f: [["eq", "id", pot.id]] }])) flash("Pot saved"); },
    addPot: async p => { setSheet(null); const row = { id: uid(), balance: 0, category: "Goal", sort: 80, ...p }; setD(s => ({ ...s, pots: [...s.pots, row] })); if (await commit([{ t: "insert", table: "wealth_portfolio", row }])) flash(`${p.name} created`); },
    toggleTask: async (t, silent) => {
      if (!t.done && taskLocked(t, today)) { Sound.back(); buzz([30, 30]); flash(`Locked · unlocks ${dayYr(taskUnlock(t))}`); return; }
      const next = !t.done, patch = { done: next, done_at: next ? new Date().toISOString() : null };
      setD(s => ({ ...s, tasks: s.tasks.map(x => x.id === t.id ? { ...x, ...patch } : x) }));
      if (await commit([{ t: "update", table: "ascent_tasks", patch, f: [["eq", "id", t.id]] }]) && next && !silent) { Sound.check(); buzz(12); showUndo(`Done: ${t.title}`, () => act.toggleTask({ ...t, ...patch }, true)); }
    },
    addTask: async (title, due, area) => { const row = { id: uid(), title, due_date: due || null, done: false, ...(area ? { area } : {}) }; setD(s => ({ ...s, tasks: [...s.tasks, row] })); if (await commit([{ t: "insert", table: "ascent_tasks", row }])) { Sound.check(); flash("Task added"); } },
    editTask: async (t, patch) => { setD(s => ({ ...s, tasks: s.tasks.map(x => x.id === t.id ? { ...x, ...patch } : x) })); if (await commit([{ t: "update", table: "ascent_tasks", patch, f: [["eq", "id", t.id]] }])) flash("Task saved"); },
    deleteTask: async t => { setD(s => ({ ...s, tasks: s.tasks.filter(x => x.id !== t.id) })); if (await commit([{ t: "delete", table: "ascent_tasks", f: [["eq", "id", t.id]] }])) flash("Task deleted"); },
    logStudy: async minutes => { setSheet(null); const row = { id: uid(), minutes, studied_on: ymd(today) }; setD(s => ({ ...s, study: [...s.study, row] })); if (await commit([{ t: "insert", table: "ascent_study", row }])) { Sound.check(); flash(`${minutes} min logged. Good.`); } },
    toggleMs: async (m, ev) => {
      setMsAsk(null); const next = !m.done, patch = { done: next, done_at: next ? new Date().toISOString() : null };
      setD(s => ({ ...s, ms: s.ms.map(y => y.id === m.id ? { ...y, ...patch } : y) }));
      if (await commit([{ t: "update", table: "ascent_milestones", patch, f: [["eq", "id", m.id]] }]) && next) setParty(msParty(m, ev ? ev.clientX : innerWidth / 2, ev ? ev.clientY : innerHeight / 2));
    },
    addMs: async p => { setSheet(null); const row = { id: uid(), sort: (d.ms.reduce((mx, m) => Math.max(mx, m.sort || 0), 0) + 10), done: false, ...p }; setD(s => ({ ...s, ms: [...s.ms, row] })); if (await commit([{ t: "insert", table: "ascent_milestones", row }])) flash("Milestone added"); },
    patchSettings: (patch, msg) => { // quiet settings save (habits, bills, parents)
      const merged = { ...settings, ...patch };
      setD(x => ({ ...x, state: { ...x.state, settings: merged } }));
      commit([{ t: "update", table: "ascent_state", patch: { settings: merged }, f: [["eq", "id", 1]] }]).then(ok => { if (ok && msg) flash(msg); });
    },
    dropFuture: (cat, name) => { // remove unpaid regular rows from this month on (they get rebuilt from the plan)
      const from = calc.monthKey + "-01";
      setD(x => ({ ...x, sched: x.sched.filter(r => !(r.category === cat && r.entity_name === name && !r.is_cleared && !r.note && r.month_date >= from)) }));
      return { t: "delete", table: "cashflow_schedule", f: [["eq", "category", cat], ["eq", "entity_name", name], ["eq", "is_cleared", false], ["gte", "month_date", from]] };
    },
    saveBill: async (bill, prev) => {
      const ops = prev ? [act.dropFuture("Bill", prev.name)] : [];
      const bills = [...(settings.bills || []).filter(b => b.id !== bill.id), bill].sort((a, b) => a.day - b.day);
      const merged = { ...settings, bills };
      setD(x => ({ ...x, state: { ...x.state, settings: merged } }));
      if (await commit([...ops, { t: "update", table: "ascent_state", patch: { settings: merged }, f: [["eq", "id", 1]] }])) { Sound.check(); flash(prev ? "Bill updated" : `${bill.name} added`); }
    },
    removeBill: async bill => {
      const op = act.dropFuture("Bill", bill.name);
      setD(x => ({ ...x, sched: x.sched.filter(r => !(r.category === "Bill" && r.entity_name === bill.name && !r.is_cleared)) }));
      const merged = { ...settings, bills: (settings.bills || []).filter(b => b.id !== bill.id) };
      setD(x => ({ ...x, state: { ...x.state, settings: merged } }));
      if (await commit([{ ...op, f: [["eq", "category", "Bill"], ["eq", "entity_name", bill.name], ["eq", "is_cleared", false]] }, { t: "update", table: "ascent_state", patch: { settings: merged }, f: [["eq", "id", 1]] }])) flash(`${bill.name} stopped`);
    },
    saveParents: async p => {
      const op = act.dropFuture("Parents", PARENTS_NAME);
      const merged = { ...settings, parents: p };
      setD(x => ({ ...x, state: { ...x.state, settings: merged } }));
      if (await commit([op, { t: "update", table: "ascent_state", patch: { settings: merged }, f: [["eq", "id", 1]] }])) { Sound.check(); flash("Plan saved"); }
    },
    giveParents: async amt => {
      const row = { id: uid(), month_date: calc.monthKey + "-01", entity_name: PARENTS_NAME, category: "Parents", amount_due: r2(amt), is_cleared: true, due_day: today.getDate(), paid_on: ymd(today), note: "Extra" };
      setD(x => ({ ...x, sched: [...x.sched, row] }));
      if (await commit([{ t: "insert", table: "cashflow_schedule", row }, ...cashOps(-r2(amt))])) { Sound.win(); flash(`${fmt(amt, 2)} to Mum & Dad. Alhamdulillah.`); }
    },
    toggleHabit: id => {
      const t = ymd(today), log = { ...(settings.habitLog || {}) }, on = log[t] || [];
      const was = on.includes(id); log[t] = was ? on.filter(x => x !== id) : [...on, id];
      const cut = ymd(addDays(today, -400)); Object.keys(log).forEach(k => { if (k < cut) delete log[k]; });
      if (!was) { Sound.check(); buzz(10); } else Sound.tick();
      act.patchSettings({ habitLog: log });
    },
    addHabit: name => { act.patchSettings({ habits: [...(settings.habits || []), { id: uid(), name, since: ymd(today) }] }, `${name} added`); },
    removeHabit: id => { act.patchSettings({ habits: (settings.habits || []).filter(h => h.id !== id) }); },
    saveReport: (key, snap) => { // freeze a finished month's result (quietly)
      const merged = { ...settings, reports: { ...(settings.reports || {}), [key]: snap } };
      setD(x => ({ ...x, state: { ...x.state, settings: merged } }));
      commit([{ t: "update", table: "ascent_state", patch: { settings: merged }, f: [["eq", "id", 1]] }]);
    },
    saveSettings: async (s, since) => {
      const merged = { ...settings, ...s }; setD(x => ({ ...x, state: { ...x.state, settings: merged, trading_free_since: since } }));
      if (await commit([{ t: "update", table: "ascent_state", patch: { settings: merged, trading_free_since: since }, f: [["eq", "id", 1]] }])) flash("Settings saved");
    },
  };
  const resetStreak = async () => {
    const t = ymd(today); setConfirmReset(false); setD(x => ({ ...x, state: { ...x.state, trading_free_since: t } }));
    if (await commit([{ t: "update", table: "ascent_state", patch: { trading_free_since: t, updated_at: new Date().toISOString() }, f: [["eq", "id", 1]] }])) flash("Streak reset. Day 1 starts now.");
  };
  const beatUrge = async () => {
    const n = (Number(d.state.urges_beaten) || 0) + 1; setUrge(false);
    setD(x => ({ ...x, state: { ...x.state, urges_beaten: n } }));
    if (await commit([{ t: "update", table: "ascent_state", patch: { urges_beaten: n }, f: [["eq", "id", 1]] }])) { Sound.chord(); buzz([20, 40, 20]); flash(`Urge beaten. That's ${n}.`); }
  };
  const openClaude = seed => { if (aiState === "ready") { setAiOpen(true); if (seed) setAiSeed({ text: seed, n: Date.now() }); } else setSheet({ type: "ai" }); };
  const talkUrge = () => { setUrge(false); openClaude("I feel the urge to trade right now."); };
  const telegramTest = async () => { const { data, error } = await sb.rpc("ascent_send_reminders", { force: true }); return error ? (/function|does not exist/i.test(error.message) ? "Run supabase-v2.sql first." : error.message) : String(data); };
  const doExport = kind => {
    const stamp = ymd(new Date());
    const blob = kind === "json"
      ? new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...d }, null, 2)], { type: "application/json" })
      : new Blob(["date,category,amount\n" + d.spend.map(s => `${s.spent_on},"${String(s.category).replace(/"/g, '""')}",${s.amount}`).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ascent-${kind === "json" ? "backup" : "spending"}-${stamp}.${kind}`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    lsSet("ascent-last-backup", String(Date.now())); flash("Downloaded. Keep it somewhere safe.");
  };
  const signOut = () => { lsSet(CKEY, ""); saveQueue([]); sb.auth.signOut(); };
  const guideGo = go => {
    setGuide(false);
    const [k, v] = go.split(/:(.+)/);
    if (k === "scroll") {
      const id = v === "streaks" ? "streak" : v;
      const home = { week: "money", ascent: "money", top: "money", debts: "money", history: "money", bills: "money", spend: "money", pots: "money", parents: "money", habits: "life", why: "life", checklist: "invest", review: "invest", own: "invest", learn: "invest", streak: "life", family: "life", milestones: "life", study: "career", path: "career", todo: "career", grove: "invest", badges: "invest", rules: "invest" }[id] || "money";
      const jump = () => { setTabRaw(ugTabOf(id)); setTimeout(() => { const el = document.getElementById(id); el && el.scrollIntoView({ behavior: CALM ? "auto" : "smooth" }); }, 120); };
      if (home !== world || view !== "world") goWorld(home, 0, 0, jump); else jump();
      return;
    }
    if (k === "tick") { const r = d.sched.find(x => x.id === v); if (r) act.toggleRow(r); return; }
    if (k === "pot") { const p = d.pots.find(x => x.id === v); if (p) setSheet({ type: "pot", pot: p }); return; }
    if (k === "urge") { setUrge(true); return; }
    if (k === "backup") { doExport("json"); return; }
    setSheet({ type: k });
  };
  const steps = nextSteps(d, calc, settings, status);
  const hasArea = d.tasks.length > 0 && "area" in d.tasks[0];

  /* ----- time machine ----- */
  const isNow = tm === 0, key = isNow ? null : calc.months[tm];
  const debtShown = isNow ? calc.remaining : calc.leftAfter(key);
  const progress = 1 - debtShown / calc.totalAll;
  const label = isNow ? "TODAY · " + dayLabel(today).toUpperCase() : monthLabel(key);
  const event = isNow ? (calc.week.find(w => !w.done)?.title || "All clear this week") : (calc.events[key] || []).join(" · ");
  const maxTm = calc.months.length - 1;
  const scrub = v => { const n = +v; if (n !== tm) { Sound.tick(); buzz(4); } if (n === maxTm && tm !== n) { Sound.chord(); buzz([30, 50, 30, 50, 120]); } setTm(n); };
  const ordDays = Math.max(0, diffDays(parseDate(settings.ord), today));
  const studyOpen = today >= parseDate(settings.studyStart);
  const LINKS = {
    money: [["week", "This week"], ["ascent", "Ascent"], ["debts", "Money"], ["history", "History"]],
    invest: [["grove", "This month"], ["badges", "Badges"], ["rules", "Rules"]],
    career: [["study", "Study"], ["path", "Path"], ["todo", "To-dos"], ["employers", "Employers"]],
    life: [["streak", "Stay free"], ["family", "Family"], ["milestones", "Journey"]],
  }[world];
  const W = worldOf(world);
  const doneN = calc.week.filter(w => w.done).length;
  const nextMs = d.ms.find(m => !m.done);
  const stale = cacheAt && Date.now() - cacheAt > 60000;

  const repKeys = [...new Set([calc.monthKey, ...calc.history.map(h => h.key)])].sort();
  const repSnap = report && (settings.reports || {})[report];
  const repData = report ? (repSnap ? unsnap(report, repSnap) : monthReport(d, settings, report, today)) : null;
  const repIdx = repKeys.indexOf(report);
  const closeRep = () => { Sound.back(); if (repData && !repSnap && !repData.live) act.saveReport(report, snapReport(repData)); setReport(null); };
  closeRepRef.current = report ? closeRep : null;
  const repEl = repData && <ReportCard rep={repData} onClose={closeRep}
    onPrev={repIdx > 0 ? () => { Sound.move(); if (!repSnap && !repData.live) act.saveReport(report, snapReport(repData)); setReport(repKeys[repIdx - 1]); } : null}
    onNext={repIdx >= 0 && repIdx < repKeys.length - 1 ? () => { Sound.move(); if (!repSnap && !repData.live) act.saveReport(report, snapReport(repData)); setReport(repKeys[repIdx + 1]); } : null} />;

  const hubView = view === "hub" && (
    <React.Fragment key="hub">
      {!loaded && <Loader jdm ready={!!d} onDone={() => { lsSet("ascent-loader-day", ymd(new Date())); setLoaded(true); }} />}
      {err && <div className="status" role="alert">{err}</div>}
      {!err && status === "offline" && <div className="status soft" role="status">Offline · showing data from {cacheAt ? ago(new Date(cacheAt).toISOString()) : "earlier"}</div>}
      <Hub d={d} calc={calc} settings={settings} today={today} world={world} onEnter={enterStage} onSignOut={signOut} onUrge={() => { Sound.select(); setUrge(true); }} />
      {party && <Party {...party} onDone={() => setParty(null)} />}
      {repEl}
      {toast && <div className="toast">{toast}</div>}
      {urge && <Urge left={calc.remaining} streak={calc.streak} beaten={Number(d.state.urges_beaten) || 0} onClose={() => setUrge(false)} onBeaten={beatUrge} onTalk={talkUrge} />}
    </React.Fragment>
  );

  return (
    <>
      {wipe && <UGWipe key="wipe" title={wipe.title} sub={wipe.sub} onMid={wipe.mid} onDone={() => setWipe(null)} />}
      {hubView || <React.Fragment key="world">
      {!loaded && <Loader jdm ready={!!d} onDone={() => { lsSet("ascent-loader-day", ymd(new Date())); setLoaded(true); }} />}
      {err && <div className="status" role="alert">{err}</div>}
      {!err && status === "offline" && <div className="status soft" role="status">Offline · showing data from {cacheAt ? ago(new Date(cacheAt).toISOString()) : "earlier"}{queued ? ` · ${queued} change${queued > 1 ? "s" : ""} waiting to sync` : ""}</div>}
      {!err && status === "setup" && <div className="status" role="alert">Run supabase-v2.sql in Supabase to switch on the new features, then reload.</div>}
      {!err && !status && queued > 0 && <div className="status soft" role="status">{queued} change{queued > 1 ? "s" : ""} waiting to sync</div>}

      <div className="ug-screen ug-stage">
      <StageBar card={ugCards(d, calc, settings, today).find(c => c.k === world)} tabs={tabs} tab={curTab} onTab={setTab} onBack={goHub}
        steps={steps.length} onGuide={() => { buzz(10); Sound.tick(); setGuide(true); }}
        onMenu={() => { Sound.tick(); setMenu(true); }} onSpend={() => { buzz(10); Sound.tick(); setSheet({ type: "spend" }); }} />

      <div className={"menu ug-menu-ov" + (menu ? " open" : "")} aria-hidden={!menu}>
        <button className="ug-close" aria-label="Close menu" onClick={() => { Sound.back(); setMenu(false); }}>✕</button>
        <div className="ug-hud">Pause menu</div>
        <button className="ug-mi" onClick={goHub}><span className="ug-t chrome">Main menu</span><small>ホーム</small></button>
        {WORLDS.filter(x => x.id !== world).map(x => { const c = { money: "お金", invest: "投資", career: "仕事", life: "人生" }[x.id]; return <button key={x.id} className="ug-mi" onClick={() => goWorld(x.id)}><span className="ug-t chrome">{x.id}</span><small>{c}</small></button>; })}
        <div className="menu-row">
          <button className="chip-btn" onClick={() => { setMenu(false); setSheet({ type: "settings" }); }}>Settings</button>
          <button className="chip-btn" onClick={() => { setMenu(false); doExport("json"); }}>Backup</button>
          <button className="chip-btn" onClick={() => { setMenu(false); setUrge(true); }}>Urge to trade</button>
          <button className="chip-btn" aria-pressed={sound} onClick={() => { setSfx(!sound); setSound(!sound); }}>Sound: {sound ? "on" : "off"}</button>
          <button className="chip-btn" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="ug-pages" ref={pagesRef} data-tab={curTab}
        onPointerDown={e => { pagesRef.sx = e.target.closest("input,textarea,select,.tm,[data-noswipe]") ? null : [e.clientX, e.clientY]; }}
        onPointerUp={e => { const s = pagesRef.sx; pagesRef.sx = null; if (!s) return; const dx = e.clientX - s[0], dy = e.clientY - s[1]; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { const i = tabs.findIndex(t => t[0] === curTab) + (dx < 0 ? 1 : -1); if (tabs[i]) setTab(tabs[i][0]); } }}>
      {world === "money" && <>
      <header className="hero" id="top">
        
        <div className="lvl-pill caps"><i />Stage {STAGES[calc.stageIdx].n} · {STAGES[calc.stageIdx].t}</div>
        <div className="panel"><div className="panel-in">
          <div className="when"><span className="m">{label}</span><span className="event">{event}</span></div>
          <div className="big"><span className="cur-sign">$</span><Odometer value={debtShown} /></div>
          <div className="sub">
            <span>left to clear</span>
            {isNow ? (calc.safe != null ? <span>safe to spend <b>{fmt(calc.safe)}</b></span> : <span><b>{ordDays}</b> days to ORD</span>) : <span>projected savings <b>{fmt(calc.proj[key] || 0)}</b></span>}
            <span>climbed <b>{Math.round(progress * 100)}%</b></span>
          </div>
          <div className="tm">
            <div className="tm-top"><span className="caps mute">Time machine · drag into your future</span>{!isNow && <button onClick={() => setTm(0)}>Back to today</button>}</div>
            <input id="tm" type="range" min="0" max={maxTm} step="1" value={tm} onChange={e => scrub(e.target.value)} style={{ "--p": (tm / Math.max(1, maxTm) * 100) + "%" }} aria-label="Scrub through your plan month by month" />
            <div className="ticks"><span>NOW</span><span>{monthLabel(calc.months[Math.floor(maxTm / 2)])}</span><span>{monthLabel(calc.months[maxTm])}</span></div>
          </div>
        </div></div>
      </header>

      <main>
        <section className="block wrap" id="week">
          <div className="sechead"><Scramble text="THIS WEEK" /><span className="idx">{doneN}/{calc.week.length} done<br />{dayLabel(today)} → {dayLabel(addDays(today, 7))}</span></div>

          <div className="duo top-duo">
          <div className={"safe reveal" + (calc.safe != null && calc.safe < 0 ? " neg" : "")}>
            {calc.safe == null ? <>
              <div className="caps mute">Safe to spend</div>
              <p className="safe-empty">Tell the app how much is in your bank, and it'll show exactly what you can spend until payday.</p>
              <button className="chip-btn solid2" onClick={() => setSheet({ type: "cash" })}>Set my cash</button>
            </> : <>
              <div className="row"><span className="caps mute">Safe to spend</span><span className="caps mute">until {calc.nextPay ? dayLabel(calc.payDate) : "next month"}</span></div>
              <div className="safe-v"><Count to={calc.safe} /></div>
              <div className="safe-sub">{calc.safe >= 0 ? <>About <b>{fmt(calc.safe / calc.daysToPay)}</b> a day for {calc.daysToPay} day{calc.daysToPay > 1 ? "s" : ""}</> : <>You're short <b>{fmt(-calc.safe, 2)}</b> for bills before payday. Line up backup now, not on the day.</>}</div>
              <div className="safe-row"><span>Cash {fmt(calc.cash, 2)} − bills before payday {fmt(calc.dueBefore, 2)}</span><button className="linkbtn" onClick={() => setSheet({ type: "cash" })}>Update cash{d.state.cash_updated_at ? ` · set ${ago(d.state.cash_updated_at)}` : ""}</button></div>
            </>}
          </div>

          <div className="stats reveal">
            <div><div className="v"><Count to={calc.spentTotal} /></div><div className="l">Spent of {fmt(settings.budget)}</div></div>
            <div><div className="v">{calc.nextPay ? dayLabel(calc.nextPay._dt).slice(4) : "—"}</div><div className="l">Payday {calc.nextPay ? "+" + money(Number(calc.nextPay.amount_due)) : ""}</div></div>
            <div><div className="v"><Count to={calc.week.filter(w => w.kind === "bill" && !w.done).reduce((s, w) => s + w.amt, 0)} /></div><div className="l">Bills this week</div></div>
          </div>
          </div>

          <div className="reveal">
            {calc.week.length === 0 && <div className="empty">Nothing due this week. Add a task below, or enjoy the quiet.</div>}
            {calc.week.map((w, i) => (
              <div className="qwrap" key={w.kind + w.id}>
                <button className={"quest" + (w.done ? " done" : "") + (w.late ? " late" : "")} aria-pressed={!!w.done}
                  onClick={e => { const b = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--cx", (e.clientX - b.left) + "px"); e.currentTarget.style.setProperty("--cy", (e.clientY - b.top) + "px"); w.kind === "task" ? act.toggleTask(w.row) : act.toggleRow(w.row, e); }}>
                  <span className="i">{String(i + 1).padStart(2, "0")}</span>
                  <span><div className="t">{w.title}{w.kind === "income" && <span className="tag2">in</span>}</div><div className="m">{w.late ? "Overdue · " : ""}{w.date ? dayLabel(w.date) : "Anytime"}</div></span>
                  <span className="a">{w.amt ? (w.kind === "income" ? "+" : "") + money(w.amt) : ""}</span>
                  <span className="ck"><Tick /></span>
                </button>
                <button className="qedit" aria-label={"More options for " + w.title} onClick={() => w.kind === "task" ? setSheet({ type: "task", task: w.row }) : w.kind === "income" ? setSheet({ type: "income" }) : w.row.category === "Bill" ? setSheet({ type: "bill", bill: (settings.bills || []).find(b => b.name === w.row.entity_name) || null }) : w.row.category === "Parents" ? setSheet({ type: "parents-plan" }) : setSheet({ type: "debt-detail", entity: w.row.entity_name })}>⋯</button>
              </div>
            ))}
            <form className="addrow" onSubmit={e => { e.preventDefault(); const t = newTask.trim(); if (!t) return; act.addTask(t, newDue); setNewTask(""); setNewDue(""); }}>
              <input className="field" id="newtask" placeholder="Add a task…" value={newTask} onChange={e => setNewTask(e.target.value)} aria-label="New task" />
              <input className="field" id="newdue" type="date" value={newDue} onChange={e => setNewDue(e.target.value)} aria-label="Due date (optional)" />
              <button className="cta" disabled={!newTask.trim()}>Add</button>
            </form>
            <div className="minis">
              {calc.later.length > 0 && <button className="chip-btn" onClick={() => setShowLater(!showLater)}>{showLater ? "Hide" : "Show"} later tasks ({calc.later.length})</button>}
              {calc.tasksDone.length > 0 && <button className="chip-btn" onClick={() => setShowDone(!showDone)}>{showDone ? "Hide" : "Show"} done ({calc.tasksDone.length})</button>}
            </div>
            {showLater && <div className="recent">{calc.later.map(t => <div key={t.id}><button className="rowbtn" onClick={() => setSheet({ type: "task", task: t })}>{taskLocked(t, today) ? "🔒 " : ""}{dayLabel(parseDate(t.due_date))} · {t.title}</button><span className="mute small">{taskLocked(t, today) ? `unlocks ${dayYr(taskUnlock(t))}` : ""}</span></div>)}</div>}
            {showDone && <div className="recent">{calc.tasksDone.slice(0, 30).map(t => <div key={t.id}><button className="rowbtn done-t" onClick={() => act.toggleTask(t, true)} title="Tap to mark not done">✓ {t.title}</button><button className="linkbtn" onClick={() => setSheet({ type: "task", task: t })}>Edit</button></div>)}</div>}
            {calc.soon.length > 0 && <div className="recent" style={{ marginTop: 16 }}>
              <div><span className="caps">Coming up · next 30 days</span><span /></div>
              {calc.soon.map(r => <div key={r.id}><button className="rowbtn" onClick={() => isOblig(r) ? setSheet({ type: "debt-detail", entity: r.entity_name }) : setSheet({ type: "income" })}>{dayLabel(r._dt)} · {isOblig(r) ? r.entity_name : "Allowance"}</button><span className="num">{isOblig(r) ? "" : "+"}{money(Number(r.amount_due))}</span></div>)}
            </div>}
          </div>
          {calc.week.length > 0 && doneN === calc.week.length && <div className="cleared" aria-live="polite"><Marquee items={["WEEK CLEARED —", "EVERY TASK DONE —", "WEEK CLEARED —", "EVERY TASK DONE —"]} speed={1} /></div>}
        </section>

        <Stages currentIdx={calc.stageIdx} />

        <section className="block wrap" id="debts">
          <div className="sechead"><Scramble text="DEBTS" /><span className="idx">net worth<br /><b className={calc.netWorth < 0 ? "neg" : ""}>{fmt(calc.netWorth)}</b></span></div>
          <div className="nw reveal"><span>Savings {fmt(calc.potsSum)}</span><span>+ cash {calc.cash == null ? "—" : fmt(calc.cash)}</span><span>− debts {fmt(calc.remaining)}</span></div>
          <div className="stack reveal" aria-label="What's left, by debt">
            {[...calc.debts.filter(g => g.left > .005).map(g => [g.name, g.left]), ...(calc.phoneLeft > .005 ? [["Phone contracts", calc.phoneLeft]] : [])].map(([n, l]) => <div key={n} title={`${n} ${fmt(l, 2)}`} style={{ flexGrow: l }} />)}
          </div>
          <div className="reveal" style={{ marginTop: 12 }}>
            {calc.debts.map(g => (
              <button className="debt debt-btn" key={g.name} style={g.left < .005 ? { opacity: .5 } : null} onClick={() => setSheet({ type: "debt-detail", entity: g.name })}>
                <span className="n">{g.name}{g.left < .005 ? " · cleared" : ""}</span><span className="v">{fmt(g.left, 2)}</span>
                <span className="e">{g.left < .005 ? `All ${fmt(g.total, 2)} paid` : (() => { const nx = g.rows.find(r => !r.is_cleared); return `Next ${dayLabel(nx._dt)} · ${fmt(nx.amount_due, 2)} · last ${monthLabel(g.last.slice(0, 7))}`; })()}</span>
              </button>
            ))}
            {calc.phones.length > 0 && <div className="debt" style={calc.phoneLeft < .005 ? { opacity: .5 } : null}>
              <span className="n">Phone contracts</span><span className="v">{fmt(calc.phoneLeft, 2)}</span>
              <span className="e">{calc.phoneLeft < .005 ? "All paid" : `Last payment ${monthLabel(calc.phoneLast.slice(0, 7))} · ${calc.phones.length} lines`}</span>
              <div className="lines">{calc.phones.map(p => { const nx = p.rows.find(r => !r.is_cleared); return <button key={p.name} className="line-btn" onClick={() => setSheet({ type: "debt-detail", entity: p.name })}><span>{p.name}{nx ? <em className="mute"> · next {dayLabel(nx._dt)}</em> : null}</span><span className="num">{fmt(p.left, 2)}</span></button>; })}</div>
            </div>}
            <div className="minis"><button className="chip-btn solid2" onClick={() => setSheet({ type: "debt" })}>+ Add a debt</button><button className="chip-btn" onClick={() => setSheet({ type: "due-days" })}>Due dates</button><button className="chip-btn" onClick={() => setSheet({ type: "income" })}>Income</button><button className="chip-btn" onClick={() => setSheet({ type: "cash" })}>Cash in bank</button></div>
          </div>
        </section>

        <section className="block wrap" id="spend">
          <div className="sechead"><Scramble text="SPEND" /><span className="idx">budget<br /><b>{fmt(settings.budget)}</b> a month</span></div>
          <div className="budget reveal">
            <div className="row"><span className="caps mute">Spent in {MONTHS[today.getMonth()]}</span><span className="caps mute">budget {fmt(settings.budget)}</span></div>
            <div className="row"><span className="v"><Count to={calc.spentTotal} /></span><span className="num">{calc.spentTotal <= settings.budget ? fmt(settings.budget - calc.spentTotal) + " left" : fmt(calc.spentTotal - settings.budget) + " over"}</span></div>
            <div className={"meter" + (calc.spentTotal > settings.budget ? " over" : "")}><i style={{ width: Math.min(100, calc.spentTotal / settings.budget * 100) + "%" }} /></div>
            <div className="cats-line">{[...new Set([...settings.categories, ...Object.keys(calc.byCat)])].map(c => <span key={c}>{c} <b>{fmt(calc.byCat[c] || 0)}</b></span>)}</div>
            <div className="minis"><button className="chip-btn solid2" onClick={() => setSheet({ type: "spend" })}>Log spend</button></div>
            {d.spend.length > 0 && <div className="recent">
              {d.spend.slice(0, 6).map(s => <div key={s.id}><button className="rowbtn" onClick={() => setSheet({ type: "spend-edit", entry: s })}>{dayLabel(parseDate(s.spent_on))} · {s.category}</button><span className="num">{money(Number(s.amount))}</span></div>)}
            </div>}
          </div>
        </section>

        <section className="block wrap" id="pots">
          <div className="sechead"><Scramble text="POTS" /><span className="idx">saved<br /><b>{fmt(calc.potsSum)}</b></span></div>
          <div className="pots reveal">
            {d.pots.map(p => (
              <button className="pot" key={p.id} onClick={() => setSheet({ type: "pot", pot: p })} aria-label={`Open ${potName(p)}`}>
                <Ring pct={p.goal ? Number(p.balance) / Number(p.goal) * 100 : 0} />
                <b>{potName(p)}</b>
                <small>{fmt(p.balance)}{p.goal ? " / " + fmt(p.goal) : ""}{p.note ? " · " + p.note : ""}</small>
              </button>
            ))}
            <button className="pot pot-new" onClick={() => setSheet({ type: "new-pot" })}><span className="plus">+</span><b>New pot</b><small>Hajj, wedding, BTO…</small></button>
          </div>
        </section>

        <BillsSection d={d} settings={settings} today={today} act={act} setSheet={setSheet} />
        <ParentsSection d={d} settings={settings} today={today} act={act} setSheet={setSheet} />

        <section className="block wrap" id="history">
          <div className="sechead"><Scramble text="HISTORY" /><span className="idx">month by month</span></div>
          <div className="reveal">
            <div className="minis" style={{ marginBottom: 12 }}><button className="chip-btn solid2" onClick={() => { Sound.select(); setReport(calc.monthKey); }}>🏁 Report card · {MONTH_FULL[today.getMonth()]} so far</button></div>
            {calc.history.length === 0 && <div className="empty">Your first month will show here once you start ticking things off.</div>}
            {calc.history.slice(0, histN).map(h => (
              <details className="hist" key={h.key} open={h.key === calc.monthKey}>
                <summary><span className="hm">{monthLong(h.key)}</span><span className="num">paid {fmt(h.paid)}</span><span className="num">spent {fmt(h.spend)}</span></summary>
                <div className="hgrid">
                  <div><span>Money in</span><b className="num">+{fmt(h.income, 2)}</b></div>
                  <div><span>Debts & bills paid</span><b className="num">{fmt(h.paid, 2)}</b></div>
                  <div><span>Spent</span><b className="num">{fmt(h.spend, 2)}</b></div>
                  <div><span>Into savings</span><b className="num">{fmt(h.saved, 2)}</b></div>
                  <div><span>Taken from savings</span><b className="num">{fmt(h.out, 2)}</b></div>
                  <div><span>Study</span><b className="num">{(h.study / 60).toFixed(1)} h</b></div>
                </div>
                {Object.keys(h.byCat).length > 0 && <div className="cats-line">{Object.entries(h.byCat).map(([c, v]) => <span key={c}>{c} <b>{fmt(v)}</b></span>)}</div>}
                {h.key !== calc.monthKey && <div className="minis"><button className="chip-btn" onClick={() => { Sound.select(); setReport(h.key); }}>{(settings.reports || {})[h.key] ? `Report card · rank ${settings.reports[h.key].rank}` : "Open report card"}</button></div>}
              </details>
            ))}
            {calc.history.length > histN && <div className="minis"><button className="chip-btn" onClick={() => setHistN(histN + 12)}>Show older months</button></div>}
          </div>
        </section>
      </main>
      </>}

      {world === "invest" && <InvestWorld d={d} calc={calc} settings={settings} today={today} act={act} setSheet={setSheet} flash={flash} />}
      {world === "career" && <CareerWorld d={d} calc={calc} settings={settings} today={today} act={act} setSheet={setSheet} newTask={newTask} setNewTask={setNewTask} newDue={newDue} setNewDue={setNewDue} hasArea={hasArea} />}
      {world === "life" && <LifeWorld d={d} calc={calc} settings={settings} today={today} act={act} setSheet={setSheet} setUrge={setUrge} confirmReset={confirmReset} setConfirmReset={setConfirmReset} resetStreak={resetStreak} msAsk={msAsk} setMsAsk={setMsAsk} />}

      <footer>
        <div className="foot"><Marquee items={["KEEP CLIMBING —", meAr(), "ONE MONTH AT A TIME —", meAr()]} speed={.4} /></div>
        <div className="sign"><b className="ar" style={{ fontFamily: '"Aref Ruqaa", serif', fontSize: 30 }}>{meAr()}</b><br />One month at a time.<br />
          <button className="signout" onClick={() => setSheet({ type: "settings" })}>Settings</button> · <button className="signout" onClick={signOut}>Sign out</button>
          <br /><small className="mute credit">Stage photos: Unsplash (Intrepid, Jean Vella, Ling Tang, Valentin Beauvais)</small></div>
      </footer>
      </div>
      </div>

      {sheet?.type === "spend" && <NumSheet title="Log spending" cats={settings.categories} cta={c => `Save ${String(c).toLowerCase()} spend`} onClose={() => setSheet(null)} onSave={(v, c) => act.logSpend(v, c)} />}
      {sheet?.type === "spend-edit" && <SpendEditSheet entry={sheet.entry} cats={settings.categories} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "plant" && (() => { const inv = investInfo(d, today); return inv.pot ? <NumSheet title="Invest this month" hint="The same fixed amount as every month. Money leaves your bank for StashAway." initial={String(Number(settings.investMonthly) || 50)} cta="Invested" onClose={() => setSheet(null)} onSave={v => { setSheet(null); if (v > 0) { act.potMove(inv.pot, v, "Monthly investment"); Sound.chord(); } }} /> : null; })()}
      {sheet?.type === "invest-value" && <NumSheet title="Review value" hint="What StashAway shows today. Write it once, then close the app." cta="Save the number" onClose={() => setSheet(null)} onSave={v => { setSheet(null); act.saveSettings({ investValue: { amount: r2(v), at: ymd(today) } }, d.state.trading_free_since); }} />}
      {sheet?.type === "study" && <StudySheet onClose={() => setSheet(null)} onSave={act.logStudy} />}
      {sheet?.type === "debt" && <DebtSheet names={Object.keys(calc.ents)} onClose={() => setSheet(null)} onSave={act.addDebt} />}
      {sheet?.type === "debt-detail" && calc.ents[sheet.entity] && <DebtDetail entity={sheet.entity} rows={calc.ents[sheet.entity].rows} today={today} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "bill" && <BillSheet bill={sheet.bill} bills={settings.bills || []} today={today} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "parents-plan" && <ParentsPlanSheet settings={settings} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "parents-extra" && <NumSheet title="Give Mum & Dad extra" hint="Raya, birthdays, or just because. It's counted as money out today." cta="Given" onClose={() => setSheet(null)} onSave={v => { setSheet(null); if (v > 0) act.giveParents(v); }} />}
      {sheet?.type === "due-days" && <DueDaysSheet ents={calc.ents} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "income" && <IncomeSheet rows={calc.inc} settings={settings} today={today} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "cash" && <CashSheet cash={calc.cash} onClose={() => setSheet(null)} onSave={act.setCash} />}
      {sheet?.type === "pot" && <PotSheet pot={d.pots.find(p => p.id === sheet.pot.id) || sheet.pot} moves={d.moves} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "new-pot" && <NewPotSheet onClose={() => setSheet(null)} onSave={act.addPot} />}
      {sheet?.type === "task" && <TaskSheet task={sheet.task} onClose={() => setSheet(null)} act={act} />}
      {sheet?.type === "ms" && <MilestoneSheet onClose={() => setSheet(null)} onSave={act.addMs} />}
      {sheet?.type === "settings" && <SettingsSheet settings={settings} state={d.state} onClose={() => setSheet(null)} act={act} onExport={doExport} telegramTest={telegramTest} />}
      {sheet?.type === "payday" && <PaydaySheet amount={sheet.amount} bills={sheet.bills} nextDate={sheet.nextDate} settings={settings} pots={d.pots} onClose={() => setSheet(null)} onConfirm={({ potId, save }) => { setSheet(null); const p = d.pots.find(x => x.id === potId); if (p && save > 0) act.potMove(p, save, "Payday"); else flash("Payday done."); }} />}
      {sheet?.type === "ai" && <Sheet title="Claude isn't switched on yet" onClose={() => setSheet(null)}>
        <p className="mute">The in-app assistant needs about $5 of Anthropic credits. The plan is December, once your $300 buffer is done. Then follow ASSISTANT-SETUP.md.</p>
        <p className="mute">Until then, open the Claude app on your phone and use your "Life Changing" project. It knows your plan.</p>
        <div className="minis"><button className="chip-btn solid2" onClick={async () => { const s = await checkAi(); if (s === "ready") { setSheet(null); setAiOpen(true); } else flash(s === "nokey" ? "Deployed, but the ANTHROPIC_API_KEY secret is missing." : "Still not switched on."); }}>Check again</button></div>
      </Sheet>}
      {party && <Party {...party} onDone={() => setParty(null)} />}
      {repEl}
      {toast && !undo && <div className="toast">{toast}</div>}
      {undo && <div className="toast undo" key={undo.id}><span>{undo.msg}</span><button onClick={() => { const f = undo.fn; setUndo(null); f(); flash("Undone"); }}>Undo</button></div>}
      {guide && <Guide steps={steps} aiState={aiState} onClose={() => setGuide(false)} onGo={guideGo} onAskClaude={() => { setGuide(false); openClaude(); }} />}
      <Assistant open={aiOpen} onClose={() => setAiOpen(false)} onChanged={load} seed={aiSeed} />
      {urge && <Urge left={calc.remaining} streak={calc.streak} beaten={Number(d.state.urges_beaten) || 0} onClose={() => setUrge(false)} onBeaten={beatUrge} onTalk={talkUrge} />}
      </React.Fragment>}
    </>
  );
}

/* ---------------- root ---------------- */
function App() {
  const [mode, setMode] = useState(() => lsGet("ascent-mode", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(/type=recovery/.test(location.hash));
  const [locked, setLocked] = useState(() => pinOn());
  const prevSession = useRef(undefined);
  useEffect(() => { // fresh password sign-in unlocks; a restored session keeps the lock
    if (prevSession.current === null && session) setLocked(false);
    prevSession.current = session;
  }, [session]);
  useEffect(() => {
    let hid = 0;
    const v = () => { if (document.hidden) hid = Date.now(); else if (pinOn() && hid && Date.now() - hid > 60000) setLocked(true); };
    document.addEventListener("visibilitychange", v); return () => document.removeEventListener("visibilitychange", v);
  }, []);
  const forgotPin = () => { lsSet(PIN_KEY, ""); lsSet(CKEY, ""); saveQueue([]); setLocked(false); sb.auth.signOut(); };
  useLayoutEffect(() => { document.documentElement.setAttribute("data-mode", mode); lsSet("ascent-mode", mode); }, [mode]);
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data } = sb.auth.onAuthStateChange((ev, s) => { if (ev === "PASSWORD_RECOVERY") setRecovery(true); setSession(s || null); });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {}); }, []);
  if (!sb) return <div className="gate"><div className="gate-card"><h1>Offline.</h1><p className="mute">Couldn't load the app's connection library. Check your internet and reload once; after that it works offline.</p></div></div>;
  if (session === undefined) return <UGBg />;
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  return <><UGBg />{session ? <Main session={session} mode={mode} setMode={setMode} /> : <Gate />}{session && locked && <PinPad mode="unlock" onDone={() => setLocked(false)} onForgot={forgotPin} />}</>;
}

createRoot(document.getElementById("root")).render(<App />);
