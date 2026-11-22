// SPDX-License-Identifier: BSD-3-Clause
// CAD shapes blocks -> Brickwright CAD. The "build CAD model" C-block's body is read
// here (never executed), turned into the engine's block program (format
// brickwright-cad-blocks, docs/CAD-BLOCKS.md in Brickwright CAD) and compiled by the
// CAD SDK into parametric code bodies, one per colour, updated in place as one undo
// step. Nothing has to run: every model block rebuilds by itself shortly after an
// edit (live preview, on unless paused from the block's menu), and the CAD editor
// opens beside the blocks in the right pane (gui.jsx) the first time it is needed.
// Running the block (a click, or the green flag) builds it as well.
import {getCadEnabled, setCadEnabled} from './bw-cad-preferences.js';
import {CAD_OPEN_EVENT, CAD_READY_EVENT} from './bw-cad-program.js';
import {loadCadSDK} from './bw-cad-sdk.js';
import {cadShapesWordFor} from './cadShapesDialect.js';

export class CadBlocksWalkError extends Error {
    constructor (message, blockId) { super(message); this.name = 'CadBlocksWalkError'; this.blockId = blockId; }
}

const MATHOP = {abs: 'abs', floor: 'floor', ceiling: 'ceil', sqrt: 'sqrt', sin: 'sin', cos: 'cos', tan: 'tan',
    asin: 'asin', acos: 'acos', atan: 'atan', ln: 'ln', log: 'log', 'e ^': 'exp', '10 ^': 'pow10'};
const BINARY = {operator_add: '+', operator_subtract: '-', operator_multiply: '*', operator_divide: '/', operator_mod: '%',
    operator_gt: '>', operator_lt: '<', operator_equals: '==', operator_and: '&&', operator_or: '||'};
