// Client-side ATS-style keyword matcher (no AI, no network). Extracts likely
// skills/keywords from a job description and reports which ones the résumé
// already contains vs. is missing, with a match score — similar in spirit to
// Jobscan / Resume Worded.
//
// Strategy: a curated skills dictionary (high-signal), plus JD-specific
// acronyms and frequently-repeated phrases, matched against the résumé's plain
// text with light normalization (punctuation, plurals, and compact tech tokens
// like "Node.js" ↔ "nodejs").

const STOP = new Set(
  ("a an the and or but if then else for to of in on at by with from as is are was were be been being " +
    "this that these those it its it's we you your our their they them he she his her i me my " +
    "will would can could should may might must shall do does did done have has had having not no yes " +
    "job role position candidate candidates applicant team teams company companies work working works " +
    "experience experiences experienced year years month months day days time ability abilities able " +
    "strong excellent good great solid proven demonstrated ideal preferred plus bonus nice required " +
    "requirement requirements responsibility responsibilities responsible qualification qualifications " +
    "skill skills knowledge understanding understand familiarity familiar proficiency proficient expertise " +
    "including include includes included using use uses used etc across within into onto per via also " +
    "who what when where why how which whom whose all any both each few more most other some such only own " +
    "same than too very just about above below up down out off over under again further once here there " +
    "you'll we're we'll join build building develop developing developer development design designing " +
    "help helping ensure ensuring drive driving deliver delivering support supporting maintain maintaining " +
    "create creating manage managing lead leading collaborate collaborating partner partnering environment " +
    "opportunity opportunities looking seeking passionate motivated self able world class fast paced " +
    "day-to-day new like well make making take taking based want need needs high level end grow growth " +
    "part full remote hybrid onsite office location salary benefits equal employer diverse inclusion " +
    "engineer engineers engineering software developer developers")
    .split(/\s+/)
);

// Canonical, display-cased skills. Matching is case/punctuation-insensitive.
const SKILLS = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "C", "Go", "Golang", "Rust", "Ruby",
  "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Bash", "Shell", "SQL", "HTML", "CSS", "Sass",
  "Perl", "Objective-C", "Dart", "Elixir", "Haskell",
  // Frontend
  "React", "React Native", "Next.js", "Vue.js", "Vue", "Angular", "Svelte", "Redux", "jQuery",
  "Tailwind", "Bootstrap", "Webpack", "Vite", "Expo", "Electron", "Three.js", "D3.js", "WebGL",
  "accessibility", "WCAG", "responsive design", "Figma",
  // Backend / APIs
  "Node.js", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring", "Spring Boot", "Rails",
  "Laravel", "ASP.NET", ".NET", "GraphQL", "REST", "REST APIs", "gRPC", "WebSockets", "microservices",
  "Drizzle ORM", "Prisma", "Hibernate", "Kafka", "RabbitMQ", "Redis", "Elasticsearch", "Celery",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Oracle", "SQL Server", "DynamoDB", "Cassandra",
  "Firebase", "Supabase", "pgvector", "Neo4j", "Snowflake", "BigQuery",
  // Cloud / DevOps
  "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins",
  "CI/CD", "GitHub Actions", "GitLab", "CircleCI", "Nginx", "Linux", "Unix", "serverless", "Lambda",
  "EC2", "S3", "CloudFormation", "Helm", "Prometheus", "Grafana", "Datadog", "Varnish",
  // Data / ML / AI
  "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Keras", "Scikit-learn", "NumPy",
  "Pandas", "Matplotlib", "SciPy", "NLP", "Computer Vision", "LLM", "LLMs", "RAG", "embeddings",
  "vector search", "Hugging Face", "OpenAI", "LangChain", "feature engineering", "data analysis",
  "data pipelines", "ETL", "Spark", "Hadoop", "Airflow", "Tableau", "Power BI", "SMOTE",
  // CS / systems concepts
  "algorithms", "data structures", "distributed systems", "operating systems", "concurrency",
  "multithreading", "consensus", "Paxos", "Raft", "replication", "sharding", "caching",
  "load balancing", "system design", "object-oriented", "functional programming", "networking",
  "peer-to-peer", "fault tolerance", "scalability", "databases", "compilers",
  // Practices / tools / methods
  "Git", "GitHub", "Agile", "Scrum", "Kanban", "TDD", "unit testing", "integration testing",
  "test automation", "Selenium", "Cypress", "Jest", "Playwright", "JIRA", "Linear", "Confluence",
  "code review", "pair programming", "monorepo", "pnpm", "npm", "Yarn", "Maven", "Gradle",
  "design patterns", "REST API design", "API design", "debugging", "profiling", "performance optimization",
  "observability", "logging", "monitoring", "security", "OAuth", "JWT", "authentication",
  // Soft / role
  "communication", "collaboration", "problem solving", "leadership", "mentoring", "cross-functional",
  "stakeholder management", "ownership", "product sense",
];

