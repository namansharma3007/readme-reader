#!/usr/bin/env node
"use strict";
/**
 * readme-reader — Local Markdown Viewer
 * ─────────────────────────────────────────────────────────────
 * Usage:
 *   readme-reader                    Serve notes/ in current directory
 *   readme-reader ./my-project       Serve notes/ inside my-project/
 *   readme-reader --port 4000        Use a custom port
 *   readme-reader --no-open          Don't auto-open the browser
 *   readme-reader --help             Show help
 */

const http    = require("http");
const fs      = require("fs");
const path    = require("path");
const { exec } = require("child_process");

// ─── Parse CLI args ────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
let   BASE     = process.cwd();
let   PORT     = 3000;
let   NO_OPEN  = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--port":   PORT    = parseInt(args[++i], 10); break;
    case "--no-open": NO_OPEN = true; break;
    case "--help":
    case "-h":
      console.log(`
  readme-reader — Local Markdown Viewer

  Usage
    readme-reader [directory] [options]

  Options
    --port <n>    HTTP port (default: 3000)
    --no-open     Don't auto-open browser
    --help        Show this message

  Examples
    readme-reader
    readme-reader ./docs --port 8080
    readme-reader --no-open
`);
      process.exit(0);
      break;
    default:
      if (!args[i].startsWith("--")) BASE = path.resolve(args[i]);
  }
}

// ─── Ensure notes/ directory exists ──────────────────────────────────────
const ROOT = path.join(BASE, "notes");
if (!fs.existsSync(ROOT)) {
  fs.mkdirSync(ROOT, { recursive: true });
  console.log(`📁  Created notes/ at ${ROOT}`);
  fs.writeFileSync(
    path.join(ROOT, "welcome.md"),
    [
      "# Welcome to readme-reader",
      "",
      "Your notes live here. Add `.md` files to this folder and they will",
      "appear instantly in the sidebar.",
      "",
      "## Features",
      "",
      "- **Live reload** — edits appear without refreshing",
      "- **Dark / Light mode** — toggle in the top-right corner",
      "- **Collapsible sidebar** — click the ☰ button",
      "- **Anchor links** — all headings are linkable",
      "- **Math** — wrap LaTeX in `$...$` or `$$...$$`",
      "- **Task lists** — `- [ ]` and `- [x]` syntax",
      "- **Footnotes** — standard Markdown footnote syntax",
      "",
      "## Getting Started",
      "",
      "1. Drop `.md` files into the `notes/` folder",
      "2. Sub-folders are supported and shown as collapsible groups",
      "3. Delete a file and the sidebar updates automatically",
    ].join("\n")
  );
}

// ─── Dependencies ─────────────────────────────────────────────────────────
let MarkdownIt, mdFootnote, mdTaskLists, WebSocket;
try {
  MarkdownIt   = require("markdown-it");
  mdFootnote   = require("markdown-it-footnote");
  mdTaskLists  = require("markdown-it-task-lists");
  WebSocket    = require("ws");
} catch (e) {
  console.error(
    "\n❌  Missing dependencies. Run:\n\n   npm install\n\nin the readme-reader package directory, or install globally:\n\n   npm install -g readme-reader\n"
  );
  process.exit(1);
}

// ─── Markdown renderer ────────────────────────────────────────────────────
const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false })
  .use(mdFootnote)
  .use(mdTaskLists, { enabled: true });

// Inject `id` attributes on headings so anchor links scroll correctly
const _headingOpen = md.renderer.rules.heading_open ||
  ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

