# Keputusan Teknis Person A

## Stack

React + TypeScript + Vite untuk antarmuka, Fastify untuk API, Zod untuk validasi, SQLite bawaan Node.js 24 untuk persistensi, serta Vitest untuk pengujian. Tidak memakai layanan LLM untuk keputusan inti.

SQLite bawaan menghindari dependensi native tambahan dan sesuai runtime Node 24 yang tersedia. Konsekuensinya Node >=24 diwajibkan dan runtime saat pengujian menampilkan ExperimentalWarning node:sqlite. Versi package aktual dipin melalui package-lock.json.

Development menjalankan Fastify dan Vite dalam satu proses, sehingga tidak meninggalkan subprocess backend watch ketika ditutup. Frontend memiliki HMR; perubahan backend memerlukan restart manual.

## Struktur dan data

- Tipe dan metadata atribut dibagi melalui shared/domain.ts.
- Mesin RDR tidak bergantung React, HTTP, atau database.
- Database memiliki tabel relasional untuk referensi utama; payload domain dan snapshot disimpan sebagai JSON.
- Migrasi v1 idempoten. Metadata menunjuk versi KB/katalog aktif; versi lama disimpan.
- Foreign key diaktifkan. Relasi child deferred agar penambahan node dan pengaitan parent dapat dilakukan atomik.
- Tidak ada endpoint untuk memodifikasi node lama atau menghapus KB.
- Audit menyimpan hasil sebelum refresh; konsultasi yang sudah final tidak dapat di-refresh.
- Kasus dan akses yang digunakan konsultasi merupakan snapshot, bukan objek yang berubah mengikuti profil terbaru.

## Root dan resolusi kesimpulan

Root TRUE adalah satu-satunya rule seed. Kesimpulan default dipetakan ke profil layanan utama melalui katalog. Pemetaan hanya lookup, tidak melakukan ranking. Katalog DEMO memiliki dua profil per layanan agar koreksi dapat dicoba tanpa model nyata.

Bootstrap memerlukan persetujuan satu kasus yang sesuai default. Menetapkan cornerstone root menaikkan versi KB dan membatalkan kelayakan trace konsultasi terbuka yang dibuat pada versi sebelumnya sampai di-refresh.

Node pengecualian menyimpan snapshot paket konfigurasi utuh. Lookup terhadap katalog saat finalisasi memeriksa kelayakan, tanpa diam-diam mengganti model atau effort yang dipilih aturan.

## Inferensi dan koreksi

Node cocok memperbarui kesimpulan lalu menelusuri kanan; node tidak cocok mempertahankan kesimpulan dan menelusuri kiri. Hanya satu jalur ditelusuri.

Penyisipan menggunakan cabang terminal yang kosong, sedangkan kondisi pembeda dibandingkan terhadap cornerstone node terakhir yang cocok. Kedua posisi ini bisa berbeda.

Seluruh cornerstone dan kasus yang sudah disetujui diperiksa sebelum koreksi. Kebijakan MVP memblok perubahan kesimpulan mentah pada kasus terlindungi. Ini kebijakan konservatif proyek, bukan klaim umum semua varian RDR.

Kesamaan kesimpulan dinilai pada paket aturan, bukan hanya nama model. Profil dengan langkah kerja atau effort berbeda tetap merupakan kesimpulan berbeda. Root tetap memiliki identitas kesimpulan default, walaupun lookup-nya bergantung layanan utama kasus.

## Penyederhanaan yang disengaja

- Nama field/enum internal memakai bahasa Inggris; label pengguna berbahasa Indonesia.
- DRAFT kasus berada di state form. Draft koreksi pakar disimpan di database.
- Melengkapi kasus NEEDS_INFORMATION dilakukan dengan konsultasi baru pada task yang sama untuk menjaga snapshot lama.
- Profil akses dibuat sebagai versi baru melalui POST; tidak ada edit snapshot lama.
- Pengelolaan katalog disediakan sebagai GET/PUT seluruh katalog berversi agar B tidak perlu banyak endpoint CRUD.
- Current model/effort disimpan dan divalidasi sebagai konteks kasus; belum menjadi field kondisi. Perlu perluasan schema eksplisit bila pakar membutuhkan pembeda tersebut.
- Meja pakar dan konsumen memakai perpindahan tampilan lokal. Tidak ada autentikasi multiuser.
- UI A menyediakan tabel pohon, daftar trace, riwayat, dan perbandingan atribut. Visualisasi interaktif serta administrasi katalog visual tetap scope B.
- Laporan outcome memiliki backend lengkap; UI-nya tetap scope B.

## Verifikasi dan lingkungan

Pemasangan npm serta proses esbuild memerlukan eksekusi di luar sandbox terbatas pada sesi pengembangan ini karena akses jaringan/direktori ditolak sandbox. Ini batas alat sesi, bukan kebutuhan menjalankan aplikasi sebagai administrator pada komputer normal.

Repository awal sudah memiliki .git dan initial commit. Git dalam sandbox sempat menolak ownership direktori; pemeriksaan memakai safe.directory hanya pada invocation terkait, tanpa mengubah konfigurasi Git global. Tidak dilakukan commit/push otomatis.

Pemeriksaan browser nyata belum dapat dilakukan: in-app browser melaporkan host unavailable, dan alat Windows berhenti karena tidak dapat menentukan URL aktif secara andal. Pengujian interaksi memakai React Testing Library/jsdom dan backend Fastify/SQLite sebenarnya. Jangan mengklaim hasil tersebut sebagai QA screenshot atau pengujian browser nyata.

## Dependensi runtime

Audit menemukan masalah pada versi awal plugin file statis; @fastify/static diperbarui ke 10.1.8 yang kompatibel dengan Fastify 5. Temuan high terselesaikan. Audit runtime masih melaporkan 3 moderate pada rantai glob/minimatch; tidak digunakan npm audit fix --force yang menawarkan downgrade lintas major. Detail batas penggunaan ada di handoff.
