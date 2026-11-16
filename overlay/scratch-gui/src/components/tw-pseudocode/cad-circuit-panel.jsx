// SPDX-License-Identifier: BSD-3-Clause
import React from 'react';
import {createPortal} from 'react-dom';
import PropTypes from 'prop-types';
import styles from './cad-circuit-panel.css';
import {readConnections, saveConnections} from '../../lib/bw-cad-circuit/connections.js';
import {availableActuatorJoints, availableCircuitParts, connectionDocumentMismatch, connectionsForDocument,
    emptyCatalog, emptyConnections, nextActuatorConnection, hasDirectCadProgram} from '../../lib/bw-cad-circuit/panel-model.js';
import {observeCircuitCadPanel} from '../../lib/bw-cad-circuit/panel-observer.js';

export default function CadCircuitPanel({vm,locale,colorMode,isVisible,toolbarHost,onEditProgram,onOpenCircuit}) {
    const de=locale.startsWith('de'),text=(en,ger)=>de?ger:en;
    const [config,setConfig]=React.useState(()=>{try{return readConnections();}catch{return null;}});
    const [status,setStatus]=React.useState({phase:'idle',time:0,readings:[]}),[error,setError]=React.useState('');
    const [catalog,setCatalog]=React.useState(emptyCatalog),[expanded,setExpanded]=React.useState(false),[runner,setRunner]=React.useState('blocks');
    const trigger=React.useRef(null),closeButton=React.useRef(null);
    const [mechanical,setMechanical]=React.useState({state:'idle',time:0}),[directRunning,setDirectRunning]=React.useState(false);
    React.useEffect(()=>{
        if(!isVisible)return undefined;
        const refresh=()=>{const next=globalThis.__bwCad?.editor.simulation.state;if(next)setMechanical(previous=>previous.state===next.state&&previous.time===next.time&&previous.error===next.error?previous:next);};
        const stopped=()=>{setDirectRunning(false);refresh();};
        const timer=setInterval(refresh,250);refresh();vm.runtime.on('PROJECT_STOP_ALL',stopped);vm.runtime.on('PROJECT_RUN_STOP',stopped);
        return()=>{clearInterval(timer);vm.runtime.off('PROJECT_STOP_ALL',stopped);vm.runtime.off('PROJECT_RUN_STOP',stopped);};
    },[vm,isVisible]);
    React.useEffect(()=>observeCircuitCadPanel({runtime:vm.runtime,isVisible,expanded,
        onCatalog:setCatalog,onStatus:setStatus,onConnections:setConfig,onError:setError}),[vm,isVisible,expanded]);
    React.useEffect(()=>{if(!isVisible)setExpanded(false);},[isVisible]);
    const close=()=>{setExpanded(false);trigger.current?.focus();};
    React.useEffect(()=>{
        if(!expanded)return undefined;
        closeButton.current?.focus();
        const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
        document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true);
    },[expanded]);
    const current={...emptyConnections(catalog.documentId),...config};
    const mismatch=connectionDocumentMismatch(config,catalog.documentId);
    const coupledActive=['running','preparing','compiling'].includes(status.phase);
    const active=coupledActive||directRunning||['running','preparing'].includes(mechanical.state),editingDisabled=active||mismatch||!catalog.documentId;
    const hasActuators=!!(current.drives.length||current.servos.length);
    const directProgram=hasDirectCadProgram(vm.runtime),canRun=!mismatch&&((current.enabled&&hasActuators)||(runner==='blocks'&&directProgram&&!current.enabled));
    const write=next=>{try{connectionsForDocument(config,catalog.documentId);setConfig(saveConnections(next));setError('');}catch(e){setError(e.message);}};
    const change=(index,key,value)=>write({...current,drives:current.drives.map((d,i)=>i===index?{...d,[key]:value}:d)});
    const execute=async()=>{
        if(!canRun){setExpanded(true);return;}
        if(runner==='blocks'&&!vm.runtime.targets.some(target=>Object.values(target.blocks?._blocks||{}).some(block=>block.opcode==='event_whenflagclicked'))){setError(text('No start program. Add a “when green flag clicked” script in Blocks or Code, or open the Scout example.','Kein Startprogramm. Ergänze in Blöcke oder Code ein Skript „Wenn die grüne Flagge angeklickt wird“, oder öffne das Scout-Beispiel.'));setExpanded(true);return;}
        try{setError('');setExpanded(false);if(!current.enabled&&directProgram){vm.greenFlag();setDirectRunning(true);}else await vm.runtime.cadCircuitSimulation.start(runner);}catch(e){setError(e.message);setExpanded(true);}
    };
    const stop=()=>vm.runtime.cadCircuitSimulation.stop();
    const reset=()=>{try{vm.runtime.cadCircuitSimulation.reset();setError('');}catch(e){setError(e.message);setExpanded(true);}};
    const addActuator=kind=>{
        const next=nextActuatorConnection(catalog,current,kind);
        if(!next){setError(kind==='servo'?text('Add a servo in Circuit and a hinge in CAD first.','Füge zuerst einen Servo in der Schaltung und ein Drehgelenk im CAD hinzu.'):text('Add a motor in Circuit and a hinge or slider in CAD first.','Füge zuerst einen Motor in der Schaltung und ein Dreh- oder Schubgelenk im CAD hinzu.'));return;}
        const {part,joint}=next;
        write(kind==='servo'?{...current,enabled:true,servos:[...current.servos,{partId:part.id,jointId:joint.id,direction:1,centerDeg:90,torqueNm:.02}]}:{...current,enabled:true,drives:[...current.drives,{partId:part.id,jointId:joint.id,kind:joint.kind,direction:1,ratio:1,efficiency:1,leadMm:8}]});
    };
    const openScout=async()=>{
        if(!window.confirm(text('Open Scout? This replaces the current project. Save your work first.','Scout öffnen? Dies ersetzt das aktuelle Projekt. Speichere zuerst deine Arbeit.')))return;
        try{const response=await fetch(new URL('static/circuit-cad/scout-encoder.sb3',document.baseURI));if(!response.ok)throw new Error('Example could not be loaded');const {default:loadProjectFile}=await import('../../lib/bw-project-load.js');vm.stopAll();await loadProjectFile(vm,await response.arrayBuffer(),'scout-encoder.sb3');setError('');}catch(e){setError(e.message);}
    };
    const jointName=j=>`${j.port?`${j.port} · `:''}${j.name||j.id}`;
    const phase={idle:text('Ready','Bereit'),running:text('Running','Läuft'),preparing:text('Preparing…','Wird vorbereitet…'),compiling:text('Compiling…','Wird kompiliert…'),error:text('Needs attention','Bitte prüfen')}[status.phase]||status.phase;
    const problem=error||status.error||mechanical.error;
    if(!toolbarHost)return null;
    return <React.Fragment>
        {createPortal(<div className={`${styles.root} ${styles.toolbar}`} data-color-mode={colorMode} data-testid="bw-cad-program-toolbar">
            <button className={styles.run} data-testid="bw-cad-run" aria-label={text('Run program','Programm starten')} disabled={active} onClick={execute}>▶ {text('Run','Start')}</button>
            <button aria-label={text('Stop program','Programm stoppen')} title={text('Stop program','Programm stoppen')} disabled={!active} onClick={stop}>■</button>
            <button aria-label={text('Reset simulation','Simulation zurücksetzen')} title={text('Reset simulation','Simulation zurücksetzen')} onClick={reset}>↺</button>
            <button ref={trigger} data-testid="bw-cad-program-settings" aria-label={text('Program & connections','Programm und Verbindungen')} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 2 12l6 7M16 5l6 7-6 7M14 3l-4 18" fill="none" stroke="currentColor" strokeWidth="2" /></svg>{text('Program','Programm')}{hasActuators?<span className={styles.count}>{current.drives.length+current.servos.length}</span>:null}</button>
            {problem?<button className={`${styles.status} ${styles.problem}`} title={problem} aria-label={`${text('Run problem','Startproblem')}: ${problem}`} onClick={()=>setExpanded(true)} style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--cad-program-error, #b42318)'}}>{problem}</button>:<output className={styles.status} aria-live="polite">{!coupledActive&&active?text('Running','Läuft'):phase}{active?` · ${(coupledActive?status.time:mechanical.time).toFixed(1)} s`:''}</output>}
        </div>,toolbarHost)}
        {expanded?<aside className={`${styles.root} ${styles.drawer}`} data-color-mode={colorMode} data-testid="bw-cad-circuit-panel" role="dialog" aria-label={text('Program & connections','Programm und Verbindungen')}>
            <header className={styles.header}><h2>{text('Program & connections','Programm und Verbindungen')}</h2><button ref={closeButton} aria-label={text('Close program settings','Programmeinstellungen schließen')} onClick={close}>×</button></header>
            {problem?<p role="alert" className={styles.error}>{problem}</p>:null}
            <section className={styles.section}>
                <h3>{text('1 · Choose a program','1 · Programm wählen')}</h3>
                <p>{text('Runs the program from your Code tab.','Startet das Programm aus deinem Code-Tab.')}</p>
                <label className={styles.field}>{text('Run as','Ausführen als')}<select aria-label={text('Program runner','Programmausführung')} value={runner} disabled={active} onChange={e=>setRunner(e.target.value)}><option value="blocks">{text('Blocks / pseudocode','Blöcke / Pseudocode')}</option><option value="firmware">Arduino Uno</option></select></label>
                {runner==='firmware'?<p>{text('Compiles for the simulated Uno. Internet is needed to compile.','Kompiliert für den simulierten Uno. Dafür ist eine Internetverbindung nötig.')}</p>:null}
                <div className={styles.actions}><button onClick={()=>{setExpanded(false);onEditProgram?.();}}>{text('Edit program','Programm bearbeiten')}</button><button onClick={()=>{setExpanded(false);onOpenCircuit?.();}}>{text('Open circuit','Schaltung öffnen')}</button></div>
            </section>
            <section className={styles.section}>
                <h3>{text('2 · Connect the robot','2 · Roboter verbinden')}</h3>
                <p>{directProgram&&!current.enabled?text('This program uses the model’s CAD motor ports directly.','Dieses Programm verwendet direkt die CAD-Motoranschlüsse des Modells.'):text('Choose what each circuit motor moves in this model.','Wähle, was jeder Schaltungsmotor in diesem Modell bewegt.')}</p>
                {mismatch?<div role="alert"><p>{text('These connections belong to another design.','Diese Verbindungen gehören zu einem anderen Modell.')}</p><button disabled={active} onClick={()=>{try{setConfig(saveConnections(emptyConnections(catalog.documentId)));setError('');}catch(e){setError(e.message);}}}>{text('Clear saved connections','Gespeicherte Verbindungen löschen')}</button></div>:null}
                {!hasActuators&&!directProgram?<div className={styles.empty}><strong>{text('Start with a ready-to-run rover','Starte mit einem fertigen Rover')}</strong><p>{text('Scout includes the model, circuit and program.','Scout enthält Modell, Schaltung und Programm.')}</p><button disabled={active} onClick={openScout}>{text('Open Scout example…','Scout-Beispiel öffnen…')}</button></div>:null}
                {current.drives.map((drive,index)=><div key={`${index}-${drive.partId}`} className={styles.connection}>
                    <div className={styles.pair}><label className={styles.field}>{text('Circuit motor','Schaltungsmotor')}<select aria-label={text('Circuit motor','Schaltungsmotor')} disabled={editingDisabled} value={drive.partId} onChange={e=>change(index,'partId',e.target.value)}>{availableCircuitParts(catalog.motors,current,drive.partId).map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label><span aria-hidden="true">→</span><label className={styles.field}>{text('Moves joint','Bewegt Gelenk')}<select aria-label={text('CAD joint','CAD-Gelenk')} disabled={editingDisabled} value={drive.jointId} onChange={e=>{const joint=catalog.joints.find(j=>j.id===e.target.value);write({...current,drives:current.drives.map((d,i)=>i===index?{...d,jointId:joint.id,kind:joint.kind}:d)});}}>{availableActuatorJoints(catalog.joints,current,drive.partId).map(j=><option key={j.id} value={j.id}>{jointName(j)}</option>)}</select></label></div>
                    <details><summary>{text('Transmission settings','Getriebeeinstellungen')}</summary><div className={styles.fields}>
                        <label>{text('Gear ratio','Übersetzung')}<input type="number" min="0.000001" max="10000" step=".1" value={drive.ratio} disabled={editingDisabled} onChange={e=>change(index,'ratio',Number(e.target.value))}/></label>
                        <label>{text('Efficiency','Wirkungsgrad')}<input type="number" min=".01" max="1" step=".01" value={drive.efficiency} disabled={editingDisabled} onChange={e=>change(index,'efficiency',Number(e.target.value))}/></label>
                        <label><input type="checkbox" checked={drive.direction===-1} disabled={editingDisabled} onChange={e=>change(index,'direction',e.target.checked?-1:1)}/>{text('Reverse direction','Richtung umkehren')}</label>
                        {drive.kind==='slider'?<label>{text('Lead (mm/rev)','Steigung (mm/U)')}<input type="number" min=".01" max="1000" value={drive.leadMm??8} disabled={editingDisabled} onChange={e=>change(index,'leadMm',Number(e.target.value))}/></label>:null}
                        <button disabled={editingDisabled} onClick={()=>write({...current,drives:current.drives.filter((_,i)=>i!==index)})}>{text('Disconnect motor','Motor trennen')}</button>
                    </div></details>
                </div>)}
                {current.servos.map((servo,index)=>{
                    const update=patch=>write({...current,servos:current.servos.map((s,i)=>i===index?{...s,...patch}:s)});
                    return <div key={servo.partId} className={styles.connection}><div className={styles.pair}><label className={styles.field}>Servo<select aria-label={text('Position servo','Positionsservo')} disabled={editingDisabled} value={servo.partId} onChange={e=>update({partId:e.target.value})}>{availableCircuitParts(catalog.servos,current,servo.partId).map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label><span>→</span><label className={styles.field}>{text('Hinge','Drehgelenk')}<select aria-label={text('Servo hinge','Servo-Drehgelenk')} disabled={editingDisabled} value={servo.jointId} onChange={e=>update({jointId:e.target.value})}>{availableActuatorJoints(catalog.joints,current,servo.partId,'hinge').map(j=><option key={j.id} value={j.id}>{jointName(j)}</option>)}</select></label></div><details><summary>{text('Servo settings','Servo-Einstellungen')}</summary><div className={styles.fields}><label>{text('Torque limit (Nm)','Drehmomentgrenze (Nm)')}<input type="number" value={servo.torqueNm} min=".000001" max="100" step=".01" disabled={editingDisabled} onChange={e=>update({torqueNm:Number(e.target.value)})}/></label><label><input type="checkbox" checked={servo.direction===-1} disabled={editingDisabled} onChange={e=>update({direction:e.target.checked?-1:1})}/>{text('Reverse direction','Richtung umkehren')}</label><p>{text('Ideal servo; electrical power draw is not modeled.','Idealer Servo; die elektrische Stromaufnahme wird nicht modelliert.')}</p><button disabled={editingDisabled} onClick={()=>write({...current,servos:current.servos.filter((_,i)=>i!==index)})}>{text('Disconnect servo','Servo trennen')}</button></div></details></div>;
                })}
                <div className={styles.actions}><button disabled={editingDisabled} onClick={()=>addActuator('motor')}>+ {text('Motor','Motor')}</button><button disabled={editingDisabled} onClick={()=>addActuator('servo')}>+ Servo</button></div>
                {hasActuators?<label className={styles.check}><input type="checkbox" checked={current.enabled} disabled={editingDisabled} onChange={e=>write({...current,enabled:e.target.checked})}/>{text('Use circuit program when Run is pressed','Beim Start das Schaltungsprogramm verwenden')}</label>:null}
            </section>
            <details className={styles.section}><summary>{text('Sensors','Sensoren')}{current.sensors.length?` · ${current.sensors.length}`:''}</summary>
                {current.sensors.map((sensor,index)=>{
                    const update=patch=>write({...current,sensors:current.sensors.map((s,i)=>i===index?{...s,...patch}:s)});
                    return <div key={sensor.partId} className={styles.connection}><label className={styles.field}>{text('Distance sensor','Abstandssensor')}<select aria-label={text('Ultrasonic sensor','Ultraschallsensor')} disabled={editingDisabled} value={sensor.partId} onChange={e=>update({partId:e.target.value})}>{availableCircuitParts(catalog.sensors,current,sensor.partId).map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}</select></label><label className={styles.field}>{text('Mounted on','Montiert an')}<select aria-label={text('Sensor body','Sensorkörper')} disabled={editingDisabled} value={sensor.bodyId} onChange={e=>update({bodyId:e.target.value})}>{catalog.bodies.map(b=><option key={b.id} value={b.id}>{b.name||b.id}</option>)}</select></label><details><summary>{text('Mounting & range','Montage und Reichweite')}</summary><div className={styles.fields}>{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis} mm<input type="number" value={sensor.originMm[i]} disabled={editingDisabled} onChange={e=>update({originMm:sensor.originMm.map((v,k)=>k===i?Number(e.target.value):v)})}/></label>)}<label>{text('Direction','Richtung')}<select aria-label={text('Sensor direction','Sensorrichtung')} disabled={editingDisabled} value={sensor.direction.join(',')} onChange={e=>update({direction:e.target.value.split(',').map(Number)})}>{[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map((v,i)=><option key={i} value={v.join(',')}>{['+X','−X','+Y','−Y','+Z','−Z'][i]}</option>)}</select></label><label>{text('Range (mm)','Reichweite (mm)')}<input type="number" min="1" max="100000" disabled={editingDisabled} value={sensor.rangeMm} onChange={e=>update({rangeMm:Number(e.target.value)})}/></label><button disabled={editingDisabled} onClick={()=>write({...current,sensors:current.sensors.filter((_,i)=>i!==index)})}>{text('Disconnect sensor','Sensor trennen')}</button></div></details></div>;
                })}
                <button disabled={editingDisabled} onClick={()=>{const part=availableCircuitParts(catalog.sensors,current)[0],body=catalog.bodies[0];if(!part||!body){setError(text('Add an ultrasonic sensor in Circuit and a body in CAD first.','Füge zuerst einen Ultraschallsensor in der Schaltung und einen CAD-Körper hinzu.'));return;}write({...current,sensors:[...current.sensors,{partId:part.id,bodyId:body.id,originMm:[0,0,0],direction:[1,0,0],rangeMm:4000}]});}}>+ {text('Distance sensor','Abstandssensor')}</button>
            </details>
            <details className={styles.section}><summary>{text('Measurements','Messwerte')}</summary>{status.readings.length?status.readings.map(r=><p key={r.partId}>{r.partId}: {(r.currentA||0).toFixed(3)} A · {((r.velocityRadS||0)*60/(2*Math.PI)).toFixed(1)} rpm</p>):<p>{text('Measurements appear while the program runs.','Messwerte erscheinen während der Programmausführung.')}</p>}</details>
            <footer className={styles.footer}><button className={styles.run} disabled={active||!canRun} onClick={execute}>▶ {text('Run program','Programm starten')}</button><button disabled={active} onClick={()=>{globalThis.__bwCad?.editor.simulation.open();setExpanded(false);}}>{text('Physics preview','Physikvorschau')}</button><button onClick={()=>globalThis.__bwCad?.editor.frame()}>{text('Fit model','Modell einpassen')}</button></footer>
        </aside>:null}
    </React.Fragment>;
}
CadCircuitPanel.propTypes={vm:PropTypes.object.isRequired,locale:PropTypes.string.isRequired,colorMode:PropTypes.string.isRequired,isVisible:PropTypes.bool.isRequired,toolbarHost:PropTypes.object,onEditProgram:PropTypes.func,onOpenCircuit:PropTypes.func};
