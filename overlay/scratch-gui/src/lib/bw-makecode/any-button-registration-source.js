import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';
import {BUTTON_EVENTS} from './controller-button-event-number-source.js';
import {tokenize} from './ts-import.js';

const path = node => node?.type === 'Identifier' ? node.name :
    node?.type === 'Member' ? `${path(node.object)}.${node.name}` : null;
const controlCalls = new Set(['control.raiseEvent','control.waitForEvent','control.allocateNotifyEvent','control.runInParallel']);
const controllerCalls = new Set(['controller.moveSprite','controller.dx','controller.dy','controller.setRepeatDefault','controller._setUserEventsEnabled','controller.pauseUntilAnyButtonIsPressed']);
const controllerCall = name => controllerCalls.has(name) || /^controller\.(?:player[1-4]\.)?(?:A|B|up|down|left|right)\.(?:onEvent|isPressed|pauseUntil)$/.test(name || '');
const controllerRepeat = name => /^controller\.(?:player[1-4]\.)?(?:A|B|up|down|left|right)\.(?:repeatDelay|repeatInterval)$/.test(name || '');
const ambient = new Set(['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__']);
const assignment = new Set(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>=','++','--']);

// Census original configured bytes, including generated TS, before any parser
// or lowering can erase an opaque body. Lexical ambiguity declines this slice;
// no alias, shadow or reflection inference broadens the closed namespace paths.
export function anyButtonConfiguredSourceSafe(files) {
    try {
        const descriptor=Object.getOwnPropertyDescriptor(files,'pxt.json');
        if(!descriptor && 'pxt.json' in files || descriptor && (!Object.hasOwn(descriptor,'value') || typeof descriptor.value!=='string'))return false;
        const config=descriptor?JSON.parse(descriptor.value):null;
        const names=config?.files ?? ['main.ts'],tests=config?.testFiles ?? [];
        if(!Array.isArray(names)||!Array.isArray(tests)||![...names,...tests].every(name=>typeof name==='string'))return false;
        for(const name of new Set([...names,...tests])) {
            if(!/\.(?:ts|py|asm|c|cpp|h)$/.test(name))continue;
            const file=Object.getOwnPropertyDescriptor(files,name);
            if(!file || !Object.hasOwn(file,'value') || typeof file.value!=='string')return false;
            if(config?.fileDependencies && Object.hasOwn(config.fileDependencies,name))return false;
            if(/\.py$/.test(name)) {
                if(config?.preferredEditor==='tsprj'||config?.preferredEditor==='blocksprj')continue;
                return false;
            }
            if(!/\.ts$/.test(name)||/\.d\.ts$/.test(name))return false;
            const tokens=tokenize(file.value);
            for(let i=0;i<tokens.length;i++) {
                const token=tokens[i];
                if(token.unknownBefore || token.invalidLiteral)return false;
                if(token.type==='number' && !Number.isFinite(Number(token.value)))return false;
                if(token.type==='template' && token.value.includes('${'))return false;
                if((token.type==='ident'||token.type==='string') && ambient.has(token.value))return false;
                // Computed receivers can acquire Function through split names
                // even inside an opaque body. Array-type ambiguity also refuses.
                const before=tokens[i-1];
                if(token.value==='[' && (['ident','number','string','template'].includes(before?.type) ||
                    [')',']','}','.'].includes(before?.value)))return false;
                if(token.type!=='ident'||!['controller','control','ControllerButtonEvent'].includes(token.value))continue;
                let top=token.value,end=i;
                while(tokens[end+1]?.value==='.' && tokens[end+2]?.type==='ident'){top+='.'+tokens[end+2].value;end+=2;}
                const next=tokens[end+1],previous=tokens[i-1];
                if(previous?.type==='new'||previous?.value==='delete')return false;
                if(token.value==='control' && !(controlCalls.has(top)&&next?.value==='('))return false;
                if(token.value==='controller' && !((top==='controller.anyButton.onEvent'||controllerCall(top))&&next?.value==='(' ||
                    controllerRepeat(top)&&!['.','[','('].includes(next?.value)))return false;
                if(token.value==='ControllerButtonEvent' && !(Object.keys(BUTTON_EVENTS).some(event=>top==='ControllerButtonEvent.'+event)&&
                    !assignment.has(next?.value)&&!['++','--'].includes(previous?.value)))return false;
            }
        }
        return true;
    } catch {return false;}
}

// Selected PXT's AnyButton has ID zero, the control-event wildcard. Its user
// slot is scene-local and replaced per event. Raw control.onEvent can replace
// its installed wrapper independently of that slot, so mixed registration and
// escaped/mutable receivers remain outside this direct-source slice.
export function anyButtonRegistrationSource(program) {
    const proof = inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary);
    const selected = new WeakSet();
    if (!proof.isCurrent()) return {has:()=>false};
    let unsafe = false;
    const event = node => node?.type === 'Number' && Object.values(BUTTON_EVENTS).includes(Number(node.value)) ||
        node?.type === 'Member' && node.object?.type === 'Identifier' && node.object.name === 'ControllerButtonEvent' &&
        proof.unbound(node.object) && Object.hasOwn(BUTTON_EVENTS,node.name);
    const registration = node => node?.type === 'Call' && path(node.callee) === 'controller.anyButton.onEvent' &&
        !node.isNew && !node.constructorCall && !node.optional && !node.typeArguments?.length &&
        node.args?.length === 2 && event(node.args[0]) && node.args[1]?.type === 'FunctionExpression' &&
        node.args[1].params.length === 0 && !node.args[1].isAsync && !node.args[1].isGenerator;
    for (const node of proof.nodes) {
        if (node.type === 'Unknown' || node.type === 'Identifier' && ambient.has(node.name) ||
            node.type === 'Member' && ['constructor','buttonEventHandlers'].includes(node.name)) unsafe = true;
        if (path(node) === 'control.onEvent') unsafe = true;
        if (node.type !== 'Identifier' || !['controller','ControllerButtonEvent','control'].includes(node.name) || !proof.unbound(node)) continue;
        let top = node, parent = proof.parentOf(top);
        while (parent?.type === 'Member' && parent.object === top) {top = parent;parent = proof.parentOf(top);}
        if (top === node || parent?.type === 'Index' && parent.object === top) {unsafe = true;continue;}
        if (node.name === 'controller' && path(top)?.startsWith('controller.anyButton')) {
            if (parent?.type !== 'Call' || parent.callee !== top || !registration(parent)) unsafe = true;
            else selected.add(parent);
        }
        else if(node.name==='controller' && !(controllerCall(path(top))&&parent?.type==='Call'&&parent.callee===top || controllerRepeat(path(top))))unsafe=true;
        if (node.name === 'ControllerButtonEvent' &&
            (parent?.type === 'Assignment' && parent.left === top || parent?.type === 'Update' && parent.argument === top ||
             parent?.type === 'Unary' && parent.op === 'delete')) unsafe = true;
        if (node.name === 'control' && (!controlCalls.has(path(top)) || parent?.type !== 'Call' || parent.callee !== top)) unsafe = true;
    }
    return {has:node=>!unsafe && proof.isCurrent() && selected.has(node)};
}

