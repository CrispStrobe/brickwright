import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import JSZip from 'jszip';
import {hasRuntime} from '../scripts/lib/pxt-node.mjs';
import {fixture as contextFixture} from './fixtures/conversion-context-catalogue.mjs';
import {readAssessmentTranscript} from '../scripts/private-assessment/read-stdio-transcript.mjs';
import {expandConversionObservationGraph} from '../scripts/lib/conversion-observation-codec.mjs';

// Ported from the parked Codex WIP (task F1 of docs/OPEN-TASKS-2026-09-29.md).
// The corpus itself is not in this repository; these are small inline fixtures.
const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'scripts/compat-audit.mjs');

// Catalogue parents are protected inputs. Keep every output in a fresh sibling.
async function withAuditOutput (fixture, operation) {
    const directory = fs.mkdtempSync(path.join(path.dirname(fixture.directory), 'conversion-audit-output-'));
    try {
        assert.equal(path.dirname(directory), path.dirname(fixture.directory));
        assert.notEqual(directory, fixture.directory);
        return await operation(directory);
    }
    finally {fs.rmSync(directory, {recursive: true, force: false});}
}

for (const expectedExit of [0, 1]) test(`stdout audit retains complete mixed-catalogue results and actual exit ${expectedExit}`,
    async () => contextFixture(async f => withAuditOutput(f, async outputDirectory => {
        const raw = f.raw(), context = f.context();context.id = raw.id;
        f.catalogue.subjects.push(raw, context);
        const catalogue = f.save(), positional = [];
        if (expectedExit === 1) {
            const zip = new JSZip();
            zip.file('project.json', JSON.stringify({targets: [{isStage: true, name: 'Stage',
                blocks: {x: {opcode: 'unknownwidget_doThing', next: null, parent: null, inputs: {}, fields: {}}},
                costumes: [], sounds: []}], extensions: ['unknownwidget'], extensionURLs: {}}));
            const input = path.join(f.directory, 'unsupported.sb3');
            fs.writeFileSync(input, await zip.generateAsync({type: 'nodebuffer'}));positional.push(input);
        }
        const common = ['--target', 'arcade', '--context-catalogue', catalogue, ...positional];
        const reportFile = path.join(outputDirectory, 'ordinary.json'), markdownFile = path.join(outputDirectory, 'ordinary.md');
        const journal = path.join(outputDirectory, 'ordinary.jsonl');
        const ordinary = spawnSync(process.execPath, [CLI, ...common, '--out', reportFile,
            '--markdown', markdownFile, '--progress-jsonl', journal], {cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 ** 2});
        assert.equal(ordinary.status, expectedExit, ordinary.stderr);
        for (const file of [reportFile, markdownFile, journal]) {
            assert.ok(fs.existsSync(file), 'ordinary mode actually produced ' + path.basename(file));
            assert.ok(fs.statSync(file).isFile() && fs.statSync(file).size > 0, 'ordinary artifact is a nonempty file');
        }
        const run = spawnSync(process.execPath, [CLI, ...common, '--stdio-transcript'],
            {cwd: ROOT, maxBuffer: 8 * 1024 ** 2});
        assert.equal(run.status, expectedExit, run.stderr.toString());
        const decoded = readAssessmentTranscript({transcript: run.stdout});
        assert.equal(decoded.terminal.intendedExitCode, run.status, 'actual child exit is joined separately');
        const report = JSON.parse(decoded.reportJson), original = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        assert.equal(report.count, expectedExit === 1 ? 3 : 2);
        // These are independent conversions: Creator gives blocks random IDs.
        // Retain and validate both full graphs, without normalizing their IDs or
        // claiming byte equality across runs. Wire byte preservation has its
        // own independently supplied payload controls.
        const diagnosticRows = rows => rows.map(({conversion, ...diagnostics}) => diagnostics);
        assert.deepEqual(diagnosticRows(report.rows), diagnosticRows(original.rows));
        for (const output of [report, original]) {
            const subjects = output.rows.filter(row => row.context);
            assert.equal(subjects.length, 2);
            for (const row of subjects) {
                assert.equal(row.translated, true);assert.equal(row.stage, 'translated');
                assert.deepEqual(row.unsupported, []);assert.ok(row.blockCount > 0);
                assert.equal(row.conversion.schema, 'brickwright/conversion-observation-graph/v2');
                const graph = expandConversionObservationGraph(row.conversion);
                assert.ok(graph.nodes.length > 0);assert.ok(Number.isInteger(graph.root.ref));
            }
        }
        assert.deepEqual(report.tally, original.tally);
        assert.equal(report.outputEncoding, 'gzip-json');
        assert.deepEqual(report.rows.filter(row => row.context?.id === raw.id).map(row => row.context.kind),
            ['RAW_BASELINE', 'RETAINED_CONTEXT']);
        const events = decoded.progressJsonl.trimEnd().split('\n').map(line => JSON.parse(line));
        assert.deepEqual(events.filter(row => row.phase === 'SUBJECT_BEGIN' && row.subject.id === raw.id)
            .map(row => [row.subject.kind, row.subject.id]), [['RAW_BASELINE', raw.id], ['RETAINED_CONTEXT', raw.id]]);
        assert.equal(events[0].phase, 'CLI_PROGRESS_BEGIN');assert.equal(events.at(-1).phase, 'CLI_REPORTS_FINISHED');
        assert.equal(decoded.markdown.toString().replace(report.generatedAt, '<generated-at>'),
            fs.readFileSync(markdownFile, 'utf8').replace(original.generatedAt, '<generated-at>'),
            'complete Markdown is retained; separate invocation timestamps differ');
        assert.match(run.stderr.toString(), /"count":/);
        assert.equal(JSON.parse(ordinary.stdout).report, reportFile, 'default stdout remains the ordinary summary');
        if (expectedExit === 1) assert.ok(report.rows.some(row => row.missingOpcodes?.some(op => op.opcode === 'unknownwidget_doThing')));
    })));

