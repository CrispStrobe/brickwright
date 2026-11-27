// Bounded reader evidence, not a full Creator/VM/browser qualification.
// Read exact source from the repository checkout and verify its pinned hashes.
// Remove only import/export syntax to exercise its actual Tokenizer -> Parser ->
// Translator classes with the real scratchruntime helpers. Application wrappers,
// board-specific routing, Creator and VM execution are outside this probe.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const options = {
    // Final repository location: scripts/probes/code-runtime/conversion/.
    'source-root': path.resolve(__dirname, '../../../..'),
    output: path.join(__dirname, 'results-rerun.json'),
    python: 'python3'
};
for (const argument of process.argv.slice(2)) {
    const match = /^--(source-root|output|python)=(.+)$/.exec(argument);
    if (!match) throw new Error('Expected --source-root=PATH, --output=PATH or --python=EXECUTABLE');
    options[match[1]] = match[2];
}
const sourceRoot = path.resolve(options['source-root']);
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'metadata.json'), 'utf8'));
const sha256 = content => crypto.createHash('sha256').update(content).digest('hex');
const gitBlob = content => crypto.createHash('sha1')
    .update('blob ' + Buffer.byteLength(content) + '\0').update(content).digest('hex');
const sources = meta.sources.map(source => {
    const content = fs.readFileSync(path.join(sourceRoot, source.path), 'utf8');
    if (gitBlob(content) !== source.blobSha) throw new Error('Git blob mismatch: ' + source.path);
    if (sha256(content) !== source.sha256) throw new Error('SHA-256 mismatch: ' + source.path);
    return {...source, content};
});
const helperBody = sources[1].content.replace(/^export /gm, '');
const helpers = new Function(helperBody +
    '\nreturn {scratchCallToPseudo, arraysCallToPseudo, stripSpritePrefix, unq, sanitizeIdent};')();
const readerBody = sources[0].content.replace(/^import .*;\r?\n/gm, '')
    .replace('export default function pythonToPseudocode', 'function pythonToPseudocode')
    .replace(/^export \{ Translator, Tokenizer, Parser \};$/m, '');
const {Tokenizer, Parser, Translator} = new Function(...Object.keys(helpers), readerBody +
    '\nreturn {Tokenizer,Parser,Translator};')(...Object.values(helpers));
const report = {
    schema: 1,
    createdAt: new Date().toISOString(),
    repo: meta.repo,
    ref: meta.ref,
    environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        python: cp.execFileSync(options.python, ['--version'], {encoding: 'utf8'}).trim()
    },
    scope: 'Actual pinned reader Tokenizer -> Parser -> Translator plus actual scratchruntime helpers. No Creator, Scratch VM, Code tab, browser, board-specific routing, or game runtime was exercised.',
    sourceLoading: 'Source is read from the checkout and its Git blob and SHA-256 hashes are verified. ES module import/export declarations are removed only for isolated class loading; method bodies remain unchanged. No replacement parser/translator or mocked scratchruntime helpers.',
    sources: sources.map(({content, ...source}) => source),
    fixtures: []
};
for (const item of meta.fixtures) {
    const code = fs.readFileSync(path.join(__dirname, item.path), 'utf8');
    const native = cp.spawnSync(options.python, ['-I', '-c', code], {
        encoding: 'utf8', timeout: 2000, maxBuffer: 1024 * 1024
    });
    const row = {
        id: item.id,
        code,
        codeSha256: sha256(code),
        native: {
            stdout: native.stdout,
            stderr: native.stderr,
            status: native.status,
            error: native.error ? String(native.error) : null,
            expectedStdout: item.expectedNativeStdout,
            matched: native.status === 0 && native.stdout === item.expectedNativeStdout
        }
    };
    try {
        const tokens = new Tokenizer(code).tokenize();
        const ast = new Parser(tokens).parseProgram();
        const translator = new Translator();
        const pseudocode = translator.program(ast);
        row.reader = {pseudocode, warnings: translator.warnings};
    } catch (error) {
        row.reader = {error: String(error?.stack || error)};
    }
    report.fixtures.push(row);
}
fs.writeFileSync(path.resolve(options.output), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({
    fixtures: report.fixtures.length,
    nativePassed: report.fixtures.filter(row => row.native.matched).length,
    results: report.fixtures.map(row => ({id: row.id, native: row.native.stdout, reader: row.reader}))
}, null, 2) + '\n');
if (report.fixtures.some(row => !row.native.matched || row.reader.error)) process.exitCode = 1;
