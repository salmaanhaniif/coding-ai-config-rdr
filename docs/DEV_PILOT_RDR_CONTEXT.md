# DevPilot RDR — Konteks Produk dan Spesifikasi Implementasi

> Dokumen serah konteks untuk melanjutkan vibe coding tanpa mengulang diskusi ide.
> Bahasa produk dan dokumentasi utama: Indonesia.
> Status: rancangan implementasi, belum ada aplikasi atau validasi model nyata.
> Tanggal penyusunan: 31 Oktober 2026, Asia/Jakarta.

## 1. Ringkasan ide

DevPilot RDR adalah sistem pakar yang membantu junior developer memilih konfigurasi coding AI berdasarkan karakteristik task, akses layanan yang dimiliki, dan progres pengerjaan.

Pertanyaan utama yang dijawab:

1. Dengan task dan akses saya, gunakan layanan serta model apa?
2. Gunakan effort berapa dan apakah perlu investigasi atau perencanaan dahulu?
3. Jika task macet, apakah perlu mengganti konfigurasi, memperbaiki konteks, atau meminta bantuan mentor?

Output utama adalah satu paket rekomendasi: layanan, model spesifik, effort yang didukung, mode kerja, skill opsional, dan langkah berikutnya. Penjelasan singkat menunjukkan alasan pilihan serta kriteria keberhasilan.

Mesin pengambil keputusan wajib menggunakan Ripple Down Rules dengan satu kesimpulan terakhir, bukan jawaban chatbot atau tabel aturan datar.

## 2. Konteks tugas akademik yang wajib dipertahankan

Instruksi tugas dari pengguna:

> Menggunakan vibe coding, buat suatu sistem AI berbasis pada Ripple Down Rule (RDR) yang akan dipergunakan oleh seorang pakar dalam memberi rekomendasi bagi konsumennya.
>
> Berawal dengan KB yang hanya berisi satu rule awal (t → kesimpulan default). Kesimpulan default ini bisa diisi sesuai dengan domain dari masalah yang akan diselesaikan.
>
> Ketika ada konsumen datang maka sistem akan memberi kesimpulan dengan menelusuri tree binari yang ada. Anak kanan menggambarkan perkecualian dari node yang current (true-child), dieksekusi ketika kondisi terpenuhi; anak kiri merupakan false-child, dieksekusi ketika kondisi tidak terpenuhi.
>
> Kesimpulan yang diberikan oleh sistem adalah kesimpulan terakhir yang diperoleh, karena kesimpulan sebelumnya sudah dianulir oleh kesimpulan yang lebih baru.
>
> Jika pakar setuju dengan kesimpulan tersebut maka diberikan hasil tersebut dan proses selesai.
>
> Jika tidak sesuai maka dibuat rule baru, rule perkecualian bagi kesimpulan yang diberikan. Kesimpulan diberikan oleh pakar, sementara kondisinya dipilih dari kondisi yang dipenuhi kasus baru dan tidak dipenuhi kasus kunci dari kesimpulan terakhir yang akan dianulir.
>
> Atribut bisa berjenis numerik ataupun kategorikal.

Implikasi wajib:

- KB baru hanya memiliki satu root dengan kondisi TRUE.
- Node memiliki maksimal dua anak: kanan/true dan kiri/false.
- Node berkondisi salah tidak mengganti kesimpulan terakhir.
- Kesimpulan akhir berasal dari node terakhir yang kondisinya benar dalam jalur penelusuran.
- Pakar dapat menyetujui atau mengoreksi hasil.
- Setiap koreksi membutuhkan kondisi pembeda terhadap kasus kunci yang relevan.
- Kasus baru yang memicu aturan menjadi kasus kunci aturan tersebut.
- Pengetahuan tumbuh melalui koreksi pakar, bukan aturan yang diam-diam ditambahkan otomatis.

## 3. Keputusan produk yang sudah disepakati

- Domain dibatasi pada task developer, terutama kebutuhan junior developer.
- Pakar adalah senior developer atau mentor yang memahami penggunaan coding agent.
- Input mencakup akses layanan: Codex, Claude Code, atau keduanya.
- Istilah Claude Code dipakai ketika yang dimaksud coding agent, bukan sekadar keluarga model Claude.
- Output diutamakan pada model dan konfigurasi, terutama effort.
- Skill dapat menjadi rekomendasi tambahan jika relevan dan kompatibel.
- Penghematan token harus dipertimbangkan bersama keberhasilan task.
- Pemilihan model tidak boleh didasarkan hanya pada label junior/senior.
- Nama model, versi, harga, dan ketersediaannya tidak boleh dikarang atau dianggap selalu tetap.
- Implementasi harus memperlihatkan mekanisme RDR secara nyata.

