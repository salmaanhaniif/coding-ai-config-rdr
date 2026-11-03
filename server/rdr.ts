import {
  attributes,
  type CaseSnapshot,
  type Condition,
  type Facts,
  type Inference,
  type Predicate,
  type RuleNode,
} from '../shared/domain.js';
import { AppError, demand } from './errors.js';

export function evaluate(condition: Condition, facts: Facts): boolean {
  if (condition.type === 'always') return true;
  return condition.terms.every((p) => {
    const actual = facts[p.field];
    if (p.op === 'is_unknown') return actual === null || actual === undefined;
    if (actual === null || actual === undefined) return false;
    switch (p.op) {
      case 'equals':
        return actual === p.value;
      case 'not_equals':
        return actual !== p.value;
      case 'in':
        return Array.isArray(p.value) && typeof actual === 'string' && p.value.includes(actual);
      case 'contains':
        return Array.isArray(actual) && typeof p.value === 'string' && actual.includes(p.value);
      case 'not_contains':
        return Array.isArray(actual) && typeof p.value === 'string' && !actual.includes(p.value);
      case 'gt':
        return typeof actual === 'number' && typeof p.value === 'number' && actual > p.value;
      case 'gte':
        return typeof actual === 'number' && typeof p.value === 'number' && actual >= p.value;
      case 'lt':
        return typeof actual === 'number' && typeof p.value === 'number' && actual < p.value;
      case 'lte':
        return typeof actual === 'number' && typeof p.value === 'number' && actual <= p.value;
    }
  });
}
export function validateTree(nodes: RuleNode[], cases?: Set<string>): void {
  demand(nodes.length > 0, 'INVALID_TREE', 'Pohon kosong.');
  const map = new Map(nodes.map((n) => [n.id, n]));
  demand(map.size === nodes.length, 'INVALID_TREE', 'ID node duplikat.');
  const root = map.get('root');
  demand(root?.condition.type === 'always', 'INVALID_TREE', 'Root harus TRUE.');
  const parents = new Map<string, number>();
  for (const node of nodes) {
    demand(
      node.id === 'root' || node.condition.type !== 'always',
      'INVALID_TREE',
      'Hanya root boleh TRUE tanpa kondisi.',
    );
    demand(
      node.id === 'root' || !!node.cornerstoneId,
      'INVALID_TREE',
      'Node pengecualian memerlukan cornerstone.',
    );
    if (cases && node.cornerstoneId)
      demand(cases.has(node.cornerstoneId), 'INVALID_TREE', 'Referensi cornerstone hilang.');
    for (const child of [node.trueChild, node.falseChild])
      if (child) {
        demand(map.has(child), 'INVALID_TREE', 'Referensi child hilang.');
        parents.set(child, (parents.get(child) ?? 0) + 1);
      }
  }
  demand(!parents.has('root'), 'INVALID_TREE', 'Root tidak boleh memiliki parent.');
  for (const n of nodes)
    if (n.id !== 'root')
      demand(parents.get(n.id) === 1, 'INVALID_TREE', 'Node harus memiliki tepat satu parent.');
  const visited = new Set<string>();
  const visit = (id: string) => {
    demand(!visited.has(id), 'INVALID_TREE', 'Cycle atau child dipakai berulang.');
    visited.add(id);
    const n = map.get(id)!;
    if (n.trueChild) visit(n.trueChild);
    if (n.falseChild) visit(n.falseChild);
  };
  visit('root');
  demand(visited.size === nodes.length, 'INVALID_TREE', 'Node tidak terjangkau.');
}
export function infer(nodes: RuleNode[], facts: Facts): Inference {
  validateTree(nodes);
  const map = new Map(nodes.map((n) => [n.id, n]));
  let node: RuleNode | undefined = map.get('root');
  let last: RuleNode | undefined;
  const trace: Inference['trace'] = [];
  let terminal: RuleNode | undefined;
  let branch: 'true' | 'false' = 'true';
  while (node) {
    const matched = evaluate(node.condition, facts);
    branch = matched ? 'true' : 'false';
    trace.push({ nodeId: node.id, matched, branch });
    terminal = node;
    if (matched) last = node;
    node = map.get((matched ? node.trueChild : node.falseChild) ?? '');
  }
  demand(last && terminal, 'INVALID_TREE', 'Tidak ada kesimpulan.');
  return {
    conclusion: last.conclusion,
    lastMatchedNode: last.id,
    terminalNode: terminal.id,
    terminalBranch: branch,
    trace,
  };
}
export function appendException(
  nodes: RuleNode[],
  facts: Facts,
  cornerstone: Facts,
  newNode: RuleNode,
): RuleNode[] {
  demand(
    newNode.condition.type !== 'always' && evaluate(newNode.condition, facts),
    'NOT_MATCHING',
    'Kondisi harus benar pada kasus baru.',
  );
  demand(
    !evaluate(newNode.condition, cornerstone),
    'NOT_DISTINGUISHING',
    'Kondisi juga benar pada kasus kunci.',
  );
  const result = infer(nodes, facts);
  const next = structuredClone(nodes);
  const terminal = next.find((n) => n.id === result.terminalNode)!;
  if (result.terminalBranch === 'true') {
    demand(!terminal.trueChild, 'OCCUPIED', 'Cabang kanan sudah terisi.');
    terminal.trueChild = newNode.id;
  } else {
    demand(!terminal.falseChild, 'OCCUPIED', 'Cabang kiri sudah terisi.');
    terminal.falseChild = newNode.id;
  }
  next.push(newNode);
  validateTree(next);
  return next;
}
export function regression(before: RuleNode[], after: RuleNode[], cases: CaseSnapshot[]): string[] {
  return cases
    .filter(
      (c) =>
        JSON.stringify(infer(before, c.facts).conclusion) !==
        JSON.stringify(infer(after, c.facts).conclusion),
    )
    .map((c) => c.id);
}
export function candidates(facts: Facts, cornerstone: Facts): Predicate[] {
  const output: Predicate[] = [];
  for (const [field, meta] of Object.entries(attributes)) {
    const k = field as keyof Facts;
    const value = facts[k];
    const old = cornerstone[k];
    const possible: Predicate[] = [];
    if (value === null) possible.push({ field: k, op: 'is_unknown' });
    else if (meta.kind === 'number' && typeof value === 'number') {
      possible.push({ field: k, op: 'equals', value });
      if (typeof old === 'number' && value > old) possible.push({ field: k, op: 'gte', value });
      if (typeof old === 'number' && value < old) possible.push({ field: k, op: 'lte', value });
    } else if (Array.isArray(value))
      for (const v of value) possible.push({ field: k, op: 'contains', value: v });
    else if (typeof value === 'string') possible.push({ field: k, op: 'equals', value });
    for (const p of possible)
      if (
        evaluate({ type: 'and', terms: [p] }, facts) &&
        !evaluate({ type: 'and', terms: [p] }, cornerstone)
      )
        output.push(p);
  }
  return output;
}
