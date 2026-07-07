import { Inngest } from "inngest";

// One client for the app's durable background jobs. Dev uses the Inngest dev server;
// prod authenticates with INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
export const inngest = new Inngest({ id: "maven-ai" });
