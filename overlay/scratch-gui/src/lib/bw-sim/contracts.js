// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Sim Lab's three data contracts (docs/SIM-LAB-PLAN.md), in one file so
// they cannot drift apart:
//
//   PartMeta  ──┐
//               ├─► mechanism compiler (bw-sim/mech/) ─► CompiledMechanism ─► physics core (bw-sim/physics/)
//   PlacedModel ┘
//
// Each contract is plain JSON-able data plus a validator that returns a list
// of problems (empty = valid). Validators never throw on bad input and never
// mutate it; the compiler and the physics core call them at their boundary,
// so a malformed object is refused with a reason instead of half-simulated.
//
// FRAMES AND UNITS — the one place they are defined.
//
//   LDraw frame (PartMeta, PlacedModel): LDraw units (1 LDU = 0.4 mm), the
//   LDraw axes as the file format has them: -y is UP. A Technic hole pitch is
//   20 LDU (8 mm); a stud is 20 LDU apart; a brick is 24 LDU tall.
//
//   World frame (CompiledMechanism, snapshots): metres, kilograms, seconds,
//   radians, right-handed, +y is UP. The compiler alone converts:
//       world = (x, -y, -z) * LDU_M  for positions,
//   i.e. a rotation by 180° about the x axis followed by the scale. That is a
//   proper rotation (det +1), so handedness, cross products and hinge-axis
//   signs survive the conversion unchanged.
//
// VERSIONS (docs/ROBOT-LAB-ARCHITECTURE.md §5.7). PartMeta v2 (parts.json
// `version: 2`) names the device a part is and its internal joints instead of
// v1's `motor`/`sensor`/`hub`; upgradePartMeta turns a v1 entry into v2 and
// every reader goes through it (or the part* accessors), so v1 user catalogs
// and fixtures keep working. CompiledMechanism v2 adds `actuators`,
// `couplings`, `devices`, `hubs`, `noCollide` and body `role`/`collisionGroup`,
// and KEEPS the v1 fields (`gears`, `sensors`, `joint.motor`) as a derived v1
// view for readers that have not moved (validated to agree with the v2 data);
// compile() emits v1 unless asked for v2, and upgradeMechanismV1 lifts a
// hand-built v1 mechanism, which is how the physics core and the hub bridge
// accept v1.

import {deviceModels, validateDeviceModel, SPIKE_SENSOR_DEVICE} from './devices/catalog.js';

/** Metres per LDraw unit. */
export const LDU_M = 0.0004;

/** Gear pitch radius in LDU. Technic gears are module 1 (pitch diameter in mm
 *  = tooth count), so r = teeth/2 mm = teeth · 1.25 LDU: 8T → 10, 24T → 30,
 *  and 8T + 24T mesh at 40 LDU = 2 holes apart. */
export const pitchRadiusLdu = teeth => teeth * 1.25;
/** A part's `gear` pitch radius (LDU): its own `pitchRadiusLdu` (a tread sprocket: the circle its tread's pivots ride on), else from the teeth. */
export const gearPitchRadius = gear => (gear.pitchRadiusLdu > 0 ? gear.pitchRadiusLdu : pitchRadiusLdu(gear.teeth));

export const CONNECTOR_TYPES = Object.freeze(['pinhole', 'axlehole', 'axle', 'pin', 'stud', 'antistud', 'ball', 'ballsocket']);
export const GEAR_TYPES = Object.freeze(['spur', 'bevel', 'worm', 'rack', 'sprocket']);
/** Port ids: hub output letters, and the numbered inputs of the RCX (1–3) and NXT/EV3 (1–4); the hub profile refuses ports it lacks. */
export const HUB_PORTS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', '1', '2', '3', '4']);
/** What sensors.js measures; 'rotation' is the RCX rotation sensor (the hinge in its hole), 'gyro' the EV3 gyro (its body's yaw);
 * 'tilt' and 'proximity' the WeDo 2.0 sensors. */
export const SENSOR_KINDS = Object.freeze(['distance', 'color', 'force', 'rotation', 'tilt', 'proximity', 'gyro']);

/** The hub profile a hub part is when its metadata names none (v1 parts: SPIKE Prime). */
export const DEFAULT_HUB_PROFILE = 'spike-prime';
/** The parts.json format version the shipped file is in (scripts/migrate-parts-v2.mjs). */
export const PART_META_VERSION = 2;
/** Fraction of a motor's mass on its turning output (PartMeta v1 motors; v2: internalJoints[].massFraction). */
export const MOTOR_OUTPUT_MASS_FRACTION = 0.15;
/**
 * CompiledMechanism v2 body roles (§4.1): the model's moving parts, its clamped frame, the floor, a static
 * obstacle, and a dynamic world object the model handles (a box, a pallet: §5.5 `load`).
 */
export const BODY_ROLES = Object.freeze(['robot', 'frame', 'ground', 'obstacle', 'load']);
/** Joint types the physics core builds (registry/kinds.js JointKindRegistry adds more for v2 mechanisms). */
export const JOINT_TYPES_V1 = Object.freeze(['hinge', 'slider', 'ball']);
const INTERNAL_JOINT_TYPES = Object.freeze(['hinge', 'slider']);
// 'built-in': a motor inside a hub part (the BOOST Move Hub's A and B), driven by the joint's own
// `device` and plugged into the joint's own `port` of the hub it is part of (partBuiltInMotors).
const ACTUATED_BY = Object.freeze(['device', 'fluid', 'none', 'built-in']);

/** Friction of a part with no `friction` (ABS plastic on a mat) and of the ground (a printed mat). */
export const PART_FRICTION = 0.4;
export const GROUND_FRICTION = 0.8;

/**
 * What a part is made of (PartMeta `material`, default PART_MATERIAL): the surface numbers the physics
 * core gives the body that part makes its island touch the ground with (mech/islands.js: the grippiest
 * part's; the body's `material`). docs/ROBOT-LAB-VALIDATION.md "Materials" has the sources and the limits.
 *   friction            Coulomb coefficient (Jolt combines two bodies' as √(μ1·μ2)); a part's own
 *                       `friction` still wins over its material's.
 *   restitution         e against a rigid surface (a hard table): the speed ratio of a bounce, rebound height
 *                       e²·drop height. Two materials meet with restitutionOf(a, b) (below). ABS 0.4: solid
 *                       polymers rebound with e 0.6–0.9 (particles: ~0.9, Journal of Physics: Conference Series
 *                       2557 012057, "Restitution coefficient of various particles"; polymer composites 0.63–0.82,
 *                       Bulletin of Materials Science 22(6) 1009), a hollow moulded brick lands on its rim and
 *                       rings, so less: 0.4 is an estimate (rebound 16 % of the height), not a measurement. A LEGO
 *                       tyre 0.05 (soft rubber on a hollow rim: it barely bounces). Only impacts faster than
 *                       physics/jolt-core.js LEGO_MIN_BOUNCE_SPEED_M_S bounce.
 *   modulusGPa          Young's modulus: how the two sides of an impact share it (restitutionOf). ABS 2.3
 *                       (datasheet range 2.0–2.6); the tyres' soft rubber 0.0055 (Shore A ≈ 70, Gent's
 *                       relation E ≈ 0.0981·(56 + 7.62336·S)/(0.137505·(254 − 2.54·S)) MPa); a LEGO tread's
 *                       hard plastic links as ABS.
 *   rollingResistance   c_rr, the rolling drag over the normal load (physics/rolling.js: c_rr·N·r on a wheel that
 *                       rolls, and up to that holding a parked one). Rubber on a hard floor 0.010–0.025 (a drum
 *                       rig's deceleration method: Hungarian Journal of Industry and Chemistry, "Laboratory
 *                       Measurement of Rolling Resistance Coefficient under Different Conditions"); a LEGO tyre on
 *                       a vinyl mat 0.02. A tread 0.05: link (steel) tracks on concrete 0.03–0.06 in the literature
 *                       table of Łopatka & Muszyński, "Validation of rolling and steer resistance of articulated
 *                       tracked robot", ISARC 2013 (whose elastomeric belt tracks measured 0.14); LEGO's are
 *                       pinned plastic links on plastic sprockets. Hard plastic rolling on its rim is not modelled.
 */
export const MATERIALS = Object.freeze({
    abs: Object.freeze({friction: PART_FRICTION, restitution: 0.4, modulusGPa: 2.3, rollingResistance: 0}),
    rubber: Object.freeze({friction: 1, restitution: 0.05, modulusGPa: 0.0055, rollingResistance: 0.02}),
    tread: Object.freeze({friction: 1, restitution: 0.4, modulusGPa: 2.3, rollingResistance: 0.05}),
    // The floor and the arena's walls: a hard table under a thin mat, rigid next to any part (it takes no share
    // of an impact's energy), so a part bounces off it with its own e.
    floor: Object.freeze({friction: GROUND_FRICTION, restitution: 1, modulusGPa: Infinity, rollingResistance: 0})
});
export const PART_MATERIAL = 'abs';
/** The floor's material (a printed mat on a table): see MATERIALS.floor. */
export const GROUND_MATERIAL = 'floor';
/** The floor body's own restitution, for Jolt's max rule where a body has no material: 0, so a part's own e counts. */
export const GROUND_RESTITUTION = 0;

/**
 * The restitution of an impact between two materials. Each side stores the impact's energy in proportion to its
 * compliance 1/E (two springs in series) and gives back e² of what it stored, so
 *   e_ab² = (e_a²/E_a + e_b²/E_b) / (1/E_a + 1/E_b).
 * A part on the rigid floor: its own e. ABS on ABS: 0.4. A brick on a tyre: the soft rubber takes the impact,
 * e ≈ 0.05. (A model, as Jolt's rules are; it keeps both materials' numbers, which max(e_a, e_b) does not.)
 */
export const restitutionOf = (a, b) => {
    const A = MATERIALS[a] || MATERIALS[PART_MATERIAL];
    const B = MATERIALS[b] || MATERIALS[PART_MATERIAL];
    const ca = 1 / A.modulusGPa;
    const cb = 1 / B.modulusGPa;
    if (ca + cb === 0) return Math.min(A.restitution, B.restitution);
    return Math.sqrt((A.restitution ** 2 * ca + B.restitution ** 2 * cb) / (ca + cb));
};

/**
 * @typedef {[number, number, number]} Vec3
 * @typedef {[number, number, number, number]} Quat   x, y, z, w (unit)
 * @typedef {[number, number, number, number, number, number, number, number, number]} Mat3
 *          row-major 3×3, exactly the a b c d e f g h i of an LDraw type-1 line
 */

