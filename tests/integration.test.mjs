// Tes integrasi end-to-end: menyalakan kedua service (Antrean memakai penyimpanan memori,
// Rekam memakai SQLite in-memory), lalu menjalankan alur klinik lengkap lewat HTTP.
// Jalankan dari root repo: npm test
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_KEY = 'kunci-tes';
const ANTREAN = 'http://localhost:3101';
const REKAM = 'http://localhost:4101';
const procs = [];

function start(dir, env) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(root, dir),
    env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  child.getLog = () => log;
  procs.push(child);
  return child;
}

async function waitFor(url, child) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Service ${url} tidak menyala:\n${child.getLog()}`);
}

async function req(base, method, pathname, body, { key = API_KEY } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  const a = start('service-antrean', { PORT: '3101', API_KEY });
  const r = start('service-rekam', {
    PORT: '4101',
    DB_FILE: ':memory:',
    ANTREAN_API_URL: ANTREAN,
    ANTREAN_API_KEY: API_KEY,
  });
  await waitFor(`${ANTREAN}/api/health`, a);
  await waitFor(`${REKAM}/api/health`, r);
});

after(() => {
  for (const p of procs) p.kill();
});

const state = {};

test('health kedua service & koneksi rekam -> antrean', async () => {
  const a = await req(ANTREAN, 'GET', '/api/health', null, { key: null });
  assert.equal(a.status, 200);
  const r = await req(REKAM, 'GET', '/api/health');
  assert.equal(r.body.antrean.status, 'ok');
});

test('service antrean menolak request tanpa API key', async () => {
  const res = await req(ANTREAN, 'GET', '/api/poli', null, { key: null });
  assert.equal(res.status, 401);
});

test('dokumentasi Swagger tersedia di kedua service', async () => {
  for (const base of [ANTREAN, REKAM]) {
    const res = await fetch(`${base}/openapi.yaml`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /^openapi: 3/);
  }
});

test('CRUD poli & pasien', async () => {
  const poli = await req(ANTREAN, 'GET', '/api/poli');
  assert.equal(poli.body.length, 3);
  state.poliUmum = poli.body.find((p) => p.kode === 'A');

  const baru = await req(ANTREAN, 'POST', '/api/poli', { kode: 'd', nama: 'Poli Lansia' });
  assert.equal(baru.status, 201);
  assert.equal(baru.body.kode, 'D');
  assert.equal((await req(ANTREAN, 'PUT', `/api/poli/${baru.body.id}`, { nama: 'Poli Geriatri' })).body.nama, 'Poli Geriatri');
  assert.equal((await req(ANTREAN, 'DELETE', `/api/poli/${baru.body.id}`)).status, 200);
  assert.equal((await req(ANTREAN, 'GET', `/api/poli/${baru.body.id}`)).status, 404);

  const invalid = await req(ANTREAN, 'POST', '/api/pasien', { nama: 'X', jenis_kelamin: 'L', nik: '123' });
  assert.equal(invalid.status, 400);

  const p1 = await req(ANTREAN, 'POST', '/api/pasien', {
    nama: 'Budi Santoso',
    nik: '3201010101900001',
    jenis_kelamin: 'L',
    tanggal_lahir: '1990-01-01',
  });
  assert.equal(p1.status, 201);
  assert.match(p1.body.no_rm, /^RM-/);
  const p2 = await req(ANTREAN, 'POST', '/api/pasien', { nama: 'Siti Aminah', jenis_kelamin: 'P' });
  state.p1 = p1.body;
  state.p2 = p2.body;

  const dup = await req(ANTREAN, 'POST', '/api/pasien', { nama: 'Lain', jenis_kelamin: 'L', nik: '3201010101900001' });
  assert.equal(dup.status, 409);

  const upd = await req(ANTREAN, 'PUT', `/api/pasien/${state.p2.id}`, { no_hp: '0812' });
  assert.equal(upd.body.no_hp, '0812');
});

test('ambil nomor antrean otomatis per poli', async () => {
  const a1 = await req(ANTREAN, 'POST', '/api/antrean', { pasien_id: state.p1.id, poli_id: state.poliUmum.id, keluhan: 'Demam' });
  const a2 = await req(ANTREAN, 'POST', '/api/antrean', { pasien_id: state.p2.id, poli_id: state.poliUmum.id });
  assert.equal(a1.status, 201);
  assert.equal(a1.body.nomor, 'A-001');
  assert.equal(a2.body.nomor, 'A-002');
  assert.equal(a1.body.pasien.nama, 'Budi Santoso');
  state.a1 = a1.body;
  state.a2 = a2.body;

  const ganda = await req(ANTREAN, 'POST', '/api/antrean', { pasien_id: state.p1.id, poli_id: state.poliUmum.id });
  assert.equal(ganda.status, 409);

  const tanpaPasien = await req(ANTREAN, 'POST', '/api/antrean', { pasien_id: 999, poli_id: state.poliUmum.id });
  assert.equal(tanpaPasien.status, 422);
});

test('rekam kunjungan ditolak bila antrean belum dipanggil', async () => {
  const res = await req(REKAM, 'POST', '/api/kunjungan', { antrean_id: state.a1.id, dokter: 'dr. Sari', diagnosa: 'ISPA' });
  assert.equal(res.status, 409);
});

test('rekam kunjungan ditolak bila antrean tidak ada', async () => {
  const res = await req(REKAM, 'POST', '/api/kunjungan', { antrean_id: 999, dokter: 'dr. Sari', diagnosa: 'ISPA' });
  assert.equal(res.status, 404);
});

test('[POST lintas service] rekam memanggil pasien berikutnya', async () => {
  const res = await req(REKAM, 'POST', '/api/antrean/panggil-berikutnya', { poli_id: state.poliUmum.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.nomor, 'A-001');
  assert.equal(res.body.status, 'dipanggil');
});

test('[GET+PUT lintas service] buat rekam kunjungan -> antrean jadi selesai', async () => {
  const res = await req(REKAM, 'POST', '/api/kunjungan', {
    antrean_id: state.a1.id,
    dokter: 'dr. Sari',
    anamnesis: 'Demam 3 hari',
    suhu: '38.2',
    diagnosa: 'ISPA',
    kode_icd10: 'J06.9',
    resep: 'Paracetamol 3x1',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.kunjungan.nama_pasien, 'Budi Santoso');
  assert.equal(res.body.kunjungan.nomor_antrean, 'A-001');
  assert.equal(res.body.kunjungan.suhu, 38.2);
  assert.equal(res.body.antrean.status, 'selesai');
  state.k1 = res.body.kunjungan;

  const cek = await req(ANTREAN, 'GET', `/api/antrean/${state.a1.id}`);
  assert.equal(cek.body.status, 'selesai');

  const ulang = await req(REKAM, 'POST', '/api/kunjungan', { antrean_id: state.a1.id, dokter: 'x', diagnosa: 'y' });
  assert.equal(ulang.status, 409);
});

test('ubah data medis & riwayat pasien', async () => {
  const upd = await req(REKAM, 'PUT', `/api/kunjungan/${state.k1.id}`, { resep: 'Paracetamol 500mg 3x1' });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.resep, 'Paracetamol 500mg 3x1');

  const riwayat = await req(REKAM, 'GET', `/api/pasien/${state.p1.id}/riwayat`);
  assert.equal(riwayat.status, 200);
  assert.equal(riwayat.body.pasien.nama, 'Budi Santoso');
  assert.equal(riwayat.body.jumlah_kunjungan, 1);

  const list = await req(REKAM, 'GET', `/api/kunjungan?pasien_id=${state.p1.id}`);
  assert.equal(list.body.length, 1);
});

test('[DELETE lintas service] pasien tidak hadir -> antrean batal', async () => {
  await req(REKAM, 'POST', '/api/antrean/panggil-berikutnya', { poli_id: state.poliUmum.id });
  const res = await req(REKAM, 'DELETE', `/api/antrean/${state.a2.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'batal');

  const kosong = await req(REKAM, 'POST', '/api/antrean/panggil-berikutnya', { poli_id: state.poliUmum.id });
  assert.equal(kosong.status, 404);
});

test('hapus rekam kunjungan -> antrean kembali dipanggil', async () => {
  const res = await req(REKAM, 'DELETE', `/api/kunjungan/${state.k1.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.antrean.status, 'dipanggil');
  assert.equal((await req(REKAM, 'GET', `/api/kunjungan/${state.k1.id}`)).status, 404);
});

test('log integrasi mencatat request ke service antrean', async () => {
  const res = await req(REKAM, 'GET', '/api/log-integrasi?limit=100');
  const methods = new Set(res.body.map((l) => l.method));
  for (const m of ['GET', 'POST', 'PUT', 'DELETE']) assert.ok(methods.has(m), `method ${m} belum tercatat`);
});

test('rekam mengembalikan 503 bila service antrean mati', async () => {
  procs[0].kill();
  await new Promise((r) => setTimeout(r, 300));
  const res = await req(REKAM, 'GET', '/api/antrean');
  assert.equal(res.status, 503);
});
