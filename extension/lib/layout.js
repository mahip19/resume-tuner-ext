// Deterministic, in-panel layout tuning. Given the user's résumé (the "base"
// LaTeX) plus a settings object, it returns a rendered .tex with the layout
// applied — without mutating the base — so you can try combinations, recompile,
// and reset instantly, no Claude round-trip.
//
// Applied transforms:
//   - fontSize : rewrite the \documentclass point size (10/11/12pt)
//   - spacing  : scale every \vspace{<n>unit} magnitude by a factor
//                (sb2nov templates pack the layout into negative \vspace values)
//   - width/top/height : append \addtolength overrides just before
//                \begin{document} so they win over the template's own values
//
// Overrides are wrapped in sentinel comments and always stripped first, so the
// transform is idempotent even if a rendered doc is fed back in.

const SENT_START = "% >>> Resume Forger layout (auto) >>>";
const SENT_END = "% <<< Resume Forger layout <<<";

const DEFAULTS = {
  fontSize: "", // "" = keep template's; or "10" | "11" | "12"
  width: 0, // inches added to \textwidth (kept centered)
  top: 0, // inches added to \topmargin (moves content up/down)
  height: 0, // inches added to \textheight
  spacing: 1, // multiplier on \vspace magnitudes (>1 tighter, <1 looser)
};

function num(v, d) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

function fmt(inches) {
  return (Math.round(inches * 1000) / 1000).toString();
}

function stripOverrides(tex) {
  const re = new RegExp(
    "\\n?" + escapeRe(SENT_START) + "[\\s\\S]*?" + escapeRe(SENT_END) + "\\n?",
    "g"
  );
  return tex.replace(re, "\n");
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Which controls make sense for this document.
function capabilities(base) {
  return {
    fontSize: /\\documentclass\[[^\]]*\d+pt[^\]]*\]/.test(base),
    spacing: /\\vspace\*?\{\s*-?\d*\.?\d+\s*(pt|ex|em|in|cm|mm)\s*\}/.test(base),
    margins: true, // \addtolength overrides work on any article-class doc
  };
}

function apply(base, settingsIn) {
  const s = Object.assign({}, DEFAULTS, settingsIn || {});
  let tex = stripOverrides(base);

  // Font size
  if (s.fontSize) {
    tex = tex.replace(
      /(\\documentclass\[[^\]]*?)(\d+)pt([^\]]*\])/,
      (_m, a, _n, c) => a + s.fontSize + "pt" + c
    );
  }

  // Vertical spacing scale
  const factor = num(s.spacing, 1);
  if (factor && Math.abs(factor - 1) > 1e-6) {
    tex = tex.replace(
      /\\vspace(\*?)\{\s*(-?\d*\.?\d+)\s*(pt|ex|em|in|cm|mm)\s*\}/g,
      (_m, star, n, unit) => {
        const scaled = Math.round(parseFloat(n) * factor * 1000) / 1000;
        return "\\vspace" + star + "{" + scaled + unit + "}";
      }
    );
  }

  // Margin / height overrides
  const w = num(s.width, 0);
  const top = num(s.top, 0);
  const h = num(s.height, 0);
  const lines = [];
  if (Math.abs(w) > 1e-6) {
    lines.push("\\addtolength{\\textwidth}{" + fmt(w) + "in}");
    lines.push("\\addtolength{\\oddsidemargin}{" + fmt(-w / 2) + "in}");
    lines.push("\\addtolength{\\evensidemargin}{" + fmt(-w / 2) + "in}");
  }
  if (Math.abs(top) > 1e-6) lines.push("\\addtolength{\\topmargin}{" + fmt(top) + "in}");
  if (Math.abs(h) > 1e-6) lines.push("\\addtolength{\\textheight}{" + fmt(h) + "in}");

  if (lines.length) {
    const marker = "\\begin{document}";
    const idx = tex.indexOf(marker);
    const block = SENT_START + "\n" + lines.join("\n") + "\n" + SENT_END + "\n\n";
    if (idx >= 0) tex = tex.slice(0, idx) + block + tex.slice(idx);
  }

  return tex;
}

// Best-effort page count from raw PDF bytes. Returns a number, or null if it
// can't tell (e.g. object streams hide the page objects).
function countPages(pdfBytes) {
  try {
    const s = new TextDecoder("latin1").decode(pdfBytes);
    const m = s.match(/\/Type\s*\/Page(?![s])/g);
    return m ? m.length : null;
  } catch (_) {
    return null;
  }
}

window.ResumeForgerLayout = { apply, capabilities, countPages, DEFAULTS };
