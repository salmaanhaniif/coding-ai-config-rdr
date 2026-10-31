# Serah Terima Person A → Person B

## Status penyerahan

Paket A1–A5 (60 poin) sudah diimplementasikan. Aplikasi dasar menjalankan alur profil akses → konsultasi → inferensi → penilaian pakar → koreksi → hasil final, dengan penyimpanan SQLite.

Pengujian akhir: **45 tes lulus pada 4 berkas**. Pemeriksaan interaksi UI dilakukan dalam jsdom yang terhubung ke backend Fastify/SQLite, bukan melalui mock keputusan. Pemeriksaan visual browser nyata belum dapat dilakukan karena keterbatasan alat; batas ini dijelaskan di bawah.

Repository awal: branch main, initial commit d04f39d. Perubahan A dibagi menjadi commit berdasarkan fondasi, domain, mesin, persistensi, API, UI, dan dokumentasi. Lihat git log untuk hash aktual setelah penyerahan; jangan menambahkan co-author otomatis.

## Cara menjalankan

Prasyarat Node.js >=24 dan npm. Tidak ada konfigurasi secret atau API key yang diperlukan.

```sh
npm ci
npm run db:init
npm run dev
```

Frontend: http://127.0.0.1:5173. Backend: http://127.0.0.1:3001. Backend berubah setelah restart dev; frontend mendukung HMR.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Untuk hasil build, buka http://127.0.0.1:3001. Hentikan dev dahulu agar port tidak bentrok.

Database utama: data/devpilot.sqlite, dibuat otomatis dan tidak masuk Git. Untuk latihan baru tanpa menghapus data, pilih DB_PATH baru, misalnya pada PowerShell:

```powershell
$env:DB_PATH="data/latihan-b-01.sqlite"
npm run dev
```

Jangan menyalin .runtime atau database QA ke data kerja. npm run db:init idempoten; tidak menghapus data atau memasukkan banyak rule. Instalasi npm pada sesi A menggunakan npm install; npm ci disediakan untuk instalasi ulang dari lockfile di mesin penerima.

## Status paket A

| Paket                          | Status  | Bukti utama                                                       |
| ------------------------------ | ------- | ----------------------------------------------------------------- |
| A1 — Fondasi dan domain        | Selesai | package.json, konfigurasi TS/Vite/Vitest, shared/domain.ts        |
| A2 — Persistensi dan bootstrap | Selesai | store.ts, catalog.ts, migrate.ts, tes restart database            |
| A3 — Mesin RDR dan regresi     | Selesai | rdr.ts, 16 tes mesin dan tes koreksi layanan                      |
| A4 — Backend bisnis            | Selesai | service.ts, app.ts, 20 tes layanan dan 6 tes HTTP                 |
| A5 — UI dasar dan handoff      | Selesai | App.tsx, components.tsx, 3 tes interaksi UI, README/API/keputusan |

## Gerbang serah terima

- [x] Dependensi terpasang dan perintah menjalankan telah dicoba.
- [x] Frontend/backend berjalan tanpa API key LLM.
- [x] Migrasi dan data persisten; restart diuji memakai file SQLite sementara.
- [x] Katalog awal diberi label DEMO secara eksplisit.
- [x] KB baru tepat satu root TRUE, tidak ada aturan rekomendasi otomatis.
- [x] Bootstrap root terjadi melalui persetujuan pakar.
- [x] Akses Codex, Claude Code, dan keduanya didukung serta diuji.
- [x] Inferensi true/false dan kesimpulan terakhir diuji.
- [x] Model/effort/skill divalidasi sebelum finalisasi.
- [x] Konsultasi dapat disetujui dari UI.
- [x] Koreksi dengan kondisi AND dapat diperiksa dan disimpan dari UI.
- [x] Penyisipan pada cabang terminal kosong diuji, termasuk false-child.
- [x] Kondisi pembeda salah dan regresi ditolak; transaksi tidak meninggalkan node parsial.
- [x] Hasil sementara dan final dibedakan.
- [x] Riwayat, kasus kunci, trace, dan alasan aturan tersedia.
- [x] Kontrak data serta keterbatasan dicatat.

Checklist fungsional didukung tes otomatis dan smoke HTTP. Checklist ini tidak menyatakan inspeksi visual browser nyata telah lulus.

## Peta kode

| Lokasi                | Isi                                                     |
| --------------------- | ------------------------------------------------------- |
| shared/domain.ts      | Tipe, skema Zod, field/enum, kontrak hasil              |
| server/rdr.ts         | Evaluasi, inferensi, kandidat, pemasangan node, regresi |
| server/store.ts       | Migrasi v1, FK, snapshot, versi, transaksi, event       |
| server/catalog.ts     | DEMO, lookup default, validasi konfigurasi              |
| server/service.ts     | Konsultasi, bootstrap, review, draft, koreksi, outcome  |
| server/app.ts         | Endpoint HTTP dan error                                 |
| server/index.ts       | Server hasil build                                      |
| scripts/dev.ts        | Fastify + Vite satu proses                              |
| src/App.tsx           | Alur UI dasar dan state tampilan                        |
| src/components.tsx    | Field aksesibel, kartu hasil, builder, perbandingan     |
| tests/rdr.test.ts     | 16 tes mesin                                            |
| tests/service.test.ts | 20 tes layanan dan persistensi                          |
| tests/api.test.ts     | 6 tes HTTP termasuk penyajian frontend                  |
| tests/ui.test.tsx     | 3 tes interaksi dengan backend nyata                    |

