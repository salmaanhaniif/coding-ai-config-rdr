// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';
import { buildKnowledge } from '../server/knowledge.js';
import App from '../src/App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('pengguna mengonfirmasi akses sendiri lalu memperoleh konfigurasi nyata beserta cara menerapkan', async () => {
  const store = new Store(':memory:');
  buildKnowledge(store);
  const server = await createApp(store, { staticRoot: 'missing-dist' });
  vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
    const response = await server.inject({
      url: String(url),
      method: (options.method ?? 'GET') as 'GET' | 'POST' | 'PUT',
      headers: options.headers as Record<string, string>,
      payload: options.body as string | undefined,
    });
    return {
      ok: response.statusCode < 300,
      status: response.statusCode,
      json: async () => response.json(),
    };
  });
  try {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText('Nama profil');
    expect(screen.queryByRole('option', { name: /Acuan/ })).toBeNull();
    expect(screen.getByLabelText('ChatGPT Work')).toBeTruthy();
    await user.click(screen.getByLabelText('GPT-6.1 Sol'));
    await user.click(screen.getByRole('button', { name: 'Simpan profil akses' }));
    await screen.findByLabelText('Task description');
    await user.type(screen.getByLabelText('Task description'), 'Telusuri bug sesi lintas modul');
    await user.type(
      screen.getByLabelText('Acceptance criteria'),
      'Tes sesi lulus dan penyebab ditemukan',
    );
    await user.selectOptions(screen.getByLabelText('Cakupan perubahan'), 'modules');
    await user.click(screen.getByRole('button', { name: /Dapatkan rekomendasi/ }));
    await screen.findByText('Gunakan Codex, model GPT-6.1 Sol, effort high, mode thinking aktif.');
    expect(
      screen.getByText('codex --model gpt-6.1-sol -c \'model_reasoning_effort="high"\''),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Dokumentasi resmi' }).getAttribute('href')).toBe(
      'https://learn.chatgpt.com/docs/models',
    );
    expect(screen.getByText('Sementara · perlu penilaian')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Rule tree' }));
    expect(screen.getAllByRole('button', { name: 'Tutup cabang' }).length).toBeGreaterThan(0);
  } finally {
    cleanup();
    await server.close();
    store.close();
  }
}, 20000);
