// SPDX-License-Identifier: BSD-3-Clause
import {getCadEnabled, CAD_TOGGLE_EVENT} from './bw-cad-preferences.js';
export const CAD_OPEN_EVENT = 'bw-open-cad';
export const CAD_READY_EVENT = 'bw-cad-ready';
// A small host bridge. The SDK stays lazy, and the preference always stays opt-in.
export function installCadProgramAPI (runtime) {
    let generation = 0, disposed = false, error = '';
    const pending = new Set();
    const simulation = () => globalThis.__bwCad?.editor?.simulation;
    const enabled = () => Boolean(process.env.BW_ENABLE_CAD && getCadEnabled() && !disposed);
    const rejectPending = () => { generation++; for (const cancel of [...pending]) cancel(); };
    const ready = () => {
        if (!enabled()) return Promise.reject(new Error('Enable CAD Editor in Settings → Workspace first.'));
        if (simulation()) return Promise.resolve(simulation());
        return new Promise((resolve, reject) => {
            const cleanup = () => { clearTimeout(timer); window.removeEventListener(CAD_READY_EVENT, check); pending.delete(cancel); };
            const cancel = () => { cleanup(); reject(new Error('CAD command was stopped')); };
            const check = () => { if (simulation()) { cleanup(); resolve(simulation()); } };
            const timer = setTimeout(() => { cleanup(); reject(new Error('CAD Editor did not become ready')); }, 60000);
            pending.add(cancel); window.addEventListener(CAD_READY_EVENT, check);
            window.dispatchEvent(new CustomEvent(CAD_OPEN_EVENT)); check();
        });
    };
    const command = action => {
        const expected = generation;
        return ready().then(sim => {
            if (expected !== generation || !enabled()) throw new Error('CAD command was stopped');
            error = ''; return action(sim);
        }).catch(e => { error = e.message || String(e); throw e; });
    };
    const stop = () => { rejectPending(); return simulation()?.stop(); };
    const reset = () => { rejectPending(); return simulation()?.reset(); };
    const api = {
        start: () => command(sim => sim.start(true)), stop, reset,
        motors: () => enabled() ? simulation()?.motors() || [] : [],
        setMotorPower: (motor, power) => command(sim => {
            if (!Number.isFinite(power) || Math.abs(power) > 100) throw new Error('Motor power must be between -100 and 100 %');
            return sim.setMotor(String(motor), power * 7.2);
        }),
        setMotorSpeed: (motor, speed) => command(sim => sim.setMotor(String(motor), speed)),
        runMotorDegrees: (motor, degrees, speed) => command(sim => sim.runDegrees(String(motor), degrees, speed)),
        stopMotor: (motor, action = 'brake') => command(sim => sim.stopMotor(String(motor), action)),
        motorAngle: motor => enabled() ? simulation()?.angle(String(motor)) || 0 : 0,
        motorSpeed: motor => enabled() ? simulation()?.speed(String(motor)) || 0 : 0,
        status: () => !enabled() ? 'disabled' : error || simulation()?.state.error || simulation()?.state.state || 'not-open'
    };
    const onStop = () => { Promise.resolve(stop()).catch(e => { error = e.message; }); };
    const onToggle = () => { if (!enabled()) onStop(); };
    runtime.cadSimulation = api; globalThis.__bwCadProgramApi = api;
    runtime.on('PROJECT_STOP_ALL', onStop);
    window.addEventListener(CAD_TOGGLE_EVENT, onToggle);
    window.addEventListener('bw-project-bundle-loaded', onStop);
    return () => {
        onStop(); disposed = true;
        runtime.off('PROJECT_STOP_ALL', onStop);
        window.removeEventListener(CAD_TOGGLE_EVENT, onToggle);
        window.removeEventListener('bw-project-bundle-loaded', onStop);
        if (runtime.cadSimulation === api) delete runtime.cadSimulation;
        if (globalThis.__bwCadProgramApi === api) delete globalThis.__bwCadProgramApi;
    };
}
