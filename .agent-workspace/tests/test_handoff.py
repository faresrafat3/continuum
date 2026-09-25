import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HANDOFF = ROOT / ".agent-workspace" / "tasks" / "T-0001-build-continuum" / "handoffs" / "H-20260925-001.md"


class HandoffTests(unittest.TestCase):
    def test_handoff_contains_recovery_contract(self):
        text = HANDOFF.read_text(encoding="utf-8")
        for phrase in [
            "# Objective and acceptance target",
            "# Confirmed facts and read set",
            "# Completed",
            "# Current operation",
            "# Exact next action",
            "# Validation evidence",
            "# Blockers and questions",
            "# Do not repeat",
            "provisional",
            "Main System",
        ]:
            self.assertIn(phrase, text)

    def test_handoff_has_no_secret_like_value(self):
        text = HANDOFF.read_text(encoding="utf-8")
        self.assertNotRegex(text, r"sk-[A-Za-z0-9_-]{12,}")
        self.assertNotIn("DEEPSEEK_API_KEY=", text)


if __name__ == "__main__":
    unittest.main()
