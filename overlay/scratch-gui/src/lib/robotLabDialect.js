/**
 * The BrickWright pseudocode <-> Robot Lab block map: the `lab …` words.
 *
 * Each word is one block of the `robotlab` extension (scratch-vm
 * extensions/crispstrobe/robotlab), and each block is one method of the Robot
 * Lab API (lib/bw-sim/api/robot-lab-api.js, `runtime.robotLab`). The table is
 * the whole contract, as ev3Dialect.js's EV3_WORDS is for DEVICE EV3: the
 * compiler parses a line against it and decompiles a block through it, and
 * SB3Creator.RUNTIME_EXTENSIONS.robotlab (Python/JS `_robotlab.<method>`) and
 * the Python/JS readers' lift back are built from the same rows — so a word, a
 * block and a call cannot drift apart. It is lite's own, layered over the
 * pinned (byte-identical) sb3-creator by lib/robot-lab-pseudocode.js at the
 * registering door, lib/sb3-creator-register-art.js.
 *
 * An entry has the shape of an arcadeDialect.js entry and is compiled and
 * spelled by that file's grammar (compileArcadeWord / spellArcadeWord), as
 * cpxDialect.js's are:
 *
 *   {NAME}                 a value input (one term: a number, a name, a "text"
 *                          or a (parenthesised expression))
 *   {NAME:a|b|c}           a field; the word IS the stored value
 *   {NAME:menu:m:a|b}      a reporter input with the extension's own menu
 *                          shadow `robotlab_menu_m`: a bare choice, a "quoted"
 *                          name (literalMenu: a part id or port the table does
 *                          not list, kept as the menu's value) or a value
 *                          expression in parentheses
 *
 * WHERE THE WORDS APPLY: under ANY DEVICE line (the Robot Lab steers whatever
 * is on its mat), and never in a generic rule's place: every command and
 * reporter begins with `lab`, the hat with `when lab`, so no Scratch word
 * (`stop`, `reset timer`, `set x to`) is shadowed and `lab` never reads as a
 * variable.
 *
 * Table order is precedence: `lab run motor A for 90 degrees at …` must be
 * tried before `lab run motor A at …`, whose lazy MOTOR slot would otherwise
 * swallow "A for 90 degrees".
 */
export const ROBOTLAB_EXTENSION = 'robotlab';

