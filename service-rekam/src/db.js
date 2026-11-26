// Database lokal SQLite memakai modul bawaan Node.js (node:sqlite, Node >= 22.13).
// Tidak perlu install driver database apa pun.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = process.env.DB_FILE || path.join(process.cwd(), 'data', 'rekam.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS kunjungan (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    antrean_id        INTEGER NOT NULL UNIQUE,   -- id antrean di Service Antrean
    nomor_antrean     TEXT,
    pasien_id         INTEGER NOT NULL,          -- id pasien di Service Antrean
    no_rm             TEXT,
    nama_pasien       TEXT,
    poli              TEXT,
    tanggal_kunjungan TEXT NOT NULL,
    dokter            TEXT NOT NULL,
    anamnesis         TEXT,
    tekanan_darah     TEXT,
    suhu              REAL,
    berat_badan       REAL,
    diagnosa          TEXT NOT NULL,
    kode_icd10        TEXT,
    tindakan          TEXT,
    resep             TEXT,
    catatan           TEXT,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_kunjungan_pasien ON kunjungan (pasien_id);
  CREATE INDEX IF NOT EXISTS idx_kunjungan_tanggal ON kunjungan (tanggal_kunjungan);

  -- Catatan setiap request yang dikirim ke Service Antrean (untuk bukti komunikasi antar service)
  CREATE TABLE IF NOT EXISTS log_integrasi (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    method      TEXT NOT NULL,
    url         TEXT NOT NULL,
    status      INTEGER NOT NULL,              -- 0 = service tidak dapat dihubungi
    durasi_ms   INTEGER NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);