Nama DevPilot RDR, susunan layar, stack, dan rincian atribut dalam dokumen ini merupakan usulan implementasi yang dapat disesuaikan. Perubahan tidak boleh menghilangkan ketentuan tugas atau keputusan produk di atas.

## 4. Tujuan dan batasan

### Tujuan

Membantu junior memilih konfigurasi AI yang dapat digunakan, memahami alasan pilihan, serta mengenali kapan pendekatan perlu dievaluasi ulang. Hasil task harus memiliki kriteria penerimaan yang dapat diperiksa.

### Scope MVP

- Tiga jenis task: bug fixing, fitur kecil, dan refactoring.
- Dua kondisi konsultasi: mulai task dan task macet.
- Akses Codex, Claude Code, atau keduanya.
- Satu paket konfigurasi utama per hasil konsultasi.
- Katalog model, effort, konfigurasi, dan skill yang dikurasi pakar.
- Input kasus terstruktur dengan deskripsi teks pendukung.
- Inferensi RDR, persetujuan pakar, koreksi, kasus kunci, dan riwayat.
- Visualisasi pohon serta jalur inferensi.
- Penyimpanan lokal yang persisten.
- Pencatatan hasil task secara manual.

### Di luar MVP

- Menjalankan Codex atau Claude Code secara otomatis.
- Membeli subscription, memasang skill, atau mengubah pengaturan akun.
- Mengunggah repositori dan menjalankan kode pengguna.
- Pencarian model/skill otomatis dari internet.
- Pengambilan kuota akun secara langsung.
- Orkestrasi banyak agent atau model per fase.
- Pemilihan model menggunakan LLM sebagai pengganti RDR.
- Klaim bahwa model tertentu selalu terbaik atau penghematan pasti sekian persen.

MVP tidak memerlukan API key LLM untuk melakukan konsultasi berbasis aturan.

## 5. Dua alur konsultasi

### A. Mulai task

Pengguna mengisi akses layanan dan karakteristik task. Sistem menelusuri pohon, menampilkan hasil sementara kepada pakar, lalu memfinalkan hasil setelah disetujui atau dikoreksi.

### B. Task macet

Pengguna mengisi kondisi task beserta konfigurasi yang sudah dicoba dan bukti kegagalannya. Sistem dapat merekomendasikan konfigurasi berbeda, investigasi lebih dahulu, pengumpulan konteks, atau konsultasi mentor.

Kedua alur menggunakan satu mesin inferensi. Atribut status_task membedakannya. Konsultasi ulang menjadi kasus baru yang tertaut pada task sebelumnya; hasil lama tidak ditimpa.

## 6. Pengguna dan tanggung jawab

### Junior developer / konsumen

- Membuat profil akses.
- Mengisi fakta task dan mengonfirmasi atribut yang belum diketahui.
- Menerima hasil yang sudah divalidasi pakar.
- Mengikuti langkah berikutnya di luar aplikasi.
- Melaporkan hasil, waktu, percobaan, dan penggunaan jika tersedia.

### Pakar

- Mengelola katalog konfigurasi yang dapat direkomendasikan.
- Menilai hasil inferensi.
- Menyetujui atau mengoreksi dengan kondisi pembeda yang valid.
- Memeriksa dampak aturan baru terhadap kasus tersimpan.
- Meninjau konfigurasi yang sudah tidak tersedia atau tidak relevan.

Pada MVP lokal, perpindahan peran dapat berupa pilihan tampilan untuk demonstrasi. Jika digunakan banyak pengguna melalui jaringan, tambahkan autentikasi dan pembatasan hak akses sebelum penggunaan tersebut.

## 7. Data input

### Profil akses

| Atribut              | Jenis             | Keterangan                                                           |
| -------------------- | ----------------- | -------------------------------------------------------------------- |
| layanan_tersedia     | Himpunan kategori | Codex, Claude Code, atau keduanya                                    |
| layanan_utama        | Kategorikal       | Wajib dipilih jika memiliki keduanya; dipakai untuk resolusi default |
| paket_akses          | Teks/kategori     | Nama paket sesuai pengakuan pengguna, boleh belum diketahui          |
| model_tersedia       | Himpunan ID       | Model yang dikonfirmasi tersedia                                     |
| prioritas_penggunaan | Kategorikal       | Hemat penggunaan, seimbang, kualitas hasil                           |

