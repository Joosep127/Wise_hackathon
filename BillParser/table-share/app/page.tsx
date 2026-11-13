"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Camera, Check, ChevronLeft, CirclePlus, ClipboardList, Copy, LoaderCircle, LockKeyhole, Plus, QrCode, ReceiptText, Settings2, Share2, Trash2, Users, Utensils, Wallet, Wine, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { LiveBill } from "../components/live-bill";
import { parseReceiptBlock } from "../lib/split";
import type { BillRoom } from "../lib/bill";
import { createReceiptScanner, prepareReceiptPhoto } from "../lib/receipt-scanner";
import { allocation, categories, countsUnits, currencies, money, parseCents, parseReceipt, remainingUnits, sample, totals, type Category, type Draft, type Item, type Room } from "../lib/split";

type Snapshot = { id: string; me: string; revision: number; room: Room };
type Deleted = { id: string; deleted: true };
class TableUnavailable extends Error {}
type Saved = { id: string; title: string };
type Screen = "home" | "review" | "table";
const emptyRow = (): Draft => ({ name: "", amount: "", quantity: 1, category: "Food" });
function QuantityPicker({ name, value, max, disabled, change }: {
  name: string; value: number; max: number; disabled?: boolean; change: (value: number) => void;
}) {
  return <div className="quantity-picker" role="group" aria-label={name + " quantity"}>
    <button type="button" disabled={disabled || value === 0} aria-label={"Release one " + name} onClick={() => change(value - 1)}>−</button>
    <span aria-live="polite">{value} yours</span>
    <button type="button" disabled={disabled || value >= max} aria-label={"Claim one " + name} onClick={() => change(value + 1)}>+</button>
  </div>;
}
function sessionKey(id: string) {
  const key = "tableshare.identity." + id;
  let token = localStorage.getItem(key);
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(key, token);
  }
  return token;
}
async function request(id: string, token: string, cmd?: object): Promise<Snapshot | Deleted> {
  const response = await fetch("/api/rooms?id=" + encodeURIComponent(id), {
    method: cmd ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: cmd ? JSON.stringify(cmd) : undefined,
  });
  const data = await response.json() as (Snapshot | Deleted) & { error?: string };
  if (response.status === 404) throw new TableUnavailable("This table was deleted or its link is no longer available.");
  if (!response.ok) throw new Error(data.error || "Could not open the table.");
  return data;
}
const errorText = (e: unknown) => e instanceof Error ? e.message : "Something went wrong. Please try again.";
const CategoryIcon = ({ category }: { category: Category }) => category === "Food" ? <Utensils/> : category === "Drinks" ? <Wine/> : <ReceiptText/>;

