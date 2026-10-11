import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Script } from "node:vm";
import ts from "typescript";
import { problems } from "../src/lib/data/catalog";
import { definitions } from "../src/lib/problems/definitions";
import { interviewQuestion } from "../src/lib/problems/interview-questions";
import { codeWithStarter, starterContracts } from "../src/lib/problems/starters";

test("Every additional question has a complete function or class contract", () => {
  assert.deepEqual(Object.keys(starterContracts).sort(), problems.filter(p => !definitions[p.id]).map(p => p.id).sort());
  for (const [id, contract] of Object.entries(starterContracts)) {
    const starters = interviewQuestion(id)!.starters;
    for (const source of Object.values(starters)) assert.ok(source.includes(contract.name), id);
    if (contract.kind === "class") {
      assert.ok(contract.methods.length > 0, id);
      for (const m of contract.methods) {
        assert.ok(starters.python.includes(`def ${m.name}(`), id);
        for (const lang of ["javascript", "typescript"] as const) assert.ok(starters[lang].includes(`  ${m.name}(`), id);
      }
    }
  }
});

test("All 450 starters have valid Python, JavaScript, and strictly typed TypeScript declarations", () => {
  const questions = problems.map(p => interviewQuestion(p.id)!);
  const python = spawnSync("python3", ["-c", "import json,sys\nfor item in json.load(sys.stdin):\n    exec(compile(item['source'], item['id'], 'exec'), {})\n"], {input: JSON.stringify(questions.map(q => ({id: q.id, source: q.starters.python}))), encoding: "utf8"});
  assert.equal(python.status, 0, python.stderr || String(python.error));
  for (const q of questions) assert.doesNotThrow(() => new Script(q.starters.javascript, {filename: q.id}), q.id);
  // Isolate each question as its own module; declarations are never executed.
  const sources = new Map(questions.map(q => [`/virtual/${q.id}.ts`, `export {};\n${q.starters.typescript}`]));
  const options: ts.CompilerOptions = {noEmit: true, strict: true, target: ts.ScriptTarget.ES2020, lib: ["lib.es2020.d.ts"], types: []};
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (file, version, onError, fresh) => sources.has(file) ? ts.createSourceFile(file, sources.get(file)!, version) : original(file, version, onError, fresh);
  const program = ts.createProgram([...sources.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {getCurrentDirectory: () => process.cwd(), getCanonicalFileName: f => f, getNewLine: () => "\n"}));
});

test("Structural and mutating tasks expose their required node types and return contracts", () => {
  const starter = (id: string) => interviewQuestion(id)!.starters;
  assert.match(starter("merge-k-sorted-lists").python, /lists: List\[Optional\[ListNode\]\]/);
  assert.match(starter("reorder-list").typescript, /function reorderList\(head: ListNode \| null\): void/);
  assert.match(starter("copy-list-with-random-pointer").typescript, /public random: Node \| null = null/);
  assert.match(starter("clone-graph").typescript, /public neighbors: Node\[\] = \[\]/);
  assert.match(starter("serialize-and-deserialize-binary-tree").python, /def deserialize\(self, data: str\) -> Optional\[TreeNode\]/);
  assert.match(starter("lru-cache").python, /def __init__\(self, capacity: int\)/);
  assert.match(starter("median-of-two-sorted-arrays").python, /-> float:/);
  assert.match(starter("surrounded-regions").typescript, /board: string\[\]\[\]\): void/);
});

test("Legacy placeholders upgrade without replacing empty or edited drafts", () => {
  for (const lang of ["python", "javascript", "typescript"] as const) {
    const starter = interviewQuestion("lru-cache")!.starters[lang];
    const placeholder = lang === "python" ? "# Write or paste your Python solution here.\n" : `// Write or paste your ${lang === "javascript" ? "JavaScript" : "TypeScript"} solution here.\n`;
    assert.equal(codeWithStarter(undefined, starter, lang), starter);
    assert.equal(codeWithStarter(placeholder, starter, lang), starter);
    assert.equal(codeWithStarter("", starter, lang), "");
    assert.equal(codeWithStarter(`${placeholder}candidate work`, starter, lang), `${placeholder}candidate work`);
  }
});