Nama layanan tidak membuktikan model tertentu tersedia. Simpan status akses sebagai dikonfirmasi atau belum diketahui. Jika fakta akses belum cukup untuk menghasilkan konfigurasi valid, minta kelengkapan informasi.

### Kasus task

| Atribut                | Jenis             | Nilai / pedoman                                                                           |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| status_task            | Kategorikal       | Mulai / macet                                                                             |
| jenis_task             | Kategorikal       | Bug fixing / fitur kecil / refactoring                                                    |
| deskripsi_task         | Teks              | Penjelasan pengguna; tidak dievaluasi langsung oleh aturan MVP                            |
| kriteria_penerimaan    | Teks              | Kondisi teramati yang menandakan selesai                                                  |
| kejelasan_kebutuhan    | Kategorikal       | Jelas / sebagian / belum jelas                                                            |
| cakupan_perubahan      | Kategorikal       | Satu fungsi / beberapa file / lintas modul / belum diketahui                              |
| pemahaman_kode         | Kategorikal       | Rendah / sedang / tinggi                                                                  |
| dampak_kesalahan       | Kategorikal       | Rendah / sedang / tinggi                                                                  |
| bukti_reproduksi       | Kategorikal       | Tersedia / belum tersedia / tidak relevan                                                 |
| pengujian_relevan      | Kategorikal       | Tersedia / belum tersedia / belum diketahui                                               |
| batas_waktu_menit      | Numerik           | Opsional, positif                                                                         |
| jumlah_percobaan_gagal | Numerik           | Bilangan bulat >= 0                                                                       |
| model_saat_ini         | Referensi         | Wajib jika macet dan diketahui                                                            |
| effort_saat_ini        | Kategorikal       | Nilai model saat ini, bawaan, atau belum diketahui                                        |
| gejala_kegagalan       | Himpunan kategori | Solusi berulang, tes gagal, scope melebar, penyebab belum ditemukan, hasil sulit dipahami |

Definisi operasional harus ditampilkan sebagai bantuan singkat. Contoh: dampak tinggi mencakup perubahan pada autentikasi, otorisasi, atau integritas data. Cakupan perubahan bukan sinonim dampak kesalahan.

Nilai belum diketahui berbeda dari rendah, nol, dan tidak. Aturan numerik tidak boleh memperlakukan nilai kosong sebagai nol. Gunakan operator khusus is_unknown jika pakar memang ingin membuat aturan atas ketidaktersediaan informasi.

Atribut teks bebas tidak boleh menjadi kondisi melalui pencocokan kata asal-asalan. Fitur ekstraksi atribut dengan LLM hanya pengembangan lanjutan dan hasilnya harus dikonfirmasi pengguna.

## 8. Kontrak output rekomendasi

Setiap node menghasilkan satu paket kesimpulan utuh. Jangan menggabungkan field dari beberapa node yang berbeda saat inferensi.

| Field              | Isi                                                |
| ------------------ | -------------------------------------------------- |
| layanan            | Layanan yang dipilih dari akses pengguna           |
| model              | ID dan nama model spesifik dari katalog            |
| effort             | Nilai asli yang didukung model, atau bawaan        |
| mode_kerja         | Eksekusi terarah / investigasi / perencanaan       |
| skill              | Nol atau beberapa skill terkurasi yang kompatibel  |
| langkah_berikutnya | Tindakan konkret yang dapat dilakukan junior       |
| konteks_diperlukan | File, log, langkah reproduksi, atau kebutuhan lain |
| alasan             | Alasan pakar dan fakta pemicu dari jalur inferensi |
| evaluasi_ulang     | Kondisi yang memicu konsultasi kembali             |
| kriteria_selesai   | Bukti penyelesaian sesuai task                     |

Kartu utama memprioritaskan layanan, model, effort, mode, skill, dan langkah berikutnya. Detail lainnya dapat dibuka pengguna.

Effort tidak boleh diasumsikan sama antarplatform. Kategori internal seperti ringan/sedang/mendalam boleh membantu pakar, tetapi output wajib memakai nilai yang benar-benar didukung konfigurasi. Bawaan berarti tidak ada override effort, bukan sinonim medium.

