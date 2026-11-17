// SPDX-License-Identifier: BSD-3-Clause
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const gui = createRequire(path.resolve(__dirname, '../../packages/scratch-gui/package.json'));
const babel = gui('@babel/core');
const root = path.resolve(__dirname, '../../overlay/scratch-gui/src/components/tw-pseudocode');
const transform = source => babel.transformSync(source, {babelrc: false, configFile: false,
    presets: [gui.resolve('@babel/preset-react')], plugins: [gui.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
const load = name => {
    const module = {exports: {}};
    new Function('require', 'module', 'exports', transform(fs.readFileSync(path.join(root, name), 'utf8')))(gui, module, module.exports);
    return module.exports;
};
const source = fs.readFileSync(path.join(root, 'sim-lab-pane.jsx'), 'utf8');
// Execute the real pane class/methods without booting the VM, physics or Redux lifecycle.
const paneClassSource = source.slice(source.indexOf('class SimLabPane extends'), source.indexOf('\nexport default connect'));
const css = fs.readFileSync(path.join(root, 'sim-lab-pane.css'), 'utf8');
const {INSIGHT_TEXT: texts, issueSentence} = load('sim-lab-insight-text.js');
function paneClass(React, Notice) {
    return new Function('React', 'SimLabNotice', 'paneStyles', 'issueSentence', `${transform(paneClassSource)};return SimLabPane;`)(React, Notice, {root: 'robot-ux-root'}, issueSentence);
}
module.exports = {gui, transform, load, paneClass, paneClassSource, css, texts, source};
