// SPDX-License-Identifier: BSD-3-Clause
// Electronics owns current/back-EMF; the mechanics solver owns every shaft pose.
// The validator lives in connections.js (first-load code — project bundles — needs it without the session).
import {validateConnections} from './connections.js';
export {validateConnections};
export const COUPLING_STEP_NS = 5000000n;
const TAU = Math.PI * 2;
const motorKinds = new Set(['dc_motor', 'gearmotor', 'dc_motor_encoder']);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
export async function createCoupledSession({board, mechanics, connections, firmware = null, onFrame = () => {}, onError = () => {}, signal, clockMode = 'cad', cleanupTimeoutMs = 30000}) {
    if (!['cad', 'program'].includes(clockMode)) throw new Error('Unsupported coupled clock mode');
    if (!Number.isSafeInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1 || cleanupTimeoutMs > 60000) throw new TypeError('Invalid CAD cleanup timeout');
    const programDriven = clockMode === 'program';
    if (programDriven && firmware) throw new Error('A program clock cannot also run controller firmware');
    const config = validateConnections(connections);
    if (!config.drives.length && !config.servos.length) throw new Error('Connect a circuit motor to a CAD joint first');
    if (typeof board?.attachMechanicalShaft !== 'function' || typeof board?.claimExternalClock !== 'function') throw new Error('This circuit engine does not support mechanical connections');
    const boardOrigin = board.timeNs, mechanicalOrigin = mechanics.snapshot().time;
    if (typeof boardOrigin !== 'bigint' || boardOrigin < 0n || !finite(mechanicalOrigin, 0, Number.MAX_SAFE_INTEGER / 1e9)) throw new Error('Invalid circuit or CAD clock');
    if (!programDriven && (boardOrigin !== 0n || mechanicalOrigin !== 0)) throw new Error('Reset the circuit and CAD simulation before connecting');
    const originalParts = board.parts, originalNets = board.nets;
    const servoPorts = new Map(), sensorPorts = new Map(), rays=config.sensors.map(s=>({id:s.partId,...s}));
    const drives = config.drives.map(drive => {
        const hinge = drive.kind === 'hinge';
        return {
            ...drive,
            positionField: hinge ? 'angles' : 'linearPositions',
            speedField: hinge ? 'speeds' : 'linearSpeeds',
            scale: hinge ? Math.PI / 180 : TAU / drive.leadMm,
            impulseScale: hinge ? 1 : TAU / (drive.leadMm * .001),
            rotor: null,
            electrical: null
        };
    });
    const releases = []; let lease, stopped = false, generation = 0, pending = Promise.resolve(), budgetMs = 0, frame = mechanics.snapshot(), failed = null;
    let completedSteps = 0, programStepPending = false, stopError = null, cancelStep = null;
    let stopTask = null, cleanupComplete = false;
    const nextBoundary = () => boardOrigin + BigInt(completedSteps + 1) * COUPLING_STEP_NS;
    // Intermediate control samples omit body poses. Public snapshots always keep
    // the most recent complete frame, including while a worker reply is pending.
    let fullFrame = frame;
    const sample = (drive, value) => {
        const positions = value[drive.positionField], speeds = value[drive.speedField];
        if (!positions || !speeds || !Object.hasOwn(positions,drive.jointId) || !Object.hasOwn(speeds,drive.jointId) ||
            !Number.isFinite(positions[drive.jointId]) || !Number.isFinite(speeds[drive.jointId])) throw new Error('A connected CAD joint is missing or has changed kind');
        return {
            partId: drive.partId,
            angleRad: positions[drive.jointId] * drive.scale * drive.ratio * drive.direction,
            velocityRadS: speeds[drive.jointId] * drive.scale * drive.ratio * drive.direction
        };
    };
    const validateFeedback = value => {
        for (const servo of config.servos) {
            if (!Object.hasOwn(value.angles || {}, servo.jointId) || !Number.isFinite(value.angles[servo.jointId])) throw new Error('A connected servo hinge is missing or invalid');
        }
        for (const sensor of config.sensors) {
            if (!Object.hasOwn(value.distances || {}, sensor.partId)) throw new Error('A CAD distance measurement is missing');
            const distance = value.distances[sensor.partId];
            if (distance !== null && !finite(distance, 0, 100000)) throw new Error('A CAD distance measurement is invalid');
        }
    };
    const publish = () => {
        validateFeedback(frame);
        for(const servo of config.servos)servoPorts.get(servo.partId).sample(servo.centerDeg + frame.angles[servo.jointId]*servo.direction);
        for(const sensor of config.sensors){if(!Object.hasOwn(frame.distances || {},sensor.partId))throw new Error('A CAD distance measurement is missing');sensorPorts.get(sensor.partId).sample(frame.distances[sensor.partId]);}
    };
    const stop = () => {
        if (stopped) {if (stopError) throw stopError;return stopTask;} stopped = true; generation++;
        cancelStep?.();
        const clean = action => {try {return action();} catch (error) {if (!stopError) stopError = error;}};
        const ownsBoard=lease?.isActive() === true;
        // BASIC's host releases its own pins and restores the acquired power
        // state. Preserve the last completed mechanical pose and velocity;
        // stopping must not fabricate an extra physics step or brake a rotor.
        if(ownsBoard && !programDriven)for (const drive of drives) {try {const position=sample(drive,frame);board.setMechanicalShaftState(drive.partId,{angleRad:position.angleRad,velocityRadS:0});} catch { /* A board reset may already have released the shaft. */ }}
        const finish = () => {
            if (cleanupComplete) return;
            releases.reverse().forEach(release => clean(release));
            clean(() => lease?.release());
            if(ownsBoard && !programDriven) {
                clean(() => {for (const pin of board.getPinStates()) if (!['input','input-pullup'].includes(pin.mode)) board.setPin(pin.pin,'input',false);});
                clean(() => board.setPower(false));
            }
            cleanupComplete = true;
            if (stopError) throw stopError;
        };
        const reconcile = () => {
            // Stop can arrive after actuator-step was submitted. Its electrical
            // interval was already solved, so accept exactly that worker result
            // before detaching the shaft. Never run a new step or write into a
            // replacement board. A partial (<5 ms) interval stays unrounded.
            if (!programDriven || stopError || !lease?.isActive() || board.parts !== originalParts || board.nets !== originalNets) return;
            const next = mechanics.snapshot();
            const elapsed = Number(board.timeNs - boardOrigin) / 1e9;
            if (!next || !Number.isFinite(next.time) || next.time < frame.time - 1e-9 || next.time > mechanicalOrigin + elapsed + 1e-9 ||
                Math.abs((next.time - mechanicalOrigin) / .005 - Math.round((next.time - mechanicalOrigin) / .005)) > 1e-7) {
                throw new Error('The released CAD clock returned an invalid simulation clock');
            }
            const updates = drives.map(drive => sample(drive,next));
            validateFeedback(next);
            lease.run(() => {
                for (const {partId, angleRad, velocityRadS} of updates) board.setMechanicalShaftState(partId,{angleRad,velocityRadS});
                frame = fullFrame = next;
                for (let index = 0; index < drives.length; index++) drives[index].rotor = updates[index];
                publish();
            });
            onFrame(fullFrame);
        };
        const released = clean(() => mechanics.release());
        if (released && typeof released.then === 'function') {
            let timer;
            const deadline = new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('Timed out releasing the CAD clock')), cleanupTimeoutMs);
            });
            stopTask = Promise.race([released, deadline]).then(() => clean(reconcile), error => {
                if (!stopError) stopError = error;
            }).then(() => {clearTimeout(timer);finish();});
            // Stop is also called by abort listeners. The awaiting owner still
            // receives this rejection; EventTarget must never see an unhandled one.
            stopTask.catch(() => {});
            return stopTask;
        }
        clean(reconcile);
        finish();
        if (stopError) throw stopError;
    };
    // The session is not returned to its caller until initial sensing finishes.
    // Own cancellation here so Stop releases Board ports and the clock even if
    // the mechanical worker never replies. Keep late success/failure handled.
    const senseInitial = () => {
        if (!signal) return mechanics.sense(rays);
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true; signal.removeEventListener('abort', abort); callback(value);
            };
            const abort = () => {
                try {stop();} catch { /* stopError retains cleanup failures; never throw from an event listener. */ }
                finish(reject, new Error('Coupled simulation was stopped'));
            };
            signal.addEventListener('abort', abort, {once: true});
            if (signal.aborted) {abort(); return;}
            try {
                Promise.resolve(mechanics.sense(rays)).then(value => finish(resolve, value), error => finish(reject, error));
            } catch (error) {finish(reject, error);}
        });
    };
    try {
        if (signal?.aborted) throw new Error('Coupled simulation was stopped');
        lease = board.claimExternalClock();
        for (const drive of drives) {
            const part = board.parts.find(p => p.id === drive.partId);
            if (!part || !motorKinds.has(part.kind)) throw new Error(`Circuit motor ${drive.partId} is missing or unsupported`);
            const {angleRad, velocityRadS} = sample(drive,frame);
            releases.push(board.attachMechanicalShaft(drive.partId,{angleRad,velocityRadS}));
        }
        for(const servo of config.servos){
            if(!Object.hasOwn(frame.angles,servo.jointId))throw new Error('A connected servo hinge is missing');
            const port=board.attachExternalServo(servo.partId,servo.centerDeg+frame.angles[servo.jointId]*servo.direction);servoPorts.set(servo.partId,port);releases.push(()=>port.release());
        }
        for(const sensor of config.sensors){const port=board.attachExternalDistanceSensor(sensor.partId);sensorPorts.set(sensor.partId,port);releases.push(()=>port.release());}
        if(rays.length)frame=fullFrame=await senseInitial();
        if (signal?.aborted) throw new Error('Coupled simulation was stopped');
        publish();
    } catch (error) { try {await stop();} catch { /* Keep the preparation failure. */ } throw error; }
    const programReply = action => new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;cancelStep = null;callback(value);
        };
        cancelStep = () => finish(reject, new Error('Coupled simulation was stopped'));
        try {Promise.resolve(action()).then(value => finish(resolve, value), error => finish(reject, error));}
        catch (error) {finish(reject, error);}
    });
    async function step(telemetryOnly, runBoard = action => action()) {
        const expected = generation, target = nextBoundary();
        if (programDriven) {
            if (stopped || !lease.isActive() || board.parts !== originalParts || board.nets !== originalNets) throw new Error('Coupled simulation was stopped or replaced');
            if (board.timeNs !== target) throw new Error('The program must advance the circuit exactly to its next CAD boundary');
        } else lease.run(() => {
            if (firmware) {
                const before = BigInt(firmware.timeNs());
                if (before < target) firmware.advanceNs(Number(target-before));
            } else board.advanceTo(target);
        });
        if (board.timeNs < target || board.timeNs-target > 1000n) throw new Error('Controller and mechanical clocks diverged');
        const impulses = runBoard(() => drives.map(drive => {
            const electrical = board.takeMechanicalShaftImpulse(drive.partId);
            // The preceding feedback already converted this frame's rotor sample.
            const rotor = drive.rotor ?? sample(drive,frame);
            const efficiency = electrical.impulseNms * rotor.velocityRadS < 0 ? 1 / drive.efficiency : drive.efficiency;
            const impulse = electrical.impulseNms * drive.ratio * drive.direction * efficiency * drive.impulseScale;
            if (!finite(impulse,-1,1)) throw new Error('Actuator impulse exceeds the mechanical solver limit');
            drive.electrical = electrical;
            drive.rotor = rotor;
            return {id:drive.jointId,impulse};
        }));
        const servos=runBoard(() => config.servos.map(servo=>{const target=servoPorts.get(servo.partId).target();return{id:servo.jointId,angleRad:(target.angleDeg-servo.centerDeg)*servo.direction*Math.PI/180,torqueNm:servo.torqueNm,enabled:target.powered};}));
        const compact = telemetryOnly && typeof mechanics.stepTelemetry === 'function';
        const advance = () => compact ? mechanics.stepTelemetry(impulses,rays,servos) : mechanics.step(impulses,rays,servos,false);
        const next = await (programDriven ? programReply(advance) : advance());
        if (stopped || expected !== generation) return;
        if (programDriven && (!lease.isActive() || board.parts !== originalParts || board.nets !== originalNets || board.timeNs !== target)) throw new Error('The circuit changed during a CAD step');
        if (programDriven && (!next || !Number.isFinite(next.time) || Math.abs(next.time - (mechanicalOrigin + (completedSteps + 1) * .005)) > 1e-9)) throw new Error('The CAD solver returned an invalid simulation clock');
        // Validate feedback before adopting the frame. A malformed worker reply
        // must never publish a partial position set into the electrical solver.
        const updates = drives.map(drive => sample(drive,next));
        validateFeedback(next);
        frame = next;
        if (!compact) fullFrame = next;
        runBoard(() => {
        if (updates.length > 1 && typeof board.setMechanicalShaftStates === 'function') {
            board.setMechanicalShaftStates(updates);
        } else {
            for (const {partId, angleRad, velocityRadS} of updates) {
                board.setMechanicalShaftState(partId,{angleRad,velocityRadS});
            }
        }
        for (let index = 0; index < drives.length; index++) drives[index].rotor = updates[index];
        publish();
        });
        completedSteps++;
    }
    const programClock = programDriven ? Object.freeze({
        run: action => lease.run(action),
        isActive: () => !stopped && lease.isActive(),
        release: stop,
        get cleanupComplete() {return cleanupComplete;},
        whenReleased: () => stopTask || Promise.resolve(),
        get nextBoundaryNs() {return nextBoundary();},
        get timeMs() {return (frame.time - mechanicalOrigin) * 1000;},
        async completeStep(runBoard) {
            if (typeof runBoard !== 'function') throw new TypeError('A synchronous board owner is required');
            if (programStepPending) throw new Error('A CAD step is already pending');
            if (stopped || failed) throw failed || new Error('Coupled simulation was stopped');
            programStepPending = true;
            try {
                await step(false, runBoard);
                if (stopped) throw new Error('Coupled simulation was stopped');
                mechanics.present?.();onFrame(fullFrame);
            } catch (error) {failed = error;throw error;}
            finally {programStepPending = false;}
        }
    }) : null;
    return {
        programClock,
        tick(ms) {
            if (programDriven) throw new Error('BASIC owns this circuit and CAD clock');
            if (stopped) return;
            if (!finite(ms,0,100)) throw new Error('Invalid coupled simulation duration');
            budgetMs += ms;
            pending = pending.then(async () => {
                const before = frame.time;
                while (!stopped && budgetMs >= 5-1e-9) {
                    budgetMs -= 5;
                    // Keep electrical/encoder feedback at 200 Hz. Only the final
                    // step needs poses for presentation; legacy SDKs stay full.
                    await step(budgetMs >= 5-1e-9);
                }
                if (!stopped && frame.time !== before) {mechanics.present?.();onFrame(fullFrame);}
            }).catch(error => {failed=error;stop();onError(error);throw error;});
            // The caller observes failures through idle(); keep the pending chain handled.
            pending.catch(()=>{});
        },
        idle: () => pending, stop,
        get time() {return frame.time * 1000;}, get failed() {return failed;}, get _disposed() {return stopped;},
        snapshot: () => structuredClone(fullFrame),
        readings: () => drives.map(({partId, jointId, electrical, rotor}) => {
            if (!electrical) return {partId, jointId};
            return {partId, jointId, ...electrical, angleRad: rotor.angleRad, velocityRadS: rotor.velocityRadS};
        })
    };
}
