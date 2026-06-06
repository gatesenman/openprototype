#!/usr/bin/env python3
"""Static wiki generator for OpenPrototype.

Splits the DeepWiki export (DEEPWIKI_RAW.md) into per-page Markdown files and
renders a self-contained static HTML site (offline-capable: mermaid.js is
vendored locally). Run: python3 wiki/build_wiki.py
"""
import os
import re
import html
import json
import markdown

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "DEEPWIKI_RAW.md")
MD_DIR = os.path.join(HERE, "markdown")
PAGES_DIR = os.path.join(HERE, "pages")
REPO = "gaosichun888/openprototype"
GH_BLOB = f"https://github.com/{REPO}/blob/main"

# Navigation tree: (number, title, depth)
NAV = [
    ("1", "OpenPrototype Overview", 0),
    ("1.1", "Getting Started & Project Setup", 1),
    ("1.2", "Application Shell & View Routing", 1),
    ("2", "Core Data Model & Schema", 0),
    ("2.1", "GpoDocument Schema & Types", 1),
    ("2.2", "Auto Layout & Constraints Engine", 1),
    ("2.3", "File Persistence & .gpo Format", 1),
    ("3", "State Management", 0),
    ("3.1", "useStore: Document & Selection State", 1),
    ("3.2", "useUi: Transient UI State", 1),
    ("4", "Canvas & Design Editor", 0),
    ("4.1", "CanvasStage: Konva Rendering Engine", 1),
    ("4.2", "Vector Editing & Boolean Operations", 1),
    ("4.3", "Properties Panel & Node Inspection", 1),
    ("4.4", "Canvas Panels: Layers, Assets, Comments & Context Menu", 1),
    ("5", "AI Generation System", 0),
    ("5.1", "Page & Flow Generation", 1),
    ("5.2", "Requirements AI Assistance", 1),
    ("5.3", "AI Settings & LLM Provider Integration", 1),
    ("6", "Design System", 0),
    ("6.1", "Design Tokens, Variables & Presets", 1),
    ("6.2", "Design Rules Engine & Audit", 1),
    ("7", "Requirements & Journey Mapping", 0),
    ("7.1", "Requirements View", 1),
    ("7.2", "User Journey Map", 1),
    ("8", "Export & Preview", 0),
    ("8.1", "Code Export (React, Vue, Tailwind, HTML, CSS)", 1),
    ("8.2", "HTML Prototype Export & Preview Player", 1),
    ("8.3", "Image, PDF & SVG Export", 1),
    ("9", "Component Marketplace & Plugin System", 0),
    ("9.1", "Component Packages & Marketplace", 1),
    ("9.2", "Plugin System", 1),
    ("10", "Design Interop & Import", 0),
    ("11", "Cloud Backend & Collaboration", 0),
    ("11.1", "Backend API (FastAPI Server)", 1),
    ("11.2", "Frontend Cloud Integration", 1),
    ("12", "Desktop Application (Tauri)", 0),
    ("12.1", "Tauri Runtime & Native Integration", 1),
    ("12.2", "Tauri Configuration & Desktop Release", 1),
    ("13", "Glossary", 0),
]


def slug(num):
    return "page-" + num.replace(".", "_")


def title_to_num(title):
    for num, t, _ in NAV:
        if t == title:
            return num
    return None


def split_pages(raw):
    """Return ordered list of (title, body) from the raw export."""
    parts = re.split(r"(?m)^# Page: (.+)$", raw)
    pages = []
    # parts[0] is preamble (empty); then alternating title, body
    for i in range(1, len(parts), 2):
        title = parts[i].strip()
        body = parts[i + 1].strip() if i + 1 < len(parts) else ""
        pages.append((title, body))
    return pages


def fix_links(md):
    # DeepWiki uses empty () after source refs like [README.md:10-20]() -> link to blob
    def repl_src(m):
        label = m.group(1)
        fpart = label.split(":")[0]
        line = ""
        lm = re.search(r":(\d+)(?:-(\d+))?", label)
        if lm:
            line = "#L" + lm.group(1) + ("-L" + lm.group(2) if lm.group(2) else "")
        if "/" in fpart or "." in fpart:
            return f"[{label}]({GH_BLOB}/{fpart}{line})"
        return label

    md = re.sub(r"\[([^\]]+)\]\(\)", repl_src, md)

    # relative repo file links [text](src/foo.ts) -> blob (skip http/# and .md handled later)
    def repl_rel(m):
        text, url = m.group(1), m.group(2)
        if url.startswith(("http", "#", "mailto:", "page-")):
            return m.group(0)
        anchor = ""
        if "#" in url:
            url, anchor = url.split("#", 1)
            anchor = "#" + anchor
        return f"[{text}]({GH_BLOB}/{url}{anchor})"

    md = re.sub(r"\[([^\]]+)\]\((?!https?:|#|mailto:)([^)]+)\)", repl_rel, md)

    # intra-wiki section links like (#1.2) or (#4.3)
    def repl_anchor(m):
        text, num = m.group(1), m.group(2)
        return f"[{text}]({slug(num)}.html)"

    md = re.sub(r"\[([^\]]+)\]\(#(\d+(?:\.\d+)?)\)", repl_anchor, md)
    return md


