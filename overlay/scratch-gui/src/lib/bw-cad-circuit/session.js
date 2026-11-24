// SPDX-License-Identifier: BSD-3-Clause
// Electronics owns current/back-EMF; the mechanics solver owns every shaft pose.
// The validator lives in connections.js (first-load code — project bundles — needs it without the session).
import {validateConnections} from './connections.js';
export {validateConnections};
export const COUPLING_STEP_NS = 5000000n;
const TAU = Math.PI * 2;
const motorKinds = new Set(['dc_motor', 'gearmotor', 'dc_motor_encoder']);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
export async function createCoupledSession({board, mechanics, connections, firmware = null, onFrame = () => {}, onError = () => {}, signal}) {
    const config = validateConnections(connections);
    if (!config.drives.length && !config.servos.length) throw new Error('Connect a circuit motor to a CAD joint first');
    if (typeof board?.attachMechanicalShaft !== 'function' || typeof board?.claimExternalClock !== 'function') throw new Error('This circuit engine does not support mechanical connections');
    if (board.timeNs !== 0n || mechanics.snapshot().time !== 0) throw new Error('Reset the circuit and CAD simulation before connecting');
    const servoPorts = new Map(), sensorPorts = new Map(), rays=config.sensors.map(s=>({id:s.partId,...s}));
    const releases = [], readouts = new Map(); let lease, stopped = false, generation = 0, pending = Promise.resolve(), budgetMs = 0, frame = mechanics.snapshot(), failed = null;
    // Intermediate control samples omit body poses. Public snapshots always keep
    // the most recent complete frame, including while a worker reply is pending.
    let fullFrame = frame;
    const sample = (drive, value) => {
        const positions = drive.kind === 'hinge' ? value.angles : value.linearPositions, speeds = drive.kind === 'hinge' ? value.speeds : value.linearSpeeds;
        if (!Object.hasOwn(positions,drive.jointId) || !Object.hasOwn(speeds,drive.jointId)) throw new Error('A connected CAD joint is missing or has changed kind');
        const scale = drive.kind === 'hinge' ? Math.PI / 180 : TAU / drive.leadMm;
        return {angleRad: positions[drive.jointId] * scale * drive.ratio * drive.direction, velocityRadS: speeds[drive.jointId] * scale * drive.ratio * drive.direction};
    };
    const publish = () => {
        for(const servo of config.servos)servoPorts.get(servo.partId).sample(servo.centerDeg + frame.angles[servo.jointId]*servo.direction);
        for(const sensor of config.sensors){if(!Object.hasOwn(frame.distances || {},sensor.partId))throw new Error('A CAD distance measurement is missing');sensorPorts.get(sensor.partId).sample(frame.distances[sensor.partId]);}
    };
    const stop = () => {
        if (stopped) return; stopped = true; generation++;
        const ownsBoard=lease?.isActive() === true;
        if(ownsBoard)for (const drive of config.drives) {try {const position=sample(drive,frame);board.setMechanicalShaftState(drive.partId,{angleRad:position.angleRad,velocityRadS:0});} catch { /* A board reset may already have released the shaft. */ }}
        releases.reverse().forEach(release => release()); lease?.release(); mechanics.release();
        if(!ownsBoard)return;
        for (const pin of board.getPinStates()) if (!['input','input-pullup'].includes(pin.mode)) board.setPin(pin.pin,'input',false);
        board.setPower(false);
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
            const abort = () => {stop(); finish(reject, new Error('Coupled simulation was stopped'));};
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
        for (const drive of config.drives) {
            const part = board.parts.find(p => p.id === drive.partId);
            if (!part || !motorKinds.has(part.kind)) throw new Error(`Circuit motor ${drive.partId} is missing or unsupported`);
            releases.push(board.attachMechanicalShaft(drive.partId,sample(drive,frame)));
        }
        for(const servo of config.servos){
            if(!Object.hasOwn(frame.angles,servo.jointId))throw new Error('A connected servo hinge is missing');
            const port=board.attachExternalServo(servo.partId,servo.centerDeg+frame.angles[servo.jointId]*servo.direction);servoPorts.set(servo.partId,port);releases.push(()=>port.release());
        }
        for(const sensor of config.sensors){const port=board.attachExternalDistanceSensor(sensor.partId);sensorPorts.set(sensor.partId,port);releases.push(()=>port.release());}
        if(rays.length)frame=fullFrame=await senseInitial();
        if (signal?.aborted) throw new Error('Coupled simulation was stopped');
        publish();
    } catch (error) { stop(); throw error; }
    async function step(telemetryOnly) {
        const expected = generation, target = BigInt(Math.round((frame.time + .005) * 1e9));
        lease.run(() => {
            if (firmware) {
                const before = BigInt(firmware.timeNs());
                if (before < target) firmware.advanceNs(Number(target-before));
            } else board.advanceTo(target);
        });
        if (board.timeNs < target || board.timeNs-target > 1000n) throw new Error('Controller and mechanical clocks diverged');
        const impulses = config.drives.map(drive => {
            const electrical = board.takeMechanicalShaftImpulse(drive.partId), rotor = sample(drive,frame);
            const efficiency = electrical.impulseNms * rotor.velocityRadS < 0 ? 1 / drive.efficiency : drive.efficiency;
            let impulse = electrical.impulseNms * drive.ratio * drive.direction * efficiency;
            if (drive.kind === 'slider') impulse *= TAU / (drive.leadMm * .001);
            if (!finite(impulse,-1,1)) throw new Error('Actuator impulse exceeds the mechanical solver limit');
            readouts.set(drive.partId,{...electrical,angleRad:rotor.angleRad,velocityRadS:rotor.velocityRadS});
            return {id:drive.jointId,impulse};
        });
        const servos=config.servos.map(servo=>{const target=servoPorts.get(servo.partId).target();return{id:servo.jointId,angleRad:(target.angleDeg-servo.centerDeg)*servo.direction*Math.PI/180,torqueNm:servo.torqueNm,enabled:target.powered};});
        const compact = telemetryOnly && typeof mechanics.stepTelemetry === 'function';
        const next = compact ? await mechanics.stepTelemetry(impulses,rays,servos) : await mechanics.step(impulses,rays,servos,false);
        if (stopped || expected !== generation) return;
        frame = next;
        if (!compact) fullFrame = next;
        for (const drive of config.drives) {
            const rotor=sample(drive,frame); board.setMechanicalShaftState(drive.partId,rotor);
            readouts.set(drive.partId,{...readouts.get(drive.partId),...rotor});
        }
        publish();
    }
    return {
        tick(ms) {
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
        readings: () => config.drives.map(drive=>({partId:drive.partId,jointId:drive.jointId,...readouts.get(drive.partId)}))
    };
}
