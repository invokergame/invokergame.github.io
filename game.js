const STORAGE_KEY = "azure-save-v3";
const API_KEY = "azure-api-v3";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const FAST_MODEL_ALLOWLIST = [
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "google/gemma-2-2b-it:free",
  "qwen/qwen2.5-7b-instruct:free",
];

const SETTINGS = [
  {
    id: "academy",
    title: "Академия шести домов",
    desc: "Экзамены, дуэли, фракции и рывок от новичка к элите.",
    seedChoices: ["Пройти вступительный экзамен", "Выбрать дом наставника", "Вызвать старшекурсника на дуэль"],
  },
  {
    id: "rift",
    title: "Разломы и гильдии",
    desc: "Охота в порталах, рейды и рост ранга в лиге охотников.",
    seedChoices: ["Войти в нестабильный разлом", "Взять контракт гильдии", "Собрать экспедицию"],
  },
  {
    id: "kingdom",
    title: "Пограничное королевство",
    desc: "Мана-рыцари, тайные ордена и интриги у трона.",
    seedChoices: ["Присягнуть ордену клинка", "Разведать руины у границы", "Попросить аудиенцию у герцога"],
  },
];

const state = {
  day: 1,
  level: 1,
  rank: "Новик",
  setting: null,
  hp: 100,
  maxHp: 100,
  mana: 10,
  maxMana: 10,
  power: 6,
  agility: 6,
  insight: 6,
  xp: 0,
  shards: 0,
  lastChoices: [],
  log: [],
  gameOver: false,
};

const $ = (id) => document.getElementById(id);
const statsEl = $("stats");
const logEl = $("log");
const choicesEl = $("choices");
const customActionEl = $("customAction");
const customActionBtn = $("customActionBtn");
const newRunBtn = $("newRunBtn");

const settingCardsEl = $("settingCards");
const startRunBtn = $("startRunBtn");
const settingPickerEl = $("settingPicker");
const settingStatusEl = $("settingStatus");

const apiBaseEl = $("apiBase");
const apiModelEl = $("apiModel");
const apiKeyEl = $("apiKey");
const saveApiBtn = $("saveApiBtn");
const findFastFreeModelBtn = $("findFastFreeModelBtn");
const testApiBtn = $("testApiBtn");
const apiStatusEl = $("apiStatus");

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function xpNeed(level) { return 30 + level * 20; }
function rankOf(level) {
  if (level >= 20) return "Архонт";
  if (level >= 12) return "Адепт";
  if (level >= 6) return "Инициат";
  return "Новик";
}

function addLog(kind, text) {
  state.log.push({ kind, text });
  if (state.log.length > 80) state.log.shift();
}

function validateFastModel(model) {
  if (!model) return false;
  if (FAST_MODEL_ALLOWLIST.includes(model)) return true;
  const m = model.toLowerCase();
  return m.includes(":free") && (m.includes("mini") || m.includes("3b") || m.includes("2b"));
}

function loadApiConfig() {
  try {
    return { base: OPENROUTER_BASE, model: FAST_MODEL_ALLOWLIST[0], key: "", ...JSON.parse(localStorage.getItem(API_KEY) || "{}") };
  } catch {
    return { base: OPENROUTER_BASE, model: FAST_MODEL_ALLOWLIST[0], key: "" };
  }
}

function saveApiConfig(cfg) { localStorage.setItem(API_KEY, JSON.stringify(cfg)); }
function saveGame() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    Object.assign(state, JSON.parse(raw));
    return true;
  } catch { return false; }
}

function renderSettingCards() {
  settingCardsEl.innerHTML = SETTINGS.map((s) => `
    <article class="setting-card ${state.setting === s.id ? "active" : ""}" data-id="${s.id}">
      <strong>${s.title}</strong>
      <p>${s.desc}</p>
    </article>
  `).join("");

  settingCardsEl.querySelectorAll(".setting-card").forEach((el) => {
    el.addEventListener("click", () => {
      state.setting = el.dataset.id;
      renderSettingCards();
    });
  });
}

function renderStats() {
  const settingTitle = SETTINGS.find((s) => s.id === state.setting)?.title || "Не выбрано";
  const stats = [
    ["Имя", "Пробужденный"],
    ["Линия", settingTitle],
    ["Ранг", state.rank],
    ["Уровень", state.level],
    ["HP", `${state.hp}/${state.maxHp}`],
    ["MP", `${state.mana}/${state.maxMana}`],
    ["Сила", state.power],
    ["Ловкость", state.agility],
    ["Разум", state.insight],
    ["Осколки", state.shards],
    ["XP", `${state.xp}/${xpNeed(state.level)}`],
    ["День", state.day],
  ];

  statsEl.innerHTML = stats.map(([label, value]) => `<article class="stat"><div class="label">${label}</div><div class="value">${value}</div></article>`).join("");
}

