# Resume Forger

A personal Chromium (Brave / Chrome / Edge) **side-panel extension** that tailors your
**LaTeX résumé** to a job description and compiles it to a ready-to-drag **PDF** — with
**no API keys and no paid services**.

It leans on the Claude access you already have (Claude / Claude Code): the extension builds a
tight, fully-instructed prompt you paste into Claude, then you paste the result back into the
panel and compile it in place — no tab-switching to a separate site, no re-uploading files.

## Features

- **JD → tailored résumé** without leaving the browser side panel.
- **Two prompt styles** — a full rewrite, or a fast **changes-only** mode where Claude returns
  just the edited lines and the panel applies them by field number.
- **Fields editor** — edit bullets/skills as a simple form instead of hunting through LaTeX.
- **Layout controls** — sliders to fit one page yourself (font size, margins, spacing) with a
  live **page-count badge**, no Claude round-trip.
- **Keywords** — an ATS-style match showing which JD keywords your résumé hits vs misses.
- **In-browser PDF** via the LaTeX Project's public compiler; preview, download, or drag out.

## How it works

1. **Job description** — paste it, or click **Grab from page** to pull it off the current tab.
2. **Copy prompt for Claude** — one click copies a prompt (your résumé + the JD + your standing
   preferences) that tells Claude to keep your template's styling/spacing byte-for-byte and only
   tweak wording to fit one page. Two styles:
   - **Full rewrite** — Claude returns the whole tailored `.tex`.
   - **Changes only** — Claude returns just the edited lines (`N| new text` / `N| DROP`); the
     panel previews a diff and applies them by field number. Titles, companies, and dates are
     excluded from the editable set, so Claude can't alter facts. Much less to generate and paste.
3. **Paste** the LaTeX (full rewrite) or the changes (changes-only) back into the panel.
4. **Compile to PDF** — preview it, download it, or drag it onto your desktop.

## The four panels

- **LaTeX** — the raw source.
- **Fields** — a form grouped by section (Title / Dates / Subtitle / Location / each Bullet,
  plus editable header/skills/courses lines). Edits flow straight back into the LaTeX. Tuned for
  the common [Jake Gutierrez / sb2nov](https://github.com/sb2nov/resume) template, with a safe
  line-based fallback for anything it doesn't recognize.
- **Layout** — sliders/dropdowns to fit one page yourself without waiting on Claude: font size,
  text width, vertical position, text height, and compactness. Applied on the fly at compile time
  as non-destructive overrides (your text is never touched), with a one-click **Reset** and a
  **page-count badge** ("1 page ✓" / "2 pages").
- **Keywords** — an ATS-style match (like Jobscan / Resume Worded), computed locally: pulls
  skills/keywords from the job description and shows which your résumé **matches** vs **misses**,
  with a match score. Click a missing chip to copy it. No AI, no network.

## Install (unpacked)

1. `brave://extensions` (or `chrome://extensions`) → enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Click the toolbar icon to open the side panel, then **Settings** → paste your full `.tex`
   résumé (preamble + document) and any standing preferences → **Save**.

To update after pulling new changes, hit the **reload** ↻ icon on the extension card.

## Compiling

The PDF is produced by the LaTeX Project's public compiler at
[texlive.net](https://texlive.net) (David Carlisle's `latexcgi`) — reliable, free, no key. The
extension POSTs your `.tex` there and reads the page count from the compile log.

> **Privacy note:** compiling sends your `.tex` to texlive.net — a reputable service run by the
> LaTeX Project that just compiles and returns the PDF. Everything else (tailoring prompt, field
> editing, layout, keyword matching) runs entirely on your machine. The extension makes **no
> AI/API calls** and stores no keys; the compile request is the only network call.

## Project structure

```
extension/
  manifest.json        # MV3, side panel, texlive.net host permission
  background.js        # opens the side panel; grabs the JD off the active tab
  sidepanel.html/css/js# the panel UI and orchestration
  options.html/css/js  # settings: résumé template + standing preferences
  lib/
    prompt.js          # full-rewrite prompt builder
    changes.js         # changes-only prompt + reply parser/applier
    texfields.js       # LaTeX ↔ editable fields (sb2nov-aware, lossless)
    layout.js          # non-destructive layout overrides + page counting
    keywords.js        # local ATS keyword extraction & matching
    latex.js           # compile via texlive.net (PDF + log page count)
```

## Roadmap / ideas

- [x] Page-count badge after compile (1 vs 2 pages at a glance)
- [x] Layout controls to fit one page without a Claude round-trip
- [x] ATS keyword match (matched vs missing keywords from the JD)
- [x] "Changes only" mode — Claude returns just the edited lines, previewed and applied in-panel
- [ ] Per-line accept/reject in the changes diff
- [ ] "Add my missing keywords to the prompt" one-click
- [ ] One-click "comment out the OPTIONAL project" helper to fit one page
- [ ] Drag-to-reorder bullets in the Fields tab
- [ ] Per-template field-label profiles
- [ ] Optional fully-offline compile

## License

MIT — see [LICENSE](LICENSE).
