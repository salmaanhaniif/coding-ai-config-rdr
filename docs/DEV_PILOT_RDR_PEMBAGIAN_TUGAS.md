# DevPilot RDR — Pembagian Kerja Estafet Dua Orang

> Person A mengerjakan lebih dahulu: 60% bobot pekerjaan.
> Person B melanjutkan setelah serah terima: 40% bobot pekerjaan.
> Acuan produk: [DEV_PILOT_RDR_CONTEXT.md](./DEV_PILOT_RDR_CONTEXT.md).
> Status dokumen: rencana pembagian kerja; belum menjadi laporan implementasi.

## 1. Prinsip pembagian

Pembagian dilakukan berdasarkan estimasi bobot kompleksitas dan cakupan pekerjaan, bukan jumlah file, baris kode, atau durasi kerja pasti. Total bobot adalah 100 poin: A 60 poin dan B 40 poin.

Person A menyerahkan aplikasi dasar yang sudah dapat menjalankan alur konsultasi, inferensi, persetujuan/koreksi pakar, dan penyimpanan. Person B melanjutkan dengan penyempurnaan pengalaman pengguna, visualisasi pohon, pengelolaan katalog, evaluasi hasil, pengujian integrasi, serta dokumentasi akhir.

Sistem kerja bersifat berurutan:

```text
Person A — 60 poin
Fondasi → mesin RDR → backend → alur dasar yang berfungsi
                          ↓
              Serah terima kode dan bukti pemeriksaan
                          ↓
Person B — 40 poin
Penyempurnaan UI → visualisasi dan katalog → evaluasi → demo akhir
```

Pekerjaan A harus cukup lengkap agar B melanjutkan implementasi yang dapat dijalankan. Serah terima bukan penyerahan kerangka kosong atau backend yang belum terhubung ke UI.

Dokumen konteks utama tetap menjadi acuan persyaratan produk dan algoritma. Dokumen ini menetapkan pemilik pekerjaan serta batas serah terima. Jika pembagian perlu berubah, pindahkan scope dan bobot secara eksplisit sambil menjaga total A 60 dan B 40; jangan memindahkan pekerjaan yang belum selesai diam-diam.

## 2. Ringkasan bobot

| ID  | Paket pekerjaan                                                   | Pemilik |   Bobot |
| --- | ----------------------------------------------------------------- | ------- | ------: |
| A1  | Setup proyek, arsitektur, skema domain, dan kontrak data          | A       |       8 |
| A2  | Database, katalog DEMO, default, dan bootstrap root               | A       |      10 |
| A3  | Mesin RDR, koreksi, regresi, dan pengujian inti                   | A       |      18 |
| A4  | Backend konsultasi, penilaian, validasi akses, dan riwayat        | A       |      12 |
| A5  | UI dasar yang terhubung dan paket serah terima                    | A       |      12 |
| B1  | Penyempurnaan UI, alur formulir, dan kartu rekomendasi            | B       |      12 |
| B2  | Visualisasi pohon, perbandingan kasus, dan riwayat visual         | B       |      10 |
| B3  | UI pengelolaan katalog dan pencatatan hasil task                  | B       |      10 |
| B4  | Integrasi akhir, skenario demo, dokumentasi, dan bahan presentasi | B       |       8 |
|     | **Total Person A**                                                | **A**   |  **60** |
|     | **Total Person B**                                                | **B**   |  **40** |
|     | **Total proyek**                                                  |         | **100** |

Bobot bersifat estimasi perencanaan. Catat realisasi dan perubahan scope agar pembagian kontribusi dapat dijelaskan, tanpa mengklaim durasi sebenarnya selalu tepat 60:40.

## 3. Pekerjaan Person A — 60%

### A1. Setup, domain, dan kontrak data — 8 poin

Pekerjaan:

- Periksa instruksi proyek dan spesifikasi konteks sebelum implementasi.
- Tetapkan stack sesuai lingkungan; jika proyek kosong, gunakan usulan dalam dokumen konteks atau catat alasan perubahan.
- Siapkan frontend, backend, konfigurasi TypeScript, dependensi, dan perintah menjalankan aplikasi.
- Definisikan tipe profil akses, kasus, node, kondisi, paket rekomendasi, katalog, trace, review, dan outcome.
- Definisikan enum dan perlakuan nilai unknown.
- Buat kontrak request/response beserta format error yang dapat dipakai UI.

