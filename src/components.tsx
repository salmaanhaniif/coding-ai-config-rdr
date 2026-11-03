import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { configurationText, setupInstructions, thinkingLabel } from '../shared/recommendation';
import {
  attributes,
  labels,
  type Condition,
  type ConsultationDetail,
  type Facts,
  type Predicate,
} from '../shared/domain';
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const input = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
        id,
        'aria-describedby': hint ? id + '-hint' : undefined,
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  );
}
export const valueLabel = (v: unknown) =>
  v === null || v === undefined
    ? 'Belum diketahui'
    : Array.isArray(v)
      ? v.map((x) => labels[String(x)] ?? x).join(', ') || 'Tidak ada'
      : (labels[String(v)] ?? String(v));
export function statusLabel(value: string): string {
  return (
    (
      {
        PENDING_EXPERT: 'Menunggu penilaian',
        CORRECTION_DRAFT: 'Draft koreksi',
        NEEDS_INFORMATION: 'Perlu informasi',
        APPROVED: 'Disetujui',
        CORRECTED_APPROVED: 'Disetujui setelah koreksi',
      } as Record<string, string>
    )[value] ?? value
  );
}
const reviewLabels: Record<string, string> = {
  approved: 'Disetujui',
  corrected: 'Dikoreksi dan disetujui',
  needs_information: 'Meminta informasi',
  draft_saved: 'Draft tersimpan',
  refreshed: 'Inferensi diperbarui',
};
export function conditionLabel(c: Condition) {
  return c.type === 'always'
    ? 'TRUE — selalu berlaku'
    : c.terms
        .map(
          (p) =>
            attributes[p.field].label +
            ' ' +
            p.op +
            (p.value === undefined ? '' : ' ' + valueLabel(p.value)),
        )
        .join(' DAN ');
}
export function ResultCard({ detail }: { detail: ConsultationDetail }) {
  const c = detail.consultation;
  const r = c.resolved;
  const setup = r ? setupInstructions(r) : null;
  const final = ['APPROVED', 'CORRECTED_APPROVED'].includes(c.status);
  return (
    <section className="panel">
      <div className="row between">
        <h2>Recommended configuration</h2>
        <span className={'badge ' + (final ? 'success' : 'amber')}>
          {final ? 'Disetujui pakar' : 'Sementara · perlu penilaian'}
        </span>
      </div>
      <p className="muted">{detail.case.description}</p>
      {c.issues.length > 0 && (
        <div className="notice">
          {c.issues.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </div>
      )}
      {r ? (
        <>
          <p className="recommendation-summary">
            <b>{configurationText(r)}</b>
          </p>
          <div className="config-grid">
            <div>
              <small>Service</small>
              <strong>{valueLabel(r.model.service)}</strong>
            </div>
            <div>
              <small>Model {r.model.demo && '· DEMO'}</small>
              <strong>{r.model.name}</strong>
            </div>
            <div>
              <small>Effort</small>
              <strong>{r.profile.effort === 'default' ? 'Bawaan' : r.profile.effort}</strong>
            </div>
            <div>
              <small>Thinking</small>
              <strong>{thinkingLabel(r.profile.thinking)}</strong>
            </div>
            <div>
              <small>Work mode</small>
              <strong>
                {
                  {
                    execution: 'Eksekusi terarah',
                    investigation: 'Investigasi',
                    planning: 'Perencanaan',
                  }[r.profile.mode]
                }
              </strong>
            </div>
          </div>
          <div className="next-step">
            <small>CARA MENERAPKAN</small>
            <p>{setup?.text}</p>
            {setup?.code && (
              <pre>
                <code>{setup.code}</code>
              </pre>
            )}
            {!r.model.demo && (
              <p className="muted">
                Sumber:{' '}
                <a href={r.model.source} target="_blank" rel="noreferrer">
                  Dokumentasi resmi
                </a>{' '}
                · diverifikasi {r.model.verifiedAt}. Pilih hanya model dan effort yang tersedia pada
                akun Anda.
              </p>
            )}
          </div>
          <p>
            <b>Skill:</b> {r.skills.map((s) => s.name).join(', ') || 'Tidak diperlukan'}
          </p>
          <div className="next-step">
            <small>LANGKAH BERIKUTNYA</small>
            <p>{r.profile.nextStep}</p>
          </div>
          <details>
            <summary>Alasan dan kriteria selesai</summary>
            <p>
              <b>Alasan aturan:</b> {detail.matchedRule.reason}
            </p>
            <p>
              <b>Kondisi pemicu:</b> {conditionLabel(detail.matchedRule.condition)}
            </p>
            <p>
              <b>Dasar konfigurasi:</b> {r.profile.reason}
            </p>
            <p>
              <b>Konteks:</b> {r.profile.context}
            </p>
            <p>
              <b>Evaluasi ulang:</b> {r.profile.reconsider}
            </p>
            <p>
              <b>Selesai jika:</b> {detail.case.acceptance}
            </p>
            <p className="muted">
              Snapshot katalog v{r.catalogVersion}.{' '}
              {c.inference.conclusion.kind === 'default'
                ? 'Default dipetakan secara eksplisit ke layanan utama.'
                : 'Paket berasal dari aturan pengecualian.'}
            </p>
          </details>
        </>
      ) : (
        <p>
          Konfigurasi belum dapat ditentukan. Lengkapi informasi atau minta pakar memeriksa default.
        </p>
      )}
      <details>
        <summary>Jejak inferensi · KB v{c.kbVersion}</summary>
        <ol>
          {c.inference.trace.map((t) => (
            <li key={t.nodeId}>
              {t.nodeId === 'root' ? 'Root' : t.nodeId.slice(0, 8)}:{' '}
              {t.matched ? 'cocok → kanan TRUE' : 'tidak cocok → kiri FALSE'}
              {t.nodeId === c.inference.lastMatchedNode ? ' · kesimpulan terakhir' : ''}
            </li>
          ))}
        </ol>
      </details>
      {detail.reviews.length > 0 && (
        <details>
          <summary>Riwayat penilaian pakar</summary>
          {detail.reviews.map((review) => (
            <p key={review.id}>
              <b>{reviewLabels[review.action] ?? review.action}</b> · {review.reason}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
export function Compare({ facts, cornerstone }: { facts: Facts; cornerstone: Facts | null }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Atribut</th>
            <th>Kasus baru</th>
            <th>Kasus kunci</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(attributes).map(([key, meta]) => {
            const k = key as keyof Facts;
            const different =
              cornerstone && JSON.stringify(facts[k]) !== JSON.stringify(cornerstone[k]);
            return (
              <tr key={key} className={different ? 'different' : ''}>
                <td>{meta.label}</td>
                <td>{valueLabel(facts[k])}</td>
                <td>{cornerstone ? valueLabel(cornerstone[k]) : 'Belum ada'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function PredicateEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Predicate;
  onChange: (v: Predicate) => void;
  onRemove: () => void;
}) {
  const meta = attributes[value.field];
  const ops =
    meta.kind === 'number'
      ? ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'is_unknown']
      : meta.kind === 'set'
        ? ['contains', 'not_contains', 'is_unknown']
        : ['equals', 'not_equals', 'in', 'is_unknown'];
  return (
    <div className="predicate">
      <select
        aria-label="Atribut kondisi"
        value={value.field}
        onChange={(e) => {
          const field = e.target.value as Predicate['field'];
          const m = attributes[field];
          onChange({
            field,
            op: m.kind === 'set' ? 'contains' : 'equals',
            value: m.kind === 'number' ? 0 : m.options[0],
          });
        }}
      >
        {Object.entries(attributes).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Operator kondisi"
        value={value.op}
        onChange={(e) => {
          const op = e.target.value as Predicate['op'];
          onChange(
            op === 'is_unknown'
              ? { field: value.field, op }
              : {
                  ...value,
                  op,
                  value:
                    op === 'in'
                      ? typeof value.value === 'string'
                        ? [value.value]
                        : [meta.options[0] ?? '']
                      : Array.isArray(value.value)
                        ? value.value[0]
                        : (value.value ?? (meta.kind === 'number' ? 0 : meta.options[0])),
                },
          );
        }}
      >
        {ops.map((op) => (
          <option key={op}>{op}</option>
        ))}
      </select>
      {value.op !== 'is_unknown' &&
        (meta.kind === 'number' ? (
          <input
            aria-label="Nilai kondisi"
            type="number"
            min="0"
            value={String(value.value ?? 0)}
            onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
          />
        ) : value.op === 'in' ? (
          <select
            multiple
            aria-label="Nilai kategori kondisi"
            value={Array.isArray(value.value) ? value.value : []}
            onChange={(e) =>
              onChange({ ...value, value: Array.from(e.target.selectedOptions, (o) => o.value) })
            }
          >
            {meta.options.map((v) => (
              <option key={v} value={v}>
                {valueLabel(v)}
              </option>
            ))}
          </select>
        ) : (
          <select
            aria-label="Nilai kondisi"
            value={String(value.value ?? meta.options[0])}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          >
            {meta.options.map((v) => (
              <option key={v} value={v}>
                {valueLabel(v)}
              </option>
            ))}
          </select>
        ))}
      <button type="button" className="ghost" onClick={onRemove}>
        Hapus
      </button>
    </div>
  );
}
