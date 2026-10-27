import type { Language } from "../types";

type ValueType = "int" | "float" | "bool" | "str" | "void" | "ints" | "floats" | "matrix" | "strings" | "stringMatrix" | "list" | "lists" | "tree" | "randomNode" | "graphNode" | "nextNode" | "quadNode";
type Parameter = readonly [name: string, type: ValueType];
interface Method { name: string; parameters: readonly Parameter[]; returns: ValueType }
export type StarterContract =
  | ({ kind: "function" } & Method)
  | { kind: "class"; name: string; parameters: readonly Parameter[]; methods: readonly Method[] };

const fn = (name: string, parameters: readonly Parameter[], returns: ValueType): StarterContract => ({kind: "function", name, parameters, returns});
const method = (name: string, parameters: readonly Parameter[], returns: ValueType): Method => ({name, parameters, returns});
const cls = (name: string, parameters: readonly Parameter[], methods: readonly Method[]): StarterContract => ({kind: "class", name, parameters, methods});

// Task interfaces only: no implementation, selected data structure, or algorithm hint.
export const starterContracts: Record<string, StarterContract> = {
  "merge-sorted-array": fn("merge", [["nums1", "ints"], ["m", "int"], ["nums2", "ints"], ["n", "int"]], "void"),
  "remove-element": fn("removeElement", [["nums", "ints"], ["val", "int"]], "int"),
  "remove-duplicates-from-sorted-array": fn("removeDuplicates", [["nums", "ints"]], "int"),
  "remove-duplicates-from-sorted-array-ii": fn("removeDuplicates", [["nums", "ints"]], "int"),
  "majority-element": fn("majorityElement", [["nums", "ints"]], "int"),
  "rotate-array": fn("rotate", [["nums", "ints"], ["k", "int"]], "void"),
  "best-time-to-buy-and-sell-stock-ii": fn("maxProfit", [["prices", "ints"]], "int"),
  "h-index": fn("hIndex", [["citations", "ints"]], "int"),
  "insert-delete-getrandom-o1": cls("RandomizedSet", [], [method("insert", [["val", "int"]], "bool"), method("remove", [["val", "int"]], "bool"), method("getRandom", [], "int")]),
  "candy": fn("candy", [["ratings", "ints"]], "int"),
  "roman-to-integer": fn("romanToInt", [["s", "str"]], "int"),
  "integer-to-roman": fn("intToRoman", [["num", "int"]], "str"),
  "length-of-last-word": fn("lengthOfLastWord", [["s", "str"]], "int"),
  "longest-common-prefix": fn("longestCommonPrefix", [["strs", "strings"]], "str"),
  "reverse-words-in-a-string": fn("reverseWords", [["s", "str"]], "str"),
  "zigzag-conversion": fn("convert", [["s", "str"], ["numRows", "int"]], "str"),
  "find-the-index-of-the-first-occurrence-in-a-string": fn("strStr", [["haystack", "str"], ["needle", "str"]], "int"),
  "text-justification": fn("fullJustify", [["words", "strings"], ["maxWidth", "int"]], "strings"),
  "is-subsequence": fn("isSubsequence", [["s", "str"], ["t", "str"]], "bool"),
  "minimum-size-subarray-sum": fn("minSubArrayLen", [["target", "int"], ["nums", "ints"]], "int"),
  "substring-with-concatenation-of-all-words": fn("findSubstring", [["s", "str"], ["words", "strings"]], "ints"),
  "game-of-life": fn("gameOfLife", [["board", "matrix"]], "void"),
  "ransom-note": fn("canConstruct", [["ransomNote", "str"], ["magazine", "str"]], "bool"),
  "isomorphic-strings": fn("isIsomorphic", [["s", "str"], ["t", "str"]], "bool"),
  "word-pattern": fn("wordPattern", [["pattern", "str"], ["s", "str"]], "bool"),
  "contains-duplicate-ii": fn("containsNearbyDuplicate", [["nums", "ints"], ["k", "int"]], "bool"),
  "summary-ranges": fn("summaryRanges", [["nums", "ints"]], "strings"),
  "minimum-number-of-arrows-to-burst-balloons": fn("findMinArrowShots", [["points", "matrix"]], "int"),
  "simplify-path": fn("simplifyPath", [["path", "str"]], "str"),
  "basic-calculator": fn("calculate", [["s", "str"]], "int"),
  "reverse-linked-list-ii": fn("reverseBetween", [["head", "list"], ["left", "int"], ["right", "int"]], "list"),
  "remove-duplicates-from-sorted-list-ii": fn("deleteDuplicates", [["head", "list"]], "list"),
  "rotate-list": fn("rotateRight", [["head", "list"], ["k", "int"]], "list"),
  "partition-list": fn("partition", [["head", "list"], ["x", "int"]], "list"),
  "symmetric-tree": fn("isSymmetric", [["root", "tree"]], "bool"),
  "construct-binary-tree-from-inorder-and-postorder-traversal": fn("buildTree", [["inorder", "ints"], ["postorder", "ints"]], "tree"),
  "populating-next-right-pointers-in-each-node-ii": fn("connect", [["root", "nextNode"]], "nextNode"),
  "flatten-binary-tree-to-linked-list": fn("flatten", [["root", "tree"]], "void"),
  "path-sum": fn("hasPathSum", [["root", "tree"], ["targetSum", "int"]], "bool"),
  "sum-root-to-leaf-numbers": fn("sumNumbers", [["root", "tree"]], "int"),
  "binary-search-tree-iterator": cls("BSTIterator", [["root", "tree"]], [method("next", [], "int"), method("hasNext", [], "bool")]),
  "count-complete-tree-nodes": fn("countNodes", [["root", "tree"]], "int"),
  "lowest-common-ancestor-of-a-binary-tree": fn("lowestCommonAncestor", [["root", "tree"], ["p", "tree"], ["q", "tree"]], "tree"),
  "average-of-levels-in-binary-tree": fn("averageOfLevels", [["root", "tree"]], "floats"),
  "binary-tree-zigzag-level-order-traversal": fn("zigzagLevelOrder", [["root", "tree"]], "matrix"),
  "minimum-absolute-difference-in-bst": fn("getMinimumDifference", [["root", "tree"]], "int"),
  "evaluate-division": fn("calcEquation", [["equations", "stringMatrix"], ["values", "floats"], ["queries", "stringMatrix"]], "floats"),
  "snakes-and-ladders": fn("snakesAndLadders", [["board", "matrix"]], "int"),
  "minimum-genetic-mutation": fn("minMutation", [["startGene", "str"], ["endGene", "str"], ["bank", "strings"]], "int"),
  "combinations": fn("combine", [["n", "int"], ["k", "int"]], "matrix"),
  "n-queens-ii": fn("totalNQueens", [["n", "int"]], "int"),
  "convert-sorted-array-to-binary-search-tree": fn("sortedArrayToBST", [["nums", "ints"]], "tree"),
  "sort-list": fn("sortList", [["head", "list"]], "list"),
  "construct-quad-tree": fn("construct", [["grid", "matrix"]], "quadNode"),
  "maximum-sum-circular-subarray": fn("maxSubarraySumCircular", [["nums", "ints"]], "int"),
  "search-insert-position": fn("searchInsert", [["nums", "ints"], ["target", "int"]], "int"),
  "find-peak-element": fn("findPeakElement", [["nums", "ints"]], "int"),
  "find-first-and-last-position-of-element-in-sorted-array": fn("searchRange", [["nums", "ints"], ["target", "int"]], "ints"),
  "ipo": fn("findMaximizedCapital", [["k", "int"], ["w", "int"], ["profits", "ints"], ["capital", "ints"]], "int"),
  "find-k-pairs-with-smallest-sums": fn("kSmallestPairs", [["nums1", "ints"], ["nums2", "ints"], ["k", "int"]], "matrix"),
  "add-binary": fn("addBinary", [["a", "str"], ["b", "str"]], "str"),
  "single-number-ii": fn("singleNumber", [["nums", "ints"]], "int"),
  "bitwise-and-of-numbers-range": fn("rangeBitwiseAnd", [["left", "int"], ["right", "int"]], "int"),
  "palindrome-number": fn("isPalindrome", [["x", "int"]], "bool"),
  "factorial-trailing-zeroes": fn("trailingZeroes", [["n", "int"]], "int"),
  "sqrtx": fn("mySqrt", [["x", "int"]], "int"),
  "max-points-on-a-line": fn("maxPoints", [["points", "matrix"]], "int"),
  "triangle": fn("minimumTotal", [["triangle", "matrix"]], "int"),
  "minimum-path-sum": fn("minPathSum", [["grid", "matrix"]], "int"),
  "unique-paths-ii": fn("uniquePathsWithObstacles", [["obstacleGrid", "matrix"]], "int"),
  "best-time-to-buy-and-sell-stock-iii": fn("maxProfit", [["prices", "ints"]], "int"),
  "best-time-to-buy-and-sell-stock-iv": fn("maxProfit", [["k", "int"], ["prices", "ints"]], "int"),
  "maximal-square": fn("maximalSquare", [["matrix", "stringMatrix"]], "int"),
  "top-k-frequent-elements": fn("topKFrequent", [["nums", "ints"], ["k", "int"]], "ints"),
  "product-of-array-except-self": fn("productExceptSelf", [["nums", "ints"]], "ints"),
  "valid-sudoku": fn("isValidSudoku", [["board", "stringMatrix"]], "bool"),
  "encode-and-decode-strings": cls("Codec", [], [method("encode", [["strs", "strings"]], "str"), method("decode", [["s", "str"]], "strings")]),
  "longest-consecutive-sequence": fn("longestConsecutive", [["nums", "ints"]], "int"),
  "two-sum-ii-input-array-is-sorted": fn("twoSum", [["numbers", "ints"], ["target", "int"]], "ints"),
  "container-with-most-water": fn("maxArea", [["height", "ints"]], "int"),
  "trapping-rain-water": fn("trap", [["height", "ints"]], "int"),
  "longest-repeating-character-replacement": fn("characterReplacement", [["s", "str"], ["k", "int"]], "int"),
  "permutation-in-string": fn("checkInclusion", [["s1", "str"], ["s2", "str"]], "bool"),
  "minimum-window-substring": fn("minWindow", [["s", "str"], ["t", "str"]], "str"),
  "sliding-window-maximum": fn("maxSlidingWindow", [["nums", "ints"], ["k", "int"]], "ints"),
  "min-stack": cls("MinStack", [], [method("push", [["val", "int"]], "void"), method("pop", [], "void"), method("top", [], "int"), method("getMin", [], "int")]),
  "evaluate-reverse-polish-notation": fn("evalRPN", [["tokens", "strings"]], "int"),
  "generate-parentheses": fn("generateParenthesis", [["n", "int"]], "strings"),
  "daily-temperatures": fn("dailyTemperatures", [["temperatures", "ints"]], "ints"),
  "car-fleet": fn("carFleet", [["target", "int"], ["position", "ints"], ["speed", "ints"]], "int"),
  "largest-rectangle-in-histogram": fn("largestRectangleArea", [["heights", "ints"]], "int"),
  "search-a-2d-matrix": fn("searchMatrix", [["matrix", "matrix"], ["target", "int"]], "bool"),
  "koko-eating-bananas": fn("minEatingSpeed", [["piles", "ints"], ["h", "int"]], "int"),
  "find-minimum-in-rotated-sorted-array": fn("findMin", [["nums", "ints"]], "int"),
  "search-in-rotated-sorted-array": fn("search", [["nums", "ints"], ["target", "int"]], "int"),
  "time-based-key-value-store": cls("TimeMap", [], [method("set", [["key", "str"], ["value", "str"], ["timestamp", "int"]], "void"), method("get", [["key", "str"], ["timestamp", "int"]], "str")]),
  "median-of-two-sorted-arrays": fn("findMedianSortedArrays", [["nums1", "ints"], ["nums2", "ints"]], "float"),
  "merge-two-sorted-lists": fn("mergeTwoLists", [["list1", "list"], ["list2", "list"]], "list"),
  "reorder-list": fn("reorderList", [["head", "list"]], "void"),
  "remove-nth-node-from-end-of-list": fn("removeNthFromEnd", [["head", "list"], ["n", "int"]], "list"),
  "copy-list-with-random-pointer": fn("copyRandomList", [["head", "randomNode"]], "randomNode"),
  "add-two-numbers": fn("addTwoNumbers", [["l1", "list"], ["l2", "list"]], "list"),
  "linked-list-cycle": fn("hasCycle", [["head", "list"]], "bool"),
  "find-the-duplicate-number": fn("findDuplicate", [["nums", "ints"]], "int"),
  "lru-cache": cls("LRUCache", [["capacity", "int"]], [method("get", [["key", "int"]], "int"), method("put", [["key", "int"], ["value", "int"]], "void")]),
  "merge-k-sorted-lists": fn("mergeKLists", [["lists", "lists"]], "list"),
  "reverse-nodes-in-k-group": fn("reverseKGroup", [["head", "list"], ["k", "int"]], "list"),
  "invert-binary-tree": fn("invertTree", [["root", "tree"]], "tree"),
  "diameter-of-binary-tree": fn("diameterOfBinaryTree", [["root", "tree"]], "int"),
  "balanced-binary-tree": fn("isBalanced", [["root", "tree"]], "bool"),
  "same-tree": fn("isSameTree", [["p", "tree"], ["q", "tree"]], "bool"),
  "subtree-of-another-tree": fn("isSubtree", [["root", "tree"], ["subRoot", "tree"]], "bool"),
  "lowest-common-ancestor-of-a-binary-search-tree": fn("lowestCommonAncestor", [["root", "tree"], ["p", "tree"], ["q", "tree"]], "tree"),
  "binary-tree-level-order-traversal": fn("levelOrder", [["root", "tree"]], "matrix"),
  "binary-tree-right-side-view": fn("rightSideView", [["root", "tree"]], "ints"),
  "count-good-nodes-in-binary-tree": fn("goodNodes", [["root", "tree"]], "int"),
  "validate-binary-search-tree": fn("isValidBST", [["root", "tree"]], "bool"),
  "kth-smallest-element-in-a-bst": fn("kthSmallest", [["root", "tree"], ["k", "int"]], "int"),
  "construct-binary-tree-from-preorder-and-inorder-traversal": fn("buildTree", [["preorder", "ints"], ["inorder", "ints"]], "tree"),
  "binary-tree-maximum-path-sum": fn("maxPathSum", [["root", "tree"]], "int"),
  "serialize-and-deserialize-binary-tree": cls("Codec", [], [method("serialize", [["root", "tree"]], "str"), method("deserialize", [["data", "str"]], "tree")]),
  "implement-trie-prefix-tree": cls("Trie", [], [method("insert", [["word", "str"]], "void"), method("search", [["word", "str"]], "bool"), method("startsWith", [["prefix", "str"]], "bool")]),
  "design-add-and-search-words-data-structure": cls("WordDictionary", [], [method("addWord", [["word", "str"]], "void"), method("search", [["word", "str"]], "bool")]),
  "word-search-ii": fn("findWords", [["board", "stringMatrix"], ["words", "strings"]], "strings"),
  "kth-largest-element-in-a-stream": cls("KthLargest", [["k", "int"], ["nums", "ints"]], [method("add", [["val", "int"]], "int")]),
  "last-stone-weight": fn("lastStoneWeight", [["stones", "ints"]], "int"),
  "k-closest-points-to-origin": fn("kClosest", [["points", "matrix"], ["k", "int"]], "matrix"),
  "kth-largest-element-in-an-array": fn("findKthLargest", [["nums", "ints"], ["k", "int"]], "int"),
  "task-scheduler": fn("leastInterval", [["tasks", "strings"], ["n", "int"]], "int"),
  "design-twitter": cls("Twitter", [], [method("postTweet", [["userId", "int"], ["tweetId", "int"]], "void"), method("getNewsFeed", [["userId", "int"]], "ints"), method("follow", [["followerId", "int"], ["followeeId", "int"]], "void"), method("unfollow", [["followerId", "int"], ["followeeId", "int"]], "void")]),
  "find-median-from-data-stream": cls("MedianFinder", [], [method("addNum", [["num", "int"]], "void"), method("findMedian", [], "float")]),
  "combination-sum": fn("combinationSum", [["candidates", "ints"], ["target", "int"]], "matrix"),
  "permutations": fn("permute", [["nums", "ints"]], "matrix"),
  "subsets-ii": fn("subsetsWithDup", [["nums", "ints"]], "matrix"),
  "combination-sum-ii": fn("combinationSum2", [["candidates", "ints"], ["target", "int"]], "matrix"),
  "word-search": fn("exist", [["board", "stringMatrix"], ["word", "str"]], "bool"),
  "palindrome-partitioning": fn("partition", [["s", "str"]], "stringMatrix"),
  "letter-combinations-of-a-phone-number": fn("letterCombinations", [["digits", "str"]], "strings"),
  "n-queens": fn("solveNQueens", [["n", "int"]], "stringMatrix"),
  "clone-graph": fn("cloneGraph", [["node", "graphNode"]], "graphNode"),
  "max-area-of-island": fn("maxAreaOfIsland", [["grid", "matrix"]], "int"),
  "pacific-atlantic-water-flow": fn("pacificAtlantic", [["heights", "matrix"]], "matrix"),
  "surrounded-regions": fn("solve", [["board", "stringMatrix"]], "void"),
  "rotting-oranges": fn("orangesRotting", [["grid", "matrix"]], "int"),
  "walls-and-gates": fn("wallsAndGates", [["rooms", "matrix"]], "void"),
  "course-schedule": fn("canFinish", [["numCourses", "int"], ["prerequisites", "matrix"]], "bool"),
  "course-schedule-ii": fn("findOrder", [["numCourses", "int"], ["prerequisites", "matrix"]], "ints"),
  "redundant-connection": fn("findRedundantConnection", [["edges", "matrix"]], "ints"),
  "number-of-connected-components-in-an-undirected-graph": fn("countComponents", [["n", "int"], ["edges", "matrix"]], "int"),
  "graph-valid-tree": fn("validTree", [["n", "int"], ["edges", "matrix"]], "bool"),
  "word-ladder": fn("ladderLength", [["beginWord", "str"], ["endWord", "str"], ["wordList", "strings"]], "int"),
  "reconstruct-itinerary": fn("findItinerary", [["tickets", "stringMatrix"]], "strings"),
  "min-cost-to-connect-all-points": fn("minCostConnectPoints", [["points", "matrix"]], "int"),
  "network-delay-time": fn("networkDelayTime", [["times", "matrix"], ["n", "int"], ["k", "int"]], "int"),
  "swim-in-rising-water": fn("swimInWater", [["grid", "matrix"]], "int"),
  "alien-dictionary": fn("alienOrder", [["words", "strings"]], "str"),
  "cheapest-flights-within-k-stops": fn("findCheapestPrice", [["n", "int"], ["flights", "matrix"], ["src", "int"], ["dst", "int"], ["k", "int"]], "int"),
  "min-cost-climbing-stairs": fn("minCostClimbingStairs", [["cost", "ints"]], "int"),
  "house-robber": fn("rob", [["nums", "ints"]], "int"),
  "house-robber-ii": fn("rob", [["nums", "ints"]], "int"),
  "longest-palindromic-substring": fn("longestPalindrome", [["s", "str"]], "str"),
  "palindromic-substrings": fn("countSubstrings", [["s", "str"]], "int"),
  "decode-ways": fn("numDecodings", [["s", "str"]], "int"),
  "coin-change": fn("coinChange", [["coins", "ints"], ["amount", "int"]], "int"),
  "maximum-product-subarray": fn("maxProduct", [["nums", "ints"]], "int"),
  "word-break": fn("wordBreak", [["s", "str"], ["wordDict", "strings"]], "bool"),
  "longest-increasing-subsequence": fn("lengthOfLIS", [["nums", "ints"]], "int"),
  "partition-equal-subset-sum": fn("canPartition", [["nums", "ints"]], "bool"),
  "unique-paths": fn("uniquePaths", [["m", "int"], ["n", "int"]], "int"),
  "longest-common-subsequence": fn("longestCommonSubsequence", [["text1", "str"], ["text2", "str"]], "int"),
  "best-time-to-buy-and-sell-stock-with-cooldown": fn("maxProfit", [["prices", "ints"]], "int"),
  "coin-change-ii": fn("change", [["amount", "int"], ["coins", "ints"]], "int"),
  "target-sum": fn("findTargetSumWays", [["nums", "ints"], ["target", "int"]], "int"),
  "interleaving-string": fn("isInterleave", [["s1", "str"], ["s2", "str"], ["s3", "str"]], "bool"),
  "longest-increasing-path-in-a-matrix": fn("longestIncreasingPath", [["matrix", "matrix"]], "int"),
  "distinct-subsequences": fn("numDistinct", [["s", "str"], ["t", "str"]], "int"),
  "edit-distance": fn("minDistance", [["word1", "str"], ["word2", "str"]], "int"),
  "burst-balloons": fn("maxCoins", [["nums", "ints"]], "int"),
  "regular-expression-matching": fn("isMatch", [["s", "str"], ["p", "str"]], "bool"),
  "maximum-subarray": fn("maxSubArray", [["nums", "ints"]], "int"),
  "jump-game": fn("canJump", [["nums", "ints"]], "bool"),
  "jump-game-ii": fn("jump", [["nums", "ints"]], "int"),
  "gas-station": fn("canCompleteCircuit", [["gas", "ints"], ["cost", "ints"]], "int"),
  "hand-of-straights": fn("isNStraightHand", [["hand", "ints"], ["groupSize", "int"]], "bool"),
  "merge-triplets-to-form-target-triplet": fn("mergeTriplets", [["triplets", "matrix"], ["target", "ints"]], "bool"),
  "partition-labels": fn("partitionLabels", [["s", "str"]], "ints"),
  "valid-parenthesis-string": fn("checkValidString", [["s", "str"]], "bool"),
  "insert-interval": fn("insert", [["intervals", "matrix"], ["newInterval", "ints"]], "matrix"),
  "merge-intervals": fn("merge", [["intervals", "matrix"]], "matrix"),
  "non-overlapping-intervals": fn("eraseOverlapIntervals", [["intervals", "matrix"]], "int"),
  "meeting-rooms": fn("canAttendMeetings", [["intervals", "matrix"]], "bool"),
  "meeting-rooms-ii": fn("minMeetingRooms", [["intervals", "matrix"]], "int"),
  "minimum-interval-to-include-each-query": fn("minInterval", [["intervals", "matrix"], ["queries", "ints"]], "ints"),
  "rotate-image": fn("rotate", [["matrix", "matrix"]], "void"),
  "spiral-matrix": fn("spiralOrder", [["matrix", "matrix"]], "ints"),
  "set-matrix-zeroes": fn("setZeroes", [["matrix", "matrix"]], "void"),
  "happy-number": fn("isHappy", [["n", "int"]], "bool"),
  "plus-one": fn("plusOne", [["digits", "ints"]], "ints"),
  "powx-n": fn("myPow", [["x", "float"], ["n", "int"]], "float"),
  "multiply-strings": fn("multiply", [["num1", "str"], ["num2", "str"]], "str"),
  "detect-squares": cls("DetectSquares", [], [method("add", [["point", "ints"]], "void"), method("count", [["point", "ints"]], "int")]),
  "single-number": fn("singleNumber", [["nums", "ints"]], "int"),
  "number-of-1-bits": fn("hammingWeight", [["n", "int"]], "int"),
  "counting-bits": fn("countBits", [["n", "int"]], "ints"),
  "reverse-bits": fn("reverseBits", [["n", "int"]], "int"),
  "missing-number": fn("missingNumber", [["nums", "ints"]], "int"),
  "sum-of-two-integers": fn("getSum", [["a", "int"], ["b", "int"]], "int"),
  "reverse-integer": fn("reverse", [["x", "int"]], "int"),
};

