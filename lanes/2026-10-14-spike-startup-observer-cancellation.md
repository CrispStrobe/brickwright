## SPIKE startup observer cancellation — 2026-10-14

ADOPTED — [PR930](https://github.com/CrispStrobe/brickwright/pull/930), tested
source `59c78f3bee80b496dcd2b76180397bbae563a634`, merged
`9a6706dc430472345031a82a2f83e04d4ec79035`, in the merged G02 session/test
envelope following the separately qualified deferred-storage consumer. A synchronous Stop from the configuration
notification must prevent native startup; Stop from first-frame publication must
prevent input writes and external-backend admission. Add closure checks at both
boundaries, preserving ordinary startup and native close ownership. Authored
controls reproduce both missing guards: the live control passes and both Stop
controls fail on the prior consumer. All 52 session controls pass with the two
checks; removing either check is detected by its Stop control. Both actual installed
configuration/first-frame cancellation and fresh guest recovery cases passed
standalone audits; all current required exact-head contexts pass. No dependency pin,
native code, firmware, Runtime, model, budget or workflow changes. Full G02 and
distribution qualification remain open.
