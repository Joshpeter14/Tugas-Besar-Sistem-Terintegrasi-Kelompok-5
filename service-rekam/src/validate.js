import { HttpError } from './errors.js';

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw new HttpError(400, `Field wajib belum diisi: ${missing.join(', ')}`);
}

export function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body?.[f] !== undefined) out[f] = body[f];
  return out;
}

export function parseId(value, label = 'ID') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} harus bilangan bulat positif`);
  return n;
}

export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
