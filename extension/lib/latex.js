// Compiles LaTeX to PDF using the LaTeX Project's public compiler at
// texlive.net (David Carlisle's latexcgi). The extension has host permission
// for texlive.net, so the cross-origin POST works without CORS trouble.
//
// Protocol: multipart POST to /cgi-bin/latexcgi with the main file named
// document.tex. The server 301-redirects to the result — a .pdf on success or
// a .log on failure — which fetch() follows automatically. On success the .log
// is NOT retrievable, so we fetch it in parallel via a second `return=log`
// request to get the authoritative page count (and any overfull warnings).

const ENDPOINT = "https://texlive.net/cgi-bin/latexcgi";

class LatexCompiler {
  _form(texSource, extraFiles, ret) {
    const fd = new FormData();
    fd.append("return", ret);
    fd.append("engine", "pdflatex");
    fd.append("filename[]", "document.tex");
    fd.append("filecontents[]", texSource);
    if (extraFiles) {
      for (const [name, content] of Object.entries(extraFiles)) {
        fd.append("filename[]", name);
        fd.append("filecontents[]", typeof content === "string" ? content : "");
      }
    }
    return fd;
  }

  // Returns { pdf: Uint8Array, log: string, pages: number|null, overfull: number }.
  // On failure throws an Error with `.log` set to the compiler log.
  async compile(texSource, extraFiles, onStatus) {
    if (onStatus) onStatus("Compiling on texlive.net…");

    let pdfResp, logText = "";
    try {
      const [pr, lr] = await Promise.all([
        fetch(ENDPOINT, { method: "POST", body: this._form(texSource, extraFiles, "pdf") }),
        fetch(ENDPOINT, { method: "POST", body: this._form(texSource, extraFiles, "log") }).catch(
          () => null
        ),
      ]);
      pdfResp = pr;
      if (lr && lr.ok) {
        try {
          logText = await lr.text();
        } catch (_) {}
      }
    } catch (e) {
      throw new Error(
        "Couldn't reach texlive.net (" + (e.message || e) + "). Check your connection."
      );
    }

    const ctype = pdfResp.headers.get("content-type") || "";
    if (pdfResp.ok && ctype.includes("application/pdf")) {
      const pdf = new Uint8Array(await pdfResp.arrayBuffer());
      return {
        pdf,
        log: logText,
        pages: parsePages(logText),
        overfull: countOverfull(logText),
      };
    }

    // Non-PDF response: either a real LaTeX error (the log) or a rejected request.
    let text = "";
    try {
      text = await pdfResp.text();
    } catch (_) {}

    if (!pdfResp.ok || ctype.includes("text/html")) {
      throw new Error(
        "texlive.net rejected the request (HTTP " +
          pdfResp.status +
          ", " +
          (ctype || "no content-type") +
          "). This is usually a connection/permission issue, not your LaTeX."
      );
    }

    const err = new Error("LaTeX compilation failed on texlive.net.");
    err.log = logText || text || "HTTP " + pdfResp.status;
    throw err;
  }
}

function parsePages(log) {
  if (!log) return null;
  const m = log.match(/Output written on [^\s(]+\s*\((\d+)\s+pages?/i);
  return m ? parseInt(m[1], 10) : null;
}

function countOverfull(log) {
  if (!log) return 0;
  const m = log.match(/Overfull \\[hv]box/g);
  return m ? m.length : 0;
}

window.ResumeForgerLatex = { LatexCompiler };
