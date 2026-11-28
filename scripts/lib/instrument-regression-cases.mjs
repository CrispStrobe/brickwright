/** Authored, deterministic inputs. Importing this module runs no simulator. */
import {createHash} from 'node:crypto';

export const SCHEMA_VERSION = 1;
export const CONTRACT_SOURCES = Object.freeze({
    'bw-board': '818e0263fecd320d39737a580b7a73d562603c2e',
    'bw-circuit-ui': '659431ce46a7b6d4ae472182b069ec301aee0df3'
});
export const THERMAL_PROFILE = Object.freeze({volts: .02585, celsius: 26.826793442075882});
const TEMPERATURE_TEXT = '26.826793442075882';

export const TOLERANCES = Object.freeze({
    passiveWaveV: Object.freeze({absolute: 1e-4, relative: 1e-3}),
    passiveMeanV: Object.freeze({absolute: 1e-6, relative: 1e-4}),
    passiveMeanA: Object.freeze({absolute: 1e-9, relative: 1e-4}),
    staticV: Object.freeze({absolute: 1e-5, relative: 1e-3}),
    staticA: Object.freeze({absolute: 1e-9, relative: 1e-3}),
    lmWaveV: Object.freeze({absolute: 1e-4, relative: 0}),
    lmMeanV: Object.freeze({absolute: 2e-6, relative: 0}),
    adpWaveV: Object.freeze({absolute: 5e-7, relative: 0}),
    adpMeanV: Object.freeze({absolute: 1e-6, relative: 0}),
    adpMeanA: Object.freeze({absolute: 1e-6, relative: 0}),
    conservationA: Object.freeze({absolute: 1e-10, relative: 0})
});

export const TEMPLATE_COUNTS = Object.freeze({
    divider: 32, bridge: 32,
    'rc-lowpass': 32, 'rc-highpass': 32,
    'rl-lowpass': 32, 'rl-highpass': 32,
    'diode-forward': 24, 'diode-reversed': 24,
    'npn-common-emitter': 12, 'npn-emitter-follower': 12,
    'lm741-follower': 24, 'adp7118-startup': 24
});

const freeze = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
};
export const canonicalJson = value => JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Nonfinite manifest number');
    return item && !Array.isArray(item) && typeof item === 'object'
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
});
export const contentHash = text => createHash('sha256').update(text).digest('hex');

export function sampleClock(durationNs, intervalNs) {
    if (![durationNs, intervalNs].every(v => Number.isSafeInteger(v) && v > 0) ||
        durationNs % intervalNs !== 0 || 1e9 / intervalNs > 2e6) {
        throw new Error('Capture requires an exact admitted integer-nanosecond grid');
    }
    return {startNs: 0, durationNs, intervalNs, firstSampleNs: intervalNs,
        count: durationNs / intervalNs, rateHz: 1e9 / intervalNs};
}

const expression = (terms, constant = 0) => ({terms, constant});
const voltage = (id, tip, reference, terms) => ({id, kind: 'voltage', unit: 'V',
    tip, reference, oracle: expression(terms)});
const current = (id, selector, terms) => ({id, kind: 'current', unit: 'A',
    selector, reference: '', oracle: expression(terms)});
const meter = (id, mode, probes, oracle = null) => ({id, mode, probes,
    unit: mode === 'voltage' ? 'V' : 'A', quantity: 'observed-dc-mean',
    currentConvention: mode === 'current' ? 'out-of-part' : null, oracle});
const wire = (from, fromTerminal, to, toTerminal) => ({from, fromTerminal, to, toTerminal});
const part = (id, kind, params) => ({id, kind, params});
const spice = cards => '* Authored instrument regression circuit\n' + cards.join('\n') + '\n.end\n';
const json = circuit => JSON.stringify(circuit, null, 2) + '\n';
const pulse = (level, riseNs, durationNs) =>
    `V1 IN 0 PULSE(0 ${level} 0 ${riseNs}n ${riseNs}n ${durationNs * 2}n ${durationNs * 4}n)`;
