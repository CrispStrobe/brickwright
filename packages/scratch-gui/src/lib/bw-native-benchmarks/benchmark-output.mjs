// MIT. Collection only; raw stdout/screen remain separate in every record.
const names=['Score','Memory','Effective addressing','Opcode exercise','Vid adapter speed','3DGame opcode exercise'];
export function collectBenchmarkOutput(manifest,stdout,screen){
 const channel=manifest.resultOutput||'stdout';
 if(!['stdout','screen'].includes(channel))throw Error('unsupported result output channel');
 const text=channel==='screen'?screen.join('\n'):stdout;
 const scores={};
 for(const name of names){
  const line=text.split(/\r?\n/).find(line=>line.startsWith(name+':'));
  if(!line)continue;
  const match=line.slice(name.length+1).trim().match(/^([0-9]+(?:\.[0-9]+)?)(?:\s|$)/);
  if(match)scores[name]=Number(match[1]);
 }
 return {channel,text,scores,scoresValid:names.every(name=>Number.isFinite(scores[name])&&scores[name]>0)};
}
