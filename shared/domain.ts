import { z } from 'zod';

export const services = ['codex', 'claude-code'] as const;
export const serviceSchema = z.enum(services);
export const serviceLabels = { codex: 'Codex', 'claude-code': 'Claude Code' };
export const attributes = {
  taskStatus: { label: 'Status task', kind: 'category', options: ['start', 'stuck'] },
  taskType: { label: 'Jenis task', kind: 'category', options: ['bug', 'feature', 'refactor'] },
  clarity: {
    label: 'Kejelasan kebutuhan',
    kind: 'category',
    options: ['clear', 'partial', 'unclear'],
  },
  scope: {
    label: 'Cakupan perubahan',
    kind: 'category',
    options: ['function', 'files', 'modules'],
  },
  familiarity: { label: 'Pemahaman kode', kind: 'category', options: ['low', 'medium', 'high'] },
  impact: { label: 'Dampak kesalahan', kind: 'category', options: ['low', 'medium', 'high'] },
  reproduction: {
    label: 'Bukti reproduksi',
    kind: 'category',
    options: ['available', 'missing', 'na'],
  },
  tests: { label: 'Pengujian relevan', kind: 'category', options: ['available', 'missing'] },
  priority: { label: 'Prioritas', kind: 'category', options: ['economy', 'balanced', 'quality'] },
  primaryService: { label: 'Layanan utama', kind: 'category', options: [...services] },
  accessConfirmed: { label: 'Akses terkonfirmasi', kind: 'category', options: ['yes', 'no'] },
  services: { label: 'Layanan tersedia', kind: 'set', options: [...services] },
  symptoms: {
    label: 'Gejala kegagalan',
    kind: 'set',
    options: ['repeated', 'tests-fail', 'scope-creep', 'no-cause', 'hard-to-understand'],
  },
  failures: { label: 'Percobaan gagal', kind: 'number', options: [] },
  timeLimit: { label: 'Batas waktu (menit)', kind: 'number', options: [] },
} as const;
export type Field = keyof typeof attributes;
export const fieldNames = Object.keys(attributes) as [Field, ...Field[]];
export const labels: Record<string, string> = {
  start: 'Mulai task',
  stuck: 'Task macet',
  bug: 'Bug fixing',
  feature: 'Fitur kecil',
  refactor: 'Refactoring',
  clear: 'Jelas',
  partial: 'Sebagian jelas',
  unclear: 'Belum jelas',
  function: 'Satu fungsi',
  files: 'Beberapa file',
  modules: 'Lintas modul',
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  available: 'Tersedia',
  missing: 'Belum tersedia',
  na: 'Tidak relevan',
  economy: 'Hemat penggunaan',
  balanced: 'Seimbang',
  quality: 'Kualitas hasil',
  yes: 'Ya',
  no: 'Belum',
  repeated: 'Solusi berulang',
  'tests-fail': 'Pengujian gagal',
  'scope-creep': 'Perubahan melebar',
  'no-cause': 'Penyebab belum ditemukan',
  'hard-to-understand': 'Hasil sulit dipahami',
  codex: 'Codex',
  'claude-code': 'Claude Code',
};
const text = z.string().trim().min(1).max(4000);
const id = z.string().trim().min(1).max(120);
const nonnegative = z.number().finite().nonnegative();
export const accessSchema = z
  .object({
    name: text.max(100),
    services: z.array(serviceSchema).min(1).max(2),
    primaryService: serviceSchema,
    packageName: z.string().trim().max(120).default('Belum diketahui'),
    modelIds: z.array(id).max(100),
    confirmed: z.boolean(),
    priority: z.enum(['economy', 'balanced', 'quality']),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.services.includes(v.primaryService))
      ctx.addIssue({ code: 'custom', message: 'Layanan utama harus termasuk akses.' });
    if (new Set(v.services).size !== v.services.length)
      ctx.addIssue({ code: 'custom', message: 'Layanan tidak boleh duplikat.' });
    if (v.confirmed && !v.modelIds.length)
      ctx.addIssue({ code: 'custom', message: 'Konfirmasi akses memerlukan model yang tersedia.' });
  });
