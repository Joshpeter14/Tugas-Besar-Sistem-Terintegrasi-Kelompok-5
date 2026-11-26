// HTTP client untuk memanggil Service Antrean (yang di-deploy di Vercel).
import { db } from './db.js';
import { HttpError } from './errors.js';

export const antreanBaseUrl = () => (process.env.ANTREAN_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

const insertLog = db.prepare('INSERT INTO log_integrasi (method, url, status, durasi_ms) VALUES (?, ?, ?, ?)');

async function call(method, pathname, body) {
  const url = antreanBaseUrl() + pathname;
  const key = process.env.ANTREAN_API_KEY;
  const started = Date.now();

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(key ? { 'x-api-key': key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(Number(process.env.ANTREAN_TIMEOUT_MS) || 10000),
    });
  } catch (err) {
    insertLog.run(method, url, 0, Date.now() - started);
    throw new HttpError(503, `Service Antrean tidak dapat dihubungi (${err.message})`);
  }
  insertLog.run(method, url, res.status, Date.now() - started);

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    // 4xx dari Service Antrean (misal 404, 409) diteruskan apa adanya.
    // 401/403 berarti konfigurasi API key salah -> 502 Bad Gateway.
    const passThrough = res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403;
    throw new HttpError(passThrough ? res.status : 502, `Service Antrean: ${data?.error || res.statusText}`, data?.details);
  }
  return data;
}

export const antreanApi = {
  health: () => call('GET', '/api/health'),
  getAntrean: (id) => call('GET', `/api/antrean/${id}`),
  listAntrean: (query = {}) => {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
    return call('GET', `/api/antrean${params.size ? `?${params}` : ''}`);
  },
  getPasien: (id) => call('GET', `/api/pasien/${id}`),
  ubahStatus: (id, status) => call('PUT', `/api/antrean/${id}/status`, { status }),
  panggilBerikutnya: (body) => call('POST', '/api/antrean/panggil-berikutnya', body),
  batalkan: (id) => call('DELETE', `/api/antrean/${id}`),
};