md.renderer.rules.heading_open = (tokens, idx, opts, env, self) => {
  const next = tokens[idx + 1];
  if (next?.type === "inline" && next.children) {
    const raw = next.children
      .filter(t => t.type === "text" || t.type === "code_inline")
      .map(t => t.content).join("");
    const slug = raw.toLowerCase()
      .replace(/[`*_[\]()#<>!]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");
    if (slug) tokens[idx].attrSet("id", slug);
  }
  return _headingOpen(tokens, idx, opts, env, self);
};

// ─── WebSocket live-reload server ─────────────────────────────────────────
const WS_PORT = PORT + 1;
const wss = new WebSocket.Server({ port: WS_PORT });
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}

// ─── File watcher ─────────────────────────────────────────────────────────
const watchers = new Map();
const isMd = n => /\.(md|markdown)$/i.test(n) || /^readme(\.txt)?$/i.test(n);

function watchDir(dir) {
  if (watchers.has(dir)) return;
  try {
    const w = fs.watch(dir, { recursive: false }, (event, filename) => {
      if (!filename) return;
      const full = path.join(dir, filename);
      const rel  = path.relative(ROOT, full);
      try { if (fs.statSync(full).isDirectory()) walkAndWatch(full); } catch {}
      if (!isMd(filename)) return;
      const exists = fs.existsSync(full);
      if (!exists)              { console.log(`🗑  Deleted : ${rel}`); broadcast({ type: "deleted", file: rel }); }
      else if (event === "rename") { console.log(`✨  Created : ${rel}`); broadcast({ type: "created", file: rel }); }
      else                      { console.log(`🔄  Changed : ${rel}`); broadcast({ type: "changed", file: rel }); }
    });
    watchers.set(dir, w);
  } catch {}
}

function walkAndWatch(dir) {
  watchDir(dir);
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
        walkAndWatch(path.join(dir, e.name));
  } catch {}
}
walkAndWatch(ROOT);

// ─── File collection ──────────────────────────────────────────────────────
function collectFiles(dir = ROOT, base = "") {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  entries.sort((a, b) =>
    a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1
  );
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) results.push(...collectFiles(path.join(dir, e.name), rel));
    else if (isMd(e.name)) results.push(rel);
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const esc        = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const encodePath = f => f.split("/").map(encodeURIComponent).join("/");

// ─── Sidebar tree HTML ─────────────────────────────────────────────────────
function buildTree(files) {
  const tree = {};
  for (const f of files) {
    const parts = f.split("/");
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= { __files__: [] };
      node = node[parts[i]];
    }
    (node.__files__ ??= []).push(f);
  }

  const FOLDER_SVG = `<svg class="sb-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 3.5A1 1 0 012.5 2.5h3.086a1 1 0 01.707.293L7.5 4h6a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1V3.5z" opacity=".35"/><path d="M1.5 5.5h13" stroke="currentColor" stroke-width="1" fill="none"/></svg>`;
  const FILE_SVG   = `<svg class="sb-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2h5.5L12 4.5V14H4V2z" fill="currentColor" opacity=".15"/><path d="M4 2h5.5L12 4.5V14H4V2z" stroke="currentColor" stroke-width="1.2"/><path d="M9 2v3h3" stroke="currentColor" stroke-width="1.2"/></svg>`;

  function render(node) {
    let html = "";
    for (const key of Object.keys(node).filter(k => k !== "__files__")) {
      html += `<details class="sb-folder" open>
        <summary>${FOLDER_SVG}<span class="sb-label">${esc(key)}</span></summary>
        <div class="sb-children">${render(node[key])}</div>
      </details>`;
    }
    for (const f of node.__files__ ?? []) {
      html += `<a class="file-link" href="/${encodePath(f)}" data-path="${esc(f)}">${FILE_SVG}<span class="sb-label">${esc(f.split("/").pop())}</span></a>`;
    }
    return html;
  }
  return render(tree);
}

// ─── Full HTML page shell ──────────────────────────────────────────────────
function shell(sidebarHtml, contentHtml, activeFile) {
  const fileCount = (sidebarHtml.match(/file-link/g) || []).length;
  const title = activeFile ? esc(activeFile.split("/").pop()) + " — readme-reader" : "readme-reader";

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link id="hlDark"  rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css">
<link id="hlLight" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" disabled>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" onload="renderMath()"></script>
<style>
/* ═══ TOKENS ════════════════════════════════════════════════ */
:root { --tr:.22s ease; --top-h:54px; --sb-w:272px; }
[data-theme="dark"] {
  --bg:#0d1117; --surface:#161b22; --surface2:#21262d; --border:#30363d;
  --text:#c9d1d9; --text-dim:#8b949e; --text-hi:#f0f6fc;
  --accent:#58a6ff; --accent2:#3fb950;
  --hover:#21262d; --active-bg:#1c2b3a; --active-bd:#58a6ff;
  --del-bg:#2a1618; --del-text:#f87171; --del-bd:#7f1d1d;
  --code-bg:#161b22; --code-fg:#ff7b72;
  --shadow:0 1px 0 #30363d,0 8px 24px rgba(0,0,0,.5);
  --overlay:rgba(0,0,0,.65);
}
[data-theme="light"] {
  --bg:#ffffff; --surface:#f6f8fa; --surface2:#ebf0f4; --border:#d0d7de;
  --text:#24292f; --text-dim:#57606a; --text-hi:#111111;
  --accent:#0969da; --accent2:#1a7f37;
  --hover:#f0f3f6; --active-bg:#dbeafe; --active-bd:#0969da;
  --del-bg:#fff0f0; --del-text:#b91c1c; --del-bd:#fca5a5;
  --code-bg:#f6f8fa; --code-fg:#cf222e;
  --shadow:0 1px 0 #d0d7de,0 4px 12px rgba(0,0,0,.07);
  --overlay:rgba(0,0,0,.4);
}

/* ═══ RESET ═════════════════════════════════════════════════ */
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; }
body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); overflow-x:hidden; transition:background var(--tr),color var(--tr); }

/* ═══ TOPBAR ════════════════════════════════════════════════ */
.topbar {
  position:fixed; inset:0 0 auto 0; height:var(--top-h);
  background:var(--surface); border-bottom:1px solid var(--border);
  display:flex; align-items:center; gap:10px; padding:0 14px;
  z-index:400; box-shadow:var(--shadow);
  transition:background var(--tr),border-color var(--tr);
}
.btn-menu {
  flex-shrink:0; width:34px; height:34px; border-radius:8px;
  border:1px solid var(--border); background:var(--surface2);
  cursor:pointer; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:4.5px; padding:6px;
  transition:background .15s;
}
.btn-menu:hover { background:var(--hover); }
.bline {
  display:block; width:15px; height:1.5px; border-radius:2px;
  background:var(--text-dim); transform-origin:center;
  transition:transform .24s ease,opacity .18s ease,width .18s ease;
}
body.sb-open .bline:nth-child(1) { transform:translateY(6px) rotate(45deg); }
body.sb-open .bline:nth-child(2) { opacity:0; width:0; }
body.sb-open .bline:nth-child(3) { transform:translateY(-6px) rotate(-45deg); }

.logo { font-family:'Lora',serif; font-size:1.1rem; font-weight:600; color:var(--accent); text-decoration:none; white-space:nowrap; flex-shrink:0; }
.logo span { font-weight:400; font-style:italic; color:var(--text-dim); }
.topbar-sep { width:1px; height:18px; background:var(--border); flex-shrink:0; }
.topbar-path { font-family:'JetBrains Mono',monospace; font-size:.69rem; color:var(--text-dim); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.btn-theme {
  flex-shrink:0; width:52px; height:26px; border-radius:13px;
  background:var(--surface2); border:1px solid var(--border);
  cursor:pointer; position:relative; display:flex; align-items:center;
  justify-content:space-between; padding:0 5px; transition:background var(--tr);
}
.btn-theme:hover { background:var(--hover); }
.theme-icon { font-size:11px; pointer-events:none; line-height:1; }
.theme-knob {
  position:absolute; top:3px; left:3px; width:20px; height:20px;
  border-radius:50%; background:var(--accent); box-shadow:0 1px 3px rgba(0,0,0,.3);
  transition:transform var(--tr);
}
[data-theme="light"] .theme-knob { transform:translateX(26px); }

.live-badge { flex-shrink:0; display:flex; align-items:center; gap:5px; font-size:.65rem; color:var(--text-dim); letter-spacing:.06em; text-transform:uppercase; }
.live-dot { width:7px; height:7px; border-radius:50%; background:var(--accent2); animation:pulse 2.5s infinite; }
.live-dot.stale { background:var(--text-dim); animation:none; }
@keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,.5)} 50%{box-shadow:0 0 0 6px rgba(63,185,80,0)} }
@media(max-width:420px){.live-badge{display:none}}
@media(max-width:600px){.topbar-path{display:none}}

/* ═══ LAYOUT ════════════════════════════════════════════════ */
.layout { display:flex; padding-top:var(--top-h); min-height:100dvh; }

/* ═══ SIDEBAR ═══════════════════════════════════════════════ */
.sidebar {
  width:var(--sb-w); background:var(--surface); border-right:1px solid var(--border);
  position:fixed; top:var(--top-h); bottom:0; left:0;
  display:flex; flex-direction:column; z-index:300; overflow:hidden;
  transition:width var(--tr),background var(--tr),border-color var(--tr),transform var(--tr);
}
body.sb-collapsed .sidebar { width:0; border-right-width:0; }
body.sb-collapsed .content-shell { margin-left:0; }

.sb-scroll { flex:1; overflow-y:auto; overflow-x:hidden; padding-bottom:48px; }
.sb-scroll::-webkit-scrollbar { width:3px; }
.sb-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

.sb-header {
  position:sticky; top:0; z-index:2; background:var(--surface);
  border-bottom:1px solid var(--border); font-size:.62rem;
  text-transform:uppercase; letter-spacing:.1em; color:var(--text-dim);
  padding:10px 15px 8px; font-weight:600;
  display:flex; align-items:center; justify-content:space-between; white-space:nowrap;
  transition:background var(--tr),border-color var(--tr);
}
.sb-count { background:var(--surface2); border:1px solid var(--border); font-size:.6rem; padding:1px 7px; border-radius:9px; }

.sb-folder > summary {
  list-style:none; display:flex; align-items:center; gap:7px; padding:5px 14px;
  cursor:pointer; font-size:.8rem; font-weight:500; color:var(--text-dim);
  transition:background .12s,color .12s; white-space:nowrap; overflow:hidden;
}
.sb-folder > summary:hover { background:var(--hover); color:var(--text); }
.sb-folder > summary::marker,.sb-folder > summary::-webkit-details-marker { display:none; }
.sb-children { padding-left:11px; }

.file-link {
  display:flex; align-items:center; gap:7px; padding:6px 14px;
  text-decoration:none; font-size:.8rem; color:var(--text-dim);
  border-left:2px solid transparent;
  transition:background .12s,color .12s,border-color .12s;
  white-space:nowrap; overflow:hidden;
}
.file-link:hover  { background:var(--hover); color:var(--text); border-left-color:var(--border); }
.file-link.active { background:var(--active-bg); color:var(--accent); border-left-color:var(--active-bd); font-weight:500; }
.file-link.dying  { color:var(--del-text)!important; background:var(--del-bg)!important; text-decoration:line-through; pointer-events:none; animation:shrinkOut .6s ease .8s forwards; }
@keyframes shrinkOut { to { max-height:0; padding:0; opacity:0; overflow:hidden; } }

.sb-icon { width:14px; height:14px; flex-shrink:0; color:var(--text-dim); }
.sb-label { overflow:hidden; text-overflow:ellipsis; }

/* ═══ MOBILE SIDEBAR ════════════════════════════════════════ */
@media(max-width:768px) {
  .sidebar { width:var(--sb-w)!important; transform:translateX(-100%); z-index:500; }
  body.sb-open .sidebar { transform:translateX(0); box-shadow:4px 0 32px rgba(0,0,0,.4); }
  .content-shell { margin-left:0!important; }
}
.sb-backdrop { display:none; position:fixed; inset:0; background:var(--overlay); z-index:450; opacity:0; pointer-events:none; transition:opacity var(--tr); }
@media(max-width:768px){ .sb-backdrop{display:block} body.sb-open .sb-backdrop{opacity:1;pointer-events:all} }

/* ═══ CONTENT ════════════════════════════════════════════════ */
.content-shell { flex:1; min-width:0; margin-left:var(--sb-w); padding:44px 28px 110px; transition:margin-left var(--tr); }
.md-wrap { max-width:860px; margin:0 auto; }

/* ═══ MARKDOWN ═══════════════════════════════════════════════ */
.md { line-height:1.7; }
.md h1,.md h2,.md h3,.md h4,.md h5,.md h6 { font-family:'Lora',serif; color:var(--text-hi); margin:2em 0 .55em; line-height:1.25; scroll-margin-top:calc(var(--top-h) + 16px); }
.md h1 { font-size:clamp(1.55rem,4vw,2.1rem); border-bottom:1px solid var(--border); padding-bottom:.35em; margin-top:0; }
.md h2 { font-size:clamp(1.2rem,3vw,1.55rem); border-bottom:1px solid var(--border); padding-bottom:.22em; }
.md h3 { font-size:1.2rem; } .md h4 { font-size:1.05rem; }
.md p  { margin:.85em 0; font-size:.97rem; }
.md a  { color:var(--accent); text-decoration:none; }
.md a:hover { text-decoration:underline; }
.md strong { color:var(--text-hi); font-weight:600; }
.md ul,.md ol { padding-left:1.6em; margin:.8em 0; }
.md li { line-height:1.75; margin:.3em 0; font-size:.97rem; }
.md blockquote { border-left:3px solid var(--accent); padding:.55em 1.2em; margin:1.2em 0; color:var(--text-dim); font-style:italic; background:var(--surface); border-radius:0 6px 6px 0; }
.md hr  { border:none; border-top:1px solid var(--border); margin:2em 0; }
.md img { max-width:100%; height:auto; border-radius:8px; border:1px solid var(--border); display:block; margin:.8em 0; }
.md table { border-collapse:collapse; width:100%; margin:1.2em 0; font-size:.9rem; display:block; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.md th { background:var(--surface2); color:var(--text-hi); font-weight:600; padding:9px 13px; border:1px solid var(--border); text-align:left; }
.md td { padding:8px 13px; border:1px solid var(--border); }
.md tr:nth-child(even) td { background:var(--surface); }
.md code { font-family:'JetBrains Mono',monospace; font-size:.83em; background:var(--code-bg); color:var(--code-fg); padding:2px 6px; border-radius:4px; }
.md pre { background:var(--code-bg); border:1px solid var(--border); border-radius:8px; padding:16px 20px; margin:1.2em 0; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.md pre code { background:none; color:inherit; padding:0; font-size:.84em; border-radius:0; }
.md .task-list-item { list-style:none; }
.md .task-list-item input[type="checkbox"] { margin-right:6px; accent-color:var(--accent); }
/* markdown-it-footnote renders its own <hr class="footnotes-sep"> above the
   footnotes block. We hide it here so only the CSS border-top below is shown,
   preventing the double-line that appears otherwise. */
.md .footnotes-sep { display:none; }
.md .footnotes { margin-top:2.5em; padding-top:1em; border-top:1px solid var(--border); font-size:.86rem; color:var(--text-dim); }
/* Back-reference arrows (↩) in footnote items */
.md .footnotes a[href^="#fnref"] { color:var(--text-dim); text-decoration:none; margin-left:4px; }
.md .footnotes a[href^="#fnref"]:hover { color:var(--accent); }

/* ═══ WELCOME / DELETED ══════════════════════════════════════ */
.welcome { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:62vh; gap:14px; text-align:center; padding:20px; }
.welcome h1 { font-family:'Lora',serif; font-size:clamp(1.8rem,5vw,2.6rem); font-weight:400; color:var(--accent); }
.welcome p  { color:var(--text-dim); max-width:300px; line-height:1.65; }
.del-banner { background:var(--del-bg); border:1px solid var(--del-bd); border-radius:10px; padding:24px 28px; margin-bottom:20px; display:flex; flex-direction:column; gap:10px; }
.del-banner h2 { font-family:'Lora',serif; font-size:1.4rem; font-weight:400; color:var(--del-text); }
.del-banner .dp { font-family:'JetBrains Mono',monospace; font-size:.75rem; color:var(--del-text); opacity:.8; word-break:break-all; }
.del-banner p  { color:var(--text-dim); font-size:.9rem; }
.btn-back { display:inline-block; padding:8px 20px; border-radius:7px; background:var(--accent); color:#fff; text-decoration:none; font-size:.83rem; }
.btn-back:hover { opacity:.85; }

/* ═══ ANIMATIONS ═════════════════════════════════════════════ */
.page-enter { animation:pageIn .22s ease; }
@keyframes pageIn { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:none} }
.flash { animation:flashIn .3s ease; }
@keyframes flashIn { from{opacity:.15} to{opacity:1} }

@media(max-width:768px){ .content-shell{padding:36px 18px 90px} }
@media(max-width:480px){ .content-shell{padding:26px 14px 72px} }

/* ═══ PDF EXPORT BUTTON ══════════════════════════════════════ */
.btn-pdf {
  flex-shrink:0; display:flex; align-items:center; gap:5px;
  padding:5px 11px; height:28px; border-radius:7px;
  border:1px solid var(--border); background:var(--surface2);
  color:var(--text-dim); font-size:.72rem; font-weight:500;
  cursor:pointer; white-space:nowrap; font-family:'Inter',sans-serif;
  transition:background .15s,color .15s,border-color .15s,box-shadow .15s;
}
.btn-pdf:hover {
  background:var(--hover); color:var(--text);
  border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-glow,rgba(88,166,255,.15));
}
.btn-pdf .pdf-icon { width:13px; height:13px; flex-shrink:0; }
.btn-pdf.pdf-hidden { display:none !important; }
@media(max-width:520px){ .btn-pdf .pdf-label { display:none; } }

/* ═══ PRINT / PDF ════════════════════════════════════════════
   Triggered by window.print() — works with browser "Save as PDF".
   Goal: clean A4-like layout, white bg, black text, no UI chrome.
══════════════════════════════════════════════════════════════ */
@media print {
  /* ── Hide all UI chrome ── */
  .topbar,
  .sidebar,
  .sb-backdrop,
  .btn-pdf             { display:none !important; }

  /* ── Reset layout ── */
  html, body           { background:#fff !important; color:#111 !important; }
  .layout              { padding-top:0 !important; display:block !important; }
  .content-shell       { margin-left:0 !important; padding:0 !important; display:block !important; }
  .md-wrap             { max-width:100% !important; }

  /* ── Force light colours on everything ── */
  *, *::before, *::after {
    background:transparent !important;
    color:#111 !important;
    box-shadow:none !important;
    text-shadow:none !important;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

  /* ── Headings ── */
  .md h1 { font-size:24pt !important; border-bottom:1.5pt solid #ccc !important; }
  .md h2 { font-size:18pt !important; border-bottom:1pt solid #ddd !important; }
  .md h3 { font-size:14pt !important; }
  .md h1,.md h2,.md h3,.md h4,.md h5,.md h6 { color:#000 !important; page-break-after:avoid; }

  /* ── Body text ── */
  .md p, .md li { font-size:11pt !important; line-height:1.65 !important; color:#222 !important; }
  .md a  { color:#0550ae !important; }
  /* Show full URL after external links */
  .md a[href^="http"]::after {
    content:" (" attr(href) ")";
    font-size:8pt; color:#555 !important;
  }

  /* ── Code ── */
  .md code {
    background:#f4f4f4 !important; color:#c0390a !important;
    border:0.5pt solid #ccc !important; border-radius:3pt !important;
  }
  .md pre {
    background:#f8f8f8 !important; border:0.75pt solid #ccc !important;
    border-radius:4pt !important; padding:10pt 14pt !important;
    overflow:visible !important; white-space:pre-wrap !important;
    page-break-inside:avoid;
  }
  .md pre code { background:transparent !important; border:none !important; color:#333 !important; }

  /* ── Tables ── */
  .md table { display:table !important; width:100% !important; border-collapse:collapse !important; }
  .md th { background:#eef0f3 !important; color:#000 !important; border:0.75pt solid #bbb !important; font-size:10pt !important; }
  .md td { border:0.75pt solid #ccc !important; font-size:10pt !important; }
  .md tr:nth-child(even) td { background:#f9f9f9 !important; }

  /* ── Blockquotes ── */
  .md blockquote {
    border-left:3pt solid #999 !important;
    background:#f7f7f7 !important;
    color:#555 !important;
  }

  /* ── Task checkboxes ── */
  .md .task-list-item input[type="checkbox"] { accent-color:#000 !important; }

  /* ── Footnotes ── */
  .md .footnotes { border-top:0.75pt solid #ccc !important; color:#555 !important; }
  .md .footnotes-sep { display:none !important; }

  /* ── Images — keep them within page width ── */
  .md img { max-width:100% !important; page-break-inside:avoid; }

  /* ── Page break hints ── */
  pre, blockquote, table, figure { page-break-inside:avoid; }

  /* ── Page size and margins ── */
  @page { size:A4; margin:2cm 2.2cm 2.5cm; }
}
</style>
</head>
<body>

<div class="sb-backdrop" id="sbBackdrop"></div>

<header class="topbar">
  <button class="btn-menu" id="btnMenu" aria-label="Toggle sidebar">
    <span class="bline"></span><span class="bline"></span><span class="bline"></span>
  </button>
  <a class="logo" href="/">readme-reader<span>.app</span></a>
  <div class="topbar-sep"></div>
  <div class="topbar-path" id="topbarPath">${activeFile ? esc(activeFile) : "notes/"}</div>
  <button class="btn-theme" id="btnTheme" aria-label="Toggle dark/light mode">
    <span class="theme-icon">🌙</span>
    <span class="theme-icon">☀️</span>
    <div class="theme-knob"></div>
  </button>
  <!-- PDF export — only shown when a file is open -->
  <button class="btn-pdf pdf-hidden" id="btnPdf" title="Export as PDF">
    <svg class="pdf-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"/>
      <path d="M9 1v4h4"/>
      <path d="M5.5 9.5h2c.6 0 1 .4 1 1s-.4 1-1 1H5.5V8.5h1.5c.5 0 .9.3.9.8s-.4.7-.9.7"/>
      <path d="M10 8.5v4M10 8.5h1.2c.7 0 1.3.6 1.3 1.3v1.4c0 .7-.6 1.3-1.3 1.3H10"/>
    </svg>
    <span class="pdf-label">PDF</span>
  </button>
  <div class="live-badge">
    <div class="live-dot" id="liveDot"></div>
    <span id="liveLabel">Live</span>
  </div>
</header>

<div class="layout">
  <nav class="sidebar" id="sidebar" aria-label="File browser">
    <div class="sb-scroll" id="sbScroll">
      <div class="sb-header">
        <span>Notes</span>
        <span class="sb-count" id="fileCount">${fileCount}</span>
      </div>
      ${sidebarHtml}
    </div>
  </nav>
  <div class="content-shell" id="contentShell">
    <div class="md-wrap">
      <div id="content">${contentHtml}</div>
    </div>
  </div>
</div>

<script>
/* ── THEME (sync, no flash) ─────────────────────────────── */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.getElementById('hlDark').disabled  = t !== 'dark';
  document.getElementById('hlLight').disabled = t !== 'light';
  localStorage.setItem('readme-reader-theme', t);
}
applyTheme(localStorage.getItem('readme-reader-theme') || 'dark');
document.getElementById('btnTheme').addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')
);

/* ── PDF EXPORT ─────────────────────────────────────────── */
// Show the PDF button only when a real file is being viewed
function setPdfBtn(visible) {
  document.getElementById('btnPdf').classList.toggle('pdf-hidden', !visible);
}
// Initialise based on current URL (non-root path = file is open)
setPdfBtn(location.pathname.length > 1);

document.getElementById('btnPdf').addEventListener('click', () => {
  // Small delay so any pending KaTeX / highlight renders finish first
  setTimeout(() => window.print(), 80);
});

/* ── SIDEBAR ────────────────────────────────────────────── */
const isMobile = () => window.innerWidth <= 768;
if (!isMobile() && localStorage.getItem('readme-reader-sb') === '0')
  document.body.classList.add('sb-collapsed');

document.getElementById('btnMenu').addEventListener('click', () => {
  if (isMobile()) { document.body.classList.toggle('sb-open'); }
  else { const c = document.body.classList.toggle('sb-collapsed'); localStorage.setItem('readme-reader-sb', c ? '0' : '1'); }
});
document.getElementById('sbBackdrop').addEventListener('click', () => document.body.classList.remove('sb-open'));
window.addEventListener('resize', () => { if (!isMobile()) document.body.classList.remove('sb-open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('sb-open'); });

/* ── HIGHLIGHT ──────────────────────────────────────────── */
function applyHL() {
  document.querySelectorAll('#content pre code:not([data-hl])').forEach(el => {
    hljs.highlightElement(el); el.dataset.hl = '1';
  });
}
applyHL();

/* ── MATH ───────────────────────────────────────────────── */
function renderMath() {
  if (!window.renderMathInElement) return;
  renderMathInElement(document.getElementById('content'), {
    delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
    throwOnError: false
  });
}

/* ── ACTIVE LINK ────────────────────────────────────────── */
function markActive(fp) {
  const d = decodeURIComponent(fp || '');
  document.querySelectorAll('.file-link').forEach(a => a.classList.toggle('active', a.dataset.path === d));
}
markActive(location.pathname.slice(1));

/* ── BIND SIDEBAR LINKS ─────────────────────────────────── */
function bindLinks() {
  document.querySelectorAll('.file-link:not(.dying)').forEach(a => {
    a.onclick = e => { e.preventDefault(); if (isMobile()) document.body.classList.remove('sb-open'); navigate(a.href); };
  });
}
bindLinks();

/* ── HASH SCROLL ────────────────────────────────────────── */
function scrollToHash(hash) {
  if (!hash) return;
  try {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const el = document.getElementById(id) || document.querySelector('[name="' + CSS.escape(id) + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {}
}

/* ── CONTENT ANCHOR INTERCEPTION ───────────────────────── */
document.getElementById('content').addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const raw = a.getAttribute('href') || '';
  if (raw.startsWith('#')) { e.preventDefault(); scrollToHash(raw); history.replaceState(null,'',location.pathname+raw); return; }
  let url;
  try { url = new URL(raw, location.href); } catch { return; }
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname === location.pathname) { if (url.hash) { scrollToHash(url.hash); history.pushState(null,'',location.pathname+url.hash); } return; }
  navigate(url.href);
}, true);

/* ── SPA NAVIGATE ───────────────────────────────────────── */
let _lock = false;
async function navigate(url) {
  if (_lock) return; _lock = true;
  try {
    const u   = new URL(url, location.origin);
    const res = await fetch(u.pathname + u.search);
    if (!res.ok) throw new Error(res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const nc  = doc.getElementById('content');
    if (!nc) return;
    const c = document.getElementById('content');
    c.innerHTML = nc.innerHTML;
    c.classList.add('page-enter');
    c.addEventListener('animationend', () => c.classList.remove('page-enter'), { once:true });
    applyHL(); renderMath();
    const fp = decodeURIComponent(u.pathname.slice(1));
    document.getElementById('topbarPath').textContent = fp || 'notes/';
    history.pushState({}, '', u.pathname + u.search);
    markActive(fp);
    setPdfBtn(!!fp);  // show PDF button only when a file is open
    if (u.hash) setTimeout(() => scrollToHash(u.hash), 60);
    else window.scrollTo({ top:0, behavior:'smooth' });
  } catch(e) { console.error('Navigate error:', e); }
  finally { _lock = false; }
}
window.addEventListener('popstate', () => navigate(location.href));

/* ── SIDEBAR REFRESH ────────────────────────────────────── */
async function refreshSidebar() {
  try {
    const html = await fetch('/__sidebar__').then(r => r.text());
    document.getElementById('sbScroll').innerHTML = html;
    markActive(decodeURIComponent(location.pathname.slice(1)));
    bindLinks();
    const c = document.getElementById('fileCount');
    if (c) c.textContent = document.querySelectorAll('.file-link').length;
  } catch {}
}

/* ── DELETED SCREEN ─────────────────────────────────────── */
function showDeleted(fp) {
  document.getElementById('content').innerHTML =
    '<div class="del-banner"><div style="font-size:2.4rem">🗑️</div><h2>File Deleted</h2><div class="dp">' + fp + '</div><p>Removed from disk. Pick another file from the sidebar.</p></div>' +
    '<a class="btn-back" href="/">← Back to home</a>';
  document.getElementById('topbarPath').textContent = fp + ' (deleted)';
  history.pushState({}, '', '/');
}

/* ── WEBSOCKET LIVE ENGINE ──────────────────────────────── */
(function connectWS() {
  const dot = document.getElementById('liveDot');
  const lbl = document.getElementById('liveLabel');
  function connect() {
    const ws = new WebSocket('ws://' + location.hostname + ':${WS_PORT}');
    ws.onopen = () => { dot.classList.remove('stale'); lbl.textContent = 'Live'; };
    ws.onmessage = async ({ data }) => {
      const msg = JSON.parse(data);
      const cur = decodeURIComponent(location.pathname.slice(1));
      if (msg.type === 'deleted') {
        const lnk = document.querySelector('.file-link[data-path="' + msg.file + '"]');
        if (lnk) lnk.classList.add('dying');
        setTimeout(refreshSidebar, 1600);
        if (cur === msg.file) showDeleted(msg.file);
      } else if (msg.type === 'created') {
        await refreshSidebar();
      } else if (msg.type === 'changed' && (!cur || cur === msg.file)) {
        const sy = window.scrollY;
        try {
          const doc = new DOMParser().parseFromString(await fetch(location.href).then(r=>r.text()),'text/html');
          const nc  = doc.getElementById('content');
          if (nc) {
            const c = document.getElementById('content');
            c.innerHTML = nc.innerHTML;
            c.classList.add('flash');
            c.addEventListener('animationend', () => c.classList.remove('flash'), { once:true });
            applyHL(); renderMath(); window.scrollTo({ top:sy });
          }
        } catch {}
      }
    };
    ws.onclose = () => { dot.classList.add('stale'); lbl.textContent='Reconnecting...'; setTimeout(connect,2000); };
    ws.onerror = () => ws.close();
  }
  connect();
})();

window.addEventListener('load', () => { renderMath(); if (location.hash) setTimeout(()=>scrollToHash(location.hash),120); });
</script>
</body>
</html>`;
}

// ─── HTTP server ───────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url     = new URL(req.url, `http://localhost:${PORT}`);
  const reqPath = decodeURIComponent(url.pathname);
  const files   = collectFiles();

  // Sidebar fragment
  if (reqPath === "/__sidebar__") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(
      `<div class="sb-header"><span>Notes</span><span class="sb-count" id="fileCount">${files.length}</span></div>` +
      buildTree(files)
    );
  }

  // Home — redirect to first/root README if available
  if (reqPath === "/" || reqPath === "") {
    const rootMd = files.find(f => /^readme(\.(md|markdown))?$/i.test(f.split("/").pop()) && !f.includes("/")) || files[0];
    if (rootMd) { res.writeHead(302, { Location: "/" + encodePath(rootMd) }); return res.end(); }
    const body = files.length === 0
      ? `<div class="welcome"><h1>readme-reader</h1><p>Add <code>.md</code> files to the <strong>notes/</strong> folder to get started.</p></div>`
      : `<div class="welcome"><h1>readme-reader</h1><p>Select a file from the sidebar.</p></div>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(shell(buildTree(files), body, null));
  }

  // File request
  const filePath = reqPath.replace(/^\//, "");
  const absPath  = path.resolve(ROOT, filePath);
  if (!absPath.startsWith(ROOT + path.sep) && absPath !== ROOT) {
    res.writeHead(403); return res.end("Forbidden");
  }
  if (!files.includes(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(shell(buildTree(files),
      `<div class="del-banner"><h2>Not Found</h2><div class="dp">${esc(filePath)}</div><p>This file may have been deleted or moved.</p></div><a class="btn-back" href="/">← Back</a>`,
      filePath));
  }

  let raw;
  try { raw = fs.readFileSync(absPath, "utf-8"); }
  catch(e) { res.writeHead(500); return res.end("Read error: " + e.message); }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(shell(buildTree(files), `<div class="md">${md.render(raw)}</div>`, filePath));
});

// ─── Terminal box printer ─────────────────────────────────────────────────

/**
 * Returns the visual/display width of a string in a terminal.
 * Emoji and other "wide" Unicode characters occupy 2 columns
 * but JS string methods count them as 1–2 code units, causing
 * misalignment with hardcoded padding numbers.
 */
function visualWidth(str) {
  let width = 0;
  for (const char of str) {              // iterates by Unicode code point
    const cp = char.codePointAt(0);
    const isWide =
      (cp >= 0x1100  && cp <= 0x115F)  || // Hangul Jamo
      (cp >= 0x2E80  && cp <= 0x303E)  || // CJK Radicals / Kangxi
      (cp >= 0x3041  && cp <= 0x33BF)  || // Japanese / Korean
      (cp >= 0x33FF  && cp <= 0xA4C6)  || // CJK Unified
      (cp >= 0xA960  && cp <= 0xA97C)  || // Hangul
      (cp >= 0xAC00  && cp <= 0xD7A3)  || // Hangul Syllables
      (cp >= 0xF900  && cp <= 0xFAFF)  || // CJK Compatibility
      (cp >= 0xFE10  && cp <= 0xFE6F)  || // CJK Compatibility Forms
      (cp >= 0xFF01  && cp <= 0xFF60)  || // Fullwidth Forms
      (cp >= 0xFFE0  && cp <= 0xFFE6)  || // Fullwidth Signs
      (cp >= 0x1B000 && cp <= 0x1B12F) || // Kana Supplement
      (cp >= 0x1F000 && cp <= 0x1FFFF) || // Emoji / Mahjong / etc.
      (cp >= 0x20000 && cp <= 0x3FFFD);   // CJK Extension B–F
    width += isWide ? 2 : 1;
  }
  return width;
}

/**
 * Pads `content` so the full row (borders included) is exactly
 * (W + 4) columns: "│  " + content + padding + "  │"
 */
function row(content, W) {
  const pad = Math.max(0, W - visualWidth(content));
  return `│  ${content}${" ".repeat(pad)}  │`;
}

function printStartBanner(url, ROOT, WS_PORT) {
  // Define all content lines first so W can be derived dynamically
  const lines = [
    ["header",  "📖  readme-reader  —  Local Markdown Viewer"],
    ["divider"],
    ["content", `🌐  URL    ${url}`],
    ["content", `📁  Notes  ${ROOT}`],
    ["content", `🔌  WS     ws://localhost:${WS_PORT}`],
    ["divider"],
    ["content", "save   →  content live-reload (scroll preserved)"],
    ["content", "delete →  sidebar update + deleted banner"],
    ["content", "create →  sidebar update"],
    ["divider"],
    ["content", "Press Ctrl+C to stop"],
  ];

  // Derive box width from the longest content line (+ 2 spaces on each side)
  const W = lines.reduce((max, [type, text = ""]) =>
    type === "content" ? Math.max(max, visualWidth(text)) : max, 0
  );

  const top     = `┌${"─".repeat(W + 4)}┐`;
  const divider = `├${"─".repeat(W + 4)}┤`;
  const bottom  = `└${"─".repeat(W + 4)}┘`;

  const out = ["\n", top];
  for (const [type, text = ""] of lines) {
    if (type === "divider") out.push(divider);
    else out.push(row(text, W));
  }
  out.push(bottom, "");

  console.log(out.join("\n"));
}

// ─── Start ─────────────────────────────────────────────────────────────────
server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  printStartBanner(url, ROOT, WS_PORT);

  if (!NO_OPEN) {
    const open =
      process.platform === "darwin" ? `open "${url}"` :
      process.platform === "win32"  ? `start "" "${url}"` :
      `xdg-open "${url}"`;
    exec(open);
  }
});