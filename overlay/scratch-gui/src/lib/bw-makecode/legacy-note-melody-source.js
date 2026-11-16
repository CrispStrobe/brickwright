import {MUSIC_MELODIES} from './music-melodies.js';
import {tokenize} from './ts-import.js';
import {inspectGeneratedHelperBindings,GENERATED_HELPER_PROFILES} from './generated-helper-recognition.js';

const path=node=>node?.type==='Identifier'?node.name:node?.type==='Member'?path(node.object)+'.'+node.name:null;
const musicCalls=new Set(['playMelody','setVolume','volume','setTempo','tempo','changeTempoBy','stopAllSounds','rest','playTone','ringTone',
    'play','stringPlayable','tonePlayable','melodyPlayable','playSound','playSoundUntilDone','sounds','beat','createSong','createSoundEffect','playSoundEffect']);
const mathCalls=new Set(['abs','ceil','floor','round','min','max','pow','sqrt','sin','cos','tan','asin','acos','atan','atan2',
    'log','exp','random','randomRange','percentChance','clamp','imul','trunc','sign','idiv','fround']);
const readonlyCalls=new Set(['String','String.fromCharCode','Number','Array.isArray']);
const ambient=new Set(['globalThis','global','window','self','eval','Function','Reflect','Object','Proxy','arguments','constructor','prototype','__proto__']);
const writes=new Set(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=','>>>=','++','--']);

// A negative-only census of all configured source bytes precedes erasing
// transforms. Unknown syntax, computed receiver acquisition, active Python or
// assembly and SDK/dependency aliases decline this deliberately small slice.
export function legacyNoteMelodySourceSafe(files) {
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
                if(token.value==='['&&(['ident','number','string','template'].includes(before?.type)||[')',']','}','.'].includes(before?.value)))return false;
                if(token.type!=='ident'||!['music','Math','String','Number','Array'].includes(token.value))continue;
                let top=token.value,end=i;
                while(tokens[end+1]?.value==='.'&&tokens[end+2]?.type==='ident'){top+='.'+tokens[end+2].value;end+=2;}
                const after=tokens[end+1];
                if(['new','function','class','namespace'].includes(before?.type)||before?.value==='delete')return false;
                // Only a direct zero-argument play of a known SDK singleton may
                // coexist. Reads, aliases, other methods and writers still veto.
                const melody=/^music\.([A-Za-z]+)\.play$/.exec(top);
                const singletonPlay=melody&&MUSIC_MELODIES.has(melody[1])&&after?.value==='('&&tokens[end+2]?.value===')';
                const call=singletonPlay||after?.value==='('&&(token.value==='music'&&musicCalls.has(top.slice(6))||
                    token.value==='Math'&&mathCalls.has(top.slice(5))||readonlyCalls.has(top));
                const scalar=/^music\.PlaybackMode\.(?:UntilDone|InBackground|LoopingInBackground)$/.test(top)||
                    /^Math\.(?:E|PI|LN10|LN2|LOG10E|LOG2E|SQRT1_2|SQRT2)$/.test(top);
                if(!call&&!(scalar&&!writes.has(after?.value)&&!['++','--'].includes(before?.value)))return false;
            }
        }
        return true;
    } catch {return false;}
}

export function literalLegacyNoteMelody(node) {
    if(node?.type!=='Call'||node.isNew||node.constructorCall||node.optional||node.typeArguments?.length||node.args?.length!==2)return false;
    const notes=node.args[0];
    if(notes?.type!=='String'||typeof notes.value!=='string'||notes.value.length>64)return false;
    const values=notes.value.trim().split(/ +/).filter(Boolean);
    if(values.length>8||values.some(note=>! /^(?:[A-G]|C5|-)$/.test(note)))return false;
    const number=value=>value?.type==='Number'?Number(value.value):value?.type==='Unary'&&['+','-'].includes(value.op)&&value.argument?.type==='Number'?
        (value.op==='-'?-1:1)*Number(value.argument.value):NaN;
    return Number.isFinite(number(node.args[1]));
}

// The configured-byte veto and actual lexical binding must both admit the
// original call. Only parser-created calls receive this compiler metadata;
// neighboring source and its argument evaluation order remain unchanged.
export function markLegacyNoteMelodies(program,sourceSafe) {
    if(!sourceSafe)return program;
    const proof=inspectGeneratedHelperBindings(program,GENERATED_HELPER_PROFILES.ordinary),calls=[];
    if(!proof.isCurrent())return program;
    for(const node of proof.nodes)if(path(node.callee)==='music.playMelody'&&literalLegacyNoteMelody(node)&&
        proof.unbound(node.callee.object))calls.push(node);
    for(const node of calls)node.bwPxtLegacyNoteMelody=true;
    return program;
}
