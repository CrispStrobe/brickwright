export const CARDIAC_FACE = 'cardiac';
export const MACHINE_WIDGET_HEIGHT = 416;

export const hasCardiacFace = panel => panel.getWidgets().some(isCardiacFace);
export const isCardiacFace = widget => widget.type === 'machine' && widget.config.face === CARDIAC_FACE;

export const isAceKimFace = widget => widget.type === 'machine' && widget.config.face === 'ace-kim';
export const isKim1VideoFace = widget => widget.type === 'machine' && widget.config.face === 'kim1-video';
export const isKim1Face = widget => widget.type === 'machine' && widget.config.face === 'kim1';

function addMachineFace(panel, face, label, partId, height = MACHINE_WIDGET_HEIGHT) {
    if (panel.getWidgets().some(widget => widget.type === 'machine' &&
        widget.config.face === face && widget.config.partId === partId)) return;
    let name = face;
    for (let suffix = 1; panel.getWidget(name); suffix++) name = `${face}${suffix}`;
    const widgets = panel.getWidgets();
    const y = widgets.length ? Math.max(...widgets.map(widget => widget.layout.y + (widget.layout.h || 180))) + 16 : 8;
    return panel.addWidget(name, 'machine', {face, ...(partId ? {partId} : {})},
        {x: 8, y, h: height, label});
}

export const addCardiacFace = panel => addMachineFace(panel, CARDIAC_FACE, 'CARDIAC');
export const addAceKimFace = panel => addMachineFace(panel, 'ace-kim', 'ACE KIM', undefined, 310);
export const addKim1Face = (panel, partId) => addMachineFace(panel, 'kim1', 'KIM-1', partId);

export const addKim1VideoFace = (panel, partId) => addMachineFace(panel, 'kim1-video', 'K-1008', partId, 300);

export const isMicrotronicFace = widget => widget.type === 'machine' && widget.config.face === 'microtronic';
export const addMicrotronicFace = (panel, partId) => addMachineFace(panel, 'microtronic', 'Busch Microtronic', partId);
