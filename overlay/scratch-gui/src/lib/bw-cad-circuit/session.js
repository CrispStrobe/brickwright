// SPDX-License-Identifier: BSD-3-Clause
// Electronics owns current/back-EMF; the mechanics solver owns every shaft pose.
export const COUPLING_STEP_NS = 5000000n;
const TAU = Math.PI * 2;
const motorKinds = new Set(['dc_motor', 'gearmotor', 'dc_motor_encoder']);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
export function validateConnections(value) {
    if (!value || value.version !== 1 || typeof value.cadDocumentId !== 'string' || !value.cadDocumentId || value.cadDocumentId.length > 96 || !Array.isArray(value.drives) || value.drives.length > 64) throw new Error('Invalid circuit–CAD connections');
    const parts = new Set(), joints = new Set();
    const drives = value.drives.map(raw => {
        if (!raw || typeof raw.partId !== 'string' || !raw.partId || raw.partId.length > 96 || typeof raw.jointId !== 'string' || !raw.jointId || raw.jointId.length > 96 || parts.has(raw.partId) || joints.has(raw.jointId)) throw new Error('Each circuit motor and CAD joint can have only one connection');
        const drive = {partId: raw.partId, jointId: raw.jointId, direction: raw.direction ?? 1, ratio: raw.ratio ?? 1, efficiency: raw.efficiency ?? 1, kind: raw.kind ?? 'hinge', leadMm: raw.leadMm ?? 8};
        if (![1,-1].includes(drive.direction) || !finite(drive.ratio,.001,1000) || !finite(drive.efficiency,.001,1) || !['hinge','slider'].includes(drive.kind) || !finite(drive.leadMm,.01,1000)) throw new Error('Invalid motor transmission');
        parts.add(drive.partId); joints.add(drive.jointId); return drive;
    });
    const claim = raw => {
        if (!raw || typeof raw.partId !== 'string' || !raw.partId || raw.partId.length > 96 || typeof raw.jointId !== 'string' || !raw.jointId || raw.jointId.length > 96 || parts.has(raw.partId) || joints.has(raw.jointId)) throw new Error('Each actuator can have only one connection');
        parts.add(raw.partId);joints.add(raw.jointId);
    };
    if ((value.servos && !Array.isArray(value.servos)) || (value.sensors && !Array.isArray(value.sensors)) || (value.servos?.length || 0)>32 || (value.sensors?.length || 0)>32) throw new Error('Invalid servo or sensor connections');
    const servos=(value.servos || []).map(raw=>{claim(raw);const servo={partId:raw.partId,jointId:raw.jointId,direction:raw.direction??1,centerDeg:raw.centerDeg??90,torqueNm:raw.torqueNm??.02};
        if(![1,-1].includes(servo.direction)||!finite(servo.centerDeg,0,180)||!finite(servo.torqueNm,.000001,100))throw new Error('Invalid ideal servo transmission');return servo;});
    const sensors=(value.sensors || []).map(raw=>{
        if(!raw || typeof raw.partId!=='string' || !raw.partId || raw.partId.length>96 || parts.has(raw.partId) || typeof raw.bodyId!=='string' || !raw.bodyId || raw.bodyId.length>96)throw new Error('Invalid sensor connection');parts.add(raw.partId);
        const sensor={partId:raw.partId,bodyId:raw.bodyId,originMm:raw.originMm??[0,0,0],direction:raw.direction??[1,0,0],rangeMm:raw.rangeMm??4000};
        if(!Array.isArray(sensor.originMm)||sensor.originMm.length!==3||sensor.originMm.some(v=>!finite(v,-100000,100000))||!Array.isArray(sensor.direction)||sensor.direction.length!==3||sensor.direction.some(v=>!finite(v,-1,1))||Math.hypot(...sensor.direction)<1e-9||!finite(sensor.rangeMm,1,100000))throw new Error('Invalid body sensor ray');return sensor;
    });
    return {version: 1, cadDocumentId: value.cadDocumentId, enabled: value.enabled === true, drives,servos,sensors};
}
export async function createCoupledSession({board, mechanics, connections, firmware = null, onFrame = () => {}, onError = () => {}}) {
    const config = validateConnections(connections);
    if (!config.drives.length && !config.servos.length) throw new Error('Connect a circuit motor to a CAD joint first');
    if (typeof board?.attachMechanicalShaft !== 'function' || typeof board?.claimExternalClock !== 'function') throw new Error('This circuit engine does not support mechanical connections');
    if (board.timeNs !== 0n || mechanics.snapshot().time !== 0) throw new Error('Reset the circuit and CAD simulation before connecting');
    const servoPorts = new Map(), sensorPorts = new Map(), rays=config.sensors.map(s=>({id:s.partId,...s}));
    const releases = [], readouts = new Map(); let lease, stopped = false, generation = 0, pending = Promise.resolve(), budgetMs = 0, frame = mechanics.snapshot(), failed = null;
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
    try {
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
        if(rays.length)frame=await mechanics.sense(rays);publish();
    } catch (error) { stop(); throw error; }
    async function step() {
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
        const next = await mechanics.step(impulses,rays,servos,false);
        if (stopped || expected !== generation) return;
        frame = next;
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
            pending = pending.then(async () => {const before=frame.time;while (!stopped && budgetMs >= 5-1e-9) {budgetMs-=5;await step();}if(!stopped && frame.time!==before){mechanics.present?.();onFrame(frame);}}).catch(error => {failed=error;stop();onError(error);throw error;});
            // The caller observes failures through idle(); keep the pending chain handled.
            pending.catch(()=>{});
        },
        idle: () => pending, stop,
        get time() {return frame.time * 1000;}, get failed() {return failed;}, get _disposed() {return stopped;},
        snapshot: () => structuredClone(frame),
        readings: () => config.drives.map(drive=>({partId:drive.partId,jointId:drive.jointId,...readouts.get(drive.partId)}))
    };
}
