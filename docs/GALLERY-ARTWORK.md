# Gallery artwork

The gallery uses small, content-addressed images. The Robot Lab renders the placed LDraw parts in their actual colors and orientations. Circuit covers are schematics produced by the same circuit normalization and SVG renderer as the schematic export. These covers show the saved example, so viewing a card never starts its simulation or loads its project.

Run a selected cohort or an entire editor's gallery from the checkout root.

```sh
node scripts/generate-gallery-artwork.mjs --editor robots --only driving-base.ldr --only twistspan.ldr
node scripts/generate-gallery-artwork.mjs --editor robots
node scripts/generate-gallery-artwork.mjs --editor circuits --only 01-blink
node scripts/generate-gallery-artwork.mjs --editor circuits
```

The circuit command uses the installed `bw-circuit-ui` from the root or GUI dependencies. Use `--circuit-ui /path/to/bw-circuit-ui` to point to an installed or checked-out package that matches the app. Use `--out /path/to/preview-folder` to run a dry comparison away from the shipped outputs. Robot generation needs only Node and the vendored LDraw library.

The manifest at `overlay/scratch-gui/static/thumbnails/gallery-artwork/manifest.json` records the source path, input and renderer fingerprints, output filename and byte size for each generated entry. Robot input fingerprints include the model's transitive LDraw references and color table. Circuit fingerprints include the source circuit and the installed schematic renderer and data. A rerun keeps valid cached images, regenerates changed or missing images and retires replaced image files when they are no longer referenced. A filtered run retains the other entries. A full run refreshes the selected editor's catalogue, while retaining the other editor's manifest entries.

Keep the manifest and new images together when committing. Gallery images are optional. Entries with unavailable or unreadable source remain browsable with text, and the generator reports the failed cover by entry. CAD continues to use its packaged source previews.
