/* ============================================================
   Týdenní protokol péče o pleť — aplikace
   Data: localStorage + volitelná synchronizace přes Supabase
   ============================================================ */

/* ---------- konfigurace ----------
   Publishable klíč patří do prohlížeče a smí být ve veřejném repozitáři —
   data chrání row level security na serveru (auth.uid() = user_id).
   Secret klíč sem NIKDY nedávej, ten RLS obchází.               */
const SUPABASE_URL = "https://xaoihcfkwjlzupwbnhbx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4fe_EuSZeQaRytSzO4QQyw_7PRbpMAY";

const STORAGE_KEY = "skincare.v1";
const PROTOCOL_START_KEY = "skincare.start";
const LAST_EMAIL_KEY = "skincare.email";

/* ============================================================
   ROZVRH
   ============================================================ */

const PRODUCTS = {
  "cosrx-foam":    { name: "Cosrx pěna",        full: "Cosrx čisticí pěna" },
  "ctetra":        { name: "C-Tetra Luxe",      full: "Medik8 C-Tetra Luxe 14 %" },
  "sisleyum":      { name: "Sisleÿum",          full: "Sisley Sisleÿum Gel-Crème Matifiant" },
  "spf":           { name: "Cosrx SPF 50",      full: "Cosrx opalovací krém SPF 50" },
  "retinal":       { name: "Crystal Retinal 6", full: "Medik8 Crystal Retinal 6 — 0,06 % retinal" },
  "apaisante":     { name: "Apaisante",         full: "Eisenberg Crème Apaisante Réparatrice" },
  "anti-stress":   { name: "Anti-Stress",       full: "Eisenberg Soin Anti-Stress" },
  "pure-white":    { name: "Pure White",        full: "Eisenberg Pure White Soin Nourrissant Intégral" },
  "hydra":         { name: "Hydra Confort",     full: "Eisenberg Classique Hydra Confort" },
  "affinant":      { name: "Sérum Affinant",    full: "Eisenberg Sérum Affinant Visage" },
  "calmant":       { name: "Sérum Calmant",     full: "Eisenberg Sérum Calmant Ressourçant" },
  "fondant":       { name: "Fondant",           full: "Eisenberg Masque Fondant Réparateur" },
  "argent":        { name: "Argent",            full: "Eisenberg Homme Masque Essentiel Argent" },
  "ultralift":     { name: "Ultralift Or",      full: "Eisenberg Excellence Masque Ultralift Or" },
  "exfoliant":     { name: "Exfoliant",         full: "Eisenberg Exfoliant Lissant Express" },
  "lip-spf":       { name: "Eucerin SPF 20",    full: "Eucerin balzám na rty SPF 20" },
  "vaseline":      { name: "Vazelína",          full: "Vazelína nebo Aquaphor" },
};

/* Ranní rutina je invariantní přes všechny fáze i dny. */
const MORNING = [
  { id: "m-foam",  product: "cosrx-foam", note: "Čisticí pěna, vlažná voda" },
  { id: "m-c",     product: "ctetra",     note: "3–4 kapky, obličej — ne oční okolí" },
  { id: "m-eye",   product: "apaisante",  note: "Oční okolí, zrnko rýže, prsteníček" },
  { id: "m-cream", product: "sisleyum",   note: "Gel-krém, obličej a krk" },
  { id: "m-spf",   product: "spf",        note: "Cca 1,5 ml — obličej i krk" },
  { id: "m-lips",  product: "lip-spf",    note: "Poslední krok, až po SPF" },
];

/* Stavební bloky večerů. */
const EVENING_TEMPLATES = {
  retinal: {
    kind: "Retinal",
    accent: true,
    steps: [
      { id: "e-foam",     product: "cosrx-foam" },
      { id: "e-wait",     label: "Čekej 20 min", note: "Pleť musí být úplně suchá", timer: 20 },
      { id: "e-lips-bar", product: "vaseline",   note: "Rty i jejich lem — bariéra před retinalem" },
      { id: "e-eye-bar",  product: "apaisante",  note: "Oči a lem rtů — bariéra" },
      { id: "e-retinal",  product: "retinal",    note: "2 pumpičky, obličej a krk. Ne oči", key: true },
      { id: "e-cream",    product: "anti-stress" },
    ],
  },
  regen_affinant: {
    kind: "Regenerace",
    steps: [
      { id: "e-foam",  product: "cosrx-foam" },
      { id: "e-serum", product: "affinant" },
      { id: "e-eye",   product: "apaisante", note: "Oční okolí" },
      { id: "e-cream", product: "pure-white", note: "Obličej, krk, dekolt" },
      { id: "e-lips",  product: "vaseline",   note: "Silná vrstva" },
    ],
  },
  regen_calmant: {
    kind: "Regenerace",
    steps: [
      { id: "e-foam",  product: "cosrx-foam" },
      { id: "e-serum", product: "calmant" },
      { id: "e-eye",   product: "apaisante", note: "Oční okolí" },
      { id: "e-cream", product: "pure-white" },
      { id: "e-lips",  product: "vaseline",  note: "Silná vrstva" },
    ],
  },
  nutrition: {
    kind: "Výživa",
    steps: [
      { id: "e-foam",  product: "cosrx-foam" },
      { id: "e-serum", product: "affinant" },
      { id: "e-eye",   product: "apaisante", note: "Oční okolí" },
      { id: "e-cream", product: "hydra",     note: "Bohatší noc, 1× týdně" },
      { id: "e-lips",  product: "vaseline",  note: "Silná vrstva" },
    ],
  },
  mask: {
    kind: "Maska",
    steps: [
      { id: "e-foam",  product: "cosrx-foam" },
      { id: "e-mask",  label: "Argent nebo Fondant", note: "Argent na mastnou T-zónu a ucpané póry · Fondant na podrážděnou pleť" },
      { id: "e-eye",   product: "apaisante", note: "Oční okolí" },
      { id: "e-cream", product: "pure-white" },
      { id: "e-lips",  product: "vaseline",  note: "Silná vrstva" },
    ],
  },
  peel: {
    kind: "Peeling",
    steps: [
      { id: "e-foam",  product: "cosrx-foam" },
      { id: "e-peel",  product: "exfoliant",   note: "Obličej — nikdy oční okolí" },
      { id: "e-eye",   product: "apaisante",   note: "Oční okolí" },
      { id: "e-cream", product: "anti-stress" },
      { id: "e-lips",  product: "vaseline",    note: "Silná vrstva" },
    ],
  },
};

