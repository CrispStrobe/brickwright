// The registering door to the transpiler.
//
// The `SHAPE art <name>` / `COSTUME <n> art <a>` / `BACKDROP <n> art <a>` VERB is
// upstream in sb3-creator (fdb1334) with round-trip and refusal tests. The ARTWORK
// is deliberately not: 246 hand-drawn sprites are this app's product decision, not a
// transpiler feature, so `SB3Creator._vectorArt` starts EMPTY and a host injects its
// own. See sb3-creator docs/LITE-REVENDOR-VECTOR-ART.md.
//
// WHY THIS MODULE RE-EXPORTS THE CLASS INSTEAD OF BEING A BARE SIDE EFFECT.
// Registration is global and idempotent, so a plain `import './…-register-art.js'`
// beside each `import './sb3-creator.js'` would work — but only for as long as every
// future call site remembers to write both lines. It failed exactly that way once
// already: the art was registered in pseudocode-importer.jsx alone, while
// circuit-tab.jsx and bw-debug/debug-runner.js constructed their own SB3Creator with
// an empty registry, so a game program reaching the debug runner without the importer
// having mounted parsed with `Unknown SHAPE "art"` and lost its costumes. Making this
// the only module that hands out the class turns "remember to register" into
// "you cannot obtain the class unregistered", which is a property rather than a habit.
// test/vector-art-registration.test.mjs holds that property.
//
// Both imports are static and this module carries the webpackChunkName "sb3-creator"
// at all three call sites, so the compiler is emitted ONCE (importing it from a second
// async chunk would have duplicated 886 kB) and the 149 kB of art rides in that same
// lazily-loaded chunk. Nothing here is in the initial bundle.
import SB3Creator from './sb3-creator.js';
import art from './sb3-creator-vector-art.js';
import spikeRuntimeOps from './spike-runtime-ops.js';
import {LEGACY_IDS as SPIKE_LEGACY_IDS} from './spike-legacy-migration.js';
import {withRobotLab, ROBOTLAB_RUNTIME, CADLAB_RUNTIME} from './robot-lab-pseudocode.js';
import {withCadShapes} from './cad-shapes-pseudocode.js';
import {withMenuShapes} from './extension-menu-args.js';

// Returns the entry count; ignored here, asserted by the tests (246 as of 2026-08-30).
SB3Creator.registerVectorArt(art);

// THE SAME ARGUMENT, FOR THE SPIKE RUNTIME REGISTRY.
//
// sb3-creator's generated registry still describes the five SPIKE extensions
// as they were before they became one, and Lite vendors that file under a
// byte-identity pin it may not edit. But runtimeOp() returns null for an
// opcode with no entry, so every block the load-time migration moves onto a
// unified opcode would quietly stop round-tripping through the Code tab.
//
// So the entry is derived from the extension that actually ships
// (scripts/spike/gen-runtime-ops.mjs) and merged here, at the one door that
// hands out the class — for exactly the reason the art is registered here and
// not at each call site. The four dead ids go at the same time, so a project
// can never resolve an opcode against an extension that is no longer loadable.
// test/spike-runtime-registry.test.mjs holds both properties. When sb3-creator
// regenerates its registry against the unified extension, this becomes a
// no-op and can go.
SB3Creator.RUNTIME_EXTENSIONS.spikeprime = spikeRuntimeOps;
for (const legacyId of SPIKE_LEGACY_IDS) {
    delete SB3Creator.RUNTIME_EXTENSIONS[legacyId];
}

// THE ROBOT LAB (docs/SIM-LAB.md "Steering the Lab"): its `lab` words, the robotlab
// runtime ops for Python/JS (`_robotlab.<method>`) and their 'simulator' driver are lite's,
// because the robotlab blocks and the Robot Lab API they name are. Layered here, at the one
// door, on the byte-identical vendored compiler (lib/robot-lab-pseudocode.js); the word
// table is lib/robotLabDialect.js. test/robot-lab-dialect.test.mjs holds the round trips.
SB3Creator.RUNTIME_EXTENSIONS.robotlab = ROBOTLAB_RUNTIME;
SB3Creator.RUNTIME_EXTENSIONS.cadlab = CADLAB_RUNTIME;
// CAD SHAPES (lib/cadShapesDialect.js): the `cad box …` / `cad move …:` modelling words.
// They compile to Brickwright CAD rather than run, so they need no runtime ops here.
const WithRobotLab = withCadShapes(withRobotLab(SB3Creator));

// Peer sessions (task E11): the peer dialect words are Lite-only and exist only in a build
// made with BW_ENABLE_PEERS=1 (a DefinePlugin literal; in node, process.env holds strings, so
// `=== true` keeps this off). They are not upstreamed to sb3-creator because no build that
// lacks the gate may parse them. test/peers-gate.test.mjs holds the gate.
const Layered = process.env.BW_ENABLE_PEERS === true ?
    require('./peer-pseudocode.js').default(WithRobotLab) : // eslint-disable-line global-require
    WithRobotLab;

// EXTENSION MENU SHAPES (lib/extension-menu-args.js): every project the compiler builds
// stores each extension menu argument as its extension declares it (an acceptReporters
// menu as a shadow input, any other as a field), and every reader sees each menu value
// in both shapes. Until 2026-10-21 the compiler wrote SPIKE ports, micro:bit+ pins and
// more as fields: Blockly dropped them, the editor showed empty dropdowns, and the SPIKE
// motor blocks threw when they ran. Outermost, so it sees every dialect's blocks.
const Creator = withMenuShapes(Layered);

export default Creator;
