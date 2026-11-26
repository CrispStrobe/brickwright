// SPDX-License-Identifier: BSD-3-Clause

export function add6502ControllerDevices(panel, board) {
    if (!panel || !board) return 0;
    const parts = board.getParts?.() || [];
    const widgets = panel.getWidgets();
    const boundParts = new Set(widgets
        .filter(widget => widget.binding?.target === 'part')
        .map(widget => `${widget.type}:${widget.binding.partId}`));
    let y = widgets.reduce((bottom, {layout}) =>
        Math.max(bottom, (layout.y || 0) + (layout.h || 128) + 8), 8);
    let added = 0;
    for (const part of parts) {
        const state = board.getDeviceState?.(part.id);
        const type = typeof state?.videoFrame === 'function' ? 'simplevga'
            : state?.fb && part.kind === 'ssd1306' ? 'oled'
                : Array.isArray(state?.text) && /^hd44780/.test(part.kind) ? 'lcd'
                    : part.kind === 'ps2' ? 'keyboard' : null;
        if (!type || boundParts.has(`${type}:${part.id}`)) continue;
        const label = {simplevga: 'Video', lcd: 'LCD', oled: 'OLED', keyboard: 'Keyboard'}[type];
        const base = `${label} · ${part.id}`;
        let name = base;
        for (let n = 2; panel.getWidget(name); n++) name = `${base} (${n})`;
        const layout = {x: 8, y, w: type === 'simplevga' ? 312 : 240,
            h: type === 'simplevga' ? 236 : type === 'oled' ? 150 : 86};
        panel.addWidget(name, type, {}, layout);
        panel.bindToPart(name, part.id);
        y += layout.h + 8;
        added++;
    }
    if (added) panel.setMode('play');
    return added;
}