export type AccessInput = z.infer<typeof accessSchema>;
export type AccessProfile = AccessInput & { id: string; createdAt: string };
export const taskAttributesSchema = z
  .object({
    taskStatus: z.enum(['start', 'stuck']),
    taskType: z.enum(['bug', 'feature', 'refactor']),
    clarity: z.enum(['clear', 'partial', 'unclear']).nullable(),
    scope: z.enum(['function', 'files', 'modules']).nullable(),
    familiarity: z.enum(['low', 'medium', 'high']).nullable(),
    impact: z.enum(['low', 'medium', 'high']).nullable(),
    reproduction: z.enum(['available', 'missing', 'na']).nullable(),
    tests: z.enum(['available', 'missing']).nullable(),
    failures: nonnegative.int().nullable(),
    timeLimit: z.number().finite().positive().nullable(),
    symptoms: z.array(z.enum(attributes.symptoms.options)).max(5),
    currentModelId: id.nullable(),
    currentEffort: id.nullable(),
  })
  .strict();
export const caseSchema = z
  .object({
    accessId: id,
    taskId: id.optional(),
    description: text,
    acceptance: text,
    attributes: taskAttributesSchema,
  })
  .strict();
export type CaseInput = z.infer<typeof caseSchema>;
export type Facts = Record<Field, string | number | string[] | null>;
export type CaseSnapshot = {
  id: string;
  taskId: string;
  access: AccessProfile;
  description: string;
  acceptance: string;
  attributes: z.infer<typeof taskAttributesSchema>;
  facts: Facts;
  createdAt: string;
};
export function makeFacts(access: AccessInput, a: z.infer<typeof taskAttributesSchema>): Facts {
  return {
    taskStatus: a.taskStatus,
    taskType: a.taskType,
    clarity: a.clarity,
    scope: a.scope,
    familiarity: a.familiarity,
    impact: a.impact,
    reproduction: a.reproduction,
    tests: a.tests,
    failures: a.failures,
    timeLimit: a.timeLimit,
    symptoms: a.symptoms,
    priority: access.priority,
    primaryService: access.primaryService,
    accessConfirmed: access.confirmed ? 'yes' : 'no',
    services: access.services,
  };
}
export const operators = [
  'equals',
  'not_equals',
  'in',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'is_unknown',
] as const;
export const predicateSchema = z
  .object({
    field: z.enum(fieldNames),
    op: z.enum(operators),
    value: z.union([z.string(), z.number().finite(), z.array(z.string())]).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const meta = attributes[p.field];
    if (p.op === 'is_unknown') {
      if (p.value !== undefined)
        ctx.addIssue({ code: 'custom', message: 'is_unknown tidak menerima nilai.' });
      return;
    }
    let valid = false;
    if (meta.kind === 'number')
      valid =
        ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte'].includes(p.op) &&
        typeof p.value === 'number' &&
        p.value >= 0;
    if (meta.kind === 'category')
      valid =
        (['equals', 'not_equals'].includes(p.op) &&
          typeof p.value === 'string' &&
          (meta.options as readonly string[]).includes(p.value)) ||
        (p.op === 'in' &&
          Array.isArray(p.value) &&
          p.value.length > 0 &&
          p.value.every((v) => (meta.options as readonly string[]).includes(v)));
    if (meta.kind === 'set')
      valid =
        p.op === 'contains' &&
        typeof p.value === 'string' &&
        (meta.options as readonly string[]).includes(p.value);
    if (!valid)
      ctx.addIssue({
        code: 'custom',
        message: 'Operator atau nilai tidak sesuai tipe atribut ' + p.field,
      });
  });
export type Predicate = z.infer<typeof predicateSchema>;
export const exceptionSchema = z
  .object({ type: z.literal('and'), terms: z.array(predicateSchema).min(1).max(12) })
  .strict();
export type Condition = { type: 'always' } | z.infer<typeof exceptionSchema>;
const provenance = {
  demo: z.boolean(),
  source: z.string().max(1000),
  verifiedAt: z.string().nullable(),
};
export const modelSchema = z
  .object({
    id,
    name: text.max(160),
    service: serviceSchema,
    efforts: z.array(id).min(1).max(12),
    active: z.boolean(),
    ...provenance,
  })
  .strict()
  .superRefine((m, ctx) => {
    if (
      !m.demo &&
      (!URL.canParse(m.source) || !m.verifiedAt || Number.isNaN(Date.parse(m.verifiedAt)))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Model nyata memerlukan URL sumber dan tanggal verifikasi.',
      });
  });