Hasil yang diserahkan:

- Struktur proyek yang dapat dijalankan.
- Skema domain dan kontrak data yang terdokumentasi.
- Panduan setup awal dan keputusan arsitektur.

Selesai jika frontend dan backend berjalan, serta B tidak perlu menebak nama atribut atau format respons.

### A2. Database, katalog DEMO, dan root — 10 poin

Pekerjaan:

- Implementasikan database, migrasi, relasi, snapshot kasus, dan versi KB/katalog.
- Buat katalog sintetis dengan label DEMO yang terlihat jelas.
- Siapkan profil default dan pemetaan eksplisit ke layanan utama pengguna.
- Inisialisasi KB baru dengan tepat satu root TRUE.
- Implementasikan penyimpanan kasus acuan awal dan bootstrap cornerstone root melalui penilaian pakar.
- Siapkan penyimpanan TaskOutcome agar B dapat membangun formulir evaluasi tanpa merombak skema.
- Pastikan startup atau seed tidak menghapus data kerja maupun menambah banyak rule secara otomatis.

Hasil yang diserahkan:

- Database persisten dan migrasi.
- Data demonstrasi yang dapat dibedakan dari model nyata.
- Alur bootstrap yang dapat dicoba dari UI dasar.
- Prosedur menyiapkan database demo terpisah atau salinan database untuk latihan.

Selesai jika data tetap ada setelah restart dan KB baru dapat dibuktikan hanya memiliki satu rule.

### A3. Mesin RDR dan pengujian inti — 18 poin

Pekerjaan:

- Implementasikan evaluator kondisi berbentuk data/AST, tanpa eval.
- Dukung atribut kategorikal, numerik, himpunan, unknown, dan gabungan AND sesuai spesifikasi.
- Implementasikan penelusuran kanan saat true dan kiri saat false.
- Perbarui kesimpulan hanya saat kondisi node benar.
- Kembalikan lastMatchedNode, node terminal, cabang terminal, dan trace.
- Validasi kondisi koreksi: benar pada kasus baru dan salah pada cornerstone kesimpulan yang dikoreksi.
- Pasang node baru pada cabang terminal yang kosong; jangan menimpa subtree.
- Implementasikan pemeriksaan regresi cornerstone dan kasus yang sudah disetujui.
- Implementasikan transaksi koreksi, versi KB, serta penolakan koreksi berbasis versi lama.
- Cegah struktur pohon tidak sah dan referensi cornerstone yang hilang.
- Jalankan pengujian perilaku inti pada bagian pengujian dokumen konteks.

Hasil yang diserahkan:

- Mesin RDR terpisah dari komponen UI.
- Pengujian inti dan hasil aktualnya.
- Contoh kecil true-child dan false-child, termasuk terminal yang berbeda dari lastMatchedNode.

Selesai jika kesimpulan terakhir, penempatan node, validitas kondisi pembeda, dan regresi terbukti benar. Mesin tidak boleh diganti pemilihan berbasis chatbot atau pencocokan aturan datar.

### A4. Backend alur bisnis — 12 poin

Pekerjaan:

- Implementasikan penyimpanan profil akses dan kasus konsultasi.
- Dukung mulai task dan task macet melalui skema kasus yang sama.
- Implementasikan inferensi, antrean pakar, persetujuan, draft koreksi, dan finalisasi.
- Pastikan hasil sementara tidak ditampilkan sebagai hasil yang sudah disetujui.
- Validasi model, effort, skill, dan akses sebelum finalisasi.
- Simpan hasil mentah, konfigurasi terurai, snapshot katalog, dan trace.
- Sediakan operasi baca pohon, riwayat task, dan detail review untuk B.
- Sediakan operasi pengelolaan katalog/default dan pencatatan outcome yang dibutuhkan B.
- Pertahankan hasil historis ketika katalog berubah.

Hasil yang diserahkan:

