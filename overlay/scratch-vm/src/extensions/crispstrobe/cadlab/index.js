// SPDX-License-Identifier: BSD-3-Clause
const RobotLabBlocks = require('../robotlab/index');
const formatMessage = require('format-message');
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
            stopActions: {...info.menus.stopActions, items: info.menus.stopActions.items.filter(i => i.value !== 'hold')}};
        return info;
    }
    motorMenu () {
        try {
            const motors = this.api()?.motors() || [];
            if (motors.length) return motors.map(m => ({text: `${m.port} · ${m.name}`, value: m.port}));
        } catch (e) { /* editor not ready */ }
        return ['A'];
    }
}
module.exports = CadLabBlocks;
