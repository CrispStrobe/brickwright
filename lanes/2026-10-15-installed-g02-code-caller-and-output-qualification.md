## Installed G02 Code caller and output qualification — 2026-10-15

Frozen consumer `59ddd74174f644f330f06ce567fac6b8c5f7dde3` passes three
installed own-NuttX cases and their standalone readers, with six successful
native startup transactions, full cleanup and distinct recovery in every case.
Official frontend checkout and consumer trees match; independent package/input
audits pass. Its eleven enabled source-head checks pass in
[run38790549120](https://github.com/CrispStrobe/brickwright/actions/runs/38790549120)
and the separate vendor check; two conditional GUI/deployment jobs skip.

- An older Code call's original successful return cannot clear a newer pending
  caller's busy flag, completed status or exact `42\n` output.
- An authored error delivered from the older call likewise leaves the newer
  caller's feedback unchanged. Both cases begin through the real Code control,
  preserve the original pane/native calls for two Python uploads, and explicitly
  author concurrent mounted-handler entry while the ordinary toolbar is busy.
  They do not establish two clickable busy toolbar runs or arbitrary scheduling.
- A fresh original old-Python output frame is held across actual replacement,
  STOP and upload preparation. No old/preparatory output reaches the new Code
  consumer before the original START reply is accepted. Current output first
  arrives in a later `state.read`; immediate START output remains host-covered.

Three failed test attempts remain preserved: a missing expected print newline,
a snapshot of a not-yet-created log, and a guest-time delay that did not fit the
unchanged observation window. Corrected controls require exact print bytes,
record absent logs explicitly and use a shorter authored guest delay. They
retain fresh native frame/sequence/reply provenance, original calls, cleanup,
recovery and the same observation/resource bounds. Successful cases were not
replayed to read evidence. Product sources and the installed package did not
change during these corrections.

This result belongs to the named frozen package. Integration preserves its
SPIKE/native inputs and both importer copies while retaining newer main work.
Final documentation-head CI, the lifecycle integration in
[PR979](https://github.com/CrispStrobe/brickwright/pull/979), and exact-head
merge review remain required. The repeated-Stop follow-up in
[PR990](https://github.com/CrispStrobe/brickwright/pull/990) is separate and
not installed-qualified here. Whole G02, reference/physical behavior, rollback,
licensing, distribution and release qualification remain open.
