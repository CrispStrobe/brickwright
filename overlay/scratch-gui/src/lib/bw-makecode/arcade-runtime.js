/**
 * The small Static TypeScript runtime an exported Arcade program carries when
 * it uses a Scratch construct Arcade has no single call for (export-arcade.js
 * emits only the helpers a program uses, in dependency order).
 *
 * Each helper is Scratch's own semantics written in Arcade's vocabulary:
 *   - broadcasts: a `_Wait` counts the receivers a broadcast started, so
 *     `broadcast and wait` waits for exactly those (pauseUntil n == 0);
 *   - lists are 1-based, an index outside the list reads "" and changes
 *     nothing, and `item # of` / `contains` compare case-insensitively;
 *   - costumes and pen state live in each sprite's `data`, so a clone keeps
 *     its own (its creator's values are copied when it is made);
 *   - `stop`: every script run holds a token; `stop all` and `stop other
 *     scripts` mark tokens dead, and a script checks its own at each yield;
 *   - pen lines are drawn on one transparent 160x120 layer sprite under every
 *     other sprite, so a backdrop switch does not erase them (Scratch's pen
 *     layer sits between the backdrop and the sprites too).
 *
 * @module
 */

/** name -> {deps, ts}. Every helper's TypeScript, compiled by pxt-arcade in the tests. */
export const HELPERS = {
    sdkStrings: {deps: [],ts:`function __bwSdkCharCode(code: any): string { return String.fromCharCode(code) }
`},
    // Separate: an unused concat helper has no callers, so its formals have
    // no producers and a reimport cannot admit its body.
    sdkConcat: {deps: [],ts:`function __bwSdkConcat(left: string, right: any): string { return left.concat(right) }
`},
    scratchTimer: {deps: [],ts:`let __bwScratchTimerStart = control.millis()
function __bwScratchTimer(): number { return (control.millis() - __bwScratchTimerStart) / 1000 }
function __bwResetScratchTimer() { __bwScratchTimerStart = control.millis() }
`},
    wait: {deps: [], ts: `class _Wait {
    n: number
    constructor () { this.n = 0 }
}
function _spawn (w: _Wait, fn: () => void) {
    w.n++
    control.runInParallel(function () {
        fn()
        w.n--
    })
}
function _spawnFor (w: _Wait, fn: (s: Sprite) => void, s: Sprite) {
    w.n++
    control.runInParallel(function () {
        fn(s)
        w.n--
    })
}
function _await (w: _Wait) {
    pauseUntil(() => w.n <= 0)
}`},
    gen: {deps: [], ts: `let _gens: number[] = []
function _genBump (i: number): number {
    while (_gens.length <= i) _gens.push(0)
    _gens[i]++
    return _gens[i]
}
function _genOf (s: Sprite, k: string): number {
    const g = s.data[k]
    return g ? g : 0
}
function _genBumpFor (s: Sprite, k: string): number {
    s.data[k] = _genOf(s, k) + 1
    return s.data[k]
}`},
    // Run tokens, for Scratch's stop block. Every script run takes the next
    // token; \`stop all\` marks every token issued so far dead, so each running
    // script ends at its next yield while a script started later (a key, a
    // broadcast) runs.
    tok: {deps: [], ts: `let _tokens = 0
let _stopMark = 0
function _tok (): number {
    _tokens++
    return _tokens
}
function _dead (t: number): boolean {
    return t <= _stopMark
}`},
    // \`stop other scripts in sprite\` for a sprite that is cloned: the mark and
    // the run it kept live in each instance's data, so it ends the other
    // scripts of THAT clone only (a new clone starts with no mark).
    others: {deps: ['tok'], ts: `function _stopOthers (s: Sprite, t: number) {
    s.data["_sm"] = _tokens
    s.data["_sk"] = t
}
function _othersStopped (s: Sprite, t: number): boolean {
    const m = s.data["_sm"]
    return m ? t <= m && t != s.data["_sk"] : false
}`},
    gone: {deps: [], ts: `function _gone (s: Sprite): boolean {
    return (s.flags & sprites.Flag.Destroyed) != 0
}`},
    touching: {deps: [], ts: `function _touching (me: Sprite, others: Sprite[]): boolean {
    for (const o of others) {
        if (o != me && me.overlapsWith(o)) return true
    }
    return false
}`},
    scratchPose: {deps: [], ts: `function _scratchDirection (s: Sprite): number {
    const d = s.data["_bwScratchDirection"]
    return d === undefined ? 90 : d
}
function _scratchPoint (s: Sprite, d: number) {
    d = ((d % 360) + 360) % 360
    if (d > 180) d -= 360
    s.data["_bwScratchDirection"] = d
    const style = s.data["_bwScratchRotationStyle"]
    const flip = style === "left-right" && d < 0
    if (flip !== !!s.data["_bwScratchFlipped"]) {
        const art = s.image.clone()
        art.flipX()
        s.setImage(art)
        s.data["_bwScratchFlipped"] = flip
    }
    s.rotationDegrees = style === "left-right" || style === "don't rotate" ? 0 : d - 90
}
function _scratchRotationStyle (s: Sprite, style: string) {
    s.data["_bwScratchRotationStyle"] = style
    _scratchPoint(s, _scratchDirection(s))
}
function _scratchPoseCostume (s: Sprite) {
    s.data["_bwScratchFlipped"] = false
    _scratchPoint(s, _scratchDirection(s))
}`},
    scratchEffects: {deps: ['scratchPose'], ts: `function _scratchRenderEffects (s: Sprite, hueTable: number[][]) {
    const raw = s.data["_bwScratchRawArt"] as Image
    const hue = s.data["_bwScratchHue"] || 0
    const ghost = s.data["_bwScratchGhost"] || 0
    const result = hue || ghost ? raw.clone() : raw
    if (hue || ghost) {
        const shift = ((hue % 200) + 200) % 200
        const colours = hueTable[Math.round(shift * hueTable.length / 200) % hueTable.length]
        const threshold = Math.round(16 * (100 - ghost) / 100)
        const dither = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
        for (let y = 0; y < raw.height; y++) {
            for (let x = 0; x < raw.width; x++) {
                const pixel = raw.getPixel(x, y)
                if (pixel) result.setPixel(x, y, dither[(y % 4) * 4 + x % 4] < threshold ? colours[pixel] : 0)
            }
        }
    }
    s.setImage(result)
    if (s.data["_bwScratchRotationStyle"]) _scratchPoseCostume(s)
}
function _scratchEffectsCostume (s: Sprite, hueTable: number[][]) {
    s.data["_bwScratchRawArt"] = s.image
    _scratchRenderEffects(s, hueTable)
}
function _scratchSetEffect (s: Sprite, key: string, by: number, delta: boolean, hueTable: number[][]) {
    let value = (delta ? s.data[key] || 0 : 0) + by
    if (key === "_bwScratchGhost") value = Math.clamp(0, 100, value)
    s.data[key] = value
    _scratchRenderEffects(s, hueTable)
}
function _scratchClearEffects (s: Sprite, hueTable: number[][]) {
    s.data["_bwScratchGhost"] = 0
    s.data["_bwScratchHue"] = 0
    _scratchRenderEffects(s, hueTable)
}`},
    costume: {deps: [], ts: `function _costume (s: Sprite): number {
    const c = s.data["_c"]
    return c ? c : 0
}
function _setCostume (s: Sprite, set: Image[], i: number) {
    i = Math.floor(i) % set.length
    if (i < 0) i += set.length
    s.data["_c"] = i
    s.setImage(set[i])
}`},
    pick: {deps: [], ts: `function _pick (names: string[], v: any, cur: number): number {
    const t = "" + v
    const i = names.indexOf(t)
    if (i >= 0) return i
    if (t == "next costume" || t == "next backdrop") return cur + 1
    if (t == "previous costume" || t == "previous backdrop") return cur - 1
    if (t == "random costume" || t == "random backdrop") return randint(0, names.length - 1)
    const n = parseFloat(t)
    return isNaN(n) ? cur : Math.round(n) - 1
}`},
    list: {deps: [], ts: `function _item (l: any[], i: number): any {
    i = Math.floor(i) - 1
    return i >= 0 && i < l.length ? l[i] : ""
}
function _delItem (l: any[], i: number) {
    i = Math.floor(i) - 1
    if (i >= 0 && i < l.length) l.removeAt(i)
}
function _insItem (l: any[], i: number, v: any) {
    i = Math.floor(i) - 1
    if (i >= 0 && i <= l.length) l.insertAt(i, v)
}
function _setItem (l: any[], i: number, v: any) {
    i = Math.floor(i) - 1
    if (i >= 0 && i < l.length) l[i] = v
}
function _clearList (l: any[]) {
    l.splice(0, l.length)
}
function _findItem (l: any[], v: any): number {
    const t = ("" + v).toLowerCase()
    for (let i = 0; i < l.length; i++) {
        if (("" + l[i]).toLowerCase() == t) return i + 1
    }
    return 0
}
function _listText (l: any[]): string {
    let short = true
    for (const x of l) if (("" + x).length != 1) short = false
    let s = ""
    for (let i = 0; i < l.length; i++) s += (i > 0 && !short ? " " : "") + l[i]
    return s
}`},
    pen: {deps: [], ts: `let _penLayer: Sprite = null
function _penInit () {
    _penLayer = sprites.create(image.create(160, 120), SpriteKind.create())
    _penLayer.setFlag(SpriteFlag.Ghost, true)
    _penLayer.z = -1000
    _penLayer.setPosition(80, 60)
}
function _penSize (s: Sprite): number {
    const z = s.data["_ps"]
    return Math.max(1, Math.round((z ? z : 1) / 3))
}
function _penDot (s: Sprite, x: number, y: number) {
    const w = _penSize(s)
    if (w <= 1) _penLayer.image.setPixel(x, y, s.data["_pc"])
    else _penLayer.image.fillCircle(x, y, w >> 1, s.data["_pc"])
}
function _penLine (s: Sprite, x0: number, y0: number, x1: number, y1: number) {
    const w = _penSize(s)
    const c = s.data["_pc"]
    const h = w >> 1
    for (let dx = -h; dx <= w - 1 - h; dx++) {
        for (let dy = -h; dy <= w - 1 - h; dy++) _penLayer.image.drawLine(x0 + dx, y0 + dy, x1 + dx, y1 + dy, c)
    }
}
function _penTo (s: Sprite, x: number, y: number) {
    const x0 = s.x
    const y0 = s.y
    s.setPosition(x, y)
    if (s.data["_pd"]) _penLine(s, x0, y0, s.x, s.y)
}`},
    penHue: {deps: ['pen'], ts: `function _scratchPenHue (sprite: Sprite, value: number, relative: boolean, table: number[][]) {
    const base = sprite.data["_pcBase"] || sprite.data["_pc"]
    sprite.data["_pcBase"] = base
    const previous = sprite.data["_pcHue"] || 0
    const hue = ((relative ? previous + value : value) % 100 + 100) % 100
    sprite.data["_pcHue"] = hue
    sprite.data["_pc"] = table[Math.round(hue * table.length / 100) % table.length][base]
}`},
    plain: {deps: [], ts: `function _plain (c: number): Image {
    const i = image.create(160, 120)
    i.fill(c)
    return i
}`},
    music: {deps: [], ts: `let _tempo = 60
function _beats (b: number): number {
    return b * 60000 / _tempo
}
function _hz (note: number): number {
    return Math.round(440 * Math.pow(2, (note - 69) / 12))
}`}
};

