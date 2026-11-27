# Owned-console qualification on committed pins

The local owned-console harness supports two explicit source modes. Neither
emits the official hosted GUI manifest, and both retain `shippingEvidence: false`.

| Mode | Required source state | Classification |
| --- | --- | --- |
| `experimental` (default) | A different immutable supplier, applied as a nonempty tracked sync patch over the committed consumer pin | `experimental-candidate-bundle` |
| `committed-pin` | Clean tracked consumer and supplier; working pins equal committed pins; supplier is the exact committed pin; no tracked patch | `committed-pin-local-bundle` |

The second mode makes a fresh local Code-tab journey possible after normal
supplier adoption. The former experimental-only producer required the two
supplier identities to differ, so it could not describe this state truthfully.
There is no automatic fallback between modes.

## Source and build admission

Use the official supplier sync, integration and normal GUI build first, retaining
the actual build command and log. On the clean, committed consumer checkout:

```sh
node scripts/write-owned-console-qualification-manifest.mjs \
  --source-mode committed-pin \
  --expect-consumer REVIEWED_FULL_CONSUMER_SHA \
  --supplier /absolute/path/to/qualified/sb3-creator \
  --expect-supplier REVIEWED_FULL_SUPPLIER_SHA \
  --git-executable /absolute/path/to/git \
  --out /absolute/path/to/receipt/bundle.json

node scripts/verify-owned-console-code-tab.mjs \
  --url http://127.0.0.1:8617/ \
  --qualification-manifest /absolute/path/to/receipt/bundle.json \
  --git-executable /absolute/path/to/git \
  --out /absolute/path/to/receipt/results.json
```

The producer requires complete expected supplier and consumer commit IDs in
committed-pin mode. An explicitly identified Git executable observes the actual
repositories; inherited Git overrides cannot select another checkout. The
supplier must be clean. The consumer must have clean tracked source and no
staged or unstaged patch, and all working pins must equal its committed pins.
The Board and Circuit UI identities remain bound separately.

Every compiler file must equal the official rewrite of the admitted supplier
in both the overlay and integrated package. The owned editor, document, worker,
conversion-error and Pico source pairs must also agree. The producer hashes
the same byte buffers it compares. Identical repeated entries in the existing
vendor mapping share one inventory entry; conflicting sources for one local
destination are refused.

Before launching a browser, the reader checks the complete required source
inventory and hashes every source and integrated mirror again. This includes
ignored generated package files that a clean tracked Git status cannot see.
Omitting an entry refuses. Changing an ignored mirror refuses even if its hash
is restamped in the manifest, because the mirror must still equal the committed
overlay. The experimental mode retains its distinct-pin and exact nonempty
patch checks.

The browser continues to compare the served HTML and every observed same-origin
script with the recorded emitted build inventory. Reads queued while earlier
responses are pending are drained as well. Every observed script must complete
and match, and the inventory is checked again after browser closure ends
response delivery. One verified script cannot vouch for an unfinished one.
The manifest producer does
not execute the build; its command string alone cannot establish that a stale
directory was rebuilt. Actual build execution and its log accompany the local
receipt. Hosted CI and official artifact admission remain separate authorities.

## Controls and historical evidence

`test/owned-console-bundle-admission.test.mjs` exercises the actual producer in
temporary Git repositories, the shared production reader and the actual browser
entry point's pre-launch refusal. It covers both modes, omitted/wrong consumer
identity, dirty or staged source, a dirty supplier, altered ignored mirrors,
omitted inventory, conflicting vendor mappings, a changed patch and a false
shipping-evidence claim. Its real vendor-mapping control also covers the
existing duplicate `cpxDialect.js` entry.

```sh
node --test test/gui-harness-source.test.mjs \
  test/owned-console-bundle-admission.test.mjs test/gate-shapes.test.mjs
```

The earlier experimental browser receipt and its manifest remain unchanged.
They retain their original source, build and platform scope. New qualification
requires a freshly produced manifest and a new browser receipt; adding this
mode does not reclassify historical evidence or establish a new browser pass.

Local validation on 27 November 2026 passed **20/20** selected source-binding,
bundle-admission and unchanged gate-shape controls, with zero skips. Independent
review included the real 64-file source inventory and the final response-reading
boundary. A fresh actual Code-tab run remains required after qualified adoption.
