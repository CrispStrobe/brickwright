# Scene flags and controller user events

Status: bounded original/native, Code, export/reimport and saved-project qualification. Production GUI authoring and low-level system-event callbacks remain pending.

This continuation uses the merged native text-dialog claim for controller gating and scene composition, the class/reference claim [#889](https://github.com/CrispStrobe/brickwright/pull/889) for typed scene authoring, and the scheduler claim [#881](https://github.com/CrispStrobe/brickwright/pull/881) for scene/render lifecycle. It preserves the existing scene-reference kind and actual source timing.

## Source contract

The selected MIT Arcade SDK defines `scene.Flag.NeedsSorting = 1`, `SeeThrough = 2`, and `IsRendering = 4`. A Scene starts with flags zero. Rendering returns immediately if IsRendering is set; otherwise it sets that bit, draws its previous scene when SeeThrough is set, conditionally sorts scene sprites by z then public id when NeedsSorting is set and clears that bit, draws sprites, then clears IsRendering. Changing a BaseSprite's z sets NeedsSorting on the *current* scene, including when that sprite belongs to a suspended scene. An unchanged z does not set it. Camera code does not own another Scene flag. Popping a scene and destroying it are distinct SDK operations. The selected `base/pxt-helpers.ts` implements array sorting as pairwise selection swaps; duplicate public ids do not establish a stable-sort guarantee.

`controller._setUserEventsEnabled(enabled)` controls user button events. Physical held-button state and controller connection changes remain available; disabled button events use the SDK's separate system-event path. Exposing only an inert Boolean field or suppressing all controller events does not meet this contract.

## Ownership and authoring

This slice owns three native/Code/Blocks operations: read flags from a Scene reference, set its flags, and enable/disable user controller events. It owns narrowly coordinated Scene renderer/order, sprite-z dirty flag, controller gate, metadata, source lowering, exporter, and focused test hunks. Matching producer additions use a separate branch preserving the reviewed array-copy vocabulary. Other SDK object bridges, array conversion, browser observer repairs, source event-bus/multiplayer registrations and unrelated GUI/device lanes remain with their owners.

Implementation paths are the Arcade extension's `index.js` and new scoped helpers, `arcade-translate.js`, `export-arcade.js`, the shared producer `src/utils/arcadeDialect.js`, and new focused tests. Native inputs must retain real Scene ownership and live Boolean/numeric values. No new generic value kind, frame delay, source pruning or renderer shortcut is part of this contract.

## Required qualification

Actual selected-original and native controls must cover raw flag read/write and compound evaluation order; z dirtying and conditional SDK selection-sort order; parent visibility and all screen pixels; IsRendering suppression/reentrancy; saved scene references through push/pop; gate disable/enable with real button edges and held-state queries; system versus user callbacks; cancellation/restart/load; Code, original export/reimport and same/fresh SB3. Actual production GUI authoring remains separately required.

The multiplayer custom-splash project also has event-bus, multiplayer controller registration, console inspection, and a remaining namespace call diagnostic. This slice does not promote that whole project or change the corpus census. Unsupported operations retain diagnostics.

## Qualified authoring surface

The native palette and pseudocode expose:

- `arcade flags of scene (...)`
- `arcade scene (...) set flags to (...)`
- `arcade set user controller events enabled <...>`

Scene and numeric inputs connect to live reporters; the controller input accepts a Boolean reporter. The corresponding exported calls use the actual `Scene.flags` field and `controller._setUserEventsEnabled`. The matching producer contract landed in [sb3-creator #128](https://github.com/CrispStrobe/sb3-creator/pull/128).

Six authored fixtures compare unchanged selected-original execution, native execution, Code, exported-original compilation/execution, reimport, and same/fresh VM SB3 reload. They cover scalar flags, current-scene z ownership, conditional selection sorting, manual render suppression, compound receiver/RHS order, user press/release gating with held state, SeeThrough parent artwork and all 19,200 pixels, and NaN/Infinity/fractional z dirtying. A separate actual input-edge control wakes its registered callback before the next physical Scene frame, then confirms Stop cancels its pending wait and restart resets it. The existing 24 frame-phase controls pass with this dispatch change.

The selected MIT bodies are [game/scene.ts](https://github.com/microsoft/pxt-common-packages/blob/master/libs/game/scene.ts), [game/basesprite.ts](https://github.com/microsoft/pxt-common-packages/blob/master/libs/game/basesprite.ts), [base/pxt-helpers.ts](https://github.com/microsoft/pxt-common-packages/blob/master/libs/base/pxt-helpers.ts), and [controller/controller.ts](https://github.com/microsoft/pxt-common-packages/blob/master/libs/controller/controller.ts). Tests bind the actual bundled source rather than assuming current upstream is the selected SDK. The generated constants retain its SHA256 and the Microsoft MIT notice.

These controls qualify user-event gating, not the still unsupported `control.raiseEvent`, arbitrary system-event subscriptions, or `mp.onControllerEvent` APIs. Actual production GUI/palette interaction, all custom Sprite subclass render hooks, render-time exceptions, and the whole multiplayer custom-splash game remain separate acceptance boundaries.
