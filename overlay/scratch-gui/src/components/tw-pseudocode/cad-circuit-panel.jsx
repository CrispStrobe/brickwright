// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import PropTypes from 'prop-types';
import styles from './cad-circuit-panel.css';
import {readConnections, saveConnections, CONNECTIONS_EVENT} from '../../lib/bw-cad-circuit/connections.js';
import {STATUS_EVENT} from '../../lib/bw-cad-circuit/bridge.js';
import {CAD_READY_EVENT} from '../../lib/bw-cad-program.js';
const motorKinds = new Set(['dc_motor','gearmotor','dc_motor_encoder']);
export default function CadCircuitPanel({vm,locale,colorMode}) {
    const de=locale.startsWith('de'),text=(en,ger)=>de?ger:en;
    const [config,setConfig]=React.useState(()=>{try{return readConnections();}catch{return null;}});
    const [status,setStatus]=React.useState({phase:'idle',time:0,readings:[]}),[error,setError]=React.useState('');
    const [catalog,setCatalog]=React.useState({motors:[],servos:[],sensors:[],bodies:[],joints:[],documentId:''});
    React.useEffect(()=>{
        let last=0;
        const update=()=>{const editor=globalThis.__bwCad?.editor;
            const parts=vm.runtime.circuitBoard?.parts || [],doc=editor?.session.state.document;
            setCatalog({motors:parts.filter(p=>motorKinds.has(p.kind)),servos:parts.filter(p=>p.kind==='servo'),sensors:parts.filter(p=>p.kind==='ultrasonic'),bodies:(doc?.roots || []).filter(id=>!doc.nodes[id].reference && doc.nodes[id].role!=='hole').map(id=>({id,name:doc.nodes[id].name})),
                joints:[...(editor?.simulation.motors() || []).map(j=>({...j,kind:'hinge'})),...(editor?.simulation.sliders() || []).map(j=>({...j,kind:'slider'}))],documentId:editor?.session.state.document.id || ''});};
        const progress=event=>{const now=performance.now();if(event.detail.phase==='running' && now-last<100)return;last=now;setStatus(event.detail);};
        const loaded=()=>{try{setConfig(readConnections());setError('');}catch(e){setError(e.message);}update();};
        window.addEventListener(STATUS_EVENT,progress);
        for(const name of [CAD_READY_EVENT,'bw-board-ready',CONNECTIONS_EVENT,'bw-project-bundle-loaded'])window.addEventListener(name,loaded);
        const refresh=setInterval(update,1000);update();
        return()=>{clearInterval(refresh);window.removeEventListener(STATUS_EVENT,progress);for(const name of [CAD_READY_EVENT,'bw-board-ready',CONNECTIONS_EVENT,'bw-project-bundle-loaded'])window.removeEventListener(name,loaded);};
    },[vm]);
    const current={version:1,cadDocumentId:catalog.documentId,enabled:false,drives:[],servos:[],sensors:[],...config};
    const write=next=>{try{setConfig(saveConnections(next));setError('');}catch(e){setError(e.message);}};
    const change=(index,key,value)=>write({...current,drives:current.drives.map((d,i)=>i===index?{...d,[key]:value}:d)});
    const active=['running','preparing','compiling'].includes(status.phase);
    const run=mode=>vm.runtime.cadCircuitSimulation.start(mode).catch(e=>setError(e.message));
    return <details data-testid="bw-cad-circuit-panel" className={styles.root} data-color-mode={colorMode}>
        <summary>{text('Circuit → CAD connections','Schaltung → CAD verbinden')}{active?` · ${status.time.toFixed(2)} s`:''}</summary>
        <p>{text('Connect circuit motor shafts to physical CAD joints. Current drives torque; shaft motion feeds back to the circuit and encoders. Run the current blocks/pseudocode, or compile them for the simulated Arduino Uno.','Verbinde Motorwellen der Schaltung mit physischen CAD-Gelenken. Der Strom erzeugt Drehmoment; die Bewegung wirkt auf Schaltung und Encoder zurück. Starte Blöcke/Pseudocode oder kompiliere sie für den simulierten Arduino Uno.')}</p>
        <button disabled={active} onClick={async()=>{
            if(!window.confirm(text('Open the Scout example? This replaces the current project. Save your work first.','Scout-Beispiel öffnen? Dies ersetzt das aktuelle Projekt. Speichere zuerst deine Arbeit.')))return;
            try{const response=await fetch(new URL('static/circuit-cad/scout-encoder.sb3',document.baseURI));if(!response.ok)throw new Error('Example could not be loaded');const {default:loadProjectFile}=await import('../../lib/bw-project-load.js');vm.stopAll();await loadProjectFile(vm,await response.arrayBuffer(),'scout-encoder.sb3');}catch(e){setError(e.message);}
        }}>{text('Open Scout circuit + CAD example…','Scout-Beispiel mit Schaltung und CAD öffnen…')}</button>
        <label><input type="checkbox" checked={current.enabled} disabled={active || !catalog.documentId} onChange={e=>write({...current,enabled:e.target.checked,cadDocumentId:catalog.documentId})}/>{text('Use these connections with the green flag','Diese Verbindungen mit der grünen Flagge verwenden')}</label>
        {current.cadDocumentId && current.cadDocumentId!==catalog.documentId?<p role="alert">{text('Connections belong to a different CAD design. Remove them before reconnecting.','Die Verbindungen gehören zu einem anderen CAD-Modell. Entferne sie und verbinde erneut.')}</p>:null}
        {current.drives.map((drive,index)=><div key={drive.partId} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',margin:'8px 0'}}>
            <select aria-label={text('Circuit motor','Schaltungsmotor')} disabled={active} value={drive.partId} onChange={e=>change(index,'partId',e.target.value)}>
                {!catalog.motors.some(m=>m.id===drive.partId)?<option value={drive.partId}>{drive.partId}</option>:null}
                {catalog.motors.map(m=><option key={m.id} value={m.id}>{m.name || m.id} · {m.kind}</option>)}
            </select><span>→</span>
            <select aria-label={text('CAD joint','CAD-Gelenk')} disabled={active} value={drive.jointId} onChange={e=>{const joint=catalog.joints.find(j=>j.id===e.target.value);write({...current,drives:current.drives.map((d,i)=>i===index?{...d,jointId:joint.id,kind:joint.kind}:d)});}}>
                {!catalog.joints.some(j=>j.id===drive.jointId)?<option value={drive.jointId}>{drive.jointId}</option>:null}
                {catalog.joints.map(j=><option key={j.id} value={j.id}>{j.port} · {j.name} · {j.kind}</option>)}
            </select>
            <label>{text('Ratio','Übersetzung')} <input aria-label={text('Transmission ratio','Getriebeübersetzung')} style={{width:65}} type="number" min="0.001" max="1000" step="0.1" value={drive.ratio??1} disabled={active} onChange={e=>change(index,'ratio',Number(e.target.value))}/></label>
            <label>{text('Efficiency','Wirkungsgrad')} <input style={{width:65}} type="number" min="0.001" max="1" step="0.01" value={drive.efficiency??1} disabled={active} onChange={e=>change(index,'efficiency',Number(e.target.value))}/></label>
            <label><input type="checkbox" checked={drive.direction===-1} disabled={active} onChange={e=>change(index,'direction',e.target.checked?-1:1)}/>{text('Reverse','Umkehren')}</label>
            {drive.kind==='slider'?<label>{text('Lead (mm/rev)','Steigung (mm/U)')} <input style={{width:65}} type="number" min="0.01" max="1000" value={drive.leadMm??8} disabled={active} onChange={e=>change(index,'leadMm',Number(e.target.value))}/></label>:null}
            <button disabled={active} onClick={()=>write({...current,drives:current.drives.filter((_,i)=>i!==index)})}>{text('Remove','Entfernen')}</button>
        </div>)}
        <button disabled={active || !catalog.documentId} onClick={()=>{
            const motor=catalog.motors.find(m=>!current.drives.some(d=>d.partId===m.id)),joint=catalog.joints.find(j=>!current.drives.some(d=>d.jointId===j.id));
            if(!motor || !joint){setError(text('Add a DC motor to the Circuit tab and a hinge or slider to this CAD design first.','Füge zuerst einen Gleichstrommotor in der Schaltung und ein Dreh- oder Schiebegelenk in CAD hinzu.'));return;}
            write({...current,cadDocumentId:catalog.documentId,drives:[...current.drives,{partId:motor.id,jointId:joint.id,kind:joint.kind,direction:1,ratio:1,efficiency:1,leadMm:8}]});
        }}>{text('Connect next motor and joint','Nächsten Motor und Gelenk verbinden')}</button>
        {current.servos.map((servo,index)=><div key={servo.partId} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',margin:'8px 0'}}>
            <select aria-label={text('Position servo','Positionsservo')} disabled={active} value={servo.partId} onChange={e=>write({...current,servos:current.servos.map((s,i)=>i===index?{...s,partId:e.target.value}:s)})}>{catalog.servos.map(s=><option key={s.id} value={s.id}>{s.name || s.id}</option>)}</select><span>→</span>
            <select aria-label={text('Servo hinge','Servo-Drehgelenk')} disabled={active} value={servo.jointId} onChange={e=>write({...current,servos:current.servos.map((s,i)=>i===index?{...s,jointId:e.target.value}:s)})}>{catalog.joints.filter(j=>j.kind==='hinge').map(j=><option key={j.id} value={j.id}>{j.port} · {j.name}</option>)}</select>
            <label>{text('Torque limit (Nm)','Drehmomentgrenze (Nm)')} <input style={{width:70}} type="number" value={servo.torqueNm} min="0.000001" max="100" step="0.01" disabled={active} onChange={e=>write({...current,servos:current.servos.map((s,i)=>i===index?{...s,torqueNm:Number(e.target.value)}:s)})}/></label>
            <label><input type="checkbox" checked={servo.direction===-1} disabled={active} onChange={e=>write({...current,servos:current.servos.map((s,i)=>i===index?{...s,direction:e.target.checked?-1:1}:s)})}/>{text('Reverse','Umkehren')}</label>
            <button disabled={active} onClick={()=>write({...current,servos:current.servos.filter((_,i)=>i!==index)})}>{text('Remove','Entfernen')}</button>
        </div>)}
        <button disabled={active} onClick={()=>{const part=catalog.servos.find(s=>!current.servos.some(d=>d.partId===s.id)),joint=catalog.joints.find(j=>j.kind==='hinge' && ![...current.drives,...current.servos].some(d=>d.jointId===j.id));if(!part || !joint){setError(text('Add a position servo and an unused CAD hinge first.','Füge zuerst einen Positionsservo und ein freies CAD-Drehgelenk hinzu.'));return;}write({...current,cadDocumentId:catalog.documentId,servos:[...current.servos,{partId:part.id,jointId:joint.id,direction:1,centerDeg:90,torqueNm:.02}]});}}>{text('Connect ideal position servo','Idealen Positionsservo verbinden')}</button>
        {current.servos.length?<p>{text('Ideal position servos decode PWM and apply limited torque. Their electrical power draw is not modeled.','Ideale Positionsservos dekodieren PWM und erzeugen begrenztes Drehmoment. Ihre elektrische Stromaufnahme wird nicht modelliert.')}</p>:null}
        {current.sensors.map((sensor,index)=>{
            const update=patch=>write({...current,sensors:current.sensors.map((s,i)=>i===index?{...s,...patch}:s)});
            return <div key={sensor.partId} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',margin:'8px 0'}}>
                <select aria-label={text('Ultrasonic sensor','Ultraschallsensor')} disabled={active} value={sensor.partId} onChange={e=>update({partId:e.target.value})}>{catalog.sensors.map(s=><option key={s.id} value={s.id}>{s.name || s.id}</option>)}</select><span>→</span>
                <select aria-label={text('Sensor body','Sensorkörper')} disabled={active} value={sensor.bodyId} onChange={e=>update({bodyId:e.target.value})}>{catalog.bodies.map(b=><option key={b.id} value={b.id}>{b.name || b.id}</option>)}</select>
                {['X','Y','Z'].map((axis,i)=><label key={axis}>{axis} mm <input style={{width:65}} type="number" value={sensor.originMm[i]} disabled={active} onChange={e=>update({originMm:sensor.originMm.map((v,k)=>k===i?Number(e.target.value):v)})}/></label>)}
                <select aria-label={text('Sensor direction','Sensorrichtung')} disabled={active} value={sensor.direction.join(',')} onChange={e=>update({direction:e.target.value.split(',').map(Number)})}>{[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map((v,i)=><option key={i} value={v.join(',')}>{['+X','−X','+Y','−Y','+Z','−Z'][i]}</option>)}</select>
                <label>{text('Range (mm)','Reichweite (mm)')} <input style={{width:75}} type="number" min="1" max="100000" disabled={active} value={sensor.rangeMm} onChange={e=>update({rangeMm:Number(e.target.value)})}/></label>
                <button disabled={active} onClick={()=>write({...current,sensors:current.sensors.filter((_,i)=>i!==index)})}>{text('Remove','Entfernen')}</button>
            </div>;
        })}
        <button disabled={active} onClick={()=>{const part=catalog.sensors.find(s=>!current.sensors.some(d=>d.partId===s.id)),body=catalog.bodies[0];if(!part || !body){setError(text('Add an ultrasonic sensor and a CAD body first.','Füge zuerst einen Ultraschallsensor und einen CAD-Körper hinzu.'));return;}write({...current,cadDocumentId:catalog.documentId,sensors:[...current.sensors,{partId:part.id,bodyId:body.id,originMm:[0,0,0],direction:[1,0,0],rangeMm:4000}]});}}>{text('Connect ideal distance ray','Idealen Abstandsstrahl verbinden')}</button>
        <button disabled={active || !current.enabled || !(current.drives.length || current.servos.length)} onClick={()=>run('blocks')}>{text('Run blocks / pseudocode','Blöcke / Pseudocode starten')}</button>
        <button disabled={active || !current.enabled || !(current.drives.length || current.servos.length)} onClick={()=>run('firmware')}>{text('Run on simulated Arduino','Auf simuliertem Arduino starten')}</button>
        <button onClick={()=>globalThis.__bwCad?.editor.frame()}>{text('Frame moving model','Bewegtes Modell einpassen')}</button>
        <button onClick={()=>vm.runtime.cadCircuitSimulation.stop()}>{text('Stop','Stopp')}</button>
        <button onClick={()=>{vm.runtime.cadCircuitSimulation.reset();setError('');}}>{text('Reset','Zurücksetzen')}</button>
        <output style={{display:'block'}}>{status.phase} · {status.time.toFixed(3)} s{status.readings.map(r=>` · ${r.partId}: ${(r.currentA||0).toFixed(3)} A, ${((r.velocityRadS||0)*60/(2*Math.PI)).toFixed(1)} rpm`).join('')}</output>
        {error || status.error?<p role="alert">{error || status.error}</p>:null}
    </details>;
}
CadCircuitPanel.propTypes={vm:PropTypes.object.isRequired,locale:PropTypes.string.isRequired,colorMode:PropTypes.string.isRequired};
