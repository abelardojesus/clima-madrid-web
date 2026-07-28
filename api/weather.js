const MADRID_LAT = 40.4168;
const MADRID_LON = -3.7038;

export default async function handler(req, res) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${MADRID_LAT}&longitude=${MADRID_LON}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code" +
    "&daily=sunrise,sunset,precipitation_probability_max,temperature_2m_max,temperature_2m_min" +
    "&timezone=Europe%2FMadrid";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo respondió ${response.status}`);
    }
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (error) {
    res.status(502).json({ error: "No se pudo obtener el clima" });
  }
}
