# Brickwright repository transition

The active project uses the name **Brickwright**. **Brickwright Legacy** is the intended name of the earlier TurboWarp-based editor. Both GitHub repositories and all public URLs keep their current names during preparation.

| Project | Current GitHub identity | Intended repository | Current public entry points |
| --- | --- | --- | --- |
| Brickwright | `CrispStrobe/brickwright-lite` · ID `1291854269` · `main` | `CrispStrobe/brickwright` | [Vercel](https://brickwright-lite.vercel.app/) and [Pages](https://crispstrobe.github.io/brickwright-lite/) |
| Brickwright Legacy | `CrispStrobe/brickwright` · ID `881088189` · `develop` | `CrispStrobe/brickwright-legacy` | [Pages editor](https://crispstrobe.github.io/brickwright/editor.html) |

GitHub reports workflow-based Pages deployments on both repositories, with no custom domains. GitHub redirects ordinary repository traffic after a rename while the old slug remains free. Reclaiming `brickwright` removes that redirect from legacy links, and project-site URLs require their own migration. [GitHub repository rename behavior](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

## Preserve public routes first

1. Publish and verify separate permanent editor URLs before reclaiming the `brickwright` slug. Keep the existing Brickwright Vercel URL active as an alias. Keep a working route for the old legacy `/brickwright/editor.html` URL and the old Brickwright `/brickwright-lite/` URL, including query and fragment handling. Preserve a path for users to export projects from the old origin before moving browser-local data.
2. Update active links to the legacy repository, starting with documentation, release download links, and installer references. The old GitHub slug will then identify Brickwright, so legacy issues, source paths, and release links need their explicit new slug. Retain shipped package names, app identifiers, update channels, and project bundle identifiers during the repository cutover.
3. Replace live workflow self-repository guards that compare `github.repository` with `CrispStrobe/brickwright-lite` with an identity that survives the rename. Audit the mobile and native qualification workflows, release and updater metadata, deploy probes, Pages base paths, the Vercel Git binding, and references in the sibling repositories. Historical receipts continue to identify the repositories and URLs recorded at the time.
4. Verify both editors, real deployment health, download and update routes, and a representative old link set. Record the repository IDs, Pages settings, deployment URLs, and exact branch tips. Rename the legacy repository first and check its new canonical routes. Rename the active repository second and verify that `brickwright` now resolves to ID `1291854269`, with the legacy ID at `brickwright-legacy`.

The remaining cutover dependency is a verified hosting arrangement for the two existing GitHub Pages paths. The cutover stays pending while those paths remain tied to their current repository names.
