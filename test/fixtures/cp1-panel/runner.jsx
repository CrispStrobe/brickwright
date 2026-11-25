// SPDX-License-Identifier: BSD-3-Clause
// Browser shell only. All CPU, circuit, input and project behavior is imported
// from the owned product implementations; this fixture has no emulation loop.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {mount} from '@cp1-react-root';
import JSZip from 'jszip';
import {BoardImpl, inferNetlist, checkWiring, registerAllDevices, getDevice,
    extractCp1Machine} from 'bw-board';
import '@cp1-cui-sidecars';
import {setEngine} from '@cp1-cui-engine';
import {CircuitDesigner} from '@cp1-circuit-designer';
import Cp1Host from '@cp1-host';
import {createDebugRunner} from '@cp1-runner';
import {attachBrickwrightState} from '@cp1-project-bundle';
import loadProjectFile from '@cp1-project-load';
import {circuit} from './synthetic-circuit.mjs';

registerAllDevices();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice, extractCp1Machine});
const project = {device: 'kosmos-cp1', clock: 6000000, pins: []};
const root = mount(document.querySelector('#app'));
const h = window.__cp1Integration = {compilerCalls: 0, vmProjectLoads: 0, loadedEvents: [], restore: null};
const scratchProject = {targets: [{isStage: true, name: 'Stage', blocks: {},
    costumes: [], sounds: []}], meta: {semver: '3.0.0'}};

