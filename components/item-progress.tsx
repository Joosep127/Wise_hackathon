import { paymentLines, type BillRoom } from "../lib/bill";
import type { Item } from "../lib/split";

type Share = { name: string; color: string; cents: number; state: "picked" | "paid" | "assigned" };

// Membership is append-only, including across resets. Golden-angle spacing keeps
// successive guests visually distinct and gives all 50 seats a unique hue.
export function seatColor(index: number, table: string) {
  const seed = parseInt(table.slice(0, 4), 16) || 0;
  return "hsl(" + Math.round((seed + index * 137.508) % 360) + " 55% 42%)";
}

export function paidHistory(room: BillRoom) {
  const history: Record<string, Record<string, number>> = {};
  for (const payment of room.board.payments) {
    for (const [id, cents] of Object.entries(paymentLines(room, payment) ?? {})) {
      const people = history[id] ??= {};
      people[payment.actor] = (people[payment.actor] || 0) + cents;
    }
  }
  return history;
}

export function ItemProgress({ room, item, colors, history }: {
  room: BillRoom; item: Item; colors: Record<string,string>; history: ReturnType<typeof paidHistory>;
}) {
  const shares: Share[] = [];
  let unattributed = room.board.paid[item.id] || 0;
  for (const p of room.people) {
    const picked = room.board.picks[p.id]?.[item.id] || 0;
    const paid = history[item.id]?.[p.id] || 0;
    if (picked) shares.push({name:p.name, color:colors[p.id], cents:picked, state:p.id===room.host?"paid":"picked"});
    if (paid) shares.push({name:p.name, color:colors[p.id], cents:paid, state:"paid"});
    unattributed -= paid;
  }
  if (unattributed > 0) shares.push({name:"Earlier payment", color:"#62686a", cents:unattributed, state:"paid"});
  for (const g of room.board.groups) {
    if (!g.paidBy && g.items[item.id]) shares.push({name:g.name, color:"#696573", cents:g.items[item.id], state:"assigned"});
  }
  const percent = (n:number) => (100*n/item.cents).toLocaleString("en",{maximumFractionDigits:2})+"%";
  return <div className="item-progress" aria-label={item.name+" shares"}>
    <span className="share-track" aria-hidden="true">{shares.map((s,i)=><i key={i} data-state={s.state} style={{backgroundColor:s.color,width:(100*s.cents/item.cents)+"%"}}/>)}</span>
    {shares.length>0 && <span className="share-key">{shares.map((s,i)=><span key={i}><i style={{backgroundColor:s.color}}/>{s.name} {percent(s.cents)} {s.state}</span>)}</span>}
  </div>;
}
