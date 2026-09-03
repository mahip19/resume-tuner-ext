const $ = (id) => document.getElementById(id);
const els = {
  settings: $("settings"),
  needsSetup: $("needsSetup"),
  openSettings: $("openSettings"),
  jd: $("jd"),
  grab: $("grab"),
  copyPrompt: $("copyPrompt"),
  viewPrompt: $("viewPrompt"),
  prompt: $("prompt"),
  tabLatex: $("tabLatex"),
  tabFields: $("tabFields"),
  latexPane: $("latexPane"),
  fieldsPane: $("fieldsPane"),
  fields: $("fields"),
  loadTemplate: $("loadTemplate"),
  tex: $("tex"),
  compile: $("compile"),
  copyTex: $("copyTex"),
  downloadTex: $("downloadTex"),
  status: $("status"),
  pdfBlock: $("pdfBlock"),
  pdfView: $("pdfView"),
  download: $("download"),
  dragChip: $("dragChip"),
  dragName: $("dragName"),
  logBlock: $("logBlock"),
  toggleLog: $("toggleLog"),
  log: $("log"),
  // Layout tab
  tabLayout: $("tabLayout"),
  layoutPane: $("layoutPane"),
  lFont: $("lFont"),
  lWidth: $("lWidth"),
  lWidthV: $("lWidthV"),
  lTop: $("lTop"),
  lTopV: $("lTopV"),
  lHeight: $("lHeight"),
  lHeightV: $("lHeightV"),
  lSpacing: $("lSpacing"),
  lSpacingV: $("lSpacingV"),
  lSpacingRow: $("lSpacingRow"),
  lReset: $("lReset"),
  pageBadge: $("pageBadge"),
  // Keywords tab
  tabKeywords: $("tabKeywords"),
  keywordsPane: $("keywordsPane"),
  kwSummary: $("kwSummary"),
  kwMissing: $("kwMissing"),
  kwMatched: $("kwMatched"),
  kwMissingCount: $("kwMissingCount"),
  kwMatchedCount: $("kwMatchedCount"),
};

let layout = Object.assign({}, window.ResumeForgerLayout.DEFAULTS);

const compiler = new window.ResumeForgerLatex.LatexCompiler();
const PDF_NAME = "resume.pdf";

let settings = { template: "", extra: "" };
let pdfUrl = null;
let pdfBytes = null;
let busy = false;

function setStatus(text, kind) {
  if (!text) return els.status.classList.add("hidden");
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " " + kind : "");
  els.status.classList.remove("hidden");
}

async function loadSettings() {
  const stored = await chrome.storage.local.get({
    template: "",
    extra: "",
    layout: null,
  });
  settings = { template: stored.template, extra: stored.extra };
  if (stored.layout) {
    layout = Object.assign({}, window.ResumeForgerLayout.DEFAULTS, stored.layout);
  }
  els.needsSetup.classList.toggle("hidden", !!settings.template.trim());
  syncLayoutControls();
}

function saveLayout() {
  chrome.storage.local.set({ layout });
}

/* ---- Settings link ---- */
els.settings.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.openSettings.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
chrome.storage.onChanged.addListener((_c, area) => {
  if (area === "local") loadSettings();
});

/* ---- Step 1: grab JD ---- */
els.grab.addEventListener("click", () => {
  setStatus("Reading the page…");
  chrome.runtime.sendMessage({ type: "grabJD" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Could not read the page: " + chrome.runtime.lastError.message, "err");
      return;
    }
    if (!resp || !resp.ok || !resp.text) {
      setStatus(
        "Couldn't read the page" +
          (resp && resp.error ? " (" + resp.error + ")" : "") +
          " — paste the description manually.",
        "err"
      );
      return;
    }
    els.jd.value = resp.text;
    setStatus("");
  });
});

/* ---- Step 2: prompt for Claude ---- */
function currentPrompt() {
  return window.ResumeForgerPrompt.buildPrompt({
    templateTex: settings.template,
    jobDescription: els.jd.value.trim(),
    extraInstructions: settings.extra,
  });
}

