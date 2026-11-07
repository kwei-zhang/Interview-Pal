import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBulletSelection } from "../src/lib/bullet-formatting";

test("Formatting keeps the selected words selected and toggles without changing surrounding text", () => {
  const text = "Reduced latency by 40%.";
  const start = text.indexOf("40%"), end = start + 3;
  const bold = formatBulletSelection(text, start, end, "bold");
  assert.equal(bold.text, "Reduced latency by **40%**.");
  assert.equal(bold.text.slice(bold.start, bold.end), "40%");
  assert.deepEqual(formatBulletSelection(bold.text, bold.start, bold.end, "bold"), {text, start, end});
  const italic = formatBulletSelection(bold.text, bold.start, bold.end, "italic");
  assert.equal(italic.text, "Reduced latency by **_40%_**.");
  assert.equal(formatBulletSelection(italic.text, italic.start, italic.end, "italic").text, bold.text);
  assert.equal(formatBulletSelection("**40%**", 0, 7, "bold").text, "40%");
});

test("Formatting trims only the selection boundary and inserts editable placeholders at the caret", () => {
  assert.equal(formatBulletSelection("Built a cache ", 8, 14, "bold").text, "Built a **cache** ");
  const empty = formatBulletSelection("Built ", 6, 6, "italic");
  assert.equal(empty.text, "Built _italic text_");
  assert.equal(empty.text.slice(empty.start, empty.end), "italic text");
  assert.deepEqual(formatBulletSelection(" \n ", 0, 3, "bold"), {text: " \n ", start: 0, end: 3});
});

test("Inline code handles literal backticks and preserves the code when toggled", () => {
  for (const text of ["cache.get()", "const x = `value`", "`value` result"]) {
    const result = formatBulletSelection(`Used ${text} here`, 5, 5 + text.length, "code");
    assert.equal(result.text.slice(result.start, result.end), text);
    assert.equal(formatBulletSelection(result.text, result.start, result.end, "code").text, `Used ${text} here`);
  }
  assert.equal(formatBulletSelection("`value`", 0, 7, "code").text, "value");
});
