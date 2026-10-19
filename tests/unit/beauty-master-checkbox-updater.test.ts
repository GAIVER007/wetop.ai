import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import ts from 'typescript';

const repo = process.env.MASTER_CHECKBOX_REPO || process.cwd();
const path = 'apps/web/src/app/beauty/masters/board.tsx';
const sha = process.env.PINNED_MASTER_CHECKBOX_SHA;
if (sha && !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Expected immutable Git SHA');
const source = sha
  ? execFileSync('git', ['show', `${sha}:${path}`], { cwd: repo, encoding: 'utf8' })
  : readFileSync(resolve(repo, path), 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks: string[] = [];
function visit(node: ts.Node) {
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onChange' &&
    node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
    const text = node.initializer.expression.getText(ast);
    if (text.includes('setSelected')) callbacks.push(text);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (callbacks.length !== 1) throw new Error(`Expected exact existing services selection handler, found ${callbacks.length}`);
type Update = (previous: string[]) => string[];
function handler(id: string, queued: Update[]) {
  const js = ts.transpileModule(`const change = ${callbacks[0]};\nchange;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Script(js).runInNewContext({ service: { id }, setSelected: (update: Update) => queued.push(update) }) as
    (event: { target: { checked: boolean }; currentTarget: { checked: boolean } }) => void;
}
// Execute the ACTUAL source callback, explicitly queue the state updater, then simulate
// controlled DOM restoration. This proves callback purity, not React scheduling order.
describe('Master service selection retains event-time checked state', () => {
  it('keeps checking after the DOM is restored before the queued updater runs', () => {
    const queued: Update[] = []; const input = { checked: true };
    handler('service', queued)({ target: input, currentTarget: input });
    input.checked = false;
    expect(queued.reduce((state, update) => update(state), ['other'])).toEqual(['other', 'service']);
  });
  it('keeps unchecking without duplicating a previously selected service', () => {
    const queued: Update[] = []; const input = { checked: false };
    handler('service', queued)({ target: input, currentTarget: input });
    input.checked = true;
    expect(queued.reduce((state, update) => update(state), ['other', 'service'])).toEqual(['other']);
  });
  it('composes two queued service selections without losing existing selection', () => {
    const queued: Update[] = []; const first = { checked: true }; const second = { checked: true };
    handler('one', queued)({ target: first, currentTarget: first });
    handler('two', queued)({ target: second, currentTarget: second });
    first.checked = second.checked = false;
    expect(queued.reduce((state, update) => update(state), ['existing'])).toEqual(['existing', 'one', 'two']);
  });
});
