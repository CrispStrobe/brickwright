# Brickwright repository migration

The GitHub repositories were renamed on 25 November 2026. Their repository IDs and default branches carried over. The Vercel production domains now follow the GitHub names.

| Project | Current GitHub repository | Default branch | Web editor |
| --- | --- | --- | --- |
| Brickwright | [CrispStrobe/brickwright](https://github.com/CrispStrobe/brickwright) · ID `1291854269` | `main` | [Brickwright on Vercel](https://brickwright.vercel.app/) |
| Brickwright Legacy | [CrispStrobe/brickwright-legacy](https://github.com/CrispStrobe/brickwright-legacy) · ID `881088189` | `develop` | [Brickwright Legacy on Vercel](https://brickwright-legacy.vercel.app/editor.html) |

The old `CrispStrobe/brickwright-lite` GitHub name redirects to Brickwright. The earlier `CrispStrobe/brickwright` name now identifies the active repository. The previous Vercel address `brickwright-lite.vercel.app` still serves Brickwright. For Legacy issues, source files, and branches, use `CrispStrobe/brickwright-legacy`. [GitHub repository rename behavior](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)

Existing clones can check `git remote -v` and update the remote for the repository they actually contain. For the active workbench use `https://github.com/CrispStrobe/brickwright.git`. For the TurboWarp application use `https://github.com/CrispStrobe/brickwright-legacy.git`. Check the existing checkout before updating a remote shared by multiple worktrees.

## GitHub Pages follow-up

Use the Vercel editor addresses above while the Pages compatibility routes are being published. The primary Pages build stages the Legacy `editor.html`, `player.html`, `embed.html`, and `fullscreen.html` routes. They forward query and fragment to the Legacy Pages host on the same origin. The [account Pages repository](https://github.com/CrispStrobe/crispstrobe.github.io) stages the old `/brickwright-lite/` entry and recognizes the new primary site by its repository ID marker. Chromium verified the staged redirects and same-origin storage before cutover.

Run `node scripts/check-brickwright-rename-readiness.mjs --after-cutover` to check the public routes. Confirm the Pages deployments and test an old editor bookmark with a project fragment. The required Board CI and production deploy checks remain in force.

The [Brickwright privacy policy](https://crispstrobe.github.io/brickwright-privacy.html) is published at the account site root. It is available independently of the project Pages deployment.

The reference-qualified instrument controls run on the current repository ID. The sealed study workflow and receipts preserve the historical run and its GitHub repository name.
