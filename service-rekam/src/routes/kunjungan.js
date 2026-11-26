import { Router } from 'express';
import { antreanApi } from '../antreanClient.js';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { isDate, parseId, pick, requireFields } from '../validate.js';

const router = Router();

const MEDIS = [
  'dokter',
  'anamnesis',
  'tekanan_darah',
  'suhu',
  'berat_badan',
  'diagnosa',
  'kode_icd10',
  'tindakan',
  'resep',
  'catatan',
];

const getById = db.prepare('SELECT * FROM kunjungan WHERE id = ?');
const getByAntrean = db.prepare('SELECT * FROM kunjungan WHERE antrean_id = ?');
const deleteById = db.prepare('DELETE FROM kunjungan WHERE id = ?');

function getOr404(id) {
  const row = getById.get(id);
  if (!row) throw new HttpError(404, 'Rekam kunjungan tidak ditemukan');
  return row;
}

function validateMedis(data) {
  for (const f of ['suhu', 'berat_badan']) {
    if (data[f] !== undefined && data[f] !== null && !Number.isFinite(Number(data[f]))) {
      throw new HttpError(400, `${f} harus berupa angka`);
    }
    if (data[f] !== undefined && data[f] !== null) data[f] = Number(data[f]);
  }
  for (const [k, v] of Object.entries(data)) if (v === undefined) data[k] = null;
  return data;
}

// GET /api/kunjungan?pasien_id=1&tanggal=2026-11-24&antrean_id=3
router.get('/', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.pasien_id) {
    where.push('pasien_id = ?');
    params.push(parseId(req.query.pasien_id, 'pasien_id'));
  }
  if (req.query.antrean_id) {
    where.push('antrean_id = ?');
    params.push(parseId(req.query.antrean_id, 'antrean_id'));
  }
  if (req.query.tanggal) {
    if (!isDate(req.query.tanggal)) throw new HttpError(400, 'tanggal harus format YYYY-MM-DD');
    where.push('tanggal_kunjungan = ?');
    params.push(req.query.tanggal);
  }
  const sql = `SELECT * FROM kunjungan ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  res.json(getOr404(parseId(req.params.id)));
});

// Buat rekam kunjungan dari antrean yang sedang dipanggil.
// Alur integrasi:
//   1. GET  Service Antrean /api/antrean/:id        -> validasi antrean ada & berstatus 'dipanggil'
//   2. INSERT rekam kunjungan ke SQLite lokal
//   3. PUT  Service Antrean /api/antrean/:id/status -> tandai antrean 'selesai'
//   Jika langkah 3 gagal, rekam lokal dihapus lagi (kompensasi) agar data kedua service konsisten.
router.post('/', async (req, res) => {
  requireFields(req.body, ['antrean_id', 'dokter', 'diagnosa']);
  const antreanId = parseId(req.body.antrean_id, 'antrean_id');
  if (getByAntrean.get(antreanId)) throw new HttpError(409, 'Antrean ini sudah memiliki rekam kunjungan');

  const antrean = await antreanApi.getAntrean(antreanId);
  if (antrean.status !== 'dipanggil') {
    throw new HttpError(409, `Antrean harus berstatus 'dipanggil' untuk diperiksa (status sekarang: '${antrean.status}')`);
  }

  const medis = validateMedis(Object.fromEntries(MEDIS.map((f) => [f, req.body[f]])));
  const result = db
    .prepare(
      `INSERT INTO kunjungan (antrean_id, nomor_antrean, pasien_id, no_rm, nama_pasien, poli, tanggal_kunjungan, ${MEDIS.join(', ')})
       VALUES (?, ?, ?, ?, ?, ?, ?, ${MEDIS.map(() => '?').join(', ')})`,
    )
    .run(
      antrean.id,
      antrean.nomor,
      antrean.pasien_id,
      antrean.pasien?.no_rm ?? null,
      antrean.pasien?.nama ?? null,
      antrean.poli?.nama ?? null,
      antrean.tanggal,
      ...MEDIS.map((f) => medis[f]),
    );
  const id = Number(result.lastInsertRowid);

  let antreanSelesai;
  try {
    antreanSelesai = await antreanApi.ubahStatus(antrean.id, 'selesai');
  } catch (err) {
    deleteById.run(id);
    throw err;
  }

  res.status(201).json({ kunjungan: getById.get(id), antrean: antreanSelesai });
});

// Ubah data medis (data lokal saja, tidak memanggil Service Antrean)
router.put('/:id', (req, res) => {
  const row = getOr404(parseId(req.params.id));
  const data = pick(req.body, MEDIS);
  if (!Object.keys(data).length) throw new HttpError(400, `Field yang bisa diubah: ${MEDIS.join(', ')}`);
  for (const f of ['dokter', 'diagnosa']) {
    if (f in data && !data[f]) throw new HttpError(400, `${f} tidak boleh kosong`);
  }
  validateMedis(data);
  const cols = Object.keys(data);
  db.prepare(
    `UPDATE kunjungan SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(...cols.map((c) => data[c]), row.id);
  res.json(getById.get(row.id));
});

// Hapus rekam kunjungan (misal salah input). Antrean di Service Antrean dikembalikan ke 'dipanggil'
// supaya pasien bisa direkam ulang.
router.delete('/:id', async (req, res) => {
  const row = getOr404(parseId(req.params.id));
  let antrean = null;
  try {
    antrean = await antreanApi.ubahStatus(row.antrean_id, 'dipanggil');
  } catch (err) {
    // Antrean sudah tidak ada / statusnya sudah berubah: rekam lokal tetap boleh dihapus.
    if (err.status !== 404 && err.status !== 409) throw err;
  }
  deleteById.run(row.id);
  res.json({ message: 'Rekam kunjungan berhasil dihapus', antrean });
});

export default router;
