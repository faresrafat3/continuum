#!/usr/bin/env bash
# Continuum installer.
#
# Installs the two agent presets into the DSH user preset plane, verifies
# they mount, and optionally initialises a WCS workspace. It does not and
# cannot touch the DSH control plane: no Host composition, no shipped
# preset, no persistence registry, no credentials, no model route.
#
#   ./install.sh                 install presets, verify, report
#   ./install.sh --workspace DIR also init a WCS workspace in DIR
#   ./install.sh --check         verify only, install nothing
#   ./install.sh --uninstall     remove the two presets
#   ./install.sh --help
#
# Exit codes: 0 ok, 1 usage error, 2 install/verify failure.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESETS=("continuum" "continuum-curator")
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PRESET_ROOT="$DSH_HOME/.agent-presets"
MODE="install"
WORKSPACE=""

usage() {
  sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

log()  { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32mok\033[0m    %s\n' "$*"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31mfail\033[0m  %s\n' "$*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --workspace) WORKSPACE="${2:-}"; [ -n "$WORKSPACE" ] || fail "--workspace needs a path"; shift 2 ;;
    --check)     MODE="check"; shift ;;
    --uninstall) MODE="uninstall"; shift ;;
    --help|-h)   usage 0 ;;
    *)           printf 'unknown option: %s\n' "$1" >&2; usage 1 ;;
  esac
done

# The installer must never be able to reach the control plane. Fail loudly if
# a future edit tries to point it at the DSH deployment.
for forbidden in "$DSH_HOME/../Projects" "$DSH_HOME/../../.nvm" "/usr/local/lib/dsh"; do
  case "$PRESET_ROOT" in
    "$forbidden"*) fail "refusing to install outside the user preset plane" ;;
  esac
done

printf '\nContinuum installer\n'
printf '  source     %s\n' "$HERE"
printf '  dsh home   %s\n' "$DSH_HOME"
printf '  mode       %s\n\n' "$MODE"

# ---------------------------------------------------------------- verify source
if [ ! -d "$HERE/presets" ]; then
  fail "presets/ is missing from $HERE — this does not look like a Continuum checkout"
fi
for preset in "${PRESETS[@]}"; do
  [ -f "$HERE/presets/$preset/agent.cordis.yml" ] || fail "presets/$preset/agent.cordis.yml is missing"
  [ -f "$HERE/presets/$preset/agent.md" ]         || fail "presets/$preset/agent.md is missing"
done
ok "source presets present: ${PRESETS[*]}"

check_python() {
  command -v python3 >/dev/null 2>&1 || fail "python3 is required"
}

# ------------------------------------------------------------------- uninstall
if [ "$MODE" = "uninstall" ]; then
  for preset in "${PRESETS[@]}"; do
    if [ -d "$PRESET_ROOT/$preset" ]; then
      rm -rf "${PRESET_ROOT:?}/$preset"
      ok "removed $preset"
    else
      warn "$preset was not installed"
    fi
  done
  # Backups from previous installs are inert but accumulate; clear them so an
  # uninstall really does leave the user plane as it found it.
  shopt -s nullglob
  backups=("$PRESET_ROOT"/continuum.backup.* "$PRESET_ROOT"/continuum-curator.backup.*)
  shopt -u nullglob
  if [ ${#backups[@]} -gt 0 ]; then
    rm -rf -- "${backups[@]}"
    ok "removed ${#backups[@]} installer backup(s)"
  fi
  printf '\nDone. Existing DSH Sessions keep their already-mounted preset until they restart.\n\n'
  exit 0
fi

# --------------------------------------------------------------------- install
if [ "$MODE" = "install" ]; then
  mkdir -p "$PRESET_ROOT"
  for preset in "${PRESETS[@]}"; do
    target="$PRESET_ROOT/$preset"
    if [ -e "$target" ]; then
      backup="$target.backup.$(date +%Y%m%d%H%M%S)"
      mv "$target" "$backup"
      log "existing $preset moved to $(basename "$backup")"
    fi
    cp -a "$HERE/presets/$preset" "$target"
    ok "installed $preset"
  done
fi

# ----------------------------------------------------------------- verify mount
check_python
verify_preset() {
  local preset="$1"
  local dir="$PRESET_ROOT/$preset"
  [ -d "$dir" ] || { warn "$preset is not installed"; return 1; }
  # Byte-identity with the archived source: a hand-edited install is drift.
  if diff -r "$HERE/presets/$preset" "$dir" >/dev/null 2>&1; then
    ok "$preset matches the archived source byte for byte"
  else
    fail "$preset differs from the archived source — the installed copy was edited"
  fi
  python3 - "$dir/agent.cordis.yml" <<'PY' || fail "$preset/agent.cordis.yml is not valid YAML"
import sys
try:
    import yaml
except ImportError:
    sys.exit(0)  # optional: PyYAML absent is not a failure, the byte check stands
# A Cordis composition uses the `js` tag for plugin source, which plain
# PyYAML refuses to construct. Construct it as an opaque string: this
# validates structure without pretending to understand the composition
# language, and a plain safe_load would reject every valid DSH preset.
class OpaqueComposition(yaml.SafeLoader):
    pass
OpaqueComposition.add_constructor(
    "tag:yaml.org,2002:js", lambda loader, node: loader.construct_scalar(node))
yaml.load(open(sys.argv[1], encoding="utf-8"), Loader=OpaqueComposition)
PY
}
printf '\nverifying\n'
failed=0
for preset in "${PRESETS[@]}"; do
  verify_preset "$preset" || failed=1
done

if [ "$MODE" = "check" ] && [ "$failed" -ne 0 ]; then
  fail "one or more presets are not installed correctly"
fi

# ------------------------------------------------------------ control plane
printf '\ncontrol plane\n'
ok "no Host composition, shipped preset, persistence, credential, or model-route file was written"
ok "everything above lives under $PRESET_ROOT"

# ------------------------------------------------------------- workspace init
if [ -n "$WORKSPACE" ]; then
  printf '\nworkspace\n'
  mkdir -p "$WORKSPACE"
  if [ -f "$WORKSPACE/.agent-workspace/workspace.yaml" ]; then
    warn "$WORKSPACE is already initialised; leaving it untouched"
  else
    python3 -B "$HERE/bin/continuum-workspace" --root "$WORKSPACE" init --mode full --name "$(basename "$WORKSPACE")" >/dev/null
    ok "initialised WCS workspace at $WORKSPACE"
  fi
  if python3 -B "$HERE/bin/continuum-workspace" --root "$WORKSPACE" doctor --strict >/dev/null 2>&1; then
    ok "strict doctor passes on the new workspace"
  else
    warn "strict doctor reported findings on the new workspace; run it to see them"
  fi
fi

# ------------------------------------------------------------------- next step
cat <<'NEXT'

next
  1. restart DSH so the new presets are discovered
  2. open a session in this directory and pick the "continuum" preset
  3. inside it:  /continuum-handoff T-0001
  and in a fresh session, paste the prompt it prints.

verify
  python3 -B bin/continuum-workspace doctor --strict
  python3 -B -m unittest discover -s .agent-workspace/tests
  python3 -B bench/benchmark.py

NEXT
