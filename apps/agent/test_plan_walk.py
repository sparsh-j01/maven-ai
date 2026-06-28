"""Self-check for the plan cursor (run: python test_plan_walk.py).

ponytail: one runnable assert-based check for the only non-trivial logic in the
agent — walking the flattened plan and resuming from a persisted cursor. No test
framework needed.
"""

from plan_walker import PlanWalker

PLAN = {
    "phases": [
        {"phase": "intro", "questions": []},
        {"phase": "warmup", "questions": [{"id": "w1", "prompt": "warm", "difficulty": "easy"}]},
        {
            "phase": "technical",
            "questions": [
                {"id": "t1", "prompt": "q1", "difficulty": "medium"},
                {"id": "t2", "prompt": "q2", "difficulty": "medium"},
                {"id": "t3", "prompt": "q3", "difficulty": "hard"},
            ],
        },
        {"phase": "wrap_up", "questions": []},
    ]
}


def test_fresh_walk():
    w = PlanWalker(PLAN)
    assert w.cursor == 0 and not w.is_done
    assert w.current_phase == "intro"

    phase, q = w.next()
    assert (phase, q["id"]) == ("warmup", "w1")
    assert w.cursor == 1 and w.current_phase == "warmup"

    served = [w.next() for _ in range(3)]
    assert [p for p, _ in served] == ["technical"] * 3
    assert [q["id"] for _, q in served] == ["t1", "t2", "t3"]
    assert w.cursor == 4

    assert w.next() is None and w.is_done
    assert w.current_phase == "wrap_up"


def test_resume_from_cursor():
    # Restart after 2 questions served: continue at the 3rd flat item (t2), and
    # current_phase reflects the last-served question (t1, technical).
    w = PlanWalker(PLAN, cursor=2)
    assert w.cursor == 2 and not w.is_done
    assert w.current_phase == "technical"
    phase, q = w.next()
    assert (phase, q["id"]) == ("technical", "t2")

    # Resume past the end is a no-op done state.
    done = PlanWalker(PLAN, cursor=99)
    assert done.is_done and done.current_phase == "wrap_up" and done.next() is None


def test_empty_plan():
    w = PlanWalker({"phases": []})
    assert w.is_done and w.current_phase == "wrap_up" and w.next() is None


if __name__ == "__main__":
    test_fresh_walk()
    test_resume_from_cursor()
    test_empty_plan()
    print("ok — plan walk + resume")
