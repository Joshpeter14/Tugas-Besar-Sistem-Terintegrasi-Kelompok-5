// Endpoint untuk ruang periksa dokter. Semuanya meneruskan request ke Service Antrean,
// sehingga keempat method HTTP (GET, POST, PUT, DELETE) dipakai dalam komunikasi antar service.
import { Router } from 'express';
import { antreanApi } from '../antreanClient.js';
import { db } from '../db.js';
import { parseId, requireFields } from '../validate.js';

const router = Router();

// GET -> daftar antrean (contoh: antrean poli 1 yang sedang menunggu)
router.get('/antrean', async (req, res) => {
  const { tanggal, poli_id, status } = req.query;
  res.json(await antreanApi.listAntrean({ tanggal, poli_id, status }));
});

// POST -> panggil pasien berikutnya di poli
router.post('/antrean/panggil-berikutnya', async (req, res) => {
  requireFields(req.body, ['poli_id']);
  res.json(await antreanApi.panggilBerikutnya({ poli_id: req.body.poli_id, tanggal: req.body.tanggal }));
});

// DELETE -> pasien tidak hadir saat dipanggil, antrean dibatalkan
router.delete('/antrean/:id', async (req, res) => {
  res.json(await antreanApi.batalkan(parseId(req.params.id)));
});

// GET -> riwayat kunjungan pasien: data diri dari Service Antrean + rekam medis lokal
router.get('/pasien/:id/riwayat', async (req, res) => {
  const pasienId = parseId(req.params.id);
  const pasien = await antreanApi.getPasien(pasienId);
  const kunjungan = db.prepare('SELECT * FROM kunjungan WHERE pasien_id = ? ORDER BY tanggal_kunjungan DESC, id DESC').all(pasienId);
  res.json({ pasien, jumlah_kunjungan: kunjungan.length, kunjungan });
});

router.get('/log-integrasi', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  res.json(db.prepare('SELECT * FROM log_integrasi ORDER BY id DESC LIMIT ?').all(limit));
});

export default router;
