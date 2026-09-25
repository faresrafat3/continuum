import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RouterTests(unittest.TestCase):
    def test_router_is_versioned_and_has_protected_plane(self):
        data = json.loads((ROOT / "docs" / "continuum-router.json").read_text(encoding="utf-8"))
        self.assertEqual(data["schema"], "continuum.router/v1")
        self.assertEqual(data["version"], "1.0.0")
        self.assertIn("dsh-main-system", data["protected"])
        ids = [route["id"] for route in data["routes"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn("recover", ids)
        self.assertIn("curate", ids)
        self.assertIn("blocked", ids)


if __name__ == "__main__":
    unittest.main()
