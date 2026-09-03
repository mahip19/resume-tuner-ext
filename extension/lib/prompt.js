// Builds the copy-paste prompt the user pastes into Claude / Claude Code.
// No network calls — this just assembles text.

function buildPrompt({ templateTex, jobDescription, extraInstructions }) {
  const extra =
    extraInstructions && extraInstructions.trim()
      ? "\nAdditional preferences from me:\n" + extraInstructions.trim() + "\n"
      : "";

  return `You are tailoring my LaTeX résumé to a specific job. Edit the CONTENT to match the job while keeping my template's design.

OUTPUT
- Return ONLY the complete LaTeX source. No commentary, no explanation, no markdown code fences.

TRUTHFULNESS (strict — do not break these):
- Do NOT invent or add anything that is not already in my résumé: no new numbers, percentages, metrics, throughput/latency/accuracy figures, dataset sizes, tools, libraries, technologies, employers, projects, or accomplishments. If a bullet has no metric, leave it without one. If a fact isn't already written, you cannot use it.
- You may ONLY rephrase, reorder, condense, merge, or drop content that already exists.
- Keep every job title, employer name, and all dates EXACTLY as written (e.g. do not change "Intern" to "Co-op", and do not shift any month or year).
- Keep the exact section order from my résumé. Do not reorder sections.

PRESERVE THE DESIGN
- Keep the preamble unchanged: \\documentclass and options, every \\usepackage, and every custom command definition (\\resumeItem, \\resumeSubheading, \\section formatting, etc.).
- Keep the fonts, section styling (\\titleformat, rules), colors, and overall visual identity unchanged.
- Only edit the human-readable text inside the content commands (bullet text in \\resumeItem, the fields in \\resumeSubheading / \\resumeProjectHeading, section names, and the skills lines).

ONE BALANCED PAGE — the résumé must fill exactly one page and end near the bottom margin: NO large empty band at the bottom (e.g. beneath Skills) and NO overflow onto a second page.
- Estimate how full the page is from the amount of content. If it would be UNDER-full (a gap at the bottom), keep MORE of my existing bullets instead of trimming, so the content reaches the bottom margin. Do not pad with invented content — only restore real bullets you would otherwise have cut.
- If it would OVERFLOW: first tighten each bullet to a single line; then drop the weakest, least job-relevant bullets; then, if still long, comment out (with %) a whole less-relevant project — including any I marked "OPTIONAL".
- You MAY make small, proportional adjustments to spacing ONLY, to balance the page: the \\vspace amounts inside the custom commands and between sections, and — only if needed — the margin \\addtolength values (\\topmargin, \\textheight, \\oddsidemargin, \\textwidth). Adjust gently and consistently. Never use large negative \\vspace hacks and never shrink the fonts.
- Do not leave blank lines or stray vertical space at the end of the document; the last section should end cleanly.

Escape any special LaTeX characters you introduce (& % $ # _ { } ~ ^ \\).
${extra}
=== MY CURRENT RÉSUMÉ (LaTeX) ===
${templateTex}

=== JOB DESCRIPTION ===
${jobDescription}

Output the complete, tailored, one-page LaTeX résumé and nothing else.`;
}

window.ResumeForgerPrompt = { buildPrompt };
