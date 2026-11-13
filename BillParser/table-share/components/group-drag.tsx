"use client";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Group, Selection } from "../lib/bill";

type Payload = { items: Selection; label: string };
const targetAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-group-drop]")?.dataset.groupDrop || "";

export function useGroupDrag(onDrop: (target: string, items: Selection) => void) {
  const [drag, setDrag] = useState<Payload | null>(null);
  const [over, setOver] = useState("");
  const ghost = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  useEffect(() => () => cleanup.current?.(), []);
  function begin(e: ReactPointerEvent<HTMLButtonElement>, payload: Payload) {
    if (!e.isPrimary || e.button !== 0) return;
    cleanup.current?.();
    suppressClick.current = false;
    const source = e.currentTarget, pointer = e.pointerId, x0 = e.clientX, y0 = e.clientY;
    let moving = false, frame = 0, previous = "";
    lastPointer.current = { x: x0, y: y0 };
    function paint() {
      const { x, y } = lastPointer.current;
      const hit = document.elementFromPoint(x, y);
      const tray = hit?.closest<HTMLElement>(".drop-choices");
      if (tray) {
        const bounds = tray.getBoundingClientRect();
        if (y < bounds.top + 22) tray.scrollTop -= 6;
        else if (y > bounds.bottom - 22) tray.scrollTop += 6;
      } else if (!hit?.closest(".group-drop-tray")) {
        const edge = 55;
        if (y < edge) window.scrollBy(0, -8);
        else if (y > window.innerHeight - edge) window.scrollBy(0, 8);
      }
      const target = targetAt(x, y);
      if (target !== previous) { previous = target; setOver(target); }
      if (ghost.current) {
        const left = Math.max(6, Math.min(x - ghost.current.offsetWidth / 2, window.innerWidth - ghost.current.offsetWidth - 6));
        ghost.current.style.transform = "translate(" + left + "px," + Math.max(4, y - 53) + "px)";
      }
      frame = requestAnimationFrame(paint);
    }
    function move(event: PointerEvent) {
      if (event.pointerId !== pointer) return;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      if (!moving && Math.hypot(event.clientX - x0, event.clientY - y0) >= 6) {
        moving = true; suppressClick.current = true; setDrag(payload);
        frame = requestAnimationFrame(paint);
      }
    }
    function clear() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", clear);
      source.removeEventListener("lostpointercapture", cancel);
      cancelAnimationFrame(frame);
      if (source.hasPointerCapture(pointer)) source.releasePointerCapture(pointer);
      setDrag(null); setOver(""); cleanup.current = null;
    }
    function cancel(event: PointerEvent) { if (event.pointerId === pointer) clear(); }
    function end(event: PointerEvent) {
      if (event.pointerId !== pointer) return;
      const target = moving ? targetAt(event.clientX, event.clientY) : "";
      clear();
      if (target) onDrop(target, payload.items);
    }
    source.setPointerCapture(pointer);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", clear);
    source.addEventListener("lostpointercapture", cancel);
    cleanup.current = clear;
  }
  return { begin, drag, over, ghost, tapped: () => { const tap = !suppressClick.current; suppressClick.current = false; return tap; } };
}

export function DragTray({ groups, drag }: { groups: Group[]; drag: ReturnType<typeof useGroupDrag> }) {
  if (!drag.drag) return null;
  return <div aria-hidden="true">
    <div className="drag-ghost" ref={drag.ghost}>{drag.drag.label}</div>
    <div className="group-drop-tray">
      <strong>Drop into a group</strong>
      <div className="drop-choices">
        {[{ id: "new", name: "+ New group" }, ...groups].map(g =>
          <span key={g.id} data-group-drop={g.id} className={drag.over === g.id ? "over" : ""}>{g.name}</span>)}
      </div>
    </div>
  </div>;
}
