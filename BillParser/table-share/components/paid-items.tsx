"use client";
import type { ReactNode } from "react";
import { sum, type BillRoom } from "../lib/bill";
import type { Item } from "../lib/split";
import type { paidHistory } from "./item-progress";

export function PaidItems({room, amount, history, progress}:{room:BillRoom; amount:(n:number)=>string; history:ReturnType<typeof paidHistory>; progress:(i:Item)=>ReactNode}) {
  const paid=room.board.paid;
  const lines=room.items.filter(i=>paid[i.id]>0);
  if(!lines.length)return null;
  return <section className="paid-section"><details>
    <summary><span>Paid items <small>({lines.length})</small></span><b>{amount(sum(paid))}</b></summary>
    {lines.map(i=>{
      const paidBy=history[i.id]||{},unattributed=paid[i.id]-sum(paidBy);
      return <details className="paid-line" id={"payers-"+i.id} key={i.id}><summary><span>{i.name}</span><b>{amount(paid[i.id])}</b></summary>
        {progress(i)}
        {Object.entries(paidBy).map(([person,n])=><div key={person}><span>{room.people.find(p=>p.id===person)?.name||"Guest"}</span><b>{amount(n)}</b></div>)}
        {unattributed>0 && <div><span>Older payment · payer unavailable</span><b>{amount(unattributed)}</b></div>}
      </details>;
    })}
  </details></section>;
}
