import { fetchForecast } from "../lib/weather.js";

const HOURS_PER_DAY = 24;

export default async function handler(req, res) {
  try {
    const data = await fetchForecast();
    // La previsión por horas cubre 7 días; la web solo necesita las de hoy.
    if (data.hourly) {
      for (const key of Object.keys(data.hourly)) data.hourly[key] = data.hourly[key].slice(0, HOURS_PER_DAY);
    }
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    res.status(200).json(data);
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "No se pudo obtener el clima" });
  }
}