/**
 * A collision primitive. In PartMeta it is in the part's LDraw frame (LDU);
 * in a CompiledMechanism body it is in that body's local frame (metres).
 * A cylinder's axis is its local +y before `rotation` is applied.
 * `region` ('pin'|'axle'|'ball'|'stud', PartMeta only) marks a collider as the shaft
 * part of a part that is also solid elsewhere (87082's pin ends, 32054's pin, a
 * brick's studs): it may sit inside another part's hole or hollow underside;
 * untagged colliders are solid
 * (editor/overlap.js solidColliders).
 * @typedef {(
 *   {shape: 'box', halfExtents: Vec3, position?: Vec3, rotation?: Quat, region?: string} |
 *   {shape: 'cylinder', radius: number, halfHeight: number, position?: Vec3, rotation?: Quat, region?: string} |
 *   {shape: 'sphere', radius: number, position?: Vec3, region?: string}
 * )} Collider
 */

/**
 * A connection point on a part, in the part's LDraw frame.
 * `axis` is a unit vector; for holes, pins and axles it is the bore/shaft
 * direction, for studs it points out of the stud (LDraw -y for an upward stud).
 * `length` (LDU, along `axis`, centred on `position`) is the extent of a hole,
 * pin or axle: a 1-hole-wide beam hole is 20 long, a 3L axle is 60 long.
 * A connector of the rotating output of a motor is listed in `motor.output`.
 * `ball`/`ballsocket` (a towball, the SPIKE castor ball in its socket): the
 * position is the ball centre; `axis` is the socket's opening direction and is
 * not used for matching. A ball in a socket is a free 3-axis pivot.
 * `friction: false` marks a frictionless pin (it makes a hinge, not a rigid joint).
 * `closedEnd` (±1) marks a blind hole: the end of its segment at
 * position + closedEnd·axis·length/2 is the bottom, which no shaft passes
 * (measured from LDraw's one-sided hole primitive, test/bw-sim-part-meta.test.mjs).
 * A shaft seats in a hole when it engages at least mech/graph.js MIN_ENGAGE_LDU
 * of it (graph.js shaftEngagement).
 * @typedef {{id: string, type: string, position: Vec3, axis: Vec3, length?: number, friction?: boolean, closedEnd?: 1|-1}} Connector
 */

/**
 * Hand-authored metadata for one LDraw part (docs/SIM-LAB-PLAN.md §D4).
 * NEVER copied from BrickLink Studio or LDCad data.
 * @typedef {{
 *   part: string,                 e.g. '3713.dat'
 *   name: string,
 *   nameDe?: string,
 *   category: string,             a palette category (editor/palette.js PALETTE_CATEGORIES): 'beam' | 'axle' | 'pin' | 'gear' | 'wheel' | 'motor' | 'hub' | 'sensor' | 'brick' | 'plate' | 'tile' | 'slope' | 'other'
 *   massGrams: number,
 *   friction?: number,            Coulomb friction coefficient of the part surface, 0..2;
 *                                 default PART_FRICTION (hard plastic). A tyred wheel is ~1.
 *   material?: string,            a MATERIALS key (default PART_MATERIAL 'abs'); a tyred wheel is 'rubber'
 *   connectors: Connector[],
 *   colliders: Collider[],
 *   gear?: {type: string, teeth: number, axis: Vec3, center: Vec3},
 *        gear axis/center are in the part frame; the pitch radius is pitchRadiusLdu(teeth)
 *   motor?: {output: string[], outputColliders: number[], maxTorqueNm: number, maxSpeedDegPerSec: number, deviceId?: number},
 *        output: ids of connectors that turn with the shaft; outputColliders:
 *        indices into `colliders` of the turning part (the drive hub) — they
 *        belong to the output body, every other collider to the housing.
 *        Both bodies must end up with at least one collider. deviceId: the LEGO
 *        device type the hub reports on the motor's port (48 medium, 49 large angular).
 *   hub?: {ports: string[]}
 *   sensor?: {kind: 'distance'|'color'|'force', origin: Vec3, direction: Vec3}
 *      in the part's LDraw frame (LDU; direction unit, out of the sensing face).
 * }} PartMeta
 */

/**
 * PartMeta v2 (docs/ROBOT-LAB-ARCHITECTURE.md §5.4): v1 without `motor`, `sensor`
 * and `hub`, which become
 *   internalJoints  movable sub-bodies of one part; a v1 motor is one hinge
 *                   {id: 'motor', type: 'hinge', point?, axis?, movingConnectors
 *                   (v1 motor.output), movingColliders (v1 outputColliders),
 *                   massFraction (0.15), actuatedBy: 'device'}. point/axis (part
 *                   frame) are the shaft; absent, the compiler takes them from the
 *                   moving connectors as v1 did (an axlehole, else their centroid).
 *   device          the device the part is: a devices/catalog.js id, or (user
 *                   catalogs, v1 fixtures whose numbers are no catalogue device) an
 *                   inline DeviceModel
 *   probe           where a sensor part senses from, part frame: {kind: 'ray',
 *                   origin, direction} (v1 sensor.origin/direction). Part geometry,
 *                   so it stays here and not in the device model.
 *   hubProfile      the hub family a hub part is (v1 hub: always 'spike-prime',
 *                   or its `hub.profile`)
 * `connectors[].type` may be a registered connector kind (registry/kinds.js).
 * Not yet used by any part, so not yet validated: `gears[]` (several tooth sets),
 * `fluid`, `rope` (§5.4) — they come with the slices that add such parts.
 * @typedef {object} PartMetaV2
 */

/**
 * A model as placed in the editor: what the LDraw MPD stores.
 * `position` (LDU) and `rotation` (row-major 3×3) are exactly an LDraw type-1
 * line's x y z and a..i. `port` binds a motor or sensor to a hub port
 * (stored in the MPD as a `0 !BW PORT A` meta line before the part line).
 * `groups` is an optional list of non-nested groups for the editor: each
 * group has an id, a display name, and the ids of the parts it contains.
 * A part belongs to at most one group; groups do not nest in v1.
 * In LDraw text they are `0 !BW GROUP <id> <name>` and for each member
 * `0 !BW IN <groupId>` before its type-1 line.
 * @typedef {{
 *   version: 1,
 *   parts: {id: string, part: string, color?: number, position: Vec3, rotation: Mat3, port?: string}[],
 *   groups?: {id: string, name: string, parts: string[]}[],
 *   belts?: {id: string, band: string, around: string[]}[],
 *   ropes?: {id: string, lengthLdu: number, around: string[]}[],
 *   hoses?: {id: string, a: {part: string, port: string}, b: {part: string, port: string}}[],
 *   decor?: {part: string, color: number, position: number[], matrix: number[]}[],
 *   files?: {[name: string]: string}
 * }} PlacedModel
 *
 * `decor` is what a file has that is drawn but not simulated: a flexible element's stretched segments
 * (a cable, a hose, a string), a mirrored part, a part not in the catalogue; `files` are the parts
 * an MPD ships itself (model/ldraw-model.js).
 *
 * `hoses` are pneumatic tubes from one part's air port to another's (docs/ROBOT-LAB-UX.md §16):
 * `0 !BW HOSE <id> <part> <port> <part> <port>` in LDraw text.
 *
 * `ropes` are strings from a winch drum over sheaves to a hook (docs/ROBOT-LAB-UX.md §15):
 * `around` [drum, sheave…, hook], `lengthLdu` the string's length. In LDraw text each is a
 * `0 !BW ROPE <id> <lengthLdu> <drum> <sheave…> <hook>` line.
 *
 * `belts` are rubber bands (docs/ROBOT-LAB-UX.md §12): `band` the LDraw part of its size (85543
 * …), `around` the parts it goes round, in order. LDraw draws no stretched band, so in LDraw
 * text each is a `0 !BW BELT <id> <band> <part id> <part id> …` line.
 *
 * PlacedModel v2 (§5.7, for models with several hubs): `version: 2`, and `port` may be
 * {hub?: string, port: string} — the placed id of the hub part it plugs into and that
 * hub's port id (any non-empty string: the hub's profile decides, and the hub refuses an
 * unknown port when the scene plugs in). A string port, and a port without `hub`, mean
 * the model's first hub (the one hubsOf/compile pick: the first body carrying a hub).
 * `version: 1` keeps its exact checks (ports A–F).
 */

/** A placed part's port as {hub, port} (hub null: the model's first hub), or null when it has none. */
export const portRefOf = placed => {
    const p = placed && placed.port;
    if (typeof p === 'string') return {hub: null, port: p};
    if (p && typeof p === 'object' && typeof p.port === 'string') return {hub: typeof p.hub === 'string' ? p.hub : null, port: p.port};
    return null;
};

/**
 * What the compiler emits and the physics core consumes — the
 * engine-agnostic seam (§D1: Jolt today, Rapier if F3 says so).
 * Everything in world frame, SI units.
 *
 * bodies: one per rigid island. `position`/`rotation` are the body origin's
 *   world pose at t=0; colliders are relative to that origin. `com` is the
 *   centre of mass relative to the origin (informational; engines may
 *   recompute it from colliders + massKg). `parts` lists PlacedModel part ids.
 *   One static body may represent the ground; there is no implicit ground.
 * joints: `body2` may be the string 'world'. `point` and `axis` are world
 *   frame at t=0. A hinge's angle is measured about `axis` by the right-hand
 *   rule, as body2's rotation relative to body1, zero at t=0.
 *   `motor.port` binds the hinge to a hub port. A `ball` joint is a point
 *   constraint (free rotation about all axes, e.g. a castor ball): it has a
 *   `point` and no `axis`.
 * gears: `ratio` is SIGNED and engine-neutral:
 *       ω(joint2) = ratio · ω(joint1)
 *   where each ω is that hinge's relative angular velocity about its OWN
 *   `axis`. An 8T driving a 24T on parallel, same-direction axes: ratio = -1/3.
 *   rackAndPinion: v(sliderJoint) = ratio · ω(hingeJoint), m/s per rad/s.
 * diagnostics: refusals and warnings, surfaced in the UI as a list (never
 *   silently dropped): e.g. a motor with no port, an ambiguous gear mesh.
 *
 * @typedef {{
 *   version: 1,
 *   gravity: Vec3,
 *   bodies: {id: string, motion: 'static'|'dynamic', position: Vec3, rotation: Quat,
 *            massKg: number, com?: Vec3, colliders: Collider[], parts: string[],
 *            friction?: number, restitution?: number, rollingResistance?: number, material?: string, color?: number, mat?: string}[],
 *     (restitution 0..1 and rollingResistance ≥ 0: MATERIALS; c_rr acts on a body that turns on a hinge; `material`
 *      a MATERIALS key: two bodies with one meet with restitutionOf, others with Jolt's max of `restitution`)
 *   joints: ({id: string, type: 'hinge', body1: string, body2: string, point: Vec3, axis: Vec3,
 *             motor?: {port: string, maxTorqueNm: number, maxSpeedRadPerSec: number, deviceId?: number}} |
 *            {id: string, type: 'slider', body1: string, body2: string, point: Vec3, axis: Vec3} |
 *              (optional, R3: hinge `limits` [min, max] rad within [-π, π] and `frictionNm`; slider
 *              `limits` [min, max] m, `frictionN`, `maxForceN` and `maxSpeedMPerSec` of its motor.
 *              Limits are from the start pose (0), so min ≤ 0 ≤ max; friction acts while the motor is off.)
 *            {id: string, type: 'ball', body1: string, body2: string, point: Vec3})[],
 *   gears: ({id: string, type: 'gear', joint1: string, joint2: string, ratio: number} |
 *           {id: string, type: 'rackAndPinion', hingeJoint: string, sliderJoint: string, ratio: number})[],
 *   diagnostics: {severity: 'error'|'warning', code: string, message: string, parts?: string[]}[],
 *   sensors?: {port: string, kind: 'distance'|'color'|'force', body: string, origin: Vec3, direction: Vec3}[],
 *      world frame at t=0, metres; body is the island holding the sensor part.
 * }} CompiledMechanism
 */

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n = 3) => Array.isArray(v) && v.length === n && v.every(isNum);
const norm = v => Math.hypot(...v);
const UNIT_EPS = 1e-6;