function renderLog() {
  logEl.innerHTML = state.log.map((e) => `<article class="entry ${e.kind}">${e.text}</article>`).join("");
  logEl.scrollTop = logEl.scrollHeight;
}

function renderChoices() {
  if (!state.setting) {
    choicesEl.innerHTML = "<p class='muted'>Сначала выбери сеттинг и начни путь.</p>";
    return;
  }
  if (state.gameOver) {
    choicesEl.innerHTML = "<p class='muted'>Путь завершён. Нажми «Новый путь».</p>";
    return;
  }

  choicesEl.innerHTML = "";
  state.lastChoices.forEach((text) => {
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = text;
    btn.addEventListener("click", () => act(text));
    choicesEl.appendChild(btn);
  });
}

function render() {
  settingPickerEl.style.display = state.setting ? "none" : "block";
  renderSettingCards();
  renderStats();
  renderLog();
  renderChoices();
}

function gainXp(x) {
  state.xp += Math.max(0, x);
  while (state.xp >= xpNeed(state.level)) {
    state.xp -= xpNeed(state.level);
    state.level += 1;
    state.maxHp += 10;
    state.maxMana += 1;
    state.hp = state.maxHp;
    state.mana = state.maxMana;
    state[pick(["power", "agility", "insight"])] += 1;
    state.rank = rankOf(state.level);
    addLog("system", `Прорыв на уровень ${state.level}. Ранг: ${state.rank}.`);
  }
}

function offlineScene(actionText) {
  const st = SETTINGS.find((s) => s.id === state.setting);
  const hard = Math.random() < Math.min(0.68, 0.2 + state.level * 0.03);
  if (hard) {
    return {
      text: `Ты выбираешь: «${actionText}». Испытание оказывается тяжелее, чем ожидалось, но ты удерживаешь темп и вырываешь победу у противника.`,
      outcome: { hp: -(7 + Math.floor(Math.random() * 9)), mana: -2, xp: 14 + state.level, shards: 2 + Math.floor(Math.random() * 3) },
      choices: ["Усилить защитную технику", "Разобрать трофеи", "Принять следующий вызов"],
    };
  }
  return {
    text: `Ты выполняешь: «${actionText}». Манапоток стабилен, а твоя стратегия идеально ложится в ритм боя.` ,
    outcome: { hp: -Math.floor(Math.random() * 3), mana: -1, xp: 10 + state.level, shards: 3 + Math.floor(Math.random() * 4) },
    choices: st ? st.seedChoices : ["Продолжить путь", "Взять контракт", "Отдохнуть у костра"],
  };
}

async function pickFastFreeModelFromOpenRouter() {
  const key = apiKeyEl.value.trim();
  if (!key) throw new Error("Нужен API Key");
  const res = await fetch(`${OPENROUTER_BASE}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`OpenRouter /models: ${res.status}`);
  const data = await res.json();
  const models = (Array.isArray(data?.data) ? data.data : []).map((m) => String(m?.id || ""));
  const best = models.filter(validateFastModel).sort((a,b)=>a.localeCompare(b))[0];
  if (!best) throw new Error("Быстрые free модели не найдены");
  return best;
}

async function aiScene(actionText) {
  const cfg = loadApiConfig();
  if (!cfg.key || !cfg.model) return null;
  if (!validateFastModel(cfg.model)) throw new Error("Разрешены только быстрые модели");

  const settingTitle = SETTINGS.find((s) => s.id === state.setting)?.title || "";
  const system = {
    role: "system",
    content: "Ты ведущий тёмно-фэнтезийной прогрессии (академии, разломы, ранги, мана). Без отсылок к существующим произведениям и уникальным именам. Ответ только JSON: {text:string,outcome:{hp:number,mana:number,xp:number,shards:number},choices:string[]}. 2-4 предложения.",
  };
  const user = {
    role: "user",
    content: JSON.stringify({ actionText, setting: settingTitle, state: { day: state.day, level: state.level, rank: state.rank, hp: state.hp, mana: state.mana } }),
  };

  const res = await fetch(`${cfg.base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, response_format: { type: "json_object" }, temperature: 0.65, max_tokens: 220, messages: [system, user] }),
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return {
      text: String(parsed?.text || "Сцена не распознана."),
      outcome: {
        hp: Number(parsed?.outcome?.hp || 0),
        mana: Number(parsed?.outcome?.mana || 0),
        xp: Number(parsed?.outcome?.xp || 0),
        shards: Number(parsed?.outcome?.shards || 0),
      },
      choices: Array.isArray(parsed?.choices) ? parsed.choices.slice(0, 4).map(String) : [],
    };
  } catch {
    return null;
  }
}

