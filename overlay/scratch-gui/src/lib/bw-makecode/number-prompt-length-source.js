import {tokenize} from './ts-import.js';
import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';

const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?path(node.object)+'.'+node.name:null;
const gameCalls=new Set(['askForNumber','askForString','ask','splash','showLongText','onUpdate','onUpdateInterval','runtime','over','gameOver','setGameOverEffect','setGameOverMessage','setGameOverScoringType']);
const mathCalls=new Set(['abs','ceil','floor','round','min','max','pow','sqrt','sin','cos','tan','asin','acos','atan','atan2',
    'log','exp','random','randomRange','percentChance','clamp','imul','trunc','sign','idiv','fround']);
const readonlyCalls=new Set(['String','String.fromCharCode','Number','Array.isArray','parseFloat']);
const ambient=new Set(['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__']);
const writes=new Set(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>=','++','--']);
// Only the erased empty array suffix in this complete declaration-type
// prefix is exempt from the computed-receiver veto. The initializer and every
// other bracket remain subject to the ordinary configured-source census.
const imageArrayDeclarationType=(tokens,index)=>
    ['let','const','var'].includes(tokens[index-4]?.type)&&tokens[index-3]?.type==='ident'&&
    tokens[index-2]?.value===':'&&tokens[index-1]?.type==='ident'&&tokens[index-1]?.value==='Image'&&
    tokens[index]?.value==='['&&tokens[index+1]?.value===']'&&tokens[index+2]?.value==='=';


// A negative-only census of all configured source bytes precedes erasing
// transforms. Unknown syntax, computed receiver acquisition, active Python or
// assembly and SDK/dependency aliases decline this deliberately small slice.
export function numberPromptLengthSourceSafe(files) {
    try {
        const meta=Object.getOwnPropertyDescriptor(files,'pxt.json');
        if(!meta&&'pxt.json' in files || meta&&(!Object.hasOwn(meta,'value')||typeof meta.value!=='string'))return false;
        const config=meta?JSON.parse(meta.value):null,names=config?.files??['main.ts'],tests=config?.testFiles??[];
        if(!Array.isArray(names)||!Array.isArray(tests)||![...names,...tests].every(name=>typeof name==='string'))return false;
        for(const name of new Set([...names,...tests])) {
            if(!/\.(?:ts|py|asm|c|cpp|h)$/.test(name))continue;
            const file=Object.getOwnPropertyDescriptor(files,name);
            if(!file||!Object.hasOwn(file,'value')||typeof file.value!=='string')return false;
            if(config?.fileDependencies&&Object.hasOwn(config.fileDependencies,name))return false;
            if(/\.py$/.test(name)){if(config?.preferredEditor==='tsprj'||config?.preferredEditor==='blocksprj')continue;return false;}
            if(!/\.ts$/.test(name)||/\.d\.ts$/.test(name))return false;
            const tokens=tokenize(file.value);
            for(let i=0;i<tokens.length;i++) {
                const token=tokens[i],before=tokens[i-1];
                if(token.unknownBefore||token.invalidLiteral||token.type==='number'&&!Number.isFinite(Number(token.value)))return false;
                if(token.type==='template'&&token.value.includes('${'))return false;
                if(['ident','string'].includes(token.type)&&ambient.has(token.value))return false;
                if(token.value==='['&&!imageArrayDeclarationType(tokens,i)&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return false;
                if(token.type!=='ident'||!['game','Math','String','Number','Array','parseFloat','console'].includes(token.value))continue;
                let top=token.value,end=i;
                while(tokens[end+1]?.value==='.'&&tokens[end+2]?.type==='ident'){top+='.'+tokens[end+2].value;end+=2;}
                const after=tokens[end+1];
                if(['new','function','class','namespace'].includes(before?.type)||before?.value==='delete')return false;
                const call=after?.value==='('&&(token.value==='game'&&gameCalls.has(top.slice(5))||
                    token.value==='Math'&&mathCalls.has(top.slice(5))||/^console\.(?:inspect|log|warn|debug)$/.test(top)||readonlyCalls.has(top));
                const scalar= /^Math\.(?:E|PI|LN10|LN2|LOG10E|LOG2E|SQRT1_2|SQRT2)$/.test(top);
                if(!call&&!(scalar&&!writes.has(after?.value)&&!['++','--'].includes(before?.value)))return false;
            }
        }
        return true;
    } catch {return false;}
}

export function literalNumberPromptLength(node) {
    return node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.args?.length===2&&
        node.args[0]?.type==='String'&&node.args[1]?.type==='Number'&&Number.isInteger(Number(node.args[1].value))&&
        Number(node.args[1].value)>=1&&Number(node.args[1].value)<=3;
}

// Only original calls with actual unbound lexical receivers receive metadata.
export function markNumberPromptLengths(program,sourceSafe) {
    if(!sourceSafe)return program;
    const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary),calls=[];
    if(!proof.isCurrent())return program;
    for(const node of proof.nodes)if(path(node.callee)==='game.askForNumber'&&literalNumberPromptLength(node)&&
        proof.unbound(node.callee.object))calls.push(node);
    for(const node of calls)node.bwPxtNumberPromptLength=true;
    return program;
}


export function literalDefaultTextPrompt(node) {
    return node?.type==='Call'&&!node.isNew&&!node.constructorCall&&!node.optional&&!node.typeArguments?.length&&node.args?.length===2&&
        node.args[0]?.type==='String'&&node.args[1]?.type==='Number'&&Number(node.args[1].value)===12;
}

// Pinned game.askForString defaults to length 12 and useOnScreenKeyboard=false:
// system keyboard when supported, otherwise the screen fallback. Only this
// effect-free explicit default may use the existing one-argument word.
export function markDefaultTextPrompts(program,sourceSafe) {
    if(!sourceSafe)return program;
    const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary),calls=[];
    if(!proof.isCurrent())return program;
    for(const node of proof.nodes)if(path(node.callee)==='game.askForString'&&literalDefaultTextPrompt(node)&&
        proof.unbound(node.callee.object))calls.push(node);
    for(const node of calls)node.bwPxtDefaultTextPrompt=true;
    return program;
}
