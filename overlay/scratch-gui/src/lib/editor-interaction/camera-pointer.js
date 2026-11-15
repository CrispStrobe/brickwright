// SPDX-License-Identifier: BSD-3-Clause
// Shared pointer intentions. Each viewport applies its own axes and units.
/**
 * @param {{button:number,shiftKey?:boolean,altKey?:boolean,ctrlKey?:boolean}} event
 * @param {'brickwright'|'studio'|'tinkercad'|'fusion'} preset
 * @param {boolean} [spaceHeld]
 * @returns {'pan'|'orbit'|undefined}
 */
export const cameraPointerIntent = (event, preset, spaceHeld = false) => {
    const robot = preset === 'brickwright' || preset === 'studio';
    if (event.button === 0) {
        if (spaceHeld) return 'pan';
        // Robots reserves Ctrl for connected selection and Alt for part tools.
        return !robot && (event.altKey || event.ctrlKey) ? 'orbit' : undefined;
    }
    if (event.button === 1) return robot ? (preset === 'studio' ? 'pan' : 'orbit') :
        (preset === 'fusion' && event.shiftKey ? 'orbit' : 'pan');
    if (event.button === 2) return robot ? (preset === 'studio' ? 'orbit' : 'pan') :
        (event.shiftKey ? 'pan' : 'orbit');
    return undefined;
};
