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
  await user.click(screen.getByRole('button', { name: '+ Status task equals Task macet' }));
  await user.selectOptions(
    screen.getByLabelText('Paket konfigurasi pengganti'),
    'demo-codex-deep-profile',
  );
  await user.click(screen.getByRole('button', { name: 'Periksa koreksi' }));
  await screen.findByText(/Valid\. 1 kasus terlindungi/);
  await user.click(screen.getByRole('button', { name: 'Simpan aturan & setujui' }));
  await screen.findByText('Aturan baru tersimpan dan hasil disetujui.');
  expect(store.rules()).toHaveLength(2);
  expect(store.list<{ status: string }>('consultations').at(-1)?.status).toBe('CORRECTED_APPROVED');
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
