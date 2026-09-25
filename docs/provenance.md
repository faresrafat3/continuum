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
- Final nested checkpoint: `27d795111b87fac9a5232d47baf592a6fc27f5ba` (`fix: close schema, archive, and clean-clone gaps`).
- State binds its last verified code checkpoint to `158ba435f2865fe0d4d085a5eeebda7fd2a508c7`, an ancestor of the final metadata commit; `HEAD` is verified clean after closure.

Dynamic DSH package `hand-3/pkg-13` is process-local and is intentionally not part of the nested Git commit. Its exact source is retained at `plugins/continuum-handoff.js` and can be recovered with `cordis_inspect_self`.
