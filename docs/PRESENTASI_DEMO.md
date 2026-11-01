# Demo DevPilot RDR

## Tujuan demo

Memperlihatkan satu root default, inferensi dua cabang, keputusan pakar, koreksi yang menambah satu pengecualian, keterlacakan kesimpulan, serta pencatatan hasil task. Semua model awal berlabel DEMO dan tidak menggambarkan kemampuan layanan nyata.

## Persiapan

Gunakan Node.js 24 atau lebih baru. Jalankan `npm ci`, `npm run db:init`, lalu `npm run dev`. Untuk mulai dengan KB bersih tanpa menghapus data, atur `DB_PATH=data/demo-rdr.sqlite` pada shell POSIX sebelum menjalankan perintah. Buka `http://127.0.0.1:5173`.

## Naskah demonstrasi

1. Buka katalog. Tunjukkan label DEMO, daftar model/effort, profil konfigurasi, dan default layanan. Jelaskan bahwa katalog dapat diedit oleh pakar dan entri nyata perlu sumber serta tanggal verifikasi.
2. Di Konsultasi, simpan profil akses Codex dan pilih model DEMO yang tersedia. Buat task mulai dengan kebutuhan jelas, satu fungsi, dan nol percobaan gagal.
3. Kirim konsultasi. Buka Meja pakar, jelaskan trace root, lalu setujui sebagai cornerstone root. KB tetap memiliki satu root TRUE.
4. Buat konsultasi baru bertipe Task macet yang terkait task yang sama. Isi tiga percobaan gagal dan gejala yang sesuai.
5. Buka perbandingan kasus baru dengan cornerstone. Tambahkan kandidat kondisi `Percobaan gagal >= 3`, pilih profil investigasi yang kompatibel, dan tulis alasan pakar.
6. Gunakan Periksa koreksi. Tunjukkan bahwa pemeriksaan memastikan kondisi benar pada kasus baru dan menjaga kasus protected. Simpan aturan setelah preview valid.
7. Buka Pengetahuan RDR. Tunjukkan node root, cabang kanan TRUE, label cabang, jalur konsultasi, dan node kesimpulan terbaru. Untuk demonstrasi cabang kiri pada rule pengecualian, buat konsultasi task macet dengan satu percobaan gagal; trace seharusnya mengikuti FALSE pada kondisi `Percobaan gagal >= 3`.
8. Saat menyiapkan koreksi lanjutan, coba kondisi `Percobaan gagal >= 0`. Tunjukkan penolakan karena kondisi itu juga cocok pada cornerstone root. Ubah menjadi `Percobaan gagal >= 1`, periksa preview, lalu simpan jika valid.
9. Buka Riwayat task. Catat keberhasilan, bukti, waktu, percobaan dan, bila tersedia, token/biaya/subscription pada field terpisah. Muat kembali laporan dan jelaskan bahwa ringkasan tidak membuktikan sebab-akibat atau penghematan.
10. Segarkan aplikasi dan tunjukkan bahwa konsultasi dan laporan tersimpan.

## Batas demonstrasi dan pemeriksaan

Nama model di seed adalah sintetis. Tidak ada panggilan LLM, akses akun, atau benchmark. Pemeriksaan implementasi Person B pada Node 26: typecheck dan build berhasil; seluruh 47 tes pada empat berkas lulus. QA browser lokal memeriksa tampilan ponsel dan desktop serta fokus keyboard dasar pada katalog; seluruh alur keyboard belum diaudit.

## Ringkasan presentasi

- Masalah: junior developer perlu memilih konfigurasi AI yang sesuai task dan akses.
- Metode: Ripple Down Rules dengan kondisi AND, anak kiri FALSE, anak kanan TRUE, dan kesimpulan terakhir yang cocok.
- Peran pakar: menyetujui hasil atau mengoreksi dengan pembeda yang melindungi cornerstone/kasus yang disetujui.
- Transparansi: katalog, konfigurasi, kondisi, trace, versi, serta hasil task terlihat.
- Batas: MVP lokal, katalog DEMO, tidak menjalankan model dan belum membuktikan penghematan.