Rekomendasi tidak perlu selalu menaikkan model atau effort. Jika bukti kurang, langkah berikutnya dapat berupa pengumpulan reproduksi atau klarifikasi sebelum perubahan kode berikutnya.

MVP menghasilkan satu konfigurasi utama. Alternatif, ranking, dan model berbeda per fase ditunda.

## 9. Katalog model, skill, dan profil konfigurasi

Pisahkan katalog dari struktur aturan. Katalog berisi:

- Layanan dan ID model, nama tampilan serta versi.
- Pilihan effort asli dan konfigurasi yang didukung.
- Syarat akses, bila diketahui, dan status verifikasi.
- Profil konfigurasi yang boleh dipilih pakar.
- Skill, deskripsi kegunaan, lingkungan kompatibel, sumber, dan status ketersediaan.
- Sumber informasi, tanggal verifikasi, status aktif/nonaktif.
- Harga atau perkiraan biaya hanya jika sumber, satuan, dan tanggalnya jelas.

Aturan merujuk konfigurasi yang telah ditetapkan pakar. Pemecahan ID menjadi nama dan label effort adalah lookup deterministik, bukan keputusan LLM tambahan.

Data demonstrasi boleh memakai nama sintetis yang jelas diberi label DEMO. Jangan menampilkan model sintetis seolah produk nyata. Katalog nyata harus diverifikasi dari dokumentasi resmi sebelum digunakan.

Jika model nonaktif atau akses tidak cocok, hasil inferensi mentah tetap dicatat, tetapi tidak boleh difinalkan sebagai konfigurasi yang dapat dijalankan. Tampilkan kebutuhan peninjauan pakar. Jangan diam-diam mengganti model dan menyembunyikan penyimpangan dari hasil RDR.

Perubahan katalog harus memiliki versi; hasil konsultasi lama menyimpan snapshot konfigurasi agar tetap dapat dijelaskan.

## 10. Root dan bootstrap kasus kunci

Root awal:

```text
Kondisi: TRUE
Kesimpulan: Gunakan konfigurasi bawaan terverifikasi pada layanan utama
            yang tersedia, lakukan pekerjaan terarah, lalu verifikasi hasil.
```

Root adalah profil default khusus. Model dan effort nyatanya diambil dari pemetaan default yang ditetapkan pakar untuk layanan utama dan akses pengguna. Pemetaan ini hanya lookup eksplisit dan harus ditampilkan pada jejak hasil; tidak melakukan ranking tersembunyi.

Jika pemetaan belum ada atau akses belum terkonfirmasi, minta konfigurasi awal/klarifikasi. Jangan mengarang nama model. Setelah terselesaikan, kartu rekomendasi tetap menampilkan model spesifik.

KB baru tetap hanya satu node. Pengaturan katalog atau profil default bukan penambahan rule.

Root membutuhkan kasus acuan untuk koreksi berikutnya. Gunakan alur bootstrap eksplisit: pakar meninjau satu kasus awal yang cocok dengan kesimpulan default, menyetujuinya, lalu menyimpan kasus itu sebagai cornerstone root. Ini tidak menambah rule. Jangan membuat kasus kosong atau semua atribut bernilai nol sebagai acuan palsu.

Sebelum cornerstone root tersedia, koreksi yang memerlukan perbandingan kasus kunci belum dapat difinalkan. UI menjelaskan bahwa bootstrap kasus acuan harus diselesaikan dahulu.

## 11. Struktur node dan kondisi

Setiap RuleNode minimal menyimpan:

- id, kondisi, conclusion_profile_id atau paket kesimpulan berversi.
- true_child_id: anak kanan, boleh kosong.
- false_child_id: anak kiri, boleh kosong.
- cornerstone_case_id.
- alasan pakar, pembuat, waktu, dan versi KB.

Kondisi berupa AST/data terstruktur, bukan kode yang dieksekusi dengan eval.

Operator MVP:

- Kategorikal: equals, not_equals, in, contains untuk himpunan.
- Numerik: >, >=, <, <=, equals.
- Ketidaktersediaan: is_unknown.
- Gabungan: AND dari satu atau beberapa predikat.
- Root: always_true.

Satu kondisi gabungan baru harus benar pada kasus baru dan salah pada cornerstone kesimpulan yang dikoreksi. Jangan hanya memeriksa bahwa nilai atributnya berbeda.

