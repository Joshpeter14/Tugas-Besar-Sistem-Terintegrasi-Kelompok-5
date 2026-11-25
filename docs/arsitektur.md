# Desain Arsitektur: Sistem Antrean & Rekam Kunjungan Klinik/Puskesmas

## 1. Gambaran Umum

Sistem terdiri dari **dua service independen** yang berkomunikasi lewat **HTTP REST API (JSON)**:

| | Service Antrean | Service Rekam Kunjungan |
|---|---|---|
| Tanggung jawab | Data pasien, poli, nomor antrean & status antrean | Rekam medis kunjungan (anamnesis, diagnosa, tindakan, resep) |
| Pengguna | Petugas pendaftaran / loket | Dokter / perawat di ruang periksa |
| Teknologi | Node.js + Express 5 | Node.js + Express 5 |
| Database | Supabase (PostgreSQL, cloud) | SQLite (file lokal, modul bawaan `node:sqlite`) |
| Deployment | **Vercel** (Serverless Function, cloud) | Lokal (`localhost:4000`) |
| Keamanan | Header `x-api-key` di semua `/api/*` | Kunci disimpan di `.env`, dikirim ke Service Antrean |
| Dokumentasi | `/docs` (Swagger UI) | `/docs` (Swagger UI) |

Kedua service sengaja memakai **database terpisah** (*database per service*): tidak ada service yang membaca database milik service lain. Semua pertukaran data lewat API.

## 2. Diagram Arsitektur

```mermaid
flowchart LR
  subgraph Pengguna
    L[Petugas Loket<br/>Postman / Swagger]
    D[Dokter<br/>Postman / Swagger]
  end

  subgraph Cloud
    subgraph Vercel
      A[Service Antrean<br/>Express - Serverless]
    end
    subgraph Supabase
      PG[(PostgreSQL<br/>pasien, poli, antrean)]
    end
  end

  subgraph Laptop[Laptop / Lokal]
    R[Service Rekam Kunjungan<br/>Express :4000]
    SQ[(SQLite<br/>kunjungan, log_integrasi)]
  end

  L -- "HTTPS REST + x-api-key" --> A
  A -- "supabase-js (service_role)" --> PG
  D -- "HTTP REST" --> R
  R -- "SQL" --> SQ
  R -- "HTTPS REST: GET, POST, PUT, DELETE<br/>+ x-api-key" --> A
```

## 3. Komunikasi Antar Service

Service Rekam Kunjungan bertindak sebagai **client** bagi Service Antrean (`service-rekam/src/antreanClient.js`). Setiap request dicatat di tabel `log_integrasi` (lihat `GET /api/log-integrasi`).

| Method | Request ke Service Antrean | Dipicu oleh endpoint Service Rekam | Tujuan |
|---|---|---|---|
| GET | `/api/antrean/{id}` | `POST /api/kunjungan` | Validasi antrean ada & berstatus `dipanggil` |
| PUT | `/api/antrean/{id}/status` `{status: selesai}` | `POST /api/kunjungan` | Tandai antrean selesai setelah diperiksa |
| PUT | `/api/antrean/{id}/status` `{status: dipanggil}` | `DELETE /api/kunjungan/{id}` | Buka kembali antrean bila rekam dihapus |
| GET | `/api/antrean?poli_id=&status=` | `GET /api/antrean` | Lihat daftar antrean di ruang periksa |
| POST | `/api/antrean/panggil-berikutnya` | `POST /api/antrean/panggil-berikutnya` | Panggil pasien berikutnya |
| DELETE | `/api/antrean/{id}` | `DELETE /api/antrean/{id}` | Pasien tidak hadir, antrean dibatalkan |
| GET | `/api/pasien/{id}` | `GET /api/pasien/{id}/riwayat` | Gabungkan data diri pasien + riwayat medis |

### Penanganan kegagalan

- Service Antrean mati / timeout → Service Rekam membalas **503** (`Service Antrean tidak dapat dihubungi`).
- API key salah → **502 Bad Gateway** (masalah konfigurasi, bukan kesalahan client).
- Error 4xx lain (404, 409) dari Service Antrean diteruskan apa adanya.
- **Kompensasi:** pada `POST /api/kunjungan`, bila `PUT status selesai` gagal setelah rekam tersimpan, rekam lokal dihapus lagi agar data kedua service tetap konsisten.

## 4. Diagram Alur (Sequence) Kunjungan Pasien

