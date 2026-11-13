import type { Item, Room } from "./split";

// All reservations are in receipt cents. A group reserves from the same
// inventory as a person, and a payment moves a reservation to the paid column.
export type Selection = Record<string, number>;
export type Group = { id: string; name: string; items: Selection; paidBy?: string };
export type Pattern = { name: string; units: number }[];
export type Payment = { actor: string; key: string; pattern: Pattern; total: number; group?: string; items?: Selection };
export type Board = {
  picks: Record<string, Selection>; groups: Group[]; paid: Selection; payments: Payment[];
  generation?: number; receiptBeforeEdit?: Item[];
  undo?: { actor: string; revision: number; picks: Record<string, Selection>; groups: Group[] };
};
export type BillRoom = Room & { board: Board };
export const sum = (values: Selection) => Object.values(values).reduce((a, b) => a + b, 0);
export const itemKey = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function available(item: Item, board: Board) {
  const reservations = [...Object.values(board.picks), ...board.groups.filter(g => !g.paidBy).map(g => g.items)];
  return item.cents - (board.paid[item.id] || 0) - reservations.reduce((n, s) => n + (s[item.id] || 0), 0);
}
export function combineItems(items: Item[]) {
  const merged = new Map<string, Item>();
  for (const item of items) {
    const key = JSON.stringify([itemKey(item.name), item.category, item.cents / item.quantity]);
    const existing = merged.get(key);
    if (existing) { existing.cents += item.cents; existing.quantity += item.quantity; }
    else merged.set(key, { ...item });
  }
  return [...merged.values()];
}
// New payments keep receipt line IDs. Older bills only stored names and
// quantities: never attribute an ambiguous historical line to the wrong person.
export function paymentLines(room: Room, payment: Payment): Selection | undefined {
  if (payment.items) return payment.items;
  const lines: Selection = {};
  for (const part of payment.pattern) {
    const candidates = room.items.filter(i => itemKey(i.name) === itemKey(part.name));
    if (candidates.length !== 1 || lines[candidates[0].id]) return;
    const i = candidates[0], n = Math.round(part.units * i.cents / i.quantity);
    if (!(n > 0 && n <= i.cents)) return;
    lines[i.id] = n;
  }
  return sum(lines) === payment.total ? lines : undefined;
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export type BillAction = {
  action: string; revision?: number; item?: string; cents?: number; ids?: string[];
  group?: string; name?: string; targets?: string[]; pieces?: number; pattern?: Pattern;
  key?: string; expected?: Selection; allocations?: Selection; previous?: number; generation?: number; currency?: string; quantity?: number; category?:string;
};
export function updateBill(room: BillRoom, actor: string, cmd: BillAction, revision: number) {
  const b = room.board;
  const mine = b.picks[actor] ?? {};
  const group = b.groups.find(g => g.id === cmd.group);
  const item = room.items.find(i => i.id === cmd.item);
  const host = room.host === actor;
  requireValue((cmd.generation ?? 0) === (b.generation ?? 0), "The table was reset. Review the current items and try again.");
  const makeGroup = (name: string) => {
    requireValue(typeof name === "string" && name.trim() && name.trim().length <= 40 && b.groups.length < 50, "Enter a group name of up to 40 characters (maximum 50 groups).");
    const next = { id: crypto.randomUUID(), name: name.trim(), items: {} as Selection };
    b.groups.push(next);
    return next;
  };
  if (cmd.action === "settle") {
    requireValue(!host, "You already paid the restaurant. Your selection records your own share.");
    requireValue(typeof cmd.key === "string" && cmd.key.length > 0 && cmd.key.length <= 80, "Reopen checkout.");
    const previous = b.payments.find(p => p.actor === actor && p.key === cmd.key);
    if (previous) { requireValue(previous.group === cmd.group, "Reopen checkout."); return; }
    if (cmd.group !== undefined) requireValue(group && !group.paidBy, "This group has already paid or is no longer available.");
    const share = group ? group.items : mine;
    const entries = Object.entries(share);
    requireValue(entries.length && cmd.expected && Object.keys(cmd.expected).length === entries.length && entries.every(([id, cents]) => cmd.expected?.[id] === cents), "The items changed. Reopen checkout to review the new amount.");
    const pattern = room.items.filter(i => share[i.id]).map(i => ({ name: i.name, units: share[i.id] * i.quantity / i.cents }));
    for (const [id, cents] of entries) b.paid[id] = (b.paid[id] || 0) + cents;
    b.payments.push({ actor, key: cmd.key, total: sum(share), pattern, items: {...share}, ...(group ? {group: group.id} : {}) });
    if (group) group.paidBy = actor; else delete b.picks[actor];
    delete b.undo;
    return;
  }
  if (cmd.action === "undo") {
    requireValue(host && b.undo?.actor === actor && b.undo.revision === revision, "Another change followed this edit. Undo is unavailable.");
    b.picks = b.undo.picks; b.groups = b.undo.groups; delete b.undo;
    return;
  }
  if (cmd.action === "select") {
    const cents = cmd.cents;
    requireValue(item && Number.isSafeInteger(cents) && typeof cents === "number" && cents >= 0, "Choose a valid share.");
    requireValue(cents <= available(item, b) + (mine[item.id] || 0), "That share was just claimed. Check what is left.");
    if (cents) mine[item.id] = cents; else delete mine[item.id];
    b.picks[actor] = mine;
    return;
  }
  if (cmd.action === "selectAll" || cmd.action === "clearAll") {
    const next: Selection = {};
    if (cmd.action === "selectAll") for (const line of room.items) {
      const n = available(line, b) + (mine[line.id] || 0);
      if (n > 0) next[line.id] = n;
    }
    b.picks[actor] = next;
    return;
  }
  if (cmd.action === "resetMine") {
    requireValue(!host, "Use the table reset or clear your own items.");
    const undoPaid: Selection = {};
    for (const p of b.payments.filter(p => p.actor === actor)) {
      const lines = paymentLines(room, p);
      requireValue(lines, "This older payment has no exact item history. The organiser can reset the whole demo table.");
      for (const [id, cents] of Object.entries(lines)) undoPaid[id] = (undoPaid[id] || 0) + cents;
    }
    for (const [id, n] of Object.entries(undoPaid)) {
      requireValue((b.paid[id] || 0) >= n, "The payment history could not be reconciled.");
      b.paid[id] -= n; if (!b.paid[id]) delete b.paid[id];
    }
    for (const g of b.groups) if (g.paidBy === actor) delete g.paidBy;
    b.payments = b.payments.filter(p => p.actor !== actor);
    delete b.picks[actor]; delete b.undo;
    return;
  }
  if (cmd.action === "applyPattern") {
    requireValue(Array.isArray(cmd.pattern) && cmd.pattern.length <= 150, "Choose an available suggestion.");
    const next: Selection = {};
    for (const part of cmd.pattern) {
      requireValue(typeof part?.name === "string" && Number.isFinite(part.units) && part.units > 0, "Invalid selection.");
      const match = room.items.find(i => itemKey(i.name) === itemKey(part.name) && !next[i.id] && available(i,b) + (mine[i.id] || 0) > 0);
      if (!match) continue;
      const amount = Math.min(available(match,b) + (mine[match.id] || 0), Math.round(part.units * match.cents / match.quantity));
      if (amount > 0) next[match.id] = amount;
    }
    requireValue(sum(next) > 0, "These items have already been claimed.");
    b.picks[actor] = next;
    return;
  }
  if (cmd.action === "takeGroup") {
    requireValue(!host && group && !group.paidBy && sum(group.items) > 0, "Only guests can take an unpaid group.");
    for (const [id, cents] of Object.entries(group.items)) mine[id] = (mine[id] || 0) + cents;
    group.items = {};
    b.picks[actor] = mine;
    return;
  }
  requireValue(host, "Only the organiser can edit groups and receipt details.");
  if (cmd.action === "resetTable") {
    requireValue(cmd.revision === revision, "The bill changed. Review it before resetting.");
    if (b.receiptBeforeEdit) room.items = b.receiptBeforeEdit;
    room.board = { picks: {}, groups: [], paid: {}, payments: [], generation: revision + 1 };
    return;
  }
  if (cmd.action === "editLine") {
    requireValue(item && available(item,b) === item.cents, "Release the selections on this line before editing it.");
    requireValue(typeof cmd.name === "string" && cmd.name.trim() && cmd.name.trim().length <= 100 && Number.isSafeInteger(cmd.cents) && cmd.cents! > 0 && cmd.cents! <= 99999999 && Number.isInteger(cmd.quantity) && cmd.quantity! > 0 && cmd.quantity! <= 9999, "Check the name, quantity and line total.");
    b.receiptBeforeEdit ??= structuredClone(room.items);
    item.name = cmd.name.trim(); item.cents = cmd.cents!; item.quantity = cmd.quantity!;
    delete b.undo;
    return;
  }
  b.undo = { actor, revision: revision + 1, picks: structuredClone(b.picks), groups: structuredClone(b.groups) };
  if (cmd.action === "shareCategory") {
    const lines = room.items.filter(i => i.category === cmd.category);
    requireValue(lines.length && lines.every(i => !b.paid[i.id] && !b.groups.some(g => g.items[i.id])), "Choose a category without grouped or paid items.");
    let offset = 0;
    for (const i of lines) {
      room.people.forEach((p,index) => {
        const selection = b.picks[p.id] ??= {};
        const part = Math.floor(i.cents/room.people.length) + Number((index-offset+room.people.length)%room.people.length < i.cents%room.people.length);
        if(part) selection[i.id]=part; else delete selection[i.id];
      });
      offset = (offset+i.cents)%room.people.length;
    }
    return;
  }
  if (cmd.action === "renameGroup") {
    requireValue(group && !group.paidBy && typeof cmd.name === "string" && cmd.name.trim() && cmd.name.trim().length <= 40, "Choose an unpaid group and a name.");
    group.name = cmd.name.trim(); return;
  }
  if (cmd.action === "setGroupItem") {
    requireValue(group && !group.paidBy && item, "Choose an unpaid group and a receipt item.");
    const current = group.items[item.id] || 0;
    requireValue(current === cmd.previous, "This group changed. Check its items and try again.");
    const cents = cmd.cents;
    requireValue(typeof cents === "number" && Number.isSafeInteger(cents) && cents >= 0 && cents <= current + available(item, b), "That amount is no longer available.");
    if (cents) group.items[item.id] = cents; else delete group.items[item.id];
    return;
  }
  if (cmd.action === "deleteGroup") {
    requireValue(group, "This group no longer exists.");
    b.groups = b.groups.filter(g => g.id !== group.id); return;
  }
  if (cmd.action === "selectAllForGroup" || cmd.action === "clearGroupItems") {
    requireValue(group && !group.paidBy, "Choose an unpaid group.");
    const next: Selection = {};
    if (cmd.action === "selectAllForGroup") for (const line of room.items) {
      const n = available(line, b) + (group.items[line.id] || 0);
      if (n > 0) next[line.id] = n;
    }
    group.items = next; return;
  }
  requireValue(["move", "divide", "createGroup"].includes(cmd.action), "Unknown bill action.");
  let targets: Group[];
  if (cmd.action === "divide") {
    if (cmd.pieces !== undefined) {
      requireValue(Number.isInteger(cmd.pieces) && cmd.pieces >= 2 && cmd.pieces <= 50, "Choose between 2 and 50 groups.");
      targets = Array.from({length:cmd.pieces}, () => makeGroup("Group " + (b.groups.length + 1)));
    } else {
      requireValue(Array.isArray(cmd.targets), "Select groups.");
      targets = b.groups.filter(g => !g.paidBy && cmd.targets!.includes(g.id));
      requireValue(targets.length >= 2 && targets.length === new Set(cmd.targets).size, "Choose at least two unpaid groups.");
    }
  } else {
    requireValue(cmd.group === undefined || (group && !group.paidBy), "Group unavailable.");
    targets = [group ?? makeGroup(cmd.name ?? "Group " + (b.groups.length + 1))];
  }
  if (cmd.action === "createGroup") return;
  // New clients allocate unassigned receipt stock. Only old, already-open clients
  // send ids, which historically meant transferring the organiser's own picks.
  const fromReceipt = cmd.allocations !== undefined;
  let entries: [string, number][];
  if (fromReceipt) {
    requireValue(cmd.allocations && typeof cmd.allocations === "object" && !Array.isArray(cmd.allocations), "Choose receipt items.");
    entries = Object.entries(cmd.allocations);
  } else {
    requireValue(Array.isArray(cmd.ids), "Choose receipt items.");
    entries = [...new Set(cmd.ids)].map(id => [id, mine[id]]);
  }
  requireValue(entries.length > 0 && entries.length <= room.items.length, "Choose receipt items first.");
  let offset = 0;
  for (const [id, cents] of entries) {
    const line = room.items.find(i => i.id === id);
    requireValue(line && Number.isSafeInteger(cents) && cents > 0 && (!fromReceipt || cents <= available(line, b)), "Someone claimed part of this selection. Check what is left.");
    targets.forEach((g,index) => {
      const part = Math.floor(cents / targets.length) + Number((index-offset+targets.length)%targets.length < cents % targets.length);
      if (part) g.items[id] = (g.items[id] || 0) + part;
    });
    offset = (offset+cents)%targets.length;
    if (!fromReceipt) delete mine[id];
  }
}
export function suggestions(patterns: Pattern[], room: Room) {
  const names = new Set(room.items.map(i => itemKey(i.name)));
  const counts = new Map<string, { pattern: Pattern; times: number; match: number }>();
  for (const pattern of patterns) {
    const keys = [...new Set(pattern.map(p => itemKey(p.name)))];
    const hits = keys.filter(k => names.has(k)).length;
    if (!hits) continue;
    const key = JSON.stringify(pattern.map(p => [itemKey(p.name), Math.round(p.units * 1000)]).sort());
    const previous = counts.get(key);
    if (previous) previous.times++;
    else counts.set(key, {pattern, times:1, match:hits / new Set([...names,...keys]).size});
  }
  return [...counts.values()].sort((a,b) => (b.match * Math.log2(1+b.times)) - (a.match * Math.log2(1+a.times))).slice(0,5);
}
