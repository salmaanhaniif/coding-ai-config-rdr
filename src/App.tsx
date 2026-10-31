import { useEffect, useState, type FormEvent } from 'react';
import {
  attributes,
  type AccessInput,
  type AccessProfile,
  type CaseInput,
  type ConsultationDetail,
  type CorrectionInput,
  type Overview,
  type Predicate,
  type Task,
} from '../shared/domain';
import { api } from './api';
import {
  Compare,
  Field,
  PredicateEditor,
  ResultCard,
  conditionLabel,
  valueLabel,
} from './components';

type View = 'consult' | 'result' | 'expert' | 'tree' | 'catalog' | 'history';
const initialAttributes: CaseInput['attributes'] = {
  taskStatus: 'start',
  taskType: 'bug',
  clarity: 'clear',
  scope: 'function',
  familiarity: 'medium',
  impact: 'low',
  reproduction: 'available',
  tests: 'available',
  failures: 0,
  timeLimit: null,
  symptoms: [],
  currentModelId: null,
  currentEffort: null,
};
export default function App() {
  const [data, setData] = useState<Overview | null>(null);
  const [view, setView] = useState<View>('consult');
  const [role, setRole] = useState<'consumer' | 'expert'>('consumer');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [accessId, setAccessId] = useState('');
  const [access, setAccess] = useState<AccessInput>({
    name: 'Akses saya',
    services: ['codex'],
    primaryService: 'codex',
    packageName: 'DEMO lokal',
    modelIds: [],
    confirmed: true,
    priority: 'balanced',
  });
  const [description, setDescription] = useState('');
  const [acceptance, setAcceptance] = useState('');
  const [taskId, setTaskId] = useState('');
  const [a, setA] = useState(initialAttributes);
  const [terms, setTerms] = useState<Predicate[]>([]);
  const [profileId, setProfileId] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState('');
  const load = async () => {
    const d = await api<Overview>('/overview');
    setData(d);
    setAccessId((id) => id || d.accesses[0]?.id || '');
    return d;
  };
  useEffect(() => {
    void load().catch((e) => setError(String(e.message)));
  }, []);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const show = async (id: string, target: View) => {
    const d = await api<ConsultationDetail>('/consultations/' + id);
    setDetail(d);
    setView(target);
    setTerms([]);
    setReason('');
    setPreview('');
    setProfileId(
      data?.catalog.profiles.find((p) => p.active && d.case.access.modelIds.includes(p.modelId))
        ?.id ?? '',
    );
    const draft = await api<{ draft: CorrectionInput | null }>('/consultations/' + id + '/draft');
    if (draft.draft) {
      setTerms(draft.draft.condition.terms);
      setReason(draft.draft.reason);
      setProfileId(draft.draft.profileId);
    }
  };
  const createAccess = async (e: FormEvent) => {
    e.preventDefault();
    await act(async () => {
      const saved = await api<AccessProfile>('/accesses', 'POST', access);
      await load();
      setAccessId(saved.id);
      setNotice('Profil akses tersimpan. Lanjutkan isi task.');
    });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await act(async () => {
      const d = await api<ConsultationDetail>('/consultations', 'POST', {
        accessId,
        description,
        acceptance,
        attributes: a,
        ...(taskId ? { taskId } : {}),
      });
      await load();
      await show(d.consultation.id, 'result');
    });
  };
  const reviewBody = () => ({
    kbVersion: detail!.consultation.kbVersion,
    catalogVersion: detail!.consultation.catalogVersion,
    reason,
  });
  const correction = (): CorrectionInput => ({
    ...reviewBody(),
    condition: { type: 'and', terms },
    profileId,
  });
  const review = async (action: string) => {
    if (!detail) return;
    await act(async () => {
      const id = detail.consultation.id;
      await api(
        '/consultations/' + id + '/' + action,
        'POST',
        action === 'correction' ? correction() : action === 'refresh' ? undefined : reviewBody(),
      );
      await load();
      await show(id, 'expert');
      setNotice(
        action === 'correction'
          ? 'Aturan baru tersimpan dan hasil disetujui.'
          : 'Penilaian tersimpan.',
      );
    });
  };
  const switchService = (service: 'codex' | 'claude-code', checked: boolean) =>
    setAccess((v) => {
      const services = checked ? [...v.services, service] : v.services.filter((s) => s !== service);
      const primaryService = services.includes(v.primaryService)
        ? v.primaryService
        : (services[0] ?? 'codex');
      return {
        ...v,
        services,
        primaryService,
        modelIds: v.modelIds.filter((id) =>
          data?.catalog.models.some((m) => m.id === id && services.includes(m.service)),
        ),
      };
    });
  const currentModel = data?.catalog.models.find((m) => m.id === a.currentModelId);
  const final = detail && ['APPROVED', 'CORRECTED_APPROVED'].includes(detail.consultation.status);
  const tabs: [View, string, string][] = [
    ['consult', 'Konsultasi', '01'],
    ['expert', 'Meja pakar', '02'],
    ['tree', 'Pengetahuan RDR', '03'],
    ['history', 'Riwayat task', '04'],
    ['catalog', 'Katalog DEMO', '05'],
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('consult');
          }}
        >
          <span className="brand-icon">
            D<span>↗</span>
          </span>
          <div>
            DevPilot<small>RIPPLE DOWN RULES</small>
          </div>
        </a>
        <div className="workspace-label">WORKSPACE LOKAL</div>
        <nav>
          {tabs
            .filter((t) => role === 'expert' || t[0] !== 'expert')
            .map(([id, title, num]) => (
              <button
                key={id}
                aria-label={title}
                aria-current={view === id ? 'page' : undefined}
                className={view === id ? 'active' : ''}
                onClick={() => setView(id)}
              >
                <span aria-hidden="true">{num}</span>
                {title}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Konfigurasi tepat.
            <br />
            Langkah berikutnya jelas.
          </p>
          <small>Fondasi Person A · v0.1</small>
        </div>
      </aside>
      <main>
        <header>
          <span>AI CONFIGURATION ADVISOR</span>
          <label className="role-select">
            Tampilan{' '}
            <select
              aria-label="Tampilan peran"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as typeof role);
                if (e.target.value === 'consumer' && view === 'expert') setView('consult');
              }}
            >
              <option value="consumer">Junior developer</option>
              <option value="expert">Pakar lokal</option>
            </select>
          </label>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                DEVPILOT /{' '}
                {view === 'result'
                  ? 'HASIL KONSULTASI'
                  : tabs.find((t) => t[0] === view)?.[1].toUpperCase()}
              </div>
              <h1>
                {view === 'consult'
                  ? 'Mulai dengan konfigurasi yang tepat.'
                  : view === 'expert'
                    ? 'Pengetahuan tumbuh dari koreksi.'
                    : view === 'tree'
                      ? 'Lacak alasan setiap keputusan.'
                      : view === 'history'
                        ? 'Setiap percobaan punya konteks.'
                        : view === 'catalog'
                          ? 'Pilihan yang tersedia.'
                          : 'Langkah berikutnya untuk task-mu.'}
              </h1>
            </div>
            <span className="badge">{data ? 'KB v' + data.kbVersion : 'Menghubungkan…'}</span>
          </div>
          <div className="demo-banner">
            <span>DEMO</span> Model dan effort pada katalog awal adalah data sintetis untuk menguji
            sistem, bukan rekomendasi produk nyata.
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button className="ghost" onClick={() => setError('')}>
                Tutup
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {!data ? (
            <section className="panel">
              <p>Memuat aplikasi…</p>
              <button
                onClick={() =>
                  void act(async () => {
                    await load();
                  })
                }
              >
                Coba lagi
              </button>
            </section>
          ) : (
            <>
              {view === 'consult' && (
                <>
                  <div className="stats">
                    <div>
                      <strong>01</strong>
                      <span>Konfirmasi akses</span>
                    </div>
                    <div>
                      <strong>02</strong>
                      <span>Ceritakan task</span>
                    </div>
                    <div>
                      <strong>03</strong>
                      <span>Penilaian pakar</span>
                    </div>
                  </div>
                  <section className="panel">
                    <div className="row between">
                      <h2>Akses AI yang dimiliki</h2>
                      <span className="muted">Subscription & model</span>
                    </div>
                    <Field label="Gunakan profil tersimpan">
                      <select value={accessId} onChange={(e) => setAccessId(e.target.value)}>
                        <option value="">Pilih profil akses</option>
                        {data.accesses.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.services.map(valueLabel).join(' + ')}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <details open={!data.accesses.length}>
                      <summary>Buat profil akses baru</summary>
                      <form onSubmit={createAccess}>
                        <fieldset disabled={busy}>
                          <div className="form-grid">
                            <Field label="Nama profil">
                              <input
                                value={access.name}
                                required
                                onChange={(e) => setAccess({ ...access, name: e.target.value })}
                              />
                            </Field>
                            <Field label="Paket / jenis akses">
                              <input
                                value={access.packageName}
                                onChange={(e) =>
                                  setAccess({ ...access, packageName: e.target.value })
                                }
                              />
                            </Field>
                          </div>
                          <div className="checkboxes">
                            {(['codex', 'claude-code'] as const).map((s) => (
                              <label key={s}>
                                <input
                                  type="checkbox"
                                  checked={access.services.includes(s)}
                                  onChange={(e) => switchService(s, e.target.checked)}
                                />
                                {valueLabel(s)}
                              </label>
                            ))}
                          </div>
                          <div className="form-grid">
                            <Field label="Layanan utama">
                              <select
                                value={access.primaryService}
                                onChange={(e) =>
                                  setAccess({
                                    ...access,
                                    primaryService: e.target.value as AccessInput['primaryService'],
                                  })
                                }
                              >
                                {access.services.map((s) => (
                                  <option key={s} value={s}>
                                    {valueLabel(s)}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Prioritas penggunaan">
                              <select
                                value={access.priority}
                                onChange={(e) =>
                                  setAccess({
                                    ...access,
                                    priority: e.target.value as AccessInput['priority'],
                                  })
                                }
                              >
                                {attributes.priority.options.map((p) => (
                                  <option key={p} value={p}>
                                    {valueLabel(p)}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <p className="field-title">Model yang tersedia pada akses ini</p>
                          <div className="checkboxes vertical">
                            {data.catalog.models
                              .filter((m) => m.active && access.services.includes(m.service))
                              .map((m) => (
                                <label key={m.id}>
                                  <input
                                    type="checkbox"
                                    checked={access.modelIds.includes(m.id)}
                                    onChange={(e) =>
                                      setAccess({
                                        ...access,
                                        modelIds: e.target.checked
                                          ? [...access.modelIds, m.id]
                                          : access.modelIds.filter((id) => id !== m.id),
                                      })
                                    }
                                  />
                                  {m.name}
                                </label>
                              ))}
                          </div>
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={access.confirmed}
                              onChange={(e) =>
                                setAccess({ ...access, confirmed: e.target.checked })
                              }
                            />
                            Saya mengonfirmasi akses ke model yang dipilih.
                          </label>
                          <button type="submit">Simpan profil akses</button>
                        </fieldset>
                      </form>
                    </details>
                  </section>
                  <form className="panel" onSubmit={submit}>
                    <fieldset disabled={busy}>
                      <div className="row between">
                        <h2>Task yang ingin diselesaikan</h2>
                        <span className="muted">Mulai atau evaluasi ulang</span>
                      </div>
                      <div className="form-grid">
                        <Field label="Status task">
                          <select
                            value={a.taskStatus}
                            onChange={(e) =>
                              setA({ ...a, taskStatus: e.target.value as typeof a.taskStatus })
                            }
                          >
                            {attributes.taskStatus.options.map((v) => (
                              <option key={v} value={v}>
                                {valueLabel(v)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Lanjutkan task sebelumnya (opsional)">
                          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                            <option value="">Task baru</option>
                            {data.tasks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.description.slice(0, 80)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label="Deskripsi task">
                        <textarea
                          required
                          rows={3}
                          placeholder="Contoh: perbaiki validasi form login tanpa mengubah alur autentikasi."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Kriteria selesai"
                        hint="Tuliskan bukti yang dapat diperiksa, misalnya langkah reproduksi berhasil dan tes terkait lulus."
                      >
                        <textarea
                          required
                          rows={2}
                          value={acceptance}
                          onChange={(e) => setAcceptance(e.target.value)}
                        />
                      </Field>
                      <div className="form-grid">
                        {(
                          [
                            'taskType',
                            'clarity',
                            'scope',
                            'familiarity',
                            'impact',
                            'reproduction',
                            'tests',
                          ] as const
                        ).map((k) => (
                          <Field key={k} label={attributes[k].label}>
                            <select
                              value={a[k] ?? ''}
                              onChange={(e) => setA({ ...a, [k]: e.target.value || null })}
                            >
                              {k !== 'taskType' && <option value="">Belum diketahui</option>}
                              {attributes[k].options.map((v) => (
                                <option key={v} value={v}>
                                  {valueLabel(v)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))}
                        <Field label="Batas waktu (menit, opsional)">
                          <input
                            type="number"
                            min="1"
                            value={a.timeLimit ?? ''}
                            onChange={(e) =>
                              setA({
                                ...a,
                                timeLimit: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Jumlah percobaan gagal">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={a.failures ?? ''}
                            onChange={(e) =>
                              setA({
                                ...a,
                                failures: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      </div>
                      {a.taskStatus === 'stuck' && (
                        <div className="subpanel">
                          <h3>Konfigurasi dan gejala saat ini</h3>
                          <div className="form-grid">
                            <Field label="Model yang sudah dicoba">
                              <select
                                value={a.currentModelId ?? ''}
                                onChange={(e) =>
                                  setA({
                                    ...a,
                                    currentModelId: e.target.value || null,
                                    currentEffort: null,
                                  })
                                }
                              >
                                <option value="">Belum diketahui</option>
                                {data.catalog.models
                                  .filter((m) =>
                                    data.accesses
                                      .find((p) => p.id === accessId)
                                      ?.modelIds.includes(m.id),
                                  )
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            <Field label="Effort saat ini">
                              <select
                                value={a.currentEffort ?? ''}
                                onChange={(e) =>
                                  setA({ ...a, currentEffort: e.target.value || null })
                                }
                              >
                                <option value="">Belum diketahui</option>
                                {currentModel?.efforts.map((v) => (
                                  <option key={v} value={v}>
                                    {v === 'default' ? 'Bawaan' : v}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="checkboxes vertical">
                            {attributes.symptoms.options.map((s) => (
                              <label key={s}>
                                <input
                                  type="checkbox"
                                  checked={a.symptoms.includes(s)}
                                  onChange={(e) =>
                                    setA({
                                      ...a,
                                      symptoms: e.target.checked
                                        ? [...a.symptoms, s]
                                        : a.symptoms.filter((v) => v !== s),
                                    })
                                  }
                                />
                                {valueLabel(s)}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="row between">
                        <small className="muted">
                          Rekomendasi akan ditinjau pakar sebelum final.
                        </small>
                        <button type="submit" disabled={!accessId}>
                          {busy ? 'Memproses…' : 'Dapatkan rekomendasi →'}
                        </button>
                      </div>
                    </fieldset>
                  </form>
                </>
              )}
              {view === 'result' &&
                (detail ? (
                  <>
                    <ResultCard detail={detail} />
                    <div className="row">
                      <button
                        onClick={() => {
                          setRole('expert');
                          setView('expert');
                        }}
                      >
                        Lanjut ke penilaian pakar
                      </button>
                      <button className="secondary" onClick={() => setView('consult')}>
                        Konsultasi baru
                      </button>
                    </div>
                  </>
                ) : (
                  <section className="panel">
                    Buat konsultasi atau pilih hasil dari riwayat.
                  </section>
                ))}
              {view === 'expert' && (
                <>
                  <section className="panel">
                    <div className="row between">
                      <h2>Antrean dan penilaian</h2>
                      <span className="badge">Pakar lokal</span>
                    </div>
                    {data.bootstrapNeeded && (
                      <div className="notice">
                        Bootstrap: setujui satu kasus yang sesuai default untuk menjadi kasus kunci
                        root. Koreksi tersedia setelah itu.
                      </div>
                    )}
                    <div className="case-list">
                      {data.consultations.length ? (
                        data.consultations.map((c) => (
                          <button
                            className={
                              'case-row ' + (detail?.consultation.id === c.id ? 'selected' : '')
                            }
                            key={c.id}
                            onClick={() => void act(() => show(c.id, 'expert'))}
                          >
                            <span>
                              {data.tasks
                                .find((t) => t.id === c.taskId)
                                ?.description.slice(0, 75) ?? 'Konsultasi'}
                            </span>
                            <small>{c.status.replaceAll('_', ' ')}</small>
                          </button>
                        ))
                      ) : (
                        <p>Belum ada konsultasi. Buat kasus melalui formulir konsumen.</p>
                      )}
                    </div>
                  </section>
                  {detail && (
                    <>
                      <ResultCard detail={detail} />
                      <section className="panel">
                        <h2>Penilaian kasus</h2>
                        <p className="muted">
                          Keputusan ini dicatat sebagai penilaian pakar lokal.
                        </p>
                        {!final ? (
                          <fieldset disabled={busy}>
                            <Field label="Alasan penilaian">
                              <textarea
                                rows={2}
                                value={reason}
                                onChange={(e) => {
                                  setReason(e.target.value);
                                  setPreview('');
                                }}
                                placeholder="Jelaskan mengapa rekomendasi disetujui atau perlu dikoreksi."
                              />
                            </Field>
                            <div className="row wrap">
                              <button
                                disabled={!reason.trim() || detail.consultation.issues.length > 0}
                                onClick={() => void review('approve')}
                              >
                                {data.bootstrapNeeded
                                  ? 'Setuju & jadikan acuan root'
                                  : 'Setujui rekomendasi'}
                              </button>
                              <button
                                className="secondary"
                                disabled={!reason.trim()}
                                onClick={() => void review('information')}
                              >
                                Minta informasi
                              </button>
                              <button className="secondary" onClick={() => void review('refresh')}>
                                Perbarui inferensi
                              </button>
                            </div>
                            <hr />
                            <h3>Koreksi rekomendasi</h3>
                            <Compare
                              facts={detail.case.facts}
                              cornerstone={detail.cornerstone?.facts ?? null}
                            />
                            {!detail.cornerstone ? (
                              <p className="notice">
                                Kasus kunci belum tersedia. Selesaikan bootstrap terlebih dahulu,
                                lalu perbarui inferensi kasus ini.
                              </p>
                            ) : (
                              <>
                                <p className="muted">
                                  Pilih kondisi yang benar pada kasus baru dan salah pada kasus
                                  kunci. Baris berwarna menunjukkan atribut yang berbeda.
                                </p>
                                <div className="candidates">
                                  {detail.candidates.map((p, i) => (
                                    <button
                                      key={i}
                                      className="secondary"
                                      onClick={() => {
                                        setTerms([...terms, p]);
                                        setPreview('');
                                      }}
                                    >
                                      + {conditionLabel({ type: 'and', terms: [p] })}
                                    </button>
                                  ))}
                                </div>
                                <p className="field-title">Gabungan kondisi AND</p>
                                {terms.map((p, i) => (
                                  <PredicateEditor
                                    key={i}
                                    value={p}
                                    onChange={(v) => {
                                      setTerms(terms.map((x, j) => (j === i ? v : x)));
                                      setPreview('');
                                    }}
                                    onRemove={() => {
                                      setTerms(terms.filter((_, j) => j !== i));
                                      setPreview('');
                                    }}
                                  />
                                ))}
                                <button
                                  className="secondary"
                                  onClick={() => {
                                    setTerms([
                                      ...terms,
                                      { field: 'failures', op: 'gte', value: 1 },
                                    ]);
                                    setPreview('');
                                  }}
                                >
                                  Tambah kondisi manual
                                </button>
                                <Field label="Paket konfigurasi pengganti">
                                  <select
                                    value={profileId}
                                    onChange={(e) => {
                                      setProfileId(e.target.value);
                                      setPreview('');
                                    }}
                                  >
                                    <option value="">Pilih konfigurasi</option>
                                    {data.catalog.profiles
                                      .filter(
                                        (p) =>
                                          p.active &&
                                          detail.case.access.modelIds.includes(p.modelId),
                                      )
                                      .map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name} · effort {p.effort}
                                        </option>
                                      ))}
                                  </select>
                                </Field>
                                {preview && (
                                  <div className="notice" role="status">
                                    {preview}
                                  </div>
                                )}
                                <div className="row wrap">
                                  <button
                                    className="secondary"
                                    disabled={!terms.length || !profileId || !reason.trim()}
                                    onClick={() =>
                                      void act(async () => {
                                        await api(
                                          '/consultations/' + detail.consultation.id + '/draft',
                                          'PUT',
                                          correction(),
                                        );
                                        await load();
                                        setNotice('Draft koreksi tersimpan.');
                                      })
                                    }
                                  >
                                    Simpan draft
                                  </button>
                                  <button
                                    className="secondary"
                                    disabled={!terms.length || !profileId || !reason.trim()}
                                    onClick={() =>
                                      void act(async () => {
                                        const p = await api<{
                                          protectedCount: number;
                                          attachment: { branch: string };
                                        }>(
                                          '/consultations/' +
                                            detail.consultation.id +
                                            '/correction/preview',
                                          'POST',
                                          correction(),
                                        );
                                        setPreview(
                                          'Valid. ' +
                                            p.protectedCount +
                                            ' kasus terlindungi tetap konsisten. Node dipasang pada cabang ' +
                                            p.attachment.branch.toUpperCase() +
                                            ' di ujung jalur.',
                                        );
                                      })
                                    }
                                  >
                                    Periksa koreksi
                                  </button>
                                  <button
                                    disabled={!terms.length || !profileId || !reason.trim()}
                                    onClick={() => void review('correction')}
                                  >
                                    Simpan aturan & setujui
                                  </button>
                                </div>
                              </>
                            )}
                          </fieldset>
                        ) : (
                          <p className="notice">
                            Penilaian sudah final. Untuk melanjutkan task, buat konsultasi baru yang
                            terhubung ke task ini.
                          </p>
                        )}
                      </section>
                    </>
                  )}
                </>
              )}
              {view === 'tree' && (
                <section className="panel">
                  <h2>Struktur pengetahuan · {data.nodes.length} rule</h2>
                  <p className="muted">
                    Kanan = TRUE / pengecualian. Kiri = FALSE / alternatif. Tampilan dasar untuk
                    penyerahan Person A.
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Node</th>
                          <th>Kondisi</th>
                          <th>Kesimpulan</th>
                          <th>Kiri FALSE</th>
                          <th>Kanan TRUE</th>
                          <th>Kasus kunci</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.nodes.map((n) => (
                          <tr key={n.id}>
                            <td>{n.id === 'root' ? 'root' : n.id.slice(0, 8)}</td>
                            <td>{conditionLabel(n.condition)}</td>
                            <td>
                              {n.conclusion.kind === 'default'
                                ? 'Default layanan utama'
                                : n.conclusion.snapshot.profile.name}
                            </td>
                            <td>{n.falseChild?.slice(0, 8) ?? '—'}</td>
                            <td>{n.trueChild?.slice(0, 8) ?? '—'}</td>
                            <td>{n.cornerstoneId?.slice(0, 8) ?? 'Belum bootstrap'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {view === 'catalog' && (
                <section className="panel">
                  <h2>Katalog konfigurasi · v{data.catalog.version}</h2>
                  <p className="muted">
                    Katalog awal sintetis. Pengelolaan visual dilanjutkan Person B; operasi backend
                    sudah tersedia.
                  </p>
                  <div className="catalog-grid">
                    {data.catalog.profiles.map((p) => {
                      const m = data.catalog.models.find((m) => m.id === p.modelId)!;
                      return (
                        <article className="subpanel" key={p.id}>
                          <span className="badge">{m.demo ? 'DEMO' : 'Terverifikasi pakar'}</span>
                          <h3>{m.name}</h3>
                          <p>{p.name}</p>
                          <p>
                            Effort: <b>{p.effort === 'default' ? 'Bawaan' : p.effort}</b> · {p.mode}
                          </p>
                          <p className="muted">{p.nextStep}</p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
              {view === 'history' && (
                <section className="panel">
                  <h2>Riwayat konsultasi</h2>
                  {!data.consultations.length ? (
                    <p className="muted">Belum ada riwayat.</p>
                  ) : (
                    data.tasks.map((t) => (
                      <article key={t.id} className="history-task">
                        <h3>{t.description}</h3>
                        <p className="muted">Selesai jika: {t.acceptance}</p>
                        {data.consultations
                          .filter((c) => c.taskId === t.id)
                          .map((c) => (
                            <button
                              className="case-row"
                              key={c.id}
                              onClick={() => void act(() => show(c.id, 'result'))}
                            >
                              <span>
                                {new Date(c.createdAt).toLocaleString('id-ID', {
                                  timeZone: 'Asia/Jakarta',
                                })}
                              </span>
                              <small>{c.status.replaceAll('_', ' ')}</small>
                            </button>
                          ))}
                        <button
                          className="secondary"
                          onClick={() => {
                            setTaskId(t.id);
                            setDescription(t.description);
                            setAcceptance(t.acceptance);
                            setA({ ...initialAttributes, taskStatus: 'stuck' });
                            setView('consult');
                          }}
                        >
                          Konsultasi ulang task ini
                        </button>
                      </article>
                    ))
                  )}
                </section>
              )}
            </>
          )}
          <footer>
            DevPilot RDR · Keputusan ditelusuri melalui aturan, disempurnakan oleh pakar.
          </footer>
        </div>
      </main>
    </div>
  );
}
