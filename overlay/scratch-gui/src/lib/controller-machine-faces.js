export const CARDIAC_FACE = 'cardiac';
export const MACHINE_WIDGET_HEIGHT = 416;

export const hasCardiacFace = panel => panel.getWidgets().some(isCardiacFace);
export const isCardiacFace = widget => widget.type === 'machine' && widget.config.face === CARDIAC_FACE;

export function addCardiacFace(panel) {
    if (hasCardiacFace(panel)) return;
    let name = CARDIAC_FACE;
    for (let suffix = 1; panel.getWidget(name); suffix++) name = `${CARDIAC_FACE}${suffix}`;
    const widgets = panel.getWidgets();
    const y = widgets.length ? Math.max(...widgets.map(widget => widget.layout.y + (widget.layout.h || 180))) + 16 : 8;
    return panel.addWidget(name, 'machine', {face: CARDIAC_FACE}, {x: 8, y, h: MACHINE_WIDGET_HEIGHT, label: 'CARDIAC'});
}
