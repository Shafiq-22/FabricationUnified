"use client";

import { useCallback, useEffect, useRef } from "react";

const MIN_WIDTH = 48;

/**
 * Gives every header cell of the table inside `ref` a drag handle on its
 * right edge, and remembers the widths per table in localStorage.
 *
 * It works on the DOM rather than on props, so every table in the app gets
 * resizable columns without its call site changing. Double-clicking a handle
 * clears that column back to automatic.
 */
export function useResizableColumns(explicitKey?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const keyRef = useRef<string | null>(null);

  // Derived from the header labels so it survives navigation and reorders
  // of unrelated tables on the same page.
  const storageKey = useCallback(
    (ths: HTMLTableCellElement[]) => {
      if (keyRef.current) return keyRef.current;
      const labels = ths.map((t) => (t.textContent ?? "").trim()).join("|");
      const path = typeof window === "undefined" ? "" : window.location.pathname;
      keyRef.current = `fjb.colw.${explicitKey ?? `${path}::${labels}`}`;
      return keyRef.current;
    },
    [explicitKey],
  );

  const read = (k: string): Record<number, number> => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? "{}");
    } catch {
      return {};
    }
  };
  const write = (k: string, v: Record<number, number>) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* a full or blocked localStorage just means widths are not remembered */
    }
  };

  const apply = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const ths = Array.from(
      root.querySelectorAll("thead > tr > th"),
    ) as HTMLTableCellElement[];
    if (ths.length === 0) return;

    const k = storageKey(ths);
    const stored = read(k);

    ths.forEach((th, i) => {
      if (stored[i]) th.style.width = `${stored[i]}px`;
      if (th.dataset.colResize === "1") return;
      th.dataset.colResize = "1";
      if (!th.style.position) th.style.position = "relative";

      const handle = document.createElement("span");
      handle.setAttribute("aria-hidden", "true");
      handle.title = "Drag to resize, double-click to reset";
      handle.className =
        "absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60";
      handle.style.touchAction = "none";

      handle.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        th.style.width = "";
        const now = read(k);
        delete now[i];
        write(k, now);
      });

      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        handle.setPointerCapture(e.pointerId);

        const move = (ev: PointerEvent) => {
          th.style.width = `${Math.max(MIN_WIDTH, Math.round(startW + (ev.clientX - startX)))}px`;
        };
        const up = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          const now = read(k);
          now[i] = Math.round(th.getBoundingClientRect().width);
          write(k, now);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
      });

      th.appendChild(handle);
    });
  }, [storageKey]);

  useEffect(() => {
    apply();
    const root = ref.current;
    if (!root) return;
    // Headers can appear later — a tab switch, or data arriving — so watch
    // for them rather than only wiring up once.
    const obs = new MutationObserver(() => apply());
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [apply]);

  return ref;
}
