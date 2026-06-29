import { selectCodingProblem } from "./coding";
import type {
  Difficulty,
  InterviewPlan,
  InterviewType,
  Phase,
  PlannedQuestion,
  Seniority,
} from "./interview";

// Milestone 4: deterministic interview-plan generation from a curated, in-code
// question bank. No LLM and no RAG — the questions are human-written and selected
// by phase + seniority, so the plan stays grounded (architecture §5) without
// hallucination, latency, or per-interview cost.
//
// ponytail: the bank lives in code and selection is a pure function for M4.
// Milestone 7 (resume + RAG) moves this content into the `questions` Postgres
// table with Gemini embeddings and swaps the selection here for a pgvector
// top-k retrieval + an LLM that assembles the plan against the candidate's
// resume. The curated questions are the reusable artifact; only the
// storage/retrieval mechanism changes.

// Which phase a bank question belongs to for selection. intro/wrap_up are agent
// behaviors (greet / close) rather than bank questions, so they aren't selectable.
type SelectablePhase = "warmup" | "technical" | "behavioral";

interface BankQuestion extends PlannedQuestion {
  selectPhase: SelectablePhase;
  // Omitted = applies to any role. Otherwise the question is only eligible when
  // the interview role contains one of these tags (case-insensitive).
  roles?: string[];
}