## 12. Algoritma inferensi

```text
node = root
lastMatchedNode = null
lastConclusion = null
trace = []
terminalNode = null
terminalBranch = null

while node != null:
    matched = evaluate(node.condition, case)
    trace.append(node, matched)
    terminalNode = node

    if matched:
        lastMatchedNode = node
        lastConclusion = node.conclusion
        terminalBranch = TRUE
        node = node.trueChild
    else:
        terminalBranch = FALSE
        node = node.falseChild

return lastConclusion, lastMatchedNode,
       terminalNode, terminalBranch, trace
```

Aturan penting:

- Ikuti satu jalur, bukan menelusuri semua node.
- Root TRUE memastikan selalu ada kesimpulan dasar.
- Node yang salah tidak menganulir kesimpulan terakhir.
- Cabang kosong menghentikan penelusuran.
- Simpan node terakhir yang benar dan node terminal; keduanya dapat berbeda.
- Snapshot input, versi KB, versi katalog, dan trace disimpan bersama konsultasi.

## 13. Penambahan aturan setelah koreksi

1. Gunakan hasil inferensi pada versi KB yang masih berlaku.
2. Ambil lastMatchedNode sebagai sumber kesimpulan yang dikoreksi.
3. Ambil cornerstone milik lastMatchedNode.
4. Tampilkan perbandingan kasus baru dan cornerstone.
5. Tawarkan kandidat kondisi, lalu pakar memilih atau menyusunnya.
6. Validasi kondisi baru benar untuk kasus baru dan salah untuk cornerstone tersebut.
7. Pakar memilih paket konfigurasi pengganti yang kompatibel dengan akses kasus baru.
8. Buat node dengan cornerstone = kasus baru.
9. Pasang node pada cabang kosong tempat penelusuran berhenti: true-child terminal jika kondisi terminal benar, false-child terminal jika kondisi terminal salah.
10. Jalankan kembali inferensi kasus baru dan pemeriksaan regresi.
11. Simpan aturan, versi KB, koreksi, dan hasil final dalam satu transaksi jika valid.

Peringatan implementasi: jangan selalu memasang aturan pada true-child lastMatchedNode. Cabang itu mungkin sudah terisi. Posisi pemasangan harus mengikuti ujung jalur penelusuran agar node lama tidak ditimpa dan kasus baru benar-benar mencapai aturan baru.

Contoh: root → kanan A; A salah dan false-child kosong. Kesimpulan terakhir masih root. Aturan baru dipasang sebagai false-child A, tetapi kondisi pembeda dibandingkan dengan cornerstone root.

Jika tidak ada kondisi pembeda yang sah, blok penyimpanan dan minta atribut relevan atau data kasus diperbaiki. Jangan menggunakan ID kasus, waktu acak, atau deskripsi unik sebagai cara membedakan secara artifisial.

## 14. Pemeriksaan regresi dan perubahan pengetahuan

Sebelum menyimpan koreksi:

- Kasus baru harus menghasilkan kesimpulan baru yang dimaksud.
- Cornerstone yang dikoreksi harus tetap menghasilkan kesimpulan lamanya.
- Seluruh cornerstone lain harus diperiksa ulang.
- Kasus lama yang sudah disetujui pakar diperiksa ulang dan perubahan hasil ditampilkan.

Kebijakan MVP: blok perubahan yang mengubah kesimpulan kasus lama yang disetujui tanpa proses revisi pengetahuan terpisah. Minta kondisi diperjelas. Ini pilihan konservatif proyek, bukan klaim bahwa semua varian RDR menjamin nol perubahan pada semua kasus historis.

Pengubahan kesimpulan lama secara sengaja adalah fitur revisi pengetahuan lanjutan; jangan menyamarkannya sebagai penambahan pengecualian biasa.

MVP tidak menyediakan edit/hapus node sembarangan. Koreksi normal menambah node. Jangan menimpa kasus kunci atau hasil konsultasi historis.

Jika KB berubah ketika pakar sedang menilai kasus, jalankan inferensi ulang dan minta pakar memeriksa hasil terbaru sebelum koreksi disimpan.

## 15. Status konsultasi

```text
DRAFT → PENDING_EXPERT → APPROVED
                       → CORRECTION_DRAFT → CORRECTED_APPROVED
                       → NEEDS_INFORMATION
```