const thermal = `.options TEMP=${TEMPERATURE_TEXT} TNOM=${TEMPERATURE_TEXT}`;

function define(template, parameters, body) {
    const id = `${template}-${contentHash(canonicalJson(parameters)).slice(0, 12)}`;
    return freeze({schemaVersion: SCHEMA_VERSION, id, template, parameters, ...body,
        input: {...body.input, sha256: contentHash(body.input.text)}});
}

function transient(template, parameters, cards, scopes, meters, clock, extra = {}) {
    return define(template, parameters, {route: 'measure', referenceKind: 'ngspice',
        input: {format: 'spice', text: spice(cards)}, clock, probe: 'ideal',
        profile: 'precision-v1', initial: 'zero-state', acquisition: 'batch',
        maxStepNs: Math.min(2000, clock.intervalNs / 20), scopes, meters,
        tolerances: {waveV: TOLERANCES.passiveWaveV,
            meanV: TOLERANCES.passiveMeanV, meanA: TOLERANCES.passiveMeanA}, ...extra});
}

function resistive(template, volts, ohms, ratio) {
    const clock = sampleClock(100000, 1000), riseNs = 10000;
    const cards = [pulse(volts, riseNs, clock.durationNs)];
    const scopes = [voltage('input', 'V1.pos', 'V1.neg', {'v(in)': 1})];
    const meters = [meter('supply-current', 'current', ['V1.pos'], expression({'i(v1)': -1}))];
    if (template === 'divider') {
        cards.push(`R1 IN OUT ${ohms}`, `R2 OUT 0 ${ohms * ratio}`);
        scopes.push(voltage('output', 'R2.a', 'V1.neg', {'v(out)': 1}),
            voltage('series-drop', 'R1.a', 'R1.b', {'v(in)': 1, 'v(out)': -1}));
        meters.push(meter('output-mean', 'voltage', ['R2.a', 'V1.neg'], expression({'v(out)': 1})),
            meter('load-current', 'current', ['R2.a'], expression({'v(out)': -1 / (ohms * ratio)})));
    } else {
        cards.push(`R1 IN LEFT ${ohms}`, `R2 LEFT 0 ${ohms}`,
            `R3 IN RIGHT ${ohms * ratio}`, `R4 RIGHT 0 ${ohms}`);
        scopes.push(voltage('left', 'R2.a', 'V1.neg', {'v(left)': 1}),
            voltage('right', 'R4.a', 'V1.neg', {'v(right)': 1}),
            voltage('differential', 'R2.a', 'R4.a', {'v(left)': 1, 'v(right)': -1}));
        meters.push(meter('left-current', 'current', ['R2.a'], expression({'v(left)': -1 / ohms})),
            meter('right-current', 'current', ['R4.a'], expression({'v(right)': -1 / ohms})));
    }
    return transient(template, {volts, ohms, ratio, riseNs}, cards, scopes, meters, clock);
}

function reactive(template, sign, ohms, storage) {
    const rc = template.startsWith('rc-'), low = template.endsWith('lowpass');
    // storage is integer nF (RC) or integer nH (RL), not rounded float seconds.
    const tauNs = rc ? ohms * storage : storage / ohms;
    const clock = sampleClock(8 * tauNs, 8 * tauNs / 100);
    const riseNs = clock.intervalNs / 10;
    const element = rc ? 'C1' : 'L1', value = storage * 1e-9;
    const seriesStorage = (rc && !low) || (!rc && low);
    const cards = [pulse(sign, riseNs, clock.durationNs),
        ...(seriesStorage ? [`${element} IN OUT ${value}`, `R1 OUT 0 ${ohms}`]
            : [`R1 IN OUT ${ohms}`, `${element} OUT 0 ${value}`])];
    const outputTerminal = seriesStorage ? 'R1.a' : `${element}.a`;
    const scopes = [voltage('input', 'V1.pos', 'V1.neg', {'v(in)': 1}),
        voltage('output', outputTerminal, 'V1.neg', {'v(out)': 1}),
        voltage('difference', 'V1.pos', outputTerminal, {'v(in)': 1, 'v(out)': -1})];
    const resistorTerms = seriesStorage ? {'v(out)': -1 / ohms}
        : {'v(in)': -1 / ohms, 'v(out)': 1 / ohms};
    return transient(template, {sign, ohms, storage, storageUnit: rc ? 'nF' : 'nH', tauNs, riseNs},
        cards, scopes, [meter('output-mean', 'voltage', [outputTerminal, 'V1.neg'], expression({'v(out)': 1})),
            meter('supply-current', 'current', ['V1.pos'], expression({'i(v1)': -1})),
            meter('resistor-current', 'current', ['R1.a'], expression(resistorTerms))], clock);
}