const PORTS = 'A|B|C|D|E|F';
/** The shipped models' ids (sim-session.js MODELS keys, test/robot-lab-dialect.test.mjs holds them equal). */
export const ROBOTLAB_MODELS = Object.freeze(['driving-base', 'line-follower', 'wall-stopper', 'colour-explorer', 'sumo',
    'forklift', 'maze-runner', 'gearbox', 'differential', 'differential-car', 'chain-drive', 'pneumatic-press', 'drawing-robot', 'mean-machine', 'stepworks', 'stride-lab', 'twinpoint', 'butterfly', 'tempo-loop', 'tilt-lab', 'rod-ratio', 'vernier-drive', 'line-turner', 'dune-strider', 'atlas-six', 'oblique', 'cable-compass', 'cable-compass-control', 'rise-ratio', 'rise-ratio-control', 'cascade', 'cascade-control', 'wavemaker', 'wavemaker-control', 'sine-shuttle', 'quartermaster', 'toggle-lever', 'thirdline', 'tipline', 'twistspan', 'swayshift', 'samebeat', 'carry-ratio', 'air-budget', 'cross-ratio', 'foldback', 'ghost-pivot', 'travel-dial', 'pivot-exchange', 'phasor-twin', 'final-squeeze', 'high-select', 'poise', 'bend-ripple', 'offset-relay', 'rack-decoder', 'remote-pivot', 'schmidt-shift', 'equal-share', 'stroke-shift', 'triad-table', 'toggle-press', 'footfall', 'phasekeeper', 'vectorsum', 'pointweaver', 'kestrel-flapper', 'meridian-linkage', 'lumen-iris', 'tangent-table', 'paired-door-sync', 'rimrun', 'watt-line', 'twin-tempo', 'root-bridge', 'balance-engine', 'cusp-lab', 'gimbal-lab', 'resonance-lab', 'resonance-lab-slow', 'resonance-lab-fast', 'echo-bridge', 'linger', 'crossline', 'counterturn', 'afterturn', 'helixgate', 'looprelay', 'paritydial', 'counterslide', 'evenhand', 'obliquity-orrery', 'cadence-geneva', 'helios-transmission', 'orion-cardan', 'apex', 'tempest-pendulum', 'product-plotter', 'snapgate', 'bit-keeper', 'offset-orbit', 'circle-splitter', 'integral', 'ellipsa', 'momentum-twins', 'bloom-gate', 'amplify', 'pantograph-doubler', 'scale-studio', 'ripple-relay', 'crossglide', 'scale-echo', 'turnwise', 'ellipse-engine', 'quickstroke', 'sarrus-lift', 'magnetic-chess', 'orbit-mixer', 'phase-bridge', 'phase-bridge-misphased', 'axis-plotter', 'atlas-arm', 'switchback-lift', 'straight-eight', 'pendulum-array', 'clutch-bench', 'pulse-percussion', 'centrifugal-governor', 'tidal-trio', 'tidal-trio-together', 'tidal-trio-alternating', 'tidal-trio-reverse', 'orbital-loom', 'orbital-loom-sevenfold', 'orbital-loom-elevenfold', 'orbital-loom-eightfold', 'positioning-arm', 'ratio-workbench', 'rack-shuttle', 'crank-rocker', 'parallel-lift', 'screw-crane', 'sky-courier', 'pivot-rover', 'chain-transmission', 'flywheel-differential', 'survey-rover', 'excavator', 'crane', 'rcx-bumper-car', 'rcx-line-follower', 'ev3-wall-stopper',
    'nxt-bumper-bot', 'motor-bench', 'technic-hub-bench', 'boost-rover', 'wedo-milo']);

/**
 * op: the block opcode; method: the API / `_robotlab` method; args: the block's inputs in
 * the method's argument order (Python/JS calls carry them positionally).
 */
const w = (op, kind, words, method, args = []) => Object.freeze({
    op: `${ROBOTLAB_EXTENSION}_${op}`, kind, words, method, args: Object.freeze(args),
    menuExtension: ROBOTLAB_EXTENSION, literalMenu: true
});

const MOTOR = `{MOTOR:menu:motors:${PORTS}}`;

export const ROBOTLAB_WORDS = Object.freeze([
    // ---- the scene -----------------------------------------------------------
    w('loadModel', 'command', `lab load model {MODEL:menu:models:${ROBOTLAB_MODELS.join('|')}}`, 'loadModel', ['MODEL']),
    w('startSimulation', 'command', 'lab start', 'start'),
    w('stopSimulation', 'command', 'lab stop', 'stop'),
    w('resetSimulation', 'command', 'lab reset', 'reset'),
    // ---- motors, directly (no hub program needed) ----------------------------
    w('setMotorPower', 'command', `lab set motor ${MOTOR} power to {POWER} %`, 'setMotorPower', ['MOTOR', 'POWER']),
    w('runMotorDegrees', 'command', `lab run motor ${MOTOR} for {DEGREES} degrees at {SPEED} degrees per second`,
        'runMotorDegrees', ['MOTOR', 'DEGREES', 'SPEED']),
    w('setMotorSpeed', 'command', `lab run motor ${MOTOR} at {SPEED} degrees per second`, 'setMotorSpeed', ['MOTOR', 'SPEED']),
    w('stopMotor', 'command', `lab stop motor ${MOTOR} {ACTION:brake|coast|hold}`, 'stopMotor', ['MOTOR', 'ACTION']),
    w('motorAngle', 'reporter', `lab motor ${MOTOR} angle`, 'motorAngle', ['MOTOR']),
    w('motorSpeed', 'reporter', `lab motor ${MOTOR} speed`, 'motorSpeed', ['MOTOR']),
    // ---- sensors and parts ----------------------------------------------------
    w('sensorValue', 'reporter', `lab sensor {SENSOR:menu:sensors:${PORTS}} value`, 'sensorValue', ['SENSOR']),
    w('partPosition', 'reporter', 'lab part {PART:menu:parts:hub} {AXIS:x|y|z|heading}', 'partPosition', ['PART', 'AXIS']),
    w('labStatus', 'reporter', 'lab status', 'status'),
    w('whenTouch', 'hat', 'when lab part {PART:menu:parts:hub} touches {OTHER:menu:others:ground|wall}', 'whenTouch', ['PART', 'OTHER'])
]);