// The curated bank — modest but spanning warmup / technical / behavioral /
// system-design across difficulties, so every (type, seniority) yields a sane
// plan. Role-specific questions come before the general ones of the same
// difficulty so a matching role surfaces them first.
const BANK: BankQuestion[] = [
  // — warmup (light; selected regardless of seniority) —
  {
    id: "w-bg",
    selectPhase: "warmup",
    competency: "communication",
    difficulty: "easy",
    prompt:
      "To start, tell me a bit about yourself and what you've been working on recently.",
    rubricHint: "A concise, structured intro that highlights relevant, recent work.",
  },
  {
    id: "w-proud",
    selectPhase: "warmup",
    competency: "communication",
    difficulty: "easy",
    prompt:
      "What's a project you're proud of, and what was your specific contribution?",
    rubricHint: "Clear ownership and a concrete personal contribution, not just 'we'.",
  },
  {
    id: "w-why",
    selectPhase: "warmup",
    competency: "communication",
    difficulty: "easy",
    prompt: "What got you interested in this kind of role?",
    rubricHint: "Genuine motivation tied to the work itself.",
  },

  // — technical: easy (role-agnostic) —
  {
    id: "t-hashmap",
    selectPhase: "technical",
    competency: "data structures",
    difficulty: "easy",
    prompt:
      "When would you reach for a hash map over an array, and what are the trade-offs?",
    rubricHint:
      "O(1) average lookup vs ordering/locality; collisions and worst case.",
  },
  {
    id: "t-bigo",
    selectPhase: "technical",
    competency: "algorithms",
    difficulty: "easy",
    prompt:
      "How would you find duplicates in a large list, and what's the time and space complexity of your approach?",
    rubricHint:
      "Set-based O(n)/O(n) vs sort O(n log n)/O(1); states complexity and why.",
  },
  {
    id: "t-rest",
    selectPhase: "technical",
    competency: "apis",
    difficulty: "easy",
    prompt: "What makes an HTTP API RESTful, and when would you break from REST?",
    rubricHint:
      "Resources, verbs, statelessness; pragmatic exceptions (e.g. RPC-style).",
  },

  // — technical: role-specific (medium) — surfaced first for a matching role —
  {
    id: "t-fe-render",
    selectPhase: "technical",
    competency: "frontend",
    difficulty: "medium",
    roles: ["frontend", "full stack", "fullstack"],
    prompt:
      "A React list re-renders on every keystroke and feels janky. How do you diagnose and fix it?",
    rubricHint:
      "Profiler, memoization, stable keys, controlled-input cost, virtualization.",
  },
  {
    id: "t-be-index",
    selectPhase: "technical",
    competency: "databases",
    difficulty: "medium",
    roles: ["backend", "full stack", "fullstack"],
    prompt:
      "A query over a large table got slow. Walk me through how you'd decide what index to add.",
    rubricHint: "EXPLAIN, selectivity, composite-column order, write-cost trade-off.",
  },

  // — technical: general medium —
  {
    id: "t-cache",
    selectPhase: "technical",
    competency: "systems",
    difficulty: "medium",
    prompt:
      "You add a cache in front of a slow database read. What can go wrong, and how do you keep the cache correct?",
    rubricHint:
      "Invalidation, staleness, stampede, TTL vs write-through; names a strategy.",
  },
  {
    id: "t-concurrency",
    selectPhase: "technical",
    competency: "concurrency",
    difficulty: "medium",
    prompt:
      "Two requests update the same row at the same time. How do you stop them from clobbering each other?",
    rubricHint: "Optimistic vs pessimistic locking, transactions, version columns.",
  },
  {
    id: "t-debug",
    selectPhase: "technical",
    competency: "debugging",
    difficulty: "medium",
    prompt:
      "An endpoint is fast in staging but slow in production. How do you find out why?",
    rubricHint:
      "Reproduce, measure, narrow: metrics, tracing, data-size differences, N+1.",
  },

  // — technical: general hard —
  {
    id: "t-idempotency",
    selectPhase: "technical",
    competency: "systems",
    difficulty: "hard",
    prompt:
      "A client retries a payment that timed out. How do you make sure the customer isn't charged twice?",
    rubricHint:
      "Idempotency keys, dedup store, at-least-once vs exactly-once reality.",
  },
  {
    id: "t-consistency",
    selectPhase: "technical",
    competency: "systems",
    difficulty: "hard",
    prompt:
      "Explain the trade-off between strong and eventual consistency, and give an example where you'd pick each.",
    rubricHint: "Latency/availability vs correctness; concrete examples both ways.",
  },

  // — system design (drawn for the system_design type's technical phase) —
  {
    id: "sd-urlshort",
    selectPhase: "technical",
    competency: "system design",
    difficulty: "medium",
    prompt:
      "Design a URL shortener. Walk me through the data model, how you generate short codes, and how reads scale.",
    rubricHint:
      "Key generation, collision handling, read-heavy caching, storage estimate.",
  },
  {
    id: "sd-feed",
    selectPhase: "technical",
    competency: "system design",
    difficulty: "hard",
    prompt:
      "Design the backend for a news feed. How do you build and serve each user's timeline?",
    rubricHint: "Fan-out on write vs read, hot users, pagination, caching.",
  },
  {
    id: "sd-ratelimit",
    selectPhase: "technical",
    competency: "system design",
    difficulty: "hard",
    prompt:
      "Design a rate limiter that works across many servers. What algorithm, and where does the state live?",
    rubricHint:
      "Token/leaky bucket, shared store (Redis), accuracy vs cost, race conditions.",
  },

  // — behavioral —
  {
    id: "b-conflict",
    selectPhase: "behavioral",
    competency: "collaboration",
    difficulty: "medium",
    prompt:
      "Tell me about a time you disagreed with a teammate on a technical decision. How did it resolve?",
    rubricHint:
      "Listens, reasons from evidence, disagrees-and-commits, good outcome.",
  },
  {
    id: "b-failure",
    selectPhase: "behavioral",
    competency: "ownership",
    difficulty: "medium",
    prompt:
      "Describe a time something you shipped broke in production. What did you do?",
    rubricHint:
      "Owns it, mitigates fast, root-causes, prevents recurrence — no blame.",
  },
  {
    id: "b-ambiguity",
    selectPhase: "behavioral",
    competency: "ownership",
    difficulty: "hard",
    prompt:
      "Tell me about a project where the requirements were unclear. How did you move forward?",
    rubricHint: "Drives clarity, makes assumptions explicit, ships incrementally.",
  },
  {
    id: "b-feedback",
    selectPhase: "behavioral",
    competency: "growth",
    difficulty: "easy",
    prompt:
      "Tell me about a piece of critical feedback you received and what you did with it.",
    rubricHint: "Non-defensive, concrete change, evidence of growth.",
  },
];