test('stdout audit rejects file-option conflicts before acquiring output', async () => contextFixture(f => withAuditOutput(f, outputDirectory => {
    f.catalogue.subjects.push(f.raw());const catalogue = f.save();
    for (const option of ['--out', '--markdown', '--progress-jsonl']) {
        const output = path.join(f.directory, 'protected');fs.writeFileSync(output, 'unchanged original');
        const run = spawnSync(process.execPath, [CLI, '--stdio-transcript', '--context-catalogue', catalogue, option, output],
            {cwd: ROOT, maxBuffer: 8 * 1024 ** 2});
        assert.notEqual(run.status, 0);assert.equal(run.stdout.length, 0);
        assert.match(run.stderr.toString(), /cannot be combined/);assert.equal(fs.readFileSync(output, 'utf8'), 'unchanged original');
    }
    const protectedJournal = path.join(f.directory, 'forbidden.jsonl');
    const report = path.join(outputDirectory, 'protected-report.json'), markdown = path.join(outputDirectory, 'protected-report.md');
    const collision = spawnSync(process.execPath, [CLI, '--context-catalogue', catalogue,
        '--out', report, '--markdown', markdown, '--progress-jsonl', protectedJournal],
        {cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 ** 2});
    assert.notEqual(collision.status, 0);assert.equal(collision.stdout, '');
    assert.match(collision.stderr, /Progress journal collides with input or report/);
    for (const file of [protectedJournal, report, markdown]) assert.equal(fs.existsSync(file), false, 'protected journal refusal acquires no output');
})));