async function act(actionText) {
  if (state.gameOver || !state.setting) return;
  if (state.mana <= 0) {
    addLog("system", "Тебе нужен короткий отдых перед новым рывком.");
    render();
    return;
  }

  addLog("system", `> ${actionText}`);
  let scene = null;
  try {
    scene = await aiScene(actionText);
  } catch (e) {
    addLog("system", `AI недоступен: ${e.message}. Использую локального рассказчика.`);
  }
  if (!scene) scene = offlineScene(actionText);

  state.hp = clamp(state.hp + (scene.outcome.hp || 0), 0, state.maxHp);
  state.mana = clamp(state.mana + (scene.outcome.mana || 0), 0, state.maxMana);
  state.shards = Math.max(0, state.shards + (scene.outcome.shards || 0));
  gainXp(scene.outcome.xp || 0);
  state.day += 1;

  addLog("event", scene.text);
  state.lastChoices = scene.choices.length ? scene.choices : ["Продолжить путь", "Пройти испытание", "Изучить ману"];

  if (state.hp <= 0) {
    state.gameOver = true;
    addLog("system", "Ты пал в бою. Нужен новый путь.");
  }

  if (state.mana <= 0 && !state.gameOver) {
    state.mana = Math.min(state.maxMana, state.mana + 4);
    state.hp = Math.min(state.maxHp, state.hp + 10);
    addLog("system", "Короткая медитация: +4 MP и частичное восстановление HP.");
  }

  saveGame();
  render();
}

function resetRun() {
  const selected = SETTINGS.find((s) => s.id === state.setting);
  state.day = 1;
  state.level = 1;
  state.rank = "Новик";
  state.hp = 100;
  state.maxHp = 100;
  state.mana = 10;
  state.maxMana = 10;
  state.power = 6;
  state.agility = 6;
  state.insight = 6;
  state.xp = 0;
  state.shards = 0;
  state.gameOver = false;
  state.log = [];
  state.lastChoices = selected ? selected.seedChoices : [];

  if (selected) {
    addLog("system", `Старт: «${selected.title}». Ты стоишь на пороге первого большого испытания.`);
  }

  saveGame();
  render();
}

function setupApiUI() {
  const cfg = loadApiConfig();
  apiBaseEl.value = cfg.base || OPENROUTER_BASE;
  apiModelEl.value = cfg.model || FAST_MODEL_ALLOWLIST[0];
  apiKeyEl.value = cfg.key || "";

  saveApiBtn.addEventListener("click", () => {
    const next = { base: apiBaseEl.value.trim() || OPENROUTER_BASE, model: apiModelEl.value.trim(), key: apiKeyEl.value.trim() };
    if (!validateFastModel(next.model)) {
      apiStatusEl.textContent = "Только быстрые модели (:free + mini/2b/3b).";
      return;
    }
    saveApiConfig(next);
    apiStatusEl.textContent = "Сохранено.";
  });

  findFastFreeModelBtn.addEventListener("click", async () => {
    apiStatusEl.textContent = "Ищу быструю free модель...";
    try {
      const model = await pickFastFreeModelFromOpenRouter();
      apiBaseEl.value = OPENROUTER_BASE;
      apiModelEl.value = model;
      saveApiConfig({ base: OPENROUTER_BASE, model, key: apiKeyEl.value.trim() });
      apiStatusEl.textContent = `Выбрана: ${model}`;
    } catch (e) {
      apiStatusEl.textContent = `Ошибка: ${e.message}`;
    }
  });

  testApiBtn.addEventListener("click", async () => {
    apiStatusEl.textContent = "Проверка...";
    try {
      const scene = await aiScene("Оценить потоки маны в руинах");
      apiStatusEl.textContent = scene ? "AI готов" : "Нет ответа";
    } catch (e) {
      apiStatusEl.textContent = `Ошибка: ${e.message}`;
    }
  });
}

startRunBtn.addEventListener("click", () => {
  if (!state.setting) {
    settingStatusEl.textContent = "Сначала выбери сеттинг.";
    return;
  }
  settingStatusEl.textContent = "";
  resetRun();
});
newRunBtn.addEventListener("click", resetRun);
customActionBtn.addEventListener("click", () => {
  const v = customActionEl.value.trim();
  if (!v) return;
  customActionEl.value = "";
  act(v);
});
customActionEl.addEventListener("keydown", (e) => { if (e.key === "Enter") customActionBtn.click(); });

setupApiUI();
if (!loadGame()) {
  state.setting = SETTINGS[0].id;
}
render();
