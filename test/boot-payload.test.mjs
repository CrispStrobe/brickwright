import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('boot payload accepts shared lazy engine bytes but rejects eager, absent and map-only markers', () => {
    const build = mkdtempSync(join(tmpdir(), 'boot-payload-'));
    const marker = 'no RAM, ROM, VIA or ACIA on the board';
    const three = 'THREE.WebGLRenderer: WebGL 1 is not supported since r163.';
    const put = (name, text) => writeFileSync(join(build, name), text);
    const run = () => spawnSync(process.execPath, [resolve('scripts/verify-boot-payload.mjs')], {
        env: {...process.env, BW_BUILD: build}, encoding: 'utf8'
    });
    try {
        mkdirSync(join(build, 'chunks'));
        put('index.html', '<script src="gui.js"></script>');
        put('gui.js', '_bwFontWait');
        for (const [name, bytes] of Object.entries({
            'ext-music': "'drums/1-snare.mp3'", 'render-fonts': 'x-font-ttf',
            'ext-legonxt': 'ID: legonxt', 'ext-spikeprime': 'ID: spikeprime\n',
            'ext-arcade': 'font12: Adobe SIL OFL 1.1 Arcade phase work budget must be finite and positive',
            'ext-circuitplayground': 'ID: circuitplayground',
            'ext-robotlab': 'when part [PART] touches [OTHER]',
            'bw-robotlab-tab': 'Open the Robot Lab here',
            'about-apps': 'about-app-showcase', 'bw-project-safety': 'data-bw-error-notes', 'bw-history-panel': 'bw-autosave-confirm-restore',
            'bw-extension-menus': '"spikeprime_motorRunFor": {"PORT":"+MULTIPLE_PORT"}',
            'asset-library-index': '"name":"Abby"',
            // bw-circuit-ui since its lazy part art: the named entry holds the art map, the designer's
            // code a shared anonymous lazy chunk requested beside it.
            'bw-circuit-ui': 'part-art context map',
            '37071.hash': 'Check the address decode wiring on the breadboard. Bus-Extraktor fehlgeschlagen:  Could not recognise this file',
            'bw-circuit-panels': 'bw-circuit-panel-header',
            'bw-board': 'entry', 'guided-lessons': 'optional', '8933.hash': marker,
            // The arena's 3D view: its own chunk, three in a shared lazy chunk, and the arena pane's chunk without either.
            'bw-arena-3d': 'bw-spike-arena-3d-canvas', '1380.hash': three, 'bw-spike-simulator': 'the 2D arena pane',
            // The Sim Lab: its own chunk (the view's canvas id), Jolt in its own (shared) lazy chunk,
            // the physics worker in its own; the Sim Lab chunk carries neither.
            // The Robot Lab's Scratch Link doubles (BLE socket double, BT-classic registry) ride in it too.
            'bw-sim-lab': 'bw-sim-lab-3d-canvas bw-sim-part-thumbnails bw-sim-instructions-canvas Kugelrad-Halter ' +
                'the virtual chooser refused this peripheral a virtual peripheral needs an id', 'bw-sim-jolt': 'JoltInterface_GetPhysicsSystem_',
            'bw-sim-physics-worker': 'sim batch before sim load',
            // The Robot Lab editor (pane and toolbar): its own tab's chunk, not the arena pane's.
            'bw-robot-lab': 'bw-sim-lab-toolbar',
            // The part catalogue: the core in the Sim Lab chunk (above), the derived parts in their own.
            'bw-sim-parts': 'Technic-Stein 1 x 1 mit Loch'
        })) put(`chunks/${name}.js`, bytes);
        let result = run();
        assert.equal(result.status, 0, result.stdout + result.stderr);
        put('gui.js', '_bwFontWait ID: circuitplayground');
        result=run();assert.equal(result.status,1);
        assert.match(result.stdout,/FAIL Circuit Playground runtime .*not in the first load/);
        put('gui.js', '_bwFontWait Bus-Extraktor fehlgeschlagen: x');
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL German DRC texts .*not in the first load/);
        put('gui.js', `_bwFontWait ${marker}`);
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL 6502 bus extractor .*not in the first load/);
        put('gui.js', '_bwFontWait');
        put('chunks/8933.hash.js', 'absent');
        assert.equal(run().status, 1);
        put('chunks/8933.hash.js.map', marker);
        assert.equal(run().status, 1, 'source maps must not provide the positive control');
        put('chunks/8933.hash.js', marker);
        put('index.html', '<script src="gui.js"></script><script src="chunks/8933.hash.js"></script>');
        assert.equal(run().status, 1, 'HTML-loaded shared chunks are eager');
        put('index.html', '<script src="gui.js"></script><link rel="preload" as="script" href="chunks/8933.hash.js">');
        assert.equal(run().status, 1, 'shared payload preload links also refuse');
        put('index.html', '<script src="gui.js"></script>');
        rmSync(join(build, 'chunks/bw-board.js'));
        assert.equal(run().status, 1, 'the named entry chunk is still required');
        put('chunks/bw-board.js', 'entry');
        assert.equal(run().status, 0, 'restored');
        // three.js belongs to the 3D view, not to the arena pane that offers it.
        put('chunks/bw-spike-simulator.js', `the 2D arena pane ${three}`);
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL three\.js .* are not in chunks\/bw-spike-simulator\*\.js/);
        rmSync(join(build, 'chunks/bw-spike-simulator.js'));
        result = run();
        assert.equal(result.status, 1, 'no arena chunk to inspect is a failure, not a vacuous pass');
        assert.match(result.stdout, /FAIL .*no chunks\/bw-spike-simulator\*\.js to inspect/);
        put('chunks/bw-spike-simulator.js', 'the 2D arena pane');
        put('chunks/1380.hash.js', 'renamed');
        assert.equal(run().status, 1, 'three\'s marker must be found in lazy JS');
        put('chunks/1380.hash.js', three);
        assert.equal(run().status, 0, 'restored');
        // Jolt belongs to the worker (and the no-worker fallback), not to the Sim Lab's main chunk.
        put('chunks/bw-sim-lab.js', 'bw-sim-lab-3d-canvas bw-sim-part-thumbnails Kugelrad-Halter JoltInterface_GetPhysicsSystem_');
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL Jolt physics .* are not in chunks\/bw-sim-lab\*\.js/);
        // The whole catalogue bundled with the Sim Lab again (the derived parts' marker in its chunk): refused.
        put('chunks/bw-sim-lab.js', 'bw-sim-lab-3d-canvas bw-sim-part-thumbnails bw-sim-instructions-canvas Kugelrad-Halter Technic-Stein 1 x 1 mit Loch');
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL the Robot Lab catalogue's derived parts are not in chunks\/bw-sim-lab\*\.js/);
        // The core missing from the Sim Lab chunk, or repeated in the derived chunk: refused.
        put('chunks/bw-sim-lab.js', 'bw-sim-lab-3d-canvas bw-sim-part-thumbnails bw-sim-instructions-canvas');
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL the marker for the Robot Lab catalogue's core parts still discriminates/);
        put('chunks/bw-sim-lab.js', 'bw-sim-lab-3d-canvas bw-sim-part-thumbnails bw-sim-instructions-canvas Kugelrad-Halter ' +
            'the virtual chooser refused this peripheral a virtual peripheral needs an id');
        put('chunks/bw-sim-parts.js', 'Technic-Stein 1 x 1 mit Loch Kugelrad-Halter');
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL the Robot Lab catalogue's core parts are not in chunks\/bw-sim-parts\*\.js/);
        put('chunks/bw-sim-parts.js', 'Technic-Stein 1 x 1 mit Loch');
        assert.equal(run().status, 0, 'restored');
        // The Robot Lab's Scratch Link BLE double imported at boot again (render-gui.jsx): refused.
        put('gui.js', '_bwFontWait the virtual chooser refused this peripheral');
        result = run();
        assert.equal(result.status, 1);
        assert.match(result.stdout, /FAIL the Scratch Link BLE double .*not in the first load/);
        put('gui.js', '_bwFontWait');
        assert.equal(run().status, 0, 'restored');
        put('chunks/bw-sim-lab.js', 'bw-sim-lab-3d-canvas bw-sim-part-thumbnails Kugelrad-Halter');
        rmSync(join(build, 'chunks/bw-sim-physics-worker.js'));
        result = run();
        assert.equal(result.status, 1, 'the worker\'s own chunk is required');
        assert.match(result.stdout, /FAIL the Sim Lab physics worker have their own chunk/);
    } finally {rmSync(build, {recursive: true, force: true});}
});

