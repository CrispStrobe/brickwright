// MIT. Owned native real-mode DOS benchmark startup, with no OS or BIOS image.
export const nativeDosProtocol = 'native-i80386-dos-startup-v3';
export const biosClockPorts = Object.freeze([
  [0x20,0x11], [0x21,0x08], [0x21,0x04], [0x21,0x01],
  [0xa0,0x11], [0xa1,0x70], [0xa1,0x02], [0xa1,0x01],
  [0x21,0xfe], [0xa1,0xff],
  [0x43,0x36], [0x40,0x00], [0x40,0x00],
  [0x43,0x54], [0x41,18],
].map(row=>Object.freeze(row)));

export function initializeNativeDosClock(machine) {
  if(machine.cpuBackend!=='i80386-experimental'||machine.cpu.protectedMode)
    throw Error('native DOS startup requires the real-mode experimental i80386 core');
  // A BIOS normally initializes these devices before DOS starts. The small
  // service shim does not: configure real PIC/PIT devices instead of fabricating
  // BDA ticks. IRQ0 reaches the existing INT08 handler, which updates 40:6C and
  // sends EOI. Channel1 provides the declared AT refresh-channel transitions.
  for(const [port,value] of biosClockPorts) machine._out386(port,value,8);
  // Match the shim's fixed mode3, 80x25 B800 text surface. No ROM/font image.
  const bda=[[0x449,3],[0x44a,80],[0x44b,0],[0x44c,0],[0x44d,0x10],
    [0x44e,0],[0x44f,0],[0x462,0],[0x463,0xd4],[0x464,3],
    [0x484,24],[0x485,16],[0x486,0]];
  for(const [address,value] of bda)machine._write(address,value);
  return {protocol:nativeDosProtocol,ports:biosClockPorts,bda};
}

export function adaptNativeDosService(machine,dos) {
  const cpu=machine.cpu;
  const syncSegments=()=>{
    if(cpu.protectedMode)throw Error('native DOS shim refuses protected-mode service');
    for(const [id,name] of ['es','cs','ss','ds','fs','gs'].entries())
      if(cpu.segmentCaches[id].base!==((cpu[name]<<4)>>>0)) cpu._loadSeg(id,cpu[name]);
  };
  const handled=[];
  const readWord=offset=>machine._read(((cpu.ss<<4)+(offset&0xffff))&0xfffff)|
    (machine._read(((cpu.ss<<4)+((offset+1)&0xffff))&0xfffff)<<8);
  const service=dos.service;
  dos.service=function(){
    const sp=cpu.sp,ss=cpu.ss;
    const at=((ss<<4)+((sp+4)&0xffff))&0xfffff;
    const savedFlags=machine._read(at)|(machine._read(((ss<<4)+((sp+5)&0xffff))&0xfffff)<<8);
    // RBIL INT21 AX4400: only the three declared console handles are owned
    // here. Other handles/subfunctions remain unsupported in the original shim.
    let vector;
    if(cpu.cs===dos.trapSeg&&cpu.ip===0x21*4&&cpu.ax===0x4400&&cpu.bx<=2){
      const handle=cpu.bx;cpu.dx=handle===0?0x81:0x82;
      cpu.ip=readWord(sp);cpu.cs=readWord(sp+2);cpu.sp=(sp+6)&0xffff;
      cpu.flags=(savedFlags&~1)|2;
      handled.push({int:0x21,ax:0x4400,handle,deviceInformation:cpu.dx});vector=0x21;
    }else if(cpu.cs===dos.trapSeg&&cpu.ip===0x10*4&&
      machine.config.chips.some(chip=>chip.kind==='cga')&&
      !machine.config.chips.some(chip=>chip.kind==='vga')&&
      ((cpu.ax===0x1130&&cpu.bh===0)||cpu.ax===0x1a00||(cpu.ah===0x12&&cpu.bl===0x10))){
      if(cpu.protectedMode)throw Error('native DOS shim refuses protected-mode service');
      // The fixed board has CGA, not EGA/VGA. Its BIOS does not implement
      // these extension probes: absence preserves the caller registers.
      // In particular AL must NOT become 1Ah (VGA detection), nor may BH/CX
      // change to EGA feature/memory information. No font pointer is invented.
      const request={ax:cpu.ax,bx:cpu.bx,cx:cpu.cx,dx:cpu.dx,es:cpu.es,bp:cpu.bp};
      cpu.ip=readWord(sp);cpu.cs=readWord(sp+2);cpu.sp=(sp+6)&0xffff;
      cpu.flags=savedFlags|2;
      handled.push({int:0x10,request,response:{...request},outcome:'absent-on-cga',
        capability:request.ax===0x1130?'ega-font-information':request.ax===0x1a00?'vga-display-combination':'ega-information'});
      vector=0x10;
    }else vector=service.call(this);
    if(vector!==null){
      syncSegments();
      // The legacy 8086 service forces F000h in FLAGS. Native 386 IRET must
      // preserve the caller's actual high FLAGS bits. Do not restore on an
      // INT08->INT1C tail transfer, which has not popped the interrupt frame.
      if(cpu.ss===ss&&cpu.sp===((sp+6)&0xffff))cpu.flags=(cpu.flags&0x0fff)|(savedFlags&0xf000);
    }
    return vector;
  };
  return {syncSegments,handled};
}

// Exact native TOPBENCH query sequence observed before this implementation.
// A terminal result cannot qualify by merely deleting unsupported diagnostics.
export function validateNativeCgaQueries(handled){
 const video=handled.filter(item=>item.int===0x10);
 const expected=['ega-font-information','vga-display-combination','ega-information','vga-display-combination','ega-information'];
 return video.length===expected.length&&video.every((item,i)=>{
  const r=item.request;
  return item.outcome==='absent-on-cga'&&item.capability===expected[i]&&r&&
   ['ax','bx','cx','dx','es','bp'].every(key=>Number.isInteger(r[key])&&r[key]>=0&&r[key]<=0xffff&&item.response?.[key]===r[key])&&
   (expected[i]==='ega-font-information'?r.ax===0x1130&&(r.bx>>>8)===0:
    expected[i]==='vga-display-combination'?r.ax===0x1a00:(r.ax>>>8)===0x12&&(r.bx&255)===0x10);
 });
}
