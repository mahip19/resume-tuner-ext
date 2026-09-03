// Structured editor for a LaTeX résumé, tuned for the common
// Jake Gutierrez / sb2nov template (\resumeSubheading, \resumeItem, etc.) with a
// safe line-based fallback for anything it doesn't recognize.
//
// Model: the document is broken into an ordered list of `segments`. Each segment
// is either { fixed: text } (never editable, reproduced verbatim) or a field
// { field: true, label, value, section, kind }. Concatenating every segment's
// text/value reproduces the original document byte-for-byte, so editing a field
// value and re-serializing can never corrupt the parts we didn't understand.

// macroName -> arg labels. `bullet` labels get the section name prefixed.
const MACROS = {
  section: { labels: ["Section"], isSection: true },
  subsection: { labels: ["Section"], isSection: true },
  resumeSubheading: {
    labels: ["Title", "Right (dates)", "Subtitle", "Right (location)"],
  },
  resumeSubSubheading: { labels: ["Subtitle", "Right"] },
  resumeProjectHeading: { labels: ["Project + tech", "Right"] },
  resumeItem: { labels: ["bullet"] },
  resumeSubItem: { labels: ["bullet"] },
};

function isSpace(c) {
  return c === " " || c === "\t" || c === "\n" || c === "\r";
}

// Read a balanced {...} group starting at s[idx] === '{'. Returns
// { inner, close } where close is the index of the matching '}'.
function readArg(s, idx, end) {
  if (s[idx] !== "{") return null;
  let depth = 0;
  for (let j = idx; j < end; j++) {
    const c = s[j];
    if (c === "\\") {
      j++; // skip the escaped character (\%, \&, \{, \\, ...)
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { inner: s.slice(idx + 1, j), close: j };
    }
  }
  return null;
}

function skipSpace(s, i, end) {
  while (i < end && isSpace(s[i])) i++;
  return i;
}

// Try to parse a recognized macro (with all its brace args) starting at s[i]==='\\'.
// Returns { segments, next, sectionName } or null.
function tryMacro(s, i, end) {
  const m = /^\\([a-zA-Z]+)/.exec(s.slice(i, i + 40));
  if (!m) return null;
  const spec = MACROS[m[1]];
  if (!spec) return null;

  const segments = [];
  let localStart = i; // start of the pending fixed run
  let p = i + m[0].length; // just after the macro name
  let sectionName = null;

  for (let a = 0; a < spec.labels.length; a++) {
    const q = skipSpace(s, p, end);
    if (s[q] !== "{") return null; // not the arg shape we expected — treat as plain text
    const arg = readArg(s, q, end);
    if (!arg) return null;

    if (arg.inner.trim() === "") {
      // Empty arg (e.g. the {} on \resumeProjectHeading) — keep as fixed.
      p = arg.close + 1;
      continue;
    }
    // Fixed run up to and including the opening brace.
    segments.push({ fixed: s.slice(localStart, q + 1) });
    segments.push({ field: true, label: spec.labels[a], value: arg.inner });
    localStart = arg.close; // next fixed run starts at the closing brace
    p = arg.close + 1;
    if (spec.isSection && a === 0) sectionName = arg.inner;
  }
  // Trailing fixed (the final closing brace and anything consumed for empty args).
  segments.push({ fixed: s.slice(localStart, p) });
  return { segments, next: p, sectionName };
}

// Does a line carry human-editable prose (letters that aren't just command names)?
function hasProse(line) {
  const stripped = line
    .replace(/\\[a-zA-Z@]+\*?/g, " ")
    .replace(/[{}\\$&#~^_]/g, " ");
  return /[A-Za-z]{2,}/.test(stripped);
}

function cleanLabel(s) {
  return s.replace(/\\([&%$#_{}])/g, "$1").replace(/\s+/g, " ").trim();
}

function parse(tex) {
  const segments = [];

  // Scope to the document body when present.
  let bodyStart = 0;
  let bodyEnd = tex.length;
  const bd = tex.indexOf("\\begin{document}");
  const ed = tex.indexOf("\\end{document}");
  if (bd >= 0 && ed > bd) {
    bodyStart = tex.indexOf("\n", bd) + 1;
    bodyEnd = ed;
  }
  if (bodyStart > 0) segments.push({ fixed: tex.slice(0, bodyStart) });

  let i = bodyStart;
  let currentSection = "Header";

  while (i < bodyEnd) {
    // Preserve leading whitespace of the line as fixed.
    const wsEnd = skipSpace(tex, i, bodyEnd);
    if (wsEnd > i) {
      segments.push({ fixed: tex.slice(i, wsEnd) });
      i = wsEnd;
      if (i >= bodyEnd) break;
    }

    if (tex[i] === "\\") {
      const macro = tryMacro(tex, i, bodyEnd);
      if (macro) {
        // Tag fields with their section for grouping/labels.
        for (const seg of macro.segments) {
          if (seg.field) {
            seg.section = macro.sectionName ? cleanLabel(macro.sectionName) : currentSection;
            if (seg.label === "bullet") seg.label = "Bullet";
          }
          segments.push(seg);
        }
        if (macro.sectionName) currentSection = cleanLabel(macro.sectionName);
        i = macro.next;
        continue;
      }
    }

    // No recognized macro here — consume the rest of the line.
    let lineEnd = tex.indexOf("\n", i);
    if (lineEnd < 0 || lineEnd >= bodyEnd) lineEnd = bodyEnd;
    const line = tex.slice(i, lineEnd);

    const trimmed = line.trim();
    const structural = /^\\(begin|end)\b/.test(trimmed) || trimmed.startsWith("%");
    if (hasProse(line) && !structural) {
      segments.push({ field: true, label: "Line", value: line, section: currentSection });
    } else {
      segments.push({ fixed: line });
    }
    // Emit the newline (if any) as fixed and advance.
    if (lineEnd < bodyEnd) {
      segments.push({ fixed: "\n" });
      i = lineEnd + 1;
    } else {
      i = bodyEnd;
    }
  }

  if (bodyEnd < tex.length) segments.push({ fixed: tex.slice(bodyEnd) });

  const fields = segments.filter((s) => s.field);
  return { segments, fields };
}

function serialize(parsed) {
  let out = "";
  for (const s of parsed.segments) out += s.field ? s.value : s.fixed;
  return out;
}

window.ResumeForgerFields = { parse, serialize };