/** A collider's volume (any unit cubed: the units it is given in). */
export const colliderVolume = c => {
    if (c.shape === 'box') return 8 * c.halfExtents[0] * c.halfExtents[1] * c.halfExtents[2];
    if (c.shape === 'cylinder') return 2 * Math.PI * c.radius * c.radius * c.halfHeight;
    if (c.shape === 'sphere') return 4 / 3 * Math.PI * c.radius ** 3;
    return 0;
};

const checkCollider = (c, where, out) => {
    if (!c || typeof c !== 'object') return out.push(`${where}: not an object`);
    if (c.position !== undefined && !isVec(c.position)) out.push(`${where}.position: not a Vec3`);
    if (c.rotation !== undefined && !(isVec(c.rotation, 4) && Math.abs(norm(c.rotation) - 1) < 1e-4)) {
        out.push(`${where}.rotation: not a unit quaternion`);
    }
    if (c.region !== undefined && !['pin', 'axle', 'ball', 'stud'].includes(c.region)) out.push(`${where}.region: '${c.region}' is not pin|axle|ball|stud`);
    if (c.shape === 'box') {
        if (!isVec(c.halfExtents) || !c.halfExtents.every(h => h > 0)) out.push(`${where}.halfExtents: need three positive numbers`);
    } else if (c.shape === 'cylinder') {
        if (!(isNum(c.radius) && c.radius > 0)) out.push(`${where}.radius: need a positive number`);
        if (!(isNum(c.halfHeight) && c.halfHeight > 0)) out.push(`${where}.halfHeight: need a positive number`);
    } else if (c.shape === 'sphere') {
        if (!(isNum(c.radius) && c.radius > 0)) out.push(`${where}.radius: need a positive number`);
    } else {
        out.push(`${where}.shape: '${c.shape}' is not box|cylinder|sphere`);
    }
};

const checkUnit = (v, where, out) => {
    if (!isVec(v)) out.push(`${where}: not a Vec3`);
    else if (Math.abs(norm(v) - 1) > UNIT_EPS) out.push(`${where}: not a unit vector (|v| = ${norm(v)})`);
};

const uniqueIds = (items, where, out) => {
    const seen = new Set();
    for (const it of items) {
        if (typeof it?.id !== 'string' || !it.id) out.push(`${where}: an entry has no string id`);
        else if (seen.has(it.id)) out.push(`${where}: duplicate id '${it.id}'`);
        else seen.add(it.id);
    }
    return seen;
};

/**
 * @param {object} meta a PartMeta, v1 or v2
 * @param {{connectorKinds?: {has(kind: string): boolean}}} [options] registered connector kinds
 *        (registry/kinds.js) a connector's `type` may name besides the v1 ones
 * @returns {string[]} problems; empty when `meta` is a valid PartMeta.
 */
export const validatePartMeta = (meta, {connectorKinds = null} = {}) => {
    const out = [];
    if (!meta || typeof meta !== 'object') return ['part meta: not an object'];
    const p = typeof meta.part === 'string' ? meta.part : '?';
    if (!/^[\w.-]+\.dat$/i.test(meta.part || '')) out.push(`${p}.part: need an LDraw file name like '3713.dat'`);
    if (typeof meta.name !== 'string' || !meta.name) out.push(`${p}.name: missing`);
    if (meta.nameDe !== undefined && (typeof meta.nameDe !== 'string' || !meta.nameDe)) out.push(`${p}.nameDe: must be a non-empty string`);
    if (typeof meta.category !== 'string' || !meta.category) out.push(`${p}.category: missing`);
    if (!(isNum(meta.massGrams) && meta.massGrams > 0)) out.push(`${p}.massGrams: need a positive number`);
    // `mirrorOf` (part-meta/canonical-frame.js, measured): null, or the part whose shape is this
    // one's under p ↦ m·p + t with m orthogonal and improper (det −1).
    if (meta.mirrorOf !== undefined && meta.mirrorOf !== null) {
        const mo = meta.mirrorOf;
        const m = mo?.transform?.m;
        const t = mo?.transform?.t;
        const okM = Array.isArray(m) && m.length === 9 && m.every(isNum);
        if (typeof mo?.part !== 'string' || !okM || !(Array.isArray(t) && t.length === 3 && t.every(isNum))) {
            out.push(`${p}.mirrorOf: need {part, transform: {m: 9 numbers, t: 3 numbers}} or null`);
        } else {
            const d = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
            const mmT = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => m[3 * r] * m[3 * c] + m[3 * r + 1] * m[3 * c + 1] + m[3 * r + 2] * m[3 * c + 2]));
            if (Math.abs(d + 1) > 1e-6 || mmT.some((v, i) => Math.abs(v - (i % 4 === 0 ? 1 : 0)) > 1e-6)) {
                out.push(`${p}.mirrorOf.transform.m: must be an orthogonal reflection (det −1), not det ${d}`);
            }
        }
        if (mo?.others !== undefined && !(Array.isArray(mo.others) && mo.part === meta.part &&
            mo.others.every(o => Array.isArray(o?.m) && o.m.length === 9 && o.m.every(isNum) && Array.isArray(o?.t) && o.t.length === 3 && o.t.every(isNum)))) {
            out.push(`${p}.mirrorOf.others: only on a part that is its own mirror image, a list of {m, t}`);
        }
    }
    if (meta.ownedGeometry !== undefined && typeof meta.ownedGeometry !== 'boolean') out.push(`${p}.ownedGeometry: must be boolean`);
    if (meta.friction !== undefined && !(isNum(meta.friction) && meta.friction >= 0 && meta.friction <= 2)) {
        out.push(`${p}.friction: need a number in 0..2`);
    }
    if (meta.material !== undefined && !Object.prototype.hasOwnProperty.call(MATERIALS, meta.material)) {
        out.push(`${p}.material: '${meta.material}' is not one of ${Object.keys(MATERIALS).join('|')}`);
    }
    if (!Array.isArray(meta.connectors)) out.push(`${p}.connectors: not an array`);
    else {
        const ids = uniqueIds(meta.connectors, `${p}.connectors`, out);
        meta.connectors.forEach((c, i) => {
            const w = `${p}.connectors[${c?.id ?? i}]`;
            if (!CONNECTOR_TYPES.includes(c?.type) && !(connectorKinds && connectorKinds.has(c?.type))) out.push(`${w}.type: '${c?.type}' is not one of ${CONNECTOR_TYPES.join('|')}`);
            // A registered kind checks its own data (a worm's pitch radius and hand, a rack's normal).
            const kindModule = connectorKinds && typeof connectorKinds.get === 'function' ? connectorKinds.get(c?.type) : null;
            if (kindModule && typeof kindModule.validate === 'function' && c) for (const q of kindModule.validate(c)) out.push(`${w}: ${q}`);
            if (!isVec(c?.position)) out.push(`${w}.position: not a Vec3`);
            checkUnit(c?.axis, `${w}.axis`, out);
            if (c?.length !== undefined && !(isNum(c.length) && c.length > 0)) out.push(`${w}.length: need a positive number`);
            if (c?.data?.seatOffsetLdu !== undefined && !(c.type === 'stud' && isNum(c.data.seatOffsetLdu) &&
                c.data.seatOffsetLdu >= 0 && c.data.seatOffsetLdu < c.length)) out.push(`${w}.data.seatOffsetLdu: a stud clutch plane must lie within its primitive length`);
            if (c?.friction !== undefined && typeof c.friction !== 'boolean') out.push(`${w}.friction: need a boolean`);
            if (c?.closedEnd !== undefined && !((c.closedEnd === 1 || c.closedEnd === -1) && (c.type === 'pinhole' || c.type === 'axlehole'))) {
                out.push(`${w}.closedEnd: only a pinhole/axlehole may have one, and it is 1 or -1`);
            }
        });
        if (meta.motor) {
            for (const o of meta.motor.output || []) if (!ids.has(o)) out.push(`${p}.motor.output: unknown connector '${o}'`);
            if (!Array.isArray(meta.motor.output) || meta.motor.output.length === 0) out.push(`${p}.motor.output: need at least one connector id`);
            const oc = meta.motor.outputColliders;
            const nCol = Array.isArray(meta.colliders) ? meta.colliders.length : 0;
            if (!Array.isArray(oc) || oc.length === 0 || !oc.every(i => Number.isInteger(i) && i >= 0 && i < nCol)) {
                out.push(`${p}.motor.outputColliders: need at least one index into colliders`);
            } else if (oc.length >= nCol) {
                out.push(`${p}.motor.outputColliders: the housing needs at least one collider of its own`);
            }
            if (!(isNum(meta.motor.maxTorqueNm) && meta.motor.maxTorqueNm > 0)) out.push(`${p}.motor.maxTorqueNm: need a positive number`);
            if (!(isNum(meta.motor.maxSpeedDegPerSec) && meta.motor.maxSpeedDegPerSec > 0)) out.push(`${p}.motor.maxSpeedDegPerSec: need a positive number`);
        }
    }
    if (!Array.isArray(meta.colliders) || meta.colliders.length === 0) out.push(`${p}.colliders: need at least one collider`);
    else meta.colliders.forEach((c, i) => checkCollider(c, `${p}.colliders[${i}]`, out));
    if (meta.gear) {
        if (!GEAR_TYPES.includes(meta.gear.type)) out.push(`${p}.gear.type: '${meta.gear.type}' is not one of ${GEAR_TYPES.join('|')}`);
        if (!(Number.isInteger(meta.gear.teeth) && meta.gear.teeth > 0)) out.push(`${p}.gear.teeth: need a positive integer`);
        checkUnit(meta.gear.axis, `${p}.gear.axis`, out);
        if (!isVec(meta.gear.center)) out.push(`${p}.gear.center: not a Vec3`);
        if (meta.gear.pitchRadiusLdu !== undefined && !(meta.gear.pitchRadiusLdu > 0)) out.push(`${p}.gear.pitchRadiusLdu: a positive number (LDU)`);
        if (meta.gear.meshesAs !== undefined && (!Array.isArray(meta.gear.meshesAs) ||
            !meta.gear.meshesAs.length || !meta.gear.meshesAs.every(t => GEAR_TYPES.includes(t)) ||
            !meta.gear.meshesAs.includes(meta.gear.type))) out.push(`${p}.gear.meshesAs: supported profiles including the native type`);
        if (meta.gear.faceWidthLdu !== undefined && !(isNum(meta.gear.faceWidthLdu) && meta.gear.faceWidthLdu > 0)) {
            out.push(`${p}.gear.faceWidthLdu: a positive finite tooth-face width`);
        }
    }
    if (meta.drawnOnly !== undefined && typeof meta.drawnOnly !== 'boolean') out.push(`${p}.drawnOnly: true or false`);
    if (meta.hub && !(Array.isArray(meta.hub.ports) && meta.hub.ports.every(x => HUB_PORTS.includes(x)))) {
        out.push(`${p}.hub.ports: need a list of ${HUB_PORTS.join('|')}`);
    }
    if (meta.sensor !== undefined) {
        if (!meta.sensor || typeof meta.sensor !== 'object') out.push(`${p}.sensor: not an object`);
        else {
            if (!SENSOR_KINDS.includes(meta.sensor.kind)) out.push(`${p}.sensor.kind: '${meta.sensor.kind}' is not one of ${SENSOR_KINDS.join('|')}`);
            if (!isVec(meta.sensor.origin)) out.push(`${p}.sensor.origin: not a Vec3`);
            checkUnit(meta.sensor.direction, `${p}.sensor.direction`, out);
        }
    }
    checkPartMetaV2(meta, p, out);
    return out;
};