function stripLatex(tex) {
  if (!tex) return "";
  let s = tex;
  // Scope to the document body if present.
  const b = s.indexOf("\\begin{document}");
  const e = s.indexOf("\\end{document}");
  if (b >= 0 && e > b) s = s.slice(b + "\\begin{document}".length, e);
  // Drop line comments (unescaped %).
  s = s.replace(/(^|[^\\])%.*$/gm, "$1");
  // \href{url}{label} -> label ; \url{u} -> u
  s = s.replace(/\\href\s*\{[^}]*\}\s*\{([^}]*)\}/g, " $1 ");
  s = s.replace(/\\url\s*\{([^}]*)\}/g, " $1 ");
  // Remaining command names (and optional [..] args) -> space; keep brace contents.
  s = s.replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?/g, " ");
  s = s.replace(/[{}$&#~^\\]/g, " ");
  return s;
}

function norm(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function nospace(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Does `term` appear in the given normalized text?
function contains(paddedSpaced, noSpaceText, term) {
  const kn = norm(term);
  if (!kn) return false;
  if (paddedSpaced.includes(" " + kn + " ")) return true;
  if (paddedSpaced.includes(" " + kn + "s ")) return true; // plural
  if (kn.endsWith("s") && paddedSpaced.includes(" " + kn.slice(0, -1) + " ")) return true; // singular
  // Compact tech tokens (Node.js↔nodejs, CI/CD↔cicd): only for MULTI-part terms,
  // so a single word like "scala" can't match inside "scalable".
  if (kn.includes(" ")) {
    const knNo = nospace(term);
    if (knNo.length >= 4 && noSpaceText.includes(knNo)) return true;
  }
  return false;
}

function countOccur(paddedSpaced, kn) {
  if (!kn) return 0;
  return paddedSpaced.split(" " + kn + " ").length - 1;
}

// Pull candidate keywords out of the JD.
function extract(jd) {
  const spaced = norm(jd);
  const padded = " " + spaced + " ";
  const noSpace = nospace(jd);
  const found = new Map(); // normKey -> { term, count, known }

  // 1) Dictionary skills that appear in the JD.
  for (const sk of SKILLS) {
    if (contains(padded, noSpace, sk)) {
      const key = norm(sk);
      if (!found.has(key)) {
        found.set(key, { term: sk, count: Math.max(1, countOccur(padded, key)), known: true });
      }
    }
  }

  // 2) JD-specific ALL-CAPS acronyms (SDK, SaaS, ADA, HIPAA, ...) not already found.
  const acronyms = (jd.match(/\b[A-Z][A-Z0-9]{1,5}\b/g) || []).map((a) => a.trim());
  for (const a of acronyms) {
    const key = norm(a);
    if (!key || STOP.has(key) || found.has(key)) continue;
    if (/^\d+$/.test(key)) continue;
    // Skip if it's already a word inside a found multi-word term (CI inside CI/CD).
    let covered = false;
    for (const k of found.keys()) {
      if ((" " + k + " ").includes(" " + key + " ")) {
        covered = true;
        break;
      }
    }
    if (covered) continue;
    found.set(key, { term: a.toUpperCase(), count: countOccur(padded, key) || 1, known: true });
  }

  // 3) Frequently-repeated non-stopword phrases (unigrams + bigrams).
  const words = spaced.split(" ").filter(Boolean);
  const freq = new Map();
  const bump = (k) => freq.set(k, (freq.get(k) || 0) + 1);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) bump(w);
    if (i + 1 < words.length) {
      const w2 = words[i + 1];
      if (!STOP.has(w) && !STOP.has(w2) && w.length >= 3 && w2.length >= 3) bump(w + " " + w2);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  for (const [term, count] of sorted) {
    if (found.size >= 45) break;
    if (found.has(term)) continue;
    if (count >= 2) found.set(term, { term: titleCase(term), count, known: false });
  }

  return [...found.values()]
    .sort((a, b) => Number(b.known) - Number(a.known) || b.count - a.count)
    .slice(0, 40);
}

function titleCase(s) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// Compare JD keywords against the résumé. Returns matched / missing lists + score.
function analyze(jdText, resumeTex) {
  const candidates = extract(jdText || "");
  const plain = stripLatex(resumeTex || "");
  const padded = " " + norm(plain) + " ";
  const noSpace = nospace(plain);

  const matched = [];
  const missing = [];
  for (const c of candidates) {
    (contains(padded, noSpace, c.term) ? matched : missing).push(c);
  }
  const total = matched.length + missing.length;
  return {
    matched,
    missing,
    total,
    matchedCount: matched.length,
    score: total ? Math.round((100 * matched.length) / total) : 0,
  };
}

window.ResumeForgerKeywords = { analyze, extract, stripLatex };