- Backend yang digunakan UI dasar, bukan endpoint tiruan.
- Daftar operasi, contoh request/response, status, dan error.
- Pengujian layanan/validasi yang relevan untuk perubahan data.

Selesai jika satu konsultasi dapat dibuat, dinilai, dikoreksi, dan dibaca kembali dari database.

### A5. UI dasar dan serah terima — 12 poin

Pekerjaan:

- Buat navigasi dan pilihan tampilan konsumen/pakar untuk demo lokal.
- Hubungkan form profil akses dan form konsultasi ke backend.
- Tampilkan paket rekomendasi beserta status sementara/final.
- Buat antrean penilaian, aksi setuju, dan form koreksi dasar yang dapat digunakan.
- Form koreksi minimal menampilkan kasus baru dan cornerstone secara terbaca, memungkinkan memilih kondisi pembeda dan paket pengganti, serta menampilkan hasil validasi/regresi.
- UI dasar mendukung pembentukan kondisi AND yang didukung backend, walaupun tampilan belum disempurnakan.
- Pastikan alur bootstrap root tersedia dari antarmuka.
- Sediakan tampilan sederhana trace dan riwayat untuk memeriksa hasil.
- Buat dokumen serah terima dengan format pada bagian 7.
- Catat perintah aktual setup, migrasi, menjalankan, build, dan test.

Hasil yang diserahkan:

- Aplikasi dasar yang dapat didemonstrasikan dari browser.
- README awal, kontrak data, catatan keputusan, dan catatan serah terima.
- Daftar sisa pekerjaan B yang merujuk B1–B4.

Selesai jika A dapat menunjukkan alur lengkap: kasus → inferensi → penilaian pakar → koreksi sah → hasil final → data tetap ada setelah restart.

## 4. Gerbang serah terima A ke B

A menandai pekerjaan siap diserahkan setelah checklist berikut terpenuhi:

- [ ] Setup dari instruksi tertulis berhasil.
- [ ] Frontend dan backend berjalan tanpa API key LLM.
- [ ] Migrasi database tersedia dan data persisten.
- [ ] Katalog DEMO berlabel jelas.
- [ ] KB baru memiliki satu root TRUE.
- [ ] Bootstrap kasus kunci root berfungsi.
- [ ] Form menerima akses Codex, Claude Code, atau keduanya.
- [ ] Inferensi benar untuk cabang true dan false.
- [ ] Model serta effort divalidasi terhadap katalog dan akses.
- [ ] Konsultasi bisa disetujui pakar.
- [ ] Koreksi sah menambah node pada posisi terminal yang tepat.
- [ ] Koreksi tidak sah dan regresi ditolak dengan alasan yang terbaca.
- [ ] Status sementara/final tidak tertukar.
- [ ] Pengujian inti lulus, dengan hasil aktual dicatat.
- [ ] Riwayat dan trace dapat dibaca B melalui backend/UI dasar.
- [ ] Kontrak data, keputusan teknis, dan keterbatasan diketahui tertulis.

B melakukan pemeriksaan penerimaan singkat terhadap gerbang ini sebelum memulai B1. Jika fungsi wajib A masih rusak, A menyelesaikannya dahulu. Perbaikan fondasi yang belum selesai tidak otomatis dihitung sebagai bagian pekerjaan B.

Person B boleh menemukan bug baru selama integrasi. Bug tersebut dicatat terpisah dari scope yang belum pernah diselesaikan A. Jika perbaikannya besar, sepakati perpindahan paket dan bobot secara eksplisit.

## 5. Pekerjaan Person B — 40%

### B1. Penyempurnaan pengalaman pengguna — 12 poin

Pekerjaan:

- Lanjutkan UI dasar A, pertahankan kontrak yang sudah berfungsi.
- Perbaiki tata letak, tipografi, navigasi, konsistensi komponen, dan tampilan pada layar kecil.
- Jadikan pengisian form bertahap dengan bantuan istilah dan validasi yang mudah dipahami.
- Rapikan perbedaan alur mulai task dan task macet.
- Prioritaskan layanan, model, effort, mode, skill, dan langkah berikutnya pada kartu hasil.
- Tampilkan alasan, kebutuhan konteks, evaluasi ulang, dan kriteria selesai dalam detail yang dapat dibuka.
- Tangani loading, kondisi kosong, kegagalan, dan kebutuhan informasi tambahan.
- Sempurnakan builder kondisi serta pemilihan konfigurasi pengganti pada panel pakar.