Hasil sebelum penilaian ditandai rekomendasi sementara. Hasil final diberikan setelah persetujuan pakar sesuai instruksi tugas. Pada demo, peran dapat berganti tanpa menghilangkan tahapan persetujuan.

Konsultasi yang perlu informasi dapat dilengkapi lalu dinilai ulang. Simpan riwayat transisi.

## 16. Layar MVP

1. Beranda: penjelasan singkat, Mulai Task dan Task Macet.
2. Profil akses: layanan, layanan utama, paket, dan model tersedia.
3. Form konsultasi bertahap dengan bantuan istilah.
4. Hasil: kartu konfigurasi, status penilaian, alasan, dan langkah berikutnya.
5. Antrean pakar: kasus yang menunggu penilaian.
6. Koreksi pakar: kasus baru vs cornerstone, builder kondisi, konfigurasi baru, hasil regresi.
7. Pohon RDR: label kanan TRUE dan kiri FALSE, sorotan jalur, status cocok/tidak, dan node pemberi kesimpulan.
8. Riwayat task: konsultasi berulang dan hasil penggunaan.
9. Katalog: model, effort, skill, default, dan status verifikasi.

Gunakan antarmuka ringkas dan mudah dibaca. Jangan tampilkan JSON, ID internal, atau detail mesin pada alur konsumen utama. Detail teknis tersedia pada panel pakar/penjelasan.

## 17. Struktur data konseptual

- AccessProfile: layanan, layanan utama, paket, model tersedia, status konfirmasi.
- Task: tujuan, kriteria penerimaan, pemilik.
- CaseSnapshot: atribut immutable untuk satu konsultasi.
- Consultation: status, kasus, versi KB/katalog, hasil mentah, hasil terurai, trace, penilaian.
- RuleNode: kondisi, kesimpulan, child, cornerstone, metadata.
- RecommendationProfile: paket konfigurasi berversi dan instruksi pendukung.
- ModelCatalog / SkillCatalog: kemampuan, kompatibilitas, sumber, verifikasi.
- ExpertReview: keputusan, alasan, aturan yang ditambahkan.
- TaskOutcome: berhasil/belum, bukti, percobaan, durasi, penggunaan opsional.
- KnowledgeBaseVersion / AuditEvent: riwayat perubahan.

Gunakan referensi yang jelas dan transaksi untuk perubahan terkait. Cegah cycle, child ganda dengan parent tak sah, root ganda, serta referensi cornerstone yang hilang.

## 18. Arsitektur teknis yang diusulkan

Usulan default bila proyek masih kosong:

- Frontend: React + TypeScript + Vite.
- Backend: Node.js + TypeScript + Fastify.
- Penyimpanan: SQLite.
- Validasi: skema input terstruktur, misalnya Zod.
- Visualisasi pohon: React Flow atau alternatif yang mempertahankan orientasi kiri/kanan.
- Pengujian inti: Vitest.

Stack adalah usulan, bukan syarat akademik. Periksa lingkungan dan instruksi proyek sebelum memasang dependensi. Jika sudah ada stack, pertahankan kecuali ada alasan kuat.

Pisahkan modul mesin RDR dari UI dan database agar inferensi dapat diuji dengan data kecil. Evaluator kondisi harus deterministik. Backend menyimpan keputusan pakar dan tidak mempercayai kondisi yang hanya divalidasi frontend.

## 19. Rencana implementasi bertahap

### Tahap 1 — Fondasi domain dan katalog

- Tetapkan skema atribut dan tipe unknown.
- Siapkan katalog DEMO yang diberi label jelas.
- Siapkan default dan bootstrap cornerstone root.
- KB baru berisi tepat satu rule.

Selesai jika: aplikasi dapat menyimpan profil akses, satu kasus awal, dan satu root tanpa aturan tersembunyi.

### Tahap 2 — Mesin RDR

- Evaluator kondisi, inferensi, trace, dan posisi terminal.
- Penambahan aturan, perbandingan cornerstone, pemeriksaan regresi.
- Persistensi, versi, dan transaksi koreksi.

Selesai jika: true-child, false-child, dan pembaruan kesimpulan terakhir terbukti benar melalui pengujian inti.

### Tahap 3 — Konsultasi dan penilaian pakar

- Alur mulai task dan task macet.
- Kartu hasil, status sementara/final.
- Persetujuan dan builder koreksi pakar.

Selesai jika: satu kasus dapat dikonsultasikan, ditolak, dikoreksi, lalu diberi rekomendasi final yang tersimpan.

