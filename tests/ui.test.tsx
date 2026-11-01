// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../server/app';
import { Store } from '../server/store';
import { Advisor } from '../server/service';
import App from '../src/App';
let store: Store;
let server: FastifyInstance;
beforeEach(async () => {
  store = new Store(':memory:');
  server = await createApp(store, { staticRoot: 'missing-dist' });
  vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
    const r = await server.inject({
      url: String(url),
      method: (options.method ?? 'GET') as 'GET' | 'POST' | 'PUT',
      headers: options.headers as Record<string, string>,
      payload: options.body as string | undefined,
    });
    return {
      ok: r.statusCode >= 200 && r.statusCode < 300,
      status: r.statusCode,
      json: async () => r.json(),
    };
  });
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await server.close();
  store.close();
});
it('UI terhubung ke backend nyata: profil → konsultasi → bootstrap → koreksi', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Nama profil');
  await user.click(screen.getByLabelText('DEMO Codex Basic'));
  await user.click(screen.getByLabelText('DEMO Codex Deep'));
  await user.click(screen.getByRole('button', { name: 'Simpan profil akses' }));
  await screen.findByText('Profil akses tersimpan. Lanjutkan isi task.');
  expect(screen.getByRole('button', { name: /Ubah akses/ })).toBeTruthy();
  await user.type(screen.getByLabelText('Deskripsi task'), 'Perbaiki validasi login');
  await user.type(screen.getByLabelText('Kriteria selesai'), 'Tes login lulus');
  await user.click(screen.getByRole('button', { name: 'Dapatkan rekomendasi →' }));
  await screen.findByText('Sementara · perlu penilaian');
  await user.click(screen.getByRole('button', { name: 'Lanjut ke penilaian pakar' }));
  await user.type(screen.getByLabelText('Alasan penilaian'), 'Default sesuai untuk kasus acuan.');
  await user.click(screen.getByRole('button', { name: 'Setuju & jadikan acuan root' }));
  await screen.findByText('Disetujui pakar');
  expect(store.rules()).toHaveLength(1);
  expect(store.rules()[0].cornerstoneId).not.toBeNull();
  await user.click(screen.getByRole('button', { name: 'Konsultasi' }));
  await user.clear(screen.getByLabelText('Jumlah percobaan gagal'));
  await user.type(screen.getByLabelText('Jumlah percobaan gagal'), '3');
  await user.selectOptions(screen.getByLabelText('Status task'), 'stuck');
  await user.click(screen.getByLabelText('Solusi berulang'));
  await user.click(screen.getByRole('button', { name: 'Dapatkan rekomendasi →' }));
  await screen.findByText('Sementara · perlu penilaian');
  await user.click(screen.getByRole('button', { name: 'Lanjut ke penilaian pakar' }));
  await user.type(
    screen.getByLabelText('Alasan penilaian'),
    'Perlu investigasi karena percobaan gagal berulang.',
  );
  await user.click(screen.getByRole('button', { name: '+ Percobaan gagal gte 3' }));
  await user.selectOptions(
    screen.getByLabelText('Paket konfigurasi pengganti'),
    'demo-codex-deep-profile',
  );
  await user.clear(screen.getByLabelText('Nilai kondisi'));
  await user.type(screen.getByLabelText('Nilai kondisi'), '0');
  await user.click(screen.getByRole('button', { name: 'Periksa koreksi' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Kondisi juga benar pada kasus kunci.',
  );
  await user.clear(screen.getByLabelText('Nilai kondisi'));
  await user.type(screen.getByLabelText('Nilai kondisi'), '3');
  await user.click(screen.getByRole('button', { name: 'Periksa koreksi' }));
  await screen.findByText(/Valid\. 1 kasus terlindungi/);
  await user.click(screen.getByRole('button', { name: 'Simpan aturan & setujui' }));
  await screen.findByText('Aturan baru tersimpan dan hasil disetujui.');
  expect(store.rules()).toHaveLength(2);
  expect(store.list<{ status: string }>('consultations').at(-1)?.status).toBe('CORRECTED_APPROVED');
  await user.click(screen.getByRole('button', { name: 'Pengetahuan RDR' }));
  expect(await screen.findByRole('tree', { name: 'Pohon aturan RDR' })).toBeTruthy();
  expect(screen.getAllByText('KANAN · TRUE').length).toBeGreaterThan(0);
  expect(screen.getByText(/Trace konsultasi yang sedang dibuka/)).toBeTruthy();
  expect(screen.getByText('Perlu investigasi karena percobaan gagal berulang.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Riwayat task' }));
  await user.type(screen.getAllByLabelText('Bukti/catatan')[0], 'Tes terkait lulus');
  await user.click(screen.getAllByRole('button', { name: 'Simpan laporan' })[0]);
  await screen.findByText('Laporan hasil tersimpan.');
  expect(store.list<{ evidence: string }>('outcomes')[0]?.evidence).toBe('Tes terkait lulus');
  expect(
    await screen.findByText(
      (_, element) =>
        element?.tagName === 'P' && element.textContent?.includes('Tes terkait lulus') === true,
    ),
  ).toBeTruthy();
}, 15000);
it('UI menerima akses kedua layanan dan membatasi daftar model sesuai layanan', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Nama profil');
  expect(screen.queryByLabelText('DEMO Claude Code Basic')).toBeNull();
  await user.click(screen.getByLabelText('Claude Code'));
  await user.selectOptions(screen.getByLabelText('Layanan utama'), 'claude-code');
  await user.click(screen.getByLabelText('DEMO Claude Code Basic'));
  await user.click(screen.getByRole('button', { name: 'Simpan profil akses' }));
  await screen.findByText('Profil akses tersimpan. Lanjutkan isi task.');
  const saved = store.list<{ services: string[]; primaryService: string }>('accesses')[0];
  expect(saved.services).toEqual(['codex', 'claude-code']);
  expect(saved.primaryService).toBe('claude-code');
});
it('UI menampilkan kesalahan validasi backend dan tetap dapat digunakan', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Nama profil');
  await user.click(screen.getByRole('button', { name: 'Simpan profil akses' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('Konfirmasi akses memerlukan model');
  await user.click(screen.getByLabelText('DEMO Codex Basic'));
  await user.click(screen.getByRole('button', { name: 'Simpan profil akses' }));
  await screen.findByText('Profil akses tersimpan. Lanjutkan isi task.');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('UI katalog menyimpan perubahan model ke backend dengan version check', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Nama profil');
  await user.selectOptions(screen.getByLabelText('Tampilan peran'), 'expert');
  await user.click(screen.getByRole('button', { name: 'Katalog DEMO' }));
  const nameFields = await screen.findAllByLabelText('Nama model');
  const modelCount = store.catalog().models.length;
  await user.clear(nameFields[0]);
  await user.type(nameFields[0], 'Model DEMO Codex Basic revisi');
  await user.click(screen.getByRole('button', { name: 'Tambah model DEMO' }));
  await user.click(screen.getByRole('button', { name: 'Tambah profil DEMO' }));
  await user.click(screen.getByRole('button', { name: 'Tambah skill DEMO' }));
  await user.click(screen.getByRole('button', { name: 'Simpan katalog' }));
  await screen.findByText('Katalog tersimpan. Periksa kembali konsultasi yang masih terbuka.');
  expect(store.catalog().models[0].name).toBe('Model DEMO Codex Basic revisi');
  expect(store.catalog().models).toHaveLength(modelCount + 1);
  expect(store.catalog().profiles.some((p) => p.name === 'Profil DEMO baru')).toBe(true);
  expect(store.catalog().skills.some((s) => s.name === 'Skill DEMO baru')).toBe(true);
  expect(store.catalog().version).toBe(2);
});
it('form konsultasi memandu pengguna dari profil tersimpan ke tahap task', async () => {
  const response = await server.inject({
    method: 'POST',
    url: '/api/accesses',
    payload: {
      name: 'Akses tersimpan',
      services: ['codex'],
      primaryService: 'codex',
      packageName: 'DEMO lokal',
      modelIds: ['demo-codex-basic'],
      confirmed: true,
      priority: 'balanced',
    },
  });
  expect(response.statusCode).toBe(201);
  const user = userEvent.setup();
  render(<App />);
  const next = await screen.findByRole('button', { name: 'Lanjut: isi task →' });
  expect(screen.queryByLabelText('Deskripsi task')).toBeNull();
  await user.click(next);
  expect(await screen.findByLabelText('Deskripsi task')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Ubah akses/ })).toBeTruthy();
});