test('3D and physics isolation checks name the simulator and Sim Lab chunks the GUI actually imports', () => {
    const gui = readFileSync('overlay/scratch-gui/src/components/gui/gui.jsx', 'utf8');
    const script = readFileSync('scripts/verify-boot-payload.mjs', 'utf8');
    const name = gui.match(/webpackChunkName: "([^"]+)" \*\/ '\.\.\/tw-pseudocode\/spike-simulator-pane\.jsx'/)?.[1];
    assert.equal(name, 'bw-spike-simulator');
    // three.js, the arena 3D view, Jolt, the physics worker, the Robot Lab editor, the Sim Lab view,
    // its palette thumbnails, its building instructions and both pieces of its part catalogue: all ten
    // stay out of the simulator pane's chunk.
    assert.equal(script.match(new RegExp(`notInChunks: \\[(?:'[^']+', )*'${name}'`, 'g'))?.length, 10,
        'three.js, the arena 3D view, Jolt, the physics worker, the Robot Lab editor, the Sim Lab view, its palette thumbnails, its building instructions and both catalogue pieces must all be excluded from the actual simulator chunk');
    // The Robot Lab editor is the chunk its own tab lazily imports.
    const tab = readFileSync('overlay/scratch-gui/src/components/tw-pseudocode/robot-lab-tab.jsx', 'utf8');
    assert.equal(tab.match(/webpackChunkName: "([^"]+)" \*\/ '\.\/sim-lab-pane\.jsx'/)?.[1], 'bw-robot-lab');
    // Jolt and the physics worker also stay out of the Sim Lab's own main-thread chunk.
    const pane = readFileSync('overlay/scratch-gui/src/components/tw-pseudocode/sim-lab-pane.jsx', 'utf8');
    assert.equal(pane.match(/webpackChunkName: "([^"]+)" \*\/ '\.\.\/\.\.\/lib\/bw-sim\/sim-lab\.js'/)?.[1], 'bw-sim-lab');
    assert.equal(script.match(/notInChunks: \[(?:'[^']+', )*'bw-sim-lab'/g)?.length, 3,
        'Jolt, the physics worker and the catalogue\'s derived parts must be excluded from the Sim Lab\'s main-thread chunk');
    // The derived parts' chunk is the one sim-lab.js imports them as, and it does not repeat the core.
    const lab = readFileSync('overlay/scratch-gui/src/lib/bw-sim/sim-lab.js', 'utf8');
    assert.equal(lab.match(/webpackChunkName: "([^"]+)" \*\/ '\.\/part-meta\/parts\.json\?derived'/)?.[1], 'bw-sim-parts');
    assert.equal(script.match(/notInChunks: \[(?:'[^']+', )*'bw-sim-parts'/g)?.length, 1, 'the core parts are excluded from the derived chunk');
});
