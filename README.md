# coding-ai-config-rdr

DevPilot RDR — sistem pakar lokal untuk memilih layanan, model, effort, mode kerja, dan skill coding AI bagi junior developer.

Paket Person A (A1–A5) menyediakan mesin RDR, database, API, serta antarmuka dasar yang terhubung. Penyempurnaan visual dan fitur presentasi milik Person B dijelaskan pada [handoff](./HANDOFF_A_TO_B.md).

## Menjalankan

Prasyarat: Node.js 24+ dan npm. Node 24 menyediakan SQLite bawaan; tidak diperlukan instalasi SQLite atau API key AI. Runtime dapat menampilkan ExperimentalWarning untuk node:sqlite.

Jalankan dari folder repository:

```sh
npm ci
npm run db:init
npm run dev
```

Buka **http://127.0.0.1:5173**. Backend berjalan pada **http://127.0.0.1:3001**; Vite meneruskan /api ke backend.

Frontend memiliki pembaruan otomatis. Setelah mengubah kode backend, hentikan lalu jalankan kembali npm run dev. Kedua server berjalan dalam satu proses dev dan ditutup bersama ketika menerima Ctrl+C.

Build dan jalankan versi hasil build:

```sh
npm run build
npm start
```

Buka **http://127.0.0.1:3001**. Perintah build memeriksa TypeScript, membangun frontend ke dist, dan mengompilasi backend ke dist-server.

## Perintah

| Perintah          | Fungsi                                             |
| ----------------- | -------------------------------------------------- |
| npm run dev       | Frontend Vite dan backend lokal                    |
| npm run db:init   | Migrasi dan seed awal yang tidak menimpa data      |
| npm run typecheck | Pemeriksaan tipe                                   |
| npm test          | Pengujian mesin, layanan, API, dan interaksi UI    |
| npm run build     | Pemeriksaan tipe dan build frontend/backend        |
| npm start         | Server backend beserta frontend hasil build        |
| npm run format    | Format source dan dokumentasi menggunakan Prettier |

Database normal: data/devpilot.sqlite. Database, log, build, cache, dan node_modules diabaikan Git. package-lock.json disertakan untuk pemasangan yang dapat diulang.

Untuk latihan terpisah pada PowerShell, pilih nama database baru:

```powershell
$env:DB_PATH="data/latihan-01.sqlite"
npm run dev
```

Pada shell POSIX:

```sh
DB_PATH=data/latihan-01.sqlite npm run dev
```

DB_PATH dipakai oleh dev, db:init, dan start. PORT hanya mengubah port pada npm start; dev menggunakan 3001 agar sesuai proxy Vite. Jangan menjalankan dev dan start bersamaan pada port yang sama. Tidak ada reset database otomatis. Gunakan file latihan baru untuk memulai lagi dari satu rule.

## Data demonstrasi

Katalog awal berisi model sintetis berlabel **DEMO**, bukan nama atau kemampuan produk nyata. Ada profil perubahan terarah dan investigasi untuk Codex maupun Claude Code.

Effort default berarti pengaturan bawaan. Effort medium/high pada model DEMO hanya dipakai untuk menguji kompatibilitas dan mekanisme rekomendasi, bukan klaim dukungan platform nyata.

Aturan tidak dibuat dari katalog tersebut: KB baru tetap hanya berisi satu root TRUE. Pemetaan default ke profil layanan utama bersifat eksplisit, tanpa ranking atau pemilihan tersembunyi.

Untuk rekomendasi nyata, pakar perlu mengisi katalog terverifikasi dengan sumber dan tanggal. UI administrasi katalog merupakan pekerjaan B; backend pengelolaannya sudah tersedia.

## Alur mencoba fondasi A

