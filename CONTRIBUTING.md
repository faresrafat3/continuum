# Contributing

Continuum exists to make session continuity checkable rather than
plausible. That is also the bar for changes to it.

## The one rule

**A guard without a test that fails when the guard is deleted is not a
guard.** If you add a check, prove it:

```sh
# 1. the suite passes
python3 -B -m unittest discover -s .agent-workspace/tests

# 2. break your guard on a scratch copy
#    ...the suite must now fail
# 3. restore, and add the regression that makes step 2 possible
```

Several guards in this repository were originally written *without* that
test, and were only found by mutation. A green suite is not evidence until
you have tried to break the thing it is testing.

## What will be rejected

- A doc change that makes a deferred gate sound passed.
- A test that asserts a mock behaves, without asserting the guard.
- A summary-based handoff. Handoffs are typed and checkable here on purpose.
- Anything that writes to the DSH Host composition, shipped presets, the
  persistence registry, credentials, or the model route. User-space presets
  under `~/.dsh/.agent-presets/` are the correct place for agent changes.

## Running everything

```sh
./bin/continuum-workspace doctor --strict
python3 -B -m unittest discover -s .agent-workspace/tests
node plugins/continuum-handoff.test.mjs
python3 -B bench/benchmark.py
./install.sh --check
```

## Style

- No runtime dependencies in `bin/continuum-workspace`. Standard library only.
- Deterministic and offline. The suite must pass with no network and no API key.
- Cite a primary source, with an access date, for any claim about how a real
  system behaves. Where a vendor documents nothing, write `NOT DOCUMENTED`
  rather than inferring an answer.
