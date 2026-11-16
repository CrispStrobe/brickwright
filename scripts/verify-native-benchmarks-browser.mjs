#!/usr/bin/env node
// Focused production bundle of the shipped React panel and actual pinned native
// engine. This is native browser execution, not a full installed Lite proof,
// CLI replay, benchmark comparison, or performance measurement.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, join, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.NATIVE_BENCHMARK_EVIDENCE;
if (!out) throw Error('NATIVE_BENCHMARK_EVIDENCE must name an owned output directory');
const artifacts = resolve(out), build = join(artifacts, 'bundle');
await mkdir(build, {recursive: true});
const gui = createRequire(join(root, 'packages/scratch-gui/package.json'));
const webpack = gui('webpack');
const panel = join(root, 'overlay/scratch-gui/src/components/menu-bar/native-benchmarks.jsx');
const entry = join(build, 'entry.js');
await writeFile(entry, `import React from ${JSON.stringify(gui.resolve('react'))};
import ReactDOM from ${JSON.stringify(gui.resolve('react-dom'))};
import Panel from ${JSON.stringify(panel)};
ReactDOM.render(React.createElement(Panel), document.getElementById('app'));
document.getElementById('open').onclick=()=>window.dispatchEvent(new Event('bw-open-native-benchmarks'));
`);
await new Promise((done, fail) => webpack({mode: 'production', devtool: false, entry,
    output: {path: build, filename: 'panel.js', publicPath: '/'},
    optimization: {minimize: false},
    resolve: {modules: [join(root, 'packages/scratch-gui/node_modules'), join(root, 'node_modules')]},
    module: {rules: [
        {test: /\.jsx$/, use: {loader: gui.resolve('babel-loader'), options: {babelrc: false, configFile: false,
            presets: [gui.resolve('@babel/preset-react')]}}},
        {test: /\.css$/, use: [gui.resolve('style-loader'), {loader: gui.resolve('css-loader'), options: {modules: true}}]}
    ]}}, (error, stats) => {
    if (error) fail(error); else if (stats.hasErrors()) fail(Error(stats.toString({all: false, errors: true})));
    else done();
}));
await writeFile(join(build, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Native benchmark panel proof</title><button id="open">Benchmarks (native i80386)…</button><div id="app"></div><script src="/panel.js"></script>');
const server = createServer(async (req, res) => {
    try {
        const path = new URL(req.url, 'http://localhost').pathname;
        const file = join(build, path === '/' ? 'index.html' : path);
        if (!file.startsWith(build + '/')) throw Error('path');
        const bytes = await readFile(file);
        res.setHeader('content-type', extname(file) === '.html' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8'); res.end(bytes);
    } catch {res.writeHead(404); res.end();}
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser, page;
const errors = [];
try {
    browser = await chromium.launch({headless: true, args: ['--disable-dev-shm-usage', '--renderer-process-limit=1']});
    page = await browser.newPage({viewport: {width: 1200, height: 1000}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole('button', {name: 'Benchmarks (native i80386)…', exact: true}).click();
    const status = page.getByTestId('native-benchmark-status');
    await page.getByTestId('native-benchmark-fetch').click();
    await status.filter({hasText: /^Ready/}).waitFor({timeout: 60000});
    if (!(await page.getByTestId('native-benchmark-license').textContent()).includes('Permission')) throw Error('license not displayed');
    await page.getByTestId('native-benchmark-run').click();
    await status.filter({hasText: /^Running native i80386/}).waitFor();
    await page.getByTestId('native-benchmark-stop').click();
    if (!(await status.textContent()).startsWith('Stopped')) throw Error('Stop did not settle status');
    const stopped = await page.getByTestId('native-benchmark-screen').textContent();
    const stoppedRetired = Number((await page.getByTestId('native-benchmark-output').textContent()).match(/Retired instructions: (\d+)/)?.[1]);
    if (!(stoppedRetired > 0)) throw Error('Stop control did not observe real native progress');
    await page.waitForTimeout(100);
    if (!(await status.textContent()).startsWith('Stopped')) throw Error('stale native completion after Stop');
    await page.getByTestId('native-benchmark-run').click();
    await status.filter({hasText: /^Complete/}).waitFor({timeout: 120000});
    const result = JSON.parse(await page.getByTestId('native-benchmark-result').textContent());
    if (!result.accepted || result.backend !== 'ExperimentalI80386ATMachine' || result.retired < 2000000 ||
        result.exitCode !== 4 || !result.terminated || result.unsupported.length || !result.videoQueriesValid ||
        !result.screen.some(row => row.startsWith('Score:'))) throw Error('actual native terminal predicates failed');
    await page.screenshot({path: join(artifacts, 'native-topbench.png'), fullPage: true});
    const terminalStatus = await status.textContent();
    await page.getByTestId('native-benchmark-project').selectOption('whetstone');
    await page.getByTestId('native-benchmark-fetch').click();
    await status.filter({hasText: /^Ready/}).waitFor({timeout: 60000});
    const whetstoneNotice = await page.getByTestId('native-benchmark-license').textContent();
    if (!whetstoneNotice.includes('This product includes software developed by the University of California, Berkeley and its contributors.') ||
        !whetstoneNotice.includes('GCC RUNTIME LIBRARY EXCEPTION')) throw Error('runtime notices incomplete');
    await page.locator('details[open]').evaluateAll(nodes => {for (const node of nodes) node.open = false;});
    await page.getByTestId('native-benchmark-run').click();
    await status.filter({hasText: /^Complete/}).waitFor({timeout: 120000});
    const whetstone = JSON.parse(await page.getByTestId('native-benchmark-result').textContent());
    if (!whetstone.accepted || whetstone.exitCode !== 0 || whetstone.retired < 20000000 ||
        whetstone.backend !== 'ExperimentalI80386ATMachine' || !whetstone.terminated ||
        whetstone.unsupported.length || !whetstone.whetstone?.valid || !whetstone.whetstone.modulesValid ||
        whetstone.imageSha256 !== 'f7003e37da058b1a41b8520b010c9791aafa10fa8a9cb11a4c0998055936b8ac' ||
        !(await page.getByTestId('native-benchmark-stdout').textContent()).includes('C Converted Double Precision Whetstones:'))
        throw Error('actual native Whetstone validation predicates failed');
    await page.screenshot({path: join(artifacts, 'native-whetstone.png'), fullPage: true});
    if (errors.length) throw Error(errors.join('; '));
    const sha = bytes => createHash('sha256').update(bytes).digest('hex');
    const pins = JSON.parse(await readFile(join(root, 'vendor-pins.json')));
    const receipt = {schema: 'brickwright.native-benchmark-browser.v1',
        scope: 'focused production bundle of shipped panel with actual native engine; no full-app or performance claim',
        head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
        bwBoardCommit: pins['bw-board'], sourceSha256: sha(await readFile(panel)),
        runtimeSha256: Object.fromEntries(await Promise.all(['experimental/i80386-at-machine.js', 'experimental/i80386.js', 'i8086-dos.js'].map(async name =>
            [name, sha(await readFile(gui.resolve('bw-board/' + name)))]))),
        stoppedRetired, stoppedNativeScreenObserved: typeof stopped === 'string', terminalStatus, actualNativeResult: result,
        actualNativeWhetstone: whetstone,
        errors};
    await writeFile(join(artifacts, 'browser.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(`PASS actual browser native TOPBENCH: ${result.retired} retired instructions, exit4, complete screen; Stop and actual Whetstone ${whetstone.retired} retired/exit0/numeric validation verified`);
} catch (error) {
    // Preserve the actual rendered failure before teardown, without replacing
    // the original assertion or turning a failed launch into native evidence.
    if (page && !page.isClosed()) {
        try {
            await writeFile(join(artifacts, 'failure.html'), await page.content());
            await page.screenshot({path: join(artifacts, 'failure.png'), fullPage: true});
            await writeFile(join(artifacts, 'failure.json'), JSON.stringify({
                message: error.message, title: await page.title(), errors,
                status: await page.getByTestId('native-benchmark-status').textContent({timeout: 1000}).catch(() => null)
            }, null, 2) + '\n');
        } catch (captureError) {console.error(`Failure capture: ${captureError.message}`);}
    }
    throw error;
} finally {await browser?.close(); await new Promise(done => server.close(done));}