// Phase sequence per interview type. intro + wrap_up bracket every interview. The
// coding round follows the technical phase for technical/mixed (the types that
// warrant writing code); behavioral has none, and system_design is a whiteboard
// discussion, not a code-execution round.
const PHASES_BY_TYPE: Record<InterviewType, Phase[]> = {
  technical: ["intro", "warmup", "technical", "coding", "wrap_up"],
  behavioral: ["intro", "warmup", "behavioral", "wrap_up"],
  mixed: ["intro", "warmup", "technical", "coding", "behavioral", "wrap_up"],
  system_design: ["intro", "warmup", "technical", "wrap_up"],
};

// Seniority gates technical difficulty (harder questions for more senior
// candidates), preferred difficulty first. warmup and behavioral select by phase
// only — a warm-up is light for everyone.
const TECH_DIFFICULTY: Record<Seniority, Difficulty[]> = {
  intern: ["easy"],
  junior: ["easy", "medium"],
  sde1: ["easy", "medium"],
  mid: ["medium", "hard"],
  sde2: ["medium", "hard"],
  senior: ["hard", "medium"],
  sde3: ["hard", "medium"],
};

// Headline difficulty shown to the candidate for a seniority: the band we prefer
// when picking that level's technical questions. Derived from the same map that
// drives selection, so the badge can't drift from the actual plan.
export function seniorityDifficulty(s: Seniority): Difficulty {
  return TECH_DIFFICULTY[s][0]!;
}

function countFor(phase: SelectablePhase, type: InterviewType): number {
  if (phase === "warmup") return 1;
  if (phase === "behavioral") return 2;
  return type === "mixed" ? 2 : 3; // technical
}

function roleMatches(tag: string, role: string): boolean {
  return role.toLowerCase().includes(tag.toLowerCase());
}

// The coding phase carries one PlannedQuestion built from a curated coding
// problem (§4.2). The agent presents `prompt` and the candidate solves it in the
// editor; the secret stdin/expected used to grade lives only with the grader
// (apps/agent/coding.py), keyed by this id. Deterministic per seniority, so
// buildPlan and assemblePlan agree.
function codingQuestion(seniority: Seniority): PlannedQuestion {
  const p = selectCodingProblem(seniority);
  return {
    id: p.id,
    prompt: p.prompt,
    competency: "problem solving",
    difficulty: p.difficulty,
    rubricHint:
      "A correct, efficient solution plus clear reasoning about the approach and complexity.",
  };
}

function toPlanned(q: BankQuestion): PlannedQuestion {
  return {
    id: q.id,
    prompt: q.prompt,
    competency: q.competency,
    difficulty: q.difficulty,
    ...(q.rubricHint ? { rubricHint: q.rubricHint } : {}),
  };
}

// The ordered eligible pool for a phase, best-first — so the plain plan is just
// the first `count`. Tier-B personalization reorders/sub-selects from this same
// pool, which is what keeps every generated plan grounded in the curated bank
// (no invented or out-of-phase questions).
function eligiblePool(
  phase: SelectablePhase,
  role: string,
  seniority: Seniority,
  type: InterviewType,
): BankQuestion[] {
  const eligible = (q: BankQuestion) =>
    !q.roles || q.roles.some((r) => roleMatches(r, role));

  let pool = BANK.filter((q) => q.selectPhase === phase && eligible(q));

  if (phase === "technical") {
    const isSD = (q: BankQuestion) => /system design/i.test(q.competency);
    // system_design interviews draw from system-design questions; every other
    // type excludes them so a "technical" round isn't all whiteboard design.
    pool =
      type === "system_design" ? pool.filter(isSD) : pool.filter((q) => !isSD(q));

    // Prefer the seniority's difficulties (preferred first), keeping bank order
    // within a tie. Fall back to the ungated pool if that left too few.
    const order = TECH_DIFFICULTY[seniority];
    const gated = pool
      .filter((q) => order.includes(q.difficulty))
      .sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty));
    pool = gated.length >= countFor(phase, type) ? gated : pool;
  }

  return pool;
}