test('CLI reports both a real MakeCode import and a missing Scratch extension opcode', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-compat-'));
    try {
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify({targets: [{isStage: true, name: 'Stage',
            blocks: {x: {opcode: 'unknownwidget_doThing', next: null, parent: null, inputs: {}, fields: {}}},
            costumes: [], sounds: []}], extensions: ['unknownwidget'], extensionURLs: {}}));
        fs.writeFileSync(path.join(dir, 'unknown.sb3'), await zip.generateAsync({type: 'nodebuffer'}));
        fs.copyFileSync(path.join(ROOT, 'test/fixtures/makecode/microbit-blocks.hex'),
            path.join(dir, 'microbit.hex'));
        const json = path.join(dir, 'audit.json');
        const md = path.join(dir, 'audit.md');
        const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI,
            '--out', json, '--markdown', md, '--corpus-commit', '1'.repeat(40), dir], {cwd: ROOT, encoding: 'utf8'});
        assert.equal(run.status, 1, run.stderr);
        const report = JSON.parse(fs.readFileSync(json, 'utf8'));
        assert.equal(report.count, 2);
        assert.equal(report.provenance.corpus.declaredCommit, '1'.repeat(40));
        assert.equal(report.provenance.corpus.commitVerified, false);
        assert.match(report.provenance.source.commit, /^[a-f0-9]{40}$/);
        assert.match(report.provenance.corpus.contentMultisetSha256, /^[a-f0-9]{64}$/);
        assert.ok(report.provenance.vendorPins['sb3-creator']);
        assert.deepEqual(report.gapRanking.find(g => g.family === 'scratch: unknownwidget_doThing'),
            {family: 'scratch: unknownwidget_doThing', affectedProjects: 1, occurrences: 1});
        assert.ok(!fs.readFileSync(md, 'utf8').includes(dir));
        assert.ok(report.rows.some(r => r.target === 'microbit' && r.translated));
        assert.deepEqual(report.rows.find(r => r.format === 'sb3').missingOpcodes.map(x => x.opcode),
            ['unknownwidget_doThing']);
        assert.match(fs.readFileSync(md, 'utf8'), /unknownwidget_doThing/);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('CLI distinguishes authored empty branches from named warnings for untranslated bodies', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-compat-warnings-'));
    try {
        for (const [name, source, expected] of [
            ['authored', 'if (0) {\n}\nlet x = 1\n', 'translated'],
            ['untranslated', 'if (0) {\n    unknownCall()\n}\nlet x = 1\n', 'partial']
        ]) {
            const input = path.join(dir, name + '.ts'), json = path.join(dir, name + '.json');
            fs.writeFileSync(input, source);
            const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI,
                '--target', 'arcade', '--out', json, input], {cwd: ROOT, encoding: 'utf8'});
            assert.equal(run.status, 0, run.stderr);
            const row = JSON.parse(fs.readFileSync(json, 'utf8')).rows[0];
            assert.equal(row.stage, expected);
            assert.equal(row.staticTranslation.status, expected);
            assert.ok(row.blockCount > 0);
            if (name === 'untranslated') {
                assert.ok(row.unsupported.some(gap => gap.includes('unknownCall')));
                assert.ok(row.unsupported.some(gap => gap.includes('Code to Blocks:') && gap.includes('Empty body')));
            } else assert.deepEqual(row.unsupported, []);
            assert.equal(row.qualification.behavioralEquivalence, 'not-measured');
        }
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('compiled audit separates PXT compile failures from Brickwright gaps',
    {skip: hasRuntime('arcade') ? false : 'MakeCode runtime not synced (npm run sync:makecode) — pxt compiler absent'}, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-compat-invalid-source-'));
    try {
        const source = path.join(dir, 'invalid.ts');
        fs.writeFileSync(source, 'let sprite = sprites.create(img`1`)\nsprite.onOverlap(function () {})\n');
        const json = path.join(dir, 'audit.json');
        const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI,
            '--target', 'arcade', '--compile', '--out', json, source],
        {cwd: ROOT, encoding: 'utf8', timeout: 60000});
        assert.equal(run.status, 0, run.stderr);
        const row = JSON.parse(fs.readFileSync(json, 'utf8')).rows[0];
        assert.equal(row.stage, 'pxt-compile-failed');
        assert.equal(row.compile.status, 'fail');
        assert.ok(row.compile.diagnostics.some(diagnostic => diagnostic.includes('onOverlap')));
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('executed audit runs an Arcade import with its imported artwork, as the importer GUI does', () => {
    // Without the importer's costumes every Arcade image read failed in the
    // VM ("cannot read this sprite artwork"): the run measured the harness,
    // not the game. 22 of the 89 translated corpus games failed that way.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-compat-execute-'));
    try {
        const source = path.join(dir, 'paint.ts');
        fs.writeFileSync(source, `let hero = sprites.create(img\`
    . . 2 2 . .
    . 2 2 2 2 .
    . . 2 2 . .
\`, SpriteKind.Player)
hero.image.fill(5)
`);
        const json = path.join(dir, 'audit.json');
        const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI,
            '--target', 'arcade', '--execute', '--out', json, source],
        {cwd: ROOT, encoding: 'utf8', timeout: 120000});
        assert.equal(run.status, 0, run.stderr);
        const row = JSON.parse(fs.readFileSync(json, 'utf8')).rows[0];
        assert.equal(row.stage, 'translated', JSON.stringify(row.unsupported));
        assert.deepEqual(row.execution.errors, []);
        assert.equal(row.execution.status, 'stepped');
        assert.equal(row.qualification.behavioralEquivalence, 'not-measured');
        assert.equal(row.qualification.staticTranslation, 'translated');
        assert.equal(row.qualification.originalCompile, 'not-requested');
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});