/* Fáze. Index 0 = pondělí … 6 = neděle. */
const PHASES = [
  {
    id: 1,
    label: "Fáze 1",
    weeks: "Týden 1–2",
    summary: "Út, Pá",
    week: ["regen_affinant", "retinal", "regen_calmant", "nutrition", "retinal", "mask", "peel"],
  },
  {
    id: 2,
    label: "Fáze 2",
    weeks: "Týden 3–4",
    summary: "Po, St, Pá",
    week: ["retinal", "regen_affinant", "retinal", "nutrition", "retinal", "mask", "regen_calmant"],
    note: "Peeling jednou za čtrnáct dní — zařaď ho místo nedělní regenerace v lichém týdnu.",
  },
  {
    id: 3,
    label: "Fáze 3",
    weeks: "Týden 5+",
    summary: "Po–Pá + Ne",
    week: ["retinal", "retinal", "retinal", "retinal", "retinal", "mask", "retinal"],
    note: "Peeling vypadává úplně. Sobota zůstává jediný večer bez retinalu.",
  },
];

const DAY_NAMES  = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const DAY_SHORT  = ["PO", "ÚT", "ST", "ČT", "PÁ", "SO", "NE"];

/* Holení mění rutinu: ráno Apaisante místo Sisleÿum, a večerní holení
   se tluče s retinalem — čerstvě oholená pleť má porušenou bariéru. */
const SHAVE_STATES = [
  { id: "morning", label: "Ráno",  desc: "Místo Sisleÿum dej Apaisante" },
  { id: "evening", label: "Večer", desc: "Retinal dnes vynech" },
];

const SKIN_STATES = [
  { id: "calm",     label: "Klid",        desc: "Bez podráždění",        color: "#4E9A7C" },
  { id: "dry",      label: "Sucho",       desc: "Napnutá, olupuje se",   color: "#C9A227" },
  { id: "irritated",label: "Podráždění",  desc: "Zarudnutí, citlivost",  color: "#D6763E" },
  { id: "burning",  label: "Pálení",      desc: "Vynech retinal i peeling", color: "#C4483E" },
];

/* ============================================================
   POMOCNÉ FUNKCE — datum
   ============================================================ */

/* Klíč dne v lokálním čase. toISOString() by posunul přes UTC. */
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* 0 = pondělí. JS má neděli jako 0, proto posun. */
function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function addDays(date, n) {
  const out = new Date(date);
  out.setDate(out.getDate() + n);
  return out;
}

function formatDate(date) {
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" });
}

/* ============================================================
   STAV
   ============================================================ */

let state = {
  /* "2026-07-28": { morning:{stepId:true}, evening:{stepId:true},
                     skin:"calm", note:"", phase:1, updatedAt:"..." } */
  days: {},
  phase: 1,
  protocolStart: null,
};

let cloud = null;      // Supabase klient, pokud je nakonfigurován
let cloudUser = null;
let syncTimer = null;

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.days = parsed.days || {};
      state.phase = parsed.phase || 1;
      state.protocolStart = parsed.protocolStart || null;
    }
  } catch (err) {
    console.warn("Nepodařilo se načíst lokální data:", err);
  }
  if (!state.protocolStart) {
    state.protocolStart = dayKey(new Date());
  }
}

function saveLocal() {
  pruneEmptyDays();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      days: state.days,
      phase: state.phase,
      protocolStart: state.protocolStart,
    }));
  } catch (err) {
    console.warn("Nepodařilo se uložit lokální data:", err);
  }
}

