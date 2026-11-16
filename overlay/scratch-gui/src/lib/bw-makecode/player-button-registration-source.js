import {resetArraySyntaxAdmits} from './reset-closed-string-array-source.js';
import {parseMakeCodeTs,tokenize} from './ts-import.js';
const buttons=Object.freeze({A:'A',B:'B',Left:'left',Up:'up',Right:'right',Down:'down'});
const events=Object.freeze({Pressed:2049,Released:2048,Repeated:2054});
const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'&&!node.optional?path(node.object)+'.'+node.name:null;
const ambient=new Set(['this','globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__','require','module','exports']);
const writes=new Set(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>=','++','--']);
const controlCalls=new Set(['control.onEvent','control.raiseEvent','control.waitForEvent','control.allocateNotifyEvent','control.runInParallel','control.pause','control.millis']);
const gameCalls=new Set(['onUpdate','onUpdateInterval','onPaint','onShade','forever','pushScene','popScene','addScenePushHandler','addScenePopHandler','removeScenePushHandler','removeScenePopHandler','runtime','splash','showLongText','ask','askForString','askForNumber','over','gameOver','reset','setGameOverEffect','setGameOverMessage','setGameOverScoringType','setGameOverPlayable','setDialogFrame','setDialogCursor','setDialogTextColor']);
const controllerCall=name=>/^controller\.player[1-4]\.onButtonEvent$/.test(name)||/^controller\.(?:player[1-4]\.)?(?:A|B|up|down|left|right)\.(?:onEvent|isPressed|pauseUntil)$/.test(name)||/^controller\.(?:player[1-4]\.)?(?:moveSprite|stopControllingSprite|dx|dy|isPressed)$/.test(name)||['controller.setRepeatDefault','controller._setUserEventsEnabled','controller.pauseUntilAnyButtonIsPressed'].includes(name);
export function playerButtonConfiguredSourceSafe(files,provenArraySyntax=null,connection=false){
 try{
  const sdkNames=new Set(['controller','ControllerButton','ControllerButtonEvent','control','game',...(connection?['ControllerEvent']:[])]);
  const config=JSON.parse(files['pxt.json']||'null'),names=config?.files??['main.ts'],tests=config?.testFiles??[];
  if(!Array.isArray(names)||!Array.isArray(tests)||![...names,...tests].every(n=>typeof n==='string')||config&&(config.dependencies?.device!=='*'||Object.keys(config.dependencies).some(n=>n!=='device')))return false;
  for(const name of new Set([...names,...tests])){
   if(!/\.(?:ts|py|asm|c|cpp|h|js)$/.test(name))continue;
   const file=Object.getOwnPropertyDescriptor(files,name);if(!file||!Object.hasOwn(file,'value')||typeof file.value!=='string'||config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return false;
   if(/\.py$/.test(name)&&['tsprj','blocksprj'].includes(config?.preferredEditor))continue;
   if(!/\.ts$/.test(name)||/\.d\.ts$/.test(name)||/\/\/\s*%|\/\*\s*%/.test(file.value))return false;
   const parsed=parseMakeCodeTs(file.value,{namedFunctionExpressions:true,parameterDefaults:true,retainClassHeritage:true}),suffixes=new Set();let unknown=false;
   const writesSdk=target=>{if(!target||typeof target!=='object')return false;let root=target;while(['Member','Index'].includes(root?.type))root=root.object;if(root?.type==='Identifier'&&sdkNames.has(root.name))return true;if(target.type==='Array')return target.items.some(writesSdk);if(target.type==='Object')return target.props.some(row=>writesSdk(row.value));return false;};
   const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='Unknown'||node.opaque)unknown=true;if(node.type==='Assignment'||node.type==='Update'||node.type==='Unary'&&node.op==='delete'){if(writesSdk(node.type==='Assignment'?node.left:node.argument))unknown=true;}if(node.type==='Declaration')for(const d of node.decls||[])if(['Sprite[]','Image[]'].includes(d.typeName?.replace(/\s/g,'')))suffixes.add(d.name);for(const value of Object.values(node))if(value&&typeof value==='object')visit(value)};visit(parsed);if(unknown)return false;
   const tokens=tokenize(file.value);
   for(let i=0;i<tokens.length;i++){
    const t=tokens[i],before=tokens[i-1];if(t.unknownBefore||t.invalidLiteral||t.type==='template'&&t.value.includes('${'))return false;
    if(['ident','string'].includes(t.type)&&ambient.has(t.value))return false;
    const typeSuffix=['let','const','var'].includes(tokens[i-4]?.type)&&tokens[i-3]?.type==='ident'&&suffixes.has(tokens[i-3].value)&&tokens[i-2]?.value===':'&&['Sprite','Image'].includes(before?.value)&&t.value==='['&&tokens[i+1]?.value===']'&&tokens[i+2]?.value==='=';
    if(t.value==='['&&!typeSuffix&&!resetArraySyntaxAdmits(provenArraySyntax,files,name,file.value,i)&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return false;
    if(t.type!=='ident'||!sdkNames.has(t.value))continue;
    let end=i,top=t.value;while(tokens[end+1]?.value==='.'&&tokens[end+2]?.type==='ident'){top+='.'+tokens[end+2].value;end+=2;}
    if(before?.value==='.'||['new','function','class','namespace','delete'].includes(before?.value))return false;
    const after=tokens[end+1],isCall=after?.value==='('&&(t.value==='controller'&&(controllerCall(top)||connection&&/^controller\.player[1-4]\.onEvent$/.test(top))||t.value==='control'&&controlCalls.has(top)||t.value==='game'&&gameCalls.has(top.slice(5)));
    const scalar=connection&&(t.value==='ControllerEvent'&&['ControllerEvent.Connected','ControllerEvent.Disconnected'].includes(top)||/^controller\.player[1-4]\.id$/.test(top))||t.value==='ControllerButton'&&Object.hasOwn(buttons,top.slice(17))||t.value==='ControllerButtonEvent'&&Object.hasOwn(events,top.slice(22))||/^controller\.(?:player[1-4]\.)?(?:A|B|up|down|left|right)\.(?:repeatDelay|repeatInterval)$/.test(top);
    if(!isCall&&!(scalar&&!writes.has(after?.value)&&!['++','--'].includes(before?.value)))return false;
   }
  }
  return true;
 }catch{return false;}
}
export function playerButtonRegistration(node){
 if(node?.type!=='Call'||node.bwPlayerButtonRegistration!==true||node.isNew||node.constructorCall||node.optional||node.typeArguments?.length||node.args?.length!==3)return null;
 const player=/^controller\.player([1-4])\.onButtonEvent$/.exec(path(node.callee)||''),button=node.args[0],event=node.args[1],handler=node.args[2];
 if(!player||button?.type!=='Member'||button.optional||button.object?.type!=='Identifier'||button.object.name!=='ControllerButton'||!Object.hasOwn(buttons,button.name)||event?.type!=='Member'||event.optional||event.object?.type!=='Identifier'||event.object.name!=='ControllerButtonEvent'||!Object.hasOwn(events,event.name)||handler?.type!=='FunctionExpression'||handler.selfName||handler.params?.length||handler.parameterDefaults?.length||handler.optionalParams?.length)return null;
 return {player:Number(player[1]),button:buttons[button.name],event:events[event.name]};
}
export function markPlayerButtonRegistrations(program,safe){
 if(!safe)return program;
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='Call'&&/^controller\.player[1-4]\.onButtonEvent$/.test(path(node.callee)||'')){node.bwPlayerButtonRegistration=true;if(!playerButtonRegistration(node))delete node.bwPlayerButtonRegistration;}for(const value of Object.values(node))if(value&&typeof value==='object')visit(value)};visit(program);return program;
}
