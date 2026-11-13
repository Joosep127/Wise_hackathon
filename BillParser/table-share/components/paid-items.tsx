"use client";
import { useMemo } from "react";
import { paymentLines, sum, type BillRoom } from "../lib/bill";

export function PaidItems({room, amount}:{room:BillRoom; amount:(n:number)=>string}) {
  const paid=room.board.paid;
  const history=useMemo(()=>{
    const result:Record<string,Record<string,number>>={};
    for(const payment of room.board.payments){
      for(const [id,n] of Object.entries(paymentLines(room,payment)??{})){
        const people=result[id]??={};
        people[payment.actor]=(people[payment.actor]||0)+n;
      }
    }
    return result;
  },[room]);
  const lines=room.items.filter(i=>paid[i.id]>0);
  if(!lines.length)return null;
  return <section className="paid-section"><details>
    <summary><span>Paid items <small>({lines.length})</small></span><b>{amount(sum(paid))}</b></summary>
    {lines.map(i=>{
      const paidBy=history[i.id]||{},unattributed=paid[i.id]-sum(paidBy);
      return <details className="paid-line" id={"payers-"+i.id} key={i.id}><summary><span>{i.name}</span><b>{amount(paid[i.id])}</b></summary>
        {Object.entries(paidBy).map(([person,n])=><div key={person}><span>{room.people.find(p=>p.id===person)?.name||"Guest"}</span><b>{amount(n)}</b></div>)}
        {unattributed>0 && <div><span>Older payment · payer unavailable</span><b>{amount(unattributed)}</b></div>}
      </details>;
    })}
  </details></section>;
}
