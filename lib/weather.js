const MADRID_LAT = 40.4168;
const MADRID_LON = -3.7038;

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${MADRID_LAT}&longitude=${MADRID_LON}` +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
  "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
  "&daily=weather_code,sunrise,sunset,temperature_2m_max,temperature_2m_min," +
  "precipitation_probability_max,precipitation_sum,wind_speed_10m_max" +
  "&forecast_days=7&timezone=Europe%2FMadrid";

// Única petición a Open-Meteo: la usan la web (api/weather.js) y Telegram (lib/clima.js).
export async function fetchForecast() {
  const response = await fetch(FORECAST_URL, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
  return response.json();
}
