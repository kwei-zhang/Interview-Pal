import type { Language, ProblemDefinition } from "../src/lib/types";
import { structurePrelude } from "../src/lib/problems/harness";

// Independently written reference implementations, used only in tests.
const pythonBodies: Record<string, string> = {
  "contains-duplicate": "    return len(nums) != len(set(nums))",
  "valid-anagram": "    return sorted(s) == sorted(t)",
  "two-sum": "    seen = {}\n    for i, value in enumerate(nums):\n        if target - value in seen:\n            return [seen[target - value], i]\n        seen[value] = i\n    return []",
  "group-anagrams": "    groups = {}\n    for word in strs:\n        key = ''.join(sorted(word))\n        groups.setdefault(key, []).append(word)\n    return list(groups.values())",
  "valid-palindrome": "    clean = ''.join(c.lower() for c in s if c.isascii() and c.isalnum())\n    return clean == clean[::-1]",
  "3sum": "    nums = sorted(nums)\n    answer = []\n    for i in range(len(nums) - 2):\n        if i and nums[i] == nums[i-1]:\n            continue\n        left, right = i + 1, len(nums) - 1\n        while left < right:\n            total = nums[i] + nums[left] + nums[right]\n            if total < 0:\n                left += 1\n            elif total > 0:\n                right -= 1\n            else:\n                answer.append([nums[i], nums[left], nums[right]])\n                left += 1\n                right -= 1\n                while left < right and nums[left] == nums[left-1]:\n                    left += 1\n    return answer",
  "best-time-to-buy-and-sell-stock": "    lowest, profit = float('inf'), 0\n    for price in prices:\n        lowest = min(lowest, price)\n        profit = max(profit, price - lowest)\n    return profit",
  "longest-substring-without-repeating-characters": "    seen, left, best = {}, 0, 0\n    for right, char in enumerate(s):\n        left = max(left, seen.get(char, -1) + 1)\n        seen[char] = right\n        best = max(best, right - left + 1)\n    return best",
  "valid-parentheses": "    stack, pairs = [], {')': '(', ']': '[', '}': '{'}\n    for char in s:\n        if char in pairs:\n            if not stack or stack.pop() != pairs[char]:\n                return False\n        else:\n            stack.append(char)\n    return not stack",
  "binary-search": "    left, right = 0, len(nums) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
  "reverse-linked-list": "    previous = None\n    while head:\n        following = head.next\n        head.next = previous\n        previous = head\n        head = following\n    return previous",
  "maximum-depth-of-binary-tree": "    return 0 if root is None else 1 + max(maxDepth(root.left), maxDepth(root.right))",
  "subsets": "    answer = [[]]\n    for value in nums:\n        answer += [group + [value] for group in answer]\n    return answer",
  "number-of-islands": "    if not grid or not grid[0]:\n        return 0\n    rows, cols, count = len(grid), len(grid[0]), 0\n    for r in range(rows):\n        for c in range(cols):\n            if grid[r][c] != '1':\n                continue\n            count += 1\n            pending = [(r, c)]\n            grid[r][c] = '0'\n            while pending:\n                y, x = pending.pop()\n                for ny, nx in [(y+1,x),(y-1,x),(y,x+1),(y,x-1)]:\n                    if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == '1':\n                        grid[ny][nx] = '0'\n                        pending.append((ny,nx))\n    return count",
  "climbing-stairs": "    a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a",
};
const jsBodies: Record<string, string> = {
  "contains-duplicate": "return new Set(nums).size !== nums.length;",
  "valid-anagram": "return s.split('').sort().join('') === t.split('').sort().join('');",
  "two-sum": "const seen = new Map(); for (let i=0; i<nums.length; i++) {if (seen.has(target-nums[i])) return [seen.get(target-nums[i]), i]; seen.set(nums[i], i);} return [];",
  "group-anagrams": "const groups = new Map(); for (const word of strs) {const key = word.split('').sort().join(''); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(word);} return [...groups.values()];",
  "valid-palindrome": "const clean = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); return clean === clean.split('').reverse().join('');",
  "3sum": "nums = nums.slice().sort((a,b)=>a-b); const answer = []; for (let i=0;i<nums.length-2;i++) {if(i && nums[i]===nums[i-1])continue;let l=i+1,r=nums.length-1;while(l<r){const total=nums[i]+nums[l]+nums[r];if(total<0)l++;else if(total>0)r--;else{answer.push([nums[i],nums[l],nums[r]]);l++;r--;while(l<r&&nums[l]===nums[l-1])l++;}}} return answer;",
  "best-time-to-buy-and-sell-stock": "let low=Infinity,best=0;for(const price of prices){low=Math.min(low,price);best=Math.max(best,price-low);}return best;",
  "longest-substring-without-repeating-characters": "const seen=new Map();let left=0,best=0;for(let right=0;right<s.length;right++){left=Math.max(left,(seen.has(s[right]) ? seen.get(s[right]) : -1)+1);seen.set(s[right],right);best=Math.max(best,right-left+1);}return best;",
  "valid-parentheses": "const stack=[];const pairs={')':'(',']':'[','}':'{'};for(const char of s){if(char in pairs){if(stack.pop()!==pairs[char])return false;}else stack.push(char);}return stack.length===0;",
  "binary-search": "let l=0,r=nums.length-1;while(l<=r){const m=Math.floor((l+r)/2);if(nums[m]===target)return m;if(nums[m]<target)l=m+1;else r=m-1;}return -1;",
  "reverse-linked-list": "let previous=null;while(head){const following=head.next;head.next=previous;previous=head;head=following;}return previous;",
  "maximum-depth-of-binary-tree": "return root===null ? 0 : 1+Math.max(maxDepth(root.left),maxDepth(root.right));",
  "subsets": "const answer=[[]];for(const value of nums){for(const group of answer.slice())answer.push([...group,value]);}return answer;",
  "number-of-islands": "if(!grid.length||!grid[0].length)return 0;const rows=grid.length,cols=grid[0].length;let count=0;for(let r=0;r<rows;r++){for(let c=0;c<cols;c++){if(grid[r][c]!=='1')continue;count++;const pending=[[r,c]];grid[r][c]='0';while(pending.length){const [y,x]=pending.pop();for(const [ny,nx] of [[y+1,x],[y-1,x],[y,x+1],[y,x-1]]){if(ny>=0&&ny<rows&&nx>=0&&nx<cols&&grid[ny][nx]==='1'){grid[ny][nx]='0';pending.push([ny,nx]);}}}}}return count;",
  "climbing-stairs": "let a=1,b=1;for(let i=0;i<n;i++){const next=a+b;a=b;b=next;}return a;",
};
export function referenceSource(definition: ProblemDefinition, language: Language, wrong = false): string {
  if (language === "python") return `from typing import List, Optional\n\n${structurePrelude(definition, language)}def ${definition.functionName}(${definition.parameters.map(p => `${p.name}: ${p.py}`).join(", ")}) -> ${definition.returnType.py}:\n${wrong ? "    return None" : pythonBodies[definition.id]}\n`;
  const signature = definition.parameters.map(p => language === "typescript" ? `${p.name}: ${p.ts}` : p.name).join(", ");
  return `${structurePrelude(definition, language)}function ${definition.functionName}(${signature})${language === "typescript" ? `: ${definition.returnType.ts}` : ""} {\n${wrong ? "return null;" : jsBodies[definition.id]}\n}\n`;
}
