// Original component harness. The firmware below is newly authored test code.
import React, {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import Cp1Panel from '@cp1-panel';
import Cp1Host from '@cp1-host';
import {Cp1Machine} from '@cp1-machine';
const source='VALUE EQU 42\nORG 0\nstart: AKO VALUE\ndisplay: ANZ\nSPU display\n';
const rom=new Uint8Array(2048);
// Original synthetic ROM: configure base8155, light E and fixed dp at physical digit3, then loop.
rom.set([0x23,0xaf,0x3a,0xb8,0x00,0x23,0x0f,0x90,0xb8,0x01,0x23,0x79,0x90,0xb8,0x03,0x23,0x37,0x90,0x04,0x12]);
let machine=new Cp1Machine({rom});machine.advanceCycles(100);
const h=window.__cp1Harness={events:[],failLoad:false,failImport:false,holdConfigure:false,configureWaits:[],snapshot:()=>machine.snapshot(),readCell:i=>machine.readCell(i),state:()=>machine.saveState()};
const mode=new URLSearchParams(location.search).get('mode')||'host';
const locale=new URLSearchParams(location.search).get('locale')||'en';
const colorMode=new URLSearchParams(location.search).get('theme')||'light';
const root=createRoot(document.querySelector('#app'));
function App(){
 const [tick,setTick]=useState(0),[running,setRunning]=useState(false),[config,setConfig]=useState({partId:'cp1-proof',expansion:false,clockHz:6000000}),[text,setText]=useState(source);
 const refresh=()=>setTick(v=>v+1);
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>{machine.advanceCycles(1000);refresh();},50);return()=>clearInterval(timer);},[running]);
 const runner=React.useMemo(()=>({cp1InputMode:()=>h.inputMode||'manual',cp1Snapshot:()=>machine.snapshot(),cp1Key:(key,down)=>{h.events.push(['key',key,down]);machine.setKey(key,down);return true;},cp1ReleaseKeys:()=>{h.events.push(['release']);machine.releaseKeys();},cp1LoadProgram:assembly=>{h.events.push(['load']);if(h.failLoad)throw Error('Synthetic loader rejection');machine.loadProgram(Array.from({length:assembly.bytes.length/2},(_,i)=>({opcode:assembly.bytes[i*2],operand:assembly.bytes[i*2+1]})),{clear:true});refresh();},cp1WriteCell:(address,cell)=>{machine.writeCell(address,cell);refresh();return true;},cp1SetInput:(port,value)=>{machine.setPortInput(port,value);refresh();return true;},cp1Reset:()=>{machine.reset();refresh();return true;},pause:()=>setRunning(false),step:()=>{machine.step();refresh();}}),[]);
 const configure=async next=>{h.events.push(['configure',next]);if(h.holdConfigure)await new Promise(resolve=>h.configureWaits.push(resolve));setConfig(next);machine=new Cp1Machine({rom,expansion:next.expansion});machine.advanceCycles(100);refresh();};
 const importRom=async image=>{h.events.push(['rom',image.name]);if(h.failImport)throw Error('Synthetic ROM rejection');machine=new Cp1Machine({rom:image.bytes,expansion:config.expansion});refresh();};
 h.refresh=refresh;h.config=()=>config;h.unmount=()=>root.unmount();h.runner=runner;h.resolveConfigure=()=>{h.holdConfigure=false;for(const fn of h.configureWaits.splice(0))fn();};
 if(mode==='panel')return <Cp1Panel snapshot={machine.snapshot()} source={text} onSourceChange={setText} running={running} locale={locale} colorMode={colorMode} expansion={config.expansion} onKey={runner.cp1Key} onReleaseKeys={runner.cp1ReleaseKeys} onRun={()=>setRunning(true)} onPause={runner.pause} onStep={runner.step} onReset={runner.cp1Reset} onLoad={runner.cp1LoadProgram} onWriteCell={runner.cp1WriteCell} onPortInput={runner.cp1SetInput} onImportRom={importRom}/>;
 return <Cp1Host runner={runner} running={running} locale={locale} configuration={config} onConfigure={configure} onImportRom={importRom} onRun={()=>setRunning(true)}/>;
}
root.render(<App/>);
