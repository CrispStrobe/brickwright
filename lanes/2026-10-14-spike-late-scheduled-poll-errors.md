## SPIKE late scheduled-poll errors — 2026-10-14

ADOPTED — [PR936](https://github.com/CrispStrobe/brickwright/pull/936),
qualified source `65494ed81b8751f2f6f2f3e9e6c57e5f07e125c0`, merged as
`e22fd9fe0017b4e8291b4ff2af44ff6b9d6efde1`. Scheduled poll errors delivered
after Stop stay silent; live errors still report and close their owned session.
All 55 affected controls pass, with the late-error baseline/removal failure
retained. Two installed own-NuttX cases use actual native observations followed
by explicitly authored client-delivery failures: 0 closed error callbacks versus
1 live callback, released ownership, distinct fresh guest completion and final
Stop. Each standalone reader binds 191 control files and 28 raw startup records.
These are client-delivery adversaries, not actual native/firmware fault evidence.

All 11 current enabled readiness/vendor checks pass. The prior pre-label gate
failure remains preserved; the final readiness run is successful. Predicted and
landed merge trees match, as do qualified implementation/test blobs; current-main
native source and dependency pins are preserved. The receipts qualify the frozen
consumer and this finite fix, not every later package. Full G02, other images/
backends/final-sampling/generation, physical/reference, G05 and release remain open.
