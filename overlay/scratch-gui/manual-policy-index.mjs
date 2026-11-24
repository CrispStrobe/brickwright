// SPDX-License-Identifier: BSD-3-Clause
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {MODELS} from './src/lib/bw-sim/sim-session.js';
import {EXPERIMENTAL_MODELS} from './src/lib/bw-sim/model/experimental-models.js';
import {parseModel} from './src/lib/bw-sim/model/ldraw-model.js';
import {createManualPolicyResolver, manualAssemblyDigest} from './src/components/tw-pseudocode/sim-lab-manual-policy.js';

export const buildManualPolicyIndex = (models = [...MODELS, ...EXPERIMENTAL_MODELS], read = file =>
    readFileSync(new URL(`./static/sim-lab/models/${file}`, import.meta.url), 'utf8')) => {
    const files = new Set(models.filter(entry => entry.manualJog !== undefined).map(entry => entry.file));
    const referenceDigests = Object.fromEntries([...files].map(file => {
        const {model, refusals} = parseModel(read(file));
        const digest = refusals.length ? null : manualAssemblyDigest(model);
        if (!digest) throw new Error(`Could not read manual policy reference ${file}`);
        return [file, digest];
    }));
    // Refuse conflicts before shipping the app.
    createManualPolicyResolver({models, referenceDigests});
    return referenceDigests;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.stdout.write(JSON.stringify(buildManualPolicyIndex()));
}
