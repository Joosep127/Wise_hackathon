// Run against the local preview with TABLE_URL=http://127.0.0.1:8794 node tests/live.mjs.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { parseReceipt, sample, totals } from "../lib/split.ts";

const url = new URL("/api/rooms", process.env.TABLE_URL || "http://127.0.0.1:8787");
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use a local test server");
const [host, guest, other] = Array.from({ length: 3 }, () => randomBytes(32).toString("hex"));
async function api(token, cmd, expected = 200) {
  const response = await fetch(url, {
    method: cmd ? "POST" : "GET", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: cmd ? JSON.stringify(cmd) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, data.error);
  return data;
}
const created = await api(host, { action: "create", title: "Concurrency test", name: "Alex", currency: "EUR", items: sample }, 201);
url.searchParams.set("id", created.id);
const [sam, jo] = await Promise.all([api(guest, { action: "join", name: "Sam" }), api(other, { action: "join", name: "Jo" })]);
const [pizza, , wine, water] = created.room.items;
await Promise.all([guest, other].map(token => api(token, { action: "claim", item: wine.id, include: true })));
let state = await api(host);
assert.equal(state.room.people.length, 3);
assert.deepEqual(state.room.items[2].weights, { [sam.me]: 1, [jo.me]: 1 });
assert.equal(totals(state.room).unclaimed, 400);
await api(host, { action: "lock", revision: state.revision }, 400);
await api(guest, { action: "assign", item: pizza.id, revision: 0, weights: {} }, 403);
await api(host, { action: "assign", item: pizza.id, revision: 0, weights: { [sam.me]: 1, [jo.me]: 3 } });
state = await api(host, { action: "claim", item: water.id, include: true });
assert.deepEqual(totals(state.room).balances, { [created.me]: 800, [sam.me]: 1300, [jo.me]: 2100 });
await api(host, { action: "lock", revision: state.revision });
await api(guest, { action: "claim", item: wine.id, include: false }, 409);
await api(guest, { action: "pay" });
state = await api(host);
assert.equal(state.room.people.find(p => p.id === sam.me).paid, true);
console.log("Three participants, concurrent claims, weighted dish, checkout lock and demo payment passed.");

const drinks = parseReceipt("3 x Cola 9.00\nTOTAL EUR 9.00");
assert.deepEqual(drinks, [{ name: "Cola", quantity: 3, amount: "9.00", category: "Drinks" }]);
const table = await api(host, { action: "create", title: "Three colas", name: "Alex", currency: "EUR", items: drinks, picks: [1] }, 201);
url.searchParams.set("id", table.id);
assert.equal(totals(table.room).balances[table.me], 300);
assert.equal(totals(table.room).unclaimed, 600);
const item = table.room.items[0].id;
await Promise.all([api(guest, {action:"join", name:"Sam"}), api(other, {action:"join", name:"Jo"})]);
await Promise.all([guest, other].map(token => api(token, {action:"claim", item, units:1})));
state = await api(host);
assert.deepEqual(Object.values(totals(state.room).balances), [300,300,300]);
await api(other, {action:"claim", item, units:2}, 409);
state = await api(guest, {action:"claim", item, units:0});
assert.equal(totals(state.room).unclaimed, 300);
await api(host, {action:"lock", revision:state.revision}, 400);
await api(other, {action:"claim", item, units:2});
console.log("Per-unit claims, release, totals, stock limits and partial checkout passed.");