const VALUE_SHADOWS = new Set(['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'math_angle', 'text']);

/**
 * Reads a model C-block into an engine program.
 * @param {(id:string)=>object|undefined} getBlock VM runtime blocks (target.blocks.getBlock)
 * @param {string} modelId the cadshapes_model block
 * @param {(name:string)=>{value:number,min?:number,max?:number,step?:number}|null} variable a Scratch variable by name
 * @param {string} name the model name
 */
export function blocksToCadProgram (getBlock, modelId, variable, name) {
    const model = getBlock(modelId);
    if (!model || model.opcode !== 'cadshapes_model') throw new CadBlocksWalkError('Not a CAD model block', modelId);
    const read = new Set(), set = new Set(), counters = new Set();
    let nodes = 0;
    const fail = (message, id) => { throw new CadBlocksWalkError(message, id); };
    const inputBlock = (b, key) => {
        const input = b.inputs && b.inputs[key];
        return input ? getBlock(input.block) : undefined;
    };
    const literal = (shadow, id) => {
        const field = shadow.fields.NUM || shadow.fields.TEXT;
        const text = String(field ? field.value : '').trim();
        const number = Number(text);
        if (text === '' || !Number.isFinite(number)) fail(`"${text}" is not a number`, id);
        return {k: 'num', v: number};
    };
    const expr = (b, key) => {
        const block = inputBlock(b, key);
        if (!block) return fail(`The ${key.toLowerCase()} input is empty`, b.id);
        return value(block);
    };
    const value = block => {
        if (++nodes > 4096) fail('The model is too large', block.id);
        if (VALUE_SHADOWS.has(block.opcode)) return literal(block, block.id);
        if (block.opcode === 'data_variable') { const n = block.fields.VARIABLE.value; read.add(n); return {k: 'var', name: n}; }
        if (BINARY[block.opcode]) {
            const [a, b2] = /^operator_(?:add|subtract|multiply|divide|mod)$/.test(block.opcode) ? ['NUM1', 'NUM2'] : ['OPERAND1', 'OPERAND2'];
            return {k: 'op', op: BINARY[block.opcode], a: expr(block, a), b: expr(block, b2)};
        }
        if (block.opcode === 'operator_not') return {k: 'not', a: expr(block, 'OPERAND')};
        if (block.opcode === 'operator_round') return {k: 'fn', fn: 'round', args: [expr(block, 'NUM')]};
        if (block.opcode === 'operator_mathop') {
            const fn = MATHOP[block.fields.OPERATOR.value];
            if (!fn) fail(`Unsupported maths function ${block.fields.OPERATOR.value}`, block.id);
            return {k: 'fn', fn, args: [expr(block, 'NUM')]};
        }
        if (block.opcode === 'operator_random') return {k: 'random', min: expr(block, 'FROM'), max: expr(block, 'TO'), seed: block.id};
        return fail(`This block cannot be used in a CAD model value (${block.opcode})`, block.id);
    };
    const body = (b, key) => {
        const out = [];
        let id = b.inputs && b.inputs[key] ? b.inputs[key].block : null;
        while (id) {
            const block = getBlock(id);
            if (!block) break;
            const stmt = statement(block);
            if (stmt) out.push(stmt);
            id = block.next;
        }
        return out;
    };
    const statement = block => {
        if (++nodes > 4096) fail('The model is too large', block.id);
        const id = block.id, entry = cadShapesWordFor(block.opcode);
        if (entry && entry.shape) {
            const args = {};
            for (const [input, arg] of Object.entries(entry.args)) args[arg] = expr(block, input);
            const stmt = {k: 'shape', id, shape: entry.shape, args};
            if (entry.shape === 'text') {
                const text = inputBlock(block, 'TEXT');
                if (!text || text.opcode !== 'text') fail('Type the text into the text block', id);
                stmt.text = String(text.fields.TEXT.value);
            }
            return stmt;
        }
        if (entry && entry.stmt) {
            switch (entry.stmt) {
            case 'model': return fail('A CAD model cannot contain another model', id);
            case 'move': case 'rotate': case 'scale':
                return {k: entry.stmt, id, x: expr(block, 'X'), y: expr(block, 'Y'), z: expr(block, 'Z'), body: body(block, 'SUBSTACK')};
            case 'mirror': return {k: 'mirror', id, axis: String(block.fields.AXIS ? block.fields.AXIS.value : 'x'), body: body(block, 'SUBSTACK')};
            case 'color': {
                // A picked colour (colour_picker) or a typed #rrggbb; computed colours are not part of a model.
                const shadow = inputBlock(block, 'COLOR');
                const field = shadow && (shadow.fields.COLOUR || shadow.fields.TEXT);
                const color = String(field ? field.value : '').trim();
                if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail('Pick the colour in the block (a #rrggbb colour)', id);
                return {k: 'color', id, color: color.toLowerCase(), body: body(block, 'SUBSTACK')};
            }
            case 'for': {
                const varBlock = inputBlock(block, 'VAR');
                const varName = varBlock && (varBlock.fields.TEXT || {}).value;
                if (!varName || !String(varName).trim()) fail('Name the counter variable', id);
                counters.add(String(varName));
                return {k: 'for', id, var: String(varName), from: expr(block, 'FROM'), to: expr(block, 'TO'), step: expr(block, 'STEP'), body: body(block, 'SUBSTACK')};
            }
            default: return {k: entry.stmt, id, body: body(block, 'SUBSTACK')};
            }
        }
        switch (block.opcode) {
        case 'control_repeat': return {k: 'repeat', id, count: expr(block, 'TIMES'), body: body(block, 'SUBSTACK')};
        case 'control_if': return {k: 'if', id, cond: expr(block, 'CONDITION'), then: body(block, 'SUBSTACK')};
        case 'control_if_else': return {k: 'if', id, cond: expr(block, 'CONDITION'), then: body(block, 'SUBSTACK'), else: body(block, 'SUBSTACK2')};
        case 'data_setvariableto': { const n = block.fields.VARIABLE.value; set.add(n); return {k: 'set', id, name: n, value: expr(block, 'VALUE')}; }
        case 'data_changevariableby': { const n = block.fields.VARIABLE.value; read.add(n); return {k: 'change', id, name: n, by: expr(block, 'VALUE')}; }
        default: return fail(`This block cannot be used inside a CAD model (${block.opcode})`, id);
        }
    };
    const program = body(model, 'SUBSTACK');
    // Scratch variables the model reads but never sets are its parameters, with their current values.
    const params = [];
    for (const n of read) {
        if (set.has(n) || counters.has(n)) continue;
        const info = variable(n);
        if (!info) continue;
        params.push({name: n, value: info.value, ...(info.min !== undefined ? {min: info.min, max: info.max, step: info.step} : {})});
    }
    return {version: 1, format: 'brickwright-cad-blocks', name, params, body: program};
}

/** A Scratch variable visible to a target, with its slider range when its monitor shows one. */
export const scratchVariable = (runtime, target) => name => {
    const found = target.lookupVariableByNameAndType(name, '') || runtime.getTargetForStage()?.lookupVariableByNameAndType(name, '');
    if (!found) return null;
    const number = Number(found.value);
    const monitor = runtime._monitorState && runtime._monitorState.get(found.id);
    const info = {value: Number.isFinite(number) ? number : 0};
    if (monitor && monitor.get && monitor.get('mode') === 'slider') {
        Object.assign(info, {min: monitor.get('sliderMin'), max: monitor.get('sliderMax'), step: monitor.get('isDiscrete') ? 1 : 0.1});
    }
    return info;
};

/** The model block's name when it is typed in (not a reporter), else 'Model'. */
export const modelNameOf = (getBlock, modelId) => {
    const model = getBlock(modelId);
    const input = model && model.inputs && model.inputs.NAME;
    const shadow = input && getBlock(input.block);
    const field = shadow && shadow.fields && (shadow.fields.TEXT || Object.values(shadow.fields)[0]);
    return String(field && field.value || 'Model').trim().slice(0, 120) || 'Model';
};

const LIVE_DELAY = 400;

/** Installs runtime.cadShapes: the bridge the cadshapes extension's model block calls. */
export function installCadShapesAPI (runtime) {
    let disposed = false;
    const editor = () => globalThis.__bwCad;
    const built = () => Boolean(process.env.BW_ENABLE_CAD) && !disposed;
    const enabled = () => built() && getCadEnabled();
    // Using CAD blocks is asking for the CAD editor: switch it on rather than refuse.
    const enable = () => { if (built() && !getCadEnabled()) setCadEnabled(true); return enabled(); };
    const ready = () => {
        if (!enable()) return Promise.reject(new Error('This build has no CAD Editor.'));
        if (editor()) return Promise.resolve(editor());
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { window.removeEventListener(CAD_READY_EVENT, check); reject(new Error('CAD Editor did not become ready')); }, 60000);
            const check = () => { if (editor()) { clearTimeout(timer); window.removeEventListener(CAD_READY_EVENT, check); resolve(editor()); } };
            window.addEventListener(CAD_READY_EVENT, check);
            window.dispatchEvent(new CustomEvent(CAD_OPEN_EVENT)); check();
        });
    };
    // The SDK alone, for code views: no need to open the editor to read a model's code.
    const sdkOnly = () => {
        if (!built()) return Promise.reject(new Error('This build has no CAD Editor.'));
        return editor() ? Promise.resolve(editor().sdk) : loadCadSDK();
    };
    const report = (blockId, message) => { try { runtime.visualReport(blockId, message); } catch (e) { /* the block may be gone */ } };
    const programOf = (blockId, target, name) => blocksToCadProgram(id => target.blocks.getBlock(id), blockId,
        scratchVariable(runtime, target), String(name || modelNameOf(id => target.blocks.getBlock(id), blockId)).trim().slice(0, 120) || 'Model');
    // Live preview: every model block not paused is rebuilt (debounced) after an edit,
    // and only when what it describes changed since its last build.
    const paused = new Set();      // model block ids whose live preview is off
    const lastBuilt = new Map();   // model block id -> the program it was last built from
    let liveTimer = null;
    const modelBlocks = () => {
        const found = [];
        for (const target of runtime.targets || []) {
            if (!target.isOriginal) continue;
            for (const block of Object.values(target.blocks._blocks || {})) {
                if (block.opcode === 'cadshapes_model') found.push([block.id, target]);
            }
        }
        return found;
    };
    const signature = (blockId, target) => {
        try { return JSON.stringify(programOf(blockId, target)); } catch (error) { return `error:${error.message}`; }
    };
    const isEmpty = (blockId, target) => {
        const model = target.blocks.getBlock(blockId);
        return !(model && model.inputs && model.inputs.SUBSTACK && model.inputs.SUBSTACK.block);
    };
    const rebuildLive = () => {
        liveTimer = null;
        if (disposed || !built()) return;
        for (const [blockId, target] of modelBlocks()) {
            if (paused.has(blockId)) continue;
            const key = signature(blockId, target);
            if (lastBuilt.get(blockId) === key) continue;
            lastBuilt.set(blockId, key);
            // A model block just dragged out holds no shapes yet: nothing to build.
            if (isEmpty(blockId, target)) continue;
            api.build(blockId, target).catch(() => { /* reported on the block */ });
        }
    };
    const onChange = () => {
        if (disposed) return;
        if (liveTimer) clearTimeout(liveTimer);
        liveTimer = setTimeout(rebuildLive, LIVE_DELAY);
    };
    // A loaded project's models are as its CAD design already holds them: remember
    // them without building, so opening a project neither edits it nor opens panes.
    const onLoaded = () => {
        lastBuilt.clear(); paused.clear();
        for (const [blockId, target] of modelBlocks()) lastBuilt.set(blockId, signature(blockId, target));
    };
    runtime.on('PROJECT_CHANGED', onChange);
    runtime.on('PROJECT_LOADED', onLoaded);
    const api = {
        async build (blockId, target, name) {
            let program;
            try {
                program = programOf(blockId, target, name);
            } catch (error) { report(error.blockId || blockId, error.message); throw error; }
            const modelName = program.name;
            lastBuilt.set(blockId, JSON.stringify(program));
            if (!program.body.length) {
                const message = 'Put shapes inside the model block';
                report(blockId, message);
                throw new CadBlocksWalkError(message, blockId);
            }
            const {editor: mounted, sdk} = await ready();
            let compiled;
            try { compiled = sdk.compileBlocksToCadScript(program); } catch (error) { report(error.blockId || blockId, error.message); throw error; }
            // One code object per colour, added or updated by name as one undo step (Brickwright CAD).
            const result = sdk.applyBlocksModel(mounted.session, modelName, compiled);
            await mounted.whenIdle();
            return {status: result.status, source: compiled.source, objects: result.ids.length};
        },
        /** The model's parametric CAD Script ('cadcode'), OpenSCAD ('openscad') or JSCAD ('jscad') text. */
        async exportModel (blockId, target, name, format) {
            const program = programOf(blockId, target, name);
            const sdk = await sdkOnly();
            if (format === 'openscad') return sdk.exportBlocksOpenSCAD(program);
            if (format === 'jscad') return sdk.exportBlocksJSCAD(program);
            return sdk.compileBlocksToCadScript(program).source;
        },
        /** Live preview of one model block (on by default): rebuilt after each edit while on. */
        setLive (blockId, target, on) {
            if (on) { paused.delete(blockId); lastBuilt.delete(blockId); onChange(); } else paused.add(blockId);
        },
        isLive: blockId => !paused.has(blockId),
        modelName: (blockId, target) => modelNameOf(id => target.blocks.getBlock(id), blockId)
    };
    runtime.cadShapes = api;
    return () => {
        disposed = true;
        if (liveTimer) clearTimeout(liveTimer);
        runtime.removeListener('PROJECT_CHANGED', onChange);
        runtime.removeListener('PROJECT_LOADED', onLoaded);
        if (runtime.cadShapes === api) delete runtime.cadShapes;
    };
}