function dc(template, parameters, cards, source, target, observations) {
    return define(template, parameters, {route: 'dc-sweep', referenceKind: 'ngspice',
        input: {format: 'spice', text: spice([...cards, thermal])},
        sweep: {source, from: target === 0 ? -1 : 0, to: target, points: 2},
        currentConvention: 'into-terminal', observations,
        tolerances: {voltage: TOLERANCES.staticV, current: TOLERANCES.staticA},
        thermalProfile: THERMAL_PROFILE});
}

function diode(template, volts, ohms, saturationAmps) {
    const reversed = template === 'diode-reversed', orientation = reversed ? -1 : 1;
    return dc(template, {volts, ohms, saturationAmps, orientation},
        [`V1 IN 0 ${volts}`, `R1 IN OUT ${ohms}`,
            reversed ? 'D1 0 OUT DCORE' : 'D1 OUT 0 DCORE',
            `.model DCORE D(IS=${saturationAmps} N=1 RS=0)`], 'V1', volts,
        [voltage('input', 'V1.pos', 'V1.neg', {'v(in)': 1}),
            voltage('output', reversed ? 'D1.cathode' : 'D1.anode', 'V1.neg', {'v(out)': 1}),
            voltage('junction', 'D1.anode', 'D1.cathode', {'v(out)': orientation}),
            current('anode-current', 'D1.anode', {'i(v1)': -orientation}),
            current('cathode-current', 'D1.cathode', {'i(v1)': orientation}),
            current('supply-current', 'V1.pos', {'i(v1)': 1})]);
}

function npn(template, supplyVolts, biasVolts, beta) {
    const follower = template === 'npn-emitter-follower';
    const cards = [`VCC SUP 0 ${supplyVolts}`, `VB DRIVE 0 ${biasVolts}`, 'RB DRIVE BASE 100',
        ...(follower ? ['RE EMIT 0 1000', 'Q1 SUP BASE EMIT NCORE']
            : ['RC SUP COL 1000', 'Q1 COL BASE 0 NCORE']),
        `.model NCORE NPN(IS=1e-15 BF=${beta} BR=1 NF=1 RB=0 RC=0)`];
    return dc(template, {supplyVolts, biasVolts, beta, baseOhms: 100, loadOhms: 1000,
        saturationAmps: 1e-15, reverseBeta: 1, n: 1}, cards, 'VB', biasVolts,
    [voltage('collector', 'Q1.collector', 'VCC.neg', {[follower ? 'v(sup)' : 'v(col)']: 1}),
        voltage('base', 'Q1.base', 'VCC.neg', {'v(base)': 1}),
        voltage('emitter', 'Q1.emitter', 'VCC.neg', follower ? {'v(emit)': 1} : {}),
        current('collector-current', 'Q1.collector', {'i(vcc)': -1}),
        current('base-current', 'Q1.base', {'i(vb)': -1}),
        current('emitter-current', 'Q1.emitter', {'i(vcc)': 1, 'i(vb)': 1}),
        current('supply-current', 'VCC.pos', {'i(vcc)': 1}),
        current('bias-current', 'VB.pos', {'i(vb)': 1})]);
}

