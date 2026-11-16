import {STRING_ARRAY_SETTINGS_PATH,STRING_ARRAY_SETTINGS_SOURCE} from './string-array-settings.generated.js';
/** Local Arcade source order, matching the pinned PXT root package and compiler:
 * config.files + testFiles; main.ts last, then _onCodeStop.ts last.
 * Generated resource factories are consumed by the image/tile readers instead.
 */
export function arcadeProjectSource(files) {
    const diagnostics = [];
    let config;
    try { config = files['pxt.json'] ? JSON.parse(files['pxt.json']) : null; }
    catch (error) { diagnostics.push(`Project pxt.json could not be read: ${error.message}`); }
    const extra = Object.keys(files).filter(name => name !== 'main.ts' && /\.ts$/.test(name) && !/\.g\.ts$/.test(name));
    let names = ['main.ts'];
    if (config?.files !== undefined) {
        if (!Array.isArray(config.files) || !config.files.every(name => typeof name === 'string') ||
            config.testFiles !== undefined && (!Array.isArray(config.testFiles) || !config.testFiles.every(name => typeof name === 'string'))) {
            diagnostics.push('Project files and testFiles must be lists of file names');
        } else names = [...new Set([...config.files, ...(config.testFiles || [])])];
    } else if (extra.length) {
        diagnostics.push(`Project source order requires pxt.json.files for supplemental code: ${extra.join(', ')}`);
    }
    const ordered = names.filter(name => name !== 'main.ts' && name !== '_onCodeStop.ts');
    if (names.includes('main.ts')) ordered.push('main.ts');
    if (names.includes('_onCodeStop.ts')) ordered.push('_onCodeStop.ts');
    const entries = [];
    for (const name of ordered) {
        if (!/\.(ts|asm|py)$/.test(name)) continue;
        if (config?.fileDependencies && Object.prototype.hasOwnProperty.call(config.fileDependencies, name)) {
            diagnostics.push(`Conditional project source ${JSON.stringify(name)} requires resolved package file dependencies`);continue;
        }
        if (typeof files[name] !== 'string') {
            diagnostics.push(`Missing declared project source file: ${JSON.stringify(name)}`);continue;
        }
        // Pinned PXT converts Python only for pyprj. In explicitly selected
        // block/TypeScript projects, retained Python attachments are not inputs
        // to its TypeScript compiler; this does not establish source equivalence.
        if (/\.py$/.test(name) && (config?.preferredEditor === 'blocksprj' || config?.preferredEditor === 'tsprj')) continue;
        // Exact owned helper contains only namespace function installation;
        // the native Settings adapter installs those same two functions.
        if(name===STRING_ARRAY_SETTINGS_PATH && files[name]===STRING_ARRAY_SETTINGS_SOURCE)continue;
        if (/\.g\.ts$/.test(name)) continue;
        if (/\.d\.ts$/.test(name) || !/\.ts$/.test(name)) {
            diagnostics.push(`Project source ${JSON.stringify(name)} requires ambient, assembly or Python translation support`);continue;
        }
        const source=files[name].startsWith(STRING_ARRAY_SETTINGS_SOURCE+'\n') ? files[name].slice(STRING_ARRAY_SETTINGS_SOURCE.length+1) : files[name];
        entries.push({name, source});
    }
    return {entries, source: entries.map(entry => entry.source).join('\n;\n'), diagnostics};
}