```mermaid
sequenceDiagram
  autonumber
  actor Loket as Petugas Loket
  actor Dokter
  participant A as Service Antrean (Vercel)
  participant DB1 as Supabase
  participant R as Service Rekam (Lokal)
  participant DB2 as SQLite

  Loket->>A: POST /api/pasien (data pasien)
  A->>DB1: INSERT pasien
  A-->>Loket: 201 {id, no_rm}
  Loket->>A: POST /api/antrean {pasien_id, poli_id}
  A->>DB1: INSERT antrean (nomor A-001, status menunggu)
  A-->>Loket: 201 {nomor: "A-001"}

  Dokter->>R: POST /api/antrean/panggil-berikutnya {poli_id}
  R->>A: POST /api/antrean/panggil-berikutnya
  A->>DB1: UPDATE status = dipanggil
  A-->>R: 200 {nomor: "A-001", status: dipanggil}
  R-->>Dokter: 200

  Dokter->>R: POST /api/kunjungan {antrean_id, diagnosa, resep}
  R->>A: GET /api/antrean/{id}
  A-->>R: 200 {status: dipanggil, pasien, poli}
  R->>DB2: INSERT kunjungan
  R->>A: PUT /api/antrean/{id}/status {status: selesai}
  A->>DB1: UPDATE status = selesai
  A-->>R: 200
  R-->>Dokter: 201 {kunjungan, antrean}
```

## 5. Diagram Status Antrean

```mermaid
stateDiagram-v2
  [*] --> menunggu: POST /api/antrean
  menunggu --> dipanggil: panggil-berikutnya / PUT status
  menunggu --> batal: DELETE
  dipanggil --> selesai: rekam kunjungan dibuat
  dipanggil --> menunggu: dilewati
  dipanggil --> batal: pasien tidak hadir
  selesai --> dipanggil: rekam kunjungan dihapus
  selesai --> [*]
  batal --> [*]
```

## 6. ERD

### Service Antrean (Supabase / PostgreSQL)

```mermaid
erDiagram
  POLI ||--o{ ANTREAN : "melayani"
  PASIEN ||--o{ ANTREAN : "mengambil"
  POLI {
    bigint id PK
    text kode UK "prefix nomor, contoh A"
    text nama
    timestamptz created_at
    timestamptz updated_at
  }
  PASIEN {
    bigint id PK
    text no_rm UK
    text nik UK "16 digit"
    text nama
    date tanggal_lahir
    text jenis_kelamin "L / P"
    text no_hp
    text alamat
    timestamptz created_at
    timestamptz updated_at
  }
  ANTREAN {
    bigint id PK
    bigint pasien_id FK
    bigint poli_id FK
    date tanggal
    int nomor_urut "unik per poli per tanggal"
    text nomor "A-001"
    text keluhan
    text status "menunggu/dipanggil/selesai/batal"
    timestamptz dipanggil_at
    timestamptz selesai_at
    timestamptz created_at
    timestamptz updated_at
  }
```

### Service Rekam Kunjungan (SQLite)

```mermaid
erDiagram
  KUNJUNGAN {
    int id PK
    int antrean_id UK "referensi logis ke Service Antrean"
    text nomor_antrean "snapshot"
    int pasien_id "referensi logis ke Service Antrean"
    text no_rm "snapshot"
    text nama_pasien "snapshot"
    text poli "snapshot"
    text tanggal_kunjungan
    text dokter
    text anamnesis
    text tekanan_darah
    real suhu
    real berat_badan
    text diagnosa
    text kode_icd10
    text tindakan
    text resep
    text catatan
    text created_at
    text updated_at
  }
  LOG_INTEGRASI {
    int id PK
    text method
    text url
    int status "0 = tidak terhubung"
    int durasi_ms
    text created_at
  }
```

`antrean_id` dan `pasien_id` di Service Rekam adalah **referensi logis** (bukan foreign key database) karena datanya ada di service lain. Nama pasien, nomor RM, dan poli disalin sebagai *snapshot* saat kunjungan dibuat, sehingga riwayat medis tetap terbaca meski Service Antrean sedang tidak bisa dihubungi.

## 7. Struktur Folder

```
.
├── service-antrean/        # Anggota 1: deploy di Vercel
│   ├── api/index.js        # entry point Vercel
│   ├── server.js           # entry point lokal
│   ├── src/                # app, routes, db (supabase + memory)
│   ├── supabase/schema.sql # skema database
│   ├── openapi.yaml        # dokumentasi Swagger
│   └── vercel.json
├── service-rekam/          # Anggota 2: jalan lokal
│   ├── server.js
│   ├── src/                # app, routes, db SQLite, client ke service antrean
│   └── openapi.yaml
├── docs/                   # Anggota 3
│   ├── arsitektur.md       # dokumen ini
│   ├── deploy.md           # panduan Supabase + Vercel
│   ├── postman/            # koleksi Postman
│   └── laporan/            # kerangka laporan
└── tests/                  # Anggota 3: tes integrasi end-to-end
```