/** The helpers `used` needs, dependencies first, as TypeScript. */
export function helperSource (used) {
    const seen = new Set();
    const out = [];
    const add = name => {
        if (seen.has(name)) return;
        seen.add(name);
        for (const dep of HELPERS[name].deps) add(dep);
        out.push(HELPERS[name].ts);
    };
    for (const name of Object.keys(HELPERS)) if (used.has(name)) add(name);
    return out;
}

/**
 * Is this sound ONE STEADY TONE, and which? A Scratch sound is sampled audio;
 * Arcade plays tones. A sound that is a single steady pitch (every sound lite's
 * `SOUND name freq` declares, and Scratch's own Pop and Meow placeholders here)
 * has an exact Arcade counterpart: music.playTone(freq, ms). Anything else —
 * a voice, a drum, a chord, a sweep — does not, and says why.
 *
 * Measured, not guessed: the period between upward zero crossings (with
 * hysteresis, so the fade-in and fade-out do not count) must agree within 3%
 * for 90% of the periods.
 *
 * @param {Uint8Array} bytes the sound file
 * @returns {{freq: number, ms: number}|{reason: string}}
 */
export function analyseTone (bytes) {
    if (!bytes || bytes.length < 44) return {reason: 'no audio data'};
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const tag = off => String.fromCharCode(u8[off], u8[off + 1], u8[off + 2], u8[off + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return {reason: 'not a WAV file (compressed audio)'};
    let fmt = null;
    let data = null;
    for (let off = 12; off + 8 <= u8.length;) {
        const id = tag(off);
        const size = dv.getUint32(off + 4, true);
        if (id === 'fmt ') {
            fmt = {format: dv.getUint16(off + 8, true), channels: dv.getUint16(off + 10, true),
                rate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true)};
        } else if (id === 'data') {
            data = {off: off + 8, size: Math.min(size, u8.length - off - 8)};
        }
        off += 8 + size + (size & 1);
    }
    if (!fmt || !data) return {reason: 'unreadable WAV'};
    if (fmt.format !== 1 || (fmt.bits !== 16 && fmt.bits !== 8)) return {reason: 'compressed WAV (not PCM)'};
    const step = (fmt.bits / 8) * fmt.channels;
    const count = Math.floor(data.size / step);
    const sample = i => (fmt.bits === 16 ? dv.getInt16(data.off + (i * step), true) / 32768 :
        (u8[data.off + (i * step)] - 128) / 128);
    let peak = 0;
    for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(sample(i)));
    if (peak < 0.01) return {reason: 'silence'};
    const hi = peak * 0.2;
    const crossings = [];
    let armed = false;
    let prev = sample(0);
    for (let i = 1; i < count; i++) {
        const s = sample(i);
        if (s < -hi) armed = true;
        if (armed && prev <= 0 && s > 0) {
            crossings.push(i - (s / (s - prev)));
            armed = false;
        }
        prev = s;
    }
    if (crossings.length < 8) return {reason: 'too short to hear a pitch'};
    const periods = crossings.slice(1).map((c, i) => c - crossings[i]);
    const sorted = [...periods].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const steady = periods.filter(p => Math.abs(p - median) <= median * 0.03).length;
    if (steady < periods.length * 0.9) return {reason: 'not one steady tone (a voice, noise, a chord or a sweep)'};
    return {freq: Math.round(fmt.rate / median), ms: Math.round(count / fmt.rate * 1000)};
}
