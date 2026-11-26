export const CARDIAC_FACE = 'cardiac';
export const MACHINE_WIDGET_HEIGHT = 416;

export const hasCardiacFace = panel => panel.getWidgets().some(isCardiacFace);
export const isCardiacFace = widget => widget.type === 'machine' && widget.config.face === CARDIAC_FACE;

export const isKim1Face = widget => widget.type === 'machine' && widget.config.face === 'kim1';

function addMachineFace(panel, face, label, partId) {
    if (panel.getWidgets().some(widget => widget.type === 'machine' &&
        widget.config.face === face && widget.config.partId === partId)) return;
    let name = face;
    for (let suffix = 1; panel.getWidget(name); suffix++) name = `${face}${suffix}`;
    const widgets = panel.getWidgets();
    const y = widgets.length ? Math.max(...widgets.map(widget => widget.layout.y + (widget.layout.h || 180))) + 16 : 8;
    return panel.addWidget(name, 'machine', {face, ...(partId ? {partId} : {})},
        {x: 8, y, h: MACHINE_WIDGET_HEIGHT, label});
}

export const addCardiacFace = panel => addMachineFace(panel, CARDIAC_FACE, 'CARDIAC');
export const addKim1Face = (panel, partId) => addMachineFace(panel, 'kim1', 'KIM-1', partId);
