// SPDX-License-Identifier: BSD-3-Clause
// Browser shell only. Production modules own all execution, persistence and UI.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {mount} from '@cardiac-react-root';
import JSZip from 'jszip';
import {BoardImpl, inferNetlist, checkWiring, registerAllDevices, getDevice} from 'bw-board';
import '@cardiac-cui-sidecars';
import {setEngine} from '@cardiac-cui-engine';
import {CircuitDesigner} from '@cardiac-circuit-designer';
import CardiacHost from '@cardiac-host';
import {CardiacSurfaces} from '@cardiac-surfaces';
import {createDebugRunner} from '@cardiac-runner';
import {attachBrickwrightState} from '@cardiac-project-bundle';
import loadProjectFile from '@cardiac-project-load';
import circuit from '@cardiac-circuit-example';

registerAllDevices();
setEngine({BoardImpl, inferNetlist, checkWiring, getDevice});
const project = {device: 'cardiac', pins: []};
const root = mount(document.querySelector('#app'));
const h = window.__cardiacIntegration = {compilerCalls: 0, vmProjectLoads: 0, observations: [], restore: null};
const scratchProject = {targets: [{isStage: true, name: 'Stage', blocks: {}, costumes: [], sounds: []}], meta: {semver: '3.0.0'}};
const configuration = {partId: 'cardiac'};

function App () {
    const [runner, setRunner] = useState(null);
    const [state, setState] = useState({phase: 'idle'});
    const [ready, setReady] = useState(false);
    const [circuitData, setCircuitData] = useState(circuit);
    const [circuitKey, setCircuitKey] = useState(0);
    const [notice, setNotice] = useState('');
    const [locale, setLocale] = useState('en');
    const [code, setCode] = useState(null);
    const [controller, setController] = useState(null);
    const board = useRef(null), current = useRef(null), pending = useRef(null), model = useRef(null);
    const vm = useRef({runtime: {stc: project, targets: [], on () {}, off () {}, emit () {}, glowBlock () {}},
        toJSON () { h.compilerCalls++; throw new Error('CARDIAC must not compile Scratch blocks'); },
        async loadProject (bytes) {
            // Minimum archive delegate; this does not claim full Scratch VM loading.
            const zip = await JSZip.loadAsync(bytes), entry = zip.file('project.json');
            if (!entry || !Array.isArray(JSON.parse(await entry.async('string')).targets)) throw new Error('Fixture Scratch project is invalid');
            h.vmProjectLoads++;
        }});
    const onBoardReady = useCallback(next => {
        board.current = next; vm.current.runtime.circuitBoard = next;
        setReady(Boolean(next?.parts?.some(part => part.id === configuration.partId)));
    }, []);
    const destroyRunner = () => {
        current.current?.destroy(); current.current = null; pending.current = null;
        setRunner(null); setState({phase: 'idle'});
    };
    const attach = async () => {
        if (current.current?.cardiacSnapshot()) return current.current;
        if (pending.current) return pending.current;
        if (!board.current?.parts?.some(part => part.id === configuration.partId)) throw new Error('Circuit is not ready');
        const task = (async () => {
            const next = createDebugRunner({vm: vm.current, targetKind: 'cardiac', machineConfig: configuration,
                compilerUrl: 'https://compiler.invalid/cardiac-must-not-compile', onChange: setState});
            current.current = next; setRunner(next);
            await next.start({paused: true});
            if (next.state().phase !== 'paused') throw new Error(next.state().message || 'CARDIAC failed to attach');
            return next;
        })();
        pending.current = task;
        try { return await task; } finally { pending.current = null; }
    };
    const save = async () => {
        try {
            current.current?.pause();
            const zip = new JSZip(); zip.file('project.json', JSON.stringify(scratchProject));
            const saved = await attachBrickwrightState(await zip.generateAsync({type: 'blob'}));
            const url = URL.createObjectURL(saved), link = document.createElement('a');
            link.download = 'cardiac-browser-proof.sb3'; link.href = url; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Saved CARDIAC project');
        } catch (error) { setNotice(error.message); throw error; }
    };
    const restore = async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        setReady(false); destroyRunner(); h.restore = null;
        await loadProjectFile(vm.current, await file.arrayBuffer(), file.name);
        if (h.restore?.outcome !== 'loaded') throw new Error(`Project restore: ${h.restore?.outcome}`);
        setCircuitData(JSON.parse(localStorage.getItem('bw-circuit-autosave')));
        setCircuitKey(value => value + 1); setNotice('Restored CARDIAC project');
    };
    useEffect(() => {
        const restored = event => { h.restore = event.detail; };
        const observed = event => { h.observations.push(event.detail); };
        window.addEventListener('bw-project-bundle-loaded', restored);
        window.addEventListener('bw-cardiac-observation', observed);
        return () => {
            window.removeEventListener('bw-project-bundle-loaded', restored);
            window.removeEventListener('bw-cardiac-observation', observed);
            current.current?.destroy();
        };
    }, []);
    h.snapshot = () => current.current?.cardiacSnapshot() || null;
    h.phase = () => current.current?.state().phase || 'idle';
    h.board = () => board.current;
    h.circuit = () => model.current;
    h.time = () => ({board: String(board.current?.timeNs ?? 0n), machine: String(window.__benchTarget?.timeNs?.() ?? 0n)});
    h.identity = () => ({sameBoard: Boolean(current.current?.board() === board.current),
        publishedBoard: Boolean(current.current && vm.current.runtime.bwRunBoard === board.current),
        oneMachine: Boolean(window.__benchTarget?.machine && window.__benchTarget.machine === board.current?.getDeviceState(configuration.partId)?.machine),
        react: React.version});
    h.led = () => board.current?.ledBrightnessNow('lamp');
    h.current = () => board.current?.branchCurrent('limit', 'a');
    h.setLocale = setLocale;
    h.tryProject = async bytes => {
        try {
            await loadProjectFile(vm.current, Uint8Array.from(bytes).buffer, 'refused-fixture.sb3');
            return {accepted: true};
        } catch (error) { return {accepted: false, message: error.message}; }
    };
    h.unmount = () => root.unmount();
    return <CardiacSurfaces.Provider value={{code, controller}}>
        <section style={{height: 650, minWidth: 0}} data-cardiac-real-circuit>
            <CircuitDesigner key={circuitKey} project={project} circuitData={circuitData} lang={locale}
                onBoardReady={onBoardReady} onCircuitReady={value => { model.current = value; }}
                board={runner?.board() || undefined} debuggerOn={Boolean(runner)}
                debugState={{halted: state.phase !== 'running', skewNs: 0n}} />
        </section>
        <section style={{padding: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center'}}>
            <button type="button" onClick={save}>Save fixture .sb3</button>
            <label>Restore fixture .sb3 <input type="file" accept=".sb3" onChange={restore} /></label>
            <output data-cardiac-project-result>{notice}</output><output data-cardiac-runner-phase>{state.phase}</output>
        </section>
        <div className="fixture-surfaces">
            <section className="fixture-surface" data-test-code-slot ref={setCode} />
            <section className="fixture-surface" data-test-controller-slot ref={setController} />
        </div>
        {ready && <CardiacHost runner={runner} locale={locale} configuration={configuration} onReady={attach} />}
    </CardiacSurfaces.Provider>;
}

root.render(<App />);
