import {hiddenCodeDrafts, standaloneBasicDrafts} from '../overlay/scratch-gui/src/lib/bw-matrix/code-languages.js';
import {test as originalTest} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Creator from '../overlay/scratch-gui/src/lib/sb3-creator-register-art.js';
import {arcadeToPseudocode} from '../overlay/scratch-gui/src/lib/bw-makecode/arcade-translate.js';
import {projectJsonToArcade,projectToArcade} from '../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js';
import {makeCodeProjectFile} from '../overlay/scratch-gui/src/lib/bw-makecode/project-file.js';
import {balancedFrom} from './helpers/js-scope.mjs';
import {codeDocumentEditorClass, codeEditorMethod} from './helpers/code-document-editor.mjs';
const observations=[];
const test=(title,body)=>originalTest(title,async t=>{
    const first=observations.length;
    try {await body(t);}catch(error){try{t.diagnostic(JSON.stringify({schema:'arcade-export-report-test-failure-v1',observations:observations.slice(first)}));}catch{}throw error;}
});
const component=readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx',import.meta.url),'utf8');
const method=signature=>balancedFrom(component,component.indexOf(signature)+signature.length,'{','}',signature);
const context=()=>{const c={props:{vm:{}},state:{conversionReport:null},setState(patch){const update=typeof patch==='function'?patch(this.state):patch;if(update)Object.assign(this.state,update);}};
    for(const [name,args] of [['invalidateArcadeReport',''],['beginArcadeReport',''],['publishArcadeReport','request, out, operation, outcome']])
        c[name]=new Function(args,method(`${name} (${args})`).slice(1,-1));return c;};
const exported=text=>{const imported=arcadeToPseudocode(text);assert.deepEqual(imported.unsupported,[]);const creator=new Creator();creator.parse(imported.code);
    assert.deepEqual(creator.errors,[]);const before=JSON.stringify(creator.project),out=projectJsonToArcade(before);assert.equal(JSON.stringify(creator.project),before);observations.push({source:text,importedCode:imported.code,project:JSON.parse(before),output:out});return {creator,out};};
// Scroll offsets have raw setters, so their getters cannot acquire a Number
// result from their API name alone. Owner decision 2026-10-30: that unproved
// operand now exports through the runtime-dispatch helper instead of
// refusing. The report fixture is a genuine remaining export refusal.
const dispatchPseudocode='DEVICE ARCADE\nGLOBAL result\nSPRITE Game:\nWHEN flag clicked:\n  set result to (calculate value (arcade background scroll offset x layer (0)) op "+" with (1))';
const refusedPseudocode='DEVICE ARCADE\nGLOBAL result\nSPRITE Game:\nWHEN flag clicked:\n  set result to (arcade call function "missing %s" arguments ("[]"))';
const refusalCreator=()=>{
    const creator=new Creator();creator.parse(refusedPseudocode);
    assert.deepEqual(creator.errors,[]);assert.deepEqual(creator.unparsed,[]);
    assert.equal(creator.project.targets.flatMap(target=>Object.values(target.blocks)).filter(node=>node.opcode==='arcade_callFunction').length,1);
    return {creator,code:refusedPseudocode};
};
const refused=()=>{
    const {creator,code}=refusalCreator();
    const projectJson=JSON.stringify(creator.project),out=projectJsonToArcade(projectJson);
    observations.push({pseudocode:code,project:JSON.parse(projectJson),output:out});
    return {creator,out};
};

