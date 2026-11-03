import { useEffect, useState, type FormEvent } from 'react';
import {
  attributes,
  services,
  type AccessInput,
  type AccessProfile,
  type CaseInput,
  type Catalog,
  type ConsultationDetail,
  type CorrectionInput,
  type Overview,
  type Predicate,
  type Task,
  type OutcomeInput,
  type RuleNode,
} from '../shared/domain';
import { api } from './api';
import {
  Compare,
  Field,
  PredicateEditor,
  ResultCard,
  conditionLabel,
  valueLabel,
  statusLabel,
} from './components';

type View = 'consult' | 'result' | 'expert' | 'tree' | 'catalog' | 'history';
const newCatalogId = (prefix: string) =>
  prefix +
  '-' +
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
function TreeBranch({
  id,
  branch,
  nodes,
  selected,
  onSelect,
  trace,
  last,
  depth = 0,
}: {
  id: string;
  branch?: 'false' | 'true';
  nodes: RuleNode[];
  selected: string;
  onSelect: (id: string) => void;
  trace: { nodeId: string; matched: boolean }[];
  last?: string;
  depth?: number;
}) {
  const node = nodes.find((n) => n.id === id);
  const [expanded, setExpanded] = useState(depth < 2 || trace.some((t) => t.nodeId === id));
  useEffect(() => {
    if (trace.some((t) => t.nodeId === id)) setExpanded(true);
  }, [trace, id]);
  if (!node) return null;
  const hit = trace.find((t) => t.nodeId === id);
  return (
    <li className="tree-item">
      <div className="tree-branch-label">
        {branch === 'false' ? 'KIRI · FALSE' : branch === 'true' ? 'KANAN · TRUE' : 'ATURAN AWAL'}
      </div>
      <button
        role="treeitem"
        aria-selected={selected === id}
        className={`tree-node ${selected === id ? 'selected' : ''} ${hit ? 'on-path' : ''} ${last === id ? 'conclusion-node' : ''}`}
        onClick={() => onSelect(id)}
      >
        <small>
          {id === 'root' ? 'ROOT' : 'RULE ' + id.slice(0, 6)}
          {hit ? ` · ${hit.matched ? 'COCOK' : 'TIDAK COCOK'}` : ''}
        </small>
        <strong>{conditionLabel(node.condition)}</strong>
        <span>
          Kesimpulan:{' '}
          {node.conclusion.kind === 'default'
            ? 'Default layanan utama'
            : node.conclusion.snapshot.profile.name}
        </span>
      </button>
      {(node.falseChild || node.trueChild) && (
        <button
          type="button"
          className="ghost tree-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Tutup cabang' : 'Buka cabang'}
        </button>
      )}
      <div className="tree-children" hidden={!expanded}>
        {node.falseChild && (
          <ul>
            <TreeBranch
              id={node.falseChild}
              branch="false"
              nodes={nodes}
              selected={selected}
              onSelect={onSelect}
              trace={trace}
              last={last}
              depth={depth + 1}
            />
          </ul>
        )}
        {node.trueChild && (
          <ul>
            <TreeBranch
              id={node.trueChild}
              branch="true"
              nodes={nodes}
              selected={selected}
              onSelect={onSelect}
              trace={trace}
              last={last}
              depth={depth + 1}
            />
          </ul>
        )}
      </div>
    </li>
  );
}
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
  const [consultStep, setConsultStep] = useState<1 | 2>(1);
  const [accessId, setAccessId] = useState('');
  const [access, setAccess] = useState<AccessInput>({
    name: 'Akses saya',
    services: ['codex'],
    primaryService: 'codex',
    packageName: '',
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
  const [catalogDraft, setCatalogDraft] = useState<Catalog | null>(null);
  const [selectedNode, setSelectedNode] = useState('root');
  const [outcomes, setOutcomes] = useState<
    Record<string, (OutcomeInput & { id: string; taskId: string; createdAt: string })[]>
  >({});
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeInput>({
    success: 'unknown',
    evidence: '',
    durationMinutes: null,
    attempts: 0,
    tokens: null,
    apiCost: null,
    currency: null,
    subscriptionUsage: null,
  });
  const load = async () => {
    const d = await api<Overview>('/overview');
    setData(d);
    setCatalogDraft(d.catalog);
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
      setConsultStep(2);
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
  const switchService = (service: AccessInput['primaryService'], checked: boolean) =>
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
  const saveCatalog = async () => {
    if (!catalogDraft) return;
    await act(async () => {
      await api('/catalog', 'PUT', catalogDraft);
      await load();
      setNotice('Katalog tersimpan. Periksa kembali konsultasi yang masih terbuka.');
    });
  };
  const addDemoModel = () => {
    if (!catalogDraft) return;
    const demo = catalogDraft.models.every((m) => m.demo);
    const modelId = newCatalogId(demo ? 'demo-model' : 'model');
    setCatalogDraft({
      ...catalogDraft,
      models: [
        ...catalogDraft.models,
        {
          id: modelId,
          name: demo ? 'Model DEMO baru' : 'Model baru',
          service: 'codex',
          efforts: demo ? ['default'] : ['low', 'medium', 'high'],
          thinkingModes: demo ? undefined : ['enabled'],
          active: true,
          demo,
          source: '',
          verifiedAt: null,
        },
      ],
    });
  };
  const addDemoProfile = () => {
    if (!catalogDraft) return;
    const model = catalogDraft.models.find((m) => m.active);
    if (!model) {
      setError('Aktifkan atau tambahkan model terlebih dahulu.');
      return;
    }
    setCatalogDraft({
      ...catalogDraft,
      profiles: [
        ...catalogDraft.profiles,
        {
          id: newCatalogId('demo-profile'),
          name: model.demo ? 'Profil DEMO baru' : 'Profil baru',
          modelId: model.id,
          effort: model.efforts[0],
          thinking: model.thinkingModes?.[0],
          mode: 'execution',
          skillIds: [],
          nextStep: 'Jelaskan tindakan berikutnya.',
          context: 'Tambahkan konteks yang diperlukan.',
          reason: 'Jelaskan alasan konfigurasi ini sesuai.',
          reconsider: 'Evaluasi kembali jika hasil tidak sesuai kriteria.',
          active: true,
        },
      ],
    });
  };
  const addDemoSkill = () => {
    if (!catalogDraft) return;
    setCatalogDraft({
      ...catalogDraft,
      skills: [
        ...catalogDraft.skills,
        {
          id: newCatalogId('demo-skill'),
          name: 'Skill DEMO baru',
          services: ['codex'],
          active: true,
          description: 'Deskripsikan bantuan skill ini.',
          demo: true,
          source: '',
          verifiedAt: null,
        },
      ],
    });
  };
  const loadTaskOutcomes = async (id: string) => {
    const response = await api<{
      outcomes: (OutcomeInput & { id: string; taskId: string; createdAt: string })[];
    }>('/tasks/' + id);
    setOutcomes((old) => ({ ...old, [id]: response.outcomes }));
  };
  const final = detail && ['APPROVED', 'CORRECTED_APPROVED'].includes(detail.consultation.status);
  const tabs: [View, string, string][] = [
    ['consult', 'Konsultasi', '01'],
    ['expert', 'Expert review', '02'],
    ['tree', 'Rule tree', '03'],
    ['history', 'Task history', '04'],
    ['catalog', 'Model catalog', '05'],
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
        <div className="workspace-label">Ruang kerja</div>
        <nav>
          {tabs
            .filter((t) => role === 'expert' || t[0] !== 'expert')
            .map(([id, title, num]) => (
              <button
                key={id}
                aria-label={title}
                aria-current={view === id ? 'page' : undefined}
                className={view === id ? 'active' : ''}
                onClick={() => {
                  if (id === 'tree' && detail) {
                    setSelectedNode(detail.consultation.inference.lastMatchedNode);
                  }
                  setView(id);
                }}
              >
                <span aria-hidden="true">{num}</span>
                {title}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Rekomendasi model AI
            <br />
            untuk pekerjaan developer.
          </p>
          <small>DevPilot RDR · Demo lokal</small>
        </div>
      </aside>
      <main>
        <header>
          <span>Rekomendasi konfigurasi AI</span>
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
                DevPilot /{' '}
                {view === 'result' ? 'Hasil konsultasi' : tabs.find((t) => t[0] === view)?.[1]}
              </div>
              <h1>
                {view === 'consult'
                  ? 'Konsultasi'
                  : view === 'expert'
                    ? 'Expert review'
                    : view === 'tree'
                      ? 'Rule tree'
                      : view === 'history'
                        ? 'Task history'
                        : view === 'catalog'
                          ? 'Model catalog'
                          : 'Model recommendation'}
              </h1>
            </div>
            <span className="badge">{data ? 'KB v' + data.kbVersion : 'Menghubungkan…'}</span>
          </div>
          <div className="demo-banner">
            <span>MODEL CATALOG</span>{' '}
            {data?.catalog.models.every((m) => m.demo)
              ? 'Katalog lama masih memakai model DEMO. Jalankan npm run dev tanpa DB_PATH untuk membuka basis pengetahuan model nyata.'
              : 'Model nyata dengan effort eksplisit dan sumber resmi. Konfirmasikan akses sesuai akun Anda.'}
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
                  <div className="stats" aria-label="Tahapan konsultasi">
                    <button
                      className={consultStep === 1 ? 'current' : 'complete'}
                      onClick={() => setConsultStep(1)}
                      type="button"
                    >
                      <strong>01</strong>
                      <span>Profil akses</span>
                    </button>
                    <button
                      className={consultStep === 2 ? 'current' : ''}
                      onClick={() => setConsultStep(2)}
                      type="button"
                      disabled={!accessId}
                    >
                      <strong>02</strong>
                      <span>Detail task</span>
                    </button>
                    <div className="step-static">
                      <strong>03</strong>
                      <span>Penilaian pakar</span>
                    </div>
                  </div>
                  {consultStep === 1 && (
                    <section className="panel">
                      <div className="row between">
                        <h2>Akses AI yang dimiliki</h2>
                        <span className="muted">Subscription & models</span>
                      </div>
                      <Field
                        label="Gunakan profil tersimpan"
                        hint="Pilih layanan dan model yang memang tersedia pada akses akun Anda."
                      >
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
                              {services.map((s) => (
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
                            <p className="muted">
                              ChatGPT berarti mode Work. Pilih satu layanan atau beberapa sekaligus
                              sesuai akses Anda; paket ChatGPT tidak otomatis mengonfirmasi semua
                              model Codex.
                            </p>
                            <div className="form-grid">
                              <Field label="Layanan utama">
                                <select
                                  value={access.primaryService}
                                  onChange={(e) =>
                                    setAccess({
                                      ...access,
                                      primaryService: e.target
                                        .value as AccessInput['primaryService'],
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
                      <div className="row between step-actions">
                        <small className="muted">
                          Pilih profil tersimpan atau buat profil baru untuk melanjutkan.
                        </small>
                        <button
                          type="button"
                          onClick={() => setConsultStep(2)}
                          disabled={!accessId}
                        >
                          Lanjut: isi task →
                        </button>
                      </div>
                    </section>
                  )}
                  {consultStep === 2 && (
                    <div className="row step-back">
                      <button type="button" className="secondary" onClick={() => setConsultStep(1)}>
                        ← Ubah akses
                      </button>
                    </div>
                  )}
                  {consultStep === 2 && (
                    <form className="panel" onSubmit={submit}>
                      <fieldset disabled={busy}>
                        <div className="row between">
                          <h2>Task yang ingin diselesaikan</h2>
                          <span className="muted">Mulai atau evaluasi ulang</span>
                        </div>
                        <details open>
                          <summary>Langkah berikutnya · karakteristik task dan konteks</summary>
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
                          <p className="muted">
                            Alur <b>{a.taskStatus === 'start' ? 'Mulai task' : 'Task macet'}</b>:{' '}
                            {a.taskStatus === 'start'
                              ? 'jelaskan kebutuhan dan bukti selesai.'
                              : 'catat konfigurasi yang dicoba serta gejala kegagalan.'}
                          </p>
                          <Field label="Task description">
                            <textarea
                              required
                              rows={3}
                              placeholder="Contoh: perbaiki validasi form login tanpa mengubah alur autentikasi."
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                            />
                          </Field>
                          <Field
                            label="Acceptance criteria"
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
                                    timeLimit:
                                      e.target.value === '' ? null : Number(e.target.value),
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
                        </details>
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
                  )}
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
                            <small>{statusLabel(c.status)}</small>
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
                                <Field label="Replacement configuration">
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
                    Jalur konsultasi aktif ditandai garis tebal. Kiri selalu FALSE dan kanan selalu
                    TRUE.
                  </p>
                  <div className="tree-layout">
                    <div className="tree-canvas" role="tree" aria-label="RDR rule tree">
                      <ul className="tree-root">
                        <TreeBranch
                          id="root"
                          nodes={data.nodes}
                          selected={selectedNode}
                          onSelect={setSelectedNode}
                          trace={detail?.consultation.inference.trace ?? []}
                          last={detail?.consultation.inference.lastMatchedNode}
                        />
                      </ul>
                    </div>
                    <aside className="tree-detail">
                      <h3>Detail cabang</h3>
                      {(() => {
                        const node = data.nodes.find((n) => n.id === selectedNode);
                        return node ? (
                          <>
                            <p>
                              <b>Kondisi:</b> {conditionLabel(node.condition)}
                            </p>
                            <p>
                              <b>Kesimpulan:</b>{' '}
                              {node.conclusion.kind === 'default'
                                ? 'Default layanan utama'
                                : node.conclusion.snapshot.profile.name}
                            </p>
                            <p>
                              <b>Alasan pakar:</b> {node.reason}
                            </p>
                          </>
                        ) : null;
                      })()}
                      <p>
                        <b>Kiri · FALSE:</b> lanjut bila kondisi tidak terpenuhi
                      </p>
                      <p>
                        <b>Kanan · TRUE:</b> pengecualian saat kondisi terpenuhi
                      </p>
                      <p className="muted">
                        Cornerstone:{' '}
                        {data.nodes.find((n) => n.id === selectedNode)?.cornerstoneId ??
                          'Belum bootstrap'}
                      </p>
                      {detail?.matchedRule.id === selectedNode && detail.cornerstone && (
                        <details>
                          <summary>Kasus kunci dan atributnya</summary>
                          <p>{detail.cornerstone.description}</p>
                          <Compare
                            facts={detail.case.facts}
                            cornerstone={detail.cornerstone.facts}
                          />
                        </details>
                      )}
                    </aside>
                  </div>
                  {detail && (
                    <p className="notice">
                      Trace konsultasi yang sedang dibuka:{' '}
                      {detail.consultation.inference.trace
                        .map(
                          (t) =>
                            `${t.nodeId === 'root' ? 'root' : t.nodeId.slice(0, 6)} ${t.matched ? 'TRUE' : 'FALSE'}`,
                        )
                        .join(' → ')}
                      . Node kesimpulan terakhir: {detail.consultation.inference.lastMatchedNode}.
                    </p>
                  )}
                  <details className="tree-example">
                    <summary>Contoh pohon setelah satu koreksi pakar · ilustrasi</summary>
                    <p className="muted">
                      Contoh ini hanya penjelasan, tidak ditambahkan ke basis pengetahuan Anda.
                    </p>
                    <div className="example-flow">
                      <article className="example-node">
                        <small>ROOT · TRUE</small>
                        <b>Default layanan utama</b>
                        <span>Kasus umum</span>
                      </article>
                      <div className="example-link">
                        <span>KANAN · TRUE</span>
                        <b>→</b>
                      </div>
                      <article className="example-node exception">
                        <small>RULE PENGECUALIAN</small>
                        <b>Status task = macet DAN percobaan gagal ≥ 3</b>
                        <span>Rekomendasi: mode investigasi</span>
                      </article>
                    </div>
                    <p className="muted">
                      Jika kondisi rule pengecualian tidak terpenuhi, inferensi mengikuti cabang
                      kiri FALSE. Rule tetap ditempelkan oleh pakar pada ujung jalur yang sesuai.
                    </p>
                  </details>
                </section>
              )}
              {view === 'catalog' && (
                <section className="panel">
                  <div className="row between">
                    <h2>Katalog konfigurasi · v{catalogDraft?.version}</h2>
                    <button onClick={() => void saveCatalog()} disabled={busy}>
                      Simpan katalog
                    </button>
                  </div>
                  <p className="muted">
                    Model nyata menyertakan URL sumber, tanggal verifikasi, effort, dan dukungan
                    thinking. Perubahan katalog tidak mengubah snapshot rekomendasi lama.
                  </p>
                  {catalogDraft && (
                    <>
                      <h3>Default layanan</h3>
                      <div className="form-grid">
                        {services.map((s) => (
                          <Field key={s} label={'Default · ' + valueLabel(s)}>
                            <select
                              value={catalogDraft.defaults[s] ?? ''}
                              onChange={(e) =>
                                setCatalogDraft({
                                  ...catalogDraft,
                                  defaults: {
                                    ...catalogDraft.defaults,
                                    [s]: e.target.value || null,
                                  },
                                })
                              }
                            >
                              <option value="">Tidak ditentukan</option>
                              {catalogDraft.profiles
                                .filter(
                                  (p) =>
                                    p.active &&
                                    catalogDraft.models.find((m) => m.id === p.modelId)?.service ===
                                      s,
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </Field>
                        ))}
                      </div>
                      <div className="row between catalog-section-title">
                        <h3>Model dan effort</h3>
                        <button type="button" className="secondary" onClick={addDemoModel}>
                          {catalogDraft?.models.every((m) => m.demo)
                            ? 'Tambah model DEMO'
                            : 'Tambah model'}
                        </button>
                      </div>
                      <div className="catalog-grid">
                        {catalogDraft.models.map((m, i) => (
                          <article className="subpanel" key={m.id}>
                            <span className="badge">
                              {m.demo ? 'DEMO' : 'Model nyata · sumber resmi'}
                            </span>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={m.demo}
                                onChange={(e) => {
                                  const models = [...catalogDraft.models];
                                  models[i] = { ...m, demo: e.target.checked };
                                  setCatalogDraft({ ...catalogDraft, models });
                                }}
                              />
                              Data sintetis berlabel DEMO
                            </label>
                            <div className="form-grid">
                              <Field label="Nama model">
                                <input
                                  value={m.name}
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = { ...m, name: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                />
                              </Field>
                              <Field label="Status">
                                <select
                                  value={String(m.active)}
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = { ...m, active: e.target.value === 'true' };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                >
                                  <option value="true">Aktif</option>
                                  <option value="false">Nonaktif</option>
                                </select>
                              </Field>
                              <Field label="Layanan">
                                <select
                                  value={m.service}
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = {
                                      ...m,
                                      service: e.target.value as typeof m.service,
                                    };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                >
                                  <option value="codex">Codex</option>
                                  <option value="claude-code">Claude Code</option>
                                  <option value="chatgpt">ChatGPT Work</option>
                                </select>
                              </Field>
                              <Field label="Effort, pisahkan dengan koma">
                                <input
                                  value={m.efforts.join(', ')}
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = {
                                      ...m,
                                      efforts: e.target.value
                                        .split(',')
                                        .map((x) => x.trim())
                                        .filter(Boolean),
                                    };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                />
                              </Field>
                              <Field label="ID model di layanan">
                                <input
                                  value={m.runtimeId ?? ''}
                                  placeholder="Contoh: gpt-6.1-sol"
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = { ...m, runtimeId: e.target.value || undefined };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                />
                              </Field>
                              <Field label="Dukungan thinking">
                                <select
                                  value={m.thinkingModes?.[0] ?? ''}
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = {
                                      ...m,
                                      thinkingModes: e.target.value
                                        ? [e.target.value as 'enabled' | 'adaptive' | 'disabled']
                                        : undefined,
                                    };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                >
                                  <option value="">Belum ditetapkan</option>
                                  <option value="enabled">Aktif melalui reasoning effort</option>
                                  <option value="adaptive">Aktif · adaptif</option>
                                  <option value="disabled">Nonaktif</option>
                                </select>
                              </Field>
                              <Field label="Sumber resmi">
                                <input
                                  value={m.source}
                                  placeholder="URL dokumentasi resmi"
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = { ...m, source: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                />
                              </Field>
                              <Field label="Tanggal verifikasi">
                                <input
                                  type="date"
                                  value={m.verifiedAt?.slice(0, 10) ?? ''}
                                  onChange={(e) => {
                                    const models = [...catalogDraft.models];
                                    models[i] = { ...m, verifiedAt: e.target.value || null };
                                    setCatalogDraft({ ...catalogDraft, models });
                                  }}
                                />
                              </Field>
                            </div>
                            <p>
                              {valueLabel(m.service)} · ID {m.id}
                            </p>
                          </article>
                        ))}
                      </div>
                      <div className="row between catalog-section-title">
                        <h3>Profil konfigurasi</h3>
                        <button type="button" className="secondary" onClick={addDemoProfile}>
                          {catalogDraft?.models.every((m) => m.demo)
                            ? 'Tambah profil DEMO'
                            : 'Tambah profil'}
                        </button>
                      </div>
                      <div className="catalog-grid">
                        {catalogDraft.profiles.map((p, i) => (
                          <article className="subpanel" key={p.id}>
                            <div className="form-grid">
                              <Field label="Nama profil">
                                <input
                                  value={p.name}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, name: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                />
                              </Field>
                              <Field label="Model">
                                <select
                                  value={p.modelId}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    const model = catalogDraft.models.find(
                                      (m) => m.id === e.target.value,
                                    )!;
                                    profiles[i] = {
                                      ...p,
                                      modelId: model.id,
                                      effort: model.efforts.includes(p.effort)
                                        ? p.effort
                                        : model.efforts[0],
                                      thinking: model.thinkingModes?.[0],
                                    };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                >
                                  {catalogDraft.models.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} · {valueLabel(m.service)}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Effort">
                                <select
                                  value={p.effort}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, effort: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                >
                                  {(
                                    catalogDraft.models.find((m) => m.id === p.modelId)?.efforts ??
                                    []
                                  ).map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Mode thinking">
                                <select
                                  value={p.thinking ?? ''}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = {
                                      ...p,
                                      thinking: e.target.value as typeof p.thinking,
                                    };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                >
                                  <option value="">Belum ditetapkan</option>
                                  {(
                                    catalogDraft.models.find((m) => m.id === p.modelId)
                                      ?.thinkingModes ?? []
                                  ).map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Mode kerja">
                                <select
                                  value={p.mode}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, mode: e.target.value as typeof p.mode };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                >
                                  <option value="execution">Eksekusi terarah</option>
                                  <option value="investigation">Investigasi</option>
                                  <option value="planning">Perencanaan</option>
                                </select>
                              </Field>
                              <Field label="Langkah berikutnya">
                                <textarea
                                  value={p.nextStep}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, nextStep: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                />
                              </Field>
                              <Field label="Konteks yang diperlukan">
                                <textarea
                                  value={p.context}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, context: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                />
                              </Field>
                              <Field label="Alasan">
                                <textarea
                                  value={p.reason}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, reason: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                />
                              </Field>
                              <Field label="Evaluasi ulang jika">
                                <textarea
                                  value={p.reconsider}
                                  onChange={(e) => {
                                    const profiles = [...catalogDraft.profiles];
                                    profiles[i] = { ...p, reconsider: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, profiles });
                                  }}
                                />
                              </Field>
                            </div>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={p.active}
                                onChange={(e) => {
                                  const profiles = [...catalogDraft.profiles];
                                  profiles[i] = { ...p, active: e.target.checked };
                                  setCatalogDraft({ ...catalogDraft, profiles });
                                }}
                              />
                              Aktif
                            </label>
                            <p className="muted">Skill yang kompatibel:</p>
                            <div className="checkboxes vertical">
                              {catalogDraft.skills.map((s) => (
                                <label key={s.id}>
                                  <input
                                    type="checkbox"
                                    checked={p.skillIds.includes(s.id)}
                                    onChange={(e) => {
                                      const profiles = [...catalogDraft.profiles];
                                      profiles[i] = {
                                        ...p,
                                        skillIds: e.target.checked
                                          ? [...p.skillIds, s.id]
                                          : p.skillIds.filter((id) => id !== s.id),
                                      };
                                      setCatalogDraft({ ...catalogDraft, profiles });
                                    }}
                                  />
                                  {s.name} · {s.services.map(valueLabel).join(', ')}
                                  {s.demo ? ' · DEMO' : ''}
                                </label>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="row between catalog-section-title">
                        <h3>Skill terkurasi</h3>
                        <button type="button" className="secondary" onClick={addDemoSkill}>
                          Tambah skill DEMO
                        </button>
                      </div>
                      <div className="catalog-grid">
                        {catalogDraft.skills.map((s, i) => (
                          <article className="subpanel" key={s.id}>
                            <span className="badge">{s.demo ? 'DEMO' : 'Entri katalog'}</span>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={s.demo}
                                onChange={(e) => {
                                  const skills = [...catalogDraft.skills];
                                  skills[i] = { ...s, demo: e.target.checked };
                                  setCatalogDraft({ ...catalogDraft, skills });
                                }}
                              />
                              Data sintetis berlabel DEMO
                            </label>
                            <Field label="Nama skill">
                              <input
                                value={s.name}
                                onChange={(e) => {
                                  const skills = [...catalogDraft.skills];
                                  skills[i] = { ...s, name: e.target.value };
                                  setCatalogDraft({ ...catalogDraft, skills });
                                }}
                              />
                            </Field>
                            <Field label="Deskripsi">
                              <textarea
                                value={s.description}
                                onChange={(e) => {
                                  const skills = [...catalogDraft.skills];
                                  skills[i] = { ...s, description: e.target.value };
                                  setCatalogDraft({ ...catalogDraft, skills });
                                }}
                              />
                            </Field>
                            <div className="form-grid">
                              <Field label="Sumber">
                                <input
                                  value={s.source}
                                  placeholder="URL sumber resmi"
                                  onChange={(e) => {
                                    const skills = [...catalogDraft.skills];
                                    skills[i] = { ...s, source: e.target.value };
                                    setCatalogDraft({ ...catalogDraft, skills });
                                  }}
                                />
                              </Field>
                              <Field label="Tanggal verifikasi">
                                <input
                                  type="date"
                                  value={s.verifiedAt?.slice(0, 10) ?? ''}
                                  onChange={(e) => {
                                    const skills = [...catalogDraft.skills];
                                    skills[i] = { ...s, verifiedAt: e.target.value || null };
                                    setCatalogDraft({ ...catalogDraft, skills });
                                  }}
                                />
                              </Field>
                            </div>
                            <div className="field">
                              <span className="field-title">Kompatibel dengan layanan</span>
                              <div className="checkboxes">
                                {services.map((service) => (
                                  <label key={service}>
                                    <input
                                      type="checkbox"
                                      checked={s.services.includes(service)}
                                      onChange={(e) => {
                                        const skills = [...catalogDraft.skills];
                                        const services = e.target.checked
                                          ? [...s.services, service]
                                          : s.services.filter((x) => x !== service);
                                        skills[i] = { ...s, services };
                                        setCatalogDraft({ ...catalogDraft, skills });
                                      }}
                                    />
                                    {valueLabel(service)}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={s.active}
                                onChange={(e) => {
                                  const skills = [...catalogDraft.skills];
                                  skills[i] = { ...s, active: e.target.checked };
                                  setCatalogDraft({ ...catalogDraft, skills });
                                }}
                              />
                              Aktif
                            </label>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
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
                              <small>{statusLabel(c.status)}</small>
                            </button>
                          ))}
                        <section className="subpanel outcome-box">
                          <h3>Laporan hasil task</h3>
                          <div className="form-grid">
                            <Field label="Hasil">
                              <select
                                value={outcomeDraft.success}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    success: e.target.value as OutcomeInput['success'],
                                  })
                                }
                              >
                                <option value="unknown">Belum diketahui</option>
                                <option value="yes">Berhasil</option>
                                <option value="no">Tidak berhasil</option>
                              </select>
                            </Field>
                            <Field label="Waktu (menit)">
                              <input
                                type="number"
                                min="0"
                                value={outcomeDraft.durationMinutes ?? ''}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    durationMinutes:
                                      e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Jumlah percobaan">
                              <input
                                type="number"
                                min="0"
                                value={outcomeDraft.attempts ?? ''}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    attempts: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Bukti/catatan">
                              <textarea
                                value={outcomeDraft.evidence}
                                onChange={(e) =>
                                  setOutcomeDraft({ ...outcomeDraft, evidence: e.target.value })
                                }
                              />
                            </Field>
                            <Field label="Token (opsional)">
                              <input
                                type="number"
                                min="0"
                                value={outcomeDraft.tokens ?? ''}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    tokens: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Biaya API (opsional)">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={outcomeDraft.apiCost ?? ''}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    apiCost: e.target.value === '' ? null : Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                            <Field label="Mata uang biaya">
                              <select
                                value={outcomeDraft.currency ?? ''}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    currency: (e.target.value || null) as OutcomeInput['currency'],
                                  })
                                }
                              >
                                <option value="">Tidak diketahui</option>
                                <option>IDR</option>
                                <option>USD</option>
                              </select>
                            </Field>
                            <Field label="Pemakaian subscription">
                              <input
                                value={outcomeDraft.subscriptionUsage ?? ''}
                                onChange={(e) =>
                                  setOutcomeDraft({
                                    ...outcomeDraft,
                                    subscriptionUsage: e.target.value || null,
                                  })
                                }
                              />
                            </Field>
                          </div>
                          <div className="row wrap">
                            <button
                              onClick={() =>
                                void act(async () => {
                                  await api('/tasks/' + t.id + '/outcomes', 'POST', outcomeDraft);
                                  await loadTaskOutcomes(t.id);
                                  setNotice('Laporan hasil tersimpan.');
                                })
                              }
                            >
                              Simpan laporan
                            </button>
                            <button
                              className="secondary"
                              onClick={() => void act(() => loadTaskOutcomes(t.id))}
                            >
                              Muat laporan tersimpan
                            </button>
                          </div>
                          {(outcomes[t.id] ?? []).map((o, i) => (
                            <p key={i} className="muted">
                              Hasil: {o.success} · percobaan {o.attempts ?? 'unknown'} · token{' '}
                              {o.tokens ?? 'unknown'} · biaya API{' '}
                              {o.apiCost == null ? 'unknown' : `${o.apiCost} ${o.currency}`} ·
                              subscription: {o.subscriptionUsage ?? 'unknown'} · {o.evidence}
                            </p>
                          ))}
                        </section>
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
