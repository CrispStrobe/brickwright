# Arcade editor startup dependency boundary

[PR893](https://github.com/CrispStrobe/brickwright/pull/893) merged after all
12 enabled checks passed. The Costumes tab now uses the pure
`lib/bw-makecode/tilemap-presence.js` query to decide whether to show its Tile
maps button. It preserves original-target filtering, modern and legacy command
detection, malformed and connected-data visibility, active painter state and
the loaded Arcade-extension fallback. Twenty-five focused controls pass.

The full painter retains its lazy decode and validation path. Source discovery
does not invoke artwork callbacks or decode map data. The tracked Costumes
container mirror matches the overlay. Editing, saves, resource identity,
undo/redo, placement and the startup byte budget are unchanged.

Remaining acceptance: run the unchanged hosted P17 emitted-byte gate and
matching painter/UI journeys against the new official build. Source dependency
separation is implementation evidence; it is not a measured bundle result.