function SampleReceipt() {
  return <div className="tablecloth" aria-label="Example restaurant receipt">
    <div className="paper-shadow"><div className="paper">
      <div className="receipt-icon"><Utensils size={24}/></div>
      <h2>OSTERIA LUNA</h2><div className="paper-sub">DINNER RECEIPT</div>
      <div className="ticket-meta"><span>TABLE 04</span><span>GUESTS 03</span></div>
      {sample.map(s => <div className="ticket-line" key={s.name}><span>{s.name}</span><span>{s.amount}</span></div>)}
      <div className="ticket-total"><span>TOTAL</span><span>€42.00</span></div>
      <div className="barcode" aria-hidden="true"/><small>GRAZIE MILLE</small>
    </div></div>
  </div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [id, setId] = useState("");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [name, setName] = useState(""), [title, setTitle] = useState(""), [currency, setCurrency] = useState("EUR");
  const [rows, setRows] = useState<Draft[]>([emptyRow()]);
  const [busy, setBusy] = useState(false), [scan, setScan] = useState(""), [error, setError] = useState(""), [offline, setOffline] = useState(false);
  const [ocrNote, setOcrNote] = useState("");
  const [hostScan, setHostScan] = useState(false);
  const [picks, setPicks] = useState<number[] | null>(null);
  const [sharePortions, setSharePortions] = useState(false);
  const [share, setShare] = useState(false), [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<Item | null>(null), [weights, setWeights] = useState<Record<string, number>>({});
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [scanner] = useState(() => createReceiptScanner(percent => setScan("Reading receipt · " + percent + "%")));
  useEffect(() => () => scanner.release(), [scanner]);
  const dialog = useRef<HTMLDialogElement>(null);
  const activeId = useRef("");
  function navigate(next: Screen, room = "") {
    activeId.current = room; setId(room); setScreen(next); setSnap(null); setError(""); setOffline(false);
    setEditor(null); setShare(false); setCopied(false);
    const url = new URL(location.href);
    if (room) url.searchParams.set("table", room); else url.searchParams.delete("table");
    history.replaceState(null, "", url);
  }
  useEffect(() => {
    void fetch("/api/receipt").then(r => r.json()).then(data => setHostScan((data as { available?: boolean }).available === true)).catch(() => {});
    try { setSaved(JSON.parse(localStorage.getItem("tableshare.tables") || "[]")); setName(localStorage.getItem("tableshare.name") || ""); } catch {}
    const room = new URL(location.href).searchParams.get("table");
    if (room) navigate("table", room);
  }, []);
  function remember(data: Snapshot) {
    const list: Saved[] = JSON.parse(localStorage.getItem("tableshare.tables") || "[]");
    const next = [{ id: data.id, title: data.room.title }, ...list.filter(t => t.id !== data.id)].slice(0, 8);
    localStorage.setItem("tableshare.tables", JSON.stringify(next)); setSaved(next);
    if (name.trim()) localStorage.setItem("tableshare.name", name.trim());
  }
  function accept(data: Snapshot) {
    if (activeId.current === data.id) setSnap(prev => prev?.id === data.id && prev.revision >= data.revision ? prev : data);
  }
  function forget(id:string, message:string) {
    const tables:Saved[]=JSON.parse(localStorage.getItem("tableshare.tables")||"[]");
    const rest=tables.filter(t=>t.id!==id);
    localStorage.setItem("tableshare.tables",JSON.stringify(rest));setSaved(rest);
    if(activeId.current===id){navigate("home");setError(message);}
  }
  useEffect(() => {
    if (!id) return;
    let running = true;
    let loading = false;
    let timeout: ReturnType<typeof setTimeout>;
    async function refresh() {
      clearTimeout(timeout);
      if (!running || loading || document.hidden) return;
      loading = true;
      try {
        const next = await request(id, sessionKey(id));
        if (running && !("deleted" in next)) { accept(next); setOffline(false); }
      } catch (e) { if (running) {
        if(e instanceof TableUnavailable) { forget(id,e.message); return; }
        setOffline(true); setError(errorText(e));
      } }
      loading = false;
      if (running && !document.hidden) timeout = setTimeout(refresh, 1000);
    }
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { running = false; clearTimeout(timeout); document.removeEventListener("visibilitychange", refresh); };
  }, [id]);
  useEffect(() => {
    if (share || editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [share, editor]);
  function review(demo: boolean) {
    setPicks(null);
    setRows(demo ? sample.map(i => ({ ...i })) : [emptyRow()]); setTitle(demo ? "Osteria Luna" : ""); setCurrency("EUR"); setOcrNote(""); navigate("review");
  }
  function choosePhoto(useCamera = false) {
    if (!hostScan) {
      void scanner.acquire().catch(() => {});
      scanner.idle();
    }
    (useCamera ? camera : upload).current?.click();
  }
  async function scanPhoto(file?: File) {
    if (!file) return;
    review(false); setScan("Reading receipt…");
    try {
      const image = await prepareReceiptPhoto(file, hostScan);
      let text = "";
      if (hostScan && image.size <= 8 * 1024 * 1024) {
        try {
          const response = await fetch("/api/receipt", { method: "POST", body: image, headers: { "X-Receipt-Scan": "1" }, signal: AbortSignal.timeout(9000) });
          if (response.ok) text = await response.text();
        } catch { /* The on-device reader is available when the Mac is busy or unreachable. */ }
      }
      let parsed = parseReceipt(text);
      if (!parsed.length) {
        setScan("Reading on this device…");
        const worker = await scanner.acquire();
        let { data } = await worker.recognize(image);
        parsed = parseReceipt(data.text);
        if (image !== file && (!parsed.length || data.confidence < 65)) {
          setScan("Checking the full-size photo…");
          const full = (await worker.recognize(file)).data;
          const fullRows = parseReceipt(full.text);
          if (fullRows.length > parsed.length || (fullRows.length === parsed.length && full.confidence >= data.confidence)) {
            data = full;
            parsed = fullRows;
          }
        }
        text = data.text;
        if (!parsed.length) {
          const { PSM } = await import("tesseract.js");
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
          try {
            const block = await worker.recognize(file);
            parsed = parseReceiptBlock(block.data.text);
          } finally {
            await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
          }
        }
        scanner.idle();
      }
      setRows(parsed.length ? parsed : [emptyRow()]);
      setPicks(parsed.length ? parsed.map(() => 0) : null);
      const merchant = text.split(/\r?\n/).find(l => /[a-z]{3}/i.test(l))?.trim().replace(/\s+[:;](?=&)/g, " ").slice(0, 80) || "Dinner";
      setTitle(merchant);
      setOcrNote(parsed.length ? "Check the items and total against your receipt, including tax and service." : "No prices were recognised. Enter the receipt lines below.");
      if (parsed.length) {
        setPicks(null);
        const detectedCurrency = /\bUSD\b|\$/.test(text) ? "USD" : /\bGBP\b|£/.test(text) ? "GBP" : "EUR";
        setCurrency(detectedCurrency);
        await act({ action:"create", liveBill:true, name:name.trim() || "Organiser", title:merchant, currency:detectedCurrency, items:parsed });
      }
    } catch { scanner.release(); setOcrNote("The photo could not be read. Enter the items below or try another photo."); }
    finally { setScan(""); if (upload.current) upload.current.value = ""; if (camera.current) camera.current.value = ""; }
  }
  async function act(cmd: { action: string; [key: string]: unknown }) {
    setBusy(true); setError("");
    try {
      const creating = cmd.action === "create";
      const token = sessionKey(creating ? "organiser" : id);
      const data = await request(id, token, cmd);
      if ("deleted" in data) { forget(data.id,"The table has been deleted."); return data; }
      if (creating) { localStorage.setItem("tableshare.identity." + data.id, token); navigate("table", data.id); }
      if (creating || cmd.action === "join") remember(data);
      accept(data); setEditor(null); return data;
    } catch (e) { if (e instanceof TableUnavailable) forget(id,e.message); else setError(errorText(e)); return false; }
    finally { setBusy(false); }
  }
  function editRow(index: number, patch: Partial<Draft>) { setRows(rows.map((r, i) => i === index ? { ...r, ...patch } : r)); }
  const room = snap?.room;
  const me = room?.people.find(p => p.id === snap?.me);
  const host = !!room && room.host === snap?.me;
  const bill = room && totals(room);
  const shareUrl = id && typeof window !== "undefined" ? window.location.href : "";
  const amount = (cents: number) => money(cents, room?.currency || currency);
  function closeDialog() { setShare(false); setCopied(false); setEditor(null); }
  return <>
    <header><div className="shell nav"><button className="brand" disabled={!!scan || busy} onClick={() => navigate("home")}><span className="brandmark" aria-hidden="true"><i/><i/><i/><i/></span>Table Share</button>
      <button className="nav-link" disabled={!!scan || busy} onClick={() => navigate("home")}><ClipboardList size={17}/> My tables</button></div></header>
    <input hidden ref={upload} type="file" accept="image/*" onChange={e => scanPhoto(e.target.files?.[0])}/>
    <input hidden ref={camera} type="file" accept="image/*" capture="environment" onChange={e => scanPhoto(e.target.files?.[0])}/>
    <main className="shell">
      {error && <div className="error" role="alert">{error}<button aria-label="Dismiss message" onClick={() => setError("")}><X size={16}/></button></div>}
      {screen === "home" && <>
        <div className="home-hero"><div className="hero-copy">
          <div className="eyebrow"><span/> BILL SPLITTER</div>
          <h1>Split the<br/><em>table bill.</em></h1>
          <p>Scan your receipt and let everyone pick their dishes. Share a plate, a bottle, or the whole bill.</p>
          <button className="primary hero-cta" onClick={()=>choosePhoto(true)}><Camera/> Scan a receipt <ArrowUpRight size={18}/></button>
          <button className="text-link" onClick={()=>choosePhoto()}>Choose a receipt photo</button>
          {hostScan && <small>Photos are read on the host Mac.</small>}
          <button className="text-link" disabled={busy} onClick={() => act({action:"create",liveBill:true,name:name.trim()||"Organiser",title:"Osteria Luna",currency:"EUR",items:sample})}>Try a sample receipt <ArrowRight size={15}/></button>
        </div><SampleReceipt/></div>
        <div className="section-line"><h2>My tables</h2><button className="inline" onClick={() => review(false)}><Plus size={16}/> Enter a bill manually</button></div>
        {saved.length ? <div className="saved">{saved.map(t => <button key={t.id} onClick={() => navigate("table", t.id)}><span className="soft-icon"><ReceiptText/></span><strong>{t.title}</strong><ArrowUpRight size={18}/></button>)}</div> :
          <div className="empty"><span className="soft-icon"><ReceiptText/></span><div><strong>No tables yet</strong><p>Your shared bills will appear here.</p></div></div>}
      </>}
      {screen === "review" && <>
        <button className="back" disabled={!!scan || busy} onClick={() => navigate("home")}><ChevronLeft/> My tables</button>
        <h1 className="page-title">Review receipt</h1>
        {scan ? <div className="panel loading" role="status"><LoaderCircle className="spin"/>{scan}</div> : <form className="panel review" onSubmit={e => { e.preventDefault(); act({ action: "create", liveBill:true, items: rows, currency, name, title }); }}>
          {picks && <section className="quick-picks"><h2>Choose your items</h2><p>Tap what you had. Others can join any item when you share the table.</p>
            {rows.map((row, index) => row.quantity > 1 ? <div className="quantity-choice" key={index}><div><strong>{row.name}</strong><small>{row.quantity} ordered · {amount(parseCents(row.amount) || 0)} total</small></div>
              <QuantityPicker name={row.name} value={picks[index]} max={row.quantity} change={value => setPicks(picks.map((n, i) => i === index ? value : n))}/></div> :
              <button type="button" key={index} aria-pressed={!!picks[index]} onClick={() => setPicks(picks.map((n, i) => i === index ? 1 - n : n))}>
              {picks[index] ? <Check size={18}/> : <Plus size={18}/>}<span>{row.name || "New item"}</span><b>{amount(parseCents(row.amount) || 0)}</b>
            </button>)}</section>}
          {ocrNote && <p className="notice">{ocrNote}</p>}
          <div className="form-grid"><label>Table or restaurant<input required maxLength={80} value={title} placeholder="Friday dinner" onChange={e => setTitle(e.target.value)}/></label>
          <label>Your name · organiser<input required maxLength={32} value={name} placeholder="Your name" onChange={e => setName(e.target.value)}/></label>
          <label>Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label></div>
          <div className="section-line"><h2>Receipt items</h2><button type="button" className="inline" onClick={()=>choosePhoto()}><Camera size={16}/> Scan photo</button></div>
          {rows.map((r, i) => <div className="draft-row" key={i}>
            <label className="draft-quantity">Qty<input aria-label={"Quantity for " + (r.name || "new item")} required type="number" min={1} max={999} step={1} value={r.quantity || ""} onChange={e => {
              const quantity = Number(e.target.value);
              editRow(i, { quantity });
              setPicks(prev => prev && prev.map((n, j) => i === j ? Math.max(0, Math.min(n, Math.floor(quantity))) : n));
            }}/></label>
            <input aria-label={"Item " + (i + 1)} required maxLength={100} placeholder="Item name" value={r.name} onChange={e => editRow(i, { name: e.target.value })}/>
            <select aria-label="Category" value={r.category} onChange={e => editRow(i, { category: e.target.value as Category })}>{categories.map(c => <option key={c}>{c}</option>)}</select>
            <input aria-label="Line total" required inputMode="decimal" placeholder="0.00" value={r.amount} onChange={e => editRow(i, { amount: e.target.value })}/>
            <button type="button" aria-label="Remove item" onClick={() => { setRows(rows.filter((_, j) => i !== j)); setPicks(prev => prev && prev.filter((_, j) => i !== j)); }}><Trash2 size={16}/></button>
          </div>)}
          <button type="button" className="inline add" onClick={() => { setRows([...rows, emptyRow()]); setPicks(prev => prev && [...prev, 0]); }}><CirclePlus size={17}/> Add item</button>
          <div className="total-row"><span>Receipt total</span><strong>{amount(rows.reduce((n, r) => n + (parseCents(r.amount) || 0), 0))}</strong></div>
          <button className="primary" disabled={busy || !rows.length}>Create table <ArrowRight size={17}/></button>
        </form>}
      </>}
      {screen === "table" && <><button className="back" onClick={() => navigate("home")} disabled={busy}><ChevronLeft/> My tables</button>
        {!snap || !room || !bill ? <div className="panel loading">{offline ? "Table unavailable" : "Opening table…"}</div> : <>
          {(!room.board || !me) && <div className="section-line table-heading"><div><div className="eyebrow"><span/>{room.locked ? "LOCKED SPLIT" : offline ? "RECONNECTING" : "LIVE TABLE"}</div><h1 className="page-title">{room.title}</h1></div>
          {me && <button className="secondary" onClick={() => setShare(true)}><QrCode size={17}/> Share QR</button>}</div>}
          {!me ? <form className="panel join" onSubmit={e => { e.preventDefault(); act({ action: "join", name }); }}><Users/><h2>Join the table</h2><p>{room.people.find(p => p.id === room.host)?.name} covered the {amount(bill.total)} bill.</p>
            <label>Your name<input required maxLength={32} value={name} onChange={e => setName(e.target.value)}/></label><button className="primary" disabled={busy || room.locked}>{room.locked ? "Table locked" : "Join table"} <ArrowRight/></button></form> :
          room.board ? <LiveBill key={id+":"+(room.board.generation??0)} room={room as BillRoom} id={id} me={snap.me} revision={snap.revision} busy={busy} act={act} token={sessionKey(id)} error={error}/> :
          <div className="room-grid"><section className="panel"><div className="section-line"><h2>Shared receipt</h2><b>{amount(bill.total)}</b></div>
            {categories.filter(c => room.items.some(i => i.category === c)).map(c => <section className="group" key={c}>
              <div className="section-line"><h3><CategoryIcon category={c}/>{c}</h3>{host && !room.locked && <select aria-label={c + " split rule"} disabled={busy} value={room.items.filter(i => i.category === c).every(i => i.everyone) ? "all" : room.items.filter(i => i.category === c).every(i => !i.everyone) ? "claim" : "mixed"}
                onChange={e => act({ action: "category", category: c, everyone: e.target.value === "all", revision: snap.revision })}><option value="mixed" disabled>Mixed rules</option><option value="all">Share equally</option><option value="claim">Claim items</option></select>}</div>
              {room.items.filter(i => i.category === c).map(item => {
                const shares = allocation(item, room.people);
                const included = me.id in shares;
                const unitClaim = countsUnits(item);
                const mine = item.weights[me.id] || 0;
                return <div className="item" key={item.id}><div className="item-top"><strong>{item.name}</strong><b>{amount(item.cents)}</b></div>
                  {item.quantity > 1 && <small>{item.quantity} ordered{item.cents % item.quantity === 0 ? " · " + amount(item.cents / item.quantity) + " each" : ""}{unitClaim && " · " + remainingUnits(item) + " left"}</small>}
                  <div className="item-bottom"><small>{item.everyone ? "Everyone · equal shares" : room.people.filter(p => p.id in shares).map(p => p.name + (item.weights[p.id] > 1 ? " ×" + item.weights[p.id] : "")).join(", ") || "Unclaimed"}</small>
                    {!room.locked && <div className="controls">{unitClaim ? <QuantityPicker name={item.name} value={mine} max={mine + remainingUnits(item)} disabled={busy} change={units => act({ action: "claim", item: item.id, units })}/> :
                    !item.everyone && <button disabled={busy} className={included ? "chip selected" : "chip"} onClick={() => act({ action: "claim", item: item.id, include: !included })}>{included ? <Check/> : <Plus/>}{included ? "Joined" : "Join item"}</button>}
                    {host && <button className="settings" aria-label={"Edit split for " + item.name} onClick={() => { setEditor(item); setSharePortions(!!item.sharedPortions || item.everyone); setWeights(item.everyone ? Object.fromEntries(room.people.map(p => [p.id, 1])) : { ...item.weights }); }}><Settings2 size={16}/></button>}</div>}</div></div>;
              })}</section>)}</section>
            <aside><div className="summary"><Wallet/><p>Your share</p><strong>{amount(bill.balances[me.id])}</strong><small>{host ? "You covered the bill" : "Payable to " + room.people.find(p => p.id === room.host)?.name}</small></div>
            <section className="panel"><h2>At the table</h2>{room.people.map((p, i) => <div className="person" key={p.id}><span className={"avatar a" + i%3}>{p.name.slice(0,1).toUpperCase()}</span><div>{p.name}{p.id === me.id ? " (you)" : ""}<small>{p.id === room.host ? "Organiser" : p.paid ? "Demo payment received" : room.locked ? "Ready to settle" : "Choosing items"}</small></div><b>{amount(bill.balances[p.id])}</b></div>)}
            <div className="total-row"><span>Unclaimed</span><b>{amount(bill.unclaimed)}</b></div>
            {host && !room.locked && <button className="primary" disabled={busy || bill.incomplete} onClick={() => act({ action: "lock", revision: snap.revision })}><LockKeyhole size={16}/> Lock for checkout</button>}
            {room.locked && !host && bill.balances[me.id] > 0 && <><p className="muted">Demo checkout · no money moves.</p>
              {me.paid ? <p className="notice">Demo payment complete</p> : ["Apple Pay", "Google Pay"].map(provider => <button className="wallet" disabled={busy} key={provider} onClick={() => act({ action: "pay" })}>Simulate {provider} · {amount(bill.balances[me.id])}</button>)}</>}
            </section></aside></div>}
        </>}</>}
    </main>
    <dialog ref={dialog} onCancel={closeDialog} aria-label={share ? "Invite to table" : "Edit item split"}><button className="close" onClick={closeDialog} aria-label="Close"><X/></button>
      {share && <><Share2/><h2>Invite to the table</h2><p>Scan this code or share the table link.</p><div className="qr"><QRCodeSVG value={shareUrl} size={180} marginSize={2}/></div><label>Table link<input readOnly value={shareUrl} onFocus={e => e.target.select()}/></label>
      <button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied(true); } catch { dialog.current?.querySelector("input")?.select(); } }}>{copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy link"}</button></>}
      {editor && room && <><Settings2/><h2>{editor.name}</h2>
      {editor.quantity > 1 && <label>Split method<select value={sharePortions ? "portions" : "units"} onChange={e => setSharePortions(e.target.value === "portions")}><option value="units">Assign whole items</option><option value="portions">Share the line by portions</option></select></label>}
      <p>{editor.quantity > 1 && !sharePortions ? "Assign up to " + editor.quantity + " ordered items." : "Give each person a number of portions."}</p>{room.people.map(p => <label className="portion" key={p.id}>{p.name}<input type="number" min={0} max={10000} value={weights[p.id] || 0} onChange={e => setWeights({ ...weights, [p.id]: Number(e.target.value) })}/></label>)}
      <button className="primary" disabled={busy || (editor.quantity > 1 && !sharePortions && Object.values(weights).reduce((a,b) => a+b, 0) > editor.quantity) || Object.values(weights).some(w => !Number.isInteger(w) || w < 0 || w > 10000)} onClick={() => act({ action: "assign", item: editor.id, sharedPortions: sharePortions, weights: Object.fromEntries(Object.entries(weights).filter(([,w]) => w > 0)), revision: editor.revision })}>Save split</button>{error && <p role="alert">{error}</p>}</>}
    </dialog>
  </>;
}
