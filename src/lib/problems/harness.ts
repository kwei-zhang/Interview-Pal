import type { Json, Language, ProblemDefinition, TestCase, TestResult } from "../types";

export const RESULT_MARKER = "__INTERVIEW_PAL_RESULT__";

export function structurePrelude(definition: ProblemDefinition, language: Language): string {
  if (!definition.inputKind) return "";
  const list = definition.inputKind === "linked-list";
  if (language === "python") {
    return list
      ? "class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\n"
      : "class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\n";
  }
  if (language === "typescript") {
    return list
      ? "class ListNode {\n  constructor(public val: number = 0, public next: ListNode | null = null) {}\n}\n\n"
      : "class TreeNode {\n  constructor(public val: number = 0, public left: TreeNode | null = null, public right: TreeNode | null = null) {}\n}\n\n";
  }
  return list
    ? "class ListNode {\n  constructor(val = 0, next = null) { this.val = val; this.next = next; }\n}\n\n"
    : "class TreeNode {\n  constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; }\n}\n\n";
}

export function starterCode(definition: ProblemDefinition, language: Language): string {
  const structure = structurePrelude(definition, language);
  if (language === "python") {
    const params = definition.parameters.map(p => `${p.name}: ${p.py}`).join(", ");
    return `from typing import List, Optional\n\n${structure}def ${definition.functionName}(${params}) -> ${definition.returnType.py}:\n    # Write your solution here.\n    pass\n`;
  }
  const params = definition.parameters.map(p => language === "typescript" ? `${p.name}: ${p.ts}` : p.name).join(", ");
  return `${structure}function ${definition.functionName}(${params})${language === "typescript" ? `: ${definition.returnType.ts}` : ""} {\n  // Write your solution here.\n  throw new Error("Not implemented");\n}\n`;
}

// Append the harness to the original source. Candidate code is never rewritten.
// Results are compared on the server, outside the submitted program.
export function buildHarness(definition: ProblemDefinition, language: Language, source: string, cases: TestCase[]): string {
  const serialized = JSON.stringify(cases.map(t => t.args));
  if (language === "python") {
    const converter = definition.inputKind === "linked-list" ? `
def __ip_list(values):
    head = None
    for value in reversed(values):
        head = ListNode(value, head)
    return head

def __ip_serialize(node):
    result, seen = [], set()
    while node is not None:
        if not isinstance(node, ListNode):
            raise TypeError("Return a ListNode or None")
        if id(node) in seen or len(result) > 10000:
            raise ValueError("Returned list contains a cycle or too many nodes")
        seen.add(id(node))
        result.append(node.val)
        node = node.next
    return result
` : definition.inputKind === "binary-tree" ? `
def __ip_tree(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue, index = [root], 1
    for node in queue:
        if index < len(values):
            if values[index] is not None:
                node.left = TreeNode(values[index])
                queue.append(node.left)
            index += 1
        if index < len(values):
            if values[index] is not None:
                node.right = TreeNode(values[index])
                queue.append(node.right)
            index += 1
    return root
` : "";
    const input = definition.inputKind === "linked-list" ? "__ip_args[0] = __ip_list(__ip_args[0])" : definition.inputKind === "binary-tree" ? "__ip_args[0] = __ip_tree(__ip_args[0])" : "pass";
    const output = definition.inputKind === "linked-list" ? "__ip_serialize(__ip_actual)" : "__ip_actual";
    return `${source}\n\n# Interview Pal test harness\nimport json as __ip_json\n${converter}\n__ip_cases = __ip_json.loads(${JSON.stringify(serialized)})\n__ip_results = []\nfor __ip_args in __ip_cases:\n    try:\n        ${input}\n        __ip_actual = ${definition.functionName}(*__ip_args)\n        __ip_results.append({"actual": ${output}})\n    except Exception as __ip_error:\n        __ip_results.append({"error": str(__ip_error)[:500]})\nprint("${RESULT_MARKER}" + __ip_json.dumps(__ip_results, allow_nan=False))\n`;
  }
  const ts = language === "typescript";
  const any = ts ? ": any" : "";
  const converter = definition.inputKind === "linked-list" ? `
function __ip_list(values${any})${any} {
  let head${any} = null;
  for (let i = values.length - 1; i >= 0; i--) head = new ListNode(values[i], head);
  return head;
}
function __ip_serialize(node${any})${any} {
  const result${any} = [], seen = new Set();
  while (node !== null && node !== undefined) {
    if (!(node instanceof ListNode)) throw new Error("Return a ListNode or null");
    if (seen.has(node) || result.length > 10000) throw new Error("Returned list contains a cycle or too many nodes");
    seen.add(node); result.push(node.val); node = node.next;
  }
  return result;
}
` : definition.inputKind === "binary-tree" ? `
function __ip_tree(values${any})${any} {
  if (!values.length || values[0] === null) return null;
  const root = new TreeNode(values[0]), queue = [root];
  let index = 1;
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    if (index < values.length) { if (values[index] !== null) { node.left = new TreeNode(values[index]); queue.push(node.left); } index++; }
    if (index < values.length) { if (values[index] !== null) { node.right = new TreeNode(values[index]); queue.push(node.right); } index++; }
  }
  return root;
}
` : "";
  const input = definition.inputKind === "linked-list" ? "__ip_args[0] = __ip_list(__ip_args[0]);" : definition.inputKind === "binary-tree" ? "__ip_args[0] = __ip_tree(__ip_args[0]);" : "";
  const output = definition.inputKind === "linked-list" ? "__ip_serialize(__ip_actual)" : "(__ip_actual === undefined ? null : __ip_actual)";
  // JSON parsing prevents TypeScript from inferring incompatible tuples.
  return `${source}\n\n// Interview Pal test harness\n${converter}\nconst __ip_cases${any} = JSON.parse(${JSON.stringify(serialized)});\nconst __ip_results${any} = [];\nfor (const __ip_args of __ip_cases) {\n  try {\n    ${input}\n    const __ip_actual = (${definition.functionName}${ts ? " as any" : ""})(...__ip_args);\n    __ip_results.push({ actual: ${output} });\n  } catch (__ip_error) {\n    __ip_results.push({ error: String(__ip_error.message || __ip_error).slice(0, 500) });\n  }\n}\nconsole.log("${RESULT_MARKER}" + JSON.stringify(__ip_results));\n`;
}

