# WeDo asynchronous send-failure follow-on to transport UI #1274

DONE — supplier [#66](https://github.com/CrispStrobe/extensions/pull/66) and qualified
Lite adoption [#1274](https://github.com/CrispStrobe/brickwright/pull/1274) merged.
Codex transport/buttons owner. Own only the asynchronous send outcome
boundary in CrispStrobe/extensions `extensions/CrispStrobe/lego_wedo2_universal.js`
and its focused producer controls. Real VM teardown exposes an unhandled rejected
write after the virtual connection closes. Observe and report failed sends while
returning the original rejecting promise to awaiters. Preserve command bytes,
limiter decisions, dispatch order, stop actions and connection refusal. Do not
suppress global rejections or invent acknowledgements.

Supplier implementation and qualification are owner-authorized in the supplier
fork, which has no lane-claim prerequisite. Qualify normal sends, awaited error identity,
fire-and-forget motor-stop reporting, throttled sends and actual VM/Jolt WeDo
BLE and Scratch Link guests with meaningful mutations. Preserve original failed
CI and local reproduction. Land the supplier only after all enabled exact-head
checks succeed, then, after this Lite claim merges, adopt only `wedo2unified` through Lite's canonical scoped
pin, generated wrapper and receipt. Other pins and global baseline stay fixed.

Owner commands authorize this work in the user's fork; no inherited reviewer
quota applies. No upstream contact, native changes, model ownership takeover or
acceptance-bound changes. The transport UI claim, measurement seam and all
other owners remain intact. Final Lite browser and exact-head qualification
passed before #1274 merged.

Supplier #66 merged normally after all seven enabled checks succeeded, with its
one declared label skip. The landed source equals the reviewed and guest-tested
candidate. Lite adopts only the scoped WeDo pin, canonical bundle and receipt;
all unrelated pin/receipt values and the global baseline remain unchanged.
Before the latest main composition, the combined consumer/source set passes
358 tests with no failures; one named
skip reports unavailable unrelated repository history. Retained producer and
actual VM/Jolt mutation controls detect removal of the failure observer.
The final combined head passed all 31 enabled checks across four workflows,
with six declared conditional job skips. Its source-bound Robot Lab browser job
ran all ten assigned gates with zero skips, including actual WeDo block guests
over Scratch Link. Supplier promise/error identity and the
scoped pin, bundle and receipt remain as qualified. This closes this follow-on;
it adds no installed-native, hardware or physical-accuracy claim.
