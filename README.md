# Sistem Antrean & Rekam Kunjungan Klinik/Puskesmas

Tugas Besar Sistem Terintegrasi 2026/2027 Ganjil, Kelompok 5.

Repository: https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5

Sistem terdiri dari dua service yang berkomunikasi lewat HTTP REST API (GET, POST, PUT, DELETE):

| Service | Folder | Database | Jalan di | Port lokal |
|---|---|---|---|---|
| **Antrean**: pasien, poli, nomor antrean | [`service-antrean/`](service-antrean) | Supabase (PostgreSQL) | **Vercel** (cloud) | 3000 |
| **Rekam Kunjungan**: rekam medis | [`service-rekam/`](service-rekam) | SQLite | Lokal | 4000 |

Arsitektur, diagram, dan ERD ada di [`docs/arsitektur.md`](docs/arsitektur.md). Panduan deploy ada di [`docs/deploy.md`](docs/deploy.md).

## Kebutuhan

- Node.js **22.13 atau lebih baru** (service-rekam memakai modul bawaan `node:sqlite`)
- Git

## Menjalankan Secara Lokal

```powershell
npm run install:all
```

Terminal 1 (Service Antrean):
```powershell
cd service-antrean
copy .env.example .env
npm start
```
Tanpa `SUPABASE_URL`, service memakai penyimpanan memori. Cocok untuk mencoba tanpa akun Supabase.

Terminal 2 (Service Rekam Kunjungan):
```powershell
cd service-rekam
copy .env.example .env
npm start
```
Pastikan `ANTREAN_API_KEY` di `service-rekam/.env` sama dengan `API_KEY` di `service-antrean/.env`.

Lalu buka:
- Swagger Service Antrean: http://localhost:3000/docs
- Swagger Service Rekam: http://localhost:4000/docs
- Postman: import [`docs/postman/Klinik.postman_collection.json`](docs/postman/Klinik.postman_collection.json)

## Tes Integrasi

```powershell
npm test
```

Tes ini menyalakan kedua service sendiri, tanpa Supabase, lalu menguji alur lengkap: daftar pasien, ambil antrean, panggil, rekam kunjungan, antrean selesai, riwayat, batal, dan kondisi saat service mati.

## Alur Singkat

1. Loket: `POST /api/pasien`, lalu `POST /api/antrean` ke Service Antrean. Pasien dapat nomor `A-001`.
2. Dokter: `POST /api/antrean/panggil-berikutnya` ke Service Rekam, yang meneruskannya ke Service Antrean (status menjadi `dipanggil`).
3. Dokter: `POST /api/kunjungan` ke Service Rekam. Service Rekam memvalidasi antrean lewat `GET`, menyimpan rekam medis, lalu `PUT` status antrean menjadi `selesai`.

## Pembagian Tugas

Lihat [`CONTRIBUTING.md`](CONTRIBUTING.md).
