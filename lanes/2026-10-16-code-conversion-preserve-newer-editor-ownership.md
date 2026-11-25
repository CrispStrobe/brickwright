## Code conversion: preserve newer editor ownership — 2026-10-16

IMPLEMENTED, hosted qualification pending — SPIKE integration follow-up.
Ownership claim [PR1000](https://github.com/CrispStrobe/brickwright/pull/1000)
merged before implementation. Own the narrow conversion-completion and editor-buffer hooks in
both `overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx`
and its `packages/scratch-gui` mirror, a focused
`test/code-conversion-editor-ownership.test.mjs`, and this ledger.

The 8086 browser gate observed an empty ASM editor after choosing its 8255
example during reconstruction following a reload. Separately, a host diagnostic
executing the actual conversion and example-loading methods reproduces an ASM
example being cleared when an earlier conversion resumes from an authored
`loadProject` wait. This establishes a reachable source overwrite; it does not
establish the exact browser scheduling cause. Preserve the original browser
failure and all existing assertions and resource bounds.

A finishing conversion may regenerate editors and publish conversion feedback
only while it still owns the captured editor work. Preserve later edits,
example loads, language changes and newer conversions, including edit/revert
and asynchronous project/extension boundaries. Keep ordinary conversion,
explicit device-retarget compilation, error reporting and current busy cleanup
working. Existing source/project admission checks remain required. Do not
pretend the already-applied VM load was rolled back or silently replace a newer
project. Broader project-transaction cancellation remains separate work.

Before source merge require baseline counterexamples, normal/current-error
controls, nonvacuous guard mutations, every enabled exact-head CI check and
affected clean application/own-guest qualification. Exercise the real 8086
reload, example selection and local execution route; retain SPIKE caller,
output and Stop controls. No timeout, assertion, baseline, dependency pin,
compiler/runtime/firmware/model, protocol or workflow change. Coordinate other
importer owners; preserve their existing hooks and all unrelated lane sections.

The candidate identifies each conversion request and captures its editor buffer,
language and import-intent revisions. Editor feedback, selection and queued busy
cleanup retain their corresponding ownership. Applied-project metadata instead
uses the newest conversion VM-load identity and its observed loaded stage: a
newer request still preparing does not invalidate the device metadata of an
already-applied load. A newer VM load or stage change revokes that metadata
completion. Existing source/project admission remains required; this does not
undo an applied VM load or establish general project transaction cancellation.

Twenty-seven actual-method host controls pass; the previous source passes
nineteen and fails eight. Eighteen guard mutations are detected. All 156 affected
host controls and 24 existing VM-diagnostic/artwork controls pass with an
explicitly selected prepared dependency registry. Earlier controls exposed a
masking case where undefined-to-null import cleanup hid a missing request
fence; an already-reset resource case now detects it. Original assertions and
failures remain preserved. The existing diagnostic fixture handles React
functional state updaters without changing its validation assertions.

The previous source passed all 26 actual 8086 journey checks with an identical
CI checkout tree, but its light job failed the Pico device-registration gate.
A separate actual-method diagnostic establishes a source regression: an older
load can apply, lose metadata publication to a newer request, then cause that
newer preparation to refuse its changed stage. The exact failing browser
schedule remains unestablished. The follow-up preserves applied metadata while
retaining editor fences and the stage refusal. Final source qualification still
requires every enabled exact-head check and fresh actual 8086 and Pico routes,
including positive Pico execution and the firmware-withheld refusal. Host
controls and the previous source's 8086 result do not qualify this new source,
a new installed package or SPIKE G02.
