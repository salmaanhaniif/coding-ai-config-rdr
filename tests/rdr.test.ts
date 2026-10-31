import { describe, it, expect } from 'vitest';
import { evaluate, infer, appendException, validateTree, candidates } from '../server/rdr.js';
import { exceptionSchema, makeFacts, type RuleNode, type Facts } from '../shared/domain.js';
const facts = (failures: number | null = 0): Facts => ({
  taskStatus: 'start',
  taskType: 'bug',
  clarity: 'clear',
  scope: 'function',
  familiarity: 'medium',
  impact: 'low',
  reproduction: 'available',
  tests: 'available',
  priority: 'balanced',
  primaryService: 'codex',
  accessConfirmed: 'yes',
  services: ['codex'],
  symptoms: [],
  failures,
  timeLimit: null,
});
const root = (): RuleNode => ({
  id: 'root',
  condition: { type: 'always' },
  conclusion: { kind: 'default' },
  trueChild: null,
  falseChild: null,
  cornerstoneId: null,
  reason: 'Default',
  createdAt: '',
});
const node = (id: string, n: number): RuleNode => ({
  ...root(),
  id,
  condition: { type: 'and', terms: [{ field: 'failures', op: 'gte', value: n }] },
  cornerstoneId: 'case-' + id,
});
describe('Penelusuran RDR', () => {
  it('root saja menghasilkan kesimpulan default', () => {
    expect(infer([root()], facts()).lastMatchedNode).toBe('root');
  });
  it('true mengikuti kanan dan kesimpulan terakhir menggantikan sebelumnya', () => {
    const r = root();
    r.trueChild = 'a';
    const a = node('a', 2);
    a.trueChild = 'b';
    expect(infer([r, a, node('b', 3)], facts(3)).lastMatchedNode).toBe('b');
  });
  it('node false tidak mengganti kesimpulan terakhir', () => {
    const r = root();
    r.trueChild = 'a';
    const result = infer([r, node('a', 2)], facts());
    expect(result.lastMatchedNode).toBe('root');
    expect(result.terminalNode).toBe('a');
    expect(result.terminalBranch).toBe('false');
  });
  it('false-child bisa cocok dan menghasilkan kesimpulan baru', () => {
    const r = root();
    r.trueChild = 'a';
    const a = node('a', 3);
    a.falseChild = 'b';
    const result = infer([r, a, node('b', 1)], facts(1));
    expect(result.lastMatchedNode).toBe('b');
    expect(result.trace.map((t) => t.branch)).toEqual(['true', 'false', 'true']);
  });
  it.each([
    ['gt', false],
    ['gte', true],
    ['lt', false],
    ['lte', true],
  ] as const)('operator %s pada batas numerik', (op, want) => {
    expect(evaluate({ type: 'and', terms: [{ field: 'failures', op, value: 3 }] }, facts(3))).toBe(
      want,
    );
  });
  it('unknown bukan nol dan not_equals tidak menganggap unknown diketahui', () => {
    expect(
      evaluate(
        { type: 'and', terms: [{ field: 'failures', op: 'equals', value: 0 }] },
        facts(null),
      ),
    ).toBe(false);
    expect(
      evaluate(
        { type: 'and', terms: [{ field: 'failures', op: 'not_equals', value: 1 }] },
        facts(null),
      ),
    ).toBe(false);
    expect(
      evaluate({ type: 'and', terms: [{ field: 'failures', op: 'is_unknown' }] }, facts(null)),
    ).toBe(true);
  });
  it('mendukung kategori, himpunan, dan AND', () => {
    expect(
      evaluate(
        {
          type: 'and',
          terms: [
            { field: 'taskType', op: 'in', value: ['bug', 'feature'] },
            { field: 'services', op: 'contains', value: 'codex' },
          ],
        },
        facts(),
      ),
    ).toBe(true);
  });
  it('menolak operator dengan tipe salah dan atribut bebas', () => {
    expect(
      exceptionSchema.safeParse({ type: 'and', terms: [{ field: 'scope', op: 'gte', value: 3 }] })
        .success,
    ).toBe(false);
    expect(
      exceptionSchema.safeParse({
        type: 'and',
        terms: [{ field: 'description', op: 'equals', value: 'kasus unik' }],
      }).success,
    ).toBe(false);
  });
  it('menolak cycle dan child dengan parent ganda', () => {
    const r = root();
    r.trueChild = 'a';
    const a = node('a', 1);
    a.trueChild = 'root';
    expect(() => validateTree([r, a])).toThrow();
    r.falseChild = 'a';
    a.trueChild = null;
    expect(() => validateTree([r, a])).toThrow();
  });
  it('menolak cornerstone hilang', () => {
    const r = root();
    r.trueChild = 'a';
    expect(() => validateTree([r, node('a', 1)], new Set())).toThrow('cornerstone');
  });
  it('memasang node pada false-child terminal tanpa menimpa subtree', () => {
    const r = root();
    r.trueChild = 'a';
    const a = node('a', 3);
    const result = appendException([r, a], facts(1), facts(0), node('b', 1));
    expect(result.find((n) => n.id === 'root')?.trueChild).toBe('a');
    expect(result.find((n) => n.id === 'a')?.falseChild).toBe('b');
    expect(infer(result, facts(1)).lastMatchedNode).toBe('b');
  });
  it('menolak kondisi salah pada kasus baru atau benar pada cornerstone', () => {
    expect(() => appendException([root()], facts(1), facts(0), node('a', 2))).toThrow('kasus baru');
    expect(() => appendException([root()], facts(2), facts(1), node('a', 1))).toThrow(
      'kasus kunci',
    );
  });
  it('semua kandidat benar pada kasus baru dan salah pada cornerstone', () => {
    const newer = facts(3);
    newer.services = ['codex', 'claude-code'];
    const terms = candidates(newer, facts());
    expect(terms.length).toBeGreaterThan(1);
    for (const p of terms) {
      expect(evaluate({ type: 'and', terms: [p] }, newer)).toBe(true);
      expect(evaluate({ type: 'and', terms: [p] }, facts())).toBe(false);
    }
  });
});
