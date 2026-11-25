# Pembagian Tugas & Alur Kerja GitHub

**Repository:** https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5

Repo dibagi menjadi tiga bagian. Setiap anggota meng-commit bagiannya sendiri **dari akun GitHub masing-masing**, supaya kontribusinya tercatat di *Insights → Contributors*.

| Anggota | Bagian | File / folder |
|---|---|---|
| **Anggota 1** | Service Antrean + cloud | `service-antrean/` (kecuali `openapi.yaml`), `service-antrean/supabase/schema.sql`, deploy Supabase & Vercel |
| **Anggota 2** | Service Rekam Kunjungan + integrasi | `service-rekam/` (kecuali `openapi.yaml`), terutama `src/antreanClient.js` |
| **Anggota 3** | Dokumentasi & pengujian | `docs/`, `tests/`, `service-antrean/openapi.yaml`, `service-rekam/openapi.yaml`, `README.md`, `package.json` root |

## Langkah Awal (sekali saja)

1. Repo sudah dibuat di akun `Joshpeter14`. Pemilik repo mengundang anggota lain sebagai collaborator lewat https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5/settings/access → **Add people**. Setiap anggota menerima undangan dari email atau dari https://github.com/notifications.
2. Setiap anggota mengatur identitas git di laptopnya. Email harus sama dengan email akun GitHub, supaya commit terhitung sebagai kontribusi:
   ```powershell
   git config --global user.name "Nama Kamu"
   git config --global user.email "email-github-kamu@example.com"
   ```

## Urutan Commit Pertama

Kode sudah lengkap di satu folder. Supaya tiap orang punya commit sendiri, unggah bergiliran sesuai urutan di bawah. Satu orang memegang folder proyek, lalu folder itu dikirim (zip / Drive) ke anggota lain. Cara lain: tiap orang clone repo, lalu menyalin bagiannya dari zip.

**Anggota 3 (pertama):** kerangka repo + dokumentasi
```powershell
git init -b main
git remote add origin https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5.git
git add .gitignore README.md CONTRIBUTING.md package.json docs tests service-antrean/openapi.yaml service-rekam/openapi.yaml
git commit -m "docs: arsitektur, OpenAPI, Postman, kerangka laporan, tes integrasi"
git push -u origin main
```

**Anggota 1:** clone repo, salin folder `service-antrean/` ke dalamnya, lalu:
```powershell
git clone https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5.git
cd Tugas-Besar-Sistem-Terintegrasi-Kelompok-5
# salin folder service-antrean/ ke sini
git checkout -b feat/service-antrean
git add service-antrean
git commit -m "feat(antrean): service antrean dengan Supabase dan konfigurasi Vercel"
git push -u origin feat/service-antrean
```
Buat Pull Request di https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5/pulls (tombol **Compare & pull request** muncul setelah push), lalu merge ke `main`.

**Anggota 2:** clone repo (atau `git pull` bila sudah pernah clone), salin folder `service-rekam/`, lalu:
```powershell
git clone https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5.git
cd Tugas-Besar-Sistem-Terintegrasi-Kelompok-5
git checkout main
git pull
# salin folder service-rekam/ ke sini
git checkout -b feat/service-rekam
git add service-rekam
git commit -m "feat(rekam): service rekam kunjungan dan client ke service antrean"
git push -u origin feat/service-rekam
```
Buat Pull Request, lalu merge ke `main`.

Kontribusi tiap anggota bisa dicek di https://github.com/Joshpeter14/Tugas-Besar-Sistem-Terintegrasi-Kelompok-5/graphs/contributors. Halaman ini juga dipakai untuk screenshot di laporan.

Setelah ketiganya di-merge, siapa pun bisa menjalankan `npm run install:all` lalu `npm test`. Semua tes harus lulus.

## Setelah Itu

Supaya kontribusi tidak cuma satu commit per orang, tiap anggota sebaiknya terus bekerja di branch sendiri dengan commit kecil-kecil:

- **Anggota 1:** jalankan `schema.sql` di Supabase, deploy ke Vercel, isi URL Vercel di README dan laporan, dan tambahkan screenshot deploy.
- **Anggota 2:** uji service-rekam terhubung ke URL Vercel, perbaiki penanganan error, dan tambahkan contoh data atau seed.
- **Anggota 3:** export diagram Mermaid ke PNG, isi laporan, siapkan slide presentasi, dan jalankan Postman Runner ke URL Vercel lalu screenshot hasilnya.

Format pesan commit: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Aturan

- **Jangan commit file `.env`**, karena berisi `SUPABASE_SERVICE_ROLE_KEY` dan `API_KEY`. File ini sudah masuk `.gitignore`.
- Jangan push langsung ke `main` setelah commit pertama. Pakai branch dan Pull Request, supaya ada jejak review di GitHub.