const types: Record<ValueType, {py: string; ts: string}> = {
  int: {py: "int", ts: "number"}, float: {py: "float", ts: "number"}, bool: {py: "bool", ts: "boolean"}, str: {py: "str", ts: "string"}, void: {py: "None", ts: "void"},
  ints: {py: "List[int]", ts: "number[]"}, floats: {py: "List[float]", ts: "number[]"}, matrix: {py: "List[List[int]]", ts: "number[][]"}, strings: {py: "List[str]", ts: "string[]"}, stringMatrix: {py: "List[List[str]]", ts: "string[][]"},
  list: {py: "Optional[ListNode]", ts: "ListNode | null"}, lists: {py: "List[Optional[ListNode]]", ts: "(ListNode | null)[]"}, tree: {py: "Optional[TreeNode]", ts: "TreeNode | null"},
  randomNode: {py: "Optional[Node]", ts: "Node | null"}, graphNode: {py: "Optional[Node]", ts: "Node | null"},
  nextNode: {py: "Optional[Node]", ts: "Node | null"}, quadNode: {py: "Optional[Node]", ts: "Node | null"},
};

export function nodePrelude(contract: StarterContract, language: Language): string {
  const methods = contract.kind === "class" ? contract.methods : [contract];
  const used = new Set([...contract.parameters.map(p => p[1]), ...methods.flatMap(m => [...m.parameters.map(p => p[1]), m.returns])]);
  const structures: [string, [string, string, string][]][] = [];
  if (used.has("list") || used.has("lists")) structures.push(["ListNode", [["val", "number", "0"], ["next", "ListNode | null", "null"]]]);
  if (used.has("tree")) structures.push(["TreeNode", [["val", "number", "0"], ["left", "TreeNode | null", "null"], ["right", "TreeNode | null", "null"]]]);
  if (used.has("randomNode")) structures.push(["Node", [["val", "number", "0"], ["next", "Node | null", "null"], ["random", "Node | null", "null"]]]);
  if (used.has("graphNode")) structures.push(["Node", [["val", "number", "0"], ["neighbors", "Node[]", "[]"]]]);
  if (used.has("nextNode")) structures.push(["Node", [["val", "number", "0"], ["left", "Node | null", "null"], ["right", "Node | null", "null"], ["next", "Node | null", "null"]]]);
  if (used.has("quadNode")) structures.push(["Node", [["val", "boolean", "false"], ["isLeaf", "boolean", "false"], ["topLeft", "Node | null", "null"], ["topRight", "Node | null", "null"], ["bottomLeft", "Node | null", "null"], ["bottomRight", "Node | null", "null"]]]);
  return structures.map(([name, fields]) => {
    if (language === "python") {
      const params = fields.map(([field, , initial]) => `${field}=${initial === "null" || initial === "[]" ? "None" : initial === "false" ? "False" : initial}`).join(", ");
      const assignments = fields.map(([field, , initial]) => `        self.${field} = ${initial === "[]" ? `${field} if ${field} is not None else []` : field}`).join("\n");
      return `class ${name}:\n    def __init__(self, ${params}):\n${assignments}\n\n`;
    }
    const params = fields.map(([field, type, initial]) => `${language === "typescript" ? `public ${field}: ${type}` : field} = ${initial}`).join(", ");
    const assignments = language === "typescript" ? "" : fields.map(([field]) => `this.${field} = ${field};`).join(" ");
    return `class ${name} {\n  constructor(${params}) {${assignments ? ` ${assignments} ` : ""}}\n}\n\n`;
  }).join("");
}

