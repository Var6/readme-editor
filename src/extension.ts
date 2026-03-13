import * as vscode from 'vscode';
import * as crypto from 'crypto';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const openCmd = vscode.commands.registerCommand('readmeLivePreview.openPreview', () => {
    openOrRevealPanel(context);
  });

  // Live-update as user types
  const onDocChange = vscode.workspace.onDidChangeTextDocument(e => {
    if (panel && isMarkdown(e.document)) {
      sendUpdate(e.document.getText(), e.document.fileName);
    }
  });

  // Switch file → update preview
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (panel && editor && isMarkdown(editor.document)) {
      sendUpdate(editor.document.getText(), editor.document.fileName);
    }
  });

  context.subscriptions.push(openCmd, onDocChange, onEditorChange);

  // Auto-open if a markdown file is already open
  const current = vscode.window.activeTextEditor;
  if (current && isMarkdown(current.document)) {
    openOrRevealPanel(context);
  }
}

export function deactivate() {}

function isMarkdown(doc: vscode.TextDocument): boolean {
  return doc.languageId === 'markdown' || doc.fileName.endsWith('.md');
}

function sendUpdate(markdown: string, filePath: string) {
  if (!panel) return;
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? 'README.md';
  panel.webview.postMessage({ command: 'update', markdown, fileName });
}