function getDay(key) {
  if (!state.days[key]) {
    state.days[key] = { morning: {}, evening: {}, skin: null, note: "", phase: state.phase };
  }
  const day = state.days[key];
  day.morning = day.morning || {};
  day.evening = day.evening || {};
  return day;
}

/* Den, na kterém uživatel nic neudělal. Takové se neukládají —
   jinak by pouhé prohlížení historie nafouklo data i sync. */
function isEmptyDay(day) {
  return !day
    || (Object.keys(day.morning || {}).length === 0
        && Object.keys(day.evening || {}).length === 0
        && !day.skin
        && !day.shave
        && !(day.note || "").trim());
}

function pruneEmptyDays() {
  for (const [key, day] of Object.entries(state.days)) {
    if (isEmptyDay(day)) delete state.days[key];
  }
}

/* Fáze, ve které den byl — ne aktuální. Historie se nesmí měnit zpětně. */
function phaseForDay(key) {
  const day = state.days[key];
  if (day && day.phase) return day.phase;
  return state.phase;
}

function templateFor(key, phaseId) {
  const phase = PHASES.find(p => p.id === phaseId) || PHASES[0];
  const idx = weekdayIndex(parseDayKey(key));
  return EVENING_TEMPLATES[phase.week[idx]];
}

function stepsFor(key, block) {
  if (block === "morning") {
    const day = state.days[key];
    /* Po ranním holení jde místo Sisleÿum Apaisante. Krok si drží
       stejné id, takže odškrtnutí přepnutí příznaku přežije. */
    if (day && day.shave === "morning") {
      return MORNING.map(s => s.id === "m-cream"
        ? { ...s, product: "apaisante", note: "Po holení — místo Sisleÿum" }
        : s);
    }
    return MORNING;
  }
  return templateFor(key, phaseForDay(key)).steps;
}

function touch(key) {
  const day = getDay(key);
  day.updatedAt = new Date().toISOString();
  if (!day.phase) day.phase = state.phase;
  saveLocal();
  scheduleSync();
}

/* ============================================================
   STATISTIKY
   ============================================================ */

function dayCompletion(key) {
  const day = state.days[key];
  if (!day) return { morning: 0, evening: 0, total: 0, done: 0 };

  const mSteps = stepsFor(key, "morning");
  const eSteps = stepsFor(key, "evening");
  const mDone = mSteps.filter(s => day.morning[s.id]).length;
  const eDone = eSteps.filter(s => day.evening[s.id]).length;

  return {
    morning: mSteps.length ? mDone / mSteps.length : 0,
    evening: eSteps.length ? eDone / eSteps.length : 0,
    done: mDone + eDone,
    total: mSteps.length + eSteps.length,
  };
}

function computeStats(windowDays = 84) {
  const today = new Date();
  const start = state.protocolStart ? parseDayKey(state.protocolStart) : today;

  let daysTracked = 0, fullDays = 0, spfDays = 0, spfPossible = 0;
  let retinalDone = 0, retinalPlanned = 0;
  let stepsDone = 0, stepsTotal = 0;
  let shaveDays = 0, shaveRetinalClash = 0;
  const missed = {};

  for (let i = 0; i < windowDays; i++) {
    const date = addDays(today, -i);
    if (date < start) break;
    const key = dayKey(date);

    const mSteps = stepsFor(key, "morning");
    const eSteps = stepsFor(key, "evening");
    const day = state.days[key];

    /* Dnešní večer ještě není zameškaný — nepočítám ho do statistik. */
    const isToday = i === 0;

    spfPossible++;
    const isRetinalDay = eSteps.some(s => s.product === "retinal");
    if (isRetinalDay && !isToday) retinalPlanned++;

    if (!day) {
      if (!isToday) {
        mSteps.forEach(s => { missed[stepLabel(s)] = (missed[stepLabel(s)] || 0) + 1; });
        eSteps.forEach(s => { missed[stepLabel(s)] = (missed[stepLabel(s)] || 0) + 1; });
        stepsTotal += mSteps.length + eSteps.length;
      }
      continue;
    }

    daysTracked++;
    const comp = dayCompletion(key);
    stepsDone += comp.done;
    if (!isToday) stepsTotal += comp.total;
    if (comp.done === comp.total && comp.total > 0) fullDays++;
    if (day.morning["m-spf"]) spfDays++;
    if (isRetinalDay && day.evening["e-retinal"]) retinalDone++;

    if (day.shave) shaveDays++;
    /* Večerní holení + retinal ve stejný den je porušení pravidla. */
    if (day.shave === "evening" && isRetinalDay && day.evening["e-retinal"]) {
      shaveRetinalClash++;
    }

    if (!isToday) {
      mSteps.forEach(s => {
        if (!day.morning[s.id]) missed[stepLabel(s)] = (missed[stepLabel(s)] || 0) + 1;
      });
      eSteps.forEach(s => {
        if (!day.evening[s.id]) missed[stepLabel(s)] = (missed[stepLabel(s)] || 0) + 1;
      });
    }
  }

  /* Série: po sobě jdoucí dny s alespoň 80 % splněných kroků.
     Dnešek sérii prodlouží, když je hotový, ale nepřeruší ji, dokud
     běží — jinak by po půlnoci spadla na nulu. */
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = dayKey(addDays(today, -i));
    if (state.protocolStart && key < state.protocolStart) break;
    const comp = dayCompletion(key);
    const ratio = comp.total ? comp.done / comp.total : 0;
    if (ratio >= 0.8) { streak++; continue; }
    if (i === 0) continue;
    break;
  }

  const topMissed = Object.entries(missed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    daysTracked, fullDays, streak,
    adherence: stepsTotal ? stepsDone / stepsTotal : 0,
    spf: spfPossible ? spfDays / spfPossible : 0,
    retinal: { done: retinalDone, planned: retinalPlanned },
    shave: { days: shaveDays, clash: shaveRetinalClash },
    topMissed,
    weeksSinceStart: Math.floor((today - start) / (7 * 864e5)),
  };
}