Kontrak endpoint dan contoh body: [docs/API.md](./docs/API.md). Keputusan teknis: [docs/DECISIONS.md](./docs/DECISIONS.md).

## Bukti pemeriksaan aktual

- TypeScript diperiksa selama implementasi; build akhir juga menjalankan pemeriksaan tipe.
- Suite akhir lulus: 45/45 tes, 4/4 berkas.
- UI end-to-end: pilih model akses, simpan profil, kirim task, setujui bootstrap, kirim task macet, pilih dua kondisi AND, preview regresi, simpan koreksi, verifikasi node dan hasil final.
- Uji akses dua layanan serta pemulihan dari error validasi UI lulus.
- Uji false-child, unknown, threshold numerik, cornerstone, stale version, regresi, akses/effort tidak valid, draft, outcome, dan restart lulus.
- Build frontend/backend telah dijalankan; perintah akhir adalah npm run build.
- Mode hasil build: halaman / mengembalikan HTTP 200 dan /api/health menghasilkan ok=true.
- Mode dev: frontend Vite HTTP 200 dan /api/health melalui proxy Vite menghasilkan ok=true.
- Tidak ada panggilan model AI, instalasi skill, atau biaya API dalam pemeriksaan ini.

Jika B mengganti kode/dependensi, jalankan ulang tes yang relevan. Tidak perlu menganggap hasil A berlaku otomatis sesudah perubahan.

## Keterbatasan yang diketahui

1. Browser QA visual belum selesai: in-app browser melaporkan host tidak tersedia; alat Windows berhenti karena tidak dapat menentukan URL aktif dengan andal. Periksa tampilan desktop/mobile dan keyboard pada browser normal saat B mengerjakan UX.
2. Tabel pohon dan daftar trace adalah tampilan dasar. Visualisasi interaktif masih B2.
3. Katalog DEMO belum mewakili kemampuan/harga/model nyata. Tidak ada benchmark penghematan token.
4. UI administrasi katalog dan form outcome belum dibuat; backend keduanya sudah tersedia untuk B3.
5. Peran pakar/konsumen adalah tampilan demo lokal, bukan autentikasi. Tidak untuk publikasi multiuser.
6. Node.js 24.11.1 saat pengujian menampilkan ExperimentalWarning node:sqlite. Ini sesuai pilihan runtime dan dicatat pada README.
7. Audit dependensi runtime setelah memperbarui @fastify/static ke 10.1.8 menghilangkan temuan high; masih terdapat 3 temuan moderate pada rantai glob/minimatch/@fastify/static. Tidak dilakukan downgrade paksa ke plugin lama yang tidak sesuai stack. Server demo dibatasi loopback; tinjau pembaruan transitif sebelum penggunaan lebih luas.
8. Melengkapi fakta/akses dilakukan lewat snapshot konsultasi baru pada task sama. Refresh hanya menghitung ulang kasus tetap setelah perubahan KB/katalog.

Tidak ada bug fungsional yang diketahui dari skenario yang diuji. Ini tidak menggantikan pengujian pada proyek nyata dan inspeksi browser.

## Keputusan yang perlu dipahami B

- Field/enum internal memakai bahasa Inggris; label produk berbahasa Indonesia.
- Root default dipetakan berdasarkan layanan utama dan katalog, bukan memilih model melalui chatbot.
- Node pengecualian menyimpan snapshot seluruh paket konfigurasi; jangan mencampur field beberapa kesimpulan.
- Pemasangan node berada pada terminal kosong. Cornerstone diambil dari node terakhir yang cocok; keduanya bisa berbeda.
- Koreksi memakai pemeriksaan regresi konservatif untuk seluruh cornerstone dan kasus disetujui.
- PUT katalog memakai version check; penonaktifan tidak mengganti snapshot historis.
- Persetujuan bootstrap menaikkan versi KB walau jumlah node tetap satu.
- DRAFT kasus berada di form; draft koreksi disimpan backend.
- Tidak ada edit/hapus node dan tidak ada reset data otomatis.

## Lanjutan untuk Person B — 40 poin

### B1 — 12 poin

Sempurnakan tata letak, form bertahap, bantuan istilah, state loading/error, kartu konfigurasi, dan builder koreksi. Pertahankan kontrak API yang telah diuji. App.tsx boleh dipecah menjadi halaman/hooks agar lebih mudah dirawat.

### B2 — 10 poin

Ganti tabel pohon dengan visualisasi interaktif, sorot trace dan node kesimpulan, tampilkan detail cornerstone, serta buat riwayat visual. Pastikan kanan TRUE dan kiri FALSE tetap konsisten.

### B3 — 10 poin

Bangun UI pengelolaan katalog/default melalui GET/PUT /catalog, serta form laporan melalui POST /tasks/:id/outcomes. Verifikasi sumber resmi jika memakai model nyata; jika belum, pertahankan DEMO. Pisahkan token, biaya API, dan kuota subscription.

### B4 — 8 poin

Jalankan tes inti sekali pada awal, tambah pemeriksaan integrasi untuk perubahan B, lakukan QA browser nyata, lengkapi demo dan bahan presentasi Markdown, README akhir, serta catatan kontribusi.

Pekerjaan di luar scope tidak menjadi syarat selesai. Jangan mempublikasikan aplikasi, menambah langganan, atau mengintegrasikan akun secara otomatis.
