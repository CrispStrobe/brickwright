// SPDX-License-Identifier: BSD-3-Clause
const {execFile} = require('node:child_process');
const path = require('node:path');

module.exports = function manualPolicyIndex () {
    const done = this.async();
    const generator = path.join(__dirname, 'manual-policy-index.mjs');
    this.addDependency(generator);
    this.addContextDependency(path.join(__dirname, 'static', 'sim-lab', 'models'));
    this.addContextDependency(path.join(__dirname, 'src', 'lib', 'bw-sim'));
    // Use a fresh module graph on watch rebuilds so parser and catalog edits
    // take effect immediately.
    execFile(process.execPath, [generator], (error, stdout) => {
        if (error) return done(error);
        done(null, `export default ${stdout};\n`);
    });
};
