// Builds the copy-paste prompt the user pastes into Claude / Claude Code.
// No network calls — this just assembles text.

function buildPrompt({ templateTex, jobDescription, extraInstructions }) {
  const extra =
    extraInstructions && extraInstructions.trim()
      ? "\nAdditional preferences from me:\n" + extraInstructions.trim() + "\n"
      : "";

  return `You are tailoring my LaTeX résumé to a specific job. Change ONLY the wording of the content to match the job. Keep the template's design exactly as-is.

Output:
- Return ONLY the full, complete LaTeX source. No commentary, no explanation, no markdown code fences.

Do NOT change any layout or styling — keep these byte-for-byte identical to my template:
- The entire preamble: \\documentclass and its options, every \\usepackage, and every custom command definition (\\resumeItem, \\resumeSubheading, \\section formatting, etc.).
- All spacing and sizing: \\vspace, \\hspace, margins (\\addtolength, \\oddsidemargin, \\textwidth, \\topmargin, \\textheight...), \\titleformat, font-size commands, list settings, and the tabular widths.
- The document structure: the same environments, the same section order, and the same custom commands used in the same way.
Only edit the human-readable text that sits inside the content commands (bullet text in \\resumeItem, the fields in \\resumeSubheading / \\resumeProjectHeading, section wording, and the skills lines).

Content rules:
- Do NOT invent experience, employers, dates, degrees, or skills I don't have. Only rephrase, reorder, and re-emphasize what is already there.
- Mirror the job's language and priorities; surface the most relevant experience and skills first.
- Keep it truthful and ATS-friendly, and preserve existing numbers/metrics.
- Escape any special LaTeX characters you introduce (& % $ # _ { } ~ ^ \\).

MUST FIT ON EXACTLY ONE PAGE. Do this by editing content only — never by shrinking fonts, cutting margins, or adding negative \\vspace. To fit, in this order: (1) tighten wording so each bullet is one line, (2) keep only the 3-4 strongest, most relevant bullets per role/project, (3) if it still overflows, comment out (with %) an entire less-relevant project or a weaker bullet — including any project I marked "OPTIONAL". Prefer dropping the least job-relevant content.
${extra}
=== MY CURRENT RÉSUMÉ (LaTeX) ===
${templateTex}

=== JOB DESCRIPTION ===
${jobDescription}

Now output the complete tailored one-page LaTeX résumé and nothing else.`;
}

window.ResumeForgerPrompt = { buildPrompt };
