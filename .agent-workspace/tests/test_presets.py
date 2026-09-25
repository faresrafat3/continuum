import hashlib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INSTALLED = Path.home() / ".dsh" / ".agent-presets"


class PresetArchiveTests(unittest.TestCase):
    def test_archived_custom_presets_match_installed_sources(self):
        for preset in ["continuum", "continuum-curator"]:
            archived = ROOT / "presets" / preset
            live = INSTALLED / preset
            archived_files = sorted(p.relative_to(archived) for p in archived.rglob("*") if p.is_file() and p.name not in {"README.md", "manifest.yaml"})
            live_files = sorted(p.relative_to(live) for p in live.rglob("*") if p.is_file())
            self.assertEqual(archived_files, live_files, preset)
            for relative in archived_files:
                self.assertEqual(
                    hashlib.sha256((archived / relative).read_bytes()).hexdigest(),
                    hashlib.sha256((live / relative).read_bytes()).hexdigest(),
                    f"{preset}/{relative}",
                )

    def test_presets_do_not_ship_unresolved_rows(self):
        for preset in ["continuum", "continuum-curator"]:
            text = (ROOT / "presets" / preset / "agent.cordis.yml").read_text(encoding="utf-8")
            self.assertNotIn("@deepseek-ai/dsh-tool-session-query", text)
            self.assertNotIn("name: '@deepseek-ai/dsh-tool-cordis'", text)


if __name__ == "__main__":
    unittest.main()
