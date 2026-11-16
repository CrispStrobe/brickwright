import test from 'node:test';import assert from 'node:assert/strict';
import {SB3Creator} from './helpers/bw-vm.mjs';
import {projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
test('fixed stats modes export as actual Boolean SDK assignments',()=>{
    for(const mode of ['enabled','disabled']){
        const creator=new SB3Creator();creator.parse('DEVICE ARCADE\nSPRITE Game:\nWHEN arcade source starts:\n  arcade game stats '+mode);
        assert.deepEqual(creator.warnings,[]);const out=projectToArcade(creator.project);
        assert.deepEqual(out.unsupported,[]);assert.match(out.ts,new RegExp('game.stats = '+(mode==='enabled'?'true':'false')));
        const block=creator.project.targets.flatMap(t=>Object.values(t.blocks)).find(b=>b.opcode==='arcade_setGameStats');
        block.fields.MODE=['opaque',null];assert.ok(projectToArcade(creator.project).unsupported.some(x=>/Game stats/.test(x)));
        block.fields.MODE=[mode,null];block.inputs.MODE=[1,[10,'disabled']];
        assert.ok(projectToArcade(creator.project).unsupported.some(x=>/Game stats/.test(x)),'connected input must not be exported as its stale field');
    }
});
