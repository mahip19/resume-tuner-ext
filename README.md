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
   byte-for-byte and only tweak the wording to fit one page. Two styles:
   - **Full rewrite** — Claude returns the whole tailored `.tex`.
   - **Changes only** — Claude returns just the edited lines (`N| new text` / `N| DROP`);
     the panel previews a diff and applies them by field number (titles, companies, and
     dates are excluded, so it can't touch facts). Much less to generate and paste.
3. **Paste** the LaTeX (full rewrite) or the changes (changes-only) back into the panel.
4. **Compile to PDF** — preview it, download it, or drag it onto your desktop.

Three editors/panels for the résumé:

- **LaTeX** — the raw source.
- **Fields** — a form grouped by section (Title / Dates / Subtitle / Location / each Bullet,
  plus editable header/skills/courses lines). Edits flow straight back into the LaTeX. Tuned
  for the common [Jake Gutierrez / sb2nov](https://github.com/sb2nov/resume) template, with a
  safe line-based fallback for anything it doesn't recognize.
- **Layout** — sliders/dropdowns to fit one page yourself without waiting on Claude: font size,
  text width, vertical position, text height, and compactness (spacing). Applied on the fly at
  compile time as non-destructive overrides (your text is never touched), with a one-click
  **Reset**. A **page-count badge** after each compile ("1 page ✓" / "2 pages") so you can dial
  it in fast.
- **Keywords** — an ATS-style match (like Jobscan / Resume Worded), computed locally: it pulls
  skills/keywords from the job description and shows which your résumé **matches** vs **misses**,
  with a match score. Click a missing chip to copy it. No AI, no network.

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

- [x] Page-count badge after compile (1 vs 2 pages at a glance)
- [x] Layout controls to fit one page without a Claude round-trip
- [x] ATS keyword match (matched vs missing keywords from the JD)
- [x] "Changes only" mode — Claude returns just the edited lines (by field number),
      previewed and applied in-panel, instead of re-emitting the whole résumé
- [ ] One-click "comment out the OPTIONAL project" helper to fit one page
- [ ] Drag-to-reorder bullets in the Fields tab
- [ ] Per-template field-label profiles
- [ ] Optional fully-offline compile

## License

MIT — see [LICENSE](LICENSE).