/** The v2 fields of a PartMeta (PartMetaV2); v1 and v2 forms of one thing may not both be given. */
const checkPartMetaV2 = (meta, p, out) => {
    const ids = new Set(Array.isArray(meta.connectors) ? meta.connectors.map(c => c?.id) : []);
    const nCol = Array.isArray(meta.colliders) ? meta.colliders.length : 0;
    const both = (v1, v2) => {
        if (meta[v1] !== undefined && meta[v2] !== undefined) out.push(`${p}: both ${v1} (v1) and ${v2} (v2); upgradePartMeta turns the one into the other`);
    };
    both('motor', 'internalJoints');
    both('motor', 'device');
    both('sensor', 'device');
    both('sensor', 'probe');
    both('hub', 'hubProfile');
    let actuatedJoints = 0;
    if (meta.internalJoints !== undefined) {
        if (!Array.isArray(meta.internalJoints) || meta.internalJoints.length === 0) out.push(`${p}.internalJoints: a non-empty list`);
        else {
            uniqueIds(meta.internalJoints, `${p}.internalJoints`, out);
            for (const j of meta.internalJoints) {
                const w = `${p}.internalJoints[${j?.id}]`;
                if (!INTERNAL_JOINT_TYPES.includes(j?.type)) out.push(`${w}.type: need ${INTERNAL_JOINT_TYPES.join(' or ')}`);
                if ((j?.point === undefined) !== (j?.axis === undefined)) out.push(`${w}: point and axis come together`);
                if (j?.point !== undefined && !isVec(j.point)) out.push(`${w}.point: not a Vec3`);
                if (j?.axis !== undefined) checkUnit(j.axis, `${w}.axis`, out);
                if (!Array.isArray(j?.movingConnectors) || j.movingConnectors.length === 0) out.push(`${w}.movingConnectors: need at least one connector id`);
                else for (const c of j.movingConnectors) if (!ids.has(c)) out.push(`${w}.movingConnectors: unknown connector '${c}'`);
                const mc = j?.movingColliders;
                if (!Array.isArray(mc) || mc.length === 0 || !mc.every(i => Number.isInteger(i) && i >= 0 && i < nCol)) {
                    out.push(`${w}.movingColliders: need at least one index into colliders`);
                } else if (mc.length >= nCol) out.push(`${w}.movingColliders: the part's fixed body needs at least one collider of its own`);
                if (!(isNum(j?.massFraction) && j.massFraction > 0 && j.massFraction < 1)) out.push(`${w}.massFraction: need a number in (0, 1)`);
                if (j?.actuatedBy !== undefined && !ACTUATED_BY.includes(j.actuatedBy)) out.push(`${w}.actuatedBy: one of ${ACTUATED_BY.join('|')}`);
                if (j?.actuatedBy === 'device') actuatedJoints++;
                if (j?.actuatedBy === 'built-in') {
                    const d = typeof j.device === 'string' ? deviceModels.get(j.device) : null;
                    if (!(d && d.motor)) out.push(`${w}.device: a built-in motor names a motor of the device catalogue`);
                    if (!(typeof j.port === 'string' && j.port)) out.push(`${w}.port: a built-in motor names its hub port`);
                    if (!(typeof meta.hubProfile === 'string' || meta.hub)) out.push(`${w}: only a hub part has built-in motors`);
                }
                if (j?.limitsLdu !== undefined && !(isVec(j.limitsLdu, 2) && j.limitsLdu[0] <= j.limitsLdu[1])) out.push(`${w}.limitsLdu: [min, max]`);
                // A hinge's end stops in degrees from the start pose (a servo: kinds/servo-stops.js).
                if (j?.limitsDeg !== undefined && !(j.type === 'hinge' && isVec(j.limitsDeg, 2) && j.limitsDeg[0] <= 0 && j.limitsDeg[1] >= 0 &&
                    j.limitsDeg[0] >= -180 && j.limitsDeg[1] <= 180)) out.push(`${w}.limitsDeg: a hinge's [min ≤ 0, max ≥ 0] within ±180`);
            }
        }
    }
    let device = null;
    if (meta.device !== undefined) {
        if (typeof meta.device === 'string') {
            device = deviceModels.get(meta.device) || null;
            if (!device) out.push(`${p}.device: '${meta.device}' is not in the device catalogue (devices/catalog.js)`);
        } else {
            const problems = validateDeviceModel(meta.device);
            for (const q of problems) out.push(`${p}.device: ${q}`);
            if (!problems.length) device = meta.device;
        }
    }
    if (device && device.motor && actuatedJoints !== 1) out.push(`${p}.device: a motor drives exactly one internal joint with actuatedBy 'device'`);
    if (actuatedJoints > 0 && !(device && device.motor)) out.push(`${p}.internalJoints: a joint actuatedBy 'device' needs a motor device`);
    if (meta.probe !== undefined) {
        if (!meta.probe || meta.probe.kind !== 'ray') out.push(`${p}.probe.kind: need 'ray'`);
        else {
            if (!isVec(meta.probe.origin)) out.push(`${p}.probe.origin: not a Vec3`);
            checkUnit(meta.probe.direction, `${p}.probe.direction`, out);
        }
    }
    if (device && device.sensor && meta.probe === undefined) out.push(`${p}.probe: a sensor device needs a probe`);
    if (meta.hubProfile !== undefined && !(typeof meta.hubProfile === 'string' && meta.hubProfile)) out.push(`${p}.hubProfile: need a hub profile id`);
};

// ---- PartMeta v1 → v2 ---------------------------------------------------------

const V1_PART_FIELDS = Object.freeze({motor: ['internalJoints', 'device'], sensor: ['device', 'probe'], hub: ['hubProfile']});
const upgradedParts = new WeakMap();

/** A v1 motor's turning output as an internal hinge (graph.js split it this way in v1). */
const motorInternalJoint = meta => {
    const m = meta.motor || {};
    const output = Array.isArray(m.output) ? m.output : [];
    const outIds = new Set(output);
    const shaft = (Array.isArray(meta.connectors) ? meta.connectors : []).find(c => outIds.has(c?.id) && c.type === 'axlehole');
    const joint = {id: 'motor', type: 'hinge'};
    if (shaft && isVec(shaft.position) && isVec(shaft.axis)) {
        joint.point = shaft.position.slice();
        joint.axis = shaft.axis.slice();
    }
    joint.movingConnectors = output.slice();
    joint.movingColliders = Array.isArray(m.outputColliders) ? m.outputColliders.slice() : [];
    joint.massFraction = MOTOR_OUTPUT_MASS_FRACTION;
    joint.actuatedBy = 'device';
    return joint;
};

/**
 * The catalogue device whose numbers ARE the v1 motor's — today's, or the ones PartMeta v1 held
 * for that device (`device.v1`: D6 replaced the SPIKE motors' stall torques, a v1 file still
 * names the same motor) — else the same numbers as an inline device.
 */
const motorDevice = meta => {
    const m = meta.motor || {};
    const lpf2 = Number.isInteger(m.deviceId) ? m.deviceId : undefined;
    const same = (n, torque, speed) => n.maxTorqueNm === torque && n.maxSpeedDegPerSec === speed;
    for (const d of deviceModels.values()) {
        if (!d.motor || lpf2 === undefined || d.ids.lpf2 !== lpf2) continue;
        if (same(m, d.motor.stallTorqueNm, d.motor.servoMaxDegPerSec) ||
            (d.v1 && d.parts.includes(meta.part) && same(m, d.v1.maxTorqueNm, d.v1.maxSpeedDegPerSec))) return d.id;
    }
    return {id: `${meta.part}#motor`, class: 'motor', parts: [meta.part], ids: lpf2 === undefined ? {} : {lpf2},
        source: 'PartMeta v1 motor (inline device: no catalogue device has these numbers)',
        motor: {stallTorqueNm: m.maxTorqueNm, servoMaxDegPerSec: m.maxSpeedDegPerSec}};
};

/**
 * PartMeta v1 → v2 (§5.4), pure: `motor` → internalJoints + device, `sensor` → device +
 * probe, `hub` → hubProfile; every other field as it is, in its place. A meta without v1
 * fields is returned as it is (v2 already). Where a meta holds a v1 field AND its v2 form
 * (a test spreading a v1 field over a v2 entry), the v1 field is the newer word and wins.
 * Memoised per object (metas are read-only data).
 * @param {object} meta
 * @returns {object} PartMetaV2
 */
