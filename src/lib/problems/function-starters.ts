import type { Language, ProblemDefinition } from "../types";

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