els.copyPrompt.addEventListener("click", async () => {
  if (!settings.template.trim()) {
    els.needsSetup.classList.remove("hidden");
    return;
  }
  if (!els.jd.value.trim()) {
    setStatus("Add a job description first.", "err");
    return;
  }
  const text = currentPrompt();
  els.prompt.value = text;
  try {
    await navigator.clipboard.writeText(text);
    els.copyPrompt.textContent = "Copied — paste into Claude";
    setTimeout(() => (els.copyPrompt.textContent = "Copy prompt for Claude"), 1800);
  } catch (_) {
    els.prompt.classList.remove("hidden"); // fallback: reveal for manual copy
    els.viewPrompt.textContent = "hide";
  }
});

els.viewPrompt.addEventListener("click", () => {
  if (els.prompt.classList.contains("hidden")) els.prompt.value = currentPrompt();
  const hidden = els.prompt.classList.toggle("hidden");
  els.viewPrompt.textContent = hidden ? "preview" : "hide";
});

/* ---- Step 3: the resume editor ---- */
function getTex() {
  return els.tex.value;
}
function setTex(v) {
  els.tex.value = v;
}

els.loadTemplate.addEventListener("click", () => {
  if (!settings.template.trim()) {
    els.needsSetup.classList.remove("hidden");
    return;
  }
  setTex(settings.template);
  if (!els.fieldsPane.classList.contains("hidden")) renderFields();
  setStatus("Loaded your saved template.");
  setTimeout(() => setStatus(""), 1200);
});

/* tab switching */
function showTab(which) {
  const tabs = {
    latex: els.tabLatex,
    fields: els.tabFields,
    layout: els.tabLayout,
    keywords: els.tabKeywords,
  };
  const panes = {
    latex: els.latexPane,
    fields: els.fieldsPane,
    layout: els.layoutPane,
    keywords: els.keywordsPane,
  };
  for (const k of Object.keys(tabs)) {
    tabs[k].classList.toggle("active", k === which);
    panes[k].classList.toggle("hidden", k !== which);
  }
  if (which === "fields") renderFields();
  if (which === "layout") syncLayoutControls();
  if (which === "keywords") renderKeywords();
}
els.tabLatex.addEventListener("click", () => showTab("latex"));
els.tabFields.addEventListener("click", () => showTab("fields"));
els.tabLayout.addEventListener("click", () => showTab("layout"));
els.tabKeywords.addEventListener("click", () => showTab("keywords"));

/* ---- Keywords (ATS match) ---- */
function keywordsVisible() {
  return !els.keywordsPane.classList.contains("hidden");
}

function renderKeywords() {
  const jd = els.jd.value.trim();
  const tex = getTex() || settings.template || "";
  els.kwMissing.textContent = "";
  els.kwMatched.textContent = "";
  els.kwMissingCount.textContent = "";
  els.kwMatchedCount.textContent = "";

  if (!jd) {
    els.kwSummary.textContent = "Paste a job description in step 1 to see keyword matches.";
    return;
  }

  const r = window.ResumeForgerKeywords.analyze(jd, tex);
  const cls = r.score >= 75 ? "hi" : r.score >= 50 ? "mid" : "lo";
  els.kwSummary.innerHTML =
    r.matchedCount +
    " / " +
    r.total +
    " keywords" +
    '<span class="pct ' +
    cls +
    '">' +
    r.score +
    "%</span>";

  els.kwMissingCount.textContent = "(" + r.missing.length + ")";
  els.kwMatchedCount.textContent = "(" + r.matched.length + ")";

  if (!r.missing.length) {
    const s = document.createElement("span");
    s.className = "chip empty";
    s.textContent = "none — nice coverage";
    els.kwMissing.appendChild(s);
  }
  for (const k of r.missing) {
    const c = document.createElement("span");
    c.className = "chip miss";
    c.textContent = k.term;
    c.title = "Click to copy · appears " + k.count + "× in the JD";
    c.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(k.term);
        const old = c.textContent;
        c.textContent = old + " ✓";
        setTimeout(() => (c.textContent = old), 900);
      } catch (_) {}
    });
    els.kwMissing.appendChild(c);
  }
  for (const k of r.matched) {
    const c = document.createElement("span");
    c.className = "chip hit";
    c.textContent = k.term;
    els.kwMatched.appendChild(c);
  }
}

// Keep the analysis fresh while it's the active tab.
let kwTimer = null;
function scheduleKeywords() {
  if (!keywordsVisible()) return;
  clearTimeout(kwTimer);
  kwTimer = setTimeout(renderKeywords, 250);
}
els.jd.addEventListener("input", scheduleKeywords);
els.tex.addEventListener("input", scheduleKeywords);