### Tahap 4 — Penjelasan dan visualisasi

- Pohon biner dengan jalur inferensi.
- Kasus baru vs cornerstone.
- Riwayat dan audit perubahan.

Selesai jika: penonton dapat menjelaskan mengapa suatu konfigurasi dipilih dan dari kasus mana aturan berasal.

### Tahap 5 — Skenario demonstrasi dan evaluasi

- Skenario yang membangun aturan melalui alur pakar.
- Form hasil task dan penggunaan opsional.
- README menjalankan proyek serta penjelasan algoritma.

Selesai jika: demo end-to-end dapat diulang dari KB satu rule hingga pohon berisi beberapa pengecualian.

## 20. Pengujian inti yang wajib

- Root saja mengembalikan default.
- Kondisi benar mengikuti kanan dan memperbarui kesimpulan.
- Kondisi salah mengikuti kiri tanpa memperbarui kesimpulan.
- True lalu false tanpa kecocokan baru tetap mengembalikan kesimpulan sebelumnya.
- False-child dapat cocok dan menghasilkan kesimpulan baru.
- Nilai numerik pada batas threshold dievaluasi benar.
- Unknown tidak diperlakukan sebagai nol atau kategori rendah.
- Kondisi baru ditolak jika tidak benar pada kasus baru.
- Kondisi baru ditolak jika juga benar pada cornerstone yang harus dilindungi.
- Node baru dipasang pada cabang terminal yang kosong, tanpa menimpa subtree.
- Regresi terhadap cornerstone dan kasus disetujui terdeteksi.
- Hasil yang memakai model tidak tersedia atau effort tidak didukung tidak dapat difinalkan.
- Versi KB yang berubah mencegah penyimpanan koreksi berbasis trace lama.
- Data dan jejak keputusan tetap tersedia setelah aplikasi dimulai ulang.

Utamakan pengujian perilaku mesin dan integritas data; hindari pengujian yang hanya menyalin detail implementasi.

## 21. Skenario demo yang disarankan

Skenario berikut adalah bahan membangun aturan melalui koreksi pakar, bukan seed rule otomatis:

1. Perubahan kecil, kebutuhan jelas, dampak rendah: pakar menyetujui default dan menetapkan acuan root.
2. Bug lintas modul, penyebab belum diketahui: pakar mengoreksi ke profil investigasi.
3. Bug serupa, beberapa percobaan gagal, bukti reproduksi belum ada: pakar mengutamakan pengumpulan bukti.
4. Fitur dengan kebutuhan belum jelas: pakar mengoreksi ke profil perencanaan/klarifikasi.
5. Task dengan akses hanya satu layanan: rekomendasi tetap harus kompatibel dengan akses itu.
6. Kasus baru yang memenuhi aturan hasil koreksi: sistem memberi hasil yang benar tanpa menambah aturan lagi.

Nilai threshold seperti jumlah percobaan harus diputuskan pakar dan dicatat alasannya. Jangan menyatakan tiga kali gagal sebagai hukum universal.

Sediakan mode reset demo secara eksplisit dengan konfirmasi. Jangan menghapus KB kerja pengguna saat seed atau startup.

## 22. Evaluasi manfaat

Evaluasi teknis dan evaluasi manfaat adalah dua hal berbeda.

Evaluasi teknis: algoritma, posisi child, kesimpulan terakhir, validitas pembeda, regresi, dan persistensi.

Evaluasi manfaat: tingkat keberhasilan task, waktu, jumlah percobaan, kualitas hasil yang diverifikasi, serta pemahaman junior terhadap perubahan kode.

Token, biaya API, dan kuota subscription dicatat terpisah. Jika tidak ada data, simpan unknown, bukan nol. Jangan mengonversi semua kuota subscription menjadi token atau rupiah menggunakan asumsi tanpa sumber.

Bila membandingkan strategi, gunakan task dan kriteria penerimaan yang sebanding serta jelaskan keterbatasan sampel. Jangan mengklaim penghematan sebelum diuji.

## 23. Pencarian dan skill sebagai pengembangan

Pencarian web boleh menjadi pendukung katalog atau langkah yang direkomendasikan kepada pengguna. Pencarian bukan mekanisme inferensi RDR.

Fitur find skill nantinya dapat mencari kandidat, tetapi pakar tetap memverifikasi kegunaan, kompatibilitas, dan ketersediaannya. Merekomendasikan skill tidak sama dengan menginstal atau menjalankannya.