function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function groups(value: Json): string | null {
  if (!Array.isArray(value) || !value.every(Array.isArray)) return null;
  return JSON.stringify(value.map(group => (group as Json[]).map(canonical).sort()).map(group => JSON.stringify(group)).sort());
}
export function answersMatch(definition: ProblemDefinition, test: TestCase, actual: Json): boolean {
  if (definition.comparison === "two-sum") {
    if (!Array.isArray(actual) || actual.length !== 2 || !actual.every(v => typeof v === "number" && Number.isInteger(v))) return false;
    const [i, j] = actual as number[], nums = test.args[0] as number[];
    return i !== j && i >= 0 && j >= 0 && i < nums.length && j < nums.length && nums[i] + nums[j] === test.args[1];
  }
  if (definition.comparison === "unordered-groups") {
    const a = groups(actual), b = groups(test.expected);
    return a !== null && b !== null && a === b;
  }
  if (definition.comparison === "unordered-items") {
    return Array.isArray(actual) && Array.isArray(test.expected) && JSON.stringify(actual.map(canonical).sort()) === JSON.stringify(test.expected.map(canonical).sort());
  }
  return canonical(actual) === canonical(test.expected);
}
export function parseHarnessOutput(definition: ProblemDefinition, cases: TestCase[], stdout: string): TestResult[] {
  const markerIndex = stdout.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) throw new Error("The runner did not return test results. Check the program output and errors.");
  const raw: unknown = JSON.parse(stdout.slice(markerIndex + RESULT_MARKER.length).split("\n")[0]);
  if (!Array.isArray(raw) || raw.length !== cases.length) throw new Error("The runner returned incomplete test results.");
  return cases.map((test, index) => {
    const item = raw[index];
    if (!item || typeof item !== "object") throw new Error("Invalid test result.");
    if ("error" in item) return {name: test.name, passed: false, expected: test.expected, error: String(item.error).slice(0, 500)};
    const actual: Json = item.actual === undefined ? null : item.actual;
    return {name: test.name, passed: answersMatch(definition, test, actual), actual, expected: test.expected};
  });
}
