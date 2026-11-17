// SPDX-License-Identifier: BSD-3-Clause
// Share the native host contract with the CAD viewport. Scope it to this
// workspace so hidden editors and unrelated panels never consume input.
export function installBlocksNativeInput(workspace, ScratchBlocks, target = window) {
    const host = workspace.getInjectionDiv();
    const receive = event => {
        const data = event.detail;
        if (!data || data.handled || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
        const hit = host.ownerDocument.elementFromPoint(data.x, data.y);
        if (!hit || !host.contains(hit) || !workspace.isVisible()) return;
        if (data.kind === 'wheel') {
            if (!Number.isFinite(data.deltaX) || !Number.isFinite(data.deltaY)) return;
            const wheel = new WheelEvent('wheel', {
                bubbles: true, cancelable: true, clientX: data.x, clientY: data.y,
                deltaX: data.deltaX, deltaY: data.deltaY, deltaMode: data.deltaMode || 0,
                ctrlKey: data.ctrlKey, shiftKey: data.shiftKey, altKey: data.altKey, metaKey: data.metaKey
            });
            hit.dispatchEvent(wheel);
            data.handled = wheel.defaultPrevented;
        } else if (data.kind === 'zoom' && Number.isFinite(data.factor) && data.factor > 0 &&
            workspace.svgGroup_.contains(hit)) {
            workspace.cancelCurrentGesture();
            const point = ScratchBlocks.utils.mouseToSvg({clientX: data.x, clientY: data.y},
                workspace.getParentSvg(), workspace.getInverseScreenCTM());
            workspace.zoom(point.x, point.y, Math.log(data.factor) /
                Math.log(workspace.options.zoomOptions.scaleSpeed));
            data.handled = true;
        }
    };
    target.addEventListener('brickwright-camera-input', receive);
    return () => target.removeEventListener('brickwright-camera-input', receive);
}
