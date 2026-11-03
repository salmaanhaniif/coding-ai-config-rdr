# Kontrak API — Fondasi Person A

Base URL development: http://127.0.0.1:3001/api. Frontend memakai path relatif /api melalui proxy Vite.

Body mutasi menggunakan Content-Type: application/json. Tipe lengkap dan sumber kebenaran enum berada di [shared/domain.ts](../shared/domain.ts). Zod memvalidasi body di backend; key tidak dikenal ditolak. Aplikasi lokal tidak memiliki autentikasi peran; ini bukan API publik.

## Operasi

| Method | Path                                  | Body / hasil                                                          |
| ------ | ------------------------------------- | --------------------------------------------------------------------- |
| GET    | /health                               | Status lokal                                                          |
| GET    | /overview                             | KB/katalog, node, akses, task, konsultasi, bootstrapNeeded            |
| GET    | /tree                                 | version dan nodes; kiri falseChild, kanan trueChild                   |
| GET    | /catalog                              | Katalog versi aktif                                                   |
| PUT    | /catalog                              | Seluruh katalog dengan version lama; hasil version bertambah satu     |
| POST   | /accesses                             | AccessInput; hasil AccessProfile, HTTP 201                            |
| POST   | /consultations                        | CaseInput; hasil ConsultationDetail, HTTP 201                         |
| GET    | /consultations/:id                    | Detail, kasus, matchedRule, cornerstone, kandidat, reviews            |
| POST   | /consultations/:id/refresh            | Tanpa body; inferensi ulang untuk kasus terbuka                       |
| POST   | /consultations/:id/approve            | ReviewInput; persetujuan dan bootstrap jika root belum punya acuan    |
| POST   | /consultations/:id/information        | ReviewInput; status NEEDS_INFORMATION                                 |
| GET    | /consultations/:id/draft              | Objek draft atau null                                                 |
| PUT    | /consultations/:id/draft              | CorrectionInput; menyimpan draft, tidak menambah node                 |
| POST   | /consultations/:id/correction/preview | CorrectionInput; memeriksa pembeda, konfigurasi, regresi tanpa mutasi |
| POST   | /consultations/:id/correction         | CorrectionInput; atomik menambah rule dan memfinalkan hasil           |
| GET    | /tasks/:id                            | Task, konsultasi terkait, dan outcomes                                |
| POST   | /tasks/:id/outcomes                   | OutcomeInput; laporan baru, HTTP 201                                  |

Tidak ada endpoint mengedit/hapus node, menimpa kasus final, atau reset KB. Operasi UI katalog B dapat melakukan read-modify-write melalui PUT /catalog, dengan optimistic version check.

## Profil akses

```json
{
  "name": "Akses latihan",
  "services": ["codex", "claude-code"],
  "primaryService": "codex",
  "packageName": "Paket pengguna, akses model dikonfirmasi sendiri",
  "modelIds": ["gpt-6.1-sol", "gpt-6-astra", "claude-sonnet-5-5"],
  "confirmed": true,
  "priority": "balanced"
}
```

Layanan utama harus termasuk services. Semua modelIds harus terdapat pada katalog dan sesuai layanan yang dipilih. confirmed=true membutuhkan setidaknya satu model. confirmed=false boleh digunakan untuk menyimpan ketidakpastian, tetapi hasilnya tidak dapat disetujui sebagai konfigurasi runnable.

Layanan mendukung `codex`, `claude-code`, dan `chatgpt` (ChatGPT Work), maksimal tiga pilihan. Task juga mendukung `review`, `tests`, `docs`, `architecture`, dan `security`. Model nyata memiliki `runtimeId` dan `thinkingModes`; profil menyimpan `thinking` serta effort eksplisit. Operator set `not_contains` memeriksa ketiadaan anggota; nilai unknown tetap tidak cocok. Profil akses internal kasus acuan tidak disajikan pada `overview.accesses`.

