// Evidence harness: exact exportOf helper and two callbacks from the source test.
// The receipt binds their SHA-256 values to the reviewed source file.
import test from 'node:test';
import assert from 'node:assert/strict';
import SB3Creator from '../../../overlay/scratch-gui/src/lib/sb3-creator.js';
import {projectToArcade} from '../../../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
const exportOf = (src, uploads = []) => {
    const cr = new SB3Creator();
    cr.parse(src);
    for (const u of uploads) (u.mode === 'add' ? cr.addCustomSVGCostume(u.sprite, u.svg, u.name) : cr.applyCustomSVG(u.sprite, u.svg));
    return projectToArcade(cr.project, {costumeSvg: (t, c) => {
        const a = cr.assets.get(c.assetId);
        return a && a.type === 'svg' ? a.data : null;
    }, soundData: (t, s) => cr.assets.get(s.assetId)?.data || null});
};
test('what has no Arcade counterpart is named and left as a comment where it stood', () => {
    // Thoughts now map to text bubbles. List monitors still have no Arcade
    // counterpart, so retain the named-refusal and source-position guard here.
    const {ts, unsupported} = exportOf('SPRITE s:\nLIST xs\nWHEN flag clicked:\n  say "before"\n  show list xs\n  say "after"\n');
    assert.deepEqual(unsupported, ['show list: Arcade has no list monitors']);
    assert.match(ts, /\.sayText\("before"\)[\s\S]*\/\/ show list: Arcade has no list monitors[\s\S]*\.sayText\("after"\)/);
});

test('thoughts use the mapped Arcade text bubble and explain the presentation change', () => {
    for (const [message, emitted] of [['"hmm"', /sSprite\.sayText\("hmm"\)/],
        ['hmm', /sSprite\.sayText\(s_hmm\)/]]) {
        const {ts, unsupported, warnings} = exportOf(`SPRITE s:\nWHEN flag clicked:\n  think ${message}\n  wait 1 seconds\n`);
        assert.deepEqual(unsupported, []);
        assert.match(ts, emitted);
        assert.ok(warnings.includes('Scratch thoughts use Arcade text bubbles'), JSON.stringify(warnings));
    }
});