/* ---- Layout controls ---- */
function syncLayoutControls() {
  els.lFont.value = layout.fontSize || "";
  els.lWidth.value = layout.width;
  els.lTop.value = layout.top;
  els.lHeight.value = layout.height;
  els.lSpacing.value = layout.spacing;
  els.lWidthV.textContent = signIn(layout.width);
  els.lTopV.textContent = signIn(layout.top);
  els.lHeightV.textContent = signIn(layout.height);
  els.lSpacingV.textContent =
    Number(layout.spacing).toFixed(2) +
    (layout.spacing > 1 ? " (tighter)" : layout.spacing < 1 ? " (looser)" : "");
  // Hide the spacing control if the current résumé has no \vspace to scale.
  const caps = window.ResumeForgerLayout.capabilities(getTex() || settings.template || "");
  els.lSpacingRow.classList.toggle("hidden", !caps.spacing);
}

function signIn(v) {
  const n = Number(v);
  if (Math.abs(n) < 1e-6) return "0 in";
  return (n > 0 ? "+" : "") + n.toFixed(2) + " in";
}

function onLayoutInput(recompile) {
  layout.fontSize = els.lFont.value;
  layout.width = parseFloat(els.lWidth.value);
  layout.top = parseFloat(els.lTop.value);
  layout.height = parseFloat(els.lHeight.value);
  layout.spacing = parseFloat(els.lSpacing.value);
  syncLayoutControls();
  saveLayout();
  if (recompile && getTex().trim() && !busy) compileNow();
}

// Live label updates while dragging; recompile once on release/change.
["lFont", "lWidth", "lTop", "lHeight", "lSpacing"].forEach((id) => {
  els[id].addEventListener("input", () => onLayoutInput(false));
  els[id].addEventListener("change", () => onLayoutInput(true));
});

els.lReset.addEventListener("click", () => {
  layout = Object.assign({}, window.ResumeForgerLayout.DEFAULTS);
  syncLayoutControls();
  saveLayout();
  if (getTex().trim() && !busy) compileNow();
});

/* form editor */
function renderFields() {
  const parsed = window.ResumeForgerFields.parse(getTex());
  els.fields.textContent = "";

  if (!parsed.fields.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent =
      "No editable text found yet. Paste your tailored LaTeX (or Load template) first.";
    els.fields.appendChild(p);
    return;
  }

  let lastSection = null;
  for (const f of parsed.fields) {
    // Group header whenever the section changes.
    if (f.section !== lastSection) {
      lastSection = f.section;
      const h = document.createElement("div");
      h.className = "group-head";
      h.textContent = f.section || "";
      els.fields.appendChild(h);
    }

    const isSection = f.label === "Section";
    const wrap = document.createElement("div");
    wrap.className = "field" + (isSection ? " section" : "");

    const lbl = document.createElement("div");
    lbl.className = "flabel";
    lbl.textContent = isSection ? "Section title" : f.label;
    wrap.appendChild(lbl);

    const ta = document.createElement("textarea");
    ta.value = f.value;
    ta.rows = Math.min(5, Math.max(1, Math.ceil(f.value.length / 58)));
    ta.addEventListener("input", () => {
      f.value = ta.value;
      autosize(ta);
      setTex(window.ResumeForgerFields.serialize(parsed)); // keep raw LaTeX in sync
    });
    wrap.appendChild(ta);

    els.fields.appendChild(wrap);
  }
}

function autosize(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(160, ta.scrollHeight + 2) + "px";
}

