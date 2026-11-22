// SPDX-License-Identifier: BSD-3-Clause
/**
 * CAD shapes: nesting 3D modelling blocks <-> pseudocode words.
 *
 * One table for the `cadshapes` extension blocks (scratch-vm
 * extensions/crispstrobe/cadshapes), the Code tab's `cad …` words
 * (lib/cad-shapes-pseudocode.js) and the block walker that compiles a model to
 * Brickwright CAD (lib/bw-cad-blocks.js). Entries use the arcadeDialect.js word
 * grammar, so a word cannot be readable in one direction and not the other.
 *
 * kind 'loop' is a C-block: its words open an indented body (`cad move x 10 y 0 z 0:`).
 * `shape` names the engine shape (docs/CAD-BLOCKS.md in Brickwright CAD) and `args`
 * maps block inputs to that shape's inputs; the engine's BLOCK_SHAPES holds defaults.
 * Ordinary Scratch control, variables and operators work inside a model unchanged.
 */
export const CADSHAPES_EXTENSION = 'cadshapes';

const shape = (op, words, shapeName, args) => ({op: `cadshapes_${op}`, kind: 'command', words, shape: shapeName, args});
const cblock = (op, words, extra = {}) => ({op: `cadshapes_${op}`, kind: 'loop', words, ...extra});
const xyz = {X: 'x', Y: 'y', Z: 'z'};

export const CADSHAPES_WORDS = Object.freeze([
    cblock('model', 'cad model {NAME}', {stmt: 'model'}),
    shape('box', 'cad box {WIDTH} by {DEPTH} by {HEIGHT}', 'box', {WIDTH: 'width', DEPTH: 'depth', HEIGHT: 'height'}),
    shape('cylinder', 'cad cylinder radius {RADIUS} height {HEIGHT} sides {SIDES}', 'cylinder', {RADIUS: 'radius', HEIGHT: 'height', SIDES: 'sides'}),
    shape('cone', 'cad cone radius {RADIUS} top {TOP} height {HEIGHT} sides {SIDES}', 'cone', {RADIUS: 'radius', TOP: 'top', HEIGHT: 'height', SIDES: 'sides'}),
    shape('sphere', 'cad sphere radius {RADIUS} sides {SIDES}', 'sphere', {RADIUS: 'radius', SIDES: 'sides'}),
    shape('halfSphere', 'cad half sphere radius {RADIUS} sides {SIDES}', 'halfSphere', {RADIUS: 'radius', SIDES: 'sides'}),
    shape('tube', 'cad tube radius {RADIUS} wall {WALL} height {HEIGHT} sides {SIDES}', 'tube', {RADIUS: 'radius', WALL: 'wall', HEIGHT: 'height', SIDES: 'sides'}),
    shape('torus', 'cad torus radius {RADIUS} thickness {THICKNESS} sides {SIDES}', 'torus', {RADIUS: 'radius', THICKNESS: 'thickness', SIDES: 'sides'}),
    shape('wedge', 'cad wedge {WIDTH} by {DEPTH} by {HEIGHT}', 'wedge', {WIDTH: 'width', DEPTH: 'depth', HEIGHT: 'height'}),
    shape('roof', 'cad roof {WIDTH} by {DEPTH} by {HEIGHT}', 'roof', {WIDTH: 'width', DEPTH: 'depth', HEIGHT: 'height'}),
    shape('roundRoof', 'cad round roof {WIDTH} by {DEPTH} by {HEIGHT}', 'roundRoof', {WIDTH: 'width', DEPTH: 'depth', HEIGHT: 'height'}),
    shape('pyramid', 'cad pyramid base {WIDTH} height {HEIGHT}', 'pyramid', {WIDTH: 'width', HEIGHT: 'height'}),
    shape('prism', 'cad polygon radius {RADIUS} sides {SIDES} height {HEIGHT}', 'prism', {RADIUS: 'radius', SIDES: 'sides', HEIGHT: 'height'}),
    shape('star', 'cad star points {POINTS} radius {RADIUS} inner {INNER} height {HEIGHT}', 'star', {POINTS: 'points', RADIUS: 'radius', INNER: 'inner', HEIGHT: 'height'}),
    shape('heart', 'cad heart size {SIZE} height {HEIGHT}', 'heart', {SIZE: 'size', HEIGHT: 'height'}),
    shape('paraboloid', 'cad paraboloid radius {RADIUS} height {HEIGHT} sides {SIDES}', 'paraboloid', {RADIUS: 'radius', HEIGHT: 'height', SIDES: 'sides'}),
    shape('text', 'cad text {TEXT} size {SIZE} height {HEIGHT}', 'text', {SIZE: 'size', HEIGHT: 'height'}),
    cblock('move', 'cad move x {X} y {Y} z {Z}', {stmt: 'move', vector: xyz}),
    cblock('rotate', 'cad rotate x {X} y {Y} z {Z}', {stmt: 'rotate', vector: xyz}),
    cblock('scale', 'cad scale x {X} y {Y} z {Z}', {stmt: 'scale', vector: xyz}),
    cblock('mirror', 'cad mirror {AXIS:x|y|z}', {stmt: 'mirror'}),
    cblock('color', 'cad color {COLOR}', {stmt: 'color'}),
    cblock('group', 'cad group', {stmt: 'group'}),
    cblock('hole', 'cad hole', {stmt: 'hole'}),
    cblock('intersect', 'cad intersect', {stmt: 'intersect'}),
    cblock('hull', 'cad hull', {stmt: 'hull'}),
    cblock('countWith', 'cad count with {VAR:name} from {FROM} to {TO} by {STEP}', {stmt: 'for'}),
    {op: 'cadshapes_lastStatus', kind: 'reporter', words: 'cad model status'}
].map(entry => Object.freeze({...entry, menuExtension: CADSHAPES_EXTENSION})));

export const cadShapesWordFor = opcode => CADSHAPES_WORDS.find(e => e.op === opcode) || null;
export const cadShapesWordsOf = kinds => CADSHAPES_WORDS.filter(e => kinds.includes(e.kind));
/** `cad …` lines that are shapes words rather than the motor words of cadLabDialect.js. */
export const isCadShapesLine = text => /^cad\s+(?:model|box|cylinder|cone|sphere|half\s+sphere|tube|torus|wedge|roof|round\s+roof|pyramid|polygon|star|heart|paraboloid|text|move|rotate|scale|mirror|color|group|hole|intersect|hull|count\s+with)\b/i.test(String(text).trim());
