const ArgumentType = require('../../../extension-support/argument-type');
const BlockType = require('../../../extension-support/block-type');
const Cast = require('../../../util/cast');
const formatMessage = require('format-message');

// Robot Lab blocks (Lite-native; docs/SIM-LAB.md "Steering the Lab", docs/ROBOT-LAB-HUBS-PLAN.md P1).
//
// Every block calls ONE method of `runtime.robotLab`, the Robot Lab API the Lab's pane
// installs (gui lib/bw-sim/api/robot-lab-api.js; the hook pattern of runtime.nqcCompile and
// runtime.rcxDownload): looked up at each call, so a Lab opened after this extension loaded
// still answers, and nothing here knows the simulator. The same method list is the Code
// tab's `lab …` words (gui lib/robotLabDialect.js) and Python/JS `_robotlab.<method>(…)`
// (SB3Creator.RUNTIME_EXTENSIONS.robotlab), so a block, a word and a call are one thing.
//
// Before the Robot Lab tab is first opened there is no API: a command does nothing, a
// reporter answers 0, the hat stays quiet, and `Robot Lab status` says 'not-open' — a
// program never crashes on a closed Lab.
//
// Motor and sensor menus offer the model's ports (A, B, …) and take any text or reporter:
// a port, a motor's part id from the model (its `!BW ID`) or an actuator id. A degrees
// block waits on the motor's encoder in simulated time (the Lab's one clock), never on a
// wall-clock estimate.

const COPY = {
    en: {
        name: 'Robot Lab',
        loadModel: 'load model [MODEL]',
        startSimulation: 'start the simulation',
        stopSimulation: 'stop the simulation',
        resetSimulation: 'reset the simulation',
        setMotorPower: 'set motor [MOTOR] power to [POWER] %',
        setMotorSpeed: 'run motor [MOTOR] at [SPEED] °/s',
        runMotorDegrees: 'run motor [MOTOR] for [DEGREES] degrees at [SPEED] °/s',
        stopMotor: 'stop motor [MOTOR] and [ACTION]',
        motorAngle: 'motor [MOTOR] angle',
        motorSpeed: 'motor [MOTOR] speed',
        sensorValue: 'sensor [SENSOR] value',
        partPosition: 'part [PART] [AXIS]',
        labStatus: 'Robot Lab status',
        whenTouch: 'when part [PART] touches [OTHER]',
        brake: 'brake', coast: 'coast', hold: 'hold',
        heading: 'heading', ground: 'ground', wall: 'wall'
    },
    de: {
        name: 'Robot Lab',
        loadModel: 'lade Modell [MODEL]',
        startSimulation: 'starte die Simulation',
        stopSimulation: 'stoppe die Simulation',
        resetSimulation: 'setze die Simulation zurück',
        setMotorPower: 'setze Motor [MOTOR] Leistung auf [POWER] %',
        setMotorSpeed: 'lass Motor [MOTOR] mit [SPEED] °/s laufen',
        runMotorDegrees: 'dreh Motor [MOTOR] um [DEGREES] Grad mit [SPEED] °/s',
        stopMotor: 'stoppe Motor [MOTOR] und [ACTION]',
        motorAngle: 'Motor [MOTOR] Winkel',
        motorSpeed: 'Motor [MOTOR] Geschwindigkeit',
        sensorValue: 'Sensor [SENSOR] Wert',
        partPosition: 'Teil [PART] [AXIS]',
        labStatus: 'Robot-Lab-Status',
        whenTouch: 'wenn Teil [PART] [OTHER] berührt',
        brake: 'bremsen', coast: 'ausrollen', hold: 'halten',
        heading: 'Richtung', ground: 'Boden', wall: 'Wand'
    }
};
const language = () => (String(formatMessage.setup().locale || 'en').toLowerCase().startsWith('de') ? 'de' : 'en');
const t = key => COPY[language()][key] || COPY.en[key] || key;

