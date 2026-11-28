# Owned-console qualification Git authority — 2026-11-27

The owned-console browser preflight previously resolved `git` from `PATH` when
a qualification manifest was supplied. That added an eleventh
`AMBIENT-BINDING` finding against the existing ceiling of ten. No baseline or
scanner exemption is changed by this repair.

## Concrete binding

`scripts/lib/gui-harness-source.mjs` already established an explicit source-tool
authority for the GUI authoring harnesses. Its new `bindGuiHarnessGit` export
shares that authority with the owned-console manifest producer and replay:

- The caller supplies an absolute executable path. There is no PATH fallback.
- The canonical path must resolve to an executable regular file. Its SHA-256
  and reported Git version are recorded.
- The tool must observe the actual admitted repository root.
- Inherited `GIT_*` overrides are removed and optional index writes disabled.
- The producer uses the same tool identity for consumer and supplier reads.
- The browser preflight compares that identity against the manifest before
  checking the commit, committed/current pins and exact binary patch hash.

`inspectGuiHarnessSource` retains its existing clean tracked-tree requirement.
The separate binding deliberately exposes Git reads for an experimental
candidate with a tracked patch: both producer and replay continue to measure
that full patch, and they neither discard it nor relabel the worktree as clean.
The manifest includes the shared helper in its source-file hash inventory.

The tool identity binds the executable bytes, path and version. It does not
claim a complete operating-system or dynamically linked library identity.

## Invocation and retained evidence

Pass `--git-executable /absolute/path/to/git` to both
`scripts/write-owned-console-qualification-manifest.mjs` and
`scripts/verify-owned-console-code-tab.mjs`, or supply the same explicit
`BW_GUI_GIT_EXECUTABLE` environment variable. An unbound local UI run without a
qualification manifest still performs no source Git inspection and remains
classified `unbound-local-build`.

Existing historical receipts, archives, manifests and their hashes remain
unchanged. A new qualification requires a freshly generated manifest: replay
must not invent a tool identity for an older manifest that did not record one.

## Verification

`test/gui-harness-source.test.mjs` passes **3/3**. The controls reject omitted
and relative executable names, non-file paths, a repository outside the admitted
root and tracked edits under the clean-harness contract. They also prove that
the explicit binding sees the committed source and the full dirty patch, and
that inherited Git repository overrides cannot redirect inspection.

The complete gate-shape run confirms the ambient population returns to **10**.
It then exposes separate existing lifecycle/path-inventory findings that were
previously hidden behind the first ambient failure; those remain separate
repairs, with the original scanner and baselines intact.
