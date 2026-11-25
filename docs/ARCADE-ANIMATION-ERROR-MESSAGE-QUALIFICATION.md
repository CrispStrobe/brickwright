# Animation malformed-file browser qualification

The existing [animation browser journey](../scripts/verify-arcade-animation-resource-browser.mjs)
checks an intentionally malformed companion through the actual file picker.
After its Code, Blocks, resource publication, save/reopen and original Arcade
pixel comparisons, it must observe the named error and prove that the current
VM targets, Code and published resources remain unchanged.

The original [hosted browser job](https://github.com/CrispStrobe/brickwright/actions/runs/38862860015/job/116850073181)
retained its screenshot and report in artifact `arcade-animation-resource-browser`
(id `12031432656`, SHA-256 `7b0c51e4acc0a2e487ac882a25d6ee670755e1df1b6269434ef977570f243019`).
The screenshot visibly reports:

> Could not read invalid-animation-source.hex: MakeCode dependency translation: Animation companion JSON is malformed

[DependencyImportError](../overlay/scratch-gui/src/lib/bw-makecode/dependency-import.js)
preserves the failed translation stage and original companion error. The
previous exact browser fixture omitted that stage. The correction retains exact
text matching and all three following identity assertions; no product behavior
or resource limits change.

This is a source correction supported by the original saved artifact, not a
new passing browser result. Fresh production qualification remains pending.
