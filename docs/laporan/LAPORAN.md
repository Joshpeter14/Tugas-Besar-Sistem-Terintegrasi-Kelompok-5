# Laporan Tugas Besar Sistem Terintegrasi 2026/2027 Ganjil

**Topik:** Sistem Antrean & Rekam Kunjungan Klinik/Puskesmas

| Nama | NIM | Peran |
|---|---|---|
| (Anggota 1) | | Service Antrean, Supabase, deploy Vercel |
| (Anggota 2) | | Service Rekam Kunjungan, integrasi HTTP client |
| (Anggota 3) | | Arsitektur, dokumentasi API, Postman, tes integrasi, laporan |

**Repository:** https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5
**URL Service Antrean (Vercel):** https://(isi).vercel.app
**Swagger:** https://(isi).vercel.app/docs dan http://localhost:4000/docs

---

## 1. Pendahuluan

### 1.1 Latar Belakang
Di banyak klinik dan puskesmas, antrean pasien masih dikelola dengan kertas atau papan tulis. Rekam kunjungan juga dicatat terpisah. Akibatnya petugas loket dan dokter tidak punya informasi yang sama: dokter tidak tahu pasien mana yang sudah menunggu, dan loket tidak tahu pasien mana yang sudah selesai diperiksa.

(Lanjutkan dengan konteks dan masalah yang ingin diselesaikan.)

### 1.2 Tujuan
- Membangun dua service terpisah, yaitu **Antrean** dan **Rekam Kunjungan**, yang saling berkomunikasi lewat REST API.
- Men-deploy Service Antrean ke cloud (Vercel + Supabase) agar bisa diakses dari mana saja.
- Mendokumentasikan API dengan Swagger (OpenAPI 3) dan Postman.

### 1.3 Ruang Lingkup
- Termasuk: pendaftaran pasien, pengelolaan poli, nomor antrean harian per poli, pemanggilan antrean, serta rekam kunjungan (anamnesis, tanda vital, diagnosa ICD-10, tindakan, resep).
- Tidak termasuk: login pengguna, pembayaran/BPJS, dan aplikasi frontend.

## 2. Desain Arsitektur dan Diagram Sistem (Kriteria B.1)

> Ambil isi dan diagram dari [`docs/arsitektur.md`](../arsitektur.md). Diagram Mermaid bisa di-render di GitHub atau https://mermaid.live, lalu di-export ke PNG untuk laporan.

### 2.1 Arsitektur Sistem
(Tempel diagram arsitektur, lalu jelaskan peran tiap komponen.)

### 2.2 Alur Komunikasi (Sequence Diagram)
(Tempel sequence diagram kunjungan pasien.)

### 2.3 Status Antrean
(Tempel state diagram.)

### 2.4 Desain Database (ERD)
(Tempel ERD kedua service. Jelaskan alasan memakai database terpisah per service, serta snapshot data pasien di Service Rekam.)

## 3. Implementasi Dua Service dan Komunikasi API (Kriteria B.2)

### 3.1 Teknologi
| Komponen | Teknologi |
|---|---|
| Bahasa / runtime | JavaScript, Node.js |
| Framework | Express 5 |
| Database Service Antrean | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Database Service Rekam | SQLite (`node:sqlite`) |
| Dokumentasi | OpenAPI 3 + Swagger UI, Postman |
| Pengujian | `node:test` (tes integrasi end-to-end) |

### 3.2 Service Antrean
(Jelaskan endpoint utama, aturan nomor antrean `A-001`, transisi status, dan proteksi API key. Sertakan potongan kode `src/routes/antrean.js`.)

### 3.3 Service Rekam Kunjungan
(Jelaskan endpoint utama dan alasan menyalin data pasien sebagai snapshot. Sertakan potongan kode `src/routes/kunjungan.js`.)