Profil dan kasus disimpan sebagai snapshot. Untuk akses yang berubah, buat profil baru dan konsultasi ulang; jangan mengubah snapshot konsultasi lama.

## Kasus konsultasi

Ganti accessId dengan ID dari POST /accesses. taskId opsional menautkan konsultasi baru ke task lama.

```json
{
  "accessId": "ID-PROFIL",
  "description": "Perbaiki kegagalan login",
  "acceptance": "Reproduksi tidak gagal lagi dan tes login lulus",
  "attributes": {
    "taskStatus": "stuck",
    "taskType": "bug",
    "clarity": "clear",
    "scope": "modules",
    "familiarity": "low",
    "impact": "high",
    "reproduction": "available",
    "tests": "available",
    "failures": 3,
    "timeLimit": null,
    "symptoms": ["repeated", "no-cause"],
    "currentModelId": "gpt-6.1-sol",
    "currentEffort": "medium"
  }
}
```

Nilai null berarti belum diketahui. Angka kosong tidak boleh dikirim sebagai 0. Gejala memakai array; [] berarti tidak ada gejala yang dipilih. Deskripsi dan kriteria penerimaan tidak menjadi kondisi aturan.

Facts yang dipakai RDR menggabungkan atribut kasus dengan priority, primaryService, accessConfirmed, services dari snapshot akses. currentModelId/currentEffort disimpan sebagai konteks dan divalidasi, tetapi bukan field kondisi pada MVP; tambah metadata/schema secara eksplisit jika domain diperluas.

## Persetujuan / permintaan informasi

```json
{
  "kbVersion": 2,
  "catalogVersion": 1,
  "reason": "Rekomendasi sesuai dengan kebutuhan kasus."
}
```

Versi harus sama dengan versi konsultasi dan versi aktif. Bootstrap persetujuan root menaikkan versi KB meskipun jumlah node tidak bertambah, karena metadata cornerstone berubah.

## Koreksi

```json
{
  "kbVersion": 2,
  "catalogVersion": 1,
  "reason": "Perlu investigasi untuk percobaan gagal berulang.",
  "profileId": "codex-investigate",
  "condition": {
    "type": "and",
    "terms": [
      { "field": "failures", "op": "gte", "value": 3 },
      { "field": "taskStatus", "op": "equals", "value": "stuck" }
    ]
  }
}
```

Operator: equals, not_equals, in, contains, gt, gte, lt, lte, is_unknown. Operator harus sesuai tipe atribut. is_unknown tidak menerima value; in menerima array kategori. Gabungan AND harus berisi 1–12 predikat.

Preview sukses:

```json
{
  "valid": true,
  "protectedCount": 1,
  "attachment": { "nodeId": "root", "branch": "true" },
  "resolved": { "profile": {}, "model": {}, "skills": [], "catalogVersion": 1 }
}
```

Objek resolved pada contoh di atas dipendekkan; response sebenarnya berisi snapshot lengkap, bukan objek kosong. Preview tidak menyimpan node. Commit selalu mengulangi validasi di dalam transaksi, sehingga preview bukan izin melewati pemeriksaan.

Draft boleh belum lolos pembeda/regresi, tetapi wajib lolos bentuk/schema dan version check. Draft tidak dipakai inferensi. Refresh menghapus draft lama agar tidak dikira sesuai versi baru.

## Bentuk ConsultationDetail

- consultation: status, kbVersion, catalogVersion, inference, resolved, issues, dan timestamp.
- case: snapshot atribut dan akses, facts, taskId, deskripsi, kriteria penerimaan.
- matchedRule: node pemberi kesimpulan dari versi KB yang menghasilkan hasil tersebut.
- cornerstone: kasus acuan node itu, atau null sebelum bootstrap.
- candidates: kandidat predikat yang benar pada kasus baru dan salah pada cornerstone.
- reviews: riwayat persetujuan, draft, koreksi, permintaan informasi, dan refresh.

Inference memuat conclusion mentah, lastMatchedNode, terminalNode, terminalBranch, dan trace. Jangan menyamakan terminalNode dengan lastMatchedNode.