test('executed audit stops a program that exceeds its per-input budget and records a timeout', () => {
    // A program that never returns cannot be interrupted from inside the audit
    // process, so each execution runs in a child under a watchdog. A 1 ms
    // budget is shorter than any child start-up, which makes this deterministic.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-compat-timeout-'));
    try {
        const source = path.join(dir, 'tiny.ts');
        fs.writeFileSync(source, 'let n = 0\nn += 1\n');
        const json = path.join(dir, 'audit.json');
        const started = Date.now();
        const run = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI,
            '--target', 'arcade', '--execute', '--execute-timeout-ms', '1', '--out', json, source],
        {cwd: ROOT, encoding: 'utf8', timeout: 120000});
        assert.ok(Date.now() - started < 100000, 'the audit itself finished');
        const row = JSON.parse(fs.readFileSync(json, 'utf8')).rows[0];
        assert.equal(row.execution.status, 'timeout');
        assert.equal(row.execution.timeoutMs, 1);
        assert.equal(row.qualification.runtimeSmoke, 'timeout');
        assert.notEqual(run.status, null, run.stderr);
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('executed audit rejects a non-positive execution budget', () => {
    const run = spawnSync(process.execPath, [CLI, '--target', 'arcade', '--execute-timeout-ms', '0', '--execute', os.tmpdir()],
        {cwd: ROOT, encoding: 'utf8', timeout: 60000});
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /--execute-timeout-ms requires a positive integer/);
});

test('audit directory discovers native mkcd and pxt projects with their complete file maps', async () => {
    const {makeCodeProjectFile} = await import('../overlay/scratch-gui/src/lib/bw-makecode/project-file.js');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bw-native-audit-'));
    try {
        const files={'main.ts':'let value=17','pxt.json':JSON.stringify({name:'Native',dependencies:{device:'*'},files:['main.ts']})};
        for(const ext of ['mkcd','pxt'])fs.writeFileSync(path.join(dir,'native.'+ext),makeCodeProjectFile(files,{target:'arcade'}));
        const out=path.join(dir,'audit.json');
        const result=spawnSync(process.execPath,[CLI,'--target','arcade','--out',out,dir],{cwd:ROOT,encoding:'utf8',timeout:60000});
        assert.equal(result.status,0,result.stderr);
        const report=JSON.parse(fs.readFileSync(out,'utf8'));
        assert.equal(report.count,2);
        for(const row of report.rows){assert.equal(row.target,'arcade');assert.equal(row.stage,'translated');assert.equal(row.sourceRecovered,true);}
    } finally {fs.rmSync(dir,{recursive:true,force:true});}
});


test('native-project audit reports missing offline extension inputs separately from original compiler errors',
    {skip: hasRuntime('arcade') ? false : 'MakeCode runtime not synced (npm run sync:makecode) — pxt compiler absent'},async()=>{
    const {makeCodeProjectFile}=await import('../overlay/scratch-gui/src/lib/bw-makecode/project-file.js');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bw-extension-audit-'));
    try{
        const input=path.join(dir,'external.mkcd'),out=path.join(dir,'audit.json');
        const dependency='github:example/absent-offline-package';
        fs.writeFileSync(input,makeCodeProjectFile({'main.ts':'let value=17','pxt.json':JSON.stringify({name:'External',dependencies:{device:'*',external:dependency},files:['main.ts']})},{target:'arcade'}));
        const result=spawnSync(process.execPath,[CLI,'--target','arcade','--compile','--out',out,input],{cwd:ROOT,encoding:'utf8',timeout:60000});
        assert.equal(result.status,0,result.stderr);
        const row=JSON.parse(fs.readFileSync(out,'utf8')).rows[0];
        assert.equal(row.compile.status,'unavailable');assert.equal(row.compile.code,'NO_EXTENSION');
        assert.ok(row.compile.extensions.some(extension=>extension.includes(dependency)));
        assert.notEqual(row.stage,'pxt-compile-failed');
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('extension fetching is an explicit compiled audit policy', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-audit-fetch-policy-'));
    try {
        const source = path.join(dir, 'plain.ts'), out = path.join(dir, 'audit.json');
        fs.writeFileSync(source, 'let value = 3');
        const rejected = spawnSync(process.execPath, [CLI, '--fetch-extensions', source], {cwd: ROOT, encoding: 'utf8'});
        assert.notEqual(rejected.status, 0);
        assert.match(rejected.stderr, /requires --compile/);
        const result = spawnSync(process.execPath, [CLI, '--out', out, source], {cwd: ROOT, encoding: 'utf8'});
        assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).compilerPolicy.extensionFetching, 'offline');
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
