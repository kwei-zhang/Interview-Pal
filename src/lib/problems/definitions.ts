import type { ProblemDefinition } from "../types";

const p = (name: string, py: string, ts: string) => ({name, py, ts});

// Prompts and public examples are authored for Interview Pal.
// Judging is performed by the agent; no fixed test suites are bundled.
export const definitions: Record<string, ProblemDefinition> = {
  "contains-duplicate": {
    id: "contains-duplicate", version: 1, functionName: "containsDuplicate",
    prompt: "Given a list of integers, return true if any value appears more than once. Return false if every value is distinct. The input may be empty.",
    constraints: ["0 ≤ number of elements ≤ 100,000", "Elements are integers between −1,000,000,000 and 1,000,000,000"],
    parameters: [p("nums", "List[int]", "number[]")], returnType: {py: "bool", ts: "boolean"},
    examples: [
      {name: "Repeated value", args: [[4, 2, 4]], expected: true},
      {name: "Distinct values", args: [[3, 7, 9]], expected: false},
    ],
  },
  "valid-anagram": {
    id: "valid-anagram", version: 1, functionName: "isAnagram",
    prompt: "Return whether two lowercase English strings contain exactly the same characters with the same frequencies. Character order does not matter; empty strings are allowed.",
    constraints: ["0 ≤ string length ≤ 50,000", "Only lowercase English letters"],
    parameters: [p("s", "str", "string"), p("t", "str", "string")], returnType: {py: "bool", ts: "boolean"},
    examples: [
      {name: "Same letters", args: ["listen", "silent"], expected: true},
      {name: "Different frequencies", args: ["aab", "abb"], expected: false},
    ],
  },
  "two-sum": {
    id: "two-sum", version: 1, functionName: "twoSum",
    prompt: "Find two different indices whose values add up to target. Exactly one pair exists. Return the indices in either order, and do not use an element twice.",
    constraints: ["2 ≤ number of elements ≤ 10,000", "Exactly one valid pair exists"],
    parameters: [p("nums", "List[int]", "number[]"), p("target", "int", "number")], returnType: {py: "List[int]", ts: "number[]"},
    examples: [
      {name: "First and last", args: [[8, 2, 6, 5], 13], expected: [0, 3]},
      {name: "Same value, different indices", args: [[4, 4], 8], expected: [0, 1]},
    ],
  },
  "group-anagrams": {
    id: "group-anagrams", version: 1, functionName: "groupAnagrams",
    prompt: "Group a list of lowercase English words so that each group contains words made of the same letters with the same frequencies. Both the order of groups and the order within a group may vary. Preserve repeated words.",
    constraints: ["0 ≤ number of words ≤ 10,000", "A word can be empty"],
    parameters: [p("strs", "List[str]", "string[]")], returnType: {py: "List[List[str]]", ts: "string[][]"},
    examples: [
      {name: "Multiple groups", args: [["eat", "tea", "now", "won", "ate"]], expected: [["eat", "tea", "ate"], ["now", "won"]]},
      {name: "Empty word", args: [[""]], expected: [[""]]},
    ],
  },
  "valid-palindrome": {
    id: "valid-palindrome", version: 1, functionName: "isPalindrome",
    prompt: "Ignore characters other than ASCII letters and digits, and compare letters without case. Return whether the remaining sequence reads the same forwards and backwards. An empty remaining sequence is a palindrome.",
    constraints: ["0 ≤ string length ≤ 200,000", "Input contains ASCII characters"],
    parameters: [p("s", "str", "string")], returnType: {py: "bool", ts: "boolean"},
    examples: [
      {name: "Punctuation and case", args: ["Was it a car or a cat I saw?"], expected: true},
      {name: "Not symmetric", args: ["software"], expected: false},
    ],
  },
  "3sum": {
    id: "3sum", version: 1, functionName: "threeSum",
    prompt: "Return all distinct triplets of values that sum to zero. Each triplet must use three different positions in the input. The order of triplets and values within each triplet is unrestricted, but duplicate triplets are not allowed.",
    constraints: ["0 ≤ number of elements ≤ 3,000", "Elements are integers between −100,000 and 100,000"],
    parameters: [p("nums", "List[int]", "number[]")], returnType: {py: "List[List[int]]", ts: "number[][]"},
    examples: [
      {name: "Two distinct triplets", args: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]]},
      {name: "All zeros", args: [[0, 0, 0, 0]], expected: [[0, 0, 0]]},
    ],
  },
  "best-time-to-buy-and-sell-stock": {
    id: "best-time-to-buy-and-sell-stock", version: 1, functionName: "maxProfit",
    prompt: "A list gives the stock price on each day. Choose at most one buy and one later sell to maximize profit. Return zero if no profitable trade exists.",
    constraints: ["0 ≤ number of prices ≤ 100,000", "Prices are nonnegative integers"],
    parameters: [p("prices", "List[int]", "number[]")], returnType: {py: "int", ts: "number"},
    examples: [
      {name: "Buy before selling", args: [[8, 3, 6, 2, 9]], expected: 7},
      {name: "Prices decline", args: [[9, 7, 4, 1]], expected: 0},
    ],
  },
  "longest-substring-without-repeating-characters": {
    id: "longest-substring-without-repeating-characters", version: 1, functionName: "lengthOfLongestSubstring",
    prompt: "Return the length of the longest contiguous substring with no repeated character. Spaces and punctuation count as characters.",
    constraints: ["0 ≤ string length ≤ 50,000", "Input contains ASCII characters"],
    parameters: [p("s", "str", "string")], returnType: {py: "int", ts: "number"},
    examples: [
      {name: "Repeated pattern", args: ["abcabc"], expected: 3},
      {name: "All repeated", args: ["zzzz"], expected: 1},
    ],
  },
  "valid-parentheses": {
    id: "valid-parentheses", version: 1, functionName: "isValid",
    prompt: "A string contains only parentheses, square brackets, and braces. Return whether every opening bracket is closed by a matching bracket in the correct nested order. The empty string is valid.",
    constraints: ["0 ≤ string length ≤ 10,000", "Characters are from ()[]{}"],
    parameters: [p("s", "str", "string")], returnType: {py: "bool", ts: "boolean"},
    examples: [
      {name: "Nested brackets", args: ["{[()]}"], expected: true},
      {name: "Crossed brackets", args: ["([)]"], expected: false},
    ],
  },
  "binary-search": {
    id: "binary-search", version: 1, functionName: "search",
    prompt: "Given integers sorted in strictly increasing order, return the index of target or −1 if it is missing. Aim for logarithmic time.",
    constraints: ["0 ≤ number of elements ≤ 10,000", "All elements are distinct and sorted"],
    parameters: [p("nums", "List[int]", "number[]"), p("target", "int", "number")], returnType: {py: "int", ts: "number"},
    examples: [
      {name: "Found in the middle", args: [[-3, 0, 4, 8, 12], 8], expected: 3},
      {name: "Missing target", args: [[1, 3, 5], 4], expected: -1},
    ],
  },
  "reverse-linked-list": {
    id: "reverse-linked-list", version: 1, functionName: "reverseList", inputKind: "linked-list",
    prompt: "Reverse a singly linked list and return its new head. The starter supplies ListNode with val and next fields. Public examples represent linked lists as arrays of values; an empty array represents a null head.",
    constraints: ["0 ≤ number of nodes ≤ 5,000", "Return a ListNode or null, not an array"],
    parameters: [p("head", "Optional[ListNode]", "ListNode | null")], returnType: {py: "Optional[ListNode]", ts: "ListNode | null"},
    examples: [
      {name: "Several nodes", args: [[3, 5, 8]], expected: [8, 5, 3]},
      {name: "Single node", args: [[7]], expected: [7]},
    ],
  },
  "maximum-depth-of-binary-tree": {
    id: "maximum-depth-of-binary-tree", version: 1, functionName: "maxDepth", inputKind: "binary-tree",
    prompt: "Return the number of nodes along the longest root-to-leaf path in a binary tree. The starter supplies TreeNode with val, left, and right fields. Inputs use level-order arrays where null marks a missing child. An empty array represents an empty tree.",
    constraints: ["0 ≤ number of nodes ≤ 10,000", "The depth of an empty tree is zero"],
    parameters: [p("root", "Optional[TreeNode]", "TreeNode | null")], returnType: {py: "int", ts: "number"},
    examples: [
      {name: "Balanced tree", args: [[4, 2, 7, 1, 3]], expected: 3},
      {name: "Empty tree", args: [[]], expected: 0},
    ],
  },
  "subsets": {
    id: "subsets", version: 1, functionName: "subsets",
    prompt: "Return every subset of a list of distinct integers, including the empty subset and the full list. Each subset must occur exactly once. Subset order and the order of elements within a subset do not matter.",
    constraints: ["0 ≤ number of elements ≤ 10", "All input elements are distinct"],
    parameters: [p("nums", "List[int]", "number[]")], returnType: {py: "List[List[int]]", ts: "number[][]"},
    examples: [
      {name: "Two elements", args: [[2, 5]], expected: [[], [2], [5], [2, 5]]},
      {name: "Empty list", args: [[]], expected: [[]]},
    ],
  },
  "number-of-islands": {
    id: "number-of-islands", version: 1, functionName: "numIslands",
    prompt: "A rectangular grid contains strings '1' for land and '0' for water. Count connected groups of land. Cells connect horizontally and vertically, but not diagonally. An empty grid contains zero islands.",
    constraints: ["0 ≤ rows, columns ≤ 300", "All rows have equal length"],
    parameters: [p("grid", "List[List[str]]", "string[][]")], returnType: {py: "int", ts: "number"},
    examples: [
      {name: "Separate groups", args: [[["1", "1", "0"], ["0", "0", "1"], ["1", "0", "1"]]], expected: 3},
      {name: "All water", args: [[["0", "0"], ["0", "0"]]], expected: 0},
    ],
  },
  "climbing-stairs": {
    id: "climbing-stairs", version: 1, functionName: "climbStairs",
    prompt: "You can climb either one or two stairs per move. Return the number of different sequences of moves that reach exactly n stairs. For zero stairs, there is one sequence: take no moves.",
    constraints: ["0 ≤ n ≤ 45", "Different move orders count separately"],
    parameters: [p("n", "int", "number")], returnType: {py: "int", ts: "number"},
    examples: [
      {name: "Three stairs", args: [3], expected: 3},
      {name: "Four stairs", args: [4], expected: 5},
    ],
  },
};