resolved bisa null ketika default belum dapat dipetakan. issues menunjukkan konfigurasi tidak tersedia/kompatibel. Tidak ada substitusi model otomatis di luar hasil RDR.

Status tersimpan: PENDING_EXPERT, CORRECTION_DRAFT, NEEDS_INFORMATION, APPROVED, CORRECTED_APPROVED. DRAFT sebelum pengiriman adalah state formulir lokal. Hanya dua status terakhir adalah hasil final.

Untuk kasus NEEDS_INFORMATION: pakar dapat refresh jika KB/katalog berubah, atau pengguna membuat snapshot konsultasi baru pada task yang sama jika informasi kasus/akses berubah. Hasil lama tetap tersimpan.

## Pengelolaan katalog

GET /catalog memberikan objek lengkap: version, models, skills, profiles, defaults. PUT seluruh objek setelah edit. Jangan menaikkan version di klien; server memeriksa versi lama lalu menambahkannya.

- Model memiliki id, name, service, efforts, active, demo, source, verifiedAt.
- Skill memiliki id, name, services, active, description, demo, source, verifiedAt.
- Profil memiliki id, name, modelId, effort, mode, skillIds, nextStep, context, reason, reconsider, active.
- defaults memetakan codex/claude-code ke ID profil atau null.
- ID unik dalam setiap kelompok. Referensi model/skill/default harus valid.
- Model/skill nyata memerlukan URL sumber dan tanggal verifikasi; penilaian kebenaran sumber tetap tugas pakar.
- Node pengecualian menyimpan snapshot paket yang dipilih pakar. Mengedit katalog tidak menulis ulang node atau hasil final.
- Penonaktifan model/profil atau penghapusan dukungan effort dapat memblok finalisasi hasil baru; pakar harus meninjaunya.

## Outcome

```json
{
  "success": "unknown",
  "evidence": "Belum diuji pada proyek nyata",
  "durationMinutes": null,
  "attempts": 0,
  "tokens": null,
  "apiCost": null,
  "currency": null,
  "subscriptionUsage": null
}
```

success: yes/no/unknown. Angka nonnegatif, attempts/tokens bilangan bulat. Biaya yang diketahui memerlukan currency IDR atau USD. subscriptionUsage adalah catatan terpisah, tidak dikonversi menjadi token. Setiap POST menambah laporan, bukan menimpa laporan sebelumnya.

## Error

```json
{
  "error": {
    "code": "STALE_VERSION",
    "message": "KB atau katalog berubah. Muat ulang inferensi dan tinjau kembali.",
    "details": null
  }
}
```

| HTTP | Kode umum                                                     | Tindakan UI                                                    |
| ---- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| 400  | VALIDATION, NOT_MATCHING, NOT_DISTINGUISHING, CATALOG_INVALID | Tampilkan pesan dan perbaiki input                             |
| 404  | NOT_FOUND                                                     | Periksa ID/data yang dipilih                                   |
| 409  | STALE_VERSION                                                 | Refresh inferensi atau ambil katalog terbaru; tinjau kembali   |
| 409  | BOOTSTRAP_REQUIRED                                            | Setujui kasus acuan root dahulu                                |
| 409  | REGRESSION                                                    | Perjelas kondisi; details.caseIds menunjukkan kasus terdampak  |
| 409  | ALREADY_FINAL                                                 | Buat konsultasi baru untuk melanjutkan task                    |
| 422  | CONFIG_UNAVAILABLE                                            | Lengkapi akses atau minta pakar memilih konfigurasi yang valid |
| 403  | ORIGIN                                                        | Mutasi dari origin nonlokal tidak diterima                     |
| 500  | INTERNAL                                                      | Tinjau log server; respons tidak membocorkan detail database   |

Error validasi details berisi array issue Zod. Tidak semua endpoint menghasilkan semua kode; lihat service.ts untuk guard yang diterapkan.