function lm741(sign, phaseNs, loadOhms) {
    const clock = sampleClock(20000, 500);
    const circuit = {vcc: 5, parts: [part('VP', 'vsource', {volts: 15}),
        part('VN', 'vsource', {volts: 15}), part('VIN', 'vsource', {wave: 'spice-pulse',
            v1: 0, v2: sign * .01, td: (10000 + phaseNs) * 1e-9, tr: 1e-9, tf: 1e-9, pw: 20e-6, per: 100e-6}),
        part('G', 'gnd', {}), part('U', 'lm741', {transientModel: 'linear-pole',
            inputOffsetV: 0, supplyPositiveV: 15, supplyNegativeV: -15}),
        part('RL', 'resistor', {ohms: loadOhms})], wires: [
        wire('VP', 'neg', 'G', 'gnd'), wire('VN', 'pos', 'G', 'gnd'), wire('VIN', 'neg', 'G', 'gnd'),
        wire('VP', 'pos', 'U', 'vpos'), wire('VN', 'neg', 'U', 'vneg'),
        wire('VIN', 'pos', 'U', 'inp'), wire('U', 'out', 'U', 'inn'),
        wire('U', 'out', 'RL', 'a'), wire('RL', 'b', 'G', 'gnd')]};
    return define('lm741-follower', {sign, phaseNs, loadOhms}, {route: 'measure',
        referenceKind: 'nominal-analytic', input: {format: 'json', text: json(circuit)}, clock,
        probe: 'ideal', profile: 'precision-v1', initial: 'zero-state', acquisition: 'watch', maxStepNs: 2000,
        referenceModel: {gain: 200000, bandwidthHz: 1e6, inputOhms: 2e6, outputOhms: 600,
            inputOffsetV: 0, amplitudeV: sign * .01, delayNs: 10000 + phaseNs, riseNs: 1},
        scopes: [{id: 'output', tip: 'U.out', reference: 'G.gnd', unit: 'V'},
            {id: 'input', tip: 'VIN.pos', reference: 'G.gnd', unit: 'V'}],
        meters: [meter('output-mean', 'voltage', ['U.out', 'G.gnd']),
            meter('load-a-current', 'current', ['RL.a']), meter('load-b-current', 'current', ['RL.b'])],
        tolerances: {waveV: TOLERANCES.lmWaveV, meanV: TOLERANCES.lmMeanV,
            meanA: {absolute: TOLERANCES.lmMeanV.absolute / loadOhms + 1e-12, relative: 0}}});
}

