#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// new URL(import.meta.url).pathname leaves spaces URL-encoded as %20, which fs calls then treat
// literally and fail to find — fileURLToPath decodes it back to a real filesystem path.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const markdown = fs.readFileSync(
  path.join(root, "docs/MANUAL-DO-USUARIO.md"),
  "utf8",
);
const esc = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (value) =>
  esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Images before links: an unhandled "![alt](src)" would otherwise have its "!" stripped as
    // stray text and its "[alt](src)" part matched by the link rule below, turning an embedded
    // image (e.g. the side-by-side Editar/Confirmar exclusão table) into a text link instead.
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
const lines = markdown.split(/\r?\n/);
let html = "";
let index = 0;
let code = false;
let codeText = "";
while (index < lines.length) {
  const line = lines[index];
  if (line.startsWith("```")) {
    if (code) {
      html += `<pre><code>${esc(codeText)}</code></pre>`;
      codeText = "";
      code = false;
    } else code = true;
    index += 1;
    continue;
  }
  if (code) {
    codeText += `${line}\n`;
    index += 1;
    continue;
  }
  if (!line.trim()) {
    index += 1;
    continue;
  }
  if (line.startsWith("![")) {
    const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (match)
      // Relative, not file://: the browser that eventually prints this file loads it over
      // http(s) or file:// depending on how it's opened, and image paths that are already
      // relative to this file's own location (docs/) resolve correctly either way — an
      // absolute file:// URL does not, and gets blocked entirely when the page itself is
      // served over http.
      html += `<img src="${match[2]}" alt="${match[1]}">`;
    index += 1;
    continue;
  }
  if (/^#{1,3} /.test(line)) {
    const match = line.match(/^(#+) (.*)/);
    html += `<h${match[1].length}>${inline(match[2])}</h${match[1].length}>`;
    index += 1;
    continue;
  }
  if (line.startsWith("> ")) {
    html += `<blockquote>${inline(line.slice(2))}</blockquote>`;
    index += 1;
    continue;
  }
  if (/^\s*\|/.test(line)) {
    // Tables nested under a list item (e.g. the IR bracket table under "2. **Imposto de
    // Renda**...") are indented with leading spaces in the source — trim before matching, or
    // every one of their rows falls through to the plain-paragraph branch as literal "| a | b |"
    // text instead of becoming <table> markup.
    const rows = [];
    while (index < lines.length && /^\s*\|/.test(lines[index])) {
      const trimmed = lines[index].trim();
      if (!/^\|\s*-/.test(trimmed))
        rows.push(
          trimmed
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim()),
        );
      index += 1;
    }
    if (rows.length)
      html += `<table><thead><tr>${rows[0].map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows
        .slice(1)
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody></table>`;
    continue;
  }
  if (/^\s*- /.test(line)) {
    // Nested bullets (2-space indented, e.g. the "Nova movimentação" sub-items) are flattened to
    // the same level rather than rendered as a true nested <ul> — this parser doesn't track list
    // depth — but that still beats the alternative: without allowing leading whitespace here,
    // indented lines fail this match entirely and fall through to the plain-paragraph branch as
    // a literal "- text" line.
    const items = [];
    while (index < lines.length && /^\s*- /.test(lines[index])) {
      items.push(`<li>${inline(lines[index].trim().slice(2))}</li>`);
      index += 1;
    }
    html += `<ul>${items.join("")}</ul>`;
    continue;
  }
  if (/^\d+\. /.test(line)) {
    const items = [];
    while (index < lines.length && /^\d+\. /.test(lines[index])) {
      items.push(`<li>${inline(lines[index].replace(/^\d+\. /, ""))}</li>`);
      index += 1;
    }
    html += `<ol>${items.join("")}</ol>`;
    continue;
  }
  html += `<p>${inline(line)}</p>`;
  index += 1;
}
const css = `@page{size:A4;margin:17mm 15mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#20201d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:10.5pt;line-height:1.5}.manual{max-width:180mm;margin:auto}h1{font-size:24pt;line-height:1.15;color:#70551d;border-bottom:2px solid #d4af37;padding-bottom:8px;margin:0 0 14px}h2{font-size:16pt;color:#70551d;border-bottom:1px solid #e4dccb;padding-bottom:4px;margin:24px 0 9px}h3{font-size:12pt;color:#70551d;margin:16px 0 6px}p{margin:6px 0}a{color:#70551d}strong{font-weight:700}code{background:#f3efe4;border-radius:3px;padding:1px 4px;font-family:ui-monospace,monospace;font-size:9pt}pre{background:#211d14;color:#f6f1e5;padding:10px;border-radius:5px;white-space:pre-wrap;font-size:8.5pt;line-height:1.4}pre code{background:none;padding:0;color:inherit}blockquote{border-left:3px solid #d4af37;background:#faf8f2;padding:7px 10px;margin:10px 0;color:#5e594f}ul,ol{padding-left:22px;margin:6px 0}li{margin:2px 0}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:9pt;break-inside:avoid}th{background:#f1ede2;color:#4d4638;text-align:left;font-weight:700}th,td{border:1px solid #ded7c9;padding:5px 6px;vertical-align:top}img{max-width:100%;max-height:75mm;display:block;margin:10px auto;object-fit:contain}td img{max-height:50mm}h2,h3{break-after:avoid}`;
const htmlPath = path.join(root, "docs", ".manual-print.html");
fs.writeFileSync(
  htmlPath,
  `<!doctype html><html><head><meta charset="utf-8"><title>Manual do Usuário — Investe Valor</title><style>${css}</style></head><body><main class="manual">${html}</main></body></html>`,
);
console.log(htmlPath);
