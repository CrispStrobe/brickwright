// SPDX-License-Identifier: BSD-3-Clause
// The Code tab's `cad …` modelling words (lib/cadShapesDialect.js), layered on the
// vendored compiler the way lib/robot-lab-pseudocode.js layers the `lab` words.
// Shapes are statements; transforms, groups, holes and `count with` are C-blocks
// whose header line ends in `:` (read through the compiler's parseBodyHeader door).
import {compileArcadeWord} from './arcadeDialect.js';
import {matchTopLevel} from './robot-lab-pseudocode.js';
import {cadShapesWordFor, cadShapesWordsOf, isCadShapesLine} from './cadShapesDialect.js';

export function withCadShapes (Base) {
    return class CadShapesCreator extends Base {
        /** One `cad …` statement or C-block header (without its colon) as its block, or null. */
        parseCadShapesLine (line, target, kinds) {
            const text = String(line).trim();
            if (!isCadShapesLine(text)) return null;
            const context = {target, extraBlocks: {}, parentId: null};
            const read = s => {
                if (typeof this.refuseSpilledReporter === 'function') this.refuseSpilledReporter(text, s, target);
                return this.parseValue(s, context);
            };
            for (const entry of cadShapesWordsOf(kinds)) {
                const m = matchTopLevel(text, compileArcadeWord(entry).re);
                if (!m) continue;
                const {id, block} = this.createBlock(entry.op);
                context.parentId = id;
                const slots = this.arcadeSlots(entry, m, context, read);
                if (!slots) continue;
                Object.assign(block[id], slots);
                return {block, extraBlocks: context.extraBlocks};
            }
            return null;
        }

        parseCommand (line, target, allowLoop = false) {
            return this.parseCadShapesLine(line, target, ['command']) || super.parseCommand(line, target, allowLoop);
        }

        /** A C-block header such as `cad move x 10 y 0 z 0` (its colon already removed). */
        parseBodyHeader (header, target) {
            const own = this.parseCadShapesLine(header, target, ['loop']);
            if (own) return own;
            return typeof super.parseBodyHeader === 'function' ? super.parseBodyHeader(header, target) : null;
        }

        /** `cad model status`, read whole before the motor words (both start with `cad`). */
        parseReporter (s, context) {
            const text = String(s).trim();
            if (/^cad\s+model\s+status$/i.test(text)) {
                const id = this.pushBlock(context, 'cadshapes_lastStatus');
                return this.valueOfBlock(id);
            }
            return super.parseReporter(s, context);
        }

        drep (b, blocks) {
            const entry = b && cadShapesWordFor(b.opcode);
            if (entry && entry.kind === 'reporter') return this.spellArcade(entry, b, blocks);
            return super.drep(b, blocks);
        }

        decompileStackBlock (b, blocks, level) {
            const entry = b && cadShapesWordFor(b.opcode);
            if (!entry) return super.decompileStackBlock(b, blocks, level);
            const pad = '  '.repeat(level);
            const words = this.spellArcade(entry, b, blocks);
            if (entry.kind !== 'loop') return [`${pad}${words}`];
            const body = b.inputs && b.inputs.SUBSTACK ? this.decompileStackFrom(b.inputs.SUBSTACK[1], blocks, level + 1) : [];
            return [`${pad}${words}:`, ...body];
        }
    };
}
