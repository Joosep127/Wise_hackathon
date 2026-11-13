export type Category = "Food" | "Drinks" | "Extras";
export type Person = { id: string; name: string; paid: boolean };
export type Item = {
  id: string; name: string; cents: number; category: Category;
  quantity: number; everyone: boolean; weights: Record<string, number>; revision: number;
  sharedPortions?: boolean;
};
export type Room = {
  board?: import("./bill").Board;
  title: string; currency: string; host: string; locked: boolean;
  people: Person[]; items: Item[];
};
export type Draft = { name: string; amount: string; category: Category; quantity: number };
export const categories: Category[] = ["Food", "Drinks", "Extras"];
export const currencies = ["EUR", "GBP", "USD"];
export const sample: Draft[] = [
  { name: "Margherita pizza", quantity: 1, amount: "16.00", category: "Food" },
  { name: "Burrata", quantity: 1, amount: "12.00", category: "Food" },
  { name: "House wine", quantity: 1, amount: "10.00", category: "Drinks" },
  { name: "Sparkling water", quantity: 1, amount: "4.00", category: "Drinks" },
];
export function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(cents / 100);
}
export function parseCents(amount: string) {
  if (typeof amount !== "string" || !/^\d{1,6}([.,]\d{1,2})?$/.test(amount.trim())) return NaN;
  const [units, fraction = ""] = amount.trim().replace(",", ".").split(".");
  return Number(units) * 100 + Number(fraction.padEnd(2, "0"));
}
export function receiptQuantity(label: string) {
  const prefix = label.match(/^([1-9]\d{0,2})(?:\s*[×x]\s*|\s+)(?=\p{L})(.+)$/iu);
  const suffix = label.match(/^(.+?)\s+[×x]\s*([1-9]\d{0,2})$/i);
  if (prefix) return { name: prefix[2].trim(), quantity: Number(prefix[1]) };
  if (suffix) return { name: suffix[1].trim(), quantity: Number(suffix[2]) };
  return { name: label, quantity: 1 };
}
export function countsUnits(item: Item) {
  return item.quantity > 1 && !item.everyone && !item.sharedPortions;
}
export function remainingUnits(item: Item) {
  return item.quantity - Object.values(item.weights).reduce((sum, n) => sum + n, 0);
}
export function allocation(item: Item, people: Person[]): Record<string, number> {
  const parts = people.map(p => ({ id: p.id, weight: item.everyone ? 1 : item.weights[p.id] || 0 })).filter(p => p.weight > 0);
  // Give unclaimed units their own share of any rounding remainder.
  if (countsUnits(item) && remainingUnits(item) > 0) parts.push({ id: "", weight: remainingUnits(item) });
  const weight = parts.reduce((n, p) => n + p.weight, 0);
  if (!weight) return {};
  const shares = parts.map(p => ({ id: p.id, cents: Math.floor(item.cents * p.weight / weight), remainder: item.cents * p.weight % weight }));
  const extra = item.cents - shares.reduce((n, p) => n + p.cents, 0);
  shares.sort((a, b) => b.remainder - a.remainder);
  const amounts = Object.fromEntries(shares.map((p, i) => [p.id, p.cents + Number(i < extra)]));
  delete amounts[""];
  return amounts;
}
export function totals(room: Room) {
  const balances: Record<string, number> = Object.fromEntries(room.people.map(p => [p.id, 0]));
  let unclaimed = 0, total = 0, incomplete = false;
  for (const item of room.items) {
    const shares = allocation(item, room.people);
    total += item.cents;
    unclaimed += item.cents - Object.values(shares).reduce((sum, n) => sum + n, 0);
    if (!Object.keys(shares).length || (countsUnits(item) && remainingUnits(item) > 0)) incomplete = true;
    for (const [id, cents] of Object.entries(shares)) balances[id] += cents;
  }
  return { balances, unclaimed, total, incomplete };
}
export function parseReceipt(text: string): Draft[] {
  return text.split(/\r?\n/).flatMap(line => {
    const m = line.trim().match(/^(.+?)\s+(?:[€£$]\s*)?(\d{1,6}[.,]\d{2})(?:\s*[€£$A-Z])?$/i);
    if (!m || /\b(sub\s*total|total|cash|change|tender|balance|amount paid|visa|mastercard|amount due)\b/i.test(m[1])) return [];
    const { name, quantity } = receiptQuantity(m[1].trim());
    const category = /\b(wine|beer|water|coffee|tea|juice|lemonade|coke|colas?|soda|lager|cocktail)\b/i.test(name) ? "Drinks" : /\b(tax|tip|service|vat)\b/i.test(name) ? "Extras" : "Food";
    return [{ name, quantity, amount: m[2].replace(",", "."), category }];
  });
}

// A textured background can produce stray characters past the price column.
export function parseReceiptBlock(text: string): Draft[] {
  return parseReceipt(text.replace(/(\d[.,]\d{2})[ \t]+[^\d\s][^\d\r\n]{0,5}$/gm, "$1"));
}