Selesai jika konsumen dan pakar dapat memakai alur yang sudah dibangun A tanpa harus memahami istilah internal atau membaca JSON.

### B2. Pohon dan penjelasan keputusan — 10 poin

Pekerjaan:

- Implementasikan visualisasi pohon biner dari data backend A.
- Pastikan kanan TRUE dan kiri FALSE terlihat konsisten, bukan hanya mengandalkan warna.
- Sorot jalur konsultasi, hasil evaluasi tiap node, dan node pemberi kesimpulan akhir.
- Tampilkan detail kondisi, kesimpulan, cornerstone, dan alasan pakar ketika node dipilih.
- Sempurnakan perbandingan kasus baru vs cornerstone dengan penanda perbedaan atribut.
- Bangun riwayat visual task, konsultasi ulang, dan koreksi yang terkait.
- Pastikan visualisasi tetap dapat dibaca ketika pohon bertambah.

Selesai jika jalur yang ditampilkan sesuai trace mesin dan penonton dapat memahami asal rekomendasi.

### B3. Katalog dan hasil task — 10 poin

Pekerjaan:

- Buat UI pengelolaan model, effort, profil konfigurasi, skill, dan default menggunakan backend A.
- Tampilkan status aktif/nonaktif, kompatibilitas, sumber, tanggal verifikasi, dan label DEMO.
- Untuk entri nyata yang dipakai demo, verifikasi model dan effort dari dokumentasi resmi, catat sumber/tanggal, dan bedakan dari entri sintetis.
- Jika verifikasi belum dapat dilakukan, pertahankan label DEMO dan catat keterbatasannya; jangan mengarang kemampuan model.
- Tambahkan UI pencatatan keberhasilan task, bukti, waktu, jumlah percobaan, dan penggunaan opsional.
- Tampilkan ringkasan hasil tersimpan tanpa menyatakan hubungan sebab-akibat atau penghematan yang belum dibuktikan.
- Pisahkan token, biaya API, dan kuota subscription; nilai tidak diketahui tetap unknown.

Selesai jika katalog dapat dikelola melalui UI dan satu task dapat memiliki laporan hasil yang tersimpan serta terbaca kembali.

### B4. Integrasi, demo, dan dokumentasi akhir — 8 poin

Pekerjaan:

- Jalankan pengujian inti milik A sekali sebagai pemeriksaan integrasi awal.
- Tambahkan pengujian integrasi untuk alur UI/backend yang diselesaikan B.
- Periksa build, persistensi, validasi akses, status hasil, dan jalur penjelasan.
- Perbaiki bug integrasi dalam scope B dan catat temuan terhadap fondasi.
- Siapkan skenario demo dari KB satu rule, lalu bentuk aturan melalui aksi pakar.
- Sediakan demo yang menunjukkan true-child, false-child, persetujuan, koreksi, dan penolakan kondisi pembeda yang tidak sah.
- Lengkapi README, langkah setup, gambaran arsitektur, batasan, dan hasil pemeriksaan aktual.
- Buat bahan presentasi ringkas dalam Markdown dan catatan kontribusi A/B.

Selesai jika aplikasi dapat dijalankan mengikuti README dan demo end-to-end dapat diulang tanpa mengubah database secara manual di tengah presentasi.

## 6. Batas tanggung jawab agar pekerjaan tidak tumpang tindih

