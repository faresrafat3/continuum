import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "docs" / "research" / "context-engineering-sota-review.md"


class ResearchReportTests(unittest.TestCase):
    def test_report_has_decision_sections_and_primary_links(self):
        text = REPORT.read_text(encoding="utf-8")
        for heading in [
            "## Executive decision",
            "## 2. Durable continuation and framework decision matrix",
            "## 5. Recommended S-tier DSH architecture",
            "## 7. Evaluation rubric",
            "## 8. Recommended implementation sequence",
            "## 0.1 Supplemental 2026 evidence",
        ]:
            self.assertIn(heading, text)
        self.assertGreaterEqual(len(re.findall(r"https://", text)), 25)
        self.assertIn("agentic context", text.lower())
        self.assertIn("Main System", text)

    def test_current_supplemental_sources_are_present(self):
        text = REPORT.read_text(encoding="utf-8")
        for url in [
            "https://arxiv.org/html/2606.29718v2",
            "https://arxiv.org/html/2510.04618v3",
            "https://aclanthology.org/2026.acl-long.1252/",
        ]:
            self.assertIn(url, text)

    def test_research_record_links_report_and_declares_limits(self):
        record = (ROOT / ".agent-workspace" / "research" / "RES-0001-context-engineering.md").read_text(encoding="utf-8")
        self.assertIn("docs/research/context-engineering-sota-review.md", record)
        self.assertIn("limitations:", record)
        self.assertIn("review_by:", record)


if __name__ == "__main__":
    unittest.main()
