import { serviceLabels, type Resolved } from './domain.js';

export const thinkingLabel = (value: Resolved['profile']['thinking']) =>
  value === 'enabled'
    ? 'Aktif'
    : value === 'adaptive'
      ? 'Aktif · adaptif'
      : value === 'disabled'
        ? 'Nonaktif'
        : 'Belum ditetapkan';

export function configurationText(r: Resolved): string {
  return `Gunakan ${serviceLabels[r.model.service]}, model ${r.model.name}, effort ${r.profile.effort}, mode thinking ${thinkingLabel(r.profile.thinking).toLowerCase()}.`;
}

export function setupInstructions(r: Resolved): { text: string; code?: string } {
  const model = r.model.runtimeId;
  if (r.model.demo || !model)
    return { text: 'Entri lama ini belum memiliki konfigurasi pemakaian terverifikasi.' };
  if (r.model.service === 'codex')
    return {
      text: 'Di Codex, buka /model lalu pilih model dan effort di atas. Reasoning aktif melalui effort; tidak ada sakelar thinking terpisah. Untuk sesi CLI baru:',
      code: `codex --model ${model} -c 'model_reasoning_effort="${r.profile.effort}"'`,
    };
  if (r.model.service === 'claude-code')
    return {
      text: 'Jalankan perintah berikut pada terminal, atau gunakan /model dan /effort di sesi Claude Code. Thinking adaptif aktif pada model ini.',
      code: `claude --model ${model} --effort ${r.profile.effort}`,
    };
  return {
    text: `Buka ChatGPT Work, buka Advanced pada pemilih model, pilih ${r.model.name}, lalu pilih reasoning effort ${r.profile.effort}. Model ini tersedia di Work jika akun mendukungnya; pilihan Chat biasa berbeda.`,
  };
}
