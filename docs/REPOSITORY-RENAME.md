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

## Compatibility paths

The [account Pages repository](https://github.com/CrispStrobe/crispstrobe.github.io) stages the existing `/brickwright-lite/` entry and fallback routes for Legacy. Its active entry opens the new `/brickwright/` Pages editor after that site publishes the primary repository ID marker. Both the primary Pages artifact and the account-site fallback preserve Legacy’s `editor.html`, `player.html`, `embed.html`, and `fullscreen.html` paths. They forward query and fragment on the same origin. This includes the `sb3-creator` handoff through `#project_url` and keeps browser-local storage accessible. The existing Vercel editors remain separate fallback links.

The primary Pages artifact stages the compatibility files alongside the built editor. The deployed smoke test uses the URL returned by GitHub Pages. The build manifest and artifact checks accept the final primary slug only for repository ID `1291854269`.

## Cutover checks

Run `node scripts/check-brickwright-rename-readiness.mjs` for the public preflight. Run it with `--after-cutover` for the final names and URLs.

- Wait for the account Pages build to publish and check `/brickwright-migration-check/status.json`, the Legacy fallback, and the existing two project editors.
- Verify that Pages publishes the identity marker and reserved Legacy HTML aliases from the primary build. Test the query, fragment, and browser storage through old and new Chrome sessions.
- Locate and migrate remaining direct GitHub links to the Legacy repository, frozen proof producers and consumers, and any Vercel Git bindings that still rely on repository names. The two Vercel editor URLs already resolve separately and retain their names.
- Confirm acceptance of the old Legacy GitHub deep-link change before reclaiming the name. The editor redirects are separate from GitHub’s repository redirects. GitHub routes the old Legacy GitHub slug to the active repository once that slug is reused.