function select(
  phase: SelectablePhase,
  role: string,
  seniority: Seniority,
  type: InterviewType,
): PlannedQuestion[] {
  return eligiblePool(phase, role, seniority, type)
    .slice(0, countFor(phase, type))
    .map(toPlanned);
}

// Which selectable bank phase backs each plan phase. intro/wrap_up are agent
// behaviours and carry no bank questions.
const SELECTABLE_OF: Partial<Record<Phase, SelectablePhase>> = {
  warmup: "warmup",
  technical: "technical",
  behavioral: "behavioral",
};

type PlanInput = { role: string; seniority: Seniority; type: InterviewType };

// buildPlan — the phased, deterministic interview plan stored as
// interviews.plan_json and walked by the agent's state machine (§2.3). The same
// inputs always produce the same plan, which is what makes it testable. company
// is interview flavour for the agent's prompt, not a selection input.
export function buildPlan(input: PlanInput): InterviewPlan {
  const { role, seniority, type } = input;
  return {
    phases: PHASES_BY_TYPE[type].map((phase) => {
      if (phase === "coding") return { phase, questions: [codingQuestion(seniority)] };
      const sel = SELECTABLE_OF[phase];
      return { phase, questions: sel ? select(sel, role, seniority, type) : [] };
    }),
  };
}

// The per-phase choices a personalizer (tier B) gets: pick `count` ids from
// `options`, every option drawn from the curated bank. Exposed so an LLM can
// tailor the selection to a résumé/JD without ever leaving the grounded set.
export interface PlanCandidates {
  phase: SelectablePhase;
  count: number;
  options: PlannedQuestion[];
}

export function planCandidates(input: PlanInput): PlanCandidates[] {
  const { role, seniority, type } = input;
  const out: PlanCandidates[] = [];
  for (const phase of PHASES_BY_TYPE[type]) {
    const sel = SELECTABLE_OF[phase];
    if (!sel) continue;
    out.push({
      phase: sel,
      count: countFor(sel, type),
      options: eligiblePool(sel, role, seniority, type).map(toPlanned),
    });
  }
  return out;
}

// assemblePlan — build a plan from a personalizer's chosen question ids. Each
// phase is filled ONLY from its eligible bank pool: chosen ids are kept in the
// given order (deduped; unknown, foreign-phase, or invalid ids dropped), then
// topped up from the deterministic order if the chooser under-picked. So an
// empty or junk choice degrades to exactly buildPlan — a generated plan can
// never contain an invented or out-of-phase question.
export function assemblePlan(
  input: PlanInput,
  chosen: Record<string, string[]>,
): InterviewPlan {
  const { role, seniority, type } = input;
  return {
    phases: PHASES_BY_TYPE[type].map((phase) => {
      if (phase === "coding") return { phase, questions: [codingQuestion(seniority)] };
      const sel = SELECTABLE_OF[phase];
      if (!sel) return { phase, questions: [] };

      const pool = eligiblePool(sel, role, seniority, type);
      const byId = new Map(pool.map((q) => [q.id, q]));
      const count = countFor(sel, type);
      const picked: BankQuestion[] = [];
      const seen = new Set<string>();
      const take = (q?: BankQuestion) => {
        if (q && !seen.has(q.id) && picked.length < count) {
          seen.add(q.id);
          picked.push(q);
        }
      };

      for (const id of chosen[sel] ?? []) take(byId.get(id));
      for (const q of pool) take(q); // top up from the deterministic order

      return { phase, questions: picked.map(toPlanned) };
    }),
  };
}
