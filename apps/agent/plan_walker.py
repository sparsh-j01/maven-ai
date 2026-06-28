"""Pure cursor over a flattened interview plan — no I/O, so it's unit-testable.

The plan (interviews.plan_json, built by packages/shared/src/plan.ts) is a list
of phases, each with zero or more questions. The agent walks the questions in
order across phases; intro and wrap_up carry no bank questions and are handled by
the agent's prompt, not by this walker.

cursor == the number of questions already served == the index of the next one.
That is what gets persisted to interviews.plan_cursor, so a worker restart can
resume exactly where it left off (architecture §2.3).
"""

from typing import Optional


class PlanWalker:
    def __init__(self, plan: dict, cursor: int = 0) -> None:
        # Flatten (phase, question) across phases, in plan order.
        self._items = [
            (phase["phase"], q)
            for phase in (plan or {}).get("phases", [])
            for q in phase.get("questions", [])
        ]
        self._idx = max(0, min(cursor, len(self._items)))

    @property
    def cursor(self) -> int:
        return self._idx

    @property
    def is_done(self) -> bool:
        return self._idx >= len(self._items)

    @property
    def current_phase(self) -> str:
        # Phase of the last-served question, or the bracketing intro / wrap_up.
        if self.is_done:
            return "wrap_up"
        if self._idx == 0:
            return "intro"
        return self._items[self._idx - 1][0]

    def next(self) -> Optional[tuple]:
        """Serve the next (phase, question) and advance; None when exhausted."""
        if self.is_done:
            return None
        item = self._items[self._idx]
        self._idx += 1
        return item