function adp(loadOhms, microfarads, inputVolts) {
    const clock = sampleClock(1200000, 10000), rOut = .05, currentLimit = .36;
    const circuit = {vcc: 5, parts: [part('VIN', 'vsource', {volts: inputVolts}),
        part('EN', 'vsource', {volts: 3.3}), part('G', 'gnd', {}),
        part('U', 'adp7118', {vOut: 5, startupModel: 'current-limited-envelope', rOut, currentLimit}),
        part('RL', 'resistor', {ohms: loadOhms}), part('C', 'capacitor', {farads: microfarads * 1e-6})],
    wires: [wire('VIN', 'pos', 'U', 'vin_7'), wire('VIN', 'pos', 'U', 'vin_8'),
        wire('EN', 'pos', 'U', 'en'), wire('U', 'vout_1', 'U', 'vout_2'),
        wire('U', 'vout_1', 'U', 'sense_adj'), wire('U', 'vout_1', 'RL', 'a'), wire('U', 'vout_1', 'C', 'a'),
        wire('G', 'gnd', 'VIN', 'neg'), wire('G', 'gnd', 'EN', 'neg'), wire('G', 'gnd', 'U', 'gnd'),
        wire('G', 'gnd', 'RL', 'b'), wire('G', 'gnd', 'C', 'b')]};
    return define('adp7118-startup', {loadOhms, microfarads, inputVolts}, {route: 'measure',
        referenceKind: 'nominal-analytic', input: {format: 'json', text: json(circuit)}, clock,
        probe: 'ideal', profile: 'precision-v1', initial: 'zero-state', acquisition: 'watch', maxStepNs: 2000,
        referenceModel: {outputVolts: 5, rOut, currentLimit, t10Ns: 80000, t90Ns: 380000,
            delayQuantizationNs: 1, packageCurrentReference: 'observed-output-sum-and-terminal-conservation'},
        scopes: [{id: 'output', tip: 'U.vout_1', reference: 'G.gnd', unit: 'V'},
            {id: 'input', tip: 'VIN.pos', reference: 'G.gnd', unit: 'V'}],
        meters: [meter('output-mean', 'voltage', ['U.vout_1', 'G.gnd']),
            meter('input-mean', 'voltage', ['VIN.pos', 'G.gnd']),
            ...['vout_1', 'vout_2', 'vin_7', 'vin_8', 'gnd'].map(terminal =>
                meter(terminal, 'current', [`U.${terminal}`])), meter('load-current', 'current', ['RL.a'])],
        requiredWitnesses: {currentLimitEntry: microfarads >= 47,
            currentLimitRelease: microfarads === 47, internalRegionFlagClaim: false},
        tolerances: {waveV: TOLERANCES.adpWaveV, meanV: TOLERANCES.adpMeanV,
            meanA: TOLERANCES.adpMeanA, conservationA: TOLERANCES.conservationA}});
}

export function createCases() {
    const cases = [];
    for (const template of ['divider', 'bridge']) for (const volts of [-1, 0, 1, 5])
        for (const ohms of [1000, 10000]) for (const ratio of [.25, .5, 1, 4]) cases.push(resistive(template, volts, ohms, ratio));
    for (const template of ['rc-lowpass', 'rc-highpass']) for (const ohms of [1000, 2000, 5000, 10000])
        for (const nf of [10, 20, 50, 100]) for (const sign of [-1, 1]) cases.push(reactive(template, sign, ohms, nf));
    for (const template of ['rl-lowpass', 'rl-highpass']) for (const ohms of [100, 200, 500, 1000])
        for (const nh of [10000000, 20000000, 50000000, 100000000]) for (const sign of [-1, 1]) cases.push(reactive(template, sign, ohms, nh));
    for (const template of ['diode-forward', 'diode-reversed']) for (const volts of [-1, 0, 1])
        for (const ohms of [100, 1000, 10000, 100000]) for (const amps of [1e-12, 1e-8]) cases.push(diode(template, volts, ohms, amps));
    for (const template of ['npn-common-emitter', 'npn-emitter-follower']) for (const supply of [3.3, 5, 9])
        for (const bias of [.65, .75]) for (const beta of [50, 100]) cases.push(npn(template, supply, bias, beta));
    for (const sign of [-1, 1]) for (const phase of [0, 33, 67])
        for (const load of [2000, 10000, 100000, 1000000]) cases.push(lm741(sign, phase, load));
    for (const load of [100, 1000, 10000]) for (const uf of [1, 10, 47, 100])
        for (const rail of [6, 8]) cases.push(adp(load, uf, rail));
    return freeze(cases);
}

export function createManifest() {
    const cases = createCases();
    return freeze({schemaVersion: SCHEMA_VERSION, inventory: 'authored-312-v1',
        contractSources: CONTRACT_SOURCES, cases,
        counts: {cases: cases.length, templates: new Set(cases.map(c => c.template)).size,
            ngspice: cases.filter(c => c.referenceKind === 'ngspice').length,
            nominalAnalytic: cases.filter(c => c.referenceKind === 'nominal-analytic').length,
            staticCases: cases.filter(c => c.route === 'dc-sweep').length,
            waveformCases: cases.filter(c => c.route === 'measure').length},
        definitionSha256: contentHash(canonicalJson(cases))});
}