export const upgradePartMeta = meta => {
    if (!meta || typeof meta !== 'object' || !Object.keys(V1_PART_FIELDS).some(k => meta[k] !== undefined)) return meta;
    if (upgradedParts.has(meta)) return upgradedParts.get(meta);
    const replaced = new Set(Object.keys(V1_PART_FIELDS).filter(k => meta[k] !== undefined).flatMap(k => V1_PART_FIELDS[k]));
    const out = {};
    for (const [k, v] of Object.entries(meta)) {
        if (k === 'motor' && v !== undefined) {
            out.internalJoints = [motorInternalJoint(meta)];
            out.device = motorDevice(meta);
        } else if (k === 'sensor' && v !== undefined) {
            out.device = SPIKE_SENSOR_DEVICE[v?.kind] || String(v?.kind);
            out.probe = {kind: 'ray', origin: v?.origin, direction: v?.direction};
        } else if (k === 'hub' && v !== undefined) {
            out.hubProfile = (v && typeof v.profile === 'string' && v.profile) || DEFAULT_HUB_PROFILE;
        } else if (!replaced.has(k) && v !== undefined) out[k] = v;
    }
    upgradedParts.set(meta, out);
    return out;
};

/** A DeviceModel from a PartMeta v2 `device` (catalogue id or inline), or null. */
export const resolveDevice = device => {
    if (typeof device === 'string') return deviceModels.get(device) || null;
    return device && typeof device === 'object' ? device : null;
};

/** The hub profile id of a hub part (v1 or v2 meta), or null for any other part. */
export const partHubProfile = meta => {
    const m = upgradePartMeta(meta);
    return m && typeof m.hubProfile === 'string' && m.hubProfile ? m.hubProfile : null;
};

/** A motor part's turning joint (the internal joint its device drives), or null. */
export const partMotorJoint = meta => {
    const m = upgradePartMeta(meta);
    return (m && Array.isArray(m.internalJoints) && m.internalJoints.find(j => j && j.actuatedBy === 'device')) || null;
};

/** A hub part's built-in motors (internal joints actuatedBy 'built-in', each with its device and port). */
export const partBuiltInMotors = meta => {
    const m = upgradePartMeta(meta);
    return (m && Array.isArray(m.internalJoints) ? m.internalJoints.filter(j => j && j.actuatedBy === 'built-in') : []);
};

/**
 * Every motor-driven internal joint of a part, with the graph node its moving side becomes:
 * a motor part's one joint ('#out', its device the part's) and a hub's built-in motors
 * ('#out-<joint id>', each its own device and port). [{joint, suffix, device, port}]; port is
 * null for a motor part (the placed part's `!BW PORT` names it).
 */
export const partDrivenJoints = meta => {
    const out = [];
    const motor = partMotorJoint(meta);
    if (motor) out.push({joint: motor, suffix: '#out', device: resolveDevice(upgradePartMeta(meta).device), port: null});
    for (const j of partBuiltInMotors(meta)) out.push({joint: j, suffix: `#out-${j.id}`, device: resolveDevice(j.device), port: j.port});
    return out;
};

/**
 * A part's free internal hinges (actuatedBy 'none'): a wheelset that turns in its housing with nothing
 * driving it, as a train motor's second axle does ('#free-<joint id>', mech/graph.js).
 * [{joint, suffix}]
 */
export const partFreeJoints = meta => {
    const m = upgradePartMeta(meta);
    return (m && Array.isArray(m.internalJoints) ? m.internalJoints : [])
        .filter(j => j && j.actuatedBy === 'none' && j.type === 'hinge')
        .map(j => ({joint: j, suffix: `#free-${j.id}`}));
};

/** Every internal joint that splits its part into graph nodes: the driven ones, then the free ones. */
export const partMovingJoints = meta => [...partDrivenJoints(meta), ...partFreeJoints(meta)];

/**
 * A graph node's share of its part (mech/graph.js makes one node per driven or free joint's moving
 * side and one for the rest): {fraction of the part's mass, collider indices}, or null for a part
 * with no such joint (one node, everything).
 */
export const motorNodeShare = (meta, nodeId) => {
    const driven = partMovingJoints(meta);
    if (!driven.length) return null;
    const moving = driven.find(d => nodeId.endsWith(d.suffix));
    if (moving) return {fraction: moving.joint.massFraction, colliders: [...(moving.joint.movingColliders || [])]};
    const taken = new Set(driven.flatMap(d => d.joint.movingColliders || []));
    const m = upgradePartMeta(meta);
    return {fraction: 1 - driven.reduce((a, d) => a + d.joint.massFraction, 0),
        colliders: m.colliders.map((_, i) => i).filter(i => !taken.has(i))};
};

/** {joint, device} of a motor part (v1 or v2 meta), or null. */
export const partMotor = meta => {
    const joint = partMotorJoint(meta);
    const device = joint && resolveDevice(upgradePartMeta(meta).device);
    return joint && device && device.motor ? {joint, device} : null;
};

/** {device, probe} of a sensor part (v1 or v2 meta), or null. */
export const partSensor = meta => {
    const m = upgradePartMeta(meta);
    const device = m && resolveDevice(m.device);
    return device && device.sensor && m.probe ? {device, probe: m.probe} : null;
};

/** Whether a part plugs into a hub port (a motor or a sensor). */
export const isPortPart = meta => Boolean(partMotorJoint(meta) || partSensor(meta));

/** Determinant of a row-major 3×3. */
export const det3 = m => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);

/** Explicit unordered pair keys with ordered source/surface roles; absent is legacy. */
export const validateInternalEdgeRemovalPairs = (pairs, ids, where) => {
    if (pairs === undefined) return [];
    if (!Array.isArray(pairs)) return [`${where}: need an array of [source, surface] pairs`];
    const out = [], seen = new Set();
    for (const [i, pair] of pairs.entries()) {
        if (!Array.isArray(pair) || pair.length !== 2 || pair.some(id => typeof id !== 'string' || !id || /\s/.test(id) || !ids.has(id)) || pair[0] === pair[1]) {
            out.push(`${where}[${i}]: need two distinct known ids [source, surface]`);
            continue;
        }
        const key = JSON.stringify([...pair].sort());
        if (seen.has(key)) out.push(`${where}[${i}]: duplicate unordered pair`);
        seen.add(key);
    }
    return out;
};

/**
 * @param {PlacedModel} model
 * @param {Map<string, PartMeta>|Record<string, PartMeta>} [catalog] when given, every part must be in it
 * @returns {string[]} problems
 */
export const validatePlacedModel = (model, catalog) => {
    const out = [];
    if (!model || typeof model !== 'object') return ['model: not an object'];
    if (model.version !== 1 && model.version !== 2) out.push(`model.version: expected 1, got ${model.version}`);
    if (model.motorDirection !== undefined && !['legacy', 'motor-frame'].includes(model.motorDirection)) {
        out.push('model.motorDirection: expected legacy or motor-frame');
    }
    if (model.rotor !== undefined && !['legacy', 'native'].includes(model.rotor)) {
        out.push('model.rotor: expected legacy or native');
    }
    if (model.solver !== undefined && model.solver !== 'light-links') out.push('model.solver: expected light-links');
    if (!Array.isArray(model.parts)) return [...out, 'model.parts: not an array'];
    uniqueIds(model.parts, 'model.parts', out);
    out.push(...validateInternalEdgeRemovalPairs(model.internalEdgeRemovalPairs, new Set(model.parts.map(p => p?.id)), 'model.internalEdgeRemovalPairs'));
    if (model.drawings !== undefined) {
        if (!Array.isArray(model.drawings)) out.push('model.drawings: not an array');
        else for (const d of model.drawings) {
            if (!model.parts.some(p => p.id === d?.surface) || !model.parts.some(p => p.id === d?.pen) || d.surface === d.pen ||
                !isVec(d.tip) || !isVec(d.center) || !(isNum(d.radiusLdu) && d.radiusLdu > 0)) {
                out.push('model.drawings: distinct existing surface/pen, finite local tip/centre and positive radius required');
            }
        }
    }
    const has = catalog instanceof Map ? k => catalog.has(k) : k => catalog && Object.hasOwn(catalog, k);
    for (const pl of model.parts) {
        const w = `model.parts[${pl?.id}]`;
        if (typeof pl?.part !== 'string') out.push(`${w}.part: missing`);
        else if (catalog && !has(pl.part)) out.push(`${w}.part: '${pl.part}' is not in the part catalog`);
        if (!isVec(pl?.position)) out.push(`${w}.position: not a Vec3`);
        if (!isVec(pl?.rotation, 9)) out.push(`${w}.rotation: need 9 numbers (row-major 3×3)`);
        if (pl?.pen !== undefined && pl.pen !== true) out.push(`${w}.pen: true (the part draws on the floor) or absent`);
        // Parts are rigid: the editor only ever produces rotations (no mirror, no scale).
        else if (Math.abs(det3(pl.rotation) - 1) > 1e-3) out.push(`${w}.rotation: not a proper rotation (det = ${det3(pl.rotation).toFixed(4)})`);
        if (model.version !== 2) {
            if (pl?.port !== undefined && !HUB_PORTS.includes(pl.port)) out.push(`${w}.port: '${pl.port}' is not ${HUB_PORTS.join('|')}`);
        } else if (pl?.port !== undefined) {
            const ref = portRefOf(pl);
            if (!ref || !ref.port) out.push(`${w}.port: need a port id or {hub, port}`);
            else if (typeof pl.port === 'object' && pl.port.hub !== undefined && !(typeof pl.port.hub === 'string' && model.parts.some(q => q?.id === pl.port.hub))) {
                out.push(`${w}.port.hub: '${pl.port.hub}' is not a part of this model`);
            }
        }
    }
    if (model.belts !== undefined) {
        if (!Array.isArray(model.belts)) out.push('model.belts: not an array');
        else {
            uniqueIds(model.belts, 'model.belts', out);
            const partIds = new Set(model.parts.map(pr => pr.id));
            for (const b of model.belts) {
                const wb = `model.belts[${b?.id}]`;
                if (typeof b?.band !== 'string' || !b.band) out.push(`${wb}.band: the band's part`);
                if (!Array.isArray(b?.around) || b.around.length < 2) out.push(`${wb}.around: at least 2 parts`);
                else for (const pid of b.around) if (!partIds.has(pid)) out.push(`${wb}.around: unknown part '${pid}'`);
            }
        }
    }
    // Decoration (model/ldraw-model.js): drawn as the file has it, never simulated; its parts need not be catalogued.
    if (model.decor !== undefined) {
        if (!Array.isArray(model.decor)) out.push('model.decor: not an array');
        else {
            model.decor.forEach((d, i) => {
                if (typeof d?.part !== 'string' || !isVec(d?.position) || !isVec(d?.matrix, 9)) {
                    out.push(`model.decor[${i}]: {part, color, position: Vec3, matrix: 9 numbers}`);
                }
            });
        }
    }
    if (model.files !== undefined && (typeof model.files !== 'object' || model.files === null ||
        Object.values(model.files).some(t => typeof t !== 'string'))) out.push('model.files: {name: LDraw text}');
    if (model.hoses !== undefined) {
        if (!Array.isArray(model.hoses)) out.push('model.hoses: not an array');
        else {
            uniqueIds(model.hoses, 'model.hoses', out);
            const partIds = new Set(model.parts.map(pr => pr.id));
            for (const h of model.hoses) {
                for (const k of ['a', 'b']) {
                    const e = h?.[k];
                    if (!e || !partIds.has(e.part) || typeof e.port !== 'string') out.push(`model.hoses[${h?.id}].${k}: {part, port} of a part of the model`);
                }
            }
        }
    }
    if (model.ropes !== undefined) {
        if (!Array.isArray(model.ropes)) out.push('model.ropes: not an array');
        else {
            uniqueIds(model.ropes, 'model.ropes', out);
            const partIds = new Set(model.parts.map(pr => pr.id));
            for (const r of model.ropes) {
                const wr = `model.ropes[${r?.id}]`;
                if (!(Number.isFinite(r?.lengthLdu) && r.lengthLdu > 0)) out.push(`${wr}.lengthLdu: a length (LDU)`);
                if (!Array.isArray(r?.around) || r.around.length < 2) out.push(`${wr}.around: a drum and a hook at least`);
                else for (const pid of r.around) if (!partIds.has(pid)) out.push(`${wr}.around: unknown part '${pid}'`);
            }
        }
    }
    if (model.groups !== undefined) {
        if (!Array.isArray(model.groups)) out.push('model.groups: not an array');
        else {
            uniqueIds(model.groups, 'model.groups', out);
            const partIds = new Set(model.parts.map(pr => pr.id));
            const seenParts = new Set();
            for (const gr of model.groups) {
                const wg = `model.groups[${gr?.id}]`;
                if (typeof gr?.name !== 'string' || !gr.name) out.push(`${wg}.name: missing`);
                if (!Array.isArray(gr?.parts)) out.push(`${wg}.parts: not an array`);
                else {
                    if (gr.parts.length < 2) out.push(`${wg}.parts: need at least 2 members`);
                    for (const pid of gr.parts) {
                        if (typeof pid !== 'string') out.push(`${wg}.parts: member is not a string`);
                        else if (!partIds.has(pid)) out.push(`${wg}.parts: unknown part '${pid}'`);
                        else if (seenParts.has(pid)) out.push(`${wg}.parts: part '${pid}' is in two groups`);
                        else seenParts.add(pid);
                    }
                }
            }
        }
    }
    return out;
};

