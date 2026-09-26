#!/usr/bin/env python3
"""Reproducible benchmark for Continuum. No network, no API, no model calls.

Everything here is measured from the code itself, so the numbers are
verifiable by anyone who clones the repository and runs this script.

    python3 -B bench/benchmark.py            # default: commands + scaling
    python3 -B bench/benchmark.py --json     # machine-readable
    python3 -B bench/benchmark.py --quick    # skip the scaling sweep

Record the environment alongside the results, because timings are not
portable across machines. The report writes a machine-readable row so two
runs can be compared honestly.
"""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "bin" / "continuum-workspace"
PLUGIN_TEST = ROOT / "plugins" / "continuum-handoff.test.mjs"

HANDOFF_HEADINGS = [
    "Objective and acceptance target", "Confirmed facts and read set", "Completed",
    "Current operation", "Exact next action", "Decisions/spec/plan changes",
    "Validation evidence", "Blockers and questions", "Do not repeat / safe shortcuts",
    "Stale or contradictory information", "Working tree and uncommitted paths",
]

COMMANDS = [
    ("doctor --strict", ["doctor", "--strict"]),
    ("status", ["status"]),
    ("context T-0001", ["context", "T-0001"]),
    ("close --dry-run", ["close", "T-0001", "--dry-run"]),
]


def environment() -> dict:
    return {
        "python": platform.python_version(),
        "implementation": platform.python_implementation(),
        "platform": platform.platform(),
        "machine": platform.machine(),
    }


def time_command(argv: list[str], cwd: Path, repeats: int) -> tuple[float, float, int]:
    """Return (best, median, exit code) over `repeats` runs."""
    samples: list[float] = []
    code = 0
    for _ in range(repeats):
        start = time.perf_counter()
        result = subprocess.run([sys.executable, "-B", str(CLI), *argv],
                                cwd=cwd, capture_output=True, text=True)
        samples.append(time.perf_counter() - start)
        code = result.returncode
    return min(samples), statistics.median(samples), code


def benchmark_commands(repeats: int) -> list[dict]:
    rows = []
    for label, argv in COMMANDS:
        best, median, code = time_command(argv, ROOT, repeats)
        rows.append({
            "command": label,
            "min_ms": round(best * 1000, 1),
            "median_ms": round(median * 1000, 1),
            "exit_code": code,
        })
    if shutil.which("node"):
        samples = []
        for _ in range(repeats):
            start = time.perf_counter()
            code = subprocess.run(["node", str(PLUGIN_TEST)], cwd=ROOT,
                                  capture_output=True, text=True).returncode
            samples.append(time.perf_counter() - start)
        rows.append({
            "command": "node plugin test",
            "min_ms": round(min(samples) * 1000, 1),
            "median_ms": round(statistics.median(samples) * 1000, 1),
            "exit_code": code,
        })
    return rows


def seed_tasks(root: Path, count: int) -> None:
    subprocess.run([sys.executable, "-B", str(CLI), "--root", str(root), "init"],
                   capture_output=True, check=True)
    tasks = root / ".agent-workspace" / "tasks"
    for index in range(count):
        task_id = f"T-{index + 1:04d}"
        directory = tasks / f"{task_id}-synthetic"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "task.yaml").write_text(
            f"schema_version: 1\nkind: Task\nid: {task_id}\nslug: s{index}\n"
            f"title: Synthetic task {index}\ntype: feature\nstatus: done\npriority: p2\n"
            f"primary_scope: root\naffected_scopes: [root]\ndepends_on: []\n"
            f"related:\n  research: []\n  decisions: []\n", encoding="utf-8")
        (directory / "spec.md").write_text("# Spec\n", encoding="utf-8")
        (directory / "plan.md").write_text("# Plan\n", encoding="utf-8")
        (directory / "validation.md").write_text(
            f"# Validation\n\n| Run | Time | Gate | Git identity | Result | Evidence |\n"
            f"|---|---|---|---|---|---|\n"
            f"| RUN-20260101-{index:04d} | 2026-01-01T00:00Z | unit | clean | pass | synthetic |\n",
            encoding="utf-8")
        (directory / "state.yaml").write_text(
            f"schema_version: 1\nkind: TaskState\ntask_id: {task_id}\nstate_revision: 1\n"
            f"status: done\nphase: review\nreadiness: ready\nnext_action: Run the doctor check\n"
            f"working_tree: clean\ndirty_paths: []\n"
            f"validation:\n  status: pass\n  run_ids: [RUN-20260101-{index:04d}]\n"
            f"latest_handoff: null\nexecution:\n  mode: read\n  actor: agent:benchmark\n", encoding="utf-8")


def benchmark_scaling(sizes: list[int], repeats: int) -> list[dict]:
    rows = []
    for count in sizes:
        root = Path(tempfile.mkdtemp(prefix="continuum-bench-"))
        try:
            seed_tasks(root, count)
            doctor_best, _, doctor_code = time_command(["doctor", "--strict"], root, repeats)
            status_best, _, _ = time_command(["status"], root, repeats)
            rows.append({
                "tasks": count,
                "doctor_min_ms": round(doctor_best * 1000, 1),
                "status_min_ms": round(status_best * 1000, 1),
                "doctor_ms_per_task": round(doctor_best * 1000 / count, 2),
                "exit_code": doctor_code,
            })
        finally:
            shutil.rmtree(root, ignore_errors=True)
    return rows


def render(report: dict) -> str:
    lines = [
        "Continuum benchmark",
        f"  {report['environment']['implementation']} {report['environment']['python']} "
        f"on {report['environment']['platform']}",
        "",
        f"{'command':<20}{'min (ms)':>11}{'median (ms)':>13}{'exit':>7}",
        "-" * 51,
    ]
    for row in report["commands"]:
        lines.append(f"{row['command']:<20}{row['min_ms']:>11.1f}{row['median_ms']:>13.1f}{row['exit_code']:>7}")
    if report["scaling"]:
        lines += [
            "",
            f"{'tasks':>6}{'doctor (ms)':>13}{'status (ms)':>13}{'ms/task':>11}",
            "-" * 43,
        ]
        for row in report["scaling"]:
            lines.append(
                f"{row['tasks']:>6}{row['doctor_min_ms']:>13.0f}{row['status_min_ms']:>13.0f}"
                f"{row['doctor_ms_per_task']:>11.2f}")
    lines += ["", "All numbers are local: no network, no API, no model calls."]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    parser.add_argument("--quick", action="store_true", help="skip the scaling sweep")
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--sizes", type=int, nargs="*", default=[1, 10, 50, 200])
    args = parser.parse_args()

    report = {
        "environment": environment(),
        "commands": benchmark_commands(args.repeats),
        "scaling": [] if args.quick else benchmark_scaling(args.sizes, max(2, args.repeats // 2)),
    }
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(render(report))
    return 0 if all(row["exit_code"] == 0 for row in report["commands"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