function openOrRevealPanel(context: vscode.ExtensionContext) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'readmeLivePreview',
    'README Preview',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const nonce = crypto.randomBytes(16).toString('hex');
  panel.webview.html = getWebviewContent(nonce);

  panel.webview.onDidReceiveMessage(msg => {
    if (msg.command === 'ready') {
      const editor = vscode.window.activeTextEditor;
      if (editor && isMarkdown(editor.document)) {
        sendUpdate(editor.document.getText(), editor.document.fileName);
      }
    } else if (msg.command === 'applyHTML') {
      const editor = vscode.window.activeTextEditor;
      if (editor && isMarkdown(editor.document)) {
        editor.edit(builder => {
          const doc = editor.document;
          const full = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
          builder.replace(full, msg.content);
        });
        vscode.window.showInformationMessage('HTML content applied to editor.');
      }
    } else if (msg.command === 'copyDone') {
      vscode.window.showInformationMessage('HTML copied to clipboard.');
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);
}

function getWebviewContent(nonce: string): string {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>README Live Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #444);
      background: var(--vscode-tab-activeBackground, #252526);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .tab-btn {
      padding: 4px 14px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      background: transparent;
      color: var(--vscode-tab-inactiveForeground, #888);
      transition: background 0.15s, color 0.15s;
    }
    .tab-btn.active {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }
    .tab-btn:hover:not(.active) {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.07));
      color: var(--vscode-foreground, #ccc);
    }
    .filename {
      margin-left: auto;
      font-size: 12px;
      font-family: 'SFMono-Regular', Consolas, monospace;
      opacity: 0.55;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }
    .live-badge {
      font-size: 11px;
      background: #2ea043;
      color: #fff;
      padding: 1px 7px;
      border-radius: 10px;
      font-weight: 600;
      letter-spacing: 0.03em;
    }

    /* ── Tabs ── */
    .tab-content { display: none; flex: 1; min-height: 0; flex-direction: column; }
    .tab-content.active { display: flex; }

    /* ── Preview tab ── */
    #preview-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }
    .markdown-body {
      padding: 32px 40px;
      max-width: 860px;
      margin: 0 auto;
    }

    /* GitHub-like Markdown styles */
    .markdown-body h1, .markdown-body h2, .markdown-body h3,
    .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: 28px;
      margin-bottom: 14px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--vscode-editor-foreground, #e6edf3);
    }
    .markdown-body h1 {
      font-size: 2em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--vscode-panel-border, #30363d);
    }
    .markdown-body h2 {
      font-size: 1.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--vscode-panel-border, #30363d);
    }
    .markdown-body h3 { font-size: 1.25em; }
    .markdown-body h4 { font-size: 1em; }
    .markdown-body h5 { font-size: 0.875em; }
    .markdown-body h6 { font-size: 0.85em; opacity: 0.7; }

    .markdown-body p { margin-bottom: 14px; }
    .markdown-body a { color: #58a6ff; text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }

    .markdown-body code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
      background: rgba(110,118,129,0.18);
      padding: 0.2em 0.45em;
      border-radius: 5px;
    }
    .markdown-body pre {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      margin-bottom: 16px;
      position: relative;
    }
    .markdown-body pre code {
      background: transparent;
      padding: 0;
      font-size: 13px;
      color: #e6edf3;
    }
    .lang-label {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 11px;
      color: #8b949e;
      font-family: monospace;
      text-transform: uppercase;
    }
    .markdown-body blockquote {
      border-left: 4px solid #3d444d;
      padding: 4px 16px;
      color: #8b949e;
      margin-bottom: 16px;
      background: rgba(255,255,255,0.02);
      border-radius: 0 6px 6px 0;
    }
    .markdown-body ul, .markdown-body ol {
      padding-left: 2em;
      margin-bottom: 14px;
    }
    .markdown-body li { margin-bottom: 4px; }
    .markdown-body li > ul, .markdown-body li > ol { margin-top: 4px; margin-bottom: 0; }
    .markdown-body img { max-width: 100%; border-radius: 4px; }
    .markdown-body hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border, #30363d);
      margin: 28px 0;
    }
    .markdown-body table {
      border-collapse: collapse;
      margin-bottom: 16px;
      width: 100%;
      display: block;
      overflow-x: auto;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid #30363d;
      padding: 7px 14px;
      text-align: left;
    }
    .markdown-body th { background: #161b22; font-weight: 600; }
    .markdown-body tr:nth-child(even) { background: rgba(255,255,255,0.025); }
    .markdown-body .task-item { list-style: none; margin-left: -1.5em; }
    .markdown-body .task-item input[type="checkbox"] {
      margin-right: 6px;
      cursor: default;
      accent-color: #2ea043;
    }
    .markdown-body del { opacity: 0.55; }

    /* ── HTML Editor tab ── */
    #html-tab {
      flex-direction: column;
    }
    .html-panes {
      display: flex;
      flex-direction: row;
      flex: 1;
      min-height: 0;
    }
    .pane {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      min-width: 0;
    }
    .pane + .pane {
      border-left: 2px solid var(--vscode-panel-border, #30363d);
    }
    .pane-header {
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: var(--vscode-tab-inactiveBackground, #2d2d2d);
      border-bottom: 1px solid var(--vscode-panel-border, #444);
      color: var(--vscode-tab-inactiveForeground, #888);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #html-editor {
      flex: 1;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 16px;
      border: none;
      resize: none;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      outline: none;
      tab-size: 2;
    }
    #html-preview-scroll {
      flex: 1;
      overflow-y: auto;
    }
    .html-preview-body {
      padding: 20px 28px;
    }
    .html-preview-body * { max-width: 100%; }

    .action-bar {
      display: flex;
      gap: 8px;
      padding: 8px 14px;
      border-top: 1px solid var(--vscode-panel-border, #30363d);
      background: var(--vscode-tab-inactiveBackground, #252526);
      flex-shrink: 0;
    }
    .btn {
      padding: 5px 14px;
      border-radius: 4px;
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ccc);
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
  </style>
</head>
<body>

<!-- ──── Toolbar ──── -->
<div class="toolbar">
  <button class="tab-btn active" onclick="switchTab('preview')" id="btn-preview">&#128065; Preview</button>
  <button class="tab-btn"        onclick="switchTab('html')"    id="btn-html">&#60;/&#62; HTML Editor</button>
  <span class="live-badge">LIVE</span>
  <span class="filename" id="filename-label">README.md</span>
</div>

<!-- ──── Preview Tab ──── -->
<div class="tab-content active" id="preview-tab">
  <div id="preview-scroll">
    <div class="markdown-body" id="preview-body">
      <p style="opacity:0.4;font-style:italic">Open a .md file to see the live preview…</p>
    </div>
  </div>
</div>

<!-- ──── HTML Editor Tab ──── -->
<div class="tab-content" id="html-tab">
  <div class="html-panes">
    <!-- Left: HTML source editor -->
    <div class="pane">
      <div class="pane-header">
        ✏️ Edit HTML
        <span style="margin-left:auto;font-weight:400;text-transform:none;font-size:11px;opacity:.7">
          edits here are independent of the .md file
        </span>
      </div>
      <textarea id="html-editor" spellcheck="false"
        placeholder="HTML will appear here once you open a Markdown file…"
        oninput="onHTMLEditorInput()"></textarea>
    </div>
    <!-- Right: Live HTML render -->
    <div class="pane">
      <div class="pane-header">👁 Rendered HTML Preview</div>
      <div id="html-preview-scroll">
        <div class="html-preview-body markdown-body" id="html-preview-body"></div>
      </div>
    </div>
  </div>
  <div class="action-bar">
    <button class="btn btn-primary" onclick="applyHTMLToEditor()">⬆ Apply HTML to .md file</button>
    <button class="btn btn-secondary" onclick="copyHTMLToClipboard()">📋 Copy HTML</button>
    <button class="btn btn-secondary" onclick="resetHTMLFromMarkdown()">↩ Reset from Markdown</button>
  </div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

/* ─────────────────────────────────────────────
   State
───────────────────────────────────────────── */
let currentMarkdown = '';
let currentHTML     = '';
let activeTab       = 'preview';

/* ─────────────────────────────────────────────
   Tab switching
───────────────────────────────────────────── */
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tab + '-tab').classList.add('active');
  document.getElementById('btn-' + tab).classList.add('active');
}

/* ─────────────────────────────────────────────
   Messages from extension host
───────────────────────────────────────────── */
window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.command === 'update') {
    currentMarkdown = msg.markdown;
    currentHTML     = parseMarkdown(currentMarkdown);
    document.getElementById('filename-label').textContent = msg.fileName;
    document.getElementById('preview-body').innerHTML = currentHTML;
    // Only sync HTML editor if user hasn't manually edited it
    if (!htmlEditorDirty) {
      document.getElementById('html-editor').value = formatHTML(currentHTML);
      document.getElementById('html-preview-body').innerHTML = currentHTML;
    }
  }
});

