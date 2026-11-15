// Selected MIT PXT base/eventcontext.ts and game/scene.ts semantics. Frame
// sampling uses completed callback runtime, not the interval between frames.
// The owning frame worker supplies both lifecycle and clock observations.
// The Microsoft notice is retained in poll-events.LICENSE in this directory.
module.exports = function createGameStats(publish) {
    let enabled = false, lastStats = '', text = '', samples = new Map();
    return {
        reset() {enabled = false;lastStats = '';text = '';samples = new Map();publish('');},
        setEnabled(value) {
            if (typeof value !== 'boolean') throw new TypeError('Arcade game stats requires a Boolean flag');
            // Direct SDK assignment does not clear previously published text.
            enabled = value;
        },
        begin(owner) {samples.set(owner, {frames: 0, runtime: 0});},
        ensure(owner) {if(!samples.has(owner))samples.set(owner,{frames:0,runtime:0});},
        finish(owner, runtime) {
            const sample = samples.get(owner);
            if (!sample) return;
            if (typeof runtime !== 'number' || !Number.isFinite(runtime) || runtime < 0) {
                throw new TypeError('Arcade frame stats requires nonnegative callback runtime');
            }
            sample.runtime += runtime;sample.frames++;
            if (sample.runtime > 1000 || sample.frames > 30) {
                const fps = sample.frames / (sample.runtime / 1000);
                lastStats = 'fps:' + Math.round(fps);
                if (fps < 99) lastStats += '.' + (Math.round(fps * 10) % 10);
                sample.runtime = 0;sample.frames = 0;
            }
        },
        draw(owner, count) {
            if (!enabled || !samples.has(owner)) return;
            if (!Number.isInteger(count) || count < 0) throw new TypeError('Arcade frame stats requires actual sprite membership');
            // Called inside diagnostics, before this frame's finish/sample.
            text = lastStats + ' sprites:' + count;publish(text);
        },
        get enabled() {return enabled;},
        get text() {return text;}
    };
};
