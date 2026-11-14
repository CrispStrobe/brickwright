import {closedResetStringArraySyntax} from './reset-closed-string-array-source.js';
import {playerButtonConfiguredSourceSafe} from './player-button-registration-source.js';
// The configured-source census rejects mutations and aliases of game and
// its transitive control.reset implementation, including hidden test sources.
export const gameResetSourceSafe=files=>playerButtonConfiguredSourceSafe(files,closedResetStringArraySyntax(files));
export const gameResetIntrinsic=node=>node?.type==='Call'&&node.bwGameResetIntrinsic===true&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.args?.length===0&&node.callee?.type==='Member'&&!node.callee.optional&&node.callee.name==='reset'&&node.callee.object?.type==='Identifier'&&node.callee.object.name==='game';
export function markGameResets(program,safe){
 if(!safe)return program;
 const visit=(node,parent)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(value=>visit(value,parent));return;}
  if(node.type==='Call'&&parent?.type==='ExpressionStatement'&&parent.expr===node&&node.callee?.type==='Member'&&node.callee.name==='reset'&&node.callee.object?.type==='Identifier'&&node.callee.object.name==='game'){
   node.bwGameResetIntrinsic=true;if(!gameResetIntrinsic(node))delete node.bwGameResetIntrinsic;
  }
  for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,node);
 };visit(program,null);return program;
}