/**
 * The v1 fields of a mechanism (all of v1; v2's derived v1 view). v2: ports are any hub's
 * port ids, joint types those of the joint kind registry.
 * @returns {boolean} false when the arrays are missing (nothing further to check)
 */
const checkMechanismV1 = (m, out, v2 = false, jointTypes = JOINT_TYPES_V1) => {
    if (!v2 && m.version !== 1) out.push(`mechanism.version: expected 1, got ${m.version}`);
    if (!isVec(m.gravity)) out.push('mechanism.gravity: not a Vec3');
    if (m.rotor !== undefined && m.rotor !== 'native' && m.rotor !== 'legacy') out.push('mechanism.rotor: expected native or legacy');
    for (const k of ['bodies', 'joints', 'gears', 'diagnostics']) {
        if (!Array.isArray(m[k])) out.push(`mechanism.${k}: not an array`);
    }
    if (out.length) return false;
    const bodies = uniqueIds(m.bodies, 'bodies', out);
    out.push(...validateInternalEdgeRemovalPairs(m.internalEdgeRemovalPairs, bodies, 'mechanism.internalEdgeRemovalPairs'));
    m.bodies.forEach(b => {
        const w = `bodies[${b?.id}]`;
        if (b?.motion !== 'static' && b?.motion !== 'dynamic') out.push(`${w}.motion: need 'static' or 'dynamic'`);
        if (!isVec(b?.position)) out.push(`${w}.position: not a Vec3`);
        if (!(isVec(b?.rotation, 4) && Math.abs(norm(b.rotation) - 1) < 1e-4)) out.push(`${w}.rotation: not a unit quaternion`);
        if (b?.motion === 'dynamic' && !(isNum(b?.massKg) && b.massKg > 0)) out.push(`${w}.massKg: a dynamic body needs a positive mass`);
        if (!Array.isArray(b?.colliders) || b.colliders.length === 0) out.push(`${w}.colliders: need at least one collider`);
        else b.colliders.forEach((c, i) => checkCollider(c, `${w}.colliders[${i}]`, out));
        if (!Array.isArray(b?.parts)) out.push(`${w}.parts: not an array`);
        if (b?.color !== undefined && !(Number.isInteger(b.color) && b.color >= 0 && b.color <= 10)) out.push(`${w}.color: need an integer 0..10`);
        if (b?.mat !== undefined && typeof b.mat !== 'string') out.push(`${w}.mat: need a string`);
        if (b?.restitution !== undefined && !(isNum(b.restitution) && b.restitution >= 0 && b.restitution <= 1)) out.push(`${w}.restitution: need a number in 0..1`);
        if (b?.material !== undefined && !Object.prototype.hasOwnProperty.call(MATERIALS, b.material)) out.push(`${w}.material: '${b.material}' is not one of ${Object.keys(MATERIALS).join('|')}`);
        if (b?.rollingResistance !== undefined && !(isNum(b.rollingResistance) && b.rollingResistance >= 0 && b.rollingResistance < 1)) {
            out.push(`${w}.rollingResistance: need a number in 0..1`);
        }
    });
    const joints = new Map();
    uniqueIds(m.joints, 'joints', out);
    m.joints.forEach(j => {
        const w = `joints[${j?.id}]`;
        joints.set(j?.id, j);
        if (!v2 && !JOINT_TYPES_V1.includes(j?.type)) out.push(`${w}.type: need 'hinge', 'slider' or 'ball'`);
        if (v2 && !jointTypes.includes(j?.type)) out.push(`${w}.type: '${j?.type}' is not a registered joint kind (${jointTypes.join('|')})`);
        if (!bodies.has(j?.body1)) out.push(`${w}.body1: unknown body '${j?.body1}'`);
        if (j?.body2 !== 'world' && !bodies.has(j?.body2)) out.push(`${w}.body2: unknown body '${j?.body2}'`);
        if (j?.body1 === j?.body2) out.push(`${w}: joins a body to itself`);
        if (!isVec(j?.point)) out.push(`${w}.point: not a Vec3`);
        if (v2 ? j?.type === 'hinge' || j?.type === 'slider' : j?.type !== 'ball') checkUnit(j?.axis, `${w}.axis`, out);
        checkJointExtras(j, w, out);
        if (j?.motor) {
            if (j.type !== 'hinge') out.push(`${w}.motor: only hinges are motorised in v1`);
            if (v2 ? !isPortId(j.motor.port) : !HUB_PORTS.includes(j.motor.port)) out.push(`${w}.motor.port: '${j.motor.port}' is not ${HUB_PORTS.join('|')}`);
            if (!(isNum(j.motor.maxTorqueNm) && j.motor.maxTorqueNm > 0)) out.push(`${w}.motor.maxTorqueNm: need a positive number`);
            if (!(isNum(j.motor.maxSpeedRadPerSec) && j.motor.maxSpeedRadPerSec > 0)) out.push(`${w}.motor.maxSpeedRadPerSec: need a positive number`);
        }
    });
    uniqueIds(m.gears, 'gears', out);
    const jointOfType = (id, type, w) => {
        const j = joints.get(id);
        if (!j) out.push(`${w}: unknown joint '${id}'`);
        else if (j.type !== type) out.push(`${w}: joint '${id}' is a ${j.type}, need a ${type}`);
    };
    m.gears.forEach(g => {
        const w = `gears[${g?.id}]`;
        if (!(isNum(g?.ratio) && g.ratio !== 0)) out.push(`${w}.ratio: need a non-zero number`);
        if (g?.type === 'gear') {
            jointOfType(g.joint1, 'hinge', `${w}.joint1`);
            jointOfType(g.joint2, 'hinge', `${w}.joint2`);
            if (g.joint1 === g.joint2) out.push(`${w}: gears a joint to itself`);
        } else if (g?.type === 'rackAndPinion') {
            jointOfType(g.hingeJoint, 'hinge', `${w}.hingeJoint`);
            jointOfType(g.sliderJoint, 'slider', `${w}.sliderJoint`);
        } else {
            out.push(`${w}.type: need 'gear' or 'rackAndPinion'`);
        }
    });
    if (m.sensors !== undefined) {
        if (!Array.isArray(m.sensors)) out.push('mechanism.sensors: not an array');
        else {
            for (let i = 0; i < m.sensors.length; i++) {
                const s = m.sensors[i];
                const w = `sensors[${i}]`;
                if (v2 ? !isPortId(s?.port) : !HUB_PORTS.includes(s?.port)) out.push(`${w}.port: '${s?.port}' is not ${HUB_PORTS.join('|')}`);
                if (!SENSOR_KINDS.includes(s?.kind)) out.push(`${w}.kind: '${s?.kind}' is not one of ${SENSOR_KINDS.join('|')}`);
                if (!bodies.has(s?.body)) out.push(`${w}.body: unknown body '${s?.body}'`);
                if (!isVec(s?.origin)) out.push(`${w}.origin: not a Vec3`);
                if (!isVec(s?.direction)) out.push(`${w}.direction: not a Vec3`);
                else checkUnit(s.direction, `${w}.direction`, out);
            }
        }
    }
    m.diagnostics.forEach((d, i) => {
        if (d?.severity !== 'error' && d?.severity !== 'warning') out.push(`diagnostics[${i}].severity: need 'error' or 'warning'`);
        if (typeof d?.code !== 'string' || typeof d?.message !== 'string') out.push(`diagnostics[${i}]: need string code and message`);
    });
    return true;
};

const isPortId = p => typeof p === 'string' && p !== '';

