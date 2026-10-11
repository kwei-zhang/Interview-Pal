import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { definitions } from "../src/lib/problems/definitions";
import { buildHarness, parseHarnessOutput, answersMatch, starterCode, RESULT_MARKER } from "../src/lib/problems/harness";
import { languages, type Language } from "../src/lib/types";
import { referenceSource } from "./reference-solutions";

const directory = mkdtempSync(join(tmpdir(), "interview-pal-tests-"));
function run(source: string, language: Language, name: string) {
  const file = join(directory, `${name}.${language === "python" ? "py" : "js"}`);
  const script = language === "typescript" ? ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS}}).outputText : source;
  writeFileSync(file, script);
  return execFileSync(language === "python" ? "/usr/bin/python3" : process.execPath, [file], {encoding: "utf8", timeout: 4000});
}
before(() => {
  const files = Object.values(definitions).map(def => {
    const path = join(directory, `${def.id}.ts`);
    writeFileSync(path, buildHarness(def, "typescript", referenceSource(def, "typescript"), def.tests) + "\nexport {};\n");
    return path;
  });
  const program = ts.createProgram(files, {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, noEmit: true, strict: false, skipLibCheck: true, types: []});
  const errors = ts.getPreEmitDiagnostics(program);
  assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {getCanonicalFileName: f => f, getCurrentDirectory: () => directory, getNewLine: () => "\n"}));

});
after(() => rmSync(directory, {recursive: true, force: true}));
for (const definition of Object.values(definitions)) {
  for (const language of languages) {
    test(`${definition.id} / ${language}: reference passes and incorrect code fails`, () => {
      const source = referenceSource(definition, language);
      const harness = buildHarness(definition, language, source, definition.tests);
      assert.ok(harness.startsWith(source), "Candidate solution must remain unchanged");
      const output = run(harness, language, `${definition.id}-${language}`);
      const results = parseHarnessOutput(definition, definition.tests, output);
      assert.ok(results.every(r => r.passed), JSON.stringify(results.filter(r => !r.passed)));
      const wrong = run(buildHarness(definition, language, referenceSource(definition, language, true), definition.tests), language, `${definition.id}-${language}-wrong`);
      assert.ok(parseHarnessOutput(definition, definition.tests, wrong).some(r => !r.passed), "Incorrect solution should be rejected");
      assert.ok(starterCode(definition, language).includes(definition.functionName));
    });
  }
}
test("Unordered answers preserve duplicates and accept reordered groups", () => {
  const def = definitions["group-anagrams"], example = def.tests[0];
  assert.equal(answersMatch(def, example, [["won", "now"], ["ate", "tea", "eat"]]), true);
  assert.equal(answersMatch(def, def.tests[3], [["ab", "ba"]]), false);
  assert.equal(answersMatch(definitions["subsets"], definitions["subsets"].tests[0], [[], [2], [5], [2, 5], [2, 5]]), false);
});
test("Two Sum accepts reversed indices but rejects index reuse and invalid types", () => {
  const def = definitions["two-sum"];
  assert.equal(answersMatch(def, def.tests[0], [3, 0]), true);
  assert.equal(answersMatch(def, def.tests[1], [0, 0]), false);
  assert.equal(answersMatch(def, def.tests[0], ["0", "3"]), false);
});
test("Runtime exceptions are reported per case; malformed output is rejected", () => {
  const def = definitions["contains-duplicate"];
  const source = "function containsDuplicate(nums) {throw new Error('boom');}";
  const result = parseHarnessOutput(def, def.tests, run(buildHarness(def, "javascript", source, def.tests), "javascript", "runtime-error"));
  assert.ok(result.every(r => !r.passed && r.error === "boom"));
  assert.throws(() => parseHarnessOutput(def, def.tests, "no result"));
  assert.throws(() => parseHarnessOutput(def, def.tests, RESULT_MARKER + "[]"));
});
test("Linked-list cycles are rejected and empty trees deserialize", () => {
  const def = definitions["reverse-linked-list"];
  const code = referenceSource(def, "javascript").replace(/let previous=null;.*return previous;/, "if(head)head.next=head;return head;");
  const results = parseHarnessOutput(def, def.tests, run(buildHarness(def, "javascript", code, def.tests), "javascript", "cycle"));
  assert.ok(results[0].error?.includes("cycle"));
});
test("Runaway code reaches the local verification timeout", () => {
  const path = join(directory, "timeout.js"); writeFileSync(path, "while(true) {}");
  assert.throws(() => execFileSync(process.execPath, [path], {timeout: 150}), /ETIMEDOUT/);
});
