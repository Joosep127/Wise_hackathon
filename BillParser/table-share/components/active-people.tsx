"use client";
import { useEffect, useState } from "react";
import type { Person } from "../lib/split";

// Closing or backgrounding a bill stops its heartbeat. Separate presence requests
// never increment the bill revision or invalidate the organiser's Undo.
export function ActivePeople({ id, token, me, people, colors }: { id: string; token: string; me: string; people: Person[]; colors: Record<string,string> }) {
  const [active, setActive] = useState<string[] | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    function stop() {
      clearTimeout(timer);
      controller?.abort();
    }
    async function tick() {
      stop();
      if (document.hidden) return;
      const request = new AbortController();
      controller = request;
      try {
        const res = await fetch("/api/rooms?id=" + encodeURIComponent(id), {
          method: "POST", cache: "no-store", signal: request.signal,
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "presence" }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json() as { active: string[] };
        if (!request.signal.aborted) setActive(data.active);
      } catch { if (!request.signal.aborted) setActive(null); }
      if (!request.signal.aborted) timer = setTimeout(tick, 6000);
    }
    void tick();
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => { stop(); document.removeEventListener("visibilitychange", tick); window.removeEventListener("pageshow", tick); };
  }, [id, token]);
  const online = people.filter(p => active?.includes(p.id));
  return <details className="active-people"><summary>
    <strong><i className={active ? "online" : ""} aria-hidden="true"/>{active ? "Active now · " + online.length : "Connecting to the table…"}</strong>
    <span className="avatar-stack">{online.slice(0,5).map(p=>{
      const label=p.name+(p.id===me?" (you)":"");
      return <span className="active-avatar" style={{backgroundColor:colors[p.id],color:"white"}} key={p.id} aria-label={label} title={label}>
        {p.name.trim().split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]).join("").toUpperCase()}</span>;
    })}{online.length>5 && <span className="active-avatar">+{online.length-5}</span>}</span>
    </summary>{online.length>0 && <p>{online.map(p=>p.name+(p.id===me?" (you)":"")).join(", ")}</p>}</details>;
}
