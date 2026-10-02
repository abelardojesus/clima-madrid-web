const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function stateAvailable() {
  return Boolean(REST_URL && REST_TOKEN);
}

async function command(args) {
  const response = await fetch(REST_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Almacén de estado respondió ${response.status}: ${JSON.stringify(data)}`);
  }
  return data.result;
}

export function getValue(key) {
  return command(["GET", key]);
}

export function setValue(key, value) {
  return command(["SET", key, String(value)]);
}