export const skillSchema = z
  .object({
    id,
    name: text.max(160),
    services: z.array(serviceSchema).min(1),
    active: z.boolean(),
    description: text,
    ...provenance,
  })
  .strict();
export const profileSchema = z
  .object({
    id,
    name: text.max(160),
    modelId: id,
    effort: id,
    mode: z.enum(['execution', 'investigation', 'planning']),
    skillIds: z.array(id).max(10),
    nextStep: text,
    context: text,
    reason: text,
    reconsider: text,
    active: z.boolean(),
  })
  .strict();
export const catalogSchema = z
  .object({
    version: z.number().int().positive(),
    models: z.array(modelSchema).min(1).max(100),
    skills: z.array(skillSchema).max(100),
    profiles: z.array(profileSchema).min(1).max(200),
    defaults: z.object({ codex: id.nullable(), 'claude-code': id.nullable() }).strict(),
  })
  .strict();
export type Catalog = z.infer<typeof catalogSchema>;
export type Resolved = {
  profile: Catalog['profiles'][number];
  model: Catalog['models'][number];
  skills: Catalog['skills'];
  catalogVersion: number;
};
export type Conclusion = { kind: 'default' } | { kind: 'fixed'; snapshot: Resolved };
export type RuleNode = {
  id: string;
  condition: Condition;
  conclusion: Conclusion;
  trueChild: string | null;
  falseChild: string | null;
  cornerstoneId: string | null;
  reason: string;
  createdAt: string;
};
export type TraceEntry = { nodeId: string; matched: boolean; branch: 'true' | 'false' };
export type Inference = {
  conclusion: Conclusion;
  lastMatchedNode: string;
  terminalNode: string;
  terminalBranch: 'true' | 'false';
  trace: TraceEntry[];
};
export type ConsultationStatus =
  'PENDING_EXPERT' | 'CORRECTION_DRAFT' | 'NEEDS_INFORMATION' | 'APPROVED' | 'CORRECTED_APPROVED';
export type Consultation = {
  id: string;
  caseId: string;
  taskId: string;
  status: ConsultationStatus;
  kbVersion: number;
  catalogVersion: number;
  inference: Inference;
  resolved: Resolved | null;
  issues: string[];
  createdAt: string;
  updatedAt: string;
};
export const reviewSchema = z
  .object({
    kbVersion: z.number().int().positive(),
    catalogVersion: z.number().int().positive(),
    reason: text,
  })
  .strict();
export const correctionSchema = reviewSchema
  .extend({ condition: exceptionSchema, profileId: id })
  .strict();
export type CorrectionInput = z.infer<typeof correctionSchema>;
export const outcomeSchema = z
  .object({
    success: z.enum(['yes', 'no', 'unknown']),
    evidence: z.string().max(4000),
    durationMinutes: nonnegative.nullable(),
    attempts: nonnegative.int().nullable(),
    tokens: nonnegative.int().nullable(),
    apiCost: nonnegative.nullable(),
    currency: z.enum(['IDR', 'USD']).nullable(),
    subscriptionUsage: z.string().max(200).nullable(),
  })
  .strict()
  .superRefine((o, ctx) => {
    if (o.apiCost !== null && o.currency === null)
      ctx.addIssue({ code: 'custom', message: 'Biaya API memerlukan mata uang.' });
  });
export type OutcomeInput = z.infer<typeof outcomeSchema>;
export type Task = { id: string; description: string; acceptance: string; createdAt: string };
export type ExpertReview = {
  id: string;
  consultationId: string;
  action: string;
  reason: string;
  extra: unknown;
  expert: string;
  createdAt: string;
};
export type ConsultationDetail = {
  consultation: Consultation;
  case: CaseSnapshot;
  matchedRule: RuleNode;
  cornerstone: CaseSnapshot | null;
  candidates: Predicate[];
  reviews: ExpertReview[];
};
export type Overview = {
  kbVersion: number;
  catalog: Catalog;
  nodes: RuleNode[];
  accesses: AccessProfile[];
  consultations: Consultation[];
  tasks: Task[];
  bootstrapNeeded: boolean;
};