/** The shipped models (gui sim-session.js MODELS keys); the API's own list wins when the Lab is open. */
const MODELS = ['driving-base', 'line-follower', 'wall-stopper', 'colour-explorer', 'sumo', 'forklift', 'maze-runner',
    'gearbox', 'differential', 'differential-car', 'chain-drive', 'pneumatic-press', 'drawing-robot', 'mean-machine', 'stepworks', 'stride-lab', 'twinpoint', 'butterfly', 'tempo-loop', 'tilt-lab', 'rod-ratio', 'vernier-drive', 'line-turner', 'dune-strider', 'atlas-six', 'oblique', 'cable-compass', 'cable-compass-control', 'rise-ratio', 'rise-ratio-control', 'cascade', 'cascade-control', 'wavemaker', 'wavemaker-control', 'sine-shuttle', 'quartermaster', 'toggle-lever', 'thirdline', 'tipline', 'twistspan', 'swayshift', 'samebeat', 'carry-ratio', 'air-budget', 'cross-ratio', 'foldback', 'ghost-pivot', 'travel-dial', 'pivot-exchange', 'phasor-twin', 'final-squeeze', 'high-select', 'poise', 'bend-ripple', 'offset-relay', 'rack-decoder', 'remote-pivot', 'schmidt-shift', 'equal-share', 'stroke-shift', 'triad-table', 'toggle-press', 'footfall', 'phasekeeper', 'vectorsum', 'pointweaver', 'kestrel-flapper', 'meridian-linkage', 'lumen-iris', 'tangent-table', 'paired-door-sync', 'rimrun', 'watt-line', 'twin-tempo', 'root-bridge', 'balance-engine', 'cusp-lab', 'gimbal-lab', 'resonance-lab', 'resonance-lab-slow', 'resonance-lab-fast', 'echo-bridge', 'linger', 'crossline', 'counterturn', 'afterturn', 'helixgate', 'looprelay', 'paritydial', 'counterslide', 'evenhand', 'obliquity-orrery', 'cadence-geneva', 'helios-transmission', 'orion-cardan', 'apex', 'tempest-pendulum', 'product-plotter', 'snapgate', 'bit-keeper', 'offset-orbit', 'circle-splitter', 'integral', 'ellipsa', 'momentum-twins', 'bloom-gate', 'amplify', 'pantograph-doubler', 'scale-studio', 'ripple-relay', 'crossglide', 'scale-echo', 'turnwise', 'ellipse-engine', 'quickstroke', 'sarrus-lift', 'magnetic-chess', 'orbit-mixer', 'phase-bridge', 'phase-bridge-misphased', 'axis-plotter', 'atlas-arm', 'switchback-lift', 'straight-eight', 'pendulum-array', 'clutch-bench', 'pulse-percussion', 'centrifugal-governor', 'tidal-trio', 'tidal-trio-together', 'tidal-trio-alternating', 'tidal-trio-reverse', 'orbital-loom', 'orbital-loom-sevenfold', 'orbital-loom-elevenfold', 'orbital-loom-eightfold', 'positioning-arm', 'ratio-workbench', 'rack-shuttle', 'crank-rocker', 'parallel-lift', 'screw-crane', 'sky-courier', 'pivot-rover', 'chain-transmission', 'flywheel-differential', 'survey-rover', 'excavator', 'crane', 'rcx-bumper-car', 'rcx-line-follower', 'ev3-wall-stopper', 'nxt-bumper-bot', 'motor-bench',
    'technic-hub-bench', 'boost-rover', 'wedo-milo'];
const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** A brick with a wheel: the category and the library's inset icon. */
const ICON = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
    '<rect x="5" y="9" width="30" height="16" rx="3" fill="#FFBF00" stroke="#CC9900" stroke-width="2"/>' +
    '<rect x="9" y="5" width="7" height="5" rx="1" fill="#FFBF00" stroke="#CC9900" stroke-width="2"/>' +
    '<rect x="24" y="5" width="7" height="5" rx="1" fill="#FFBF00" stroke="#CC9900" stroke-width="2"/>' +
    '<circle cx="13" cy="29" r="6" fill="#4C4C4C" stroke="#222" stroke-width="2"/>' +
    '<circle cx="27" cy="29" r="6" fill="#4C4C4C" stroke="#222" stroke-width="2"/>' +
    '<circle cx="13" cy="29" r="2" fill="#ddd"/><circle cx="27" cy="29" r="2" fill="#ddd"/></svg>'
);

