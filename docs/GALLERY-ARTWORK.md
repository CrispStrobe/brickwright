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

Keep the manifest and new images together when committing. Gallery images are optional. Circuit examples with a program or controller and no saved schematic keep their text cards. Entries with unavailable or unreadable source remain browsable with text, and the generator reports the failed cover by entry. CAD continues to use its packaged source previews.

Robot cover geometry is credited to [the LDraw Parts Library](https://library.ldraw.org/) and its individual part authors under CC BY 4.0, as described in [Third-party notices](../THIRD-PARTY-NOTICES.md#ldraw-parts-library--cc-by-40-some-files-dual-cc-by-20--cc-by-40). The covers are raster projections of that geometry. The gallery retains the authored examples’ separate attribution.

The app build derives a compact index for each editor from the manifest. Its URL depends on the index contents, so a new app build can keep reusing the cached index when its covers stay the same. The browser loads one editor's index at a time and the cards request images near the viewport.

Circuit's parts palette reserves space for each thumbnail and mounts it when its card first enters view. The palette and the board share the existing per-part artwork cache.

Opening Circuit starts the bench. The Examples panel and the collapsed examples strip each load the catalog and artwork index on demand. The strip also loads the Codex curriculum, and starter journeys fetch only the catalog needed to open their project.

Circuit Examples renders up to 32 cards per page and Robot Lab Examples renders up to 24. Search and filters cover each editor's full catalog and return to the first page when changed.

The CAD model library renders up to 36 cards per page. Search and model-type filters still cover the full catalog. Selection keeps the current page's cards and thumbnails mounted, and search reuses matching cards where possible.

The CAD library retains up to 36 recently viewed cards with finished previews outside the grid. Returning to a page can reuse those cards immediately, and unfinished thumbnails wait for the viewport as usual.

Paging reuses the active CAD search results. A more specific query can search only the previous matches. Broader queries and type changes search the applicable catalog again.

The CAD library materializes bundled source and STL bytes during insertion. Browsing and availability checks use the catalog and exact bundled paths, and insertion can still use the bundled files offline.

Catalog construction parses each source manifest once and reuses its records for licence attribution. The standalone editor keeps the normalized catalog when a different project is opened in the same app session.
