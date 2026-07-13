// How an interview's status renders — shared by the candidate dashboard and the
// admin activity feed so a new status can't look like two different things.

export const STATUS_DOT: Record<string, string> = {
  requested: "bg-amber",
  approved: "bg-teal",
  live: "bg-teal",
  provisioning: "bg-teal",
  processing: "bg-amber animate-pulse",
  failed: "bg-danger",
  ready: "bg-teal",
};

export const STATUS_LABEL: Record<string, string> = {
  requested: "Pending approval",
  approved: "Ready to start",
  live: "Live",
  provisioning: "Starting",
  processing: "Scoring",
  failed: "Failed",
  ready: "Ready",
};