/** Normalize only original admitted calls before any source body is erased.
 * Rejected programs are returned unchanged, including their legacy fast paths.
 * Parameter metadata and every neighboring node retain their original identity.
 */
export function lowerAnyButtonRegistrations(program,originalSourceSafe,diagnostics=[]) {
    const proof=originalSourceSafe?anyButtonRegistrationSource(program):{has:()=>false},selected=[],seen=new WeakSet();
    const collect=node=>{
        if(!node||typeof node!=='object'||seen.has(node))return;seen.add(node);
        if(node.type==='Call') {
            if(proof.has(node))selected.push(node);
            else if(path(node.callee)==='controller.anyButton.onEvent' || node.callee?.type==='Member'&&node.callee.name==='onEvent'&&
                node.callee.object?.type==='Index'&&path(node.callee.object.object)==='controller'&&
                node.callee.object.index?.type==='String'&&node.callee.object.index.value==='anyButton')
                diagnostics.push('controller.anyButton.onEvent requires unchanged direct SDK receivers, a fixed button event and a zero-parameter inline callback; raw event registration and namespace escapes remain unsupported');
        }
        for(const value of Object.values(node))if(value&&typeof value==='object')collect(value);
    };
    collect(program);
    for(const node of selected) {
        node.callee={type:'Member',object:{type:'Identifier',name:'control'},name:'onEvent'};
        node.args=[node.args[0],{type:'Number',value:'0'},node.args[1]];
    }
    return program;
}