/** A joint's optional R3 fields: end stops, friction, a slider motor's force and speed. */
const checkJointExtras = (j, w, out) => {
    if (!j) return;
    if (j.limits !== undefined) {
        if (j.type !== 'hinge' && j.type !== 'slider') out.push(`${w}.limits: only hinges and sliders have limits`);
        else if (!(isVec(j.limits, 2) && j.limits[0] <= 0 && j.limits[1] >= 0)) out.push(`${w}.limits: need [min, max] with min ≤ 0 ≤ max (from the start pose)`);
        else if (j.type === 'hinge' && !(j.limits[0] >= -Math.PI && j.limits[1] <= Math.PI)) out.push(`${w}.limits: a hinge's limits are within [-π, π]`);
    }
    const nonNegative = (key, type) => {
        if (j[key] === undefined) return;
        if (j.type !== type) out.push(`${w}.${key}: only a ${type} has ${key}`);
        else if (!(isNum(j[key]) && j[key] >= 0)) out.push(`${w}.${key}: need a number ≥ 0`);
    };
    nonNegative('frictionNm', 'hinge');
    nonNegative('frictionN', 'slider');
    nonNegative('maxForceN', 'slider');
    if (j.maxSpeedMPerSec !== undefined) {
        if (j.type !== 'slider') out.push(`${w}.maxSpeedMPerSec: only a slider has maxSpeedMPerSec`);
        else if (!(isNum(j.maxSpeedMPerSec) && j.maxSpeedMPerSec > 0)) out.push(`${w}.maxSpeedMPerSec: need a positive number`);
    }
};

/**
 * @param {object} m a CompiledMechanism, v1 or v2
 * @param {{kinds?: {couplings?: object, joints?: object}}} [options] the kind registries
 *        (kinds/index.js) the mechanism was compiled with: coupling and joint kinds beyond
 *        the contract's own (gear, rackAndPinion; hinge, slider, ball) validate through them
 * @returns {string[]} problems; empty when `m` is a valid CompiledMechanism.
 */
export const validateCompiledMechanism = (m, {kinds = null} = {}) => {
    const out = [];
    if (!m || typeof m !== 'object') return ['mechanism: not an object'];
    if (m.version === 2) return validateMechanismV2(m, kinds, out);
    checkMechanismV1(m, out);
    return out;
};

/**
 * LDraw frame (LDU, -y up) → world frame (m, +y up): 180° about x, then scale.
 * @param {Vec3} p
 * @returns {Vec3}
 */
// (0 - v) rather than -v: no -0 in emitted JSON or deepEqual comparisons.
export const lduToWorld = p => [p[0] * LDU_M, (0 - p[1]) * LDU_M, (0 - p[2]) * LDU_M];

/** Direction (unit vector) from LDraw frame to world frame: the same rotation, no scale. */
export const dirToWorld = d => [d[0], 0 - d[1], 0 - d[2]];

// ---- CompiledMechanism v2 ------------------------------------------------------

/**
 * CompiledMechanism v2 (§5.3, §5.7): what compile(model, catalog, {version: 2}) emits and
 * what the physics core and the hub bridge read (they lift a v1 one with
 * upgradeMechanismV1). Everything v1 has, PLUS
 *   bodies[].role         BODY_ROLES; bodies[].collisionGroup 'model' (robot, frame) or
 *                         'world' (ground, obstacles)
 *   hubs        [{id, profile, body}] the model's hub parts (placed id, hub profile, the
 *               body carrying it) in body order. hubs[0] is the hub a port that names
 *               none plugs into.
 *   actuators   [{id, joint, hub, port, device, sign, maxTorqueNm, maxSpeedRadPerSec, ids}]
 *               one per motorised joint, in joint order: what drives it. hub: a hubs[].id,
 *               or null when the model has no hub part (the scene's one hub drives it, as
 *               in v1). device: the DeviceModel id (null: a v1 motor that is no catalogue
 *               device). Its numbers are resolved here — maxTorqueNm the stall torque,
 *               maxSpeedRadPerSec the servo top speed, ids what the hub reports — so the
 *               core and a worker need no device catalogue. sign: device positive vs joint
 *               positive (always 1 so far: §5.3).
 *   couplings   [{id, kind, …}] 'gear' {joint1, joint2, ratio, parts?} (contract ratio as
 *               v1 gears), 'rackAndPinion' {hingeJoint, sliderJoint, ratio}, or a kind
 *               registered in the coupling registry (registry/kinds.js)
 *   devices     [{id, part, device, class, hub, port, body, ids, sensor, probe}] the
 *               devices that are not actuators (sensors), sorted by port: sensor = the
 *               measurement sensors.js makes (v1 kind), probe = {kind: 'ray', origin,
 *               direction} in the world frame at t = 0
 *   noCollide   [[bodyA, bodyB]] sorted, A < B: pairs that must never collide once robot
 *               self-collision is on (owner decision D2; R3 builds the filter): bodies
 *               joined by a joint, bodies that meet on one connector axis, and the two gear
 *               bodies of a coupling.
 *   noCollideParts? [[bodyA, bodyB, [[partA, partB], …]]] a noCollide pair filtered PART BY PART
 *               (mech/collision-filter.js localNoCollide): only those part pairs (partA's colliders
 *               on bodyA, partB's on bodyB: colliders carry `part`) are kept apart, the others
 *               collide. A noCollide pair not listed is filtered whole. With a fourth element 'collide'
 *               the list is inverted: only those part pairs collide (the shorter of the two lists is
 *               written: two frames of 1,000 and 600 parts kept 1.19 million pairs apart, 2026-10-20).
 *   solver?     {lightLinks: {massKg, ratio, velocity, position}} more solver iterations for joints
 *               holding a body below massKg against one ratio times heavier (mech/compile.js
 *               FOREIGN_LIGHT_LINKS, models from elsewhere only); bodies keep their own massKg.
 *               loopBalls?: the ids of the hinges made ball joints to break closed hinge loops (mech/loops.js).
 *               maxLinearVelocity?: m/s no body exceeds (mech/compile.js FOREIGN_MAX_SPEED_M_S).
 *   internalEdgeRemovalPairs? [[sourceBody, surfaceBody]] explicit native query orientation;
 *               immutable session configuration, no body flag changes; absent keeps legacy behavior.
 *   rotor?      'native' when the model declares `0 !BW ROTOR_INERTIA native` (#1494): the core configures
 *               the engine's relative hinge rotor instead of adding the reflected rotor inertia to
 *               both hinge bodies (physics/jolt-core.js setRotorInertia). Absent: the legacy treatment.
 * The v1 fields are the derived v1 VIEW (mechanismV1Aliases): `gears` = the gear and
 * rackAndPinion couplings, `sensors` = the devices, `joint.motor` = the actuator's numbers
 * (port without its hub). validateCompiledMechanism checks they agree; mechanismV1(m)
 * returns the v1 mechanism alone.
 * @typedef {object} CompiledMechanismV2
 */

/** A body's role from v1 data: moving → robot; static with parts → frame (a clamped gearbox); 'ground'; else obstacle. */
export const bodyRole = b => {
    if (b.motion === 'dynamic') return 'robot';
    if (Array.isArray(b.parts) && b.parts.length > 0) return 'frame';
    return b.id === 'ground' ? 'ground' : 'obstacle';
};

/** The collision group of a role: the model's own bodies are one group, the world another. */
export const collisionGroupOf = role => (role === 'robot' || role === 'frame' ? 'model' : 'world');

/** Bodies with `role` and `collisionGroup` (appended, so a v1 view drops them cleanly). */
export const withBodyRoles = bodies => bodies.map(b => {
    // A body the compiler made with its role (a world load, world/objects.js) keeps it.
    const role = BODY_ROLES.includes(b.role) ? b.role : bodyRole(b);
    return {...b, role, collisionGroup: collisionGroupOf(role)};
});

/** The bodies a two-joint coupling ties: each joint's side not shared with the other (the core's gear bodies). */
const coupledBodies = (ja, jb) => {
    if (!ja || !jb) return [];
    const shared = [ja.body1, ja.body2].find(b => b === jb.body1 || b === jb.body2);
    const side = j => (shared === undefined || j.body1 === j.body2 || j.body2 !== shared ? j.body2 : j.body1);
    return [side(ja), side(jb)];
};

/**
 * Body pairs that must never collide (CompiledMechanismV2.noCollide; owner decision D2: everything
 * else does): bodies joined by a joint (hinge, slider, ball, a motor's housing and output), the two
 * bodies a coupling ties (meshing gears, a rack and its pinion), and bodies whose parts are seated
 * in each other's holes (`seated`: the compiler's connector edges between two bodies — the same
 * pairs as the joints today, but an edge that makes no joint still keeps its parts apart).
 * @param {object[]} joints
 * @param {object[]} couplings
 * @param {object} [kinds] kind registries: a registered coupling kind's module may say `bodies(c, joints)`
 * @param {[string, string][]} [seated] body pairs joined by a connector edge
 * @returns {[string, string][]}
 */
export const noCollidePairs = (joints, couplings, kinds = null, seated = []) => {
    const pairs = new Map();
    const add = (a, b) => {
        if (!a || !b || a === b || a === 'world' || b === 'world') return;
        const pair = a.localeCompare(b) < 0 ? [a, b] : [b, a];
        pairs.set(pair.join('|'), pair);
    };
    for (const j of joints) add(j.body1, j.body2);
    for (const [a, b] of seated) add(a, b);
    for (const [a, b] of couplingBodyPairs(joints, couplings, kinds)) add(a, b);
    return [...pairs.values()].sort((p, q) => p[0].localeCompare(q[0]) || p[1].localeCompare(q[1]));
};

/** The body pairs the couplings tie (meshing gears, a rack and its pinion, a registered kind's `bodies`). */
export const couplingBodyPairs = (joints, couplings, kinds = null) => {
    const byId = new Map(joints.map(j => [j.id, j]));
    const out = [];
    for (const c of couplings) {
        let pair = [];
        if (c.kind === 'gear') pair = coupledBodies(byId.get(c.joint1), byId.get(c.joint2));
        else if (c.kind === 'rackAndPinion') pair = coupledBodies(byId.get(c.hingeJoint), byId.get(c.sliderJoint));
        else {
            const module = kinds && kinds.couplings ? kinds.couplings.ofKind(c.kind) : null;
            if (module && typeof module.bodies === 'function') pair = module.bodies(c, joints);
        }
        if (pair.length === 2) out.push(pair);
    }
    return out;
};

/** Coupling kinds the v1 contract has (its `gears` list): the v1 view keeps exactly these. */
export const V1_COUPLING_KINDS = Object.freeze(['gear', 'rackAndPinion']);

/** The v1 `joint.motor` an actuator is (graph.js/joints.js motorOf in v1). */
const motorAlias = a => {
    const motor = {port: a.port, maxTorqueNm: a.maxTorqueNm, maxSpeedRadPerSec: a.maxSpeedRadPerSec};
    if (a.ids && Number.isInteger(a.ids.lpf2)) motor.deviceId = a.ids.lpf2;
    return motor;
};

/**
 * The v1 view of a v2 mechanism's data: joints with `motor`, `gears`, `sensors`.
 * @returns {{joints: object[], gears: object[], sensors: object[]}}
 */
