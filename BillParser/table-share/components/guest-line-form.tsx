"use client";
import { useState } from "react";
import { categories, parseCents } from "../lib/split";
import type { BillAction } from "../lib/bill";

export function GuestLineForm({busy, currency, save}: {
  busy:boolean; currency:string; save:(action:BillAction)=>unknown;
}) {
  const [name,setName]=useState("");
  const [quantity,setQuantity]=useState("1");
  const [total,setTotal]=useState("");
  const [category,setCategory]=useState("Food");
  const [key]=useState(()=>Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,"0")).join(""));
  const cents=parseCents(total), count=Number(quantity);
  const valid=name.trim().length>0 && name.trim().length<=100 && Number.isInteger(count) && count>0 && count<=9999 && cents>0 && cents<=99999999;
  return <form onSubmit={event=>{
    event.preventDefault();
    if(valid && !busy) save({action:"addLine",key,name,quantity:count,cents,category});
  }}>
    <h2>Add a receipt line</h2>
    <p>Missing an item? Add it for everyone to see and select.</p>
    <label>Name<input autoFocus required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Quantity<input required type="number" inputMode="numeric" min="1" max="9999" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>Line total ({currency})<input required inputMode="decimal" placeholder="0.00" value={total} onChange={e=>setTotal(e.target.value)}/></label>
    <p>Enter the total for all units, not the price per unit.</p>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(value=><option key={value}>{value}</option>)}</select></label>
    <button className="primary" disabled={busy || !valid}>Add line</button>
  </form>;
}
