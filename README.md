# Resume Forger

A personal Chromium (Brave/Chrome/Edge) side-panel extension that tailors your
**LaTeX résumé** to a job description and compiles it to a ready-to-drag **PDF** —
without any API keys or paid services.

It leans on the Claude access you already have (Claude / Claude Code): the
extension builds a tight, fully-instructed prompt you paste into Claude, then you
paste the LaTeX Claude returns back into the panel and compile it in place.

## How it works

1. **Job description** — paste it, or click **Grab from page** to pull it off the current tab.
2. **Copy prompt for Claude** — one click copies a prompt (your résumé + the JD + your
   standing preferences) that instructs Claude to keep your template's styling and spacing
   byte-for-byte and only tweak the wording to fit one page.
3. **Paste the LaTeX** Claude returns into the panel.
4. **Compile to PDF** — preview it, download it, or drag it onto your desktop.

Two editors for the résumé:

- **LaTeX** — the raw source.
- **Fields** — a form grouped by section (Title / Dates / Subtitle / Location / each Bullet,
  plus editable header/skills/courses lines). Edits flow straight back into the LaTeX. Tuned
  for the common [Jake Gutierrez / sb2nov](https://github.com/sb2nov/resume) template, with a
  safe line-based fallback for anything it doesn't recognize.

## Install (unpacked)

1. `brave://extensions` (or `chrome://extensions`) → enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Click the toolbar icon to open the side panel, then **Settings** → paste your full
   `.tex` résumé (preamble + document) and any standing preferences → **Save**.

## Compiling

The PDF is produced by the LaTeX Project's public compiler at
[texlive.net](https://texlive.net) (David Carlisle's `latexcgi`) — reliable, free, no key.
The extension POSTs your `.tex` there and gets the PDF back.

> **Privacy note:** compiling sends your `.tex` to texlive.net. That's a reputable service
> run by the LaTeX Project that just compiles and returns the PDF. If you want fully offline
> compiling, that requires self-hosting a TeX server (a larger project).

## No API keys

The extension itself makes **no AI/API calls** and stores no keys. The only network call is
the compile request to texlive.net.

## Roadmap / ideas

- Page-count indicator after compile (1 vs 2 pages at a glance)
- One-click "comment out the OPTIONAL project" helper to fit one page
- Drag-to-reorder bullets in the Fields tab
- Per-template field-label profiles
- Optional fully-offline compile

## License

MIT — see [LICENSE](LICENSE).