class RobotLabBlocks {
    constructor (runtime) {
        this.runtime = runtime;
    }

    /** The Robot Lab API, or null while the Lab has never been opened. */
    api () {
        const api = this.runtime && this.runtime.robotLab;
        return api && typeof api === 'object' ? api : null;
    }

    getInfo () {
        const motor = {type: ArgumentType.STRING, menu: 'motors', defaultValue: 'A'};
        return {
            id: 'robotlab',
            name: t('name'),
            color1: '#FFAB19',
            color2: '#EC9C13',
            color3: '#CF8B17',
            menuIconURI: ICON,
            blockIconURI: ICON,
            blocks: [
                {opcode: 'loadModel', blockType: BlockType.COMMAND, text: t('loadModel'),
                    arguments: {MODEL: {type: ArgumentType.STRING, menu: 'models', defaultValue: 'driving-base'}}},
                {opcode: 'startSimulation', blockType: BlockType.COMMAND, text: t('startSimulation')},
                {opcode: 'stopSimulation', blockType: BlockType.COMMAND, text: t('stopSimulation')},
                {opcode: 'resetSimulation', blockType: BlockType.COMMAND, text: t('resetSimulation')},
                '---',
                {opcode: 'setMotorPower', blockType: BlockType.COMMAND, text: t('setMotorPower'),
                    arguments: {MOTOR: motor, POWER: {type: ArgumentType.NUMBER, defaultValue: 50}}},
                {opcode: 'setMotorSpeed', blockType: BlockType.COMMAND, text: t('setMotorSpeed'),
                    arguments: {MOTOR: motor, SPEED: {type: ArgumentType.NUMBER, defaultValue: 360}}},
                {opcode: 'runMotorDegrees', blockType: BlockType.COMMAND, text: t('runMotorDegrees'),
                    arguments: {MOTOR: motor, DEGREES: {type: ArgumentType.NUMBER, defaultValue: 360},
                        SPEED: {type: ArgumentType.NUMBER, defaultValue: 360}}},
                {opcode: 'stopMotor', blockType: BlockType.COMMAND, text: t('stopMotor'),
                    arguments: {MOTOR: motor, ACTION: {type: ArgumentType.STRING, menu: 'stopActions', defaultValue: 'brake'}}},
                {opcode: 'motorAngle', blockType: BlockType.REPORTER, text: t('motorAngle'), arguments: {MOTOR: motor}},
                {opcode: 'motorSpeed', blockType: BlockType.REPORTER, text: t('motorSpeed'), arguments: {MOTOR: motor}},
                '---',
                {opcode: 'sensorValue', blockType: BlockType.REPORTER, text: t('sensorValue'),
                    arguments: {SENSOR: {type: ArgumentType.STRING, menu: 'sensors', defaultValue: 'A'}}},
                {opcode: 'partPosition', blockType: BlockType.REPORTER, text: t('partPosition'),
                    arguments: {PART: {type: ArgumentType.STRING, menu: 'parts', defaultValue: 'hub'},
                        AXIS: {type: ArgumentType.STRING, menu: 'axes', defaultValue: 'x'}}},
                {opcode: 'whenTouch', blockType: BlockType.HAT, isEdgeActivated: true, text: t('whenTouch'),
                    arguments: {PART: {type: ArgumentType.STRING, menu: 'parts', defaultValue: 'hub'},
                        OTHER: {type: ArgumentType.STRING, menu: 'others', defaultValue: 'ground'}}},
                {opcode: 'labStatus', blockType: BlockType.REPORTER, text: t('labStatus')}
            ],
            menus: {
                models: {acceptReporters: true, items: 'modelMenu'},
                motors: {acceptReporters: true, items: 'motorMenu'},
                sensors: {acceptReporters: true, items: 'sensorMenu'},
                parts: {acceptReporters: true, items: 'partMenu'},
                others: {acceptReporters: true, items: 'otherMenu'},
                stopActions: {acceptReporters: false, items: ['brake', 'coast', 'hold'].map(value => ({text: t(value), value}))},
                axes: {acceptReporters: false, items: ['x', 'y', 'z', 'heading'].map(value => ({text: value === 'heading' ? t('heading') : value, value}))}
            }
        };
    }