function stepLabel(step) {
  if (step.label) return step.label;
  const p = PRODUCTS[step.product];
  return p ? p.name : step.id;
}

/* ============================================================
   VYKRESLOVÁNÍ
   ============================================================ */

let viewDate = new Date();
let activeTab = "today";

const $ = sel => document.querySelector(sel);

function render() {
  renderTabs();
  if (activeTab === "today")    renderToday();
  if (activeTab === "history")  renderHistory();
  if (activeTab === "protocol") renderProtocol();
  renderSyncBadge();
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    const on = btn.dataset.tab === activeTab;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".view").forEach(v => {
    v.hidden = v.dataset.view !== activeTab;
  });
}

/* ---------- dnešek ---------- */

function renderToday() {
  const key = dayKey(viewDate);
  const day = getDay(key);
  const idx = weekdayIndex(viewDate);
  const tpl = templateFor(key, phaseForDay(key));
  const isToday = key === dayKey(new Date());

  const head = $("#today-head");
  head.innerHTML = `
    <div class="today-nav">
      <button class="nav-btn" id="prev-day" aria-label="Předchozí den">‹</button>
      <div class="today-title">
        <div class="today-day">${DAY_NAMES[idx]}${isToday ? " · dnes" : ""}</div>
        <div class="today-date">${formatDate(viewDate)}</div>
      </div>
      <button class="nav-btn" id="next-day" aria-label="Následující den"
        ${isToday ? "disabled" : ""}>›</button>
    </div>
    <div class="today-kind ${tpl.accent ? "is-amber" : ""}">${tpl.kind}</div>
  `;
  $("#prev-day").onclick = () => { viewDate = addDays(viewDate, -1); render(); };
  /* Porovnávat klíče dnů, ne časy — viewDate je půlnoc, takže
     `viewDate < new Date()` by odpoledne pustilo na zítřek. */
  $("#next-day").onclick = () => {
    if (dayKey(viewDate) < dayKey(new Date())) {
      viewDate = addDays(viewDate, 1);
      render();
    }
  };

  /* Vždy přes stepsFor — ranní kroky se mění podle příznaku holení. */
  $("#blocks").innerHTML =
    blockHTML(key, "morning", "Ráno", stepsFor(key, "morning")) +
    blockHTML(key, "evening", "Večer", stepsFor(key, "evening"), tpl.accent);

  wireBlocks(key);
  renderSkin(key, day);
}

function blockHTML(key, block, title, steps, accent) {
  const day = getDay(key);
  const done = steps.filter(s => day[block][s.id]).length;
  const all = done === steps.length;

  return `
    <section class="block ${accent ? "is-amber" : ""} ${all ? "is-complete" : ""}" data-block="${block}">
      <header class="block-head">
        <span class="tape ${accent ? "is-amber" : ""}">${title}</span>
        <span class="block-count">${done} / ${steps.length}</span>
        <button class="all-btn" data-all="${block}">
          ${all ? "Zrušit vše" : "Vše hotovo"}
        </button>
      </header>
      <ul class="checks">
        ${steps.map((s, i) => stepHTML(key, block, s, i)).join("")}
      </ul>
    </section>
  `;
}

function stepHTML(key, block, step, i) {
  const day = getDay(key);
  const checked = !!day[block][step.id];
  const label = stepLabel(step);
  const full = step.product && PRODUCTS[step.product] ? PRODUCTS[step.product].full : "";

  return `
    <li class="check ${checked ? "is-done" : ""} ${step.key ? "is-key" : ""}">
      <label>
        <input type="checkbox" data-block="${block}" data-step="${step.id}" ${checked ? "checked" : ""}>
        <span class="box" aria-hidden="true"></span>
        <span class="check-body">
          <span class="check-n">${String(i + 1).padStart(2, "0")}</span>
          <span class="check-name">${label}</span>
          ${full ? `<span class="check-full">${full}</span>` : ""}
          ${step.note ? `<span class="check-note">${step.note}</span>` : ""}
        </span>
      </label>
      ${step.timer ? `<button class="timer-btn" data-timer="${step.timer}">${step.timer} min ⏱</button>` : ""}
    </li>
  `;
}

