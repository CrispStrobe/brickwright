// SPDX-License-Identifier: BSD-3-Clause
const ArgumentType = require('../../../extension-support/argument-type');
const BlockType = require('../../../extension-support/block-type');
const Cast = require('../../../util/cast');
const formatMessage = require('format-message');

// CAD shapes: TinkerCAD-style modelling blocks for Brickwright CAD.
//
// A "build CAD model" C-block holds a model: shape blocks, the transform/group/hole
// C-blocks below, and ordinary Scratch repeat/if/variables/operators. Running it
// does NOT execute its body. It hands its own block id to `runtime.cadShapes`
// (gui lib/bw-cad-blocks.js), which compiles the body to a parametric Brickwright
// CAD code body (docs/CAD-BLOCKS-LITE.md). The other blocks do nothing when run on
// their own. Their words are lib/cadShapesDialect.js, one table for blocks and
// pseudocode; the input defaults are Brickwright CAD's BLOCK_SHAPES (a test
// compares them with the synced SDK).

const SHAPES = [
    // opcode, en, de, [arg, default]...
    ['box', 'box [WIDTH] × [DEPTH] × [HEIGHT] mm', 'Quader [WIDTH] × [DEPTH] × [HEIGHT] mm', ['WIDTH', 20], ['DEPTH', 20], ['HEIGHT', 20]],
    ['cylinder', 'cylinder radius [RADIUS] height [HEIGHT] sides [SIDES]', 'Zylinder Radius [RADIUS] Höhe [HEIGHT] Seiten [SIDES]', ['RADIUS', 10], ['HEIGHT', 20], ['SIDES', 48]],
    ['cone', 'cone radius [RADIUS] top [TOP] height [HEIGHT] sides [SIDES]', 'Kegel Radius [RADIUS] oben [TOP] Höhe [HEIGHT] Seiten [SIDES]', ['RADIUS', 10], ['TOP', 0], ['HEIGHT', 20], ['SIDES', 48]],
    ['sphere', 'sphere radius [RADIUS] sides [SIDES]', 'Kugel Radius [RADIUS] Seiten [SIDES]', ['RADIUS', 10], ['SIDES', 48]],
    ['halfSphere', 'half sphere radius [RADIUS] sides [SIDES]', 'Halbkugel Radius [RADIUS] Seiten [SIDES]', ['RADIUS', 10], ['SIDES', 48]],
    ['tube', 'tube radius [RADIUS] wall [WALL] height [HEIGHT] sides [SIDES]', 'Rohr Radius [RADIUS] Wand [WALL] Höhe [HEIGHT] Seiten [SIDES]', ['RADIUS', 10], ['WALL', 2], ['HEIGHT', 20], ['SIDES', 48]],
    ['torus', 'torus radius [RADIUS] thickness [THICKNESS] sides [SIDES]', 'Torus Radius [RADIUS] Dicke [THICKNESS] Seiten [SIDES]', ['RADIUS', 10], ['THICKNESS', 3], ['SIDES', 48]],
    ['wedge', 'wedge [WIDTH] × [DEPTH] × [HEIGHT] mm', 'Keil [WIDTH] × [DEPTH] × [HEIGHT] mm', ['WIDTH', 20], ['DEPTH', 20], ['HEIGHT', 20]],
    ['roof', 'roof [WIDTH] × [DEPTH] × [HEIGHT] mm', 'Dach [WIDTH] × [DEPTH] × [HEIGHT] mm', ['WIDTH', 20], ['DEPTH', 20], ['HEIGHT', 20]],
    ['roundRoof', 'round roof [WIDTH] × [DEPTH] × [HEIGHT] mm', 'Runddach [WIDTH] × [DEPTH] × [HEIGHT] mm', ['WIDTH', 20], ['DEPTH', 20], ['HEIGHT', 10]],
    ['pyramid', 'pyramid base [WIDTH] height [HEIGHT]', 'Pyramide Basis [WIDTH] Höhe [HEIGHT]', ['WIDTH', 20], ['HEIGHT', 20]],
    ['prism', 'polygon radius [RADIUS] sides [SIDES] height [HEIGHT]', 'Vieleck Radius [RADIUS] Seiten [SIDES] Höhe [HEIGHT]', ['RADIUS', 10], ['SIDES', 6], ['HEIGHT', 20]],
    ['star', 'star points [POINTS] radius [RADIUS] inner [INNER] height [HEIGHT]', 'Stern Zacken [POINTS] Radius [RADIUS] innen [INNER] Höhe [HEIGHT]', ['POINTS', 5], ['RADIUS', 10], ['INNER', 5], ['HEIGHT', 4]],
    ['heart', 'heart size [SIZE] height [HEIGHT]', 'Herz Größe [SIZE] Höhe [HEIGHT]', ['SIZE', 20], ['HEIGHT', 4]],
    ['paraboloid', 'paraboloid radius [RADIUS] height [HEIGHT] sides [SIDES]', 'Paraboloid Radius [RADIUS] Höhe [HEIGHT] Seiten [SIDES]', ['RADIUS', 10], ['HEIGHT', 20], ['SIDES', 48]],
    ['text', 'text [TEXT] size [SIZE] height [HEIGHT]', 'Text [TEXT] Größe [SIZE] Höhe [HEIGHT]', ['TEXT', 'Hi'], ['SIZE', 10], ['HEIGHT', 4]]
];
const CBLOCKS = [
    ['model', 'build CAD model [NAME]', 'baue CAD-Modell [NAME]', ['NAME', 'Model']],
    ['move', 'move x [X] y [Y] z [Z]', 'verschiebe x [X] y [Y] z [Z]', ['X', 0], ['Y', 0], ['Z', 0]],
    ['rotate', 'rotate x [X]° y [Y]° z [Z]°', 'drehe x [X]° y [Y]° z [Z]°', ['X', 0], ['Y', 0], ['Z', 0]],
    ['scale', 'scale x [X] y [Y] z [Z]', 'skaliere x [X] y [Y] z [Z]', ['X', 1], ['Y', 1], ['Z', 1]],
    ['mirror', 'mirror along [AXIS]', 'spiegle entlang [AXIS]', ['AXIS', 'x']],
    ['color', 'color [COLOR]', 'färbe [COLOR]', ['COLOR', '#e6492e']],
    ['group', 'group', 'gruppiere'],
    ['hole', 'hole', 'Loch'],
    ['intersect', 'intersect', 'Schnittmenge'],
    ['hull', 'hull', 'Hülle'],
    ['countWith', 'count with [VAR] from [FROM] to [TO] by [STEP]', 'zähle [VAR] von [FROM] bis [TO] in Schritten von [STEP]', ['VAR', 'i'], ['FROM', 1], ['TO', 10], ['STEP', 1]]
];
const ICON = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M8 14 20 7l12 7v13l-12 7-12-7Z" fill="#4C97FF" stroke="white" stroke-width="2"/><path d="m8 14 12 7 12-7M20 21v13" fill="none" stroke="white" stroke-width="2"/><circle cx="20" cy="14" r="2.5" fill="#FFAB19"/></svg>');

