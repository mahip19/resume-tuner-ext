// "Changes only" mode: instead of Claude re-emitting the whole résumé, it edits
// a numbered list of just the reword-able lines and returns only what changed.
// The extension maps `N| text` / `N| DROP` back onto the parsed fields.
//
// Reuses the texfields parser. The editable subset deliberately EXCLUDES section
// titles, job titles/companies (Title/Subtitle), and dates/locations (Right ...),
// so Claude can only reword bullets, skills lines, and project tech — never facts.

function isEditable(field) {
  if (field.label === "Bullet") return true;
  if (field.label === "Project + tech") return true;
  if (field.label === "Line" && field.section !== "Header") return true;
  return false;
}

// Ordered array of the reword-able field objects (numbered 1..N in the prompt).
function editableFields(parsed) {
  return parsed.fields.filter(isEditable);
}

function oneLine(s) {
  return String(s).replace(/\s*\n\s*/g, " ").trim();
}

function buildChangesPrompt({ jobDescription, editable, extraInstructions }) {
  const extra =
    extraInstructions && extraInstructions.trim()
      ? "\nAdditional preferences from me:\n" + extraInstructions.trim() + "\n"
      : "";
  const lines = editable.map((f, i) => i + 1 + "| " + oneLine(f.value)).join("\n");

  return `Tailor my résumé to the job below by rewording ONLY the numbered lines.

Return ONLY the lines you change, one per line, exactly in this form:
N| rewritten text
To remove a line entirely, use:
N| DROP

Rules:
- Rephrase, re-emphasize, condense, or drop only. Do NOT add any number, percentage, metric, tool, or technology that is not already present somewhere in the list — no invented facts.
- Keep any LaTeX intact (e.g. \\textbf{...}); change only the words.
- Do NOT output lines you didn't change, and do NOT renumber. No commentary, no code fences.
- Mirror the job's language and priorities.
${extra}
=== JOB DESCRIPTION ===
${jobDescription}

=== MY RÉSUMÉ LINES (reword these) ===
${lines}`;
}

// Parse Claude's reply into [{ n, drop } | { n, text }].
function parseResponse(text) {
  let s = String(text || "").trim();
  // strip markdown fences if present
  s = s.replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```$/i, "");
  const out = [];
  const seen = new Set();
  for (const raw of s.split(/\r?\n/)) {
    const m = raw.match(/^\s*#?(\d+)\s*[|:.)\]]\s?(.*)$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (seen.has(n)) continue;
    const val = m[2];
    if (/^\s*drop\s*$/i.test(val)) {
      out.push({ n, drop: true });
      seen.add(n);
    } else if (val.trim() !== "") {
      out.push({ n, text: val.replace(/\s+$/, "") });
      seen.add(n);
    }
  }
  return out;
}

// Apply changes onto the editable field objects (mutates field.value).
// Returns a report describing each change for the preview.
function applyChanges(editable, changes) {
  const report = [];
  for (const c of changes) {
    const idx = c.n - 1;
    if (idx < 0 || idx >= editable.length) {
      report.push({ n: c.n, status: "out-of-range" });
      continue;
    }
    const f = editable[idx];
    const oldText = oneLine(f.value);
    if (c.drop) {
      f.value = "";
      report.push({ n: c.n, old: oldText, drop: true, status: "ok" });
    } else {
      if (oneLine(c.text) === oldText) {
        report.push({ n: c.n, old: oldText, status: "unchanged" });
        continue;
      }
      f.value = c.text;
      report.push({ n: c.n, old: oldText, new: c.text, status: "ok" });
    }
  }
  return report;
}

// After serializing, drop lines that became empty bullets (from N| DROP).
function cleanupDropped(tex) {
  return tex.replace(/^[ \t]*\\resume(?:Item|SubItem)\*?\{\s*\}[ \t]*\r?\n?/gm, "");
}

window.ResumeForgerChanges = {
  editableFields,
  buildChangesPrompt,
  parseResponse,
  applyChanges,
  cleanupDropped,
};