export function renderStarter(contract: StarterContract, language: Language): string {
  const parameters = (params: readonly Parameter[]) => params.map(([name, type]) => language === "python" ? `${name}: ${types[type].py}` : language === "typescript" ? `${name}: ${types[type].ts}` : name).join(", ");
  const prelude = nodePrelude(contract, language);
  if (language === "python") {
    const body = "        # Write your solution here.\n        pass\n";
    if (contract.kind === "function") return `from typing import List, Optional\n\n${prelude}def ${contract.name}(${parameters(contract.parameters)}) -> ${types[contract.returns].py}:\n    # Write your solution here.\n    pass\n`;
    const init = `    def __init__(${["self", parameters(contract.parameters)].filter(Boolean).join(", ")}) -> None:\n${body}`;
    const methods = contract.methods.map(m => `    def ${m.name}(${["self", parameters(m.parameters)].filter(Boolean).join(", ")}) -> ${types[m.returns].py}:\n${body}`).join("\n");
    return `from typing import List, Optional\n\n${prelude}class ${contract.name}:\n${init}\n${methods}`;
  }
  const result = (type: ValueType) => language === "typescript" ? `: ${types[type].ts}` : "";
  const body = '    // Write your solution here.\n    throw new Error("Not implemented");\n';
  if (contract.kind === "function") return `${prelude}function ${contract.name}(${parameters(contract.parameters)})${result(contract.returns)} {\n  // Write your solution here.\n  throw new Error("Not implemented");\n}\n`;
  const init = `  constructor(${parameters(contract.parameters)}) {\n${body}  }`;
  const methods = contract.methods.map(m => `  ${m.name}(${parameters(m.parameters)})${result(m.returns)} {\n${body}  }`).join("\n\n");
  return `${prelude}class ${contract.name} {\n${init}\n\n${methods}\n}\n`;
}

// Upgrade only the old untouched placeholder, never a candidate's saved work.
export function codeWithStarter(saved: string | undefined, starter: string, language: Language): string {
  const legacy = language === "python" ? "# Write or paste your Python solution here.\n" : `// Write or paste your ${language === "javascript" ? "JavaScript" : "TypeScript"} solution here.\n`;
  return saved === undefined || saved === legacy ? starter : saved;
}
