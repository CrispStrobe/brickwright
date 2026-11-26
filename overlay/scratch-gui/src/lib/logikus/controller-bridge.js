import {evaluateProgram} from './model.js';
import {validateWorkspace} from './workspace.js';

export const LOGIKUS_TEST_WIDGET = 'logikus_test';
export const LOGIKUS_SWITCH_WIDGETS = Object.freeze(Array.from({length: 10}, (_, index) => `logikus_S${index}`));
export const LOGIKUS_LAMP_WIDGETS = Object.freeze(Array.from({length: 10}, (_, index) => `logikus_L${index}`));

const definitions = [
    ...LOGIKUS_SWITCH_WIDGETS.map((name, index) => ({name, type: 'slider', index})),
    ...LOGIKUS_LAMP_WIDGETS.map((name, index) => ({name, type: 'bargraph', index})),
    {name: LOGIKUS_TEST_WIDGET, type: 'button'}
];
const owned = (widget, type) => widget && widget.config.logikus === true && widget.type === type;
const equalInputs = (a, b) => a && b && a.button === b.button &&
    a.switches.every((value, index) => value === b.switches[index]);

/**
 * The GUI owns this connection, independently of the Lab and Widgets views.
 * install() explicitly adds missing controls; sync() only updates controls
 * already present, so restoring a project cannot resurrect a deleted layout.
 */
export function connectLogikusController (panel, {getWorkspace, onInputs}) {
    let disposed = false;
    let updating = false;
    let lastInputs = null;

    const guarded = action => {
        const previous = updating;
        updating = true;
        try { return action(); } finally { updating = previous; }
    };

    const sync = (input, button = false) => {
        if (disposed) return null;
        const workspace = validateWorkspace(input);
        const inputs = {switches: workspace.switches.slice(), button: Boolean(button)};
        const result = evaluateProgram(workspace.program, inputs);
        lastInputs = inputs;
        if (!workspace.controller) return result;
        guarded(() => {
            for (let index = 0; index < 10; index++) {
                const slider = panel.getWidget(LOGIKUS_SWITCH_WIDGETS[index]);
                if (owned(slider, 'slider')) {
                    if (slider.layout.label !== workspace.program.switchLabels[index]) {
                        panel.setWidgetLayout(slider.name, {label: workspace.program.switchLabels[index]});
                    }
                    if (slider.state.value !== inputs.switches[index]) panel.setSliderInput(slider.name, inputs.switches[index]);
                }
                const lamp = panel.getWidget(LOGIKUS_LAMP_WIDGETS[index]);
                const value = result.lamps[index] ? 1 : 0;
                if (owned(lamp, 'bargraph')) {
                    const label = workspace.program.lampLabels[index];
                    if (lamp.layout.label !== label) panel.setWidgetLayout(lamp.name, {label});
                    if (lamp.config.label !== label) panel.setWidgetConfig(lamp.name, {label});
                    if (lamp.state.value !== value) panel.setBargraphValue(lamp.name, value);
                }
            }
            const test = panel.getWidget(LOGIKUS_TEST_WIDGET);
            if (owned(test, 'button') && test.state.pressed !== inputs.button) {
                panel.setButtonInput(test.name, inputs.button);
            }
        });
        return result;
    };

    const install = input => {
        if (disposed) throw new Error('The Logikus controller connection is closed.');
        const workspace = validateWorkspace(input);
        // Preflight the whole namespace before any widget, label or mode changes.
        for (const {name, type} of definitions) {
            const existing = panel.getWidget(name);
            if (existing && !owned(existing, type)) {
                throw new Error(`Cannot add Logikus controls: widget "${name}" already belongs to another control. Rename it first.`);
            }
        }
        const existing = panel.getWidgets();
        const baseY = existing.length ? Math.max(...existing.map(widget =>
            (Number.isFinite(widget.layout.y) ? widget.layout.y : 0) +
            (Number.isFinite(widget.layout.h) ? widget.layout.h : 160))) + 24 : 24;
        guarded(() => {
            for (const {name, type, index} of definitions) {
                const isSwitch = type === 'slider';
                const label = type === 'button' ? 'Test / T' :
                    (isSwitch ? workspace.program.switchLabels[index] : workspace.program.lampLabels[index]);
                const config = type === 'button' ? {logikus: true, toggle: false, pressed: false} :
                    {logikus: true, min: 0, max: 1, value: isSwitch ? workspace.switches[index] : 0,
                        ...(isSwitch ? {step: 1} : {segments: 1, label})};
                const widget = panel.getWidget(name);
                if (widget) {
                    const changed = Object.fromEntries(Object.entries(config)
                        .filter(([key, value]) => widget.config[key] !== value));
                    if (Object.keys(changed).length) panel.setWidgetConfig(name, changed);
                    if (widget.layout.label !== label) panel.setWidgetLayout(name, {label});
                } else {
                    const layout = type === 'button' ? {x: 24, y: baseY + 360, w: 144, h: 64, label} :
                        {x: 24 + (index % 5) * 164, y: baseY + Math.floor(index / 5) * 176 + (isSwitch ? 76 : 0),
                            w: 144, h: isSwitch ? 76 : 64, label};
                    panel.addWidget(name, type, config, layout);
                }
            }
            panel.setMode('play');
            sync({...workspace, controller: true}, false);
        });
        return {...workspace, controller: true};
    };

    const changed = (kind, detail = {}) => {
        if (disposed || updating) return;
        const workspace = getWorkspace();
        if (!workspace?.controller) return;
        if (kind === 'input') {
            const widget = panel.getWidget(detail.name);
            if (panel.mode !== 'play' ||
                !(LOGIKUS_SWITCH_WIDGETS.includes(detail.name) && owned(widget, 'slider')) &&
                !(detail.name === LOGIKUS_TEST_WIDGET && owned(widget, 'button'))) return;
            const inputs = {
                switches: workspace.switches.map((fallback, index) => {
                    const slider = panel.getWidget(LOGIKUS_SWITCH_WIDGETS[index]);
                    return owned(slider, 'slider') && Number.isFinite(slider.state.value) ?
                        (slider.state.value >= 0.5 ? 1 : 0) : fallback;
                }),
                button: Boolean(owned(panel.getWidget(LOGIKUS_TEST_WIDGET), 'button') &&
                    panel.getWidget(LOGIKUS_TEST_WIDGET).state.pressed)
            };
            if (!equalInputs(inputs, lastInputs)) onInputs(inputs);
            sync({...workspace, switches: inputs.switches}, inputs.button);
        } else if (['add', 'remove', 'rename', 'mode', 'config'].includes(kind)) {
            // Restore handlers add controls one at a time. Each newly added
            // control receives the authoritative workspace value immediately.
            const test = panel.getWidget(LOGIKUS_TEST_WIDGET);
            const button = kind !== 'mode' && panel.mode === 'play' && owned(test, 'button') ?
                Boolean(lastInputs?.button) : false;
            if (lastInputs?.button && !button) onInputs({switches: workspace.switches.slice(), button: false});
            sync(workspace, button);
        }
    };
    panel.addListener(changed);

    return {install, sync, dispose () {
        if (disposed) return;
        panel.removeListener(changed);
        const workspace = getWorkspace();
        // Releasing the button also extinguishes outputs that depend on it.
        if (workspace?.controller) sync(workspace, false);
        disposed = true;
    }};
}