Jangan mencampur model, lingkungan coding agent, skill, dan tool pencarian sebagai entitas yang sama.

## 24. Hal yang masih perlu diputuskan saat implementasi

- Daftar model nyata dan effort yang akan diverifikasi.
- Paket akses yang relevan untuk pengguna sasaran.
- Pakar yang memberi penilaian konfigurasi dan skenario awal.
- Pemetaan default terverifikasi per layanan/akses.
- Nama produk final dan detail visual.
- Apakah penggunaan tetap lokal atau akan dipublikasikan.

Hal ini tidak menghalangi pembuatan mesin RDR, UI, serta demo dengan katalog sintetis berlabel. Jangan mengisi keputusan yang belum ada dengan klaim produk nyata.

## 25. Kriteria penerimaan produk

- [ ] Pengguna dapat memasukkan Codex, Claude Code, atau keduanya.
- [ ] Output memprioritaskan model spesifik dan effort yang valid.
- [ ] KB baru tepat satu root TRUE.
- [ ] Root memiliki bootstrap kasus kunci yang dapat dijelaskan.
- [ ] Pohon memakai kanan TRUE dan kiri FALSE.
- [ ] Kesimpulan terakhir yang cocok adalah hasil akhir.
- [ ] Konsumen mendapat hasil final setelah penilaian pakar.
- [ ] Koreksi memerlukan kondisi pembeda yang valid.
- [ ] Kasus baru menjadi cornerstone node baru.
- [ ] Penambahan aturan tidak menimpa subtree lama.
- [ ] Trace, versi, dan alasan keputusan dapat dilihat.
- [ ] Konfigurasi tidak melampaui akses yang dikonfirmasi.
- [ ] Mode mulai task dan task macet tersedia.
- [ ] Data persisten dan hasil historis tidak berubah diam-diam.
- [ ] Tidak ada ketergantungan LLM untuk keputusan inti.
- [ ] Demo dan model nyata dapat dibedakan jelas.
- [ ] Tidak ada klaim penghematan atau keberhasilan yang belum diukur.

## 26. Prompt pembuka untuk melanjutkan vibe coding

Salin instruksi berikut ke sesi implementasi dengan dokumen ini tersedia:

```text
Baca dokumen DEV_PILOT_RDR_CONTEXT.md sampai selesai dan periksa
instruksi AGENTS.md serta isi proyek yang ada.

Bangun DevPilot RDR sesuai keputusan produk dan ketentuan tugas dalam
dokumen tersebut. Mulai dari fondasi domain, katalog demonstrasi yang
jelas berlabel, serta mesin RDR yang dapat diuji, kemudian lanjutkan UI
dan alur pakar. Pertahankan stack yang sudah ada jika sesuai.

Prioritaskan kebenaran inferensi, kasus kunci, posisi penambahan node,
validasi kondisi pembeda, dan kompatibilitas akses/model/effort.
Jangan mengganti pengambil keputusan dengan LLM atau aturan datar.
Jangan memasukkan banyak rule ke KB baru secara otomatis.

Model nyata dan effort harus diverifikasi dari dokumentasi resmi sebelum
ditampilkan sebagai rekomendasi nyata. Jika belum diverifikasi, gunakan
katalog DEMO yang dinyatakan eksplisit. Jangan memerlukan API key untuk
menjalankan inti aplikasi.

Kerjakan sampai alur konsultasi, penilaian/koreksi pakar, pohon,
persistensi, dan demo dapat dijalankan. Jalankan pengujian yang relevan.
Catat keputusan teknis baru dan keterbatasan pada dokumentasi proyek.
```

## 27. Referensi konseptual dari diskusi

Referensi ini membantu implementasi katalog dan workflow, bukan bukti bahwa kombinasi model tertentu paling baik untuk semua task. Verifikasi ulang informasi yang berubah sebelum digunakan.

- Konfigurasi model dan effort Claude Code: https://code.claude.com/docs/en/model-config
- Dokumentasi model OpenAI: https://learn.chatgpt.com/docs/models
- Konsep skill OpenAI: https://developers.openai.com/plugins/concepts/skills
- Workflow task panjang Codex: https://developers.openai.com/blog/run-long-horizon-tasks-with-codex

Dokumen ini adalah spesifikasi rancangan; belum ada implementasi, hasil benchmark, atau jaminan penghematan token.
