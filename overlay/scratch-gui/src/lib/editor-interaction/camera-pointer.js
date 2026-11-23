// SPDX-License-Identifier: BSD-3-Clause
// Shared pointer intentions. Each viewport applies its own axes and units.
/**
 * @param {{button:number,shiftKey?:boolean,altKey?:boolean,ctrlKey?:boolean}} event
 * @param {'brickwright'|'studio'|'tinkercad'|'fusion'} preset
 * @param {boolean} [spaceHeld]
 * @param {'pan'|'orbit'} [secondaryDrag]
 * @returns {'pan'|'orbit'|undefined}
 */
export const cameraPointerIntent = (event, preset, spaceHeld = false, secondaryDrag) => {
    const robot = preset === 'brickwright' || preset === 'studio';
    if (event.button === 0) {
        if (spaceHeld) return 'pan';
        // Robots reserves Ctrl for connected selection and Alt for part tools.
        return !robot && (event.altKey || event.ctrlKey) ? 'orbit' : undefined;
    }
    if (event.button === 1 && secondaryDrag) return event.shiftKey ? 'orbit' : 'pan';
    if (event.button === 1) return robot ? (preset === 'studio' ? 'pan' : 'orbit') :
        (preset === 'fusion' && event.shiftKey ? 'orbit' : 'pan');
    if (event.button === 2 && secondaryDrag) {
        return event.shiftKey ? alternateDrag(secondaryDrag) : secondaryDrag;
    }
    if (event.button === 2) return robot ? (preset === 'studio' ? 'orbit' : 'pan') :
        (event.shiftKey ? 'pan' : 'orbit');
    return undefined;
};

const alternateDrag = action => action === 'orbit' ? 'pan' : 'orbit';

/**
 * Normalize high-resolution scroll from the browser and the macOS input bridge.
 * @param {{deltaX:number,deltaY:number,deltaMode:number,precise?:boolean,ctrlKey?:boolean,shiftKey?:boolean,altKey?:boolean}} event
 * @param {'pan'|'orbit'|'zoom'} slide
 * @param {number} height
 * @returns {{kind:'pan'|'orbit'|'zoom',dx:number,dy:number}|undefined}
 */
export const cameraTrackpadWheel = (event, slide, height) => {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const dx = Math.max(-1000, Math.min(1000, event.deltaX * unit));
    const dy = Math.max(-1000, Math.min(1000, event.deltaY * unit));
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return undefined;

    const precise = event.precise ?? (event.deltaMode === 0 &&
        (dx !== 0 || Math.abs(dy) < 50 || !Number.isInteger(dy)));
    if (event.ctrlKey || !precise) return {kind: 'zoom', dx, dy};
    const kind = event.altKey ? 'orbit' : event.shiftKey ? alternateDrag(slide) : slide;
    return {kind, dx, dy};
};
