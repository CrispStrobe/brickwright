# Third-party notices

## BBCSDL interpreter

CrispBASIC's initial native backend builds the BBCSDL interpreter by R. T.
Russell, pinned to commit `6c302988ee2a08c5f9a65fa3eb8e76bcacc6079f` of
<https://github.com/rtrussell/BBCSDL>. The exact compiled inputs and SHA-256
digests are recorded in `upstream.lock.json`.

The upstream interpreter is distributed under the zlib licence. Its complete,
unmodified notice is preserved in `native/BBCSDL-LICENSE.txt` and copied next
to generated binaries as `.build/BBCSDL-LICENSE.txt`. The source headers retain
their upstream copyright notices. New CrispBASIC host code uses this package's
licence; it does not replace the upstream interpreter licence.

This is a modified host integration, not an unmodified upstream distribution.
`native/patch-upstream.mjs` records every patch applied to the generated source
copies, which are also marked as modified. The patches rename the startup
identity, replace console terminal/input hooks, suppress the upstream console
entry point, and preserve batch execution and structured errors after `ON ERROR`.
The interpreter's parser, expression evaluator, and language statement execution
are used from the pinned implementation.

The project is branded **CrispBASIC**. References to BBC BASIC describe language
compatibility and acknowledge the original implementation. The upstream README
states that its permission to use the BBC BASIC name is not transferable to a
derived or forked work. No endorsement by the BBC or upstream author is claimed.

## Build tools and other proposed backends

GCC, NASM, Git and Node.js are build/runtime tools obtained separately and are
not vendored into this package. No Matrix Brandy, PicoBB, platform SDK, SDL,
Box2D or other proposed runtime backend is linked or redistributed by this
initial native build. Additional backends need their own pinned dependency
records and notices when implemented.