function App () {
    const [runner, setRunner] = useState(null);
    const [state, setState] = useState({phase: 'idle'});
    const [configuration, setConfiguration] = useState({partId: 'trainer', expansion: false, clockHz: 6000000});
    const [notice, setNotice] = useState('');
    const [circuitData, setCircuitData] = useState(circuit);
    const [gallery, setGallery] = useState(null);
    const board = useRef(null);
    const current = useRef(null);
    const config = useRef(configuration);
    const media = useRef(null);
    const circuitModel = useRef(null);
    const vm = useRef({runtime: {stc: project, targets: [], on () {}, off () {}, emit () {}, glowBlock () {}},
        toJSON () { h.compilerCalls++; throw new Error('CP1 must not compile Scratch blocks'); },
        // Minimal VM delegate: validate the fixture archive and record the
        // production loader's call. This does not claim full Scratch VM loading.
        async loadProject (bytes) {
            const zip = await JSZip.loadAsync(bytes);
            const entry = zip.file('project.json');
            if (!entry || !Array.isArray(JSON.parse(await entry.async('string')).targets)) {
                throw new Error('Fixture Scratch project is invalid');
            }
            h.vmProjectLoads++;
        }});
    const onBoardReady = useCallback(next => {
        board.current = next;
        vm.current.runtime.circuitBoard = next;
    }, []);
    const destroyRunner = () => {
        current.current?.destroy();
        current.current = null;
        setRunner(null);
        setState({phase: 'idle'});
    };
    const attach = async image => {
        if (!board.current?.parts?.some(part => part.id === config.current.partId)) throw new Error('Circuit is not ready');
        destroyRunner();
        const next = createDebugRunner({vm: vm.current, targetKind: 'cp1',
            compilerUrl: 'https://compiler.invalid/cp1-must-not-compile',
            machineConfig: config.current,
            bootMedia: {slot: 'rom', name: image.name, bytes: image.bytes},
            onChange: setState});
        current.current = next;
        setRunner(next);
        await next.start();
        if (next.state().phase !== 'running') throw new Error(next.state().message || 'CP1 failed to attach');
        next.setSpeed(0.06);
        next.pause();
        return next;
    };
    const configure = async next => {
        config.current = next;
        setConfiguration(next);
        if (media.current) await attach(media.current);
        else destroyRunner();
    };
    const importRom = async image => {
        media.current = image;
        await attach(image);
    };
    const save = async () => {
        try {
            current.current?.pause();
            const zip = new JSZip();
            zip.file('project.json', JSON.stringify(scratchProject));
            const base = await zip.generateAsync({type: 'blob'});
            const saved = await attachBrickwrightState(base);
            const url = URL.createObjectURL(saved);
            const link = document.createElement('a');
            link.download = 'cp1-browser-proof.sb3'; link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setNotice('Saved CP1 project');
        } catch (error) { setNotice(error.message); throw error; }
    };
    const restore = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        // A fresh project has no historical firmware or held keys hidden in it.
        media.current = null;
        destroyRunner();
        h.restore = null;
        await loadProjectFile(vm.current, await file.arrayBuffer(), file.name);
        if (h.restore?.outcome !== 'loaded') throw new Error(`Project restore: ${h.restore?.outcome}`);
        setCircuitData(JSON.parse(localStorage.getItem('bw-circuit-autosave')));
        setNotice('Restored CP1 project');
    };
    useEffect(() => {
        const loaded = event => { h.loadedEvents.push(event.detail); };
        const restored = event => { h.restore = event.detail; };
        window.addEventListener('bw-cp1-program-loaded', loaded);
        window.addEventListener('bw-project-bundle-loaded', restored);
        return () => {
            window.removeEventListener('bw-cp1-program-loaded', loaded);
            window.removeEventListener('bw-project-bundle-loaded', restored);
            current.current?.destroy();
        };
    }, []);
    h.snapshot = () => current.current?.cp1Snapshot() || null;
    h.phase = () => current.current?.state().phase || 'idle';
    h.config = () => config.current;
    h.board = () => board.current;
    h.circuit = () => circuitModel.current;
    h.time = () => ({board: String(board.current?.timeNs ?? 0n),
        machine: String(window.__benchTarget?.timeNs?.() ?? 0n)});
    h.identity = () => ({sameBoard: Boolean(current.current && current.current.board() === board.current),
        publishedBoard: Boolean(current.current && vm.current.runtime.bwRunBoard === board.current),
        oneMachine: Boolean(window.__benchTarget?.adapter?.machine === window.__benchTarget?.machine),
        react: React.version});
    h.led = (id = 'led') => board.current?.ledBrightnessNow(id);
    h.loadCircuit = data => {
        const extracted = extractCp1Machine(data);
        if (!extracted.ok) throw new Error(extracted.reasons?.join('\n') || 'CP1 circuit was refused');
        media.current = null;
        destroyRunner();
        config.current = extracted.config;
        setConfiguration(extracted.config);
        setCircuitData(data);
    };
    h.setGallery = setGallery;
    h.unmount = () => root.unmount();
    return <>
        <section style={{height: 650, minWidth: 0}} data-cp1-real-circuit>
            <CircuitDesigner project={project} circuitData={circuitData}
                {...(gallery && {examples: gallery.examples, curriculum: gallery.curriculum, lang: gallery.lang,
                    onLoadExample: example => { h.galleryPicked = example.files.cp1; }})}
                onBoardReady={onBoardReady} onCircuitReady={value => { circuitModel.current = value; }}
                board={runner?.board() || undefined} debuggerOn={Boolean(runner)}
                debugState={{halted: state.phase !== 'running', skewNs: 0n}} />
        </section>
        <section style={{padding: 12, maxWidth: 1000, margin: 'auto'}}>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center'}}>
                <button type="button" onClick={save}>Save fixture .sb3</button>
                <button type="button" onClick={() => setCircuitData({vcc: 5, parts: [], wires: [], holeWires: []})}>Clear fixture circuit</button>
                <label>Restore fixture .sb3 <input type="file" accept=".sb3" onChange={restore} style={{maxWidth: 240}} /></label>
                <output data-cp1-project-result>{notice}</output>
            </div>
            <output data-cp1-runner-phase>{state.phase}</output>
            <Cp1Host runner={runner} running={state.phase === 'running'} locale="en"
                configuration={configuration} onConfigure={configure}
                onImportRom={importRom} onRun={() => current.current?.resume()} />
        </section>
    </>;
}

root.render(<App />);