const byOpcode = new Map(ROBOTLAB_WORDS.map(e => [e.op, e]));
const byMethod = new Map(ROBOTLAB_WORDS.map(e => [e.method, e]));

/** The table entry for a `robotlab_*` opcode, or null. */
export function robotLabWordFor(opcode) {
    return byOpcode.get(opcode) || null;
}

/** The entries of the given kinds, in table order (the order is the precedence). */
export function robotLabWordsOf(kinds) {
    return ROBOTLAB_WORDS.filter(e => kinds.includes(e.kind));
}

/** The extension ops the table covers (without the extension prefix). */
export const ROBOTLAB_DIALECT_OPS = Object.freeze(ROBOTLAB_WORDS.map(e => e.op.slice(ROBOTLAB_EXTENSION.length + 1)));

/**
 * SB3Creator.RUNTIME_EXTENSIONS.robotlab, from the table: `_robotlab.<method>(args…)` in
 * Python/JS, the neutral value a reporter has when nothing drives it.
 */
export const ROBOTLAB_RUNTIME = Object.freeze({
    runtime: ROBOTLAB_EXTENSION,
    ops: Object.freeze(Object.fromEntries(ROBOTLAB_WORDS.map(e => [e.op.slice(ROBOTLAB_EXTENSION.length + 1), Object.freeze({
        kind: e.kind, method: e.method, args: e.args,
        ...(e.kind === 'reporter' ? {neutral: e.method === 'status' ? '"not-open"' : '0'} : {})
    })])))
});

const unquote = text => (/^"(?:[^"\\]|\\.)*"$/.test(text) ? JSON.parse(text) : null);

/**
 * A `_robotlab.<method>(…)` call read from Python or JavaScript, as its `lab` word: `args`
 * are the arguments already written as pseudocode terms (the readers' expr()). A menu or
 * field argument that is a quoted choice comes back bare (`"A"` → A); any other quoted
 * text stays quoted (a part id); an expression is parenthesised. Null for a method the
 * table does not have, a hat (the readers spell those from `_robotlab.on`), or a field
 * argument that is no choice of its field.
 */
export function robotLabCallToPseudo(method, args, {hat = false} = {}) {
    const entry = byMethod.get(method);
    if (!entry || (entry.kind === 'hat') !== hat) return null;
    const slots = {};
    entry.args.forEach((name, i) => { slots[name] = args[i] === undefined ? '' : String(args[i]).trim(); });
    const words = [];
    for (const tok of entry.words.split(/\s+/)) {
        const m = /^\{([A-Z0-9_]+)(?::(.+))?\}$/.exec(tok);
        if (!m) { words.push(tok); continue; }
        const [, name, spec] = m;
        let text = slots[name];
        if (text === '') return null;
        const bare = unquote(text);
        if (spec && !spec.startsWith('menu:')) {
            const choice = spec.split('|').find(c => c.toLowerCase() === String(bare ?? text).toLowerCase());
            if (!choice) return null;
            text = choice;
        } else if (spec) {
            const choices = spec.split(':')[2].split('|');
            const choice = bare !== null ? choices.find(c => c.toLowerCase() === bare.toLowerCase()) : null;
            if (choice) text = choice;
            else if (bare === null && !/^\(.*\)$/.test(text)) text = `(${text})`;
        } else if (!/^(-?\d+(\.\d+)?|"(?:[^"\\]|\\.)*"|[A-Za-z_]\w*|\(.*\))$/.test(text)) {
            text = `(${text})`;
        }
        words.push(text);
    }
    const line = words.join(' ');
    return entry.kind === 'hat' ? `WHEN ${line.replace(/^when\s+/i, '')}:` : line;
}
