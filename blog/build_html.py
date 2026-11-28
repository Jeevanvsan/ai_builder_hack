"""Render medium_post.md to medium_post.html for copy-pasting into Medium (stdlib only).

Usage: python3 blog/build_html.py

Images are shown for review but made unselectable, so "select all + copy" carries only text; each image slot
leaves a visible marker line saying which file to upload and the caption to type, for Medium's editor.
Handles the Markdown subset the post uses: #/##/### headings, paragraphs, - lists, > quotes, ``` code,
![alt](src) followed by an *italic caption* line, **bold**, *italic*, `code` and [links](url).
"""
import html
import re
import sys

import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "medium_post.md")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "medium_post.html")


def inline(text: str) -> str:
    codes = []

    def keep_code(m):
        codes.append(html.escape(m.group(1)))
        return f"\x00{len(codes) - 1}\x00"

    t = re.sub(r"`([^`]+)`", keep_code, text)
    t = html.escape(t, quote=False)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{codes[int(m.group(1))]}</code>", t)
    return t


lines = open(SRC, encoding="utf-8").read().splitlines()
out, i, para, img_n = [], 0, [], 0


def flush():
    global para
    if para:
        out.append(f"<p>{inline(' '.join(para))}</p>")
        para = []


while i < len(lines):
    line = lines[i]
    if line.startswith("```"):
        flush()
        lang = line[3:].strip()
        i += 1
        code = []
        while i < len(lines) and not lines[i].startswith("```"):
            code.append(lines[i])
            i += 1
        out.append(f'<pre data-lang="{lang}"><code>{html.escape(chr(10).join(code))}</code></pre>')
    elif m := re.match(r"^(#{1,3}) (.*)$", line):
        flush()
        n = len(m.group(1))
        out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
    elif m := re.match(r"^!\[([^\]]*)\]\(([^)]+)\)$", line):
        flush()
        img_n += 1
        alt, src = m.group(1), m.group(2)
        caption = ""
        if i + 1 < len(lines) and re.match(r"^\*.*\*$", lines[i + 1].strip()):
            caption = lines[i + 1].strip()[1:-1]
            i += 1
        # An image that isn't in the kit yet (the team photo) gets a dashed slot instead of a broken picture.
        exists = os.path.exists(os.path.join(os.path.dirname(os.path.abspath(OUT)), src))
        what = f"<b>{html.escape(src)}</b>" if exists else f"your own photo (save it as <b>{html.escape(src)}</b> to keep it in the kit)"
        out.append(
            f'<p class="marker">[Image {img_n}: upload {what} here. '
            f"Caption: {inline(caption)} &nbsp;Alt text: {html.escape(alt)}]</p>"
        )
        if exists:
            out.append(
                f'<figure class="preview" aria-hidden="true"><img src="{html.escape(src)}" alt="{html.escape(alt)}"></figure>'
            )
        else:
            out.append(f'<div class="slot" aria-hidden="true">Photo goes here: {html.escape(alt)}</div>')
    elif line.startswith("> "):
        flush()
        quote = [line[2:]]
        while i + 1 < len(lines) and lines[i + 1].startswith("> "):
            i += 1
            quote.append(lines[i][2:])
        out.append(f"<blockquote>{inline(' '.join(quote))}</blockquote>")
    elif line.startswith("- "):
        flush()
        items = [line[2:]]
        while i + 1 < len(lines) and lines[i + 1].startswith("- "):
            i += 1
            items.append(lines[i][2:])
        out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>")
    elif not line.strip():
        flush()
    else:
        para.append(line.strip())
    i += 1
flush()

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QuickOne blog draft</title>
<style>
  :root {{ --ink: #242424; --muted: #6b6b6b; --line: #e6e6e6; --note: #fff4d6; --note-ink: #6a4b00; }}
  body {{ margin: 0; background: #fff; color: var(--ink); }}
  .help {{ background: #1c1a16; color: #f4efe6; font: 15px/1.5 system-ui, sans-serif; padding: 14px 16px; user-select: none; }}
  .help b {{ color: #ffb487; }}
  article {{ max-width: 700px; margin: 0 auto; padding: 32px 16px 80px; font: 20px/1.6 Georgia, 'Times New Roman', serif; }}
  h1, h2, h3 {{ font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; letter-spacing: -0.01em; line-height: 1.2; }}
  h1 {{ font-size: 40px; margin: 0 0 8px; }}
  h2 {{ font-size: 28px; margin: 48px 0 8px; }}
  h1 + h2 {{ font-size: 22px; font-weight: 500; color: var(--muted); margin-top: 0; }}
  h3 {{ font-size: 22px; margin: 32px 0 4px; }}
  a {{ color: inherit; }}
  blockquote {{ margin: 24px 0; padding-left: 20px; border-left: 3px solid var(--ink); font-style: italic; }}
  code {{ font: 16px/1.4 ui-monospace, Menlo, monospace; background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }}
  pre {{ background: #f2f2f2; padding: 16px; overflow-x: auto; border-radius: 4px; }}
  pre code {{ background: none; padding: 0; font-size: 15px; }}
  figure.preview {{ margin: 8px -16px 28px; user-select: none; -webkit-user-select: none; }}
  figure.preview img {{ width: 100%; display: block; }}
  figure.preview figcaption {{ font: 15px/1.4 system-ui, sans-serif; color: var(--muted); text-align: center; margin-top: 8px; }}
  .marker {{ background: var(--note); color: var(--note-ink); font: 14px/1.45 system-ui, sans-serif; padding: 8px 10px; border-radius: 6px; }}
  .slot {{ border: 2px dashed #c9c1b3; border-radius: 10px; padding: 64px 16px; margin: 8px 0 28px; text-align: center; color: var(--muted); font: 16px/1.4 system-ui, sans-serif; user-select: none; -webkit-user-select: none; }}
  @media (max-width: 600px) {{ article {{ font-size: 18px; }} h1 {{ font-size: 32px; }} }}
</style>
</head>
<body>
<div class="help"><b>How to use:</b> click in the article, press Ctrl+A (or Cmd+A), copy, and paste into a new Medium story.
Images don't copy: each yellow line marks where to upload one from <b>blog/images/</b>, with its caption. Delete the yellow lines afterwards.</div>
<article>
{chr(10).join(out)}
</article>
</body>
</html>
"""
open(OUT, "w", encoding="utf-8").write(page)
print(f"wrote {OUT}: {len(out)} blocks, {img_n} images")
