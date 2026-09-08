# Himti Musik — React, Express, PostgreSQL

Versi sederhana aplikasi pengelola Himti Musik 1 dan Himti Musik 2. Struktur dipisah menjadi `frontend` dan `backend` agar lebih mudah dipelajari.

## Fitur dan akses

- Pengunjung tanpa login dapat melihat dashboard, kelompok, KOL, status, dan proses.
- Admin dapat login untuk melihat nomor WhatsApp/keterangan, menambah/edit member, menyelesaikan Incoming/Outgoing/Transfer, mengatur KOL, serta impor/ekspor CSV.
- Beberapa akun admin dapat dibuat. Password disimpan sebagai hash, bukan teks biasa.
- Transfer memindahkan record yang sama ke kelompok tujuan dan status tetap Aktif.
- Dashboard menghitung Member Aktif terpisah dari status proses.

## Persiapan

Pasang Node.js 22.13+ dan PostgreSQL 14+ di laptop. Buat database kosong bernama `himti_musik` melalui pgAdmin atau SQL Shell. Jangan membuat tabel manual; migrasi akan membuatnya.

```bash
npm install
npm run setup
```

Buka `backend/.env`, lalu sesuaikan `DATABASE_URL` dengan password PostgreSQL. Setelah itu jalankan:

```bash
npm run db:init
npm run admin -- --username admin --name "Nama Admin" --password "password-minimal-10"
npm run dev
```

Buka `http://localhost:5173`. Backend berjalan di `http://127.0.0.1:3001` dan hanya menerima koneksi lokal.

Untuk admin lain, ulangi perintah `npm run admin` dengan username berbeda. Perintah tersebut membuat akun baru atau memperbarui akun dengan username yang sama.

## Struktur folder

```text
frontend/             React + Vite + CSS biasa
backend/src/server.js Express API, sesi login, otorisasi
backend/src/auth.js   Hash dan verifikasi password
backend/sql/          Migrasi PostgreSQL
backend/scripts/      Setup database dan akun admin
```

## Alur data

`React → API Express → PostgreSQL`

Data member tidak disimpan di `localStorage`. Pengunjung hanya menerima data publik. API tetap memeriksa sesi admin, jadi menyembunyikan kolom bukan satu-satunya pengaman.

## Status dan proses

| Kondisi | Status | Proses | Saat diselesaikan |
| --- | --- | --- | --- |
| Member akan masuk | Calon | Incoming | Aktif dan Selesai |
| Member akan takeout | Aktif | Outgoing | Nonaktif dan Selesai |
| Member akan dipindahkan | Aktif | Transfer | Pindah kelompok, tetap Aktif dan Selesai |

## Catatan keamanan

Versi ini ditujukan untuk belajar dan dipakai di komputer lokal. Sebelum diakses melalui internet, perlu HTTPS, domain, backup, pengaturan firewall, dan konfigurasi `APP_ORIGIN`/cookie produksi. Jangan membagikan file `backend/.env`.

## Pengujian

```bash
npm run build
npm test
```

Pengujian yang disertakan memeriksa validasi status/proses, perhitungan aktif, transfer tanpa duplikasi, dan hash password.

## Deploy gratis untuk uji komunitas

Versi ini dapat dijalankan sebagai satu Web Service di Render atau sebagai Node.js server di Vercel setelah frontend dibuild dengan `npm run build`. Gunakan database Supabase Free sebagai PostgreSQL remote. Hosting gratis dapat memiliki batas tidur/pause; buat backup berkala.

Untuk Vercel, project memakai `server.js` di root sebagai entrypoint Node.js. Tambahkan environment variables `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`, `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1`, dan `PG_SSL=true` di dashboard Vercel.
