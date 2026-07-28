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
  61: ["Lluvia ligera", "🌧️"],
  63: ["Lluvia moderada", "🌧️"],
  65: ["Lluvia intensa", "🌧️"],
  71: ["Nieve ligera", "🌨️"],
  73: ["Nieve moderada", "🌨️"],
  75: ["Nieve intensa", "🌨️"],
  80: ["Chubascos ligeros", "🌦️"],
  81: ["Chubascos moderados", "🌧️"],
  82: ["Chubascos fuertes", "⛈️"],
  95: ["Tormenta", "⛈️"],
  96: ["Tormenta con granizo", "⛈️"],
  99: ["Tormenta fuerte con granizo", "⛈️"],
};

function nowInMadrid() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );
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

function renderHeader() {
  const madrid = nowInMadrid();
  const hour = madrid.getHours();
  document.getElementById("greeting").textContent = `${greeting(hour)}, Madrid 👋`;

  const dateFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("datetime").textContent =
    `${dateFormatter.format(new Date())} · ${timeFormatter.format(new Date())}`;
}

function renderWeather(data) {
  const card = document.getElementById("weather-card");
  const current = data.current;
  const daily = data.daily;
  const [desc, emoji] = WEATHER_CODES[current.weather_code] || ["Condición desconocida", "🌡️"];

  const sunrise = daily.sunrise[0].slice(11, 16);
  const sunset = daily.sunset[0].slice(11, 16);

  card.innerHTML = `
    <div class="weather-main">
      <span class="weather-emoji">${emoji}</span>
      <div>
        <div class="weather-temp">${Math.round(current.temperature_2m)}°C</div>
        <div class="muted">${desc} · sensación ${Math.round(current.apparent_temperature)}°C</div>
      </div>
    </div>
    <div class="row">
      <div class="weather-detail">
        <div class="label">Máx / mín hoy</div>
        <div class="value">${daily.temperature_2m_max[0]}° / ${daily.temperature_2m_min[0]}°</div>
      </div>
      <div class="weather-detail">
        <div class="label">Humedad</div>
        <div class="value">${current.relative_humidity_2m}%</div>
      </div>
      <div class="weather-detail">
        <div class="label">Prob. de lluvia</div>
        <div class="value">${daily.precipitation_probability_max[0]}%</div>
      </div>
      <div class="weather-detail">
        <div class="label">Viento</div>
        <div class="value">${current.wind_speed_10m} km/h</div>
      </div>
      <div class="weather-detail">
        <div class="label">Amanece / anochece</div>
        <div class="value">${sunrise} · ${sunset}</div>
      </div>
    </div>
  `;

  const recCard = document.getElementById("recommendation");
  recCard.hidden = false;
  recCard.innerHTML = `👕 <strong>Para salir a trabajar:</strong> ${recommendation(
    current.apparent_temperature,
    daily.precipitation_probability_max[0],
    current.wind_speed_10m
  )}`;
}

function renderNews(news) {
  const container = document.getElementById("news");
  container.innerHTML = "";

  Object.entries(news).forEach(([category, items]) => {
    const card = document.createElement("div");
    card.className = "card news-card";

    const itemsHtml = items.length
      ? items
          .map(
            (item, i) => `
        <div class="news-item">
          <span class="num">${i + 1}.</span>
          ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>` : item.title}
          <span class="source">📎 ${item.source}</span>
        </div>`
          )
          .join("")
      : `<p class="muted">Sin noticias disponibles ahora mismo</p>`;

    card.innerHTML = `<h2>📰 ${category}</h2>${itemsHtml}`;
    container.appendChild(card);
  });
}

async function loadWeather() {
  try {
    const response = await fetch("/api/weather");
    if (!response.ok) throw new Error("weather request failed");
    renderWeather(await response.json());
  } catch (error) {
    document.getElementById("weather-card").innerHTML =
      '<p class="error">No se pudo cargar el clima. Intenta recargar la página.</p>';
  }
}

async function loadNews() {
  try {
    const response = await fetch("/api/news");
    if (!response.ok) throw new Error("news request failed");
    renderNews(await response.json());
  } catch (error) {
    document.getElementById("news").innerHTML =
      '<p class="error">No se pudieron cargar las noticias. Intenta recargar la página.</p>';
  }
}

renderHeader();
loadWeather();
loadNews();
