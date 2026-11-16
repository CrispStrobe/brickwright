// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import PropTypes from 'prop-types';
import {CAD_ROBOT_EXAMPLES} from '../../lib/bw-cad-robot-catalog.js';
export default function CadRobotControls({vm,locale,documentId}) {
    const [,refresh]=React.useReducer(n=>n+1,0),de=locale.startsWith('de');
    const example=CAD_ROBOT_EXAMPLES.find(item=>item.id===documentId);
    const note=de?example?.simulationNoteDe:example?.simulationNote;
    const panel=vm.runtime.controllerPanel;
    React.useEffect(()=>{if(!panel)return undefined;const changed=()=>refresh();panel.addListener(changed);return()=>panel.removeListener(changed);},[panel]);
    const widgets=panel?.getWidgets()||[];
    return <section data-testid="bw-cad-robot-controls">
        {note?<p role="status">{note}</p>:null}
        <p>{de?'Drücke Start. Diese Regler sind dieselben Widgets, die dein Programm liest.':'Press Run. These are the same Widgets controls that your program reads.'}</p>
        {widgets.length?widgets.map(widget=>widget.type==='slider'?<label key={widget.name} style={{display:'flex',flexDirection:'column',gap:8,margin:'18px 0'}}>
            <span>{widget.layout.label||widget.name} <output>{widget.state.value}</output></span>
            <input data-testid={`bw-cad-control-${widget.name}`} aria-label={widget.layout.label||widget.name} type="range" min={widget.config.min} max={widget.config.max} step={widget.config.step||1} value={widget.state.value} onChange={e=>panel.setSliderInput(widget.name,Number(e.target.value))}/>
        </label>:null):<p>{de?'Wähle ein Roboterbeispiel, um passende Widgets zu laden.':'Choose a robot example to load its matching Widgets.'}</p>}
        {widgets.some(w=>w.type==='slider')?<button onClick={()=>{for(const w of widgets)if(w.type==='slider')panel.setSliderInput(w.name,w.config.min<0?0:90);}}>{de?'Regler zentrieren':'Center controls'}</button>:null}
        <p>{de?'Blöcke/Pseudocode verwenden. Du kannst die Widgets im Widgets-Editor bearbeiten.':'Use Blocks / pseudocode mode. You can edit these controls in the Widgets editor.'}</p>
    </section>;
}
CadRobotControls.propTypes={vm:PropTypes.object.isRequired,locale:PropTypes.string.isRequired,documentId:PropTypes.string};
