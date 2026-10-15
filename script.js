const WEATHER_CODES = {
  0: ["Cielo despejado", "☀️"],
  1: ["Mayormente despejado", "🌤️"],
  2: ["Parcialmente nublado", "⛅"],
  3: ["Nublado", "☁️"],
  45: ["Niebla", "🌫️"],
  48: ["Niebla con escarcha", "🌫️"],
  51: ["Llovizna ligera", "🌦️"],
  53: ["Llovizna moderada", "🌦️"],
  55: ["Llovizna intensa", "🌧️"],
  56: ["Llovizna helada ligera", "🌧️"],
  57: ["Llovizna helada intensa", "🌧️"],
  61: ["Lluvia ligera", "🌧️"],
  63: ["Lluvia moderada", "🌧️"],
  65: ["Lluvia intensa", "🌧️"],
  66: ["Lluvia helada ligera", "🌧️"],
  67: ["Lluvia helada intensa", "🌧️"],
  71: ["Nieve ligera", "🌨️"],
  73: ["Nieve moderada", "🌨️"],
  75: ["Nieve intensa", "🌨️"],
  77: ["Granos de nieve", "🌨️"],
  80: ["Chubascos ligeros", "🌦️"],
  81: ["Chubascos moderados", "🌧️"],
  82: ["Chubascos fuertes", "⛈️"],
  85: ["Chubascos de nieve ligeros", "🌨️"],
  86: ["Chubascos de nieve fuertes", "🌨️"],
  95: ["Tormenta", "⛈️"],
  96: ["Tormenta con granizo", "⛈️"],
  99: ["Tormenta fuerte con granizo", "⛈️"],
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 12 * 1000;
const TIME_ZONE = "Europe/Madrid";

// Phosphor Icons (MIT): warning-circle
const WARNING_ICON_PATH =
  "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z";

const els = {
  greeting: document.getElementById("greeting"),
  datetime: document.getElementById("datetime"),
  barTitle: document.getElementById("bar-title"),
  status: document.getElementById("status"),
  refresh: document.getElementById("refresh"),
  weather: document.getElementById("weather-card"),
  week: document.getElementById("week-card"),
  news: document.getElementById("news"),
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const hourFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  hourCycle: "h23",
});
const weekdayFormatter = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, weekday: "short" });
const mmFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const relativeFormatter = new Intl.RelativeTimeFormat("es", { numeric: "auto", style: "short" });

// Construye nodos DOM sin innerHTML: los titulares y enlaces vienen de feeds externos.
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value);
  }
  node.append(...children.filter((child) => child != null));
  return node;
}

function warningIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 256 256");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", WARNING_ICON_PATH);
  svg.append(path);
  return svg;
}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function weatherInfo(code, isDay = 1) {
  const [desc, emoji] = WEATHER_CODES[code] ?? ["Condición desconocida", "🌡️"];
  if (!isDay && (code === 0 || code === 1)) return [desc, "🌙"];
  if (!isDay && code === 2) return [desc, "☁️"];
  return [desc, emoji];
}

function round(value, suffix = "") {
  return Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "N/D";
}