/* copy / download .tex */
els.copyTex.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(renderedTex());
    els.copyTex.textContent = "Copied";
    setTimeout(() => (els.copyTex.textContent = "Copy .tex"), 1200);
  } catch (_) {}
});
els.downloadTex.addEventListener("click", () => {
  const blob = new Blob([renderedTex()], { type: "application/x-tex" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, "resume.tex");
  setTimeout(() => URL.revokeObjectURL(url), 3000);
});

/* Clean up a pasted Claude reply into compilable LaTeX:
   drop ```latex fences and any prose before \documentclass / after \end{document}. */
function cleanPastedTex(input) {
  let s = input.trim();
  const fence = s.match(/```(?:latex|tex)?\s*\n?([\s\S]*?)```/i);
  if (fence && /\\documentclass/.test(fence[1])) s = fence[1];
  const dc = s.indexOf("\\documentclass");
  if (dc > 0) s = s.slice(dc);
  const marker = "\\end{document}";
  const ed = s.indexOf(marker);
  if (ed >= 0) s = s.slice(0, ed + marker.length);
  return s.trim() + "\n";
}

/* ---- Compile ---- */
// The .tex actually sent to the compiler: the editor content with the current
// layout applied on the fly (the editor itself always holds the clean base).
function renderedTex() {
  return window.ResumeForgerLayout.apply(getTex(), layout);
}

async function compileNow() {
  if (busy) return;

  // Auto-clean pasted output (fences / stray prose) so it's robust to
  // however Claude formatted its reply.
  const cleaned = cleanPastedTex(getTex());
  if (cleaned.trim() && cleaned !== getTex()) {
    setTex(cleaned);
    if (!els.fieldsPane.classList.contains("hidden")) renderFields();
  }

  if (!getTex().trim()) {
    setStatus("Nothing to compile — paste LaTeX or Load template first.", "err");
    return;
  }
  busy = true;
  els.compile.disabled = true;
  hidePageBadge();
  try {
    const { pdf, log, pages, overfull } = await compiler.compile(
      renderedTex(),
      null,
      (s) => setStatus(s)
    );
    showLog(log);
    showPdf(pdf);
    renderPageBadge(pages, overfull);
    setStatus(
      pages === 1
        ? "Done — one page. Download or drag the PDF into your application."
        : pages
        ? "Done — " + pages + " pages. Use the Layout tab to fit it onto one."
        : "Done — preview below."
    );
    setTimeout(() => { if (!busy) setStatus(""); }, 4000);
  } catch (e) {
    if (e.log) {
      showLog(e.log, true);
      setStatus("Compilation failed — see the log below and fix the LaTeX.", "err");
    } else {
      // No compiler log means the request itself failed (network / blocked /
      // unexpected response) — show the actual reason.
      setStatus(e.message || "Compilation failed (unknown error).", "err");
      console.error("Resume Forger compile error:", e);
    }
  } finally {
    busy = false;
    els.compile.disabled = false;
  }
}
els.compile.addEventListener("click", compileNow);

function renderPageBadge(pages, overfull) {
  if (!pages) return hidePageBadge();
  const b = els.pageBadge;
  b.className = "badge";
  if (pages === 1) {
    b.textContent = overfull ? "1 page · tight" : "1 page ✓";
    b.classList.add(overfull ? "warn" : "ok");
  } else {
    b.textContent = pages + " pages";
    b.classList.add("warn");
  }
}
function hidePageBadge() {
  els.pageBadge.classList.add("hidden");
}

/* ---- PDF output ---- */
function clearPdf() {
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  pdfUrl = null;
  pdfBytes = null;
  els.pdfBlock.classList.add("hidden");
}
function showPdf(bytes) {
  clearPdf();
  pdfBytes = bytes;
  const blob = new Blob([bytes], { type: "application/pdf" });
  pdfUrl = URL.createObjectURL(blob);
  els.pdfView.src = pdfUrl;
  els.dragName.textContent = PDF_NAME;
  els.pdfBlock.classList.remove("hidden");
}
function showLog(text, open) {
  els.log.textContent = text || "";
  els.logBlock.classList.remove("hidden");
  if (open) {
    els.log.classList.remove("hidden");
    els.toggleLog.textContent = "hide";
  }
}
els.toggleLog.addEventListener("click", () => {
  const hidden = els.log.classList.toggle("hidden");
  els.toggleLog.textContent = hidden ? "show" : "hide";
});

function triggerDownload(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
els.download.addEventListener("click", () => {
  if (pdfUrl) triggerDownload(pdfUrl, PDF_NAME);
});

els.dragChip.addEventListener("dragstart", (e) => {
  if (!pdfUrl) return e.preventDefault();
  e.dataTransfer.setData("DownloadURL", "application/pdf:" + PDF_NAME + ":" + pdfUrl);
  e.dataTransfer.setData("text/uri-list", pdfUrl);
  e.dataTransfer.effectAllowed = "copy";
});
// The Download button lives inside the draggable chip — don't start a drag from it.
els.download.addEventListener("mousedown", (e) => e.stopPropagation());

loadSettings();