| Area            | A menyerahkan                                   | B melanjutkan                                                        |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Mesin RDR       | Implementasi dan pengujian inti lengkap         | Mengintegrasikan hasil dan melaporkan bug; tidak mengganti algoritma |
| Database        | Skema, migrasi, snapshot, versi, dan transaksi  | Memakai skema; migrasi baru hanya bila fitur B memerlukannya         |
| Kontrak backend | Operasi yang dibutuhkan seluruh MVP             | Menghubungkan dan menyempurnakan UI                                  |
| Konsultasi      | Form dan hasil dasar yang benar-benar berfungsi | Form bertahap, bantuan, tampilan hasil yang lebih jelas              |
| Koreksi pakar   | Alur valid, perbandingan dasar, builder kondisi | Perbandingan visual dan builder yang lebih nyaman                    |
| Pohon           | Data struktur dan trace                         | Visualisasi interaktif serta penjelasan                              |
| Katalog         | Model data, operasi, default, dan seed DEMO     | UI pengelolaan dan verifikasi entri nyata jika digunakan             |
| Hasil task      | Skema dan operasi penyimpanan/baca              | Form outcome dan ringkasan hasil                                     |
| Pengujian       | Inferensi, koreksi, integritas, validasi inti   | Integrasi akhir dan alur antarmuka                                   |
| Dokumentasi     | Setup awal, kontrak, keputusan, handoff         | Panduan final, demo, presentasi, dan kontribusi                      |

A tidak harus menyelesaikan desain visual akhir, visualisasi interaktif, atau seluruh UI administrasi katalog sebelum menyerahkan. Sebaliknya, B tidak seharusnya membangun ulang mesin inferensi dan persistensi yang menjadi paket A.

## 7. Isi paket serah terima

A membuat catatan implementasi terpisah saat pekerjaannya selesai, misalnya HANDOFF_A_TO_B.md. File tersebut belum perlu dibuat saat pembagian tugas ini disusun.

Isi wajib:

```markdown
# Serah Terima Person A → Person B

## Versi yang diserahkan

- Tanggal:
- Commit/tag bila menggunakan Git:
- Stack dan versi runtime:

## Cara menjalankan

- Instalasi dependensi:
- Konfigurasi lingkungan:
- Migrasi/seed database:
- Menjalankan aplikasi:
- Build:
- Test:

## Status paket A

- A1:
- A2:
- A3:
- A4:
- A5:

## Peta kode

- Mesin RDR:
- Skema database:
- Kontrak request/response:
- UI konsultasi:
- UI pakar:
- Seed/default:

## Bukti pemeriksaan

- Pengujian yang dijalankan dan hasil aktual:
- Alur yang sudah dicoba:
- Data demo dan prosedur bootstrap:

## Keputusan teknis

- Keputusan dan alasannya:
- Perbedaan dari usulan dokumen konteks:

## Keterbatasan/bug diketahui

- Gejala, dampak, langkah reproduksi, dan pemilik perbaikan:

## Lanjutan untuk B

- B1:
- B2:
- B3:
- B4:
```

Gunakan perintah yang benar-benar tersedia di proyek. Jangan menulis bahwa tes atau setup berhasil jika belum dijalankan. Jangan menyerahkan secret atau kredensial dalam catatan.

## 8. Aturan kerja estafet

1. A bekerja dahulu sampai gerbang serah terima terpenuhi.
2. Jika Git digunakan, A menyerahkan commit yang dapat ditelusuri; B melanjutkan dari versi tersebut. Tidak perlu commit, push, atau publikasi otomatis hanya karena dokumen ini menyebut Git.
3. B membaca dokumen konteks, pembagian ini, README, dan handoff sebelum mengubah kode.
4. B menjalankan setup serta pemeriksaan penerimaan untuk memastikan kondisi awal sesuai laporan A.
5. Perubahan kontrak data atau algoritma dicatat beserta alasan dan pemeriksaan dampaknya.
6. B mempertahankan bukti kontribusi A dan tidak mengubah riwayat agar terlihat sebagai pekerjaan satu orang.
7. Kedua orang harus memahami aturan kanan/true, kiri/false, kesimpulan terakhir, serta cornerstone untuk presentasi.
8. Deployment, integrasi akun, dan fitur di luar MVP tidak ditambahkan sebagai syarat penyelesaian pembagian ini.

## 9. Urutan demo yang disiapkan B

