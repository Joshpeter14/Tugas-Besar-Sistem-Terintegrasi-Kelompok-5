# Panduan Deploy: Supabase + Vercel

Yang di-deploy ke cloud: **service-antrean**. Service-rekam tetap jalan di laptop.

## 1. Siapkan database di Supabase

1. Buat akun dan project baru di https://supabase.com (pilih region **Southeast Asia (Singapore)**).
2. Buka **SQL Editor → New query**, salin isi [`service-antrean/supabase/schema.sql`](../service-antrean/supabase/schema.sql), lalu klik **Run**.
3. Cek di **Table Editor**: harus ada tabel `poli` (berisi 3 baris), `pasien`, dan `antrean`.
4. Buka **Project Settings → API**, lalu catat dua nilai berikut:
   - **Project URL** → nanti diisi sebagai `SUPABASE_URL`
   - **service_role key** (bagian *Project API keys*, klik *Reveal*) → nanti diisi sebagai `SUPABASE_SERVICE_ROLE_KEY`

> **Penting:** `service_role` key bisa membaca dan menulis semua data. Simpan hanya di `.env` lokal dan Environment Variables Vercel. Jangan di-commit ke GitHub dan jangan dipakai di frontend.

## 2. Coba dulu secara lokal dengan Supabase

```powershell
cd service-antrean
copy .env.example .env
# edit .env: isi API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

Buka http://localhost:3000/api/health. Hasilnya harus `"storage": "supabase"`.

## 3. Deploy ke Vercel

### Cara A: lewat dashboard (paling mudah)

1. Push repo ke GitHub.
2. Di https://vercel.com, pilih **Add New → Project** lalu import repo ini.
3. **Root Directory**: pilih `service-antrean`. Ini wajib karena repo berisi dua service.
4. **Framework Preset**: `Other`. Build command dan output directory dikosongkan.
5. **Environment Variables**: tambahkan
   - `API_KEY` = kunci rahasia buatan sendiri (contoh: hasil `openssl rand -hex 24`)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Klik **Deploy**. Setelah selesai, URL-nya seperti `https://service-antrean-xxx.vercel.app`.

### Cara B: lewat CLI

```powershell
npm i -g vercel
cd service-antrean
vercel login
vercel            # deploy preview, ikuti pertanyaannya
vercel env add API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel --prod     # deploy production
```

Setiap push ke branch `main` akan otomatis di-deploy ulang oleh Vercel (Cara A).

## 4. Cek hasil deploy

- `https://<url-vercel>/api/health` → `{"status":"ok","storage":"supabase"}`
  - Kalau `storage` bernilai `memory`, berarti env Supabase belum terbaca. Cek Environment Variables lalu **Redeploy**.
- `https://<url-vercel>/docs` → Swagger UI. Klik **Authorize** dan isi API key.

## 5. Hubungkan service-rekam ke Vercel

Di `service-rekam/.env`:

```
ANTREAN_API_URL=https://<url-vercel>
ANTREAN_API_KEY=<sama dengan API_KEY di Vercel>
```

Jalankan `npm start` di `service-rekam`, lalu buka http://localhost:4000/api/health. Field `antrean.status` harus `ok`.

## Catatan Vercel

- Service berjalan sebagai *Serverless Function*. Request pertama setelah lama tidak dipakai bisa lambat 1–3 detik (*cold start*). Timeout client di service-rekam diset 10 detik.
- Tidak ada penyimpanan file di Vercel. Semua data disimpan di Supabase.
- Tanpa env Supabase, service otomatis memakai penyimpanan memori. Data hilang setiap kali fungsi restart, jadi jangan dipakai untuk demo final.