def render_body(md):
    """Protect mermaid blocks, render markdown, restore mermaid as <pre class=mermaid>."""
    mermaids = []

    def stash(m):
        mermaids.append(m.group(1))
        return f"@@MERMAID{len(mermaids)-1}@@"

    md = re.sub(r"```mermaid\n(.*?)```", stash, md, flags=re.S)
    md = fix_links(md)
    htmlout = markdown.markdown(
        md,
        extensions=["fenced_code", "codehilite", "tables", "toc", "sane_lists"],
        extension_configs={"codehilite": {"guess_lang": False}},
    )
    for i, code in enumerate(mermaids):
        block = '<pre class="mermaid">' + html.escape(code) + "</pre>"
        htmlout = htmlout.replace(f"@@MERMAID{i}@@", block)
    return htmlout


def build_nav(active_num):
    items = []
    for num, title, depth in NAV:
        cls = "nav-item" + (" depth1" if depth else " depth0")
        if num == active_num:
            cls += " active"
        items.append(
            f'<a class="{cls}" href="{slug(num)}.html"><span class="num">{num}</span>{html.escape(title)}</a>'
        )
    return "\n".join(items)


PAGE_TMPL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title} · OpenPrototype Wiki</title>
<link rel="stylesheet" href="../assets/wiki.css"/>
</head>
<body>
<div class="layout">
<aside class="sidebar">
  <a class="brand" href="page-1.html">OpenPrototype<small>DeepWiki</small></a>
  <input id="filter" placeholder="筛选页面…" oninput="filterNav(this.value)"/>
  <nav id="nav">{nav}</nav>
  <div class="src">源仓库：<a href="https://github.com/{repo}" target="_blank">{repo}</a></div>
</aside>
<main class="content">
  <article class="md">{body}</article>
  <footer>由内部 DeepWiki 知识库生成 · 静态化站点 · <a href="https://github.com/{repo}" target="_blank">{repo}</a></footer>
</main>
</div>
<script src="../assets/mermaid.min.js"></script>
<script>
  mermaid.initialize({{ startOnLoad: true, theme: 'dark', securityLevel: 'loose' }});
  function filterNav(q){{
    q=q.toLowerCase();
    document.querySelectorAll('#nav .nav-item').forEach(function(a){{
      a.style.display = a.textContent.toLowerCase().includes(q) ? '' : 'none';
    }});
  }}
</script>
</body>
</html>
"""


def main():
    os.makedirs(MD_DIR, exist_ok=True)
    os.makedirs(PAGES_DIR, exist_ok=True)
    raw = open(RAW, encoding="utf-8").read()
    pages = split_pages(raw)
    print(f"parsed {len(pages)} pages")
    for title, body in pages:
        num = title_to_num(title)
        if not num:
            print("WARN no nav num for:", title)
            continue
        # markdown source
        with open(os.path.join(MD_DIR, slug(num) + ".md"), "w", encoding="utf-8") as f:
            f.write(f"# {num} {title}\n\n{body}\n")
        # html
        body_html = render_body(body)
        out = PAGE_TMPL.format(
            title=html.escape(f"{num} {title}"),
            nav=build_nav(num),
            body=body_html,
            repo=REPO,
        )
        with open(os.path.join(PAGES_DIR, slug(num) + ".html"), "w", encoding="utf-8") as f:
            f.write(out)
    # index redirect
    with open(os.path.join(HERE, "index.html"), "w", encoding="utf-8") as f:
        f.write(
            '<!DOCTYPE html><meta charset="utf-8">'
            '<meta http-equiv="refresh" content="0; url=pages/page-1.html">'
            '<title>OpenPrototype Wiki</title>'
            '<a href="pages/page-1.html">进入 OpenPrototype Wiki →</a>'
        )
    with open(os.path.join(HERE, "structure.json"), "w", encoding="utf-8") as f:
        json.dump([{"num": n, "title": t, "depth": d} for n, t, d in NAV], f, ensure_ascii=False, indent=2)
    print("done")


if __name__ == "__main__":
    main()
