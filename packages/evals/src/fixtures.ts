import type { FeedbackReport, ScorerInput } from "@maven-ai/shared";
import type { Expectation } from "./judge";

// Golden interviews. Each is a hand-written transcript with an obvious verdict,
// so we can assert the grader lands in the right band and names the planted
// weakness/strength. `sampleReport` is a plausible grading used by the offline
// runner (no API key) so the harness + judge are always runnable, e.g. in CI.
export type EvalCase = {
  name: string;
  input: ScorerInput;
  expect: Expectation;
  sampleReport: FeedbackReport;
};

export const CASES: EvalCase[] = [
  {
    name: "strong-senior-technical",
    input: {
      role: "Backend Engineer",
      seniority: "senior",
      type: "technical",
      company: "Stripe",
      transcript: [
        {
          speaker: "interviewer",
          text: "Design a rate limiter for our public API.",
        },
        {
          speaker: "candidate",
          text: "I'd start with the requirements: per-key limits, low latency, and correctness under bursts. A sliding-window log is exact but memory-heavy, so I'd use a token bucket in Redis with atomic Lua so the check-and-decrement is race-free. I'd size buckets per plan tier and fail open on Redis outage to protect availability, with an alert so we notice.",
        },
        {
          speaker: "interviewer",
          text: "How do you handle a hot key hammering one Redis shard?",
        },
        {
          speaker: "candidate",
          text: "Shard by key hash, and for a truly hot key add a small local pre-check with a short TTL to absorb the spike before it hits Redis. I'd measure the p99 added latency before shipping that, since local caches can drift.",
        },
      ],
    },
    expect: {
      minScore: 70,
      maxScore: 100,
      strengthsInclude: ["redis"],
    },
    sampleReport: {
      overallScore: 84,
      rubricScores: {
        communication: 9,
        problem_solving: 8,
        technical_depth: 9,
        code_quality: 7,
        culture_fit: 8,
      },
      summary:
        "Strong senior signal: structured the problem, reached for a token bucket in Redis with atomic Lua, and reasoned about hot keys and availability trade-offs.",
      strengths: [
        "Named the exact vs. approximate trade-off and chose token bucket in Redis for the right reasons.",
        "Thought about failure modes (fail open) and measurement before optimizing.",
      ],
      gaps: [
        "Did not discuss how limits are surfaced to clients (429 + Retry-After).",
      ],
      modelAnswers: [],
    },
  },
  {
    name: "weak-junior-technical",
    input: {
      role: "Frontend Engineer",
      seniority: "junior",
      type: "technical",
      transcript: [
        {
          speaker: "interviewer",
          text: "How would you find duplicates in an array?",
        },
        {
          speaker: "candidate",
          text: "Um, I'd use two for loops and check every pair I think. Not sure about the fast way.",
        },
        {
          speaker: "interviewer",
          text: "What's the time complexity of that, and can you do better?",
        },
        {
          speaker: "candidate",
          text: "Maybe... n times n? I don't really remember big O. I'd probably just Google it.",
        },
      ],
    },
    expect: {
      minScore: 0,
      maxScore: 45,
      gapsInclude: ["complexity"],
    },
    sampleReport: {
      overallScore: 28,
      rubricScores: {
        communication: 4,
        problem_solving: 3,
        technical_depth: 2,
        code_quality: 4,
        culture_fit: 5,
      },
      summary:
        "Struggled with a basic array problem and could not reason about time complexity; needs fundamentals before another technical loop.",
      strengths: ["Honest about not knowing rather than bluffing."],
      gaps: [
        "Review big-O time complexity — could not classify an O(n^2) nested loop.",
        "Practice the hash-set approach to de-duplication to reach O(n).",
      ],
      modelAnswers: [
        {
          question: "How would you find duplicates in an array?",
          whatGreatLooksLike:
            "Use a hash set: iterate once, add each element, flag any already present — O(n) time, O(n) space. Mention the O(n^2) nested-loop baseline and why the set is better.",
        },
      ],
    },
  },
  {
    name: "mixed-mid-behavioral",
    input: {
      role: "Product Engineer",
      seniority: "mid",
      type: "behavioral",
      transcript: [
        {
          speaker: "interviewer",
          text: "Tell me about a time you disagreed with a teammate.",
        },
        {
          speaker: "candidate",
          text: "We disagreed on whether to rewrite a service. I pushed back with data — I pulled the error rates and showed the rewrite wouldn't move them — and we agreed to fix the hot path instead. It shipped and cut errors by half.",
        },
        {
          speaker: "interviewer",
          text: "What would you do differently?",
        },
        {
          speaker: "candidate",
          text: "Honestly I got a bit heated in the meeting. I'd raise it 1:1 first next time.",
        },
      ],
    },
    expect: {
      minScore: 55,
      maxScore: 85,
      strengthsInclude: ["data"],
    },
    sampleReport: {
      overallScore: 71,
      rubricScores: {
        communication: 8,
        problem_solving: 7,
        technical_depth: 6,
        code_quality: 6,
        culture_fit: 8,
      },
      summary:
        "Solid behavioral answer grounded in data and outcome, with genuine self-reflection on how they handled the disagreement.",
      strengths: [
        "Backed the disagreement with data (error rates) and drove to a shipped outcome.",
        "Self-aware about getting heated and named a concrete change.",
      ],
      gaps: ["Could quantify the outcome beyond 'cut errors by half' with scope."],
      modelAnswers: [],
    },
  },
];
