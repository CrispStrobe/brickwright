import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL(
    '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');

test('Code help contains the representation capability contract', () => {
    assert.match(source, /data-testid="bw-representation-status"/);
    assert.match(source, /supported subset/);
    assert.match(source, /unterstützte Teilmenge/);
    assert.match(source, /Generated read-only preview/);
    assert.match(source, /Generated read-only listing/);
    assert.match(source, /Editable ASM source/);
    assert.match(source, /no reverse conversion to Blocks/);
});

test('the info panel no longer calls every editable language unqualified two-way', () => {
    assert.doesNotMatch(source, /and <strong>BASIC<\/strong> are two-way/);
    assert.doesNotMatch(source, /und <strong>BASIC<\/strong> sind wechselseitig/);
    assert.match(source, /Conversion reports identify unsupported operations/);
});

test('conversion results separate preserved, changed, and unsupported outcomes', () => {
    assert.match(source, /data-testid=\{notice === latestReport \? 'bw-conversion-report'/);
    assert.match(source, /data-testid=\{notice === latestReport \? 'bw-conversion-preserved'/);
    assert.match(source, /data-testid=\{notice === latestReport \? 'bw-conversion-changed'/);
    assert.match(source, /data-testid=\{notice === latestReport \? 'bw-conversion-unsupported'/);
    assert.match(source, /classifyConversionWarnings/);
    assert.match(source, /conversion failed/);
});