    // ---- dynamic menus: the open model's ports and parts, a sensible list before it is open ----
    _list (fn, fallback) {
        const api = this.api();
        try {
            const items = api ? fn(api) : [];
            const unique = [...new Set(items.filter(v => typeof v === 'string' && v !== ''))];
            return unique.length ? unique : fallback;
        } catch (e) {
            return fallback;
        }
    }

    modelMenu () { return this._list(api => api.models().map(m => m.id), MODELS); }
    motorMenu () { return this._list(api => api.motors().map(m => m.port), PORTS); }
    sensorMenu () { return this._list(api => api.sensors().map(s => s.port), PORTS); }
    partMenu () { return this._list(api => api.parts().map(p => p.id), ['hub']); }
    otherMenu () {
        const parts = this._list(api => api.parts().map(p => p.id), []);
        return [{text: t('ground'), value: 'ground'}, {text: t('wall'), value: 'wall'}, ...parts];
    }

    // ---- commands: each one API call; nothing to do while the Lab is closed ---------------
    _call (method, ...args) {
        const api = this.api();
        if (!api || typeof api[method] !== 'function') return undefined;
        try {
            const result = api[method](...args);
            // Promises are waited on (a model loads, a motor turns its degrees), and their refusals swallowed.
            return result && typeof result.then === 'function' ? result.then(() => undefined, () => undefined) : undefined;
        } catch (e) {
            return undefined;
        }
    }

    loadModel (args) { return this._call('loadModel', Cast.toString(args.MODEL)); }
    startSimulation () { return this._call('start'); }
    stopSimulation () { return this._call('stop'); }
    resetSimulation () { return this._call('reset'); }
    setMotorPower (args) { return this._call('setMotorPower', Cast.toString(args.MOTOR), Cast.toNumber(args.POWER)); }
    setMotorSpeed (args) { return this._call('setMotorSpeed', Cast.toString(args.MOTOR), Cast.toNumber(args.SPEED)); }
    runMotorDegrees (args) {
        return this._call('runMotorDegrees', Cast.toString(args.MOTOR), Cast.toNumber(args.DEGREES), Cast.toNumber(args.SPEED));
    }
    stopMotor (args) { return this._call('stopMotor', Cast.toString(args.MOTOR), Cast.toString(args.ACTION)); }

    // ---- reporters and the hat ---------------------------------------------------------------
    _read (method, fallback, ...args) {
        const api = this.api();
        if (!api || typeof api[method] !== 'function') return fallback;
        try {
            const v = api[method](...args);
            return v === undefined || v === null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    motorAngle (args) { return this._read('motorAngle', 0, Cast.toString(args.MOTOR)); }
    motorSpeed (args) { return this._read('motorSpeed', 0, Cast.toString(args.MOTOR)); }
    sensorValue (args) { return this._read('sensorValue', 0, Cast.toString(args.SENSOR)); }
    partPosition (args) { return this._read('partPosition', 0, Cast.toString(args.PART), Cast.toString(args.AXIS)); }
    labStatus () { return this._read('status', 'not-open'); }
    whenTouch (args) { return Boolean(this._read('whenTouch', false, Cast.toString(args.PART), Cast.toString(args.OTHER))); }
}

module.exports = RobotLabBlocks;
