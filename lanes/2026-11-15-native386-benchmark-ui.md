# Native i80386 benchmark UI

Owner: dedicated Benchmark UI lane. Status: implementation ready for review.
The user requests the claim and implementation together; no claim-only PR.

Scope: owned Settings benchmark panel, immutable media-lab asset fetch/cache,
license/hash/provenance display, existing native i80386 launch, CGA text and DOS
output, status/error/stop, focused React controls and actual browser evidence.
No changes to the engine, physics, CAD, Sim2, or other x86 lanes.

TOPBENCH uses the owned pinned release package and declared CGA query shim.
Its release 0.40c / displayed 0.40b discrepancy remains visible. Whetstone keeps
its software floating point PRINTOUT validation labeling. The owned asset PR
https://github.com/CrispStrobe/brickwright-media-lab/pull/37 supplies the exact
qualified executable/source/runtime notices and 139-member source mapping;
this panel pins its immutable asset commit. Native GUI qualification remains
separate from the already-qualified CLI executable.
No FreeDOS, physical accuracy, general CPU completion, or speedup claim.

Qualification: focused React/jsdom lifecycle controls are distinct from the
production panel browser proof, which executes the real native engine and owned
TOPBENCH/Whetstone bytes. No benchmark comparison is repeated.