1. Buat profil akses. Untuk contoh paling mudah, pilih Codex, model DEMO Codex Basic dan Deep, lalu konfirmasi akses.
2. Buat kasus awal dengan kebutuhan jelas, cakupan satu fungsi, dan percobaan gagal 0.
3. Isi kriteria selesai yang dapat diuji, lalu minta rekomendasi. Statusnya masih sementara.
4. Buka penilaian pakar, isi alasan, lalu pilih Setuju & jadikan acuan root. Ini bootstrap cornerstone; rule tetap satu.
5. Buat konsultasi baru dengan percobaan gagal 3. Bisa ditautkan ke task sebelumnya.
6. Buka penilaian pakar. Bandingkan dengan kasus kunci dan tambahkan kandidat Percobaan gagal gte 3.
7. Pilih profil DEMO Codex / Investigasi, isi alasan, lalu Periksa koreksi.
8. Jika valid, Simpan aturan & setujui. Rule baru menjadi anak kanan root dan kasus baru menjadi cornerstone-nya.
9. Lihat Pengetahuan RDR dan Riwayat task.
10. Untuk membuktikan false-child, masukkan kasus dengan percobaan gagal 1, lalu koreksi memakai gte 1 dan profil yang sesuai. Rule dipasang pada kiri node pengecualian pertama, sementara pembeda dibandingkan dengan cornerstone root.

Angka 3 dan 1 adalah angka demonstrasi yang dipilih pakar, bukan aturan universal. Jika ada kasus lain yang sudah disetujui dan akan berubah, perjelas kondisi; pemeriksaan regresi menolak perubahan tersebut.

Jika ada perubahan KB/katalog setelah kasus dibuat, pilih Perbarui inferensi dan tinjau hasil terbaru. Hasil final tidak dapat diubah. Untuk melengkapi informasi kasus, buat konsultasi baru pada task yang sama agar snapshot lama terjaga.

## Cara kerja RDR

- Kanan: true-child, diikuti ketika kondisi benar.
- Kiri: false-child, diikuti ketika kondisi salah.
- Hanya node yang cocok mengganti seluruh paket kesimpulan.
- Hasil adalah kesimpulan terakhir yang cocok pada satu jalur.
- Kondisi koreksi harus benar pada kasus baru dan salah pada cornerstone kesimpulan yang dikoreksi.
- Node baru dipasang pada cabang terminal yang kosong, bukan selalu kanan node terakhir yang cocok.
- Seluruh cornerstone dan kasus disetujui dilindungi melalui pemeriksaan regresi.
- Koreksi, versi KB, hasil final, dan audit disimpan secara transaksional.

## Peta kode

```text
shared/domain.ts       Tipe, enum, skema validasi, dan metadata atribut
server/rdr.ts          Evaluator, inferensi, pemasangan node, kandidat, regresi
server/catalog.ts      Seed DEMO, validasi katalog, snapshot, kompatibilitas
server/store.ts        Migrasi SQLite, persistensi, versi, audit, transaksi
server/service.ts      Alur konsultasi dan penilaian pakar
server/app.ts          Kontrak HTTP dan penanganan error
server/index.ts        Server hasil build, loopback-only
server/migrate.ts      Inisialisasi database idempoten
scripts/dev.ts         Menjalankan frontend dan backend lokal
src/App.tsx            Alur konsumen, pakar, tabel pohon, riwayat, katalog baca
src/components.tsx     Label form, kartu hasil, perbandingan, builder kondisi
src/api.ts             Klien HTTP dan error
src/styles.css         Tampilan dasar responsif
 tests/                Mesin, layanan, API, persistensi, interaksi UI
```

## Dokumentasi lanjutan

- [Konteks produk](./docs/DEV_PILOT_RDR_CONTEXT.md)
- [Pembagian estafet 60:40](./docs/DEV_PILOT_RDR_PEMBAGIAN_TUGAS.md)
- [Kontrak API](./docs/API.md)
- [Keputusan teknis](./docs/DECISIONS.md)
- [Serah terima A → B](./HANDOFF_A_TO_B.md)

## Batas penggunaan

Aplikasi ditujukan untuk demonstrasi lokal. Pilihan peran adalah perpindahan tampilan, bukan autentikasi. Server mengikat loopback dan tidak melakukan pemanggilan AI, pemasangan skill, atau pembelian subscription. Jangan mempublikasikannya sebagai aplikasi multiuser sebelum menambahkan autentikasi dan otorisasi.

Pohon masih berupa tabel dan trace berupa daftar. Editor katalog visual, formulir outcome, visualisasi pohon interaktif, penyempurnaan UX, dan bahan presentasi akhir dilanjutkan Person B. Belum ada hasil benchmark penghematan token.

Pengujian UI memakai React Testing Library + jsdom dengan backend Fastify dan SQLite nyata melalui app.inject. Ini memeriksa interaksi dan integrasi, bukan pemeriksaan visual pada browser nyata. Status verifikasi aktual serta batas browser QA dicatat pada handoff.
