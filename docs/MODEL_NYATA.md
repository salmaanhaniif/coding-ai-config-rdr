# Basis pengetahuan model nyata

Versi 3 November 2026. Jalankan `npm run dev` tanpa DB_PATH. Aplikasi membuka `data/recommendations-2026-11-03.sqlite`; startup pertama menyusun kasus acuan melalui bootstrap dan koreksi RDR, kemudian startup berikutnya memakai data tersimpan. Database lama tidak ditimpa. `npm start` dan `npm run db:init` memakai pilihan database yang sama.

Basis pengetahuan awal memiliki 140 konsultasi acuan dan 133 node termasuk root, dengan 8 entri model layanan dan 36 profil konfigurasi. Pohon dapat dibuka/ditutup per cabang dan otomatis membuka jalur konsultasi aktif.

Untuk menghapus pemilihan database lama dari sesi PowerShell, gunakan `Remove-Item Env:DB_PATH -ErrorAction SilentlyContinue`. Ini menghapus variabel sesi, bukan file database. DB_PATH eksplisit tetap dihormati; file baru dimulai dari satu root dan katalog nyata.

## Input dan hasil

- Pilih Codex, Claude Code, ChatGPT Work, atau beberapa layanan sekaligus. Konfirmasikan model yang memang tersedia di akun sendiri.
- Jenis task: bug, fitur, refactor, code review, pengujian, dokumentasi, arsitektur, dan keamanan.
- Pertimbangan aturan: cakupan, kejelasan, risiko, prioritas, batas waktu, ketersediaan tes, reproduksi, serta kegagalan berulang.
- Hasil menyebut layanan, nama model, effort eksplisit, thinking, langkah berikutnya, cara menerapkan, sumber, serta tanggal verifikasi. Mode kerja merupakan petunjuk aplikasi.
- Akses kasus acuan disembunyikan dari daftar profil pengguna. Rekomendasi baru tetap sementara sampai ditinjau; model di luar akses memunculkan kebutuhan informasi dan tidak dapat difinalkan.

Contoh debugging lintas modul:

> Gunakan Codex, model GPT-6.1 Sol, effort high, mode thinking aktif.

```sh
codex --model gpt-6.1-sol -c 'model_reasoning_effort="high"'
```

Codex mengatur reasoning lewat effort, tanpa sakelar thinking terpisah. Claude Code memakai thinking adaptif pada model 5.5 yang dipilih, dengan perintah seperti `claude --model claude-sonnet-5-5 --effort high`. ChatGPT Work memakai pemilih model dan pengaturan Advanced; model Work tidak otomatis tersedia di Chat biasa.

## Aturan dan batas klaim

Kasus acuan mencakup akses satu layanan, Codex + Claude Code dengan kedua pilihan layanan utama, serta Codex + ChatGPT Work dengan kedua pilihan layanan utama. Pada akses Codex + Claude Code, implementasi/debugging diarahkan ke Codex dan perencanaan/arsitektur ke Claude Code. Pada Codex + ChatGPT Work, implementasi ke Codex dan perencanaan ke Work. Ini pilihan kurasi aplikasi, bukan hasil perbandingan benchmark kedua produk.

Pemilihan tersebut hanya dipakai saat menyusun kasus acuan. Inferensi pengguna menjalankan aturan tree; tidak ada ranking model tersembunyi di luar RDR. Semua koreksi memakai pemeriksaan kondisi pembeda dan regresi seluruh kasus disetujui. Setiap kasus acuan diperiksa kembali setelah tree selesai. Kombinasi kondisi baru masih dapat membutuhkan koreksi pakar.

Sumber resmi memverifikasi identitas model, ketersediaan produk, effort, dan thinking. Sumber tersebut tidak membuktikan ketepatan setiap aturan per task. Kurasi ini belum merupakan validasi ahli independen, jaminan keberhasilan, atau bukti penghematan token.

## Sumber verifikasi

- [OpenAI: model di Work dan Codex](https://learn.chatgpt.com/docs/models).
- [OpenAI: GPT-6.1 Sol dan reasoning effort](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
- [OpenAI: konfigurasi Codex](https://learn.chatgpt.com/docs/config-file/config-reference).
- [Anthropic: model dan ID](https://platform.claude.com/docs/en/models/overview).
- [Claude Code: konfigurasi model, effort, dan thinking](https://code.claude.com/docs/en/model-config).

Pilihan yang muncul pada akun tetap mengikuti paket, rollout, client, dan pengaturan workspace. Jangan mengonfirmasi akses berdasarkan nama paket saja.
