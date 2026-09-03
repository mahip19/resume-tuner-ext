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
};

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
  settings = await chrome.storage.local.get({ template: "", extra: "" });
  els.needsSetup.classList.toggle("hidden", !!settings.template.trim());
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
function showLatex() {
  els.tabLatex.classList.add("active");
  els.tabFields.classList.remove("active");
  els.fieldsPane.classList.add("hidden");
  els.latexPane.classList.remove("hidden");
}
function showFields() {
  els.tabFields.classList.add("active");
  els.tabLatex.classList.remove("active");
  els.latexPane.classList.add("hidden");
  els.fieldsPane.classList.remove("hidden");
  renderFields();
}
els.tabLatex.addEventListener("click", showLatex);
els.tabFields.addEventListener("click", showFields);

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
    await navigator.clipboard.writeText(getTex());
    els.copyTex.textContent = "Copied";
    setTimeout(() => (els.copyTex.textContent = "Copy .tex"), 1200);
  } catch (_) {}
});
els.downloadTex.addEventListener("click", () => {
  const blob = new Blob([getTex()], { type: "application/x-tex" });
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
els.compile.addEventListener("click", async () => {
  if (busy) return;

  // Auto-clean pasted output (fences / stray prose) so it's robust to
  // however Claude formatted its reply.
  const cleaned = cleanPastedTex(getTex());
  if (cleaned.trim() && cleaned !== getTex()) {
    setTex(cleaned);
    if (!els.fieldsPane.classList.contains("hidden")) renderFields();
  }

  const tex = getTex().trim();
  if (!tex) {
    setStatus("Nothing to compile — paste LaTeX or Load template first.", "err");
    return;
  }
  busy = true;
  els.compile.disabled = true;
  try {
    const { pdf, log } = await compiler.compile(tex, null, (s) => setStatus(s));
    showLog(log);
    showPdf(pdf);
    setStatus("Done — preview below. Download or drag the PDF into your application.");
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
});

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
