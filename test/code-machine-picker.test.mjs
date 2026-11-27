import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {isMachinePickerBackdrop} from '../overlay/scratch-gui/src/components/tw-pseudocode/machine-picker-view.js';
import {editorOverflowStyles} from '../overlay/scratch-gui/src/components/tw-pseudocode/editor-overflow-styles.js';

test('the Mac machine picker closes only when a click lands outside its dialog bounds', () => {
    const dialog = {getBoundingClientRect: () => ({left: 15, right: 200, top: 25, bottom: 350})};
    const backdrop = (clientX, clientY, target = dialog) =>
        isMachinePickerBackdrop({target, currentTarget: dialog, clientX, clientY});
    assert.equal(backdrop(20, 40), false);
    assert.equal(backdrop(15, 350), false);
    for (const [x, y] of [[2, 40], [201, 40], [200, 23], [200, 351]]) assert.equal(backdrop(x, y), true);
    assert.equal(backdrop(0, 0, {}), false);
});

test('the Code overflow machine picker lays out its icon and label as one row', () => {
    assert.match(editorOverflowStyles,
        /\[data-code-machine-select\] \{\s*display: flex !important;\s*flex-wrap: nowrap;/);
    assert.match(editorOverflowStyles, /\[data-code-machine-select\] > :is\(select, button\) \{\s*flex: 1;\s*min-width: 0;/);
});

test('the language overflow lists plain names for both active and optional languages', () => {
    const importer = readFileSync(new URL(
        '../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx', import.meta.url), 'utf8');
    const languages = importer.slice(importer.indexOf('const renderLanguages ='), importer.indexOf('const languageBar ='));
    assert.doesNotMatch(languages, /<Icon|>＋ \{label\}/);
    assert.match(languages, /onClick=\{open\}>\{LANG_LABEL\[language\] \|\| label\}/);
});