### 3.4 Komunikasi Antar Service
(Tempel tabel komunikasi dari `docs/arsitektur.md` bagian 3. Jelaskan `antreanClient.js`: timeout, API key, penanganan error 503/502, dan kompensasi saat PUT gagal.)

### 3.5 Pengujian
Tes integrasi (`npm test`) menyalakan kedua service dan menjalankan 14 skenario, mulai dari CRUD dan nomor antrean otomatis, rekam ditolak bila antrean belum dipanggil, integrasi GET/POST/PUT/DELETE, sampai respon 503 saat Service Antrean mati.

(Tempel screenshot hasil `npm test`.)

## 4. Deployment Cloud (Kriteria B.3)
(Ikuti [`docs/deploy.md`](../deploy.md). Sertakan screenshot berikut:)
- Tabel di Supabase Table Editor
- Halaman project di Vercel (status Ready, Root Directory `service-antrean`)
- Environment Variables di Vercel (nilai rahasia **disensor**)
- Respons `https://<url>.vercel.app/api/health` dengan `storage: supabase`
- Respons `http://localhost:4000/api/health` yang menunjukkan `antrean.status: ok` ke URL Vercel

## 5. Dokumentasi API (Kriteria B.4)
- Swagger UI Service Antrean: `https://<url>.vercel.app/docs`
- Swagger UI Service Rekam: `http://localhost:4000/docs`
- Koleksi Postman: `docs/postman/Klinik.postman_collection.json`

(Sertakan screenshot Swagger dan hasil Postman *Run collection* folder "0. Skenario End-to-End".)

### Daftar Endpoint

**Service Antrean** (semua butuh header `x-api-key`, kecuali health)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | /api/health | Status service |
| GET, POST | /api/poli | List / tambah poli |
| GET, PUT, DELETE | /api/poli/{id} | Detail / ubah / hapus poli |
| GET, POST | /api/pasien | List (filter nik, no_rm) / daftar pasien |
| GET, PUT, DELETE | /api/pasien/{id} | Detail / ubah / hapus pasien |
| GET, POST | /api/antrean | List (filter tanggal, poli_id, status) / ambil nomor |
| GET, PUT, DELETE | /api/antrean/{id} | Detail / ubah keluhan / batalkan |
| PUT | /api/antrean/{id}/status | Ubah status |
| POST | /api/antrean/panggil-berikutnya | Panggil antrean berikutnya |

**Service Rekam Kunjungan**
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | /api/health | Status + koneksi ke Service Antrean |
| GET, POST | /api/kunjungan | List / buat rekam (integrasi) |
| GET, PUT, DELETE | /api/kunjungan/{id} | Detail / ubah / hapus (integrasi) |
| GET | /api/antrean | Lihat antrean (integrasi) |
| POST | /api/antrean/panggil-berikutnya | Panggil berikutnya (integrasi) |
| DELETE | /api/antrean/{id} | Pasien tidak hadir (integrasi) |
| GET | /api/pasien/{id}/riwayat | Riwayat pasien (integrasi) |
| GET | /api/log-integrasi | Log request antar service |

## 6. Kesimpulan dan Saran
(Isi kesimpulan. Contoh saran: autentikasi petugas (JWT), frontend layar antrean, notifikasi WhatsApp, integrasi SATUSEHAT.)

## 7. Pembagian Tugas
(Sertakan screenshot halaman GitHub Insights → Contributors.)

---

## Lampiran: Kerangka Presentasi (10–15 menit)
1. Masalah dan tujuan (1 slide)
2. Arsitektur dan alasan pemisahan service (2 slide)
3. Demo langsung: jalankan Postman "0. Skenario End-to-End" ke URL Vercel, lalu tunjukkan data berubah di Supabase Table Editor
4. Tunjukkan `GET /api/log-integrasi` sebagai bukti komunikasi antar service
5. Demo kegagalan: matikan koneksi, tunjukkan respons 503
6. Swagger dan dokumentasi
7. Pembagian kerja dan kesimpulan