/* ─────────────────────────────────────────────
   HTML Editor actions
───────────────────────────────────────────── */
let htmlEditorDirty = false;

function onHTMLEditorInput() {
  htmlEditorDirty = true;
  const html = document.getElementById('html-editor').value;
  document.getElementById('html-preview-body').innerHTML = html;
}

function resetHTMLFromMarkdown() {
  htmlEditorDirty = false;
  const html = parseMarkdown(currentMarkdown);
  document.getElementById('html-editor').value = formatHTML(html);
  document.getElementById('html-preview-body').innerHTML = html;
}

function applyHTMLToEditor() {
  const content = document.getElementById('html-editor').value;
  vscode.postMessage({ command: 'applyHTML', content });
}

function copyHTMLToClipboard() {
  const content = document.getElementById('html-editor').value;
  navigator.clipboard.writeText(content).then(() => {
    vscode.postMessage({ command: 'copyDone' });
  });
}

/* ─────────────────────────────────────────────
   HTML formatter (basic pretty-print)
───────────────────────────────────────────── */
function formatHTML(html) {
  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  let result = '';
  let indent = 0;
  const pad = () => '  '.repeat(indent);

  // Very simple tokeniser
  const tokens = html.match(/(<\/?[^>]+>|[^<]+)/g) || [];
  for (const tok of tokens) {
    if (tok.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      result += pad() + tok.trim() + '\\n';
    } else if (tok.startsWith('<')) {
      const tag = (tok.match(/^<(\\w+)/) || [])[1] || '';
      result += pad() + tok.trim() + '\\n';
      if (!VOID.has(tag.toLowerCase()) && !tok.endsWith('/>')) indent++;
    } else {
      const text = tok.trim();
      if (text) result += pad() + text + '\\n';
    }
  }
  return result.trim();
}