test('the former Image addition refusal is now a clean direct and owned-JSON export',()=>{
    const creator=new Creator();creator.parse('DEVICE ARCADE\nGLOBAL result\nSPRITE Game:\nWHEN flag clicked:\n  set result to (calculate value (arcade new image width 1 height 1) op "+" with (1))');
    assert.deepEqual(creator.errors,[]);assert.deepEqual(creator.unparsed,[]);
    const before=JSON.stringify(creator.project);
    for(const out of [projectToArcade(creator.project),projectJsonToArcade(before)]){
        assert.deepEqual(out.unsupported,[]);assert.deepEqual(Object.keys(out).sort(),['files','ts','unsupported','warnings']);
        assert.match(out.ts,/function __bwBinaryAdd\(left: any, right: any\): any \{ return left \+ right \}/);
        assert.doesNotMatch(out.ts,/\.join\(/);
    }
    assert.equal(JSON.stringify(creator.project),before);
});

test('the former unproved scroll-offset addition exports through the runtime-dispatch helper and its collector cannot alter it',async()=>{
    const creator=new Creator();creator.parse(dispatchPseudocode);
    assert.deepEqual(creator.errors,[]);assert.deepEqual(creator.unparsed,[]);
    const before=JSON.stringify(creator.project),out=projectJsonToArcade(before);
    assert.deepEqual(out.unsupported,[]);assert.equal(Object.hasOwn(out,'unsupportedDetails'),false);assert.equal(Object.hasOwn(out,'refusalEvidence'),false);
    assert.equal(out.ts.split('function __bwBinaryAdd(').length,2,'one runtime-dispatch helper per program');
    assert.match(out.ts,/function __bwBinaryAdd\(left: any, right: any\): any \{ let a: any = left; if \(Array\.isArray\(left\)\) \{ let array: any\[\] = left; a = array\.join\(","\) \}; let b: any = right; if \(Array\.isArray\(right\)\) \{ let array: any\[\] = right; b = array\.join\(","\) \}; return a \+ b \}/);
    assert.equal(out.files['main.ts'],out.ts);assert.equal(JSON.stringify(out).includes('nativeArrayDomainCall'),false);
    const url=new URL('../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js',import.meta.url);
    const source=readFileSync(url,'utf8'),needle='const site=this.nativeAdditionSite(b,helper);';
    assert.equal(source.split(needle).length,2,'one diagnostic collector call');
    const faulted=source.replace(needle,"throw new Error('collector observation failed');\n                    "+needle)
        .replace(/\b(from\s+|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"\n]+)\2/g,(_,prefix,quote,specifier)=>`${prefix}${quote}${new URL(specifier,url).href}${quote}`);
    assert.equal(/\b(from\s+|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"\n]+)\2/.test(faulted),false,'data URL retains no relative literal import');
    const copy=await import('data:text/javascript;base64,'+Buffer.from(faulted).toString('base64'));
    const observed=copy.projectJsonToArcade(before);
    assert.deepEqual(observed.unsupported,out.unsupported);assert.deepEqual(observed.files,out.files,'collector failure does not replace the export');
    const raw=exporter=>{
        const project=structuredClone(creator.project),counts={keys:0,descriptor:0};
        const target=project.targets.find(t=>Object.values(t.blocks).some(b=>b.opcode==='arrays_valueBinary'));
        assert.ok(target);target.blocks=new Proxy(target.blocks,{ownKeys(value){counts.keys++;return Reflect.ownKeys(value);},
            getOwnPropertyDescriptor(value,key){counts.descriptor++;return Reflect.getOwnPropertyDescriptor(value,key);}});
        const output=exporter(project);return {counts,output};
    };
    const original=raw(projectToArcade),withoutCollector=raw(copy.projectToArcade);
    assert.deepEqual(original.counts,withoutCollector.counts,'raw provenance adds no source reflection/callback');
    assert.deepEqual(original.output.files,withoutCollector.output.files);assert.deepEqual(original.output.unsupported,withoutCollector.output.unsupported);
    assert.deepEqual(original.output.files,out.files);
    assert.equal(JSON.stringify(creator.project),before);
});

test('clean exports keep the old result shape and later exports do not inherit details',()=>{
    refused();const {out}=exported('let result=1+2;');assert.deepEqual(out.unsupported,[]);
    assert.deepEqual(Object.keys(out).sort(),['files','ts','unsupported','warnings']);
});

test('explicit clean JSON capture retains one exact result while default API shape stays unchanged',()=>{
    const {creator,out:baseline}=exported('let result=1+2;');
    const input=JSON.stringify(creator.project,null,2)+'\n';
    const out=projectJsonToArcade(input,{captureObservation:true}),capture=ownObservation(out);
    assert.equal(capture.captureStatus,'COMPLETE');assert.equal(capture.inputJson,input);
    assert.deepEqual(JSON.parse(capture.resultJson),baseline);
    assert.deepEqual(out.unsupported,[]);assert.deepEqual(out.files,baseline.files);assert.equal(out.ts,baseline.ts);
    assert.deepEqual(Object.keys(baseline).sort(),['files','ts','unsupported','warnings']);
    const c=context(),request=c.beginArcadeReport();c.publishArcadeReport(request,out,'export','fresh');
    assert.strictEqual(c.state.conversionReport.observation,capture);
    let accessed=0;const options=Object.create({captureObservation:true});
    Object.defineProperty(options,'captureObservation',{get(){accessed++;return true;}});
    const noCapture=projectJsonToArcade(input,options);
    assert.equal(accessed,0);assert.deepEqual(Object.keys(noCapture).sort(),Object.keys(baseline).sort());
    assert.deepEqual(Object.keys(projectJsonToArcade(input,Object.create({captureObservation:true}))).sort(),Object.keys(baseline).sort());
});

test('stage exporter opts in to clean observation on the single actual export invocation',async()=>{
    const creator=new Creator();creator.parse('DEVICE ARCADE\nGLOBAL result\nSPRITE Game:\nWHEN flag clicked:\n  set result to 3');
    assert.deepEqual(creator.errors,[]);let exports=0,consumed;
    const vm={toJSON:()=>JSON.stringify(creator.project),runtime:{targets:[]}};
    let body=method('async arcadeFromStage ()').slice(1,-1);
    body=body.replace(/const \{assetLibraryRecords, withoutAssetLibraries\} = await import\('[^']+'\);/,'');
    body=body.replace(/const \{projectJsonToArcade\} = await import\([\s\S]*?export-arcade\.js'\);/,'');
    assert.doesNotMatch(body,/await import/);
    const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
    const execute=new AsyncFunction('assetLibraryRecords','withoutAssetLibraries','projectJsonToArcade',body);
    const out=await execute.call({props:{vm}},()=>[],project=>project,(input,opts)=>{
        exports++;consumed=input;assert.equal(opts.captureObservation,true);assert.equal(opts.browserPointer,true);
        return projectJsonToArcade(input,opts);
    });
    assert.equal(exports,1);assert.deepEqual(out.unsupported,[]);
    const capture=ownObservation(out);assert.equal(capture.captureStatus,'COMPLETE');assert.equal(capture.inputJson,consumed);
    assert.deepEqual(JSON.parse(capture.resultJson).files,out.files);
});

test('real exporter output reaches the existing report with exact reasons and export-only wording',()=>{
    const {out}=refused(),c=context(),request=c.beginArcadeReport();
    c.publishArcadeReport(request,out,'export','Arcade source saved; not compiled or run.');
    const report=c.state.conversionReport;assert.deepEqual(report.unsupported,out.unsupported);assert.ok(out.unsupported.length);assert.deepEqual(report.details,out.unsupportedDetails||[]);
    assert.equal(report.direction,'Blocks → Arcade export');assert.equal(report.operation,'export');
    assert.deepEqual(report.changed, out.warnings);
    assert.doesNotMatch(report.outcome,/generated and loaded/);assert.equal(report.preserved,false);
    assert.match(component, /'bw-conversion-refusal-details'/);
});

test('revision, VM replacement, disposal and later requests reject only stale report publication',()=>{
    const {out}=refused();for(const mutate of [c=>c.invalidateArcadeReport(),c=>{c.props.vm={};},c=>{c._unmounted=true;},c=>c.beginArcadeReport()]){
        const c=context(),request=c.beginArcadeReport();mutate(c);c.publishArcadeReport(request,out,'export','stale');assert.equal(c.state.conversionReport,null);
    }
    const c=context(),old=c.beginArcadeReport();c.publishArcadeReport(old,out,'export','first');c.invalidateArcadeReport();assert.equal(c.state.conversionReport,null);
    const clean=exported('let result=1+2;').out,request=c.beginArcadeReport();c.publishArcadeReport(request,clean,'export','fresh');
    assert.deepEqual(c.state.conversionReport.unsupported,[]);assert.deepEqual(c.state.conversionReport.details,[]);
    // React may apply the state updater after this method returns.
    for(const change of [ctx=>ctx.invalidateArcadeReport(),ctx=>{ctx.props.vm={};},ctx=>{ctx._unmounted=true;},ctx=>ctx.beginArcadeReport()]){
        const ctx=context(),queue=[];ctx.setState=update=>queue.push(update);
        const token=ctx.beginArcadeReport();ctx.publishArcadeReport(token,out,'export','deferred');assert.equal(queue.length,1);
        change(ctx);const update=queue[0](ctx.state);assert.equal(update,null);assert.equal(ctx.state.conversionReport,null);
    }
    const queued=context(),queue=[];queued.setState=update=>queue.push(update);
    const token=queued.beginArcadeReport();queued.publishArcadeReport(token,out,'export','still current');
    const update=queue[0](queued.state);assert.equal(update.conversionReport.outcome,'still current');
});

test('actual export method retains exact original files and download transport while reporting the outcome',async()=>{
    const c=context(),files={'main.ts':'let original=7;','pxt.json':JSON.stringify({name:'retained'})};
    let downloads=0,blob;c.makeCodeOriginalStatus=()=>({status:'current',target:'arcade',files});c.arcadeFromStage=()=>{throw new Error('original must not be regenerated');};
    c.L={arcDone:()=> 'saved',mcFailed:(_,message)=>message};
    const signature='async exportArcade ()',body=method(signature),importLine=/const \{makeCodeProjectFile\} = await import\([\s\S]*?'\.\.\/\.\.\/lib\/bw-makecode\/index\.js'\);/;
    assert.match(body,importLine);const execute=new (Object.getPrototypeOf(async function(){}).constructor)('makeCodeProjectFile','downloadBlob','Blob',body.slice(1,-1).replace(importLine,''));
    await execute.call(c,makeCodeProjectFile,async(name,value)=>{downloads++;blob=value;assert.equal(name,'arcade-retained.mkcd');},Blob);
    assert.equal(downloads,1);assert.ok((await blob.text()).length);assert.match(c.state.conversionReport.outcome,/Recovered original/);
    assert.deepEqual(c.state.conversionReport.unsupported,[]);assert.equal(c.state.status,'saved');assert.equal(c.state.busy,false);
});

test('original export error remains visible and assets are not modified by report-only publication',async()=>{
    const c=context(),failure=new Error('asset delivery failed'),assets=[{id:'current',bytes:new Uint8Array([1,2,3])}],before=structuredClone(assets);
    c.arcadeFromStage=async()=>{throw failure;};c.makeCodeOriginalStatus=()=>({status:'stale'});let observed;
    c.L={mcFailed:(_,message)=>{observed=message;return message;}};
    const body=method('async exportArcade ()');const execute=new (Object.getPrototypeOf(async function(){}).constructor)('downloadBlob','Blob',body.slice(1,-1));
    await execute.call(c,()=>{throw new Error('download must not run');},Blob);assert.equal(observed,failure.message);assert.deepEqual(assets,before);
    assert.equal(c.state.conversionReport,null);assert.equal(c.state.busy,false);
    const Editor=codeDocumentEditorClass(component,codeEditorMethod(component,'setActiveCode (text) {'));
    const edited=Object.assign(new Editor(),context());edited.state={lang:'pseudocode',buffers:{pseudocode:'old'},conversionReport:{operation:'export'}};
    edited.setState=patch=>{const update=typeof patch==='function'?patch(edited.state):patch;
        if(update&&Object.hasOwn(update,'conversionReport'))throw new Error('report clear failed');if(update)Object.assign(edited.state,update);};
    assert.doesNotThrow(()=>edited.setActiveCode('current source'));
    assert.equal(edited.state.buffers.pseudocode,'current source','report-only clearing cannot block the original edit');
});


const ownedRefusalInput=label=>{
    const {creator}=refusalCreator();
    creator.project.meta={...creator.project.meta,observationLabel:label};
    return {creator,input:JSON.stringify(creator.project,null,2)+'\n'};
};
const ownObservation=out=>{
    const evidence=Object.getOwnPropertyDescriptor(out,'refusalEvidence');assert.ok(evidence&&Object.hasOwn(evidence,'value'));
    const observation=Object.getOwnPropertyDescriptor(evidence.value,'ownedJsonObservation');
    assert.ok(observation&&Object.hasOwn(observation,'value'));return observation.value;
};

test('owned JSON refusal captures the exact nonASCII input and original semantic result once without recursion',()=>{
    const {creator,input}=ownedRefusalInput('猫🧱'),before=JSON.stringify(creator.project),out=projectJsonToArcade(input),capture=ownObservation(out);
    assert.equal(JSON.stringify(creator.project),before);assert.ok(out.unsupported.length);
    assert.equal(capture.schema,'arcade-clean-export-observation-v1');assert.equal(capture.origin,'owned-json-export');
    assert.equal(capture.captureStatus,'COMPLETE');assert.equal(capture.limitUtf8Bytes,8388608);assert.equal(Object.isFrozen(capture),true);
    assert.equal(capture.inputJson,input);assert.deepEqual(JSON.parse(capture.inputJson),creator.project);
    assert.equal(capture.inputUtf8Bytes,Buffer.byteLength(input,'utf8'));assert.ok(capture.inputUtf8Bytes>input.length);
    assert.equal(capture.resultUtf8Bytes,Buffer.byteLength(capture.resultJson,'utf8'));
    assert.equal(capture.totalUtf8Bytes,capture.inputUtf8Bytes+capture.resultUtf8Bytes);assert.ok(capture.totalUtf8Bytes<=capture.limitUtf8Bytes);
    for(const key of Reflect.ownKeys(capture)){
        const descriptor=Object.getOwnPropertyDescriptor(capture,key);assert.equal(typeof key,'string');assert.ok(Object.hasOwn(descriptor,'value'));
        assert.equal(typeof descriptor.value==='object'&&descriptor.value!==null,false,'flat data envelope');
    }
    const {ownedJsonObservation,...priorEvidence}=out.refusalEvidence;
    assert.strictEqual(ownedJsonObservation,capture);
    const {refusalEvidence:_attached,...withoutEvidence}=out,capturedResult=JSON.parse(capture.resultJson);
    const semantic=Object.keys(priorEvidence).length?{...withoutEvidence,refusalEvidence:priorEvidence}:withoutEvidence;
    assert.deepEqual(capturedResult,semantic,'capture precedes attachment and retains every original result field');
    assert.equal(capturedResult.refusalEvidence?.ownedJsonObservation,undefined);
    assert.equal(capturedResult.refusalEvidence?.nativeAdditionDraft,out.refusalEvidence.nativeAdditionDraft);
    assert.deepEqual(capturedResult.unsupportedDetails,out.unsupportedDetails);
});

test('owned refusal observations do not attach to direct objects or leak across clean and later exports',()=>{
    const first=ownedRefusalInput('first capture'),out=projectJsonToArcade(first.input),capture=ownObservation(out);
    assert.equal(capture.captureStatus,'COMPLETE');
    const direct=projectToArcade(first.creator.project);assert.deepEqual(direct.unsupported,out.unsupported);assert.deepEqual(direct.files,out.files);
    assert.equal(Object.hasOwn(direct.refusalEvidence||{},'ownedJsonObservation'),false);
    const clean=exported('let result=1+2;').out;
    assert.deepEqual(Object.keys(clean).sort(),['files','ts','unsupported','warnings']);
    const later=ownedRefusalInput('second capture'),next=projectJsonToArcade(later.input),nextCapture=ownObservation(next);
    assert.equal(nextCapture.captureStatus,'COMPLETE');assert.equal(nextCapture.inputJson,later.input);
    assert.notStrictEqual(nextCapture,capture);assert.notEqual(nextCapture.inputJson,capture.inputJson);assert.equal(capture.inputJson,first.input);
});

test('owned refusal capture enforces the combined UTF8 limit without truncating or replacing semantic refusal',()=>{
    const {creator,input}=ownedRefusalInput('size control'),baseline=projectJsonToArcade(input),limit=8388608;
    for(const beyondInput of [true,false]){
        creator.project.meta.observationPadding='';
        const emptyBytes=Buffer.byteLength(JSON.stringify(creator.project),'utf8');
        creator.project.meta.observationPadding=beyondInput?'🧱'.repeat(limit/4):'x'.repeat(limit-emptyBytes-32);
        const actualInput=JSON.stringify(creator.project),out=projectJsonToArcade(actualInput),capture=ownObservation(out);
        assert.equal(capture.captureStatus,'UNAVAILABLE_SIZE');assert.equal(capture.origin,'owned-json-export');
        assert.equal(capture.limitUtf8Bytes,limit);assert.equal(capture.inputUtf8Bytes,Buffer.byteLength(actualInput,'utf8'));
        assert.equal(Object.isFrozen(capture),true);assert.equal(Object.hasOwn(capture,'inputJson'),false);assert.equal(Object.hasOwn(capture,'resultJson'),false);
        if(beyondInput)assert.ok(capture.inputUtf8Bytes>limit);
        else {assert.equal(capture.inputUtf8Bytes,limit-32);assert.ok(ownObservation(baseline).resultUtf8Bytes>32,'result must consume the shared remaining budget');}
        assert.deepEqual(out.files,baseline.files);assert.deepEqual(out.unsupported,baseline.unsupported);
        assert.deepEqual(out.unsupportedDetails,baseline.unsupportedDetails);
        assert.equal(out.refusalEvidence.nativeAdditionDraft,baseline.refusalEvidence.nativeAdditionDraft);
    }
});

test('diagnostic serialization refuses an unexpected result prototype without invoking inherited toJSON',async()=>{
    const {input}=ownedRefusalInput('inherited toJSON'),original=projectJsonToArcade(input);
    const url=new URL('../overlay/scratch-gui/src/lib/bw-makecode/export-arcade.js',import.meta.url),source=readFileSync(url,'utf8');
    const needle='const observation=observeRefusedJson(json,result),previous=';
    assert.equal(source.split(needle).length,2,'one capture site after the actual export result');
    const injection=`result.diagnosticToJSONReads=0;
        const unexpectedPrototype=Object.create(Object.prototype);
        Object.defineProperty(unexpectedPrototype,'toJSON',{get(){result.diagnosticToJSONReads++;throw new Error('inherited toJSON must not run');}});
        Object.setPrototypeOf(result,unexpectedPrototype);
        ${needle}`;
    const modified=source.replace(needle,injection)
        .replace(/\b(from\s+|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"\n]+)\2/g,(_,prefix,quote,specifier)=>`${prefix}${quote}${new URL(specifier,url).href}${quote}`);
    assert.equal(/\b(from\s+|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"\n]+)\2/.test(modified),false);
    const copy=await import('data:text/javascript;base64,'+Buffer.from(modified).toString('base64'));
    const out=copy.projectJsonToArcade(input),capture=ownObservation(out);
    assert.equal(out.diagnosticToJSONReads,0,'a caught serialization error must not hide invoking the inherited getter');
    assert.equal(capture.captureStatus,'UNAVAILABLE_SERIALIZATION');assert.equal(Object.isFrozen(capture),true);
    assert.equal(Object.hasOwn(capture,'inputJson'),false);assert.equal(Object.hasOwn(capture,'resultJson'),false);
    assert.deepEqual(out.unsupported,original.unsupported);assert.deepEqual(out.files,original.files);
    assert.deepEqual(out.unsupportedDetails,original.unsupportedDetails);
    assert.equal(out.refusalEvidence.nativeAdditionDraft,original.refusalEvidence.nativeAdditionDraft);
});

test('current reports carry only own observation data and clean or stale reports cannot retain a previous capture',()=>{
    const {input}=ownedRefusalInput('report capture'),out=projectJsonToArcade(input),capture=ownObservation(out),c=context();
    const current=c.beginArcadeReport();c.publishArcadeReport(current,out,'run','refused actual run');
    assert.strictEqual(c.state.conversionReport.observation,capture);
    c.invalidateArcadeReport();c.publishArcadeReport(current,out,'run','stale');assert.equal(c.state.conversionReport,null);
    const clean=exported('let result=1+2;').out,fresh=c.beginArcadeReport();c.publishArcadeReport(fresh,clean,'export','clean');
    assert.equal(c.state.conversionReport.observation,null);
    let inheritedReads=0;
    const inheritedEvidence=Object.create({get ownedJsonObservation(){inheritedReads++;return capture;}});
    const ownOut={...out,refusalEvidence:inheritedEvidence},request=c.beginArcadeReport();c.publishArcadeReport(request,ownOut,'export','own data only');
    assert.equal(inheritedReads,0);assert.equal(c.state.conversionReport.observation,null);
    let evidenceReads=0;
    const getterOut={...out};Object.defineProperty(getterOut,'refusalEvidence',{get(){evidenceReads++;throw new Error('evidence getter must not run');}});
    const hostile=[getterOut,{...out,refusalEvidence:new Proxy({}, {getOwnPropertyDescriptor(){throw new Error('descriptor unavailable');}})}];
    for(const actual of hostile){
        const next=c.beginArcadeReport();c.publishArcadeReport(next,actual,'export','original refusal remains visible');
        assert.deepEqual(c.state.conversionReport.unsupported,out.unsupported);assert.deepEqual(c.state.conversionReport.details,out.unsupportedDetails||[]);
        assert.equal(c.state.conversionReport.observation,null);assert.equal(c.state.conversionReport.outcome,'original refusal remains visible');
    }
    assert.equal(evidenceReads,0);
    const queued=context(),queue=[];queued.setState=update=>queue.push(update);
    const token=queued.beginArcadeReport();queued.publishArcadeReport(token,out,'run','deferred capture');queued.invalidateArcadeReport();
    assert.equal(queue[0](queued.state),null);assert.equal(queued.state.conversionReport,null);
});

test('original source passthrough reports its unavailable observation branch without regenerating the original',async()=>{
    const c=context(),files={'main.ts':'let original=7;','pxt.json':JSON.stringify({name:'retained'})};
    c.makeCodeOriginalStatus=()=>({status:'current',target:'arcade',files});c.arcadeFromStage=()=>{throw new Error('passthrough must not regenerate');};
    c.L={arcDone:()=> 'saved',mcFailed:(_,message)=>message};let downloads=0;
    const body=method('async exportArcade ()'),importLine=/const \{makeCodeProjectFile\} = await import\([\s\S]*?'\.\.\/\.\.\/lib\/bw-makecode\/index\.js'\);/;
    assert.match(body,importLine);
    const execute=new (Object.getPrototypeOf(async function(){}).constructor)('makeCodeProjectFile','downloadBlob','Blob',body.slice(1,-1).replace(importLine,''));
    await execute.call(c,makeCodeProjectFile,async(name,blob)=>{downloads++;assert.equal(name,'arcade-retained.mkcd');assert.ok((await blob.text()).length);},Blob);
    assert.equal(downloads,1);assert.equal(c.state.status,'saved');assert.equal(c.state.busy,false);
    assert.deepEqual(c.state.conversionReport.observation,{schema:'arcade-clean-export-observation-v1',origin:'original-source-passthrough',captureStatus:'UNAVAILABLE_ORIGINAL_SOURCE_BRANCH'});
    assert.deepEqual(c.state.conversionReport.unsupported,[]);assert.match(c.state.conversionReport.outcome,/Recovered original/);
});