export const mechanismV1Aliases = m => {
    const byJoint = new Map(m.actuators.map(a => [a.joint, a]));
    return {
        joints: m.joints.map(j => {
            const {motor, ...rest} = j;
            const a = byJoint.get(j.id);
            return a ? {...rest, motor: motorAlias(a)} : rest;
        }),
        gears: m.couplings.filter(c => V1_COUPLING_KINDS.includes(c.kind)).map(({id, kind, ...rest}) => ({id, type: kind, ...rest})),
        sensors: m.devices.filter(d => d.sensor).map(d => ({port: d.port, kind: d.sensor, body: d.body, origin: d.probe.origin, direction: d.probe.direction}))
    };
};

/** A v2 mechanism as the v1 mechanism it contains (v1: returned as it is). */
export const mechanismV1 = m => {
    if (!m || m.version !== 2) return m;
    const a = mechanismV1Aliases(m);
    const out = {version: 1, gravity: m.gravity, bodies: m.bodies.map(({role, collisionGroup, ...b}) => b), joints: a.joints, gears: a.gears,
        diagnostics: m.diagnostics};
    if (a.sensors.length > 0) out.sensors = a.sensors;
    if (m.internalEdgeRemovalPairs !== undefined) out.internalEdgeRemovalPairs = m.internalEdgeRemovalPairs;
    return out;
};

/** The catalogue device a v1 motor's LPF2 id is (48, 49), or null. */
const motorDeviceOfLpf2 = lpf2 => {
    if (!Number.isInteger(lpf2)) return null;
    for (const d of deviceModels.values()) if (d.motor && d.ids.lpf2 === lpf2) return d.id;
    return null;
};

/**
 * CompiledMechanism v1 → v2 (§5.7), pure: `joint.motor` → actuators (no hub: the scene's
 * one hub), `gears` → couplings, `sensors` → devices, bodies get roles, and the jointed
 * pairs. The v1 fields stay, unchanged, as the v1 view. A v2 mechanism is returned as it is.
 * Every number the core reads is the v1 number, so a v1 mechanism runs bit-identically.
 */
export const upgradeMechanismV1 = m => {
    if (!m || m.version !== 1) return m;
    const actuators = [];
    for (const j of m.joints) {
        if (!j.motor) continue;
        const lpf2 = j.motor.deviceId;
        actuators.push({id: `a${actuators.length}`, joint: j.id, hub: null, port: j.motor.port, device: motorDeviceOfLpf2(lpf2), sign: 1,
            maxTorqueNm: j.motor.maxTorqueNm, maxSpeedRadPerSec: j.motor.maxSpeedRadPerSec, ids: Number.isInteger(lpf2) ? {lpf2} : {}});
    }
    const couplings = m.gears.map(({id, type, ...rest}) => ({id, kind: type, ...rest}));
    const devices = (m.sensors || []).map((s, i) => {
        const device = SPIKE_SENSOR_DEVICE[s.kind] || null;
        const model = device && deviceModels.get(device);
        return {id: `d${i}`, part: null, device, class: model ? model.class : 'sensor-lpf2', hub: null, port: s.port, body: s.body,
            ids: model ? {...model.ids} : {}, sensor: s.kind, probe: {kind: 'ray', origin: s.origin, direction: s.direction}};
    });
    const out = {version: 2, gravity: m.gravity, bodies: withBodyRoles(m.bodies), joints: m.joints, gears: m.gears, diagnostics: m.diagnostics};
    if (m.sensors !== undefined) out.sensors = m.sensors;
    if (m.rotor !== undefined) out.rotor = m.rotor;
    if (m.internalEdgeRemovalPairs !== undefined) out.internalEdgeRemovalPairs = m.internalEdgeRemovalPairs;
    if (m.solver !== undefined) out.solver = m.solver;
    return Object.assign(out, {hubs: [], actuators, couplings, devices, noCollide: noCollidePairs(m.joints, couplings)});
};

/** JSON with sorted object keys: the aliases are compared as data, not as key order. */
const canonical = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0))) : x));

const validateMechanismV2 = (m, kinds, out) => {
    const jointTypes = kinds && kinds.joints ? kinds.joints.list().map(x => x.type) : JOINT_TYPES_V1;
    if (!checkMechanismV1(m, out, true, jointTypes)) return out;
    for (const k of ['hubs', 'actuators', 'couplings', 'devices', 'noCollide']) {
        if (!Array.isArray(m[k])) out.push(`mechanism.${k}: not an array`);
    }
    if (out.length) return out;
    const bodies = new Set(m.bodies.map(b => b?.id));
    const joints = new Map(m.joints.map(j => [j?.id, j]));
    m.bodies.forEach(b => {
        if (!BODY_ROLES.includes(b?.role)) out.push(`bodies[${b?.id}].role: need ${BODY_ROLES.join('|')}`);
        if (typeof b?.collisionGroup !== 'string' || !b.collisionGroup) out.push(`bodies[${b?.id}].collisionGroup: need a group name`);
    });
    const hubs = uniqueIds(m.hubs, 'hubs', out);
    m.hubs.forEach(h => {
        if (typeof h?.profile !== 'string' || !h.profile) out.push(`hubs[${h?.id}].profile: need a hub profile id`);
        if (!bodies.has(h?.body)) out.push(`hubs[${h?.id}].body: unknown body '${h?.body}'`);
    });
    const hubOk = (hub, w) => {
        if (hub !== null && !hubs.has(hub)) out.push(`${w}.hub: '${hub}' is not one of the mechanism's hubs`);
    };
    uniqueIds(m.actuators, 'actuators', out);
    const actuated = new Set();
    m.actuators.forEach(a => {
        const w = `actuators[${a?.id}]`;
        const j = joints.get(a?.joint);
        if (!j) out.push(`${w}.joint: unknown joint '${a?.joint}'`);
        else if (j.type !== 'hinge') out.push(`${w}.joint: '${a.joint}' is a ${j.type}; only hinges are actuated until R3`);
        if (actuated.has(a?.joint)) out.push(`${w}.joint: '${a.joint}' has two actuators`);
        actuated.add(a?.joint);
        hubOk(a?.hub, w);
        if (!isPortId(a?.port)) out.push(`${w}.port: need a port id`);
        if (a?.device !== null && !(typeof a?.device === 'string' && a.device)) out.push(`${w}.device: a device id or null`);
        if (a?.sign !== 1 && a?.sign !== -1) out.push(`${w}.sign: 1 or -1`);
        if (!(isNum(a?.maxTorqueNm) && a.maxTorqueNm > 0)) out.push(`${w}.maxTorqueNm: need a positive number`);
        if (!(isNum(a?.maxSpeedRadPerSec) && a.maxSpeedRadPerSec > 0)) out.push(`${w}.maxSpeedRadPerSec: need a positive number`);
        if (!a?.ids || typeof a.ids !== 'object') out.push(`${w}.ids: an object`);
    });
    uniqueIds(m.couplings, 'couplings', out);
    const jointOfType = (id, type, w) => {
        const j = joints.get(id);
        if (!j) out.push(`${w}: unknown joint '${id}'`);
        else if (j.type !== type) out.push(`${w}: joint '${id}' is a ${j.type}, need a ${type}`);
    };
    m.couplings.forEach(c => {
        const w = `couplings[${c?.id}]`;
        if (c?.kind === 'gear' || c?.kind === 'rackAndPinion') {
            if (!(isNum(c.ratio) && c.ratio !== 0)) out.push(`${w}.ratio: need a non-zero number`);
            if (c.kind === 'gear') {
                jointOfType(c.joint1, 'hinge', `${w}.joint1`);
                jointOfType(c.joint2, 'hinge', `${w}.joint2`);
                if (c.joint1 === c.joint2) out.push(`${w}: gears a joint to itself`);
            } else {
                jointOfType(c.hingeJoint, 'hinge', `${w}.hingeJoint`);
                jointOfType(c.sliderJoint, 'slider', `${w}.sliderJoint`);
            }
            return;
        }
        const module = kinds && kinds.couplings ? kinds.couplings.ofKind(c?.kind) : null;
        if (!module) out.push(`${w}.kind: '${c?.kind}' is not gear, rackAndPinion or a registered coupling kind`);
        else if (typeof module.validate === 'function') for (const q of module.validate(c, m)) out.push(`${w}: ${q}`);
    });
    uniqueIds(m.devices, 'devices', out);
    m.devices.forEach(d => {
        const w = `devices[${d?.id}]`;
        hubOk(d?.hub, w);
        if (!isPortId(d?.port)) out.push(`${w}.port: need a port id`);
        if (d?.device !== null && !(typeof d?.device === 'string' && d.device)) out.push(`${w}.device: a device id or null`);
        if (!bodies.has(d?.body)) out.push(`${w}.body: unknown body '${d?.body}'`);
        if (!SENSOR_KINDS.includes(d?.sensor)) out.push(`${w}.sensor: '${d?.sensor}' is not one of ${SENSOR_KINDS.join('|')}`);
        if (d?.probe?.kind !== 'ray') out.push(`${w}.probe.kind: need 'ray'`);
        else {
            if (!isVec(d.probe.origin)) out.push(`${w}.probe.origin: not a Vec3`);
            checkUnit(d.probe.direction, `${w}.probe.direction`, out);
        }
    });
    m.noCollide.forEach((pair, i) => {
        if (!(Array.isArray(pair) && pair.length === 2 && bodies.has(pair[0]) && bodies.has(pair[1]) && pair[0].localeCompare(pair[1]) < 0)) {
            out.push(`noCollide[${i}]: need [bodyA, bodyB] of two known bodies, A < B`);
        }
    });
    if (m.noCollideParts !== undefined) {
        const pairs = new Set(m.noCollide.map(p => Array.isArray(p) ? p.join('|') : ''));
        if (!Array.isArray(m.noCollideParts)) out.push('mechanism.noCollideParts: not an array');
        else {
            m.noCollideParts.forEach((entry, i) => {
                const ok = Array.isArray(entry) && (entry.length === 3 || (entry.length === 4 && entry[3] === 'collide')) &&
                    pairs.has(`${entry[0]}|${entry[1]}`) && Array.isArray(entry[2]) &&
                    entry[2].every(pp => Array.isArray(pp) && pp.length === 2 && typeof pp[0] === 'string' && typeof pp[1] === 'string');
                if (!ok) out.push(`noCollideParts[${i}]: need [bodyA, bodyB, [[partA, partB], …]] of a noCollide pair`);
            });
        }
    }
    if (out.length) return out;
    const v1 = mechanismV1Aliases(m);
    if (canonical(m.joints) !== canonical(v1.joints)) out.push('joints[].motor: the v1 view disagrees with actuators');
    if (canonical(m.gears) !== canonical(v1.gears)) out.push('gears: the v1 view disagrees with couplings');
    if (canonical(m.sensors || []) !== canonical(v1.sensors)) out.push('sensors: the v1 view disagrees with devices');
    return out;
};
