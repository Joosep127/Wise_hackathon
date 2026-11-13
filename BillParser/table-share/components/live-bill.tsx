"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GripVertical, MoreHorizontal, Plus, QrCode, Undo2, X } from "lucide-react";
import { available, sum, type BillRoom, type Pattern, type Selection, type Group } from "../lib/bill";
import { money, parseCents, type Item, type Room } from "../lib/split";
import { ActivePeople } from "./active-people";
import { ItemProgress, paidHistory, seatColor } from "./item-progress";
import { PaidItems } from "./paid-items";
import { DragTray, useGroupDrag } from "./group-drag";
import "./live-bill.css";

type Action = (cmd: {action:string; [key:string]:unknown}) => Promise<false | {room:Room} | {deleted:true}>;
type Sheet = "share" | "item" | "group" | "destinations" | "divide" | "checkout" | "edit" | "rename" | "confirm" | "";
type Suggestion = {pattern:Pattern; times:number; match:number};
const numberText = (n:number) => String(Math.round(n*1000)/1000);
const key = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), v => v.toString(16).padStart(2,"0")).join("");

function BillLine({item, mine, left, cap, paid, settled, showPayers, busy, amount, select, open, grip, quantityFor}:{
  item:Item; mine:number; left:number; busy:boolean; amount:(n:number)=>string; select:(n:number)=>void; open:()=>void;
  grip?:React.ReactNode; quantityFor:string; cap:number; paid:number; settled:boolean; showPayers:()=>void;
}) {
  const unit = item.cents / item.quantity;
  const qty = numberText(mine/unit);
  const [input,setInput] = useState(qty);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef([0,0]);
  const held = useRef(false);
  const row = useRef<HTMLElement>(null), height = useRef(0);
  useLayoutEffect(()=>{
    const el=row.current;
    if(!el)return;
    if(settled){if(height.current)el.style.minHeight=height.current+"px";return;}
    el.style.minHeight="";
    const measure=()=>{height.current=el.getBoundingClientRect().height;};
    measure();
    const observer=new ResizeObserver(measure);observer.observe(el);return ()=>observer.disconnect();
  },[settled]);
  const stop = () => clearTimeout(timer.current);
  useEffect(() => { setInput(qty); },[qty]);
  useEffect(() => stop, []);
  const whole = Math.min(item.quantity, Math.floor((left+0.499999)/unit));
  const remainder = Math.max(0, Math.round(left-whole*unit));
  if(settled)return <article ref={row} className="bill-line settled-line"><button className="settled-detail" onClick={showPayers} aria-label={"See who paid for "+item.name}>
    <span><s>{item.name}</s><small>{amount(paid)} paid</small></span><span>Paid ›</span></button></article>;
  return <article ref={row} className="bill-line">
    {grip}
    <button type="button" className="line-name" onContextMenu={e => e.preventDefault()}
      onPointerDown={e => { held.current=false; start.current=[e.clientX,e.clientY]; stop(); timer.current=setTimeout(() => { held.current=true; open(); },450); }}
      onPointerMove={e => { if (Math.abs(e.clientY-start.current[1])+Math.abs(e.clientX-start.current[0])>10) stop(); }} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
      onClick={() => { if(!held.current) open(); held.current=false; }}>
      <span>{item.name}</span><small>{item.quantity} ordered · {amount(item.cents)} total{item.quantity>1 && item.cents%item.quantity===0 ? " · "+amount(unit)+" each" : ""}</small>
      <small>{remainder>0?(whole>0?whole+" whole + "+amount(remainder)+" left":numberText(left/unit)+" left · "+amount(left)):whole+" whole left"}{paid>0?" · "+amount(paid)+" paid":""}</small>
    </button>
    <div className="bill-step"><button aria-label={"Remove one "+item.name} disabled={busy || !mine} onClick={() => select(Math.max(0,Math.round(mine-unit)))}>−</button>
      <input aria-label={quantityFor+" quantity of "+item.name} type="number" inputMode="decimal" step="any" min="0" max={numberText(cap/unit)} value={input} disabled={busy||(!mine&&!cap)}
        onFocus={e => e.target.select()} onChange={e => setInput(e.target.value)} onBlur={() => {
          const value=Number(input); setInput(qty);
          if(input!==qty && Number.isFinite(value) && value>=0) select(Math.min(cap,Math.round(value*unit)));
        }} onKeyDown={e => {if(e.key==="Enter") e.currentTarget.blur();}}/>
      <button aria-label={"Add one "+item.name} disabled={busy || !left} onClick={() => select(Math.min(cap,mine+(left-unit<0.99999?left:Math.max(1,Math.round(unit)))))}>+</button>
    </div>
  </article>;
}