/* ─────────────────────────────────────────────
   ███  Markdown → HTML Parser  ███
───────────────────────────────────────────── */
function parseMarkdown(src) {
  src = src.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');

  // ── 1. Stash fenced code blocks ──────────────────
  const codeBlocks = [];
  src = src.replace(/^\`\`\`(\\w*)[^\\n]*\\n([\\s\\S]*?)\`\`\`/gm, (_, lang, code) => {
    const i = codeBlocks.push({ lang, code: code.replace(/\\n$/, '') }) - 1;
    return '\\x00CB' + i + '\\x00';
  });

  // ── 2. Stash inline code ─────────────────────────
  const inlineCodes = [];
  src = src.replace(/\`([^\`\\n]+?)\`/g, (_, code) => {
    const i = inlineCodes.push(code) - 1;
    return '\\x00IC' + i + '\\x00';
  });

  // ── 3. Block-level processing ────────────────────
  const lines = src.split('\\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ·· Code block placeholder
    const cbMatch = line.match(/^\\x00CB(\\d+)\\x00$/);
    if (cbMatch) {
      const { lang, code } = codeBlocks[+cbMatch[1]];
      const label = lang ? \`<span class="lang-label">\${esc(lang)}</span>\` : '';
      out.push(\`<pre>\${label}<code class="language-\${esc(lang)}">\${esc(code)}</code></pre>\`);
      i++; continue;
    }

    // ·· Setext headings (underline style)
    if (i + 1 < lines.length) {
      if (/^=+\\s*$/.test(lines[i + 1]) && line.trim()) {
        out.push(\`<h1 id="\${headingId(line)}">\${inline(line, inlineCodes)}</h1>\`);
        i += 2; continue;
      }
      if (/^-+\\s*$/.test(lines[i + 1]) && line.trim() && !line.startsWith('-')) {
        out.push(\`<h2 id="\${headingId(line)}">\${inline(line, inlineCodes)}</h2>\`);
        i += 2; continue;
      }
    }

    // ·· ATX headings
    const hm = line.match(/^(#{1,6})\\s+(.*?)(?:\\s+#+)?$/);
    if (hm) {
      const lv = hm[1].length;
      const txt = hm[2].trim();
      out.push(\`<h\${lv} id="\${headingId(txt)}">\${inline(txt, inlineCodes)}</h\${lv}>\`);
      i++; continue;
    }

    // ·· Horizontal rule
    if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) {
      out.push('<hr>');
      i++; continue;
    }

    // ·· Blockquote
    if (line.startsWith('>')) {
      const bqLines = [];
      while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
        bqLines.push(lines[i].startsWith('> ') ? lines[i].slice(2)
                   : lines[i].startsWith('>') ? lines[i].slice(1)
                   : '');
        i++;
      }
      out.push(\`<blockquote>\${parseMarkdown(bqLines.join('\\n'))}</blockquote>\`);
      continue;
    }

    // ·· Table (line contains | and next is separator)
    if (line.includes('|') && i + 1 < lines.length && /^\\|?[\\s:|\\-]+\\|/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(parseTable(tableLines, inlineCodes));
      continue;
    }

    // ·· Unordered list
    if (/^(\\s*)[-*+]\\s/.test(line)) {
      const result = parseList(lines, i, inlineCodes, false);
      out.push(result.html);
      i = result.nextIndex;
      continue;
    }

    // ·· Ordered list
    if (/^(\\s*)\\d+\\.\\s/.test(line)) {
      const result = parseList(lines, i, inlineCodes, true);
      out.push(result.html);
      i = result.nextIndex;
      continue;
    }

    // ·· Blank line → skip
    if (line.trim() === '') { i++; continue; }

    // ·· Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== ''
      && !/^#{1,6}\\s/.test(lines[i])
      && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i])
      && !lines[i].startsWith('>')
      && !/^(\\s*)[-*+]\\s/.test(lines[i])
      && !/^(\\s*)\\d+\\.\\s/.test(lines[i])
      && !/^\\x00CB/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(\`<p>\${inline(paraLines.join(' '), inlineCodes)}</p>\`);
    }
  }

  return out.join('\\n');
}

/* ── List parser (handles nesting + task lists) ── */
function parseList(lines, startIndex, inlineCodes, ordered) {
  const baseIndent = (lines[startIndex].match(/^(\\s*)/) || ['',''])[1].length;
  const tag = ordered ? 'ol' : 'ul';
  let html = \`<\${tag}>\`;
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const indentMatch = line.match(/^(\\s*)([-*+]|\\d+\\.)\\s(.*)/);
    if (!indentMatch) break;
    const thisIndent = indentMatch[1].length;
    if (thisIndent < baseIndent) break;
    if (thisIndent > baseIndent) { i++; continue; } // skip (absorbed by child)

    // Task list?
    let itemText = indentMatch[3];
    let taskHtml = '';
    const taskMatch = itemText.match(/^\\[([ xX])\\]\\s(.*)/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : '';
      taskHtml = \`<input type="checkbox"\${checked} disabled> \`;
      itemText = taskMatch[2];
    }

    // Check if next lines form a sub-list
    let innerHtml = '';
    i++;
    if (i < lines.length) {
      const nextIndent = (lines[i].match(/^(\\s*)/) || ['',''])[1].length;
      if (nextIndent > thisIndent && /^\\s*([-*+]|\\d+\\.)\\s/.test(lines[i])) {
        const isOrd = /^\\s*\\d+\\.\\s/.test(lines[i]);
        const sub = parseList(lines, i, inlineCodes, isOrd);
        innerHtml = sub.html;
        i = sub.nextIndex;
      }
    }

    const cls = taskMatch ? ' class="task-item"' : '';
    html += \`<li\${cls}>\${taskHtml}\${inline(itemText, inlineCodes)}\${innerHtml}</li>\`;
  }

  html += \`</\${tag}>\`;
  return { html, nextIndex: i };
}

/* ── Table parser ── */
function parseTable(tableLines, inlineCodes) {
  const parseCells = row => row.replace(/^\\||\\|$/g, '').split('|').map(c => c.trim());
  const headers = parseCells(tableLines[0]);
  const sepLine = tableLines[1] || '';
  const aligns = sepLine.replace(/^\\||\\|$/g, '').split('|').map(s => {
    s = s.trim();
    if (s.startsWith(':') && s.endsWith(':')) return 'center';
    if (s.endsWith(':')) return 'right';
    return 'left';
  });

  let html = '<table><thead><tr>';
  headers.forEach((h, idx) => {
    html += \`<th style="text-align:\${aligns[idx]||'left'}">\${inline(h, inlineCodes)}</th>\`;
  });
  html += '</tr></thead><tbody>';

  for (let r = 2; r < tableLines.length; r++) {
    const cells = parseCells(tableLines[r]);
    html += '<tr>';
    cells.forEach((c, idx) => {
      html += \`<td style="text-align:\${aligns[idx]||'left'}">\${inline(c, inlineCodes)}</td>\`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/* ── Inline element processor ── */
function inline(text, inlineCodes) {
  // Restore inline codes first (protect from further processing)
  text = text.replace(/\\x00IC(\\d+)\\x00/g, (_, i) =>
    \`<code>\${esc(inlineCodes[+i])}</code>\`);

  // Bold + Italic
  text = text.replace(/\\*{3}(.+?)\\*{3}/g, '<strong><em>$1</em></strong>');
  text = text.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');
  // Bold
  text = text.replace(/\\*{2}(.+?)\\*{2}/g, '<strong>$1</strong>');
  text = text.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\\*([^*\\n]+?)\\*/g, '<em>$1</em>');
  text = text.replace(/_([^_\\n]+?)_/g, '<em>$1</em>');
  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Images (before links)
  text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, (_, alt, src) => {
    const [url, ...titleParts] = src.split(' ');
    return \`<img alt="\${esc(alt)}" src="\${esc(url.trim())}">\`;
  });
  // Links
  text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, (_, label, href) => {
    const [url, ...titleParts] = href.split(' ');
    const title = titleParts.join(' ').replace(/['"]/g, '');
    return \`<a href="\${esc(url.trim())}"\${title ? \` title="\${esc(title)}"\` : ''}>\${label}</a>\`;
  });
  // Auto-links
  text = text.replace(/https?:\\/\\/[^\\s<>"]+/g, url =>
    \`<a href="\${esc(url)}">\${esc(url)}</a>\`);
  // Line breaks: two spaces at end of line
  text = text.replace(/  \\n/g, '<br>');
  text = text.replace(/\\n/g, ' ');

  return text;
}

/* ── Helpers ── */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headingId(text) {
  return text.toLowerCase()
    .replace(/[^\\w\\s-]/g, '')
    .replace(/\\s+/g, '-')
    .replace(/-+/g, '-');
}

/* ─────────────────────────────────────────────
   Bootstrap: tell extension we're ready
───────────────────────────────────────────── */
vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
}
