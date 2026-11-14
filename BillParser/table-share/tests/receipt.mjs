import assert from "node:assert/strict";
import { parseReceipt, parseReceiptBlock } from "../lib/split.ts";

const items = "1 Pad Thai 12.00\n2 Cola 4.00\nCashew salad 7.00\nService charge 2.00\nTax 1.00\nTip 3.00";
const expected = parseReceipt(items);
assert.equal(expected.length, 6);
assert.equal(expected[1].quantity, 2);
assert.equal(expected[3].category, "Extras");
for (const heading of [
  "TOTAL EUR", "SUB TOTAL", "Grand total", "Total paid", "Paid", "PAID:",
  "Payment", "Card payment", "Paid by card", "Cash tendered", "Change",
  "Amount due", "Amount charged", "To pay", "Balance", "VISA", "Mastercard",
  "Credit card", "Debit", "T O T A L", "T0TAL EUR", "TOTAI", "SUBT0TA1",
  "P A I D", "KOKKU", "TASUTUD", "MAKSTUD",
]) {
  assert.deepEqual(parseReceipt(items + "\n" + heading + " 29.00"), expected, heading);
  assert.deepEqual(parseReceiptBlock(items + "\n" + heading + " 29.00 ="), expected, heading + " with OCR noise");
}
assert.deepEqual(parseReceipt("TOTAL EUR 29.00\nPaid 29.00"), []);
console.log("Summary headings and OCR variants excluded; dishes, quantities, tax, service and tip retained.");
