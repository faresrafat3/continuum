# Provenance and Checkpoint Record

## Authoritative project repository

The WCS project is a local nested Git repository:

```text
/home/fares/continuum-system/.git
```

The parent `/home/fares` repository is not the project history and must not be used to attest Continuum files. The parent has an ignore rule that hides the project tree from its own status.

## Shipped DSH control plane

The DSH checkout used for audit is:

```text
/home/fares/Projects/deepseek-harness
```

The project does not modify that checkout, its Host composition, shipped preset installation, persistence registry, credentials, or model route. A pre-existing untracked `.agents/skills/dyno-pony/` tree is excluded from this work.

## Checkpoints

- Initial nested checkpoint: `0d2424f32425cd05cb954111c08ce11d3c849167`
- Final nested checkpoint: the current `HEAD` after the final metadata commit (`git rev-parse HEAD`); the code checkpoint verified by the final suite is `1e50443f0ae0376e5ba076c694ab1d01a9f5a397`, an ancestor of HEAD.
- State binds its last verified code checkpoint to `1e50443f0ae0376e5ba076c694ab1d01a9f5a397`; the tree is clean and context was regenerated after the final commit.

Dynamic DSH package `hand-3/pkg-14` is process-local and is intentionally not part of the nested Git commit. Its exact source is retained at `plugins/continuum-handoff.js` and can be recovered with `cordis_inspect_self`.
