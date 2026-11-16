import {playerButtonConfiguredSourceSafe} from './player-button-registration-source.js';
const events=Object.freeze({Connected:1,Disconnected:2});
const path=n=>n?.type==='Identifier'?n.name:n?.type==='Member'&&!n.optional?path(n.object)+'.'+n.name:null;
export const playerConnectionConfiguredSourceSafe=files=>playerButtonConfiguredSourceSafe(files,null,true);
export function playerConnectionRegistration(node){
 if(node?.type!=='Call'||node.bwPlayerConnectionRegistration!==true||node.isNew||node.constructorCall||node.optional||node.typeArguments?.length||node.args?.length!==2)return null;
 const player=/^controller\.player([1-4])\.onEvent$/.exec(path(node.callee)||''),event=node.args[0],handler=node.args[1];
 if(!player||event?.type!=='Member'||event.optional||event.object?.type!=='Identifier'||event.object.name!=='ControllerEvent'||!Object.hasOwn(events,event.name)||handler?.type!=='FunctionExpression'||handler.selfName||handler.params?.length||handler.parameterDefaults?.length||handler.optionalParams?.length||['async','isAsync','generator','isGenerator','restParam'].some(k=>handler[k]))return null;
 return {player:Number(player[1]),event:events[event.name]};
}
export function markPlayerConnectionRegistrations(program,safe){
 if(!safe)return program;
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='Call'&&/^controller\.player[1-4]\.onEvent$/.test(path(node.callee)||'')){node.bwPlayerConnectionRegistration=true;if(!playerConnectionRegistration(node))delete node.bwPlayerConnectionRegistration;}for(const value of Object.values(node))if(value&&typeof value==='object')visit(value)};visit(program);return program;
}
