"use client";

import Link from "next/link";
import { TOOL_SECTIONS } from "@/lib/toolsOps";

export function ToolsHub() {
  return (
    <main className="tools-page">
      <header className="tools-head">
        <h1>Tools</h1>
        <p>Scan, import, convert, and edit — CamScanner-style toolkit.</p>
      </header>

      {TOOL_SECTIONS.map((section) => (
        <section key={section.title} className="tools-section">
          <h2>{section.title}</h2>
          <div className="tools-grid">
            {section.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`tool-tile ${item.status === "soon" ? "is-soon" : ""}`}
              >
                <span
                  className="tool-icon"
                  style={{ background: `${item.color}22`, color: item.color }}
                >
                  {item.icon}
                </span>
                <span className="tool-label">{item.label}</span>
                {item.status === "soon" && (
                  <span className="tool-badge">Soon</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
