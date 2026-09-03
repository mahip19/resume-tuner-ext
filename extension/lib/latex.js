// Compiles LaTeX to PDF using the LaTeX Project's public compiler at
// texlive.net (David Carlisle's latexcgi). The extension has host permission
// for texlive.net, so the cross-origin POST works without CORS trouble.
//
// Protocol: multipart POST to /cgi-bin/latexcgi with the main file named
// document.tex. The server 301-redirects to the result — a .pdf on success or
// a .log on failure — which fetch() follows automatically.

const ENDPOINT = "https://texlive.net/cgi-bin/latexcgi";

class LatexCompiler {
  // texSource: string. extraFiles: optional { filename: stringContent }.
  // Returns { pdf: Uint8Array, log: string }. On failure throws an Error with
  // `.log` set to the compiler log.
  async compile(texSource, extraFiles, onStatus) {
    if (onStatus) onStatus("Compiling on texlive.net…");

    const fd = new FormData();
    // Only fields the server allows — anything unexpected gets the whole
    // request rejected.
    fd.append("return", "pdf");
    fd.append("engine", "pdflatex");
    fd.append("filename[]", "document.tex");
    fd.append("filecontents[]", texSource);
    if (extraFiles) {
      for (const [name, content] of Object.entries(extraFiles)) {
        fd.append("filename[]", name);
        fd.append("filecontents[]", typeof content === "string" ? content : "");
      }
    }

    let resp;
    try {
      resp = await fetch(ENDPOINT, { method: "POST", body: fd });
    } catch (e) {
      throw new Error(
        "Couldn't reach texlive.net (" + (e.message || e) + "). Check your connection."
      );
    }

    const ctype = resp.headers.get("content-type") || "";
    if (resp.ok && ctype.includes("application/pdf")) {
      const pdf = new Uint8Array(await resp.arrayBuffer());
      return { pdf, log: "" };
    }

    let text = "";
    try {
      text = await resp.text();
    } catch (_) {}

    // An HTML page back (or a non-200) means the request itself wasn't accepted
    // — a network/permission/endpoint problem, not a LaTeX error. Surface it as
    // a message (no compiler log to show).
    if (!resp.ok || ctype.includes("text/html")) {
      throw new Error(
        "texlive.net rejected the request (HTTP " +
          resp.status +
          ", " +
          (ctype || "no content-type") +
          "). This is usually a connection/permission issue, not your LaTeX."
      );
    }

    // Otherwise it's the compiler log for a real LaTeX error.
    const err = new Error("LaTeX compilation failed on texlive.net.");
    err.log = text || "HTTP " + resp.status;
    throw err;
  }
}

window.ResumeForgerLatex = { LatexCompiler };
