import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createArcadeStatsOutput} from '../overlay/scratch-gui/src/lib/bw-arcade-stats-output.js';
import {importGuiDependency} from './helpers/bw-integrated.mjs';
const require=createRequire(import.meta.url),createStats=require('../overlay/scratch-vm/src/extensions/crispstrobe/arcade/game-stats.js');
async function renderer(){
    const React=(await importGuiDependency('react/index.js')).default;
    const server=(await importGuiDependency('react-dom/server.node.js')).default;
    const PropTypes=(await importGuiDependency('prop-types/index.js')).default;
    const Output=createArcadeStatsOutput(React,PropTypes);
    return runtime=>server.renderToStaticMarkup(React.createElement(Output,{runtime}));
}
test('actual board output renders retained native publication through false and clears on reset',async()=>{
    const render=await renderer(),runtime={},stats=createStats(text=>{runtime.bwArcadeStatsText=text;}),owner={};
    stats.begin(owner);stats.setEnabled(true);stats.draw(owner,2);
    assert.match(render(runtime),/> sprites:2<\/output>/);
    stats.setEnabled(false);stats.draw(owner,9);assert.match(render(runtime),/> sprites:2<\/output>/);
    stats.reset();assert.match(render(runtime),/><\/output>/);
});
test('board text escapes actual strings and never coerces opaque data',async()=>{
    const render=await renderer();let touched=0;
    assert.match(render({bwArcadeStatsText:'<script>unsafe</script>'}),/&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.match(render({bwArcadeStatsText:{toString(){touched++;return 'fake stats';}}}),/><\/output>/);
    assert.equal(touched,0);
});
