import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { rooms } from "../../../db/schema";
import { categories, countsUnits, currencies, parseCents, receiptQuantity, remainingUnits, totals, type Room, type Draft } from "../../../lib/split";

class InputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function check(test: unknown, reason: string, status = 400): asserts test {
  if (!test) throw new InputError(reason, status);
}
function label(value: unknown, max: number) {
  check(typeof value === "string" && value.trim().length > 0 && value.trim().length <= max, "Enter a valid name.");
  return value.trim();
}
function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
async function identity(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  check(token && /^[a-f0-9]{64}$/.test(token), "Reopen the table to continue.", 401);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
}
async function read(id: string) {
  const row = await getDb().select().from(rooms).where(eq(rooms.id, id)).get();
  check(row, "This table could not be found.", 404);
  const room = JSON.parse(row.body) as Room;
  for (const item of room.items) {
    if (item.quantity === undefined) {
      Object.assign(item, receiptQuantity(item.name));
      // Keep existing balances when an older table already split the whole line.
      item.sharedPortions = item.quantity > 1 && Object.keys(item.weights).length > 0;
    }
  }
  return { room, revision: row.revision };
}
type Command = {
  action: string; name?: string; title?: string; currency?: string; items?: Draft[]; picks?: (boolean | number)[];
  item?: string; weights?: Record<string, number>; include?: boolean; category?: string;
  everyone?: boolean; revision?: number; units?: number; sharedPortions?: boolean;
};
function change(room: Room, actor: string, cmd: Command, revision: number) {
  const member = room.people.find(p => p.id === actor);
  if (cmd.action === "join") {
    if (member) return;
    check(!room.locked && room.people.length < 50, "This table is closed to new guests.");
    room.people.push({ id: actor, name: label(cmd.name, 32), paid: false });
    return;
  }
  check(member, "Join this table first.", 403);
  if (cmd.action === "pay") {
    check(room.locked && actor !== room.host, "Checkout is unavailable.");
    member.paid = true;
    return;
  }
  check(!room.locked, "The split has been locked.", 409);
  if (cmd.action === "claim") {
    const item = room.items.find(i => i.id === cmd.item);
    check(item && !item.everyone, "The split rule has changed.", 409);
    if (countsUnits(item)) {
      const units = cmd.units;
      check(typeof units === "number" && Number.isInteger(units) && units >= 0, "Choose how many you had.");
      check(units <= remainingUnits(item) + (item.weights[actor] || 0), "Someone claimed the last one. Check the quantity left.", 409);
      if (units) item.weights[actor] = units;
      else delete item.weights[actor];
    } else {
      check(typeof cmd.include === "boolean", "The split rule has changed.", 409);
      if (cmd.include) item.weights[actor] ||= 1;
      else delete item.weights[actor];
    }
    item.revision++;
    return;
  }
  check(room.host === actor, "Only the organiser can change the split rules.", 403);
  if (cmd.action === "lock") {
    check(cmd.revision === revision, "The table changed. Review the latest totals and try again.", 409);
    check(!totals(room).incomplete, "Assign every item before checkout.");
    room.locked = true;
  } else if (cmd.action === "category") {
    check(cmd.revision === revision, "The table changed. Review the category and try again.", 409);
    check(room.items.some(i => i.category === cmd.category) && typeof cmd.everyone === "boolean", "Choose a category and rule.");
    for (const item of room.items.filter(i => i.category === cmd.category)) {
      item.everyone = cmd.everyone;
      item.sharedPortions = false;
      item.weights = {};
      item.revision++;
    }
  } else if (cmd.action === "assign") {
    const item = room.items.find(i => i.id === cmd.item);
    check(item && cmd.revision === item.revision, "This item changed. Reopen its split settings.", 409);
    check(cmd.weights && typeof cmd.weights === "object" && !Array.isArray(cmd.weights), "Choose portions.");
    for (const [id, weight] of Object.entries(cmd.weights)) {
      check(room.people.some(p => p.id === id) && Number.isInteger(weight) && weight >= 1 && weight <= 10000, "Use whole portions between 1 and 10,000.");
    }
    item.everyone = false;
    item.sharedPortions = cmd.sharedPortions === true;
    item.weights = cmd.weights;
    check(!countsUnits(item) || remainingUnits(item) >= 0, "Assigned quantity exceeds the number ordered.");
    item.revision++;
  } else throw new InputError("Unknown action.");
}
function fail(error: unknown) {
  if (error instanceof InputError) return reply({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return reply({ error: "Invalid request." }, 400);
  console.error("Room request failed", error);
  return reply({ error: "Could not reach the table. Try again." }, 500);
}
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    return reply({ ...(await read(id)), id, me: await identity(req) });
  } catch (e) { return fail(e); }
}
export async function POST(req: Request) {
  try {
    const actor = await identity(req);
    const cmd = await req.json() as Command;
    check(cmd && typeof cmd.action === "string", "Choose an action.");
    if (cmd.action === "create") {
      check(Array.isArray(cmd.items) && cmd.items.length > 0 && cmd.items.length <= 150, "Use 1 to 150 receipt lines.");
      check(currencies.includes(cmd.currency || ""), "Choose a supported currency.");
      if (cmd.picks !== undefined) check(Array.isArray(cmd.picks) && cmd.picks.length === cmd.items.length, "Review your item choices.");
      const room: Room = {
        title: label(cmd.title, 80), host: actor, currency: cmd.currency!, locked: false,
        people: [{ id: actor, name: label(cmd.name, 32), paid: false }],
        items: cmd.items.map((row, index) => {
          check(row && categories.includes(row.category), "Choose a category for each item.");
          const cents = parseCents(row.amount);
          check(cents > 0, "Enter a positive price with up to two decimal places.");
          const name = label(row.name, 100);
          const product = row.quantity === undefined ? receiptQuantity(name) : { name, quantity: row.quantity };
          check(Number.isInteger(product.quantity) && product.quantity >= 1 && product.quantity <= 999, "Quantity must be between 1 and 999.");
          const pick = cmd.picks?.[index] ?? 0;
          const units = typeof pick === "boolean" ? Number(pick) : pick;
          check(Number.isInteger(units) && units >= 0 && units <= product.quantity, "Review the number of items chosen.");
          const weights: Record<string, number> = units ? { [actor]: units } : {};
          return { id: crypto.randomUUID(), ...product, cents, category: row.category, everyone: cmd.picks === undefined && row.category !== "Drinks", weights, revision: 0 };
        }),
      };
      const id = crypto.randomUUID();
      await getDb().insert(rooms).values({ id, revision: 0, body: JSON.stringify(room) });
      return reply({ room, id, me: actor, revision: 0 }, 201);
    }
    const id = new URL(req.url).searchParams.get("id") || "";
    for (let i = 0; i < 6; i++) {
      const { room, revision } = await read(id);
      change(room, actor, cmd, revision);
      const updated = await getDb().update(rooms).set({ body: JSON.stringify(room), revision: revision + 1 })
        .where(and(eq(rooms.id, id), eq(rooms.revision, revision))).returning({ id: rooms.id });
      if (updated.length) return reply({ room, id, revision: revision + 1, me: actor });
    }
    throw new InputError("The table is busy. Try again.", 409);
  } catch (e) { return fail(e); }
}