const argument = ([name, value]) => [name, name === 'AXIS' ? {type: ArgumentType.STRING, menu: 'axes', defaultValue: value} :
    name === 'COLOR' ? {type: ArgumentType.COLOR, defaultValue: value} :
    {type: typeof value === 'number' ? ArgumentType.NUMBER : ArgumentType.STRING, defaultValue: value}];

class CadShapesBlocks {
    constructor (runtime) { this.runtime = runtime; }
    api () { return this.runtime && this.runtime.cadShapes || null; }
    getInfo () {
        const de = String(formatMessage.setup().locale || 'en').startsWith('de');
        const blocks = [];
        for (const [opcode, en, deText, ...args] of CBLOCKS) {
            blocks.push({opcode, blockType: BlockType.CONDITIONAL, branchCount: 1, text: de ? deText : en,
                arguments: Object.fromEntries(args.map(argument))});
            if (opcode === 'model' || opcode === 'hull') blocks.push('---');
        }
        blocks.push('---');
        for (const [opcode, en, deText, ...args] of SHAPES) {
            blocks.push({opcode, blockType: BlockType.COMMAND, text: de ? deText : en, arguments: Object.fromEntries(args.map(argument))});
        }
        blocks.push('---', {opcode: 'lastStatus', blockType: BlockType.REPORTER, text: de ? 'CAD-Modell-Status' : 'CAD model status'});
        return {
            id: 'cadshapes', name: de ? 'CAD-Formen' : 'CAD shapes',
            color1: '#4C6CD9', color2: '#3E59B8', color3: '#2F4590',
            menuIconURI: ICON, blockIconURI: ICON,
            blocks,
            menus: {axes: {acceptReporters: false, items: ['x', 'y', 'z']}}
        };
    }
    /** Compiles this block's body into the CAD model of that name; waits until it is built. */
    model (args, util) {
        const api = this.api();
        if (!api) { this.status = 'CAD shapes need the CAD Editor (Settings → Workspace)'; return; }
        const blockId = util.thread.peekStack();
        return Promise.resolve(api.build(blockId, util.target, Cast.toString(args.NAME)))
            .then(result => { this.status = result && result.status || 'built'; }, error => { this.status = error && error.message || String(error); });
    }
    lastStatus () { return this.status || (this.api() ? 'ready' : 'not-open'); }
}
// Shapes and C-blocks only describe the model; run on their own they do nothing.
for (const [opcode] of [...SHAPES, ...CBLOCKS]) if (opcode !== 'model') CadShapesBlocks.prototype[opcode] = function () {};
module.exports = CadShapesBlocks;