function wireBlocks(key) {
  const day = getDay(key);

  $("#blocks").querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.onchange = () => {
      const { block, step } = box.dataset;
      if (box.checked) day[block][step] = true;
      else delete day[block][step];
      touch(key);
      renderToday();
    };
  });

  $("#blocks").querySelectorAll(".all-btn").forEach(btn => {
    btn.onclick = () => {
      const block = btn.dataset.all;
      const steps = stepsFor(key, block);
      const all = steps.every(s => day[block][s.id]);
      if (all) day[block] = {};
      else steps.forEach(s => { day[block][s.id] = true; });
      touch(key);
      renderToday();
    };
  });

  $("#blocks").querySelectorAll(".timer-btn").forEach(btn => {
    btn.onclick = () => startTimer(Number(btn.dataset.timer), btn);
  });
}

function startTimer(minutes, btn) {
  if (btn.dataset.running) return;
  btn.dataset.running = "1";
  let left = minutes * 60;

  const tick = () => {
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, "0");
    btn.textContent = `${m}:${s}`;
    if (left <= 0) {
      clearInterval(iv);
      delete btn.dataset.running;
      btn.textContent = "Hotovo ✓";
      btn.classList.add("is-done");
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      return;
    }
    left--;
  };
  tick();
  const iv = setInterval(tick, 1000);
}

function renderSkin(key, day) {
  const isRetinalDay = stepsFor(key, "evening").some(s => s.product === "retinal");
  const clash = day.shave === "evening" && isRetinalDay;

  $("#skin").innerHTML = `
    <div class="band-title">Holení</div>
    <div class="shave-row">
      ${SHAVE_STATES.map(s => `
        <button class="shave-btn ${day.shave === s.id ? "is-active" : ""}" data-shave="${s.id}">
          <span class="shave-label">${s.label}</span>
          <span class="shave-desc">${s.desc}</span>
        </button>
      `).join("")}
    </div>
    ${clash ? `
      <p class="shave-warn">
        Dnes je retinalový večer. Po holení má pleť porušenou bariéru —
        posuň retinal na jiný den.
      </p>` : ""}

    <div class="band-title band-title-2">Stav pleti</div>
    <div class="skin-row">
      ${SKIN_STATES.map(s => `
        <button class="skin-btn ${day.skin === s.id ? "is-active" : ""}"
                data-skin="${s.id}" style="--c:${s.color}">
          <span class="skin-label">${s.label}</span>
          <span class="skin-desc">${s.desc}</span>
        </button>
      `).join("")}
    </div>
    <textarea id="note" class="note-input" rows="2"
      placeholder="Poznámka ke dni — co jsi vynechal a proč, jak pleť reagovala…">${day.note || ""}</textarea>
  `;

  $("#skin").querySelectorAll(".shave-btn").forEach(btn => {
    btn.onclick = () => {
      day.shave = day.shave === btn.dataset.shave ? null : btn.dataset.shave;
      touch(key);
      renderToday();   /* ranní krok se mění podle holení */
    };
  });

  $("#skin").querySelectorAll(".skin-btn").forEach(btn => {
    btn.onclick = () => {
      day.skin = day.skin === btn.dataset.skin ? null : btn.dataset.skin;
      touch(key);
      renderSkin(key, day);
    };
  });

  const note = $("#note");
  let noteTimer = null;
  note.oninput = () => {
    day.note = note.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => touch(key), 600);
  };
}

/* ---------- historie ---------- */

function renderHistory() {
  const stats = computeStats();
  const pct = n => Math.round(n * 100) + " %";

  $("#stats").innerHTML = `
    <div class="stat">
      <span class="stat-n">${pct(stats.adherence)}</span>
      <span class="stat-l">Dodržování</span>
      <span class="stat-d">všech kroků za 12 týdnů</span>
    </div>
    <div class="stat">
      <span class="stat-n">${stats.streak}</span>
      <span class="stat-l">Série</span>
      <span class="stat-d">dnů po sobě nad 80 %</span>
    </div>
    <div class="stat">
      <span class="stat-n">${stats.retinal.done}<span class="stat-of">/${stats.retinal.planned}</span></span>
      <span class="stat-l">Retinal</span>
      <span class="stat-d">splněno z naplánovaných</span>
    </div>
    <div class="stat">
      <span class="stat-n">${pct(stats.spf)}</span>
      <span class="stat-l">SPF</span>
      <span class="stat-d">dnů s dokončeným SPF</span>
    </div>
    ${stats.shave.days ? `
      <div class="stat">
        <span class="stat-n">${stats.shave.days}</span>
        <span class="stat-l">Holení</span>
        <span class="stat-d">zaznamenaných dnů</span>
      </div>` : ""}
    ${stats.shave.clash ? `
      <div class="stat is-warn">
        <span class="stat-n">${stats.shave.clash}×</span>
        <span class="stat-l">Kolize</span>
        <span class="stat-d">retinal po večerním holení</span>
      </div>` : ""}
  `;

  renderCalendar();

  $("#missed").innerHTML = stats.topMissed.length ? `
    <div class="band-title">Nejčastěji vynechané kroky</div>
    <ul class="missed-list">
      ${stats.topMissed.map(([name, n]) => `
        <li><span class="missed-name">${name}</span><span class="missed-n">${n}×</span></li>
      `).join("")}
    </ul>
  ` : "";

  const start = parseDayKey(state.protocolStart);
  $("#review").innerHTML = `
    <div class="review-box">
      <div class="review-line">Protokol běží <b>${stats.weeksSinceStart}.</b> týden · start ${formatDate(start)}</div>
      <div class="review-line dim">
        ${stats.weeksSinceStart >= 12
          ? "Dvanáct týdnů uplynulo — čas na srovnávací fotku a vyhodnocení."
          : `Vyhodnocení za ${12 - stats.weeksSinceStart} týdnů. Kolagen se přestavuje v měsících.`}
      </div>
    </div>
  `;
}

