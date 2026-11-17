// SPDX-License-Identifier: BSD-3-Clause
import {confirmAsync} from './native-dialog.js';
import {CAD_ROBOT_EXAMPLES} from './bw-cad-robot-catalog.js';
import loadProjectFile from './bw-project-load.js';
import {inspectBrickwrightState} from './bw-project-bundle.js';
export const ROBOT_PROJECT_OPENED = 'bw-cad-robot-project-opened';
export async function openCadRobotProject(vm,id,locale='en') {
    const item=CAD_ROBOT_EXAMPLES.find(entry=>entry.id===id);
    if(!item)throw new Error('This shape has no complete robot project');
    const de=locale.startsWith('de');
    const note=de?item.simulationNoteDe:item.simulationNote;
    if(!await confirmAsync((note?`${note}\n\n`:'')+(de?`${item.name} als komplettes Projekt öffnen? Modell, Programm, Schaltung und Widgets werden ersetzt. Speichere zuerst deine Arbeit.`:`Open ${item.name} as a complete project? This replaces the model, program, circuit and widgets. Save your work first.`)))return false;
    const response=await fetch(new URL(`static/cad-robots/${item.file}`,document.baseURI));
    if(!response.ok)throw new Error(de?'Roboterprojekt konnte nicht geladen werden.':'Robot project could not be loaded.');
    const bytes=await response.arrayBuffer(),inspection=await inspectBrickwrightState(bytes);
    if(inspection.outcome!=='loaded'||JSON.parse(inspection.cadText||'null')?.id!==id||!inspection.state?.['bw-ctl-widgets']||!inspection.state?.['bw-circuit-autosave'])throw new Error('Incomplete or incompatible robot project');
    vm.stopAll();await loadProjectFile(vm,bytes,item.file);
    window.dispatchEvent(new CustomEvent(ROBOT_PROJECT_OPENED,{detail:{id,name:item.name}}));
    return true;
}