1. Tunjukkan katalog DEMO atau katalog nyata yang sumbernya tercatat.
2. Mulai dari KB satu root TRUE.
3. Tunjukkan profil akses dan bootstrap kasus kunci awal yang disetujui pakar.
4. Masukkan kasus baru yang memerlukan koreksi.
5. Bandingkan kasus baru dengan cornerstone dan pilih kondisi pembeda yang valid.
6. Simpan aturan lalu tunjukkan kesimpulan baru serta pohonnya.
7. Tunjukkan contoh false-child dan node terakhir yang cocok.
8. Demonstrasikan penolakan aturan yang juga cocok dengan cornerstone yang harus dilindungi.
9. Tunjukkan konsultasi task macet dan kartu model/effort yang dihasilkan.
10. Simpan hasil task, restart aplikasi, dan buktikan riwayat tetap tersedia.

Kasus demo harus disiapkan agar secara deterministik membentuk jalur yang diperlukan melalui alur pakar. Jangan menulis banyak rule otomatis pada KB baru atau merekayasa data secara manual saat demo berjalan.

## 10. Checklist penyelesaian akhir

- [ ] Semua gerbang serah terima A selesai.
- [ ] B1–B4 selesai dan bukti pemeriksaannya tercatat.
- [ ] Form mendukung Codex, Claude Code, dan keduanya.
- [ ] Model/effort final kompatibel dengan akses yang dikonfirmasi.
- [ ] Konsultasi mulai task dan task macet berfungsi.
- [ ] Persetujuan serta koreksi pakar berfungsi dari UI.
- [ ] Visualisasi sesuai struktur dan trace mesin RDR.
- [ ] UI katalog/default dan laporan hasil task berfungsi.
- [ ] Data tetap tersedia setelah restart.
- [ ] Data DEMO dibedakan dari informasi model nyata.
- [ ] Pengujian relevan dan build berhasil, atau keterbatasan nyata dilaporkan secara spesifik.
- [ ] README, handoff, skenario demo, bahan presentasi, dan kontribusi tersedia.
- [ ] Seluruh kriteria penerimaan dokumen konteks utama diperiksa.

## 11. Prompt vibe coding untuk Person A

```text
Baca DEV_PILOT_RDR_CONTEXT.md dan DEV_PILOT_RDR_PEMBAGIAN_TUGAS.md,
kemudian periksa instruksi lokal serta isi proyek.

Kerjakan paket Person A: A1–A5 (60 poin). Bangun fondasi, database,
katalog DEMO, root dan bootstrap cornerstone, mesin RDR, backend,
pengujian inti, dan UI dasar yang dapat menjalankan alur konsultasi
hingga koreksi pakar serta hasil final.

Pertahankan KB baru dengan satu rule. Pastikan kondisi pembeda,
posisi terminal pemasangan node, regresi, dan validasi akses/model/
effort sesuai spesifikasi. Jangan mengganti RDR dengan LLM.

Jangan mengambil alih penyempurnaan visual akhir dan fitur UI milik B.
Namun, seluruh backend yang dibutuhkan B harus siap dan terdokumentasi.

Selesaikan gerbang serah terima. Buat HANDOFF_A_TO_B.md dengan
perintah aktual, peta kode, hasil pemeriksaan, dan sisa pekerjaan B.
Jangan mengklaim pemeriksaan yang belum dijalankan.
```

## 12. Prompt vibe coding untuk Person B

```text
Baca DEV_PILOT_RDR_CONTEXT.md, DEV_PILOT_RDR_PEMBAGIAN_TUGAS.md,
README proyek, HANDOFF_A_TO_B.md, dan instruksi lokal yang berlaku.

Verifikasi setup serta gerbang serah terima A. Jika ada fondasi wajib
yang belum selesai, laporkan secara spesifik sebelum memasukkannya
sebagai pekerjaan baru B.

Lanjutkan paket Person B: B1–B4 (40 poin). Sempurnakan UI, formulir,
kartu model/effort, builder koreksi, visualisasi pohon dan trace,
riwayat, pengelolaan katalog, serta pencatatan hasil task.

Pertahankan algoritma dan kontrak yang sudah benar. Verifikasi sumber
resmi jika memasukkan model nyata; gunakan label DEMO jika belum
terverifikasi. Jalankan pemeriksaan integrasi yang relevan.

Selesaikan demo dari satu root melalui koreksi pakar, lengkapi README,
bahan presentasi Markdown, keterbatasan, dan catatan kontribusi A/B.
Jangan menambah deployment atau integrasi akun sebagai syarat MVP.
```
