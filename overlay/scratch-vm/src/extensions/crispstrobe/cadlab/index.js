// SPDX-License-Identifier: BSD-3-Clause
const RobotLabBlocks = require('../robotlab/index');
const formatMessage = require('format-message');
const ArgumentType = require('../../../extension-support/argument-type');
const BlockType = require('../../../extension-support/block-type');
const Cast = require('../../../util/cast');
const OPS = new Set(['startSimulation', 'stopSimulation', 'resetSimulation', 'setMotorPower', 'setMotorSpeed',
    'runMotorDegrees', 'stopMotor', 'motorAngle', 'motorSpeed', 'labStatus']);
class CadLabBlocks extends RobotLabBlocks {
    api () { return this.runtime && this.runtime.cadSimulation || null; }
    getInfo () {
        const info = super.getInfo();
        const de = String(formatMessage.setup().locale || 'en').startsWith('de');
        info.id = 'cadlab'; info.name = de ? 'CAD-Modelle' : 'CAD models';
        info.color1 = '#2887B8'; info.color2 = '#21739C'; info.color3 = '#185674';
        info.menuIconURI = info.blockIconURI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 3 36 12 36 29 20 38 4 29 4 12Z" fill="#2887b8" stroke="white" stroke-width="2"/><path d="m4 12 16 9 16-9M20 21v17M20 3v10" fill="none" stroke="white" stroke-width="2"/></svg>');
        info.blocks = info.blocks.filter(b => b && OPS.has(b.opcode)).map(b => b.opcode === 'labStatus' ?
            {...b, text: de ? 'CAD-Simulationsstatus' : 'CAD simulation status'} : b);
        info.menus = {motors: info.menus.motors,
            sliders: {acceptReporters: true, items: 'sliderMenu'},
            stopActions: {...info.menus.stopActions, items: info.menus.stopActions.items.filter(i => i.value !== 'hold')}};
        const slider = {type: ArgumentType.STRING, menu: 'sliders', defaultValue: 'A'};
        const speed = {type: ArgumentType.NUMBER, defaultValue: 50};
        info.blocks.push(
            {opcode:'setSliderSpeed',blockType:BlockType.COMMAND,text:de?'Schubgelenk [SLIDER] mit [SPEED] mm/s antreiben':'drive slider [SLIDER] at [SPEED] mm/s',arguments:{SLIDER:slider,SPEED:speed}},
            {opcode:'runSliderDistance',blockType:BlockType.COMMAND,text:de?'Schubgelenk [SLIDER] um [DISTANCE] mm mit [SPEED] mm/s bewegen':'move slider [SLIDER] by [DISTANCE] mm at [SPEED] mm/s',arguments:{SLIDER:slider,DISTANCE:{type:ArgumentType.NUMBER,defaultValue:10},SPEED:speed}},
            {opcode:'stopSlider',blockType:BlockType.COMMAND,text:de?'Schubgelenk [SLIDER] stoppen und [ACTION]':'stop slider [SLIDER] and [ACTION]',arguments:{SLIDER:slider,ACTION:{type:ArgumentType.STRING,menu:'stopActions',defaultValue:'brake'}}},
            {opcode:'sliderPosition',blockType:BlockType.REPORTER,text:de?'Schubgelenk [SLIDER] Position (mm)':'slider [SLIDER] position (mm)',arguments:{SLIDER:slider}},
            {opcode:'sliderSpeed',blockType:BlockType.REPORTER,text:de?'Schubgelenk [SLIDER] Geschwindigkeit (mm/s)':'slider [SLIDER] speed (mm/s)',arguments:{SLIDER:slider}}
        );
        return info;
    }
    motorMenu () {
        try {
            const motors = this.api()?.motors() || [];
            if (motors.length) return motors.map(m => ({text: `${m.port} · ${m.name}`, value: m.port}));
        } catch (e) { /* editor not ready */ }
        return ['A'];
    }
    sliderMenu () {
        try { const sliders=this.api()?.sliders()||[];if(sliders.length)return sliders.map(m=>({text:`${m.port} · ${m.name}`,value:m.port})); } catch(e) { /* editor not ready */ }
        return ['A'];
    }
    setSliderSpeed (a) { return this._call('setSliderSpeed',Cast.toString(a.SLIDER),Cast.toNumber(a.SPEED)); }
    runSliderDistance (a) { return this._call('runSliderDistance',Cast.toString(a.SLIDER),Cast.toNumber(a.DISTANCE),Cast.toNumber(a.SPEED)); }
    stopSlider (a) { return this._call('stopSlider',Cast.toString(a.SLIDER),Cast.toString(a.ACTION)); }
    sliderPosition (a) { return this._read('sliderPosition',0,Cast.toString(a.SLIDER)); }
    sliderSpeed (a) { return this._read('sliderSpeed',0,Cast.toString(a.SLIDER)); }
}
module.exports = CadLabBlocks;
