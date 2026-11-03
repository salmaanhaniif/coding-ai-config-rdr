# coding-ai-config-rdr

DevPilot RDR — sistem pakar lokal untuk memilih layanan, model nyata, effort eksplisit, thinking, dan langkah kerja coding AI bagi junior developer.

Input mendukung Codex, Claude Code, ChatGPT Work, atau kombinasi layanan. Contoh hasil: **Gunakan Codex, model GPT-6.1 Sol, effort high, mode thinking aktif.** Hasil juga menyertakan cara memilih konfigurasi atau perintah CLI, sumber resmi, dan tanggal verifikasi. Lihat [basis pengetahuan model nyata](./docs/MODEL_NYATA.md).

Paket Person A (A1–A5) menyediakan mesin RDR, database, API, serta antarmuka dasar yang terhubung. Penyempurnaan visual dan fitur presentasi milik Person B dijelaskan pada [handoff](./HANDOFF_A_TO_B.md).

## Antarmuka

Layout mempertahankan sidebar dan halaman awal: Konsultasi, Expert review, Rule tree, Task history, dan Model catalog. Konsultasi mengikuti tahap profil akses dan detail task, kemudian menampilkan model, effort, serta penilaian pakar. Perapian tampilan berfokus pada teks, ukuran font, label status, dan jarak elemen.

Rekomendasi tetap berstatus sementara sampai dinilai pakar sesuai tugas RDR.

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

Database normal: `data/recommendations-2026-11-03.sqlite`. Saat pertama dibuka tanpa DB_PATH, aplikasi membentuk **140 kasus acuan dan 133 aturan** melalui layanan persetujuan/koreksi RDR. Data `devpilot.sqlite` dan `expert-demo.sqlite` lama tetap utuh. Database, log, build, cache, dan node_modules diabaikan Git.

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

## Skenario lama untuk latihan metode

Jalankan satu kali untuk membuat database simulasi terpisah:

```sh
npm run demo:expert
npm run dev:expert
```

Perintah `demo:expert` dan `dev:expert` mempertahankan latihan sintetis versi lama: 10 konsultasi, lima node akhir, dan tiga contoh koreksi ditolak. Untuk katalog nyata dan tree yang lebih lengkap gunakan **npm run dev**, tanpa DB_PATH. Generator lama tidak menimpa database.

Latihan lama ini merupakan simulasi akademik dengan model DEMO, bukan validasi pakar independen. Gunakan `npm run demo:expert -- --help` untuk pilihan nama database latihan.

## Katalog model nyata

Katalog awal memakai GPT-6 Luna, GPT-6.1 Sol, GPT-6 Astra, Claude Sonnet 5.5, dan Claude Opus 5.5, dengan sumber resmi dan tanggal verifikasi 3 November 2026. ID katalog untuk ChatGPT Work dipisahkan dari Codex, meskipun ID model layanannya sama.

Profil nyata menyebut effort tertentu, seperti low, medium, atau high, serta dukungan thinking yang sesuai model. Mode kerja (investigasi/perencanaan/eksekusi) adalah petunjuk alur kerja aplikasi, bukan sakelar produk.

`Store` baru tetap dimulai dari satu root TRUE. Startup default memanggil pembentuk basis pengetahuan yang menjalankan kasus, bootstrap, dan koreksi sah dengan pemeriksaan regresi. DB_PATH baru yang dipilih secara eksplisit dimulai dari satu root untuk latihan manual. Inferensi konsultasi tetap hanya menggunakan tree RDR.

Sumber resmi memverifikasi dukungan model dan pengaturan. Pilihan model per task adalah kurasi pengetahuan awal, belum hasil benchmark atau penilaian ahli independen. Buat profil akses sendiri; akses kasus acuan tidak dianggap sebagai akses pengguna.

## Alur latihan manual dari satu root

Gunakan DB_PATH baru untuk mengikuti alur ini. Pada startup default, acuan root dan aturan sudah disiapkan.

1. Buat profil akses. Pilih Codex dan model nyata yang tersedia pada akun, termasuk GPT-6.1 Sol untuk konfigurasi dasar, lalu konfirmasi akses.
2. Buat kasus awal dengan kebutuhan jelas, cakupan satu fungsi, dan percobaan gagal 0.
3. Isi kriteria selesai yang dapat diuji, lalu minta rekomendasi. Statusnya masih sementara.
4. Buka penilaian pakar, isi alasan, lalu pilih Setuju & jadikan acuan root. Ini bootstrap cornerstone; rule tetap satu.
5. Buat konsultasi baru dengan percobaan gagal 3. Bisa ditautkan ke task sebelumnya.
6. Buka penilaian pakar. Bandingkan dengan kasus kunci dan tambahkan kandidat Percobaan gagal gte 3.
7. Pilih profil Codex / Debugging kompleks, isi alasan, lalu Periksa koreksi.
8. Jika valid, Simpan aturan & setujui. Rule baru menjadi anak kanan root dan kasus baru menjadi cornerstone-nya.
9. Lihat Rule tree dan Task history.
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
server/catalog.ts      Validasi katalog, snapshot, kompatibilitas; fixture DEMO lama
server/real-catalog.ts  Model nyata, sumber, dukungan effort/thinking, profil
server/knowledge.ts     Kasus acuan dan pembentukan tree melalui koreksi RDR
server/runtime-store.ts Pemilihan database kerja dan persiapan pertama
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
- [Skenario demo dan bahan presentasi](./docs/PRESENTASI_DEMO.md)

## Batas penggunaan

Aplikasi ditujukan untuk demonstrasi lokal. Pilihan peran adalah perpindahan tampilan, bukan autentikasi. Server mengikat loopback dan tidak melakukan pemanggilan AI, pemasangan skill, atau pembelian subscription. Jangan mempublikasikannya sebagai aplikasi multiuser sebelum menambahkan autentikasi dan otorisasi.

Pohon menampilkan cabang kiri FALSE dan kanan TRUE yang dapat dibuka/ditutup, trace konsultasi aktif, node kesimpulan, serta kondisi/cornerstone. Pakar dapat mengubah katalog dan mencatat outcome task. Belum ada hasil benchmark penghematan token.

Pengujian UI memakai React Testing Library + jsdom dengan backend Fastify dan SQLite nyata melalui app.inject. Ini memeriksa interaksi dan integrasi, bukan pemeriksaan visual pada browser nyata. Status verifikasi aktual serta batas browser QA dicatat pada handoff.