export function LiveBill({room,me,id,revision,busy,act:send,token,error}:{
  room:BillRoom; me:string; id:string; revision:number; busy:boolean; act:Action; token:string; error:string;
}) {
  const board=room.board, host=room.host===me, mine=board.picks[me] ?? {};
  const history = useMemo(()=>paidHistory(room),[room]);
  const colors = useMemo(()=>Object.fromEntries(room.people.map((p,index)=>[p.id,seatColor(index,id)])),[room.people,id]);
  const progress = (item:Item) => <ItemProgress room={room} item={item} colors={colors} history={history}/>;
  const act:Action=cmd=>send({generation:board.generation??0,...cmd});
  // A settled row already on screen keeps its slot. On the next visit it lives
  // only under Paid items. Editable reservations never reorder the receipt.
  const [archivedOnEntry]=useState(()=>new Set(room.items.filter(i=>(board.paid[i.id]||0)>0 && (board.paid[i.id]||0)+(board.picks[room.host]?.[i.id]||0)>=i.cents).map(i=>i.id)));
  const selected=room.items.filter(i=>mine[i.id]);
  const amount=(n:number)=>money(n,room.currency);
  const [sheet,setSheet]=useState<Sheet>("");
  const [active,setActive]=useState("");
  const [editingFor,setEditingFor]=useState("");
  const [mode,setMode]=useState("units"),[value,setValue]=useState("");
  const [groupName,setGroupName]=useState(""),[groupId,setGroupId]=useState("");
  const [lane,setLane]=useState<"groups"|"mine">(host?"groups":"mine");
  const [destination,setDestination]=useState("");
  const [draft,setDraft]=useState<Selection>({});
  const [pending,setPending]=useState<Selection>({});
  const [groupTargets,setGroupTargets]=useState<string[]>([]);
  const [divideNew,setDivideNew]=useState(false);
  const [copied,setCopied]=useState(false),[sending,setSending]=useState(false),[notice,setNotice]=useState("");
  const [unitCount,setUnitCount]=useState("1"),[lineName,setLineName]=useState("");
  const [patterns,setPatterns]=useState<Suggestion[]>([]);
  const [checkout,setCheckout]=useState<{key:string; items:Selection; group?:string; name?:string}>({key:"",items:{}});
  const [confirm,setConfirm]=useState<{action:"deleteGroup"|"resetMine"|"resetTable"|"deleteTable";title:string;detail:string;group?:string;revision:number} | null>(null);
  const groupInput=useRef<HTMLInputElement>(null);
  const options=useRef<HTMLDetailsElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const lines=useRef<HTMLElement>(null);
  const assigning=host && lane==="groups";
  const openGroups=board.groups.filter(g=>!g.paidBy);
  const target=openGroups.find(g=>g.id===destination);
  const picking=assigning ? target?.items ?? draft : mine;
  const canSelectAll = room.items.some(i => available(i,board) > (assigning && !target ? draft[i.id] || 0 : 0));
  const payer=room.people.find(p=>p.id===room.host)?.name || "the organiser";
  const total=room.items.reduce((n,i)=>n+i.cents,0);
  const covered=sum(board.picks[room.host]??{})+sum(board.paid);
  const groupsSection=useRef<HTMLElement>(null);
  const item=room.items.find(i=>i.id===active);
  const link=typeof window==="undefined"?"":window.location.href.split("#")[0];
  const last=board.payments.at(-1);
  useEffect(()=>{ if(sheet) {dialog.current?.showModal();if(sheet==="group"||sheet==="rename"){groupInput.current?.focus();groupInput.current?.select();}} else dialog.current?.close(); },[sheet]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/rooms?id="+encodeURIComponent(id)+"&suggestions=1",{headers:{Authorization:"Bearer "+token},signal:controller.signal,cache:"no-store"})
      .then(async r=>{if(r.ok) setPatterns(await r.json() as Suggestion[]);}).catch(()=>{});
    return ()=>controller.abort();
  },[id,token,board.payments.length]);
  async function submit(cmd:Parameters<Action>[0]) { const result=await act(cmd); if(result)setSheet("");return result; }
  function focusGroup(id:string, scroll=true){
    setLane("groups");setDestination(id);setNotice("");
    if(scroll) lines.current?.scrollIntoView({block:"start"});
  }
  function newGroup(items:Selection={}){setPending({...items});setGroupName("Group "+(board.groups.length+1));setSheet("group");}
  function batch(all:boolean){
    setNotice("");
    if(assigning && !target) {
      setDraft(all?Object.fromEntries(room.items.map(i=>[i.id,available(i,board)] as const).filter(([,n])=>n>0)):{});
    } else if(assigning && target) void act({action:all?"selectAllForGroup":"clearGroupItems",group:target.id});
    else void act({action:all?"selectAll":"clearAll"});
  }
  function adjust(i:Item,cents:number,close=false){
    if(assigning && !target){
      if(cents>available(i,board)){setNotice("That amount is no longer available.");return;}
      setDraft(prev=>{const next={...prev};if(cents) next[i.id]=cents;else delete next[i.id];return next;});
      setNotice(""); if(close)setSheet(""); return;
    }
    const cmd=assigning && target ? {action:"setGroupItem",group:target.id,item:i.id,cents,previous:target.items[i.id]||0} : {action:"select",item:i.id,cents};
    if(close) void submit(cmd);else void act(cmd);
  }
  function openItem(i:Item){setActive(i.id);setEditingFor(assigning ? target?.id||"draft" : "own");setMode("units");setValue(numberText((picking[i.id]||0)*i.quantity/i.cents));setSheet("item");}
  function consume(items:Selection){
    setDraft(prev=>{const next={...prev};for(const [id,n] of Object.entries(items)){if(next[id]>n)next[id]-=n;else delete next[id];}return next;});
  }
  async function assign(items:Selection,group?:string,name?:string){
    const result=await submit(sum(items)?{action:"move",allocations:items,group,name}:{action:"createGroup",name});
    if(!result || !("room" in result))return;
    const dest=group?result.room.board?.groups.find(g=>g.id===group):result.room.board?.groups.at(-1);
    consume(items);
    if(dest && !sum(items))focusGroup(dest.id);
    setNotice(sum(items)?amount(sum(items))+" assigned to "+dest?.name+".":dest?.name+" is ready. Use + to add its items.");
  }
  function drop(to:string,items:Selection){
    if(to==="new")newGroup(items);else void assign(items,to);
  }
  const drag=useGroupDrag(drop);
  function payload(i:Item){
    // Drag staged items together; otherwise drag one unassigned unit (or the remaining fraction).
    if(!target && draft[i.id])return {items:{...draft},label:Object.keys(draft).length>1?"Selected items":i.name};
    return {items:{[i.id]:Math.max(0,Math.min(available(i,board),Math.max(1,Math.round(i.cents/i.quantity))))},label:i.name};
  }
  function pay(g?:Group){
    setCheckout({key:key(),items:{...(g?g.items:mine)},group:g?.id,name:g?.name});setSheet("checkout");
  }
  function confirmChange(action:"deleteGroup"|"resetMine"|"resetTable"|"deleteTable",g?:Group){
    if(options.current)options.current.open=false;
    const [title,detail]= action==="deleteGroup"?["Delete "+g!.name+"?",g!.paidBy?"The group will be removed. Its payment will stay in Paid items.":"Its assigned items will be available again. You can undo this group edit."]:
      action==="resetMine"?["Reset my activity?","Release your selections and reverse your demo payments on this table. Other people’s selections and payments stay as they are."]:
      action==="resetTable"?["Reset this table?","Restore the receipt and clear everyone’s selections, groups and demo payments. The people and invitation link stay."]:
      ["Delete this table?","Everyone will lose access to this bill, its payment history and its invitation link. This cannot be undone."];
    setConfirm({action,title,detail,group:g?.id,revision});setSheet("confirm");
  }
  async function copy(){
    try {
      if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
      else {
        const node=document.createElement("textarea");node.value=link;
        (dialog.current?.open?dialog.current:document.body).appendChild(node);node.select();
        const ok=document.execCommand("copy");node.remove();if(!ok)throw Error();
      }
      setCopied(true);setTimeout(()=>setCopied(false),1800);
    } catch {setSheet("share");}
  }
  const typed=Number(value);
  const raw=item ? mode==="percent" ? item.cents*typed/100 : mode==="ways" ? item.cents/typed : item.cents*typed/item.quantity : 0;
  const max=item ? available(item,board)+(assigning && !target ? 0 : picking[item.id]||0) : 0;
  // When the bill does not divide into whole cents the last share takes the remaining penny.
  const shareCents=mode==="ways" && Math.abs(raw-max)<1 ? max : Math.round(raw);
  const valid=value.trim()!=="" && Number.isFinite(raw) && typed>=0 && (mode!=="ways" || (Number.isInteger(typed)&&typed>=1)) && (mode!=="percent" || typed<=100) && shareCents<=max;
  return <div className="phone-bill">
    <div className="bill-tools"><details ref={options}><summary>Options <MoreHorizontal size={16}/></summary><div>
      {host && [...new Set(room.items.map(i=>i.category))].map(category=><button key={category} disabled={busy} onClick={()=>submit({action:"shareCategory",category})}>Split {category.toLowerCase()} among {room.people.length}</button>)}
      {host && <><button onClick={()=>{setActive(room.items[0].id);setLineName(room.items[0].name);setValue((room.items[0].cents/100).toFixed(2));setUnitCount(String(room.items[0].quantity));setSheet("edit");}}>Edit receipt line</button>
        <button disabled={busy || board.undo?.actor!==me || board.undo.revision!==revision} onClick={()=>submit({action:"undo"})}>Undo group edit</button>
        <button disabled={busy} onClick={()=>confirmChange("resetTable")}>Reset table</button>
        <button className="danger-text" disabled={busy} onClick={()=>confirmChange("deleteTable")}>Delete table</button></>}
      {!host && <button disabled={busy} onClick={()=>confirmChange("resetMine")}>Reset my activity</button>}
    </div></details><button className="copy-bill" onClick={()=>setSheet("share")}><QrCode size={18}/>Share QR</button></div>
    <div className="bill-heading"><h1>{room.title}</h1><b>{amount(room.items.reduce((n,i)=>n+i.cents,0))}</b></div>
    <ActivePeople id={id} token={token} me={me} people={room.people} colors={colors}/>
    <div className="bill-progress"><label htmlFor="bill-covered">Bill covered <b>{amount(covered)} / {amount(total)}</b></label>
      <progress id="bill-covered" value={covered} max={total}/>
      <small>{covered===total?"All shares covered":amount(total-covered)+" left"} · Includes the organiser’s share and completed payments</small></div>
    {host ? <div className="bill-modes" role="group" aria-label="Manage the receipt">
      <button aria-pressed={assigning} onClick={()=>{setLane("groups");setNotice("");}}>Assign to groups</button>
      <button aria-pressed={!assigning} onClick={()=>{setLane("mine");setNotice("");}}>My items · already paid</button>
    </div> : <button type="button" className="group-shortcut" onClick={()=>{groupsSection.current?.focus({preventScroll:true});groupsSection.current?.scrollIntoView({block:"start"});}}>View groups ↓</button>}
    <section ref={lines} className="receipt-lines"><h2>Bill items</h2>
      {assigning ? <>
        <p>Groups pay you back. Choose a group and use + to add what they had, or drag a receipt item by its grip.</p>
        <div className="group-destination"><label>Assign to<select value={target?.id||""} onChange={e=>{if(e.target.value==="new")newGroup();else focusGroup(e.target.value,false);}}>
          <option value="">Select items first</option>{openGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}<option value="new">+ New group</option>
        </select></label><button type="button" className="minor" disabled={busy} onClick={()=>newGroup()}><Plus size={16}/> New group</button></div>
        <p>{target ? "Editing "+target.name+" · "+amount(sum(target.items)) : "Use + to choose several items, then assign them together or split them equally."}</p>
      </> : <p>{host?"You already paid the restaurant. Mark only what you had.":"Choose what you had."} Tap or hold an item for a percentage or an equal split.</p>}
      <div className="batch-actions"><button disabled={busy || !canSelectAll} onClick={()=>batch(true)}>Select all</button><button disabled={busy||!sum(picking)} onClick={()=>batch(false)}>Clear all</button></div>
      {room.items.map(i=>{
        const own=board.picks[room.host]?.[i.id]||0, paid=board.paid[i.id]||0;
        if(!host && own===i.cents)return null;
        const settled=paid>0 && (host?paid===i.cents:own+paid>=i.cents);
        if(settled && archivedOnEntry.has(i.id))return null;
        const stock=available(i,board), picked=picking[i.id]||0;
        const left=assigning && !target ? Math.max(0,stock-picked):stock;
        return <div className="item-with-progress" key={i.id}><BillLine item={i} mine={picked} left={left} cap={stock+(assigning&&!target?0:picked)} paid={paid} settled={settled} showPayers={()=>{
          const line=document.getElementById("payers-"+i.id) as HTMLDetailsElement|null, panel=line?.parentElement?.closest("details");
          if(line && panel){panel.open=true;line.open=true;line.scrollIntoView({block:"center"});line.querySelector("summary")?.focus({preventScroll:true});}
        }} busy={busy} amount={amount} quantityFor={assigning?target?.name||"Group selection":"Your"}
          grip={assigning && <button type="button" className="group-grip" aria-label={"Assign "+i.name+" to a group"} title="Drag or tap to assign"
            disabled={busy || (stock<=0 && (!!target || !draft[i.id]))} onContextMenu={e=>e.preventDefault()}
            onPointerDown={e=>drag.begin(e,payload(i))} onClick={()=>{if(drag.tapped()){setPending(payload(i).items);setSheet("destinations");}}}><GripVertical size={19}/></button>}
          open={()=>openItem(i)} select={cents=>adjust(i,cents)}/>{progress(i)}</div>;
      })}
      {room.items.every(i=>(board.paid[i.id] || 0) + (board.picks[room.host]?.[i.id] || 0) === i.cents) && <p>All shares are covered.</p>}
    </section>
    {assigning && !target ? <section><div className="bill-section-title"><h2>Items to assign</h2><b>{amount(sum(draft))}</b></div>
      {sum(draft)>0 ? <>
        {room.items.filter(i=>draft[i.id]).map(i=><div className="pick-row" key={i.id}><button onClick={()=>openItem(i)}>{i.name}</button><b>{amount(draft[i.id])}</b></div>)}
        <div className="group-actions"><button disabled={busy} onClick={()=>{setPending({...draft});setSheet("destinations");}}>Assign to a group</button>
          <button disabled={busy} onClick={()=>{setPending({...draft});setDivideNew(openGroups.length<2);setValue("2");setGroupTargets(openGroups.map(g=>g.id));setSheet("divide");}}>Divide equally</button>
          </div>
      </> : <p>Items you choose here are for groups. Your own share stays separate.</p>}
    </section> : !assigning && <section><div className="bill-section-title"><h2>{host ? "Your share · already paid" : "Your selection"}</h2><b>{amount(sum(mine))}</b></div>
      {selected.length===0 && <p>Use + beside an item to add it.</p>}
      {selected.map(i=><div className="pick-row" key={i.id}><button onClick={()=>openItem(i)}>{i.name}</button><b>{amount(mine[i.id])}</b></div>)}</section>}
    {host && notice && <p className="bill-feedback" role="status">{notice}</p>}
    <section id="payment-groups" ref={groupsSection} tabIndex={-1} aria-label="Groups"><div className="bill-section-title"><h2>Groups</h2>{host && <button disabled={busy || board.undo?.actor!==me || board.undo.revision!==revision} onClick={async()=>{if(await submit({action:"undo"}))setNotice("Group edit undone.");}}><Undo2 size={15}/> Undo</button>}</div>
      <p>{host?"Give each group the items they owe you for.":"Someone from each group can pay its total to "+payer+"."}</p>
      {host && <button disabled={busy} className={"new-group "+(drag.over==="new"?"over":"")} data-group-drop="new" onClick={()=>newGroup()}><Plus/> New group</button>}
      {board.groups.map(g=><div className={"bill-group "+(drag.over===g.id?"over":"")} key={g.id} data-group-drop={host&&!g.paidBy?g.id:undefined}>
        <div className="bill-section-title"><strong>{g.name}</strong><b>{amount(sum(g.items))}</b></div>
        <small>{room.items.filter(i=>g.items[i.id]).map(i=>i.name+" "+amount(g.items[i.id])).join(" · ")||"No items assigned yet"}</small>
        {g.paidBy ? <div className="group-actions"><span className="paid-label">Paid by {room.people.find(p=>p.id===g.paidBy)?.name}</span>{host && <button className="danger-text" onClick={()=>confirmChange("deleteGroup",g)}>Delete group</button>}</div>
          : <div className="group-actions">{host ? <>
            <button disabled={busy} onClick={()=>focusGroup(g.id)}>Edit items</button>
            {assigning && !target && sum(draft)>0 && <button disabled={busy} onClick={()=>drop(g.id,{...draft})}>Assign selected here</button>}
            <button onClick={()=>{setGroupId(g.id);setGroupName(g.name);setSheet("rename");}}>Rename</button><button className="danger-text" disabled={busy} onClick={()=>confirmChange("deleteGroup",g)}>Delete group</button></>
          : <button disabled={!sum(g.items)||busy} onClick={()=>pay(g)}>Pay for {g.name}</button>}</div>}
      </div>)}
      {!host && !board.groups.length && <p>No groups yet. You can choose your own items above.</p>}
    </section>
    <PaidItems room={room} amount={amount} history={history} progress={progress}/>
    {!assigning && <section><h2>Reuse a selection</h2>{!last && !patterns.length && <p>Paid selections will appear here.</p>}
      {last && <button className="template" disabled={busy} onClick={()=>submit({action:"applyPattern",pattern:last.pattern})}><strong>Last Payment</strong><small>{last.pattern.map(p=>p.name).join(" + ")}</small></button>}
      {patterns.map((s,index)=><button key={index} className="template" disabled={busy} onClick={()=>submit({action:"applyPattern",pattern:s.pattern})}><strong>{s.pattern.map(p=>p.name).join(" + ")}</strong><small>{s.times}× used · {Math.round(s.match*100)}% match</small></button>)}
    </section>}
    {!host && <div className="pay-bar">{notice && <small role="status">{notice}</small>}<button className="primary" disabled={!sum(mine)||busy} onClick={()=>pay()}>Pay my share <b>{amount(sum(mine))}</b></button></div>}
    <DragTray groups={openGroups} drag={drag}/>
    <dialog ref={dialog} className="bill-sheet" onCancel={e=>{if(sending)e.preventDefault();else setSheet("");}}><button aria-label="Close" className="close" disabled={sending} onClick={()=>setSheet("")}><X/></button>
      {sheet==="share" && <><h2>Join this bill</h2><div className="qr"><QRCodeSVG value={link} size={180} marginSize={2}/></div><input aria-label="Bill link" value={link} readOnly onFocus={e=>e.target.select()}/><button className="primary" onClick={copy}>{copied?"Copied":"Copy link"}</button></>}
      {sheet==="item" && item && <><h2>{item.name}</h2><p>{amount(item.cents)} for {item.quantity} ordered</p>
        <label>Choose by<select value={mode} onChange={e=>{setMode(e.target.value);setValue(e.target.value==="ways"?"3":e.target.value==="percent"?"50":"1");}}><option value="units">Quantity</option><option value="percent">Percentage of line</option><option value="ways">Split equally</option></select></label>
        <label>{mode==="ways"?"Number of ways":mode==="percent"?"Percentage":"Quantity"}<input type="number" step="any" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label>
        <p>{valid?(assigning?(target?.name||"To assign"):"Your share")+": "+amount(shareCents):"Available: "+amount(max)}</p>
        <button className="primary" disabled={!valid||busy||editingFor!==(assigning?target?.id||"draft":"own")} onClick={()=>adjust(item,shareCents,true)}>{assigning?"Set group amount":"Apply share"}</button></>}
      {sheet==="destinations" && <><h2>Assign to a group</h2><p>{room.items.filter(i=>pending[i.id]).map(i=>i.name).join(" + ")} · {amount(sum(pending))}</p>
        <button className="new-group" onClick={()=>newGroup(pending)}><Plus/> New group</button>
        {openGroups.map(g=><button className="destination-choice" key={g.id} disabled={busy} onClick={()=>drop(g.id,pending)}>{g.name}</button>)}</>}
      {(sheet==="group"||sheet==="rename") && <><h2>{sheet==="rename"?"Rename group":"New group"}</h2>
        {sheet==="group" && <p>{sum(pending)?"Assign "+amount(sum(pending))+" of receipt items to this group.":"Name the group, then choose its receipt items."}</p>}
        <form onSubmit={e=>{e.preventDefault();if(sheet==="rename")void submit({action:"renameGroup",group:groupId,name:groupName});else void assign(pending,undefined,groupName.trim()||"Group "+(board.groups.length+1));}}>
          <label>Group name<input ref={groupInput} autoFocus maxLength={40} value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder={"Group "+(board.groups.length+1)}/></label>
          <button className="primary" disabled={busy||(sheet==="rename"&&!groupName.trim())}>Save group</button></form></>}
      {sheet==="divide" && <><h2>Divide {amount(sum(pending))} equally</h2><label>Destination<select value={divideNew?"new":"existing"} onChange={e=>setDivideNew(e.target.value==="new")}><option value="new">Create new groups</option><option value="existing" disabled={openGroups.length<2}>Existing groups</option></select></label>
        {divideNew?<label>How many groups?<input type="number" min={2} max={50} value={value} onChange={e=>setValue(e.target.value)}/></label>:openGroups.map(g=><label className="check-group" key={g.id}><input type="checkbox" checked={groupTargets.includes(g.id)} onChange={()=>setGroupTargets(groupTargets.includes(g.id)?groupTargets.filter(k=>k!==g.id):[...groupTargets,g.id])}/>{g.name}</label>)}
        <button className="primary" disabled={busy || (divideNew?(!Number.isInteger(typed)||typed<2||typed>50):groupTargets.filter(id=>openGroups.some(g=>id===g.id)).length<2)} onClick={async()=>{const targets=groupTargets.filter(id=>openGroups.some(g=>id===g.id));if(await submit({action:"divide",allocations:pending,...(divideNew?{pieces:typed}:{targets})})){consume(pending);setNotice("Divided "+amount(sum(pending))+" between "+(divideNew?typed:targets.length)+" groups.");}}}>Divide items</button></>}
      {sheet==="edit"&&item&&<><h2>Edit receipt</h2><label>Line<select value={active} onChange={e=>{const i=room.items.find(i=>i.id===e.target.value)!;setActive(i.id);setLineName(i.name);setValue((i.cents/100).toFixed(2));setUnitCount(String(i.quantity));}}>{room.items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>Name<input value={lineName} onChange={e=>setLineName(e.target.value)}/></label><label>Quantity<input type="number" value={unitCount} onChange={e=>setUnitCount(e.target.value)}/></label><label>Line total<input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="primary" disabled={busy} onClick={()=>submit({action:"editLine",item:active,name:lineName,quantity:Number(unitCount),cents:parseCents(value)})}>Save line</button></>}
      {!host && sheet==="checkout"&&<><h2>{checkout.group?"Pay for "+checkout.name:"Pay your share"}</h2><p>Demo payment to {payer}</p>
        {room.items.filter(i=>checkout.items[i.id]).map(i=><div className="bill-section-title" key={i.id}><span>{i.name}</span><b>{amount(checkout.items[i.id])}</b></div>)}
        <button className="primary" disabled={busy||sending} onClick={async()=>{setSending(true);await new Promise(r=>setTimeout(r,1800));const ok=await submit({action:"settle",key:checkout.key,group:checkout.group,expected:checkout.items});setSending(false);if(ok)setNotice("Demo payment to "+payer+" · "+amount(sum(checkout.items)));}}>{sending?"Sending…":"Send money · "+amount(sum(checkout.items))}</button></>}
      {sheet==="confirm" && confirm && <><h2>{confirm.title}</h2><p>{confirm.detail}</p><div className="confirm-actions">
        <button className="secondary" disabled={busy} onClick={()=>setSheet("")}>Cancel</button>
        <button className="confirm-danger" disabled={busy} onClick={async()=>{const result=await submit({action:confirm.action,group:confirm.group,revision:confirm.revision});if(result&&confirm.action!=="deleteTable"){setNotice(confirm.action==="deleteGroup"?"Group deleted.":confirm.action==="resetMine"?"Your activity was reset.":"Table reset.");}}}>
          {confirm.action==="deleteGroup"?"Delete group":confirm.action==="resetMine"?"Reset my activity":confirm.action==="resetTable"?"Reset table":"Delete table"}</button></div></>}
      {error && <p className="error" role="alert">{error}</p>}
    </dialog>
  </div>;
}