function greeting(hour) {
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function recommendation(apparentTemp, rainProb, windSpeed) {
  const tips = [];
  if (rainProb >= 40) tips.push("lleva paraguas");
  if (apparentTemp <= 10) tips.push("abrígate bien, hace frío");
  else if (apparentTemp <= 17) tips.push("chaqueta recomendada");
  else if (apparentTemp >= 28) tips.push("ropa ligera, hace calor");
  if (windSpeed >= 30) tips.push("cuidado con el viento fuerte");
  if (tips.length === 0) tips.push("condiciones normales, sin nada especial que llevar");
  const joined = tips.join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

function relativeTime(iso) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return "ahora";
  if (minutes < 60) return relativeFormatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relativeFormatter.format(-hours, "hour");
  return relativeFormatter.format(-Math.round(hours / 24), "day");
}

function renderHeader() {
  const now = new Date();
  els.greeting.textContent = `${greeting(Number(hourFormatter.format(now)))}, Madrid`;
  els.barTitle.textContent = els.greeting.textContent;
  const date = dateFormatter.format(now);
  els.datetime.textContent = date.charAt(0).toUpperCase() + date.slice(1);
}

function refreshRelativeTimes() {
  for (const time of document.querySelectorAll("time[datetime]")) {
    time.textContent = relativeTime(time.dateTime);
  }
}

function retryButton() {
  const button = h("button", { class: "btn", type: "button", text: "Reintentar" });
  button.addEventListener("click", () => refreshAll({ fresh: true }));
  return button;
}

function errorMessage(text) {
  return h("p", { class: "panel-message", role: "alert" }, warningIcon(), h("span", { text }), retryButton());
}

function renderHours(data) {
  const hourly = data.hourly;
  if (!hourly?.time?.length) return null;
  const nowHour = `${data.current.time.slice(0, 13)}:00`;
  const items = [];
  hourly.time.forEach((time, i) => {
    if (time < nowHour) return;
    const [desc, emoji] = weatherInfo(hourly.weather_code[i], hourly.is_day?.[i]);
    items.push(
      h(
        "li",
        { class: "hour" },
        h("span", { class: "hour-time", text: items.length === 0 ? "Ahora" : time.slice(11, 16) }),
        h("span", { class: "hour-icon", role: "img", "aria-label": desc, text: emoji }),
        h("span", { class: "hour-temp", text: round(hourly.temperature_2m[i], "°") }),
        h(
          "span",
          { class: "hour-rain" },
          h("span", { class: "sr-only", text: "Lluvia " }),
          round(hourly.precipitation_probability[i], "%")
        )
      )
    );
  });
  if (!items.length) return null;
  return h(
    "div",
    { class: "hours-wrap" },
    h("h2", { class: "sub-title", text: "Hoy, hora a hora" }),
    h("ol", { class: "hours", tabindex: "0", role: "region", "aria-label": "Evolución por horas, desplázate para ver más" }, ...items)
  );
}

function renderToday(data) {
  const { current, daily } = data;
  const [desc, emoji] = weatherInfo(current.weather_code);
  const sunrise = daily.sunrise?.[0]?.slice(11, 16) ?? "N/D";
  const sunset = daily.sunset?.[0]?.slice(11, 16) ?? "N/D";
  const stat = (label, value) => h("div", {}, h("dt", { text: label }), h("dd", { text: value }));

  els.weather.replaceChildren(
    h(
      "div",
      { class: "weather-main" },
      h("span", { class: "weather-emoji", "aria-hidden": "true", text: emoji }),
      h(
        "div",
        {},
        h("div", { class: "weather-temp", text: round(current.temperature_2m, "°C") }),
        h("p", { class: "weather-desc", text: `${desc} · sensación ${round(current.apparent_temperature, "°C")}` })
      )
    ),
    h(
      "dl",
      { class: "weather-stats" },
      stat("Máx / mín hoy", `${round(daily.temperature_2m_max?.[0], "°")} / ${round(daily.temperature_2m_min?.[0], "°")}`),
      stat("Humedad", round(current.relative_humidity_2m, "%")),
      stat("Prob. de lluvia", round(daily.precipitation_probability_max?.[0], "%")),
      stat("Viento", round(current.wind_speed_10m, " km/h")),
      stat("Amanece / anochece", `${sunrise} · ${sunset}`)
    ),
    renderHours(data),
    h(
      "p",
      { class: "advice" },
      h("strong", { text: "Para salir a trabajar: " }),
      recommendation(
        current.apparent_temperature,
        daily.precipitation_probability_max?.[0],
        current.wind_speed_10m
      )
    )
  );
  els.weather.setAttribute("aria-busy", "false");
}

function dayLabel(date, index) {
  if (index === 0) return "Hoy";
  if (index === 1) return "Mañana";
  return weekdayFormatter.format(new Date(`${date}T12:00:00Z`)).replace(".", "");
}

function renderWeek(daily) {
  if (!daily?.time?.length) {
    els.week.hidden = true;
    return;
  }
  // Escala común para toda la semana: las barras son comparables entre días.
  const lo = Math.min(...daily.temperature_2m_min);
  const hi = Math.max(...daily.temperature_2m_max);
  const span = Math.max(hi - lo, 1);

  const rows = daily.time.map((date, i) => {
    const [desc, emoji] = weatherInfo(daily.weather_code[i]);
    const min = daily.temperature_2m_min[i];
    const max = daily.temperature_2m_max[i];
    const rain = daily.precipitation_probability_max[i];
    const mm = daily.precipitation_sum?.[i];
    const wind = daily.wind_speed_10m_max?.[i];

    const range = h("span", { class: "range", "aria-hidden": "true" }, h("span", { class: "range-fill" }));
    range.style.setProperty("--l", `${(((min - lo) / span) * 100).toFixed(1)}%`);
    range.style.setProperty("--w", `${(((max - min) / span) * 100).toFixed(1)}%`);

    return h(
      "li",
      { class: "day" },
      h(
        "span",
        { class: "day-name" },
        dayLabel(date, i),
        wind >= 30 ? h("span", { class: "day-note", text: `viento ${Math.round(wind)} km/h` }) : null
      ),
      h("span", { class: "day-icon", role: "img", "aria-label": desc, text: emoji }),
      h(
        "span",
        { class: "day-rain" },
        h("span", { class: "sr-only", text: "Lluvia " }),
        round(rain, "%"),
        mm >= 0.1 ? h("span", { class: "day-mm", text: `${mmFormatter.format(mm)} mm` }) : null
      ),
      h("span", { class: "day-min" }, h("span", { class: "sr-only", text: "Mínima " }), round(min, "°")),
      range,
      h("span", { class: "day-max" }, h("span", { class: "sr-only", text: "Máxima " }), round(max, "°"))
    );
  });

  els.week.replaceChildren(h("h2", { id: "week-title", text: "Próximos 7 días" }), h("ul", { class: "days" }, ...rows));
  els.week.setAttribute("aria-labelledby", "week-title");
  els.week.removeAttribute("aria-label");
  els.week.setAttribute("aria-busy", "false");
  els.week.hidden = false;
}

function renderWeather(data) {
  renderToday(data);
  renderWeek(data.daily);
}

function renderWeekSkeleton() {
  const row = () => h("li", { class: "day" }, h("span", { class: "skeleton sk-line sk-day" }));
  els.week.replaceChildren(
    h("span", { class: "skeleton sk-title" }),
    h("ul", { class: "days", "aria-hidden": "true" }, row(), row(), row(), row(), row(), row(), row())
  );
  els.week.hidden = false;
}

function renderNewsItem(item, index, order) {
  const hasLink = isHttpUrl(item.link);
  const li = h("li", { class: "news-item" });
  li.style.setProperty("--i", String(Math.min(order, 12)));

  if (isHttpUrl(item.image)) {
    const img = h("img", {
      class: "news-thumb",
      src: item.image,
      alt: "",
      width: 76,
      height: 76,
      loading: order < 2 ? "eager" : "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    });
    img.addEventListener("error", () => li.classList.add("no-image"), { once: true });
    li.append(img);
  } else {
    li.classList.add("no-image");
  }

  const title = hasLink
    ? h(
        "a",
        { class: "news-link", href: item.link, target: "_blank", rel: "noopener noreferrer" },
        item.title,
        h("span", { class: "sr-only", text: " (se abre en una pestaña nueva)" })
      )
    : item.title;

  const meta = h("p", { class: "news-meta" }, h("span", { text: item.source }));
  if (item.published && !Number.isNaN(Date.parse(item.published))) {
    meta.append(h("time", { datetime: item.published, text: relativeTime(item.published) }));
  }

  li.append(
    h(
      "div",
      { class: "news-text" },
      h("span", { class: "num", "aria-hidden": "true", text: `${index + 1}.` }),
      h("p", { class: "news-title" }, title),
      meta
    )
  );
  return li;
}

function renderNewsSkeleton() {
  const row = () =>
    h(
      "li",
      { class: "news-item", "aria-hidden": "true" },
      h("span", { class: "skeleton sk-thumb" }),
      h("span", { class: "sk-rows" }, h("span", { class: "skeleton sk-line" }), h("span", { class: "skeleton sk-line sk-short" }))
    );
  const board = () =>
    h(
      "div",
      { class: "card board", "aria-hidden": "true" },
      h("span", { class: "skeleton sk-title" }),
      h("ul", { class: "news-list" }, row(), row(), row())
    );
  els.news.replaceChildren(board(), board(), board(), board());
}

function renderNews(news) {
  let order = 0;
  const boards = Object.entries(news).map(([category, items], boardIndex) => {
    const headingId = `board-${boardIndex}`;
    return h(
      "section",
      { class: "card board", "aria-labelledby": headingId },
      h("h2", { id: headingId, text: category }),
      items.length
        ? h("ol", { class: "news-list" }, ...items.map((item, i) => renderNewsItem(item, i, order++)))
        : h("p", { class: "panel-empty", text: "Sin noticias en este tablón ahora mismo. Prueba a actualizar en unos minutos." })
    );
  });
  els.news.replaceChildren(...boards);
  els.news.setAttribute("aria-busy", "false");
}

const sections = {
  weather: {
    label: "el clima",
    url: "/api/weather",
    updatedAt: null,
    failed: false,
    render: renderWeather,
    renderError: () => {
      els.weather.replaceChildren(errorMessage("No se pudo cargar el clima de Madrid."));
      els.weather.setAttribute("aria-busy", "false");
      els.week.hidden = true;
    },
  },
  news: {
    label: "las noticias",
    url: "/api/news",
    updatedAt: null,
    failed: false,
    signature: "",
    render(data) {
      const signature = JSON.stringify(data);
      if (signature === this.signature) return;
      this.signature = signature;
      renderNews(data);
    },
    renderError: () => {
      els.news.replaceChildren(h("div", { class: "card" }, errorMessage("No se pudieron cargar las noticias.")));
      els.news.setAttribute("aria-busy", "false");
    },
  },
};

async function fetchJson(url, fresh) {
  // Con ?t= el CDN de Vercel no sirve la copia en caché: así "Actualizar" siempre trae datos nuevos.
  const target = fresh ? `${url}?t=${Date.now()}` : url;
  const response = await fetch(target, {
    cache: "no-cache",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${url} respondió ${response.status}`);
  return response.json();
}

async function loadSection(section, fresh) {
  try {
    section.render(await fetchJson(section.url, fresh));
    section.updatedAt = Date.now();
    section.failed = false;
  } catch {
    section.failed = true;
    if (!section.updatedAt) section.renderError();
  }
}

function updateStatus() {
  const failed = Object.values(sections).filter((section) => section.failed);
  if (failed.length) {
    const names = failed.map((section) => section.label).join(" ni ");
    els.status.textContent = `No se pudo actualizar ${names}. Reintenta en un momento.`;
    els.status.dataset.state = "error";
    return;
  }
  delete els.status.dataset.state;
  els.status.textContent = `Actualizado a las ${timeFormatter.format(new Date())}`;
}

let inFlight = null;
let lastAttemptAt = 0;

function refreshAll({ fresh = false } = {}) {
  if (inFlight) return inFlight;
  lastAttemptAt = Date.now();
  renderHeader();
  els.refresh.disabled = true;
  delete els.status.dataset.state;
  els.status.textContent = "Actualizando…";

  inFlight = Promise.all([loadSection(sections.weather, fresh), loadSection(sections.news, fresh)]).finally(() => {
    inFlight = null;
    els.refresh.disabled = false;
    updateStatus();
  });
  return inFlight;
}

els.refresh.addEventListener("click", () => refreshAll({ fresh: true }));

setInterval(() => {
  renderHeader();
  refreshRelativeTimes();
  if (document.visibilityState === "visible" && Date.now() - lastAttemptAt >= REFRESH_INTERVAL_MS) {
    refreshAll();
  }
}, 60 * 1000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - lastAttemptAt >= STALE_AFTER_MS) {
    refreshAll();
  }
});

window.addEventListener("online", () => refreshAll({ fresh: true }));

renderNewsSkeleton();
renderWeekSkeleton();
refreshAll();
