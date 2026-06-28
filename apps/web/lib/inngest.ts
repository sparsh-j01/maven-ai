import { Inngest } from "inngest";

// One client for the app's durable background jobs (§10). Local dev talks to the
// Inngest dev server (no keys needed); prod authenticates with INNGEST_EVENT_KEY
// + INNGEST_SIGNING_KEY from the environment.
export const inngest = new Inngest({ id: "maven-ai" });
