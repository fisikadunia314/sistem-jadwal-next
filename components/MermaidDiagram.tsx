"use client";
// Diagram flowchart dirender memakai library Mermaid (layout otomatis dagre),
// dibundel lokal — tidak memanggil CDN/internet. Definisi diagram berupa teks.
import { useEffect, useId, useRef, useState } from "react";

let mermaidReady: Promise<any> | null = null;
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then(m => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables: {
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "14px",
          primaryColor: "#ffffff",
          primaryBorderColor: "#94a3b8",
          primaryTextColor: "#0f172a",
          lineColor: "#64748b",
          secondaryColor: "#f1f5f9",
          tertiaryColor: "#f8fafc",
        },
        flowchart: { curve: "basis", nodeSpacing: 40, rankSpacing: 55, htmlLabels: true, padding: 12 },
      });
      return m.default;
    });
  }
  return mermaidReady;
}

export default function MermaidDiagram({ chart, title }: { chart: string; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    loadMermaid()
      .then(async m => {
        const { svg } = await m.render(`mmd-${rawId}`, chart);
        if (alive && ref.current) ref.current.innerHTML = svg;
      })
      .catch((e: any) => { if (alive) setErr(String(e?.message || e)); });
    return () => { alive = false; };
  }, [chart, rawId]);
  return (
    <div className="overflow-x-auto rounded-box border border-base-300 bg-white p-3">
      {title && <div className="pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>}
      {err ? <pre className="whitespace-pre-wrap text-xs text-error">Diagram gagal dirender: {err}</pre>
        : <div ref={ref} className="mmd-box min-w-[640px] [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-[1050px]" />}
    </div>
  );
}