function renderCalendar() {
  const today = new Date();
  const todayKey = dayKey(today);
  const weeks = 12;
  /* Zarovnat na pondělí, aby sloupce odpovídaly dnům v týdnu. */
  const end = addDays(today, 6 - weekdayIndex(today));
  const cells = [];

  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const key = dayKey(date);
    const future = key > todayKey;
    const comp = dayCompletion(key);
    const ratio = comp.total ? comp.done / comp.total : 0;
    const day = state.days[key];
    const skin = day && day.skin ? SKIN_STATES.find(s => s.id === day.skin) : null;
    const tpl = templateFor(key, phaseForDay(key));
    const isRetinal = tpl.steps.some(s => s.product === "retinal");

    const shaved = day && day.shave;

    let cls = "cell";
    if (future) cls += " is-future";
    else if (!day) cls += " is-empty";
    else if (ratio >= 1) cls += " is-full";
    else if (ratio >= 0.5) cls += " is-part";
    else if (ratio > 0) cls += " is-low";
    else cls += " is-empty";
    if (isRetinal) cls += " is-retinal";
    if (shaved) cls += " is-shaved";
    if (key === todayKey) cls += " is-today";

    const title = `${formatDate(date)} · ${comp.done}/${comp.total} kroků`
      + (skin ? ` · ${skin.label}` : "")
      + (shaved ? ` · holení ${day.shave === "morning" ? "ráno" : "večer"}` : "");

    cells.push(`<button class="${cls}" data-key="${key}" title="${title}"
      ${future ? "disabled" : ""}
      ${skin ? `style="--skin:${skin.color}"` : ""}></button>`);
  }

  $("#calendar").innerHTML = `
    <div class="band-title">Posledních 12 týdnů</div>
    <div class="cal-wrap">
      <div class="cal-days">${DAY_SHORT.map(d => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
    </div>
    <div class="cal-key">
      <span><i class="sw is-full"></i>Vše</span>
      <span><i class="sw is-part"></i>Částečně</span>
      <span><i class="sw is-empty"></i>Nic</span>
      <span><i class="sw is-retinal"></i>Retinal</span>
      <span><i class="sw is-shaved"></i>Holení</span>
    </div>
  `;

  $("#calendar").querySelectorAll(".cell").forEach(cell => {
    cell.onclick = () => {
      viewDate = parseDayKey(cell.dataset.key);
      activeTab = "today";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

/* ---------- protokol ---------- */

function renderProtocol() {
  const phase = PHASES.find(p => p.id === state.phase) || PHASES[0];

  renderAuth();

  $("#phase-picker").innerHTML = `
    <div class="band-title">Aktuální fáze</div>
    <div class="phase-row">
      ${PHASES.map(p => `
        <button class="phase-btn ${p.id === state.phase ? "is-active" : ""}" data-phase="${p.id}">
          <span class="phase-name">${p.label}</span>
          <span class="phase-weeks">${p.weeks}</span>
          <span class="phase-sum">${p.summary}</span>
        </button>
      `).join("")}
    </div>
    ${phase.note ? `<p class="phase-note">${phase.note}</p>` : ""}
    <p class="phase-warn">Změna fáze ovlivní jen dnešek a dny dopředu. Historie si drží fázi, ve které skutečně byla.</p>
  `;

  $("#phase-picker").querySelectorAll(".phase-btn").forEach(btn => {
    btn.onclick = () => {
      state.phase = Number(btn.dataset.phase);
      const key = dayKey(new Date());
      if (state.days[key]) state.days[key].phase = state.phase;
      saveLocal();
      scheduleSync();
      render();
    };
  });

  $("#week-view").innerHTML = `
    <div class="band-title">Rozvrh večerů</div>
    <div class="week-grid">
      ${phase.week.map((tplId, i) => {
        const tpl = EVENING_TEMPLATES[tplId];
        return `
          <article class="wday ${tpl.accent ? "is-amber" : ""}">
            <span class="tape ${tpl.accent ? "is-amber" : ""}">${DAY_NAMES[i]}</span>
            <span class="wday-kind">${tpl.kind}</span>
            <ol class="wsteps">
              ${tpl.steps.map((s, j) => `
                <li class="${s.key ? "is-key" : ""}">
                  <span class="n">${String(j + 1).padStart(2, "0")}</span>
                  <span class="p">${stepLabel(s)}</span>
                  ${s.note ? `<span class="d">${s.note}</span>` : ""}
                </li>
              `).join("")}
            </ol>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

/* ============================================================
   SYNCHRONIZACE (Supabase)
   ============================================================ */

function cloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
}

async function initCloud() {
  /* I bez konfigurace vykreslit sekci — vysvětlí, jak sync zapnout. */
  if (!cloudConfigured()) {
    renderAuth();
    return;
  }

  cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data } = await cloud.auth.getSession();
  cloudUser = data.session ? data.session.user : null;

  cloud.auth.onAuthStateChange((_event, session) => {
    cloudUser = session ? session.user : null;
    clearAuthFragment();
    renderAuth();
    renderSyncBadge();
    if (cloudUser) pullAndMerge();
  });

  clearAuthFragment();
  if (cloudUser) await pullAndMerge();
  renderAuth();
}

/* Supabase vrací token ve fragmentu URL. Když ho zpracuje, nemá tam co
   dělat — ať nezůstane v adresním řádku ani v historii prohlížeče. */
function clearAuthFragment() {
  if (/access_token=|error_description=/.test(window.location.hash)) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

/* Slučování po dnech: vyhrává novější updatedAt.
   Den bez razítka je starý lokální záznam — ustupuje cloudu. */
function mergeDays(remote) {
  let changed = false;
  for (const [key, rDay] of Object.entries(remote || {})) {
    if (isEmptyDay(rDay)) continue;
    const lDay = state.days[key];
    if (!lDay) { state.days[key] = rDay; changed = true; continue; }
    const lTime = lDay.updatedAt || "";
    const rTime = rDay.updatedAt || "";
    if (rTime > lTime) { state.days[key] = rDay; changed = true; }
  }
  return changed;
}

async function pullAndMerge() {
  if (!cloud || !cloudUser) return;
  setSyncState("syncing");
  try {
    const { data, error } = await cloud
      .from("skincare_state")
      .select("payload, updated_at")
      .eq("user_id", cloudUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data && data.payload) {
      const remote = data.payload;
      const changed = mergeDays(remote.days);
      if (remote.protocolStart && (!state.protocolStart || remote.protocolStart < state.protocolStart)) {
        state.protocolStart = remote.protocolStart;
      }
      if (changed) { saveLocal(); render(); }
    }
    await push();
    setSyncState("ok");
  } catch (err) {
    console.warn("Stažení selhalo:", err);
    setSyncState("error");
  }
}

async function push() {
  if (!cloud || !cloudUser) return;
  pruneEmptyDays();
  const payload = {
    days: state.days,
    phase: state.phase,
    protocolStart: state.protocolStart,
  };
  const { error } = await cloud
    .from("skincare_state")
    .upsert({
      user_id: cloudUser.id,
      payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (error) throw error;
}

function scheduleSync() {
  if (!cloud || !cloudUser) return;
  clearTimeout(syncTimer);
  setSyncState("pending");
  syncTimer = setTimeout(async () => {
    setSyncState("syncing");
    try { await push(); setSyncState("ok"); }
    catch (err) { console.warn("Odeslání selhalo:", err); setSyncState("error"); }
  }, 1500);
}

let syncState = "local";
function setSyncState(s) { syncState = s; renderSyncBadge(); }

function renderSyncBadge() {
  const badge = $("#sync-badge");
  if (!badge) return;
  const map = {
    local:   ["Jen v prohlížeči", "dim"],
    pending: ["Ukládám…",         "dim"],
    syncing: ["Synchronizuji…",   "dim"],
    ok:      ["Synchronizováno",  "ok"],
    error:   ["Sync selhal",      "err"],
  };
  if (!cloudConfigured()) {
    badge.textContent = map.local[0];
    badge.className = "sync-badge dim";
    return;
  }
  if (!cloudUser) {
    badge.textContent = "Nepřihlášen";
    badge.className = "sync-badge dim";
    return;
  }
  const [text, cls] = map[syncState] || map.local;
  badge.textContent = text;
  badge.className = "sync-badge " + cls;
}

function renderAuth() {
  const box = $("#auth");
  if (!box) return;

  if (!cloudConfigured()) {
    box.innerHTML = `
      <div class="band-title">Synchronizace</div>
      <p class="auth-note">
        Zatím není nastavená — data žijí jen v tomto prohlížeči.
        Doplň <code>SUPABASE_URL</code> a <code>SUPABASE_ANON_KEY</code>
        v <code>app.js</code>, viz README.
      </p>
    `;
    return;
  }

  if (cloudUser) {
    box.innerHTML = `
      <div class="band-title">Synchronizace</div>
      <p class="auth-note">Přihlášen jako <b>${cloudUser.email}</b>. Data se ukládají na server.</p>
      <div class="auth-row">
        <button class="btn" id="sync-now">Synchronizovat teď</button>
        <button class="btn ghost" id="logout">Odhlásit</button>
      </div>
      <details class="auth-more">
        <summary>Změnit heslo</summary>
        <div class="auth-row">
          <input type="password" id="newpw" class="auth-input"
                 placeholder="Nové heslo, min. 8 znaků" autocomplete="new-password">
          <button class="btn ghost" id="setpw">Uložit</button>
        </div>
        <p class="auth-msg" id="pw-msg"></p>
      </details>
    `;
    $("#sync-now").onclick = () => pullAndMerge();
    $("#logout").onclick = async () => { await cloud.auth.signOut(); };
    $("#setpw").onclick = async () => {
      const pw = $("#newpw").value;
      const msg = $("#pw-msg");
      if (pw.length < 8) { msg.textContent = "Heslo musí mít aspoň 8 znaků."; return; }
      msg.textContent = "Ukládám…";
      const { error } = await cloud.auth.updateUser({ password: pw });
      msg.textContent = error ? "Nepodařilo se: " + error.message : "Heslo změněno.";
      if (!error) $("#newpw").value = "";
    };
    return;
  }

  box.innerHTML = `
    <div class="band-title">Synchronizace</div>
    <p class="auth-note">Přihlas se, ať máš stejnou historii na mobilu i počítači.</p>
    <div class="auth-col">
      <input type="email" id="email" class="auth-input"
             placeholder="E-mail" autocomplete="username" value="${cloudLastEmail()}">
      <input type="password" id="password" class="auth-input"
             placeholder="Heslo" autocomplete="current-password">
      <button class="btn" id="login">Přihlásit</button>
    </div>
    <p class="auth-msg" id="auth-msg"></p>
    <details class="auth-more">
      <summary>Přihlásit odkazem v e-mailu</summary>
      <p class="auth-note">Když si heslo nepamatuješ. Pozor: Supabase na free tieru pošle jen dva e-maily za hodinu.</p>
      <div class="auth-row">
        <button class="btn ghost" id="magic">Poslat odkaz</button>
      </div>
    </details>
  `;

  const doLogin = async () => {
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const msg = $("#auth-msg");
    if (!email || !password) { msg.textContent = "Vyplň e-mail i heslo."; return; }
    msg.textContent = "Přihlašuji…";
    const { error } = await cloud.auth.signInWithPassword({ email, password });
    if (error) {
      msg.textContent = /Invalid login/.test(error.message)
        ? "Špatný e-mail nebo heslo."
        : "Nepodařilo se přihlásit: " + error.message;
      return;
    }
    localStorage.setItem(LAST_EMAIL_KEY, email);
    msg.textContent = "";
  };

  $("#login").onclick = doLogin;
  $("#password").onkeydown = e => { if (e.key === "Enter") doLogin(); };

  $("#magic").onclick = async () => {
    const email = $("#email").value.trim();
    const msg = $("#auth-msg");
    if (!email) { msg.textContent = "Zadej e-mail."; return; }
    msg.textContent = "Odesílám…";
    /* Čistá adresa bez parametrů a fragmentu — window.location.href by
       po návratu z přihlašovacího odkazu obsahoval token a neodpovídal
       by povolené Redirect URL v Supabase. */
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await cloud.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    msg.textContent = error
      ? (/rate limit/i.test(error.message)
          ? "Limit e-mailů vyčerpán — zkus to za hodinu, nebo se přihlas heslem."
          : "Nepodařilo se odeslat: " + error.message)
      : "Odkaz je na cestě — otevři ho na tomto zařízení.";
  };
}

/* Předvyplnit e-mail z minula, ať se na mobilu nepíše pokaždé. */
function cloudLastEmail() {
  try { return localStorage.getItem(LAST_EMAIL_KEY) || ""; }
  catch { return ""; }
}

/* ============================================================
   EXPORT / IMPORT
   ============================================================ */

function exportData() {
  pruneEmptyDays();
  const blob = new Blob([JSON.stringify({
    days: state.days,
    phase: state.phase,
    protocolStart: state.protocolStart,
    exportedAt: new Date().toISOString(),
  }, null, 2)], { type: "application/json" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `skincare-${dayKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.days) throw new Error("Soubor neobsahuje data.");
      mergeDays(parsed.days);
      if (parsed.protocolStart) state.protocolStart = parsed.protocolStart;
      if (parsed.phase) state.phase = parsed.phase;
      saveLocal();
      scheduleSync();
      render();
      alert("Data načtena.");
    } catch (err) {
      alert("Import selhal: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   START
   ============================================================ */

function init() {
  loadLocal();

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => { activeTab = btn.dataset.tab; render(); };
  });

  $("#export").onclick = exportData;
  $("#import").onchange = e => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  };

  /* Po půlnoci přepnout na nový den, když appka zůstane otevřená. */
  setInterval(() => {
    if (activeTab === "today" && dayKey(viewDate) !== dayKey(new Date())) {
      viewDate = new Date();
      render();
    }
  }, 60000);

  render();
  initCloud();

  /* Offline běh. Přes file:// service worker nejde — to je v pořádku,
     appka funguje i bez něj, jen se nenacachuje. */
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(err => {
      console.warn("Service worker se nezaregistroval:", err);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
