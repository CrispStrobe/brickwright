// SPDX-License-Identifier: BSD-3-Clause
import {createCoupledSession} from './session.js';
import {readConnections, CONNECTIONS_EVENT} from './connections.js';
import {CAD_TOGGLE_EVENT} from '../bw-cad-preferences.js';
import {SimLabClock} from '../bw-sim/sim-clock.js';
export const STATUS_EVENT = 'bw-cad-circuit-status';
const PROGRESS_INTERVAL_MS = 100;
const stoppedError = () => new Error('Coupled simulation was stopped');
// CAD worker operations can outlive the bridge's preparation attempt. Stop must
// settle its Run immediately, while a clock arriving afterwards is still released.
const prepareCad = (signal, action, discard = () => {}) => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
        if (settled) return;
        settled = true; signal.removeEventListener('abort', abort); callback(value);
    };
    const abort = () => finish(reject, stoppedError());
    if (signal.aborted) {abort(); return;}
    signal.addEventListener('abort', abort, {once: true});
    try {
        Promise.resolve(action()).then(value => {
            if (settled) {
                try {discard(value);} catch { /* A cancelled lease cannot fail a later run. */ }
                return;
            }
            finish(resolve, value);
        }, error => finish(reject, error));
    } catch (error) {finish(reject, error);}
});
const circuitOwner = (board, signal, owner) => new Promise((resolve, reject) => {
    let timeout, settled = false;
    const finish = (callback, value) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); signal.removeEventListener('abort', abort);
        callback(value);
    };
    const abort = () => finish(reject, stoppedError());
    if (signal.aborted) {abort(); return;}
    signal.addEventListener('abort', abort, {once: true});
    timeout = setTimeout(() => finish(reject, new Error('Open the Circuit tab before connecting CAD')), 10000);
    window.dispatchEvent(new CustomEvent('bw-circuit-clock-owner', {detail: {board, signal, owner,
        ready: () => finish(resolve), reject: error => finish(reject, error)}}));
});
async function circuitReady(runtime, signal, config) {
    const expected = [...config.drives, ...config.servos, ...config.sensors].map(item => item.partId);
    const ready = () => runtime.circuitBoard && expected.every(id => runtime.circuitBoard.parts?.some(part => part.id === id));
    if (signal.aborted) throw stoppedError();
    if (ready()) return runtime.circuitBoard;
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true; clearTimeout(timer); window.removeEventListener('bw-board-ready', check);
            signal.removeEventListener('abort', abort); callback(value);
        };
        const check = () => {if (ready()) finish(resolve, runtime.circuitBoard);};
        const abort = () => finish(reject, stoppedError());
        const timer = setTimeout(() => finish(reject, new Error('Open a wired motor circuit in the Circuit tab first')), 30000);
        signal.addEventListener('abort', abort, {once: true});
        window.addEventListener('bw-board-ready', check);
        window.dispatchEvent(new CustomEvent('bw-circuit-ensure-ready'));check();
    });
}
export function installCircuitCadBridge(vm) {
    const runtime = vm.runtime, originalFlag = vm.greenFlag;
    // Yield to the browser after program continuations, without the delay
    // imposed by nested zero-duration timers between coupled batches.
    let channel;
    const tasks = [];
    const defer = typeof window.MessageChannel === 'function' ? task => {
        if (!channel) {
            channel = new window.MessageChannel();
            channel.port1.onmessage = () => tasks.shift()?.();
        }
        tasks.push(task);
        channel.port2.postMessage(null);
    } : undefined;
    const clock = new SimLabClock({paceNominal: true, defer});
    let session = null, generation = 0, pending = false, disposed = false, ownsCircuit = false, mechanics = null, ownedBoard = null;
    let preparation = null, lastProgressAt = -Infinity, circuitOwnerId = null;
    let status = {phase: 'idle', time: 0, readings: [], error: ''};
    const emitStatus = () => window.dispatchEvent(new CustomEvent(STATUS_EVENT, {detail: status}));
    const publish = next => {status = {...status, ...next};emitStatus();};
    const reportFrame = frame => {
        // Keep time and readings from the same completed batch for direct readers.
        status = {phase: 'running', time: frame.time, realTimeFactor: clock.realTimeFactor, readings: session.readings(), error: ''};
        const now = performance.now();
        if (now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
        lastProgressAt = now;
        emitStatus();
    };
    const shutdown = () => {
        generation++;pending=false;
        // Stop also owns startup waits: do not retain Circuit listeners or leave
        // the cancelled Run promise pending until a 10/30-second deadline.
        preparation?.abort();preparation=null;
        clock.uninstall();session?.stop();session=null;mechanics?.release();mechanics=null;
        if (ownsCircuit) {ownsCircuit=false;
            if(ownedBoard){for(const pin of ownedBoard.getPinStates())if(!['input','input-pullup'].includes(pin.mode))ownedBoard.setPin(pin.pin,'input',false);ownedBoard.setPower(false);}}
        ownedBoard=null;
        if(circuitOwnerId){const owner=circuitOwnerId;circuitOwnerId=null;
            window.dispatchEvent(new CustomEvent('bw-circuit-clock-owner',{detail:{board:null,owner}}));}
        publish({phase:'idle',error:''});
    };
    const fail = error => {shutdown();vm.stopAll();publish({phase:'error',error:error.message || String(error)});};
    const api = {
        starting: false,
        state: () => status,
        async start(mode = 'blocks') {
            if (pending) return;
            if (runtime.bwCrispBasicSimulation || runtime.bwCircuitRunPreparing || runtime.bwRunBoard || (runtime.bwProgramClock && runtime.bwProgramClock !== clock)) throw new Error('Stop the other simulator or debugger first');
            shutdown();vm.stopAll();const expected=generation;pending=true;
            const controller=new AbortController();preparation=controller;
            const check=()=>{if(disposed || generation!==expected)throw new Error('Coupled simulation was stopped');};
            try {
                const config=readConnections();if(!config?.enabled)throw new Error('Enable and save circuit–CAD connections first');
                lastProgressAt = -Infinity;
                publish({phase:'preparing',error:'',time:0,readings:[],realTimeFactor:null});
                const board=await circuitReady(runtime,controller.signal,config);check();
                // Acquire the host before compiling or resetting: the designer relinquishes its clock.
                ownedBoard=board;circuitOwnerId={stop:()=>api.stop()};
                await circuitOwner(board,controller.signal,circuitOwnerId);check();ownsCircuit=true;
                await prepareCad(controller.signal, () => runtime.cadSimulation.reset());check();
                const acquired=await prepareCad(controller.signal, () => runtime.cadSimulation.acquireExternalClock(), lease => lease.release());
                if(disposed || generation!==expected){acquired.release();check();}
                mechanics=acquired;
                if(globalThis.__bwCad?.editor?.session.state.document.id!==config.cadDocumentId)throw new Error('These connections belong to a different CAD design');
                board.reset();board.setPower(true);
                let firmware=null;
                if(mode==='firmware') {
                    publish({phase:'compiling'});
                    const [{createDebugRunner},{createAvr8jsAdapter},{parseIntelHex}]=await Promise.all([
                        import(/* webpackChunkName: "bw-debug-runner" */ '../bw-debug/debug-runner.js'),
                        import(/* webpackChunkName: "bw-board" */ 'bw-board/avr8js-adapter.js'),
                        import(/* webpackChunkName: "bw-board" */ 'bw-board/intel-hex.js')]);check();
                    const compiler=createDebugRunner({vm});
                    let built;try{built=await compiler.compileForCoSimulation();}finally{compiler.destroy({preserveRuntime:true});}check();
                    firmware=createAvr8jsAdapter({chip:'atmega328p',clockHz:built.f_cpu || 16000000,program:parseIntelHex(built.hex)});
                    firmware.attachBoard(board);
                } else if(mode!=='blocks')throw new Error('Unsupported controller mode');
                const coupled=await createCoupledSession({board,mechanics,connections:config,firmware,signal:controller.signal,
                    onFrame:frame=>{if(generation===expected)reportFrame(frame);},onError:error=>{if(generation===expected)fail(error);}});
                if(disposed || generation!==expected){coupled.stop();check();}
                session=coupled;
                // In firmware mode the VM supplies clock ticks only; its scripts must not drive pins too.
                if(mode==='blocks') {
                    clock.install(runtime,session);api.starting=true;
                    try{originalFlag.call(vm);}finally{api.starting=false;}
                } else {
                    // Gate an otherwise idle VM on the same shared time. No green flag is emitted.
                    clock.install(runtime,session);
                }
                pending=false;publish({phase:'running'});
            } catch(error) {if(generation===expected){fail(error);throw error;}return;}
            finally {if(preparation===controller)preparation=null;}
        },
        stop() {shutdown();vm.stopAll();},
        reset() {api.stop();runtime.circuitBoard?.reset();runtime.cadSimulation?.reset();publish({time:0,readings:[],realTimeFactor:null,error:''});}
    };
    const onStop=()=>{if(!api.starting)shutdown();};
    const onChange=()=>{if(pending || session)api.stop();};
    const hidden=()=>{if(document.hidden && (pending || session))api.stop();};
    const wrappedFlag=function(...args) {
        let config;try{config=readConnections();}catch(error){fail(error);return;}
        if(!config?.enabled)return originalFlag.apply(this,args);
        api.start('blocks').catch(error=>{if(status.phase!=='error')publish({phase:'error',error:error.message});});
    };
    vm.greenFlag=wrappedFlag;runtime.cadCircuitSimulation=api;
    runtime.on('PROJECT_STOP_ALL',onStop);
    for(const event of [CONNECTIONS_EVENT,CAD_TOGGLE_EVENT,'bw-project-bundle-loaded','bw-cad-simulation-interrupt'])window.addEventListener(event,onChange);
    document.addEventListener('visibilitychange',hidden);
    return ()=>{disposed=true;api.stop();runtime.off('PROJECT_STOP_ALL',onStop);
        channel?.port1.close();channel?.port2.close();tasks.length=0;
        for(const event of [CONNECTIONS_EVENT,CAD_TOGGLE_EVENT,'bw-project-bundle-loaded','bw-cad-simulation-interrupt'])window.removeEventListener(event,onChange);
        document.removeEventListener('visibilitychange',hidden);if(vm.greenFlag===wrappedFlag)vm.greenFlag=originalFlag;
        if(runtime.cadCircuitSimulation===api)delete runtime.cadCircuitSimulation;
    };
}
