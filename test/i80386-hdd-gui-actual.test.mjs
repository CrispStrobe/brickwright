import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
const readOriginalControlSummary = stdout => JSON.parse(stdout.trim());
const runControlChildren = async (specs,deadlineMs) => {
    const started=performance.now(),children=[];let expired=false,aggregateOverflow=false,capturedBytes=0;
    const stop=()=>{for(const child of children)child.kill('SIGKILL');};
    const timer=setTimeout(()=>{expired=true;stop();},deadlineMs);
    const launch=spec=>new Promise(resolve=>{
        const child=spawn(spec.argv[0],spec.argv.slice(1),{cwd:root,stdio:['pipe','pipe','pipe']});
        children.push(child);
        const output={stdout:[],stderr:[]},length={stdout:0,stderr:0};let error=null,overflow=false;
        for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{
            length[stream]+=chunk.length;
            if(length[stream]>4*1024*1024){overflow=true;stop();return;}
            if(capturedBytes+chunk.length>4*1024*1024){aggregateOverflow=true;stop();return;}
            capturedBytes+=chunk.length;output[stream].push(chunk);
        });
        child.on('error',failure=>{error=failure;});
        child.on('close',(code,signal)=>resolve({code,signal,error,overflow,
            stdout:Buffer.concat(output.stdout).toString('utf8'),
            stderr:Buffer.concat(output.stderr).toString('utf8')}));
        child.stdin.on('error',failure=>{error??=failure;child.kill('SIGKILL');});
        child.stdin.end(spec.input || '');
    });
    try{return {results:await Promise.all(specs.map(launch)),expired,aggregateOverflow,capturedBytes,elapsedMs:performance.now()-started};}
    finally{clearTimeout(timer);}
};

// Policy 4be93d2bfd422acdc3f776a73b72d099813538e1 changed only these
// concurrency bytes in the held workflows. Admit the exact new policy, then
// restore its exact predecessor bytes so every historical digest stays binding.
const reviewedConcurrency = "concurrency:\n" +
    "  group: ${{ github.workflow }}${{ !(github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request')) && format('-isolated-{0}', github.run_id) || '' }}-${{ github.ref }}";
const reviewedCancellation = "\n  cancel-in-progress: ${{ github.ref_type != 'tag' && (github.event_name == 'push' || github.event_name == 'pull_request') }}\n";
const concurrencyPredecessors = new Map([
    ['i80386-hdd-gui-actual', "concurrency:\n  group: gui-hdd-${{ github.event.pull_request.head.sha || github.sha }}-${{ github.event_name }}\n  cancel-in-progress: false\n\n"],
    ['ack-z80-cpm', ''], ['basic-oracle', ''], ['target-performance', ''],
    ['makecode-arcade-bases', "concurrency:\n  group: makecode-arcade-bases-${{ github.ref }}\n  cancel-in-progress: true\n\n"],
    ['pascal-ack-image', "concurrency:\n  group: pascal-ack-image-${{ github.ref }}\n  cancel-in-progress: true\n\n"],
    ['rust-notices', "concurrency:\n  group: rust-notices-${{ github.head_ref || github.ref_name }}\n  cancel-in-progress: true\n\n"],
]);
const heldBeforeConcurrencyPolicy = (name, workflow) => {
    assert.ok(concurrencyPredecessors.has(name), `${name}: explicitly reviewed policy scope`);
    const labelGroup = name === 'i80386-hdd-gui-actual' ?
        "-${{ (github.event.action == 'labeled' || github.event.action == 'unlabeled') && format('label-{0}', github.event.label.name) || 'code' }}" : '';
    const predecessor = concurrencyPredecessors.get(name);
    const policy = reviewedConcurrency + labelGroup + reviewedCancellation + (predecessor === '' ? '\n' : '');
    assert.equal((workflow.match(/^concurrency:/gm) || []).length, 1, `${name}: one workflow concurrency block`);
    assert.equal(workflow.split(policy).length, 2, `${name}: exact reviewed concurrency policy`);
    return workflow.replace(policy, predecessor);
};

test('reviewed concurrency projection rejects missing, duplicate and altered policy', () => {
    for (const name of concurrencyPredecessors.keys()) {
        const workflow = fs.readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
        const held = heldBeforeConcurrencyPolicy(name, workflow);
        for (const mutation of [
            workflow.replace('concurrency:', 'unreviewed-concurrency:'),
            workflow + '\nconcurrency:\n',
            workflow.replace('${{ github.workflow }}', 'different-workflow'),
            workflow.replace("github.ref_type != 'tag'", "github.ref_type == 'tag'"),
            workflow.replace("github.event_name == 'push'", "github.event_name == 'workflow_dispatch'"),
            workflow.replace("github.event_name == 'pull_request')", "github.event_name == 'pull_request_target')"),
            workflow.replace(reviewedCancellation, '\n  cancel-in-progress: true\n'),
        ]) assert.throws(() => heldBeforeConcurrencyPolicy(name, mutation), `${name}: policy drift refuses`);
        // The projection must preserve even one unrelated byte for the old digest
        // to reject; it cannot normalize a trigger, job, step or cap modification.
        assert.equal(heldBeforeConcurrencyPolicy(name, workflow + '# unrelated drift\n'), held + '# unrelated drift\n');
    }
    assert.throws(() => heldBeforeConcurrencyPolicy('unreviewed-workflow', ''));
});

test('V9 manual selection preserves nine prior jobs and consumed execution retirement', () => {
    const workflow = heldBeforeConcurrencyPolicy('i80386-hdd-gui-actual',
        fs.readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml',import.meta.url),'utf8'));
    const registration = "  workflow_dispatch:\n    inputs:\n      pull_request:\n        description: Owned ready pull request number\n        required: true\n        type: string\n      source_head:\n        description: Reviewed 40-hex source head\n        required: true\n        type: string\n      request_sha256:\n        description: Historical Actual-V8 request SHA-256 (empty for V9)\n        required: false\n        default: ''\n        type: string\n      tag_name:\n        description: Historical Actual-V8 source tag (empty for V9)\n        required: false\n        default: ''\n        type: string\n      protocol:\n        description: Separately reviewed execution protocol\n        required: true\n        default: actual-v8\n        type: choice\n        options: [actual-v8, actual-v9]\n      source_ref:\n        description: Exact owned source branch ref for V9\n        required: false\n        default: ''\n        type: string\n      prelude_sha256:\n        description: Reviewed canonical same-job prelude SHA-256 for V9\n        required: false\n        default: ''\n        type: string\n";
    const anchor = 'on:\n  pull_request:\n    types: [opened, synchronize, reopened, labeled]\n';
    assert.equal(workflow.split(registration).length,2,'one exact closed seven-input manual trigger');
    assert.ok(workflow.includes(anchor+registration),'manual trigger follows the unchanged PR trigger');
    const begin=workflow.indexOf('  actual-v8:\n');
    const end=workflow.indexOf('  # Observation delivery only.',begin);
    assert.ok(begin>0 && end>begin,'one separately guarded v8 job before unchanged observation jobs');
    const priorWithFinite=workflow.slice(0,begin)+workflow.slice(end);
    const finiteStart=priorWithFinite.indexOf('  # Fresh CUI 408 installed inventory route; source and event gate are separate.\n');
    const finiteEnd=priorWithFinite.indexOf('  controls:\n',finiteStart);
    assert.ok(finiteStart>0 && finiteEnd>finiteStart,'one distinct finite V7 job before controls');
    const finiteJob=priorWithFinite.slice(finiteStart,finiteEnd);
    assert.match(finiteJob,/finite-inventory-seven:\n    if: >-\n      \$\{\{ false &&/,'spent V7 execution is retired');
    assert.match(finiteJob,/finite-inventory-eight:\n    if: >-\n      \$\{\{ false &&/,'spent F8 execution is retired');
    assert.match(finiteJob,/finite-inventory-nine:\n    if: >-\n      \$\{\{ false &&/,'consumed F9 source remains retired');
    assert.ok(finiteJob.indexOf('finite-inventory-v7-guard')<finiteJob.indexOf('actions\/setup-node@'));
    const prior=priorWithFinite.slice(0,finiteStart)+priorWithFinite.slice(finiteEnd);
    const retiredV7="  actual-v7:\n    if: >-\n      ${{ false && github.event_name == 'pull_request' &&\n"+
        "          github.event.action == 'labeled' && github.event.label.name == 'x86-hdd-gui-actual-v7'";
    assert.equal(prior.split(retiredV7).length,2,'one explicitly disabled V7 execution guard');
    const heldPrior=prior.replace(retiredV7,retiredV7.replace('false &&','true &&'));
    assert.equal(createHash('sha256').update(heldPrior.replace(registration,'')).digest('hex'),
        'd14d38590321bc2afd367bc7c4e695e82414049362233ab1f089250a39d9e6a5',
        'all other permissions, concurrency, nine prior job guards and steps retain reviewed H1fd bytes');
    const oldJobs=[...prior.matchAll(/^  ([a-z][a-z0-9-]*):\n    if:/gm)];
    assert.equal(oldJobs.length,9,'nine prior guarded jobs');
    for (let i=0;i<oldJobs.length;i++) {
        const body=prior.slice(oldJobs[i].index,i+1<oldJobs.length?oldJobs[i+1].index:prior.length);
        assert.match(body,/github\.event_name == 'pull_request'/,`${oldJobs[i][1]} remains inert on dispatch`);
    }
});

test('internal V8 tag is excluded from five isolated pushes and current main-only Rust push', () => {
    const reviewed = new Map([
        ['ack-z80-cpm','88d5a8b005b78faaa420ee65c74cabcb5e55c7b561e91647ed7e62cc525c8e4e'],
        ['basic-oracle','88725722f8784da8b11e2c1ee7bacea11ba959df16666d93bdab9cdc9b8d1783'],
        ['makecode-arcade-bases','1b9f0bc31c91bd383967bf1ee50767e242457ff80463ddc6163a6aca2a11b8b4'],
        ['pascal-ack-image','4f652ee179626ea3a6d529ec9e394012da5f66f38c99f3b08658c9eff4ba601e'],
        ['target-performance','281cefd18f5a17c8d8ff6787b5f4a4e4b25934bda99fb1d62e3dc42715cdcb3d'],
    ]);
    const block="  push:\n    branches: ['**']\n    tags-ignore: ['bw-gui-hdd-actual-v8-*']\n";
    const source = new Map();
    const check = (name, workflow) => {
        assert.equal(workflow.split(block).length,2,`${name}: one exact branch and tag filter`);
        assert.equal(createHash('sha256').update(heldBeforeConcurrencyPolicy(name,workflow).replace(block,'  push:\n')).digest('hex'),
            reviewed.get(name),`${name}: every preexisting trigger, path, job and step is byte-held`);
        const branches=workflow.match(/^    branches: \['([^']+)'\]$/gm) || [];
        const tags=workflow.match(/^    tags-ignore: \['([^']+)'\]$/gm) || [];
        assert.deepEqual(branches,["    branches: ['**']"]);
        assert.deepEqual(tags,["    tags-ignore: ['bw-gui-hdd-actual-v8-*']"]);
        const accepts = ref => ref.startsWith('refs/heads/') ? branches.length===1 :
            ref.startsWith('refs/tags/') ? !ref.slice(10).startsWith('bw-gui-hdd-actual-v8-') : false;
        for (const ref of ['refs/heads/main','refs/heads/lane/a/b','refs/tags/v1.2.3',
            'refs/tags/ordinary/a','refs/tags/bw-gui-hdd-actual-v7-'+'a'.repeat(40)])
            assert.equal(accepts(ref),true,`${name}: preserve ${ref}`);
        assert.equal(accepts('refs/tags/bw-gui-hdd-actual-v8-'+'a'.repeat(40)),false,
            `${name}: reviewed V8 tag has no unrelated push workflow`);
    };
    for (const name of reviewed.keys()) {
        const workflow=fs.readFileSync(new URL(`../.github/workflows/${name}.yml`,import.meta.url),'utf8');
        source.set(name,workflow);
        check(name,workflow);
    }
    const name='pascal-ack-image',pascal=source.get(name);
    for (const mutation of [
        pascal.replace("    branches: ['**']\n",''),
        pascal.replace("    branches: ['**']","    branches: ['main']"),
        pascal.replace('bw-gui-hdd-actual-v8-*','bw-gui-hdd-actual-v7-*'),
        pascal.replace('bw-gui-hdd-actual-v8-*','v*'),
        pascal.replace('          push: true','          push: false'),
    ]) assert.throws(() => check(name,mutation),'a branch, tag or image-publish drift must refuse');
    const rust=fs.readFileSync(new URL('../.github/workflows/rust-notices.yml',import.meta.url),'utf8');
    const rustRoutes = workflow => {
        const header=workflow.slice(workflow.indexOf('\non:\n'),workflow.indexOf('\npermissions:\n'));
        const push=header.match(/^  push:\n    branches: \[([^\]\n]+)\]\n    paths:\n/m);
        assert.ok(push,'current Rust push has an explicit branch list before its unchanged paths');
        const branches=push[1].split(',').map(value=>value.trim().replace(/^['"]|['"]$/g,''));
        const pr=/^  pull_request:\n    paths:\n/m.test(header);
        const manual=/^  workflow_dispatch:\n/m.test(header);
        return (event,ref) => event==='push' ? ref.startsWith('refs/heads/') &&
            branches.some(branch=>branch==='**' || ref==='refs/heads/'+branch) :
            event==='pull_request' ? pr : event==='workflow_dispatch' ? manual : false;
    };
    const checkRust = (workflow,routes=rustRoutes) => {
        const accepts=routes(workflow);
        for(const [event,ref,wanted] of [
            ['push','refs/heads/main',true],['push','refs/heads/lane/a/b',false],
            ['push','refs/tags/v1.2.3',false],
            ['push','refs/tags/bw-gui-hdd-actual-v8-'+'a'.repeat(40),false],
            ['pull_request','refs/heads/lane/a/b',true],
            ['workflow_dispatch','refs/heads/main',true],['unknown','refs/heads/main',false],
        ])assert.equal(accepts(event,ref),wanted,`current Rust route ${event} ${ref}`);
        assert.equal(createHash('sha256').update(heldBeforeConcurrencyPolicy('rust-notices',workflow)).digest('hex'),
            '6423176bbf016e429a70934b1c8f6b7fd4e852724c4c7313fbeaa1ec245e314c',
            'exact reviewed main-only Rust source: both path lists, manual trigger, runtime and caps held');
    };
    checkRust(rust);
    for(const [old,value] of [
        ['    branches: [main]\n',''],['branches: [main]',"branches: ['**']"],
        ['branches: [main]','branches: [other]'],['  pull_request:\n','  pull_request_target:\n'],
        ['  workflow_dispatch:\n',''],['timeout-minutes: 5','timeout-minutes: 6'],
    ]){
        assert.ok(rust.includes(old));assert.throws(()=>checkRust(rust.replace(old,value)));
    }
    for(const canned of [()=>true,()=>false])assert.throws(()=>checkRust(rust,()=>canned));
});

// These are manufactured original-byte controls, never a browser/guest replay.
// The independent reader is loaded directly; no producer grading helper is used.
const controls = String.raw`
import ast,base64,copy,hashlib,importlib.util,io,json,os,pathlib,re,stat,sys,tarfile,tempfile,unittest,zipfile
from unittest.mock import patch
import contextlib
from types import SimpleNamespace
root=pathlib.Path(sys.argv[1])
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,root/path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
r=load('original_reader','scripts/read-i80386-hdd-gui-originals.py')
c=load('actual_controller','scripts/run-i80386-hdd-gui-actual.py')
E=r.encode;H=r.sha;D=r.decode
ROW=lambda raw:{'byteLength':len(raw),'sha256':H(raw)}
FIXTURE_CHECKOUT='/checkout'
def fixture_lstat(real_paths, real_lstat, mocked_lstat):
    # A real selected tree needs real ancestor directory metadata too. Strict
    # realpath checks every nonterminal component's kind.
    selected_paths=tuple(pathlib.Path(path) for path in real_paths)
    def selected(path,*args,**kwargs):
        named=pathlib.Path(path)
        if any(named==path or path in named.parents or named in path.parents for path in selected_paths):
            return real_lstat(path,*args,**kwargs)
        return mocked_lstat(path,*args,**kwargs)
    return selected

class FixturePaths(unittest.TestCase):
    def test_real_ancestors_children_and_mocked_siblings(self):
        real_lstat=os.lstat;mocked=[]
        sentinel=SimpleNamespace(st_mode=stat.S_IFREG|0o444)
        def fallback(path,*args,**kwargs):mocked.append(str(path));return sentinel
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary,tempfile.TemporaryDirectory(dir=root.parent) as other:
            checkout=pathlib.Path(temporary);child=checkout/'file';child.write_bytes(b'held')
            source=pathlib.Path(other)/'empty.py';source.write_bytes(b'')
            link=checkout/'alias';link.symlink_to(child.name)
            selected=fixture_lstat((checkout,source),real_lstat,fallback)
            for directory in (checkout,*checkout.parents,source.parent,*source.parents):
                self.assertTrue(stat.S_ISDIR(selected(directory).st_mode),str(directory))
            self.assertEqual(selected(child,dir_fd=None),real_lstat(child))
            self.assertEqual(selected(source).st_size,0,'separately selected source keeps its real metadata')
            self.assertTrue(stat.S_ISLNK(selected(link).st_mode),'symlink metadata is not resolved away')
            for outside in (checkout.with_name(checkout.name+'-sibling'),source.with_name('unselected.py'),pathlib.Path('/synthetic-tool')):
                self.assertIs(selected(outside),sentinel)
            self.assertEqual(len(mocked),3,'only unrelated siblings and synthetic tool paths use the mock')
            child.unlink()
            with self.assertRaises(FileNotFoundError):selected(child)
        owner=Originals();typed=owner.selected_empty_source_fixture();observed={}
        typed(c.EMPTY_PYTHON_PATH,owner.empty_selection()[c.EMPTY_PYTHON_PATH],observed)
        self.assertEqual(observed['read'],{'byteLength':0,'sha256':H(b''),'eof':True})
        self.assertTrue(observed['close']['attempted'] and observed['close']['succeeded'])
        for path,selection in [('/different-source',owner.empty_selection()[c.EMPTY_PYTHON_PATH]),
          (c.EMPTY_PYTHON_PATH,dict(owner.empty_selection()[c.EMPTY_PYTHON_PATH],byteLength=False))]:
            target={}
            with self.assertRaisesRegex(ValueError,'fixture selected empty Python source identity'):typed(path,selection,target)
            self.assertEqual(target,{})

PNG=b'\x89PNG\r\n\x1a\nmanufactured'
def zip_(files,compression=zipfile.ZIP_DEFLATED):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',compression=compression) as archive:
        for name,raw in sorted(files.items()):
            info=zipfile.ZipInfo(name,(1980,1,1,0,0,0))
            info.compress_type=archive.compression
            info.external_attr=((0o40775<<16)|0x10) if info.filename.endswith('/') else 0o600<<16
            archive.writestr(info,raw)
    return out.getvalue()
def packet(files,compression=zipfile.ZIP_DEFLATED):
    files={k:v for k,v in files.items() if k!='inventory.json'}
    return zip_(dict(files,**{'inventory.json':E({'schema':'bw.gui-hdd.originals.v1','files':{k:ROW(v) for k,v in files.items()}})}),compression)
def roster_name(pattern):
    return re.sub(r'\[0-9a-f\]\{(\d+)\}',lambda m:'a'*int(m.group(1)),pattern).replace('\\','')
def pages_tar(contents):
    out=io.BytesIO()
    with tarfile.open(fileobj=out,mode='w') as archive:
        for name,raw in contents.items():
            info=tarfile.TarInfo(name);info.size=len(raw);archive.addfile(info,io.BytesIO(raw))
    return out.getvalue()
def role_chunks(start=100,hashed=True):
    # One manufactured numeric chunk per reviewed role: its id is arbitrary and
    # its body carries the role's exact string literal, as a real chunk does.
    out={}
    for n,(role,marker) in enumerate(r.ACTUAL_V9_FRONTEND_CHUNK_ROLES):
        name='chunks/%d%s.js'%(start+n,'.'+'c'*20 if hashed and n%2 else '')
        out[name]=('/*'+role+'*/var s="'+marker+'";').encode()
    out['chunks/99.'+'d'*20+'.js']=b'var s="an unrelated numeric chunk";'
    return out
def pages_contents():
    # Synthetic Pages layout: one member per reviewed V9 roster entry plus one
    # unrelated member that the V9 subset must neither read nor install.
    contents={roster_name(p):('roster:'+roster_name(p)).encode() for p in r.ACTUAL_V9_FRONTEND_ROSTER}
    contents.update(role_chunks())
    contents.update({'index.html':b'<html>manufactured</html>','brickwright-build.json':E({'commit':'a'*7}),'static/assets/unrelated.wasm':b'not x86'})
    return contents
def image_():
    image=bytearray(r.INPUTS['hdd'][0]);image[510:512]=b'\x55\xaa';image[454:458]=(17).to_bytes(4,'little');p=17*512
    image[p+510:p+512]=b'\x55\xaa';image[p+11:p+13]=(512).to_bytes(2,'little');image[p+13]=2
    image[p+14:p+16]=(1).to_bytes(2,'little');image[p+16]=2;image[p+17:p+19]=(512).to_bytes(2,'little');image[p+22:p+24]=(41).to_bytes(2,'little')
    fat=p+512;root_=fat+82*512;data=root_+512*32
    for at in (fat,fat+41*512):image[at+4:at+6]=b'\xff\xff'
    image[root_:root_+11]=b'BWKEEP  TXT';image[root_+11]=0x20;image[root_+26:root_+28]=(2).to_bytes(2,'little');marker=b'bw-hdd-persist-ok\r\n'
    image[root_+28:root_+32]=len(marker).to_bytes(4,'little');image[data:data+len(marker)]=marker
    return bytes(image)
def proc(argv,stdout=b'',stderr=b'',env=None,seconds=1):
    return {'argv':argv,'environment':env or {},'identity':{'pid':400,'pgid':400,'sessionId':400,'startTicks':8},
      'descendantSamples':[],'remainingDescendants':[],'startedNs':1,'endedNs':int(seconds*1e9)+1,'exitCode':0,
      'streams':{'stdout':ROW(stdout),'stderr':ROW(stderr)},'overflowObservedBytes':{},'firstFailure':None,'secondaryFailures':[],
      'sameProcessGroupCleanupContinuousOwnershipQualified':False}
def fixture():
    contents={name:('source:'+name).encode() for name in r.SOURCE};source={'head':'a'*40,'tree':'b'*40,'files':{name:ROW(raw) for name,raw in contents.items()}}
    critical={name:source['files'].get(name,ROW(name.encode())) for name in r.CRITICAL}
    installed={name+'/package.json':ROW(name.encode()) for name in ('node_modules/bw-board','node_modules/playwright','node_modules/playwright-core')}
    runtime={'files':{'/node':{'byteLength':124827920,'sha256':'fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48'},
      '/usr/bin/python3.12':ROW(b'python'),'/usr/lib/libselected.so':ROW(b'selected-library'),'/chrome':ROW(b'chrome'),'/usr/bin/git':ROW(b'git'),'/usr/bin/gh':ROW(b'gh')},
      'aliases':{'/python-link':{'linkText':'/usr/bin/python3.12','target':'/usr/bin/python3.12'}},'directoryAliases':{'/runtime-lib':{'linkText':'usr/lib','target':'/usr/lib'}},'node':'/node','python':'/usr/bin/python3.12','chromium':'/chrome',
      'tools':{'git':'/usr/bin/git','gh':'/usr/bin/gh'},'resources':{'jobMinutes':35,'controllerSeconds':1800,
       'scenarioSeconds':{'freedos-hdd-persistence':1250,'forward-debug':180},'perProcessCoreBytes':0,
       'perProcessFileBytes':r.FILE_CAP,'perProcessOpenFiles':256,'aggregateContainmentQualified':False}}
    prior={'schema':'bw.gui-hdd.inventory-original.v2','observationOnly':True,'templateSha256':'9'*64,'source':source,
      'installedFiles':installed,'runtime':runtime,'commands':[],'platform':{'GITHUB_RUN_ID':'90','GITHUB_RUN_ATTEMPT':'1',
       'GITHUB_JOB':'inventory','GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','BW_EXPECTED_HEAD':'a'*40}}
    prior_event=E({'action':'labeled','label':{'name':'x86-hdd-gui-inventory'},'sender':{'login':'CrispStrobe'},'repository':{'full_name':r.REPOSITORY},'number':123,
      'pull_request':{'number':123,'state':'open','head':{'sha':'a'*40,'repo':{'full_name':r.REPOSITORY,'fork':False}},
        'base':{'ref':'main','repo':{'full_name':r.REPOSITORY}},'body':'<!-- BW_GUI_HDD_INVENTORY_SHA256='+'9'*64+' -->'}})
    prior['event']=dict(ROW(prior_event),base64=base64.b64encode(prior_event).decode())
    prior_raw=E(prior)
    frontend=zip_({'artifact.tar':pages_tar(pages_contents())})
    admission={'schema':'bw.gui-hdd.frontend-source-admission.v1','checkoutHead':'a'*40,'checkoutTree':'b'*40,
      'sourceFiles':source['files'],'checkoutLog':ROW(b'independently retained checkout original'),
      'workflow':{'commit':'a'*40,'path':'.github/workflows/build.yml','sha256':'8'*64}}
    build={'runId':100,'attempt':1,'head':'a'*40,'jobId':101,'jobName':'build','artifactId':102,'name':'github-pages',
      'metadataBytes':len(frontend),'zipBytes':len(frontend),'sha256':H(frontend),'checkoutHead':'a'*40,'sourceFiles':source['files'],'sourceAdmission':admission}
    request={'schema':'bw.gui-hdd.actual-request.v3','repository':r.REPOSITORY,'pullRequest':123,'source':source,'build':build,
      'pythonStartup':r.startup_policy(),'criticalFiles':critical,'installedFiles':installed,'runtime':runtime,'inventoryAdmission':{
       'schema':'bw.gui-hdd.inventory-admission.v2','sourceHead':'a'*40,'runId':90,'jobId':91,'artifactId':92,'artifactSha256':'7'*64,
       'original':ROW(prior_raw),'templateSha256':'9'*64,'workflow':{'commit':'d'*40,'path':'.github/workflows/i80386-hdd-gui-actual.yml','sha256':'6'*64}},
      'inputs':{name:dict(ROW(b'ignored'),path='gui-inputs/'+name) for name in r.INPUTS}}
    for name,(size,digest) in r.INPUTS.items():request['inputs'][name]={'path':{'floppy':'gui-inputs/floppy.img','hdd':'gui-inputs/hdd.img','bios':'gui-inputs/bios.bin','vgaRom':'gui-inputs/vga.bin'}[name],'byteLength':size,'sha256':digest}
    raw=E(request);pin=H(raw);repo={'full_name':r.REPOSITORY,'fork':False}
    event={'action':'labeled','label':{'name':r.LABEL},'sender':{'login':'CrispStrobe'},'repository':repo,'number':123,
      'pull_request':{'number':123,'state':'open','head':{'sha':'a'*40,'repo':repo},'base':{'ref':'main','repo':repo},
       'body':'<!-- BW_GUI_HDD_REQUEST_SHA256='+pin+' -->'}}
    observed=dict(runtime,identities={'/chrome':{'dev':4,'ino':5}},directoryIdentities={'/usr/lib':{'dev':4,'ino':6,'mode':stat.S_IFDIR|0o755}},aggregateContainmentQualified=False)
    files={'request.original.json':raw,'event.original.json':E(event),'source.before.json':E(source),'source.after.json':E(source),
      'installed.before.json':E(installed),'installed.after.json':E(installed),'runtime.before.json':E(observed),'runtime.after.json':E(observed),
      'frontend.original.zip':frontend,'frontend.members.json':E(r.read_frontend(frontend)[0]),'build.inventory.json':E(r.read_frontend(frontend)[1]),
      'probe-admission.json':E({'schema':'bw.gui-hdd-persistence-admission.v1','boardPin':r.BOARD,'sourceHead':source['head'],
      'criticalFiles':critical,'buildRoot':FIXTURE_CHECKOUT+'/gui-originals/originals-build','buildFiles':r.read_frontend(frontend)[1],
      'inputPaths':{name:FIXTURE_CHECKOUT+'/'+row['path'] for name,row in request['inputs'].items()}}),'frontend-acquisition.stderr':b'',
      'result.json':E({'schema':'bw.gui-hdd.result.v1','pass':True,'requestSha256':pin,'scenarios':list(r.SCENARIOS),'firstFailure':None,'secondary':[]})}
    buildrun={'id':100,'run_attempt':1,'status':'completed','conclusion':'success','head_sha':'a'*40,
      'repository':repo,'path':'.github/workflows/build.yml'}
    buildjob={'id':101,'run_id':100,'name':'build','status':'completed','conclusion':'success'}
    buildartifact={'id':102,'name':'github-pages','expired':False,'size_in_bytes':len(frontend),'workflow_run':{'id':100,'head_sha':'a'*40},'digest':'sha256:'+H(frontend)}
    for role,value in (('build-run',buildrun),('build-job',buildjob),('build-artifact',buildartifact)):files[role+'.original.json']=E(value)
    acquisition=proc(['/usr/bin/gh','api','repos/'+r.REPOSITORY+'/actions/artifacts/102/zip'],frontend)
    files['frontend-acquisition.process.json']=E(acquisition)
    prefix=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
    args=[['rev-parse','HEAD'],['rev-parse','HEAD^{tree}']]+[['cat-file','blob','a'*40+':'+name] for name in sorted(r.SOURCE)]
    args+=[['rev-parse','HEAD'],['rev-parse','HEAD^{tree}']]
    indices=list(range(len(r.SOURCE)+2))+[len(r.SOURCE)+5,len(r.SOURCE)+6]
    for position,(index,arguments) in enumerate(zip(indices,args)):
        stdout=((source['head' if arguments[1]=='HEAD' else 'tree']+'\n').encode() if arguments[0]=='rev-parse' else contents[sorted(r.SOURCE)[position-2]])
        role='git-'+str(index);files[role+'.stdout']=stdout;files[role+'.stderr']=b'';files[role+'.process.json']=E(proc(prefix+arguments,stdout))
    for scenario in r.SCENARIOS:
        env={'PROOF_ADMISSION':FIXTURE_CHECKOUT+'/gui-originals/originals/probe-admission.json','PROOF_OUTPUT':FIXTURE_CHECKOUT+'/gui-originals/originals/'+scenario,'PROOF_SCENARIO':scenario,'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH':'/chrome','PROOF_BROWSER_SHA256':H(b'chrome')}
        child=proc(['/node',r.PROBE],env=env);child['descendantSamples']=[{'atNs':2,'descendants':[{'executable':'/chrome','executableIdentity':{'dev':4,'ino':5}}]}]
        files[scenario+'.stdout']=b'';files[scenario+'.stderr']=b'';files[scenario+'.process.json']=E(child)
        files[scenario+'/browser-launch.json']=E({'executablePath':'/chrome','byteLength':6,'sha256':H(b'chrome'),'headless':True})
        files[scenario+'/admission.json']=files['probe-admission.json']
    image=image_();boundary={'cpuCycles':50,'machineCycles':100};paused=dict(boundary,timeNs=100,phase='paused',sameTarget=True)
    hdd='freedos-hdd-persistence/'
    files[hdd+'386-master-hdd.img']=image
    files[hdd+'386-master-hdd.json']=E({'schema':'bw.i80386-master-hdd-download.v1','snapshotSchema':'bw.i80386-master-hdd-copy.v1',
      'drive':'master','byteLength':len(image),'sha256':H(image),'geometry':{'cylinders':306,'heads':4,'sectors':17},'boundary':boundary,
      'boundaryMeaning':'settled-detached-copy','guestCompletionQualified':False,'crashDurabilityQualified':False})
    files[hdd+'proof.json']=E({'ok':True,'scenario':'freedos-hdd-persistence','downloadsSaved':2,'freshSessionReadback':True,
      'originalSessionRetained':True,'fullOsQualified':False,'crashDurabilityQualified':False,'exportSha256':H(image)})
    files[hdd+'observations.json']=E([{'page':page,'cpuCycles':30,'machineCycles':60,'timeNs':60,
      'text':'C:\\>type c:\\bwkeep.txt\nbw-hdd-persist-ok\nC:\\>'} for page in (1,2)])
    files[hdd+'session-witnesses.json']=E({'paused':paused,'downloaded':paused,'retained':paused,
      'reloaded':{'page':2,'sameAsOriginal':False},'actions':[{'action':name} for name in ('write-marker','read-original','pause','download','reload-export','read-reloaded','retain-original')]})
    files[hdd+'session-1.png']=PNG;files[hdd+'session-2.png']=PNG
    actions=['pause','align','breakpoint-add','breakpoint-hit','step-1','step-2','physical-memory','breakpoint-remove','resume','pause-after-resume','circuits','code-retained']
    trace=[]
    for i,action in enumerate(actions):
        pc=0x7c11 if i<3 else (0x7c11 if i==4 else 0x7c13)
        cycle=20 if i<3 else (30 if i==3 else (31 if i==4 else (32 if i<9 else 40)))
        eax=0x12345678+(i>=5)+(i>=9)
        trace.append({'action':action,'regs':{'eax':eax,'edi':0x89abcdef,'eip':pc,'pc':pc,'eflags':2},'cpuCycles':cycle,'machineCycles':cycle*2,
          'timeNs':cycle*2,'phase':'running' if i==8 else 'paused','sameTarget':True})
    trace[1]['stepPerformed']=False;trace[3]['breakpointAddress']=0x7c13
    trace[6].update(readOnly=True,space='mem',address=0x7c00,bytes=list(bytes.fromhex('fa31c08ed866b87856341266bfefcdab896640ebfc')),
      cells=[{'address':0x7c00+i,'text':format(byte,'02X'),'role':None} for i,byte in enumerate(bytes.fromhex('fa31c08ed866b87856341266bfefcdab896640ebfc'))],
      renderedRegisters='EAX '+format(trace[5]['regs']['eax'],'08X')+' EDI 89ABCDEF',unsupported={'stepOver':True,'stepOut':True,'reverseStep':True,'reverseCycle':True,'reverseContinue':True})
    files['forward-debug/forward-trace.json']=E(trace);files['forward-debug/forward-debug.png']=PNG
    files['forward-debug/proof.json']=E({'ok':True,'scenario':'forward-debug','reverseExecutionQualified':False,'modeAwareDisassemblyQualified':False})
    for scenario in r.SCENARIOS:
        proof=D(files[scenario+'/proof.json']);proof.update(sourceHead=source['head'],boardPin=r.BOARD,admissionSha256=H(files['probe-admission.json']));files[scenario+'/proof.json']=E(proof)
    installed_stat={'dev':4,'ino':123,'mode':stat.S_IFDIR|0o555,'uid':1001,'gid':1001,'nlink':2,'size':4096,'mtimeNs':1700000000000000000,'empty':True}
    install=('bw.gui-hdd.python-startup-install.v1\n'+r.PYTHON_CACHE+'\ncreated-exclusive\nempty-before-entry\n4 123 416d 1001 1001 2 4096 1700000000\n').encode()
    startup={'schema':'bw.gui-hdd.python-startup-observation.v1','options':r.PYTHON_OPTIONS,
      'arguments':['scripts/run-i80386-hdd-gui-actual.py','actual','--request',FIXTURE_CHECKOUT+'/gui-inputs/request.json','--expected-sha256',pin,'--output',FIXTURE_CHECKOUT+'/gui-originals/originals'],
      'flags':{'isolated':1,'no_site':1,'no_user_site':1,'dont_write_bytecode':1,'ignore_environment':1,'safe_path':True,'optimize':0},
      'dontWriteBytecode':True,'path':r.PYTHON_PATH,'cachePrefix':r.PYTHON_CACHE,'xoptions':{'pycache_prefix':r.PYTHON_CACHE},'prefix':installed_stat,'zipAbsent':True}
    files['python-startup.original.txt']=install
    for stage in ('before','after'):files['python-startup.'+stage+'.json']=E(startup)
    expected={'requestSha256':pin,'buildSourceAdmissionSha256':H(E(admission)),
      'inventoryOriginal':dict(ROW(prior_raw),base64=base64.b64encode(prior_raw).decode()),'sourceHead':'a'*40,'runId':200,'jobId':201,'artifactId':202,
      'artifactName':'i80386-hdd-gui-200-1','artifactBytes':1,'artifactSha256':'0'*64,
      'run':{'id':200,'run_attempt':1,'status':'completed','conclusion':'success','event':'pull_request','head_sha':'a'*40,
       'repository':repo,'path':'.github/workflows/i80386-hdd-gui-actual.yml','actor':{'login':'CrispStrobe'}},
      'job':{'id':201,'run_id':200,'name':'actual','status':'completed','conclusion':'success','steps':[{'name':name,'status':'completed','conclusion':'success'} for name in r.STARTUP_STEPS]},
      'artifact':{'id':202,'name':'i80386-hdd-gui-200-1','expired':False,'size_in_bytes':1,
       'workflow_run':{'id':200,'head_sha':'a'*40},'digest':'sha256:'+'0'*64}}
    return files,expected

def sealed(files,expected,compression=zipfile.ZIP_DEFLATED):
    raw=packet(files,compression);expected=copy.deepcopy(expected);expected['artifactBytes']=len(raw);expected['artifactSha256']=H(raw)
    expected['artifact']['size_in_bytes']=len(raw);expected['artifact']['digest']='sha256:'+H(raw)
    return r.archive_originals(raw),expected

def empty_v4_observation():
    info={'dev':1,'ino':2,'mode':stat.S_IFREG|0o644,'uid':0,'gid':0,'nlink':1,'size':0,'mtime_ns':-1}
    return {'attempted':True,'status':'observed','source':{**{name:copy.deepcopy(info) for name in ('namedBefore','heldBefore','heldAfter','namedAfter')},
      'read':{'byteLength':0,'sha256':H(b''),'eof':True},'close':{'attempted':True,'succeeded':True}}}

def refresh_v4_request(files,expected,request):
    raw=E(request);pin=H(raw);files['request.original.json']=raw;expected['requestSha256']=pin
    expected['inventoryReferenceSha256']=H(E(request['inventoryAdmission']))
    event=D(files['event.original.json']);event['pull_request']['body']='<!-- BW_GUI_HDD_REQUEST_SHA256='+pin+' -->';files['event.original.json']=E(event)
    result=D(files['result.json']);result['requestSha256']=pin;files['result.json']=E(result)
    for stage in ('before','after'):
        name='python-startup.'+stage+'.json';value=D(files[name]);value['arguments'][value['arguments'].index('--expected-sha256')+1]=pin;files[name]=E(value)

def fixture_v4():
    # Independently authored typed originals over the unchanged complete v3 UI packet.
    files,expected=fixture();request=D(files['request.original.json']);old_runtime=copy.deepcopy(request['runtime'])
    selected={'/usr/lib/python3.12/urllib/__init__.py':{'role':'python-empty-package-source','byteLength':0,'sha256':H(b''),'uid':0,'gid':0,'mode':0o644}}
    template={'schema':'bw.gui-hdd.inventory-template.v3','sourceHead':'a'*40,'files':list(old_runtime['files']),
      'aliases':list(old_runtime['aliases']),'directoryAliases':list(old_runtime['directoryAliases']),
      **{name:copy.deepcopy(old_runtime[name]) for name in ('node','python','chromium','tools')},'emptyPythonSources':selected}
    template_raw=E(template);prior=D(base64.b64decode(expected['inventoryOriginal']['base64']))
    prior.update(schema='bw.gui-hdd.inventory-original.v3',templateSha256=H(template_raw),emptyPythonSources={path:empty_v4_observation() for path in selected})
    prior['platform']['GITHUB_WORKFLOW_REF']=r.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@refs/pull/123/merge'
    event=D(base64.b64decode(prior['event']['base64']));event['pull_request']['body']='<!-- BW_GUI_HDD_INVENTORY_SHA256='+H(template_raw)+' -->';raw=E(event)
    prior['event']=dict(ROW(raw),base64=base64.b64encode(raw).decode())
    prefix=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
    arguments=[['rev-parse','HEAD'],['rev-parse','HEAD^{tree}']]+[['cat-file','blob','a'*40+':'+path] for path in sorted(r.SOURCE)]
    outputs=[b'a'*40+b'\n',b'b'*40+b'\n']+[('source:'+path).encode() for path in sorted(r.SOURCE)]
    prior['commands']=[{'argv':prefix+args,'stdout':ROW(raw),'stderr':ROW(b''),'exitCode':0} for args,raw in zip(arguments,outputs)]
    prior_raw=E(prior);metadata={'schema':'bw.gui-hdd.inventory-admission.v3','source':request['source'],'template':ROW(template_raw),'original':ROW(prior_raw),'runId':90,'workflowSha':'d'*40}
    request['schema']='bw.gui-hdd.actual-request.v4';request['runtime']['emptyPythonSources']=copy.deepcopy(selected)
    request['inventoryAdmission']={'schema':'bw.gui-hdd.actual-inventory-reference.v1','metadataAdmission':metadata,'jobId':91,'artifactId':92,'artifactSha256':'7'*64,
      'workflow':{'commit':'d'*40,'path':'.github/workflows/i80386-hdd-gui-actual.yml','sha256':metadata['source']['files']['.github/workflows/i80386-hdd-gui-actual.yml']['sha256']}}
    expected.update(schema='bw.gui-hdd.actual-expectation.v4',inventoryTemplate=dict(ROW(template_raw),base64=base64.b64encode(template_raw).decode()),
      inventoryOriginal=dict(ROW(prior_raw),base64=base64.b64encode(prior_raw).decode()))
    for stage in ('before','after'):
        name='runtime.'+stage+'.json';old=D(files[name]);value={key:old[key] for key in ('files','aliases','directoryAliases','directoryIdentities','identities','resources','aggregateContainmentQualified')}
        value.update(schema='bw.gui-hdd.runtime-observation.v4',availableCpus=[0],rlimits={'4':[-1,-1],'1':[-1,-1],'7':[1024,1024]},emptyPythonSources={path:empty_v4_observation() for path in selected})
        files[name]=E(value)
    refresh_v4_request(files,expected,request);return files,expected

def native_v5_refresh(files,expected,reference,originals,request=None):
    reference['originals']={key:ROW(raw) for key,raw in originals.items()}
    expected['nativeFontOriginals']={key:dict(ROW(raw),base64=base64.b64encode(raw).decode()) for key,raw in originals.items()}
    expected['nativeFontReferenceSha256']=H(E(reference))
    request=D(files['request.original.json']) if request is None else request
    request['nativeFontAdmission']=reference
    refresh_v4_request(files,expected,request)
    if 'native-font.stage.json' in files:
        value=D(files['native-font.stage.json']);value.update(requestSha256=expected['requestSha256'],referenceSha256=expected['nativeFontReferenceSha256'],eventSha256=H(files['event.original.json']));files['native-font.stage.json']=E(value)

def finite_scope_fixture(version=4):
    value={'basis':'selected-core-runtime-for-owned-v5-fontconfig','globalFontDiscovery':False,
      'historicalGlobalRosterQualified':False,'nativeLibraryClosureProved':False,
      'fontSelectionProved':False,'browserFontSelectionProved':False,'guestApproved':False}
    if version>=5:value['installedEmptyRegularScoped']=True
    return value

def finite_body_fixture(raw,version=4):
    if version in (6,7,8,9):
        begin,end=(c.FINITE_V6_BEGIN,c.FINITE_V6_END) if version==6 else (c.FINITE_V7_BEGIN,c.FINITE_V7_END) if version==7 else (c.FINITE_V8_BEGIN,c.FINITE_V8_END) if version==8 else (c.FINITE_V9_BEGIN,c.FINITE_V9_END)
        return begin+'\n'+H(raw)+'\n'+end
    wrapper={'schema':'bw.gui-hdd.finite-inventory-transport.v5' if version==5 else 'bw.gui-hdd.finite-inventory-transport.v1',
      'sha256':H(raw),'templateBase64':base64.b64encode(raw).decode()}
    return '<!-- BW_GUI_HDD_FINITE_INVENTORY_V'+str(version)+'_BEGIN -->\n'+E(wrapper).decode()+'<!-- BW_GUI_HDD_FINITE_INVENTORY_V'+str(version)+'_END -->'

def finite_guard_fixture(source,template_raw,event_raw,platform,version=4):
    result={'schema':'bw.gui-hdd.finite-inventory-guard.v'+str(version) if version>=5 else 'bw.gui-hdd.finite-inventory-guard.v1',
      'pass':True,'templateSha256':H(template_raw),'eventSha256':H(event_raw),'source':source,
      'platform':{key:platform.get(key) for key in ('GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_JOB','GITHUB_REPOSITORY','GITHUB_WORKFLOW_SHA','BW_EXPECTED_HEAD')},
      'setupTrustBoundary':{'bootstrapGitTrusted':True,'packageInstallerTrusted':True,'completeRuntimeBeforeSetupProved':False},
      'fontSelectionProved':False,'browserFontSelectionProved':False,'guestApproved':False,'firstFailure':None,'secondary':[]}
    if version==7:
        vendor=E(c.FINITE_V7_PINS)
        result.update(dependencyPins=copy.deepcopy(c.FINITE_V7_PINS),
          vendorPinsOriginal=dict(ROW(vendor),base64=base64.b64encode(vendor).decode()))
    if version==8:
        vendor=E(c.FINITE_V8_PINS)
        result.update(dependencyPins=copy.deepcopy(c.FINITE_V8_PINS),
          vendorPinsOriginal=dict(ROW(vendor),base64=base64.b64encode(vendor).decode()),
          bootstrapAdmission={'source':copy.deepcopy(c.BOOTSTRAP_SOURCE),'gitHead':source['head'],
            'workspace':{'byteLength':c.BOOTSTRAP_SOURCE['byteLength'],'sha256':c.BOOTSTRAP_SOURCE['sha256']}})
    if version==9:
        vendor=E(c.FINITE_V9_PINS)
        result.update(dependencyPins=copy.deepcopy(c.FINITE_V9_PINS),
          vendorPinsOriginal=dict(ROW(vendor),base64=base64.b64encode(vendor).decode()),
          bootstrapAdmission={'source':copy.deepcopy(c.BOOTSTRAP_SOURCE),'gitHead':source['head'],
            'workspace':{'byteLength':c.BOOTSTRAP_SOURCE['byteLength'],'sha256':c.BOOTSTRAP_SOURCE['sha256']}})
    if version==10:
        vendor=E(c.FINITE_V10_PINS)
        result.update(dependencyPins=copy.deepcopy(c.FINITE_V10_PINS),
          vendorPinsOriginal=dict(ROW(vendor),base64=base64.b64encode(vendor).decode()),
          bootstrapAdmission={'source':copy.deepcopy(c.BOOTSTRAP_SOURCE),'gitHead':source['head'],
            'workspace':{'byteLength':c.BOOTSTRAP_SOURCE['byteLength'],'sha256':c.BOOTSTRAP_SOURCE['sha256']}})
    return result

def use_finite_basis_fixture(request,expected,version=4):
    stage,_=r.native_font_layout(request['nativeFontAdmission']);runtime=copy.deepcopy(request['runtime']);runtime.pop('emptyPythonSources')
    runtime['files']={path:row for path,row in runtime['files'].items() if not path.startswith(str(stage)+'/')}
    template={'schema':'bw.gui-hdd.inventory-template.v'+str(version),'sourceHead':request['source']['head'],'scope':finite_scope_fixture(version),
      **{key:runtime[key] for key in ('node','python','chromium','tools')},'emptyPythonSources':request['runtime']['emptyPythonSources'],
      'files':sorted(runtime['files']),'aliases':sorted(runtime['aliases']),'directoryAliases':sorted(runtime['directoryAliases']),
      'libraries':sorted(path for path in runtime['files'] if path.startswith('/usr/lib/') and path.endswith('.so'))}
    template_raw=E(template);prior=D(base64.b64decode(expected['inventoryOriginal']['base64']))
    prior.update(schema='bw.gui-hdd.inventory-original.v'+str(version),runtime=runtime,installedFiles=copy.deepcopy(request['installedFiles']),
      templateSha256=H(template_raw),scope=finite_scope_fixture(version),libraries=template['libraries'],fontSelectionProved=False,browserFontSelectionProved=False,guestApproved=False)
    prior['platform']['GITHUB_JOB']='finite-inventory-'+('five' if version==5 else 'six' if version==6 else 'v'+str(version))
    event=D(base64.b64decode(prior['event']['base64']));event['label']['name']='x86-hdd-gui-finite-inventory-v'+str(version);event['pull_request']['body']=finite_body_fixture(template_raw,version)
    event_raw=E(event);prior['event']=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode())
    guard_raw=E(finite_guard_fixture(request['source'],template_raw,event_raw,prior['platform'],version));prior['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
    prior_raw=E(prior);expected['inventoryTemplate']=dict(ROW(template_raw),base64=base64.b64encode(template_raw).decode());expected['inventoryOriginal']=dict(ROW(prior_raw),base64=base64.b64encode(prior_raw).decode())
    request['inventoryAdmission']['schema']='bw.gui-hdd.actual-finite-inventory-reference.v'+('3' if version==6 else '2' if version==5 else '1')
    request['inventoryAdmission']['metadataAdmission'].update(schema='bw.gui-hdd.inventory-admission.v'+str(version),template=ROW(template_raw),original=ROW(prior_raw))
    if version==6:
        request['inventoryAdmission']['metadataAdmission']['repositoryVariables']={
          'BW_FINITE_INVENTORY_V6_SHA256':H(template_raw),
          'BW_FINITE_INVENTORY_V6_TEMPLATE_B64':base64.b64encode(template_raw).decode()}

def use_finite_v8_basis_fixture(request,expected):
    # Authored synthetic byte packet only, never a projection of a real old observation.
    prior=D(base64.b64decode(expected['inventoryOriginal']['base64']));template=D(base64.b64decode(expected['inventoryTemplate']['base64']))
    template.update(schema='bw.gui-hdd.inventory-template.v8',sourceHead=request['source']['head'],dependencyPins=copy.deepcopy(c.FINITE_V8_PINS),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE));raw=E(template)
    event=D(base64.b64decode(prior['event']['base64']));event['label']['name']='x86-hdd-gui-finite-inventory-v8';event['pull_request']['body']+=finite_body_fixture(raw,8);event_raw=E(event)
    prior.update(schema='bw.gui-hdd.inventory-original.v8',source=copy.deepcopy(request['source']),templateSha256=H(raw),dependencyPins=copy.deepcopy(c.FINITE_V8_PINS),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE),event=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode()))
    prior['platform']['GITHUB_JOB']='finite-inventory-eight'
    for name,(size,sha256) in c.FINITE_V8_CUI_WITNESSES.items():prior['installedFiles'][name]={'byteLength':size,'sha256':sha256}
    prior['commands'][2+sorted(c.SOURCE).index('vendor-pins.json')]['stdout']=request['source']['files']['vendor-pins.json']
    guard=finite_guard_fixture(prior['source'],raw,event_raw,prior['platform'],8)
    prior['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode())
    prior['bootstrapAdmission']=guard['bootstrapAdmission'];prior['bootstrapHelper']=c.bootstrap_helper_output(b'Prepared official Ubuntu archive: 0 source file(s) changed\n',b'')
    metadata={'schema':'bw.gui-hdd.inventory-admission.v8','source':prior['source'],'template':ROW(raw),'original':ROW(E(prior)),'runId':90,'workflowSha':prior['platform']['GITHUB_WORKFLOW_SHA'],'dependencyPins':copy.deepcopy(c.FINITE_V8_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),
      'repositoryVariables':{'BW_FINITE_INVENTORY_V8_SHA256':H(raw),'BW_FINITE_INVENTORY_V8_TEMPLATE_B64':base64.b64encode(raw).decode()}}
    reference=copy.deepcopy(request['inventoryAdmission']);reference.update(schema='bw.gui-hdd.actual-finite-inventory-reference.v5',metadataAdmission=metadata)
    request['inventoryAdmission']=reference;request['installedFiles']=copy.deepcopy(prior['installedFiles'])
    expected.update(inventoryReferenceSha256=H(E(reference)),inventoryOriginal=dict(ROW(E(prior)),base64=base64.b64encode(E(prior)).decode()),inventoryTemplate=dict(ROW(raw),base64=base64.b64encode(raw).decode()))
def use_finite_v9_basis_fixture(request,expected):
    # Authored synthetic byte packet only, never a projection of a real old observation.
    prior=D(base64.b64decode(expected['inventoryOriginal']['base64']));template=D(base64.b64decode(expected['inventoryTemplate']['base64']))
    template.update(schema='bw.gui-hdd.inventory-template.v9',sourceHead=request['source']['head'],dependencyPins=copy.deepcopy(c.FINITE_V9_PINS),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE))
    template['files']=sorted(set(template['files'])|{'/etc/resolv.conf'})
    prior['runtime']['files']['/etc/resolv.conf']=ROW(b'resolver');request['runtime']['files']['/etc/resolv.conf']=ROW(b'resolver');raw=E(template)
    event=D(base64.b64decode(prior['event']['base64']));event['label']['name']='x86-hdd-gui-finite-inventory-v9';event['pull_request']['body']+=finite_body_fixture(raw,9);event_raw=E(event)
    prior.update(schema='bw.gui-hdd.inventory-original.v9',source=copy.deepcopy(request['source']),templateSha256=H(raw),dependencyPins=copy.deepcopy(c.FINITE_V9_PINS),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE),event=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode()))
    prior['platform']['GITHUB_JOB']='finite-inventory-nine'
    for name,(size,sha256) in c.FINITE_V9_CUI_WITNESSES.items():prior['installedFiles'][name]={'byteLength':size,'sha256':sha256}
    prior['commands'][2+sorted(c.SOURCE).index('vendor-pins.json')]['stdout']=request['source']['files']['vendor-pins.json']
    guard=finite_guard_fixture(prior['source'],raw,event_raw,prior['platform'],9)
    prior['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode())
    prior['bootstrapAdmission']=guard['bootstrapAdmission'];prior['bootstrapHelper']=c.bootstrap_helper_output(b'Prepared official Ubuntu archive: 0 source file(s) changed\n',b'')
    metadata={'schema':'bw.gui-hdd.inventory-admission.v9','source':prior['source'],'template':ROW(raw),'original':ROW(E(prior)),'runId':90,'workflowSha':prior['platform']['GITHUB_WORKFLOW_SHA'],'dependencyPins':copy.deepcopy(c.FINITE_V9_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),
      'repositoryVariables':{'BW_FINITE_INVENTORY_V9_SHA256':H(raw),'BW_FINITE_INVENTORY_V9_TEMPLATE_B64':base64.b64encode(raw).decode()}}
    reference=copy.deepcopy(request['inventoryAdmission']);reference.update(schema='bw.gui-hdd.actual-finite-inventory-reference.v6',metadataAdmission=metadata)
    request['inventoryAdmission']=reference;request['installedFiles']=copy.deepcopy(prior['installedFiles'])
    expected.update(inventoryReferenceSha256=H(E(reference)),inventoryOriginal=dict(ROW(E(prior)),base64=base64.b64encode(E(prior)).decode()),inventoryTemplate=dict(ROW(raw),base64=base64.b64encode(raw).decode()))

_FIXTURE_V5=None
def fixture_v5():
    global _FIXTURE_V5
    if _FIXTURE_V5 is not None:return copy.deepcopy(_FIXTURE_V5)
    # External independent native review is the input boundary of this consumer.
    # Manufactured bytes below test joins only; no native/font/browser executes.
    files,expected=fixture_v4();request=D(files['request.original.json']);request['schema']='bw.gui-hdd.actual-request.v5'
    native_files={'/usr/bin/fc-match':ROW(b'font-tool'),'/usr/lib/libfontconfig-selected.so':ROW(b'font-library'),
      FIXTURE_CHECKOUT+'/gui-inputs/native-font/fonts/selected.ttf':ROW(b'font'),FIXTURE_CHECKOUT+'/gui-inputs/native-font/NOTICE':ROW(b'notice')}
    request['runtime']['files'].update(native_files)
    request['installedFiles']['node_modules/bw-circuit-ui/package.json']=ROW(b'current-cui-package')
    request['installedFiles']['node_modules/bw-circuit-ui/src/current.js']=ROW(b'current-cui-source')
    for stage in ('before','after'):files['installed.'+stage+'.json']=E(request['installedFiles'])
    native_runtime={'files':{path:{'bytes':row['byteLength'],'sha256':row['sha256']} for path,row in native_files.items() if path in ('/usr/bin/fc-match','/usr/lib/libfontconfig-selected.so')},'aliases':{},'directoryAliases':{}}
    source={'head':'e'*40,'tree':'f'*40,'files':{path:{'sha256':H(('native-source:'+path).encode())} for path in r.NATIVE_FONT_SOURCE}}
    font={'url':'https://raw.githubusercontent.com/google/fonts/'+('9'*40)+'/apache/selected/font.ttf','bytes':4,'sha256':H(b'font'),'licenseUrl':'https://raw.githubusercontent.com/google/fonts/'+('9'*40)+'/apache/selected/NOTICE.txt','licenseBytes':6,'licenseSha256':H(b'notice'),'family':'Authored Fixture'}
    tool={'path':'/usr/bin/fc-match','bytes':9,'sha256':H(b'font-tool')}
    query={'pattern':'monospace:lang=en','format':'%{file}\t%{family}\t%{style}\t%{index}\n'}
    native={'schema':'bw.gui-hdd.native-font-request.v1','repository':r.REPOSITORY,'pullRequest':124,'source':source,
      'selection':{'font':font,'tool':tool,'query':query,'runtime':native_runtime},'limits':{}}
    native_raw=E(native).rstrip(b'\n');repo={'full_name':r.REPOSITORY,'fork':False}
    event={'action':'labeled','label':{'name':'x86-native-font-selection-v1'},'sender':{'login':'CrispStrobe'},'repository':repo,'number':124,
      'pull_request':{'number':124,'state':'open','head':{'sha':source['head'],'repo':repo},'base':{'ref':'main','repo':repo},
       'body':'<!-- BW_NATIVE_FONT_REQUEST_SHA256='+H(native_raw)+' -->'}}
    event_raw=E(event).rstrip(b'\n');false_flags={key:False for key in ('nativeLibraryClosureProved','wholeHostAttested','browserFontSelectionProved','actualRequestSupported','guestApproved')}
    native_observed={'schema':'bw.gui-hdd.native-font-original.v1','observationOnly':True,'systemFallbackExcluded':False,'request':{'bytes':len(native_raw),'sha256':H(native_raw)},
      'event':{'bytes':len(event_raw),'sha256':H(event_raw)},'source':{path:{'bytes':len(('native-source:'+path).encode()),**row} for path,row in source['files'].items()},
      'platform':{'GITHUB_RUN_ID':'300','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'native-font-selection','GITHUB_WORKFLOW_SHA':'d'*40},
      'nativeRuntime':dict(copy.deepcopy(native_runtime),loadedLibraries=[],version=None,environment={},after=copy.deepcopy(native_runtime),selectedReadback=True),
      'complete':True,'firstFailure':None,'secondary':[],'selectedNativeRuntimeReadbackProved':True,**false_flags}
    original_raw=E(native_observed)
    service_raw=E({'testOnly':True,'outsideService':'manufactured independently reviewed service original'})
    prior={'schema':'bw.gui-hdd.native-font-expectation.v1','requestSha256':H(native_raw),'eventSha256':H(event_raw),
      'originalSha256':H(original_raw),'originalBytes':len(original_raw),'runId':'300','jobId':301,'head':source['head'],'tree':source['tree'],
      'workflowSha':'d'*40,'sourceFiles':source['files'],'conclusion':'success','serviceSha256':H(service_raw),'serviceBytes':len(service_raw)}
    report={'schema':'bw.gui-hdd.native-font-reader.v1','nativeSelectionObserved':True,'sourceHead':source['head'],'runId':'300','jobId':301,
      'selectedFontSha256':font['sha256'],'selectedNativeRuntimeReadbackProved':True,'nativeRuntimeFiles':native_runtime['files'],
      'nativeRuntimeAliases':{},'nativeRuntimeDirectoryAliases':{},**false_flags}
    run={'id':300,'run_attempt':1,'status':'completed','conclusion':'success','head_sha':source['head'],'event':'pull_request',
      'repository':repo,'path':'.github/workflows/i80386-native-font-selection.yml','actor':{'login':'CrispStrobe'}}
    job={'id':301,'run_id':300,'name':'native-font-selection','status':'completed','conclusion':'success','steps':[
      {'name':name,'status':'completed','conclusion':'success'} for name in ('Refuse until selected font, tool, cache and event review','Retain bounded original only after separately reviewed activation')]}
    artifact={'id':302,'name':'i80386-native-font-selection-300-1','expired':False,'size_in_bytes':1234,'workflow_run':{'id':300,'head_sha':source['head']},'digest':'sha256:'+'2'*64}
    originals={'request':native_raw,'event':event_raw,'original':original_raw,'service':service_raw,'expectation':E(prior),'readerReport':E(report),'run':E(run),'job':E(job),'artifact':E(artifact)}
    reference={'schema':'bw.gui-hdd.actual-native-font-reference.v1','source':source,'workflow':{'commit':'d'*40,'path':run['path'],'sha256':source['files'][run['path']]['sha256']},
      'runId':300,'jobId':301,'artifactId':302,'artifactName':artifact['name'],'artifactBytes':1234,'artifactSha256':'2'*64,'originals':{},'files':native_files,
      'font':{'url':font['url'],'path':FIXTURE_CHECKOUT+'/gui-inputs/native-font/fonts/selected.ttf','byteLength':font['bytes'],'sha256':font['sha256'],
        'licenseUrl':font['licenseUrl'],'licensePath':FIXTURE_CHECKOUT+'/gui-inputs/native-font/NOTICE','licenseBytes':font['licenseBytes'],'licenseSha256':font['licenseSha256']},
      'tool':{'path':tool['path'],'byteLength':tool['bytes'],'sha256':tool['sha256']}}
    stage,config=r.native_font_layout(reference)
    request['runtime']['files'].update({str(stage/'fontconfig.xml'):ROW(config),'/usr/bin/curl':ROW(b'curl')})
    staged={}
    for index,path in enumerate((reference['font']['path'],reference['font']['licensePath'],str(stage/'fontconfig.xml'))):
        row=request['runtime']['files'][path]
        staged[path]=dict(row,identity={'dev':4,'ino':20+index,'mode':stat.S_IFREG|0o444,'uid':1001,'gid':1001,'nlink':1,'size':row['byteLength'],'mtime_ns':123})
    cache={'path':str(stage/'cache'),'identity':{'dev':4,'ino':23,'mode':stat.S_IFDIR|0o700,'uid':1001,'gid':1001,'nlink':2,'size':4096,'mtime_ns':123},
      'entries':{},'totalBytes':0,'byteCap':8<<20,'entryCap':128,'quotaEnforced':False}
    files['native-font.config.original.xml']=config
    files['native-font.cache.before.json']=E(cache);files['native-font.cache.after.json']=E(cache)
    native_stage={'schema':'bw.gui-hdd.native-font-stage.v1','requestSha256':'','referenceSha256':'','source':request['source'],'eventSha256':'','platform':{'GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual','GITHUB_REPOSITORY':r.REPOSITORY},'root':str(stage),
      'files':staged,'fontUrl':font['url'],'licenseUrl':font['licenseUrl'],'cache':cache}
    for role,raw,url,seconds in (('native-font.font',b'font',font['url'],30),('native-font.notice',b'notice',font['licenseUrl'],15)):
        files[role+'.stdout']=raw;files[role+'.stderr']=b''
        env={'LANG':'C.UTF-8','HOME':'/nonexistent','PATH':'/usr/bin:/bin','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_NO_LAZY_FETCH':'1','GIT_TERMINAL_PROMPT':'0'}
        child=proc(r.native_font_fetch_argv(url,seconds,len(raw)),raw,env=env);child.update(startedNs=1 if role.endswith('font') else 1000000002,endedNs=1000000001 if role.endswith('font') else 2000000002);files[role+'.process.json']=E(child)
    for scenario in r.SCENARIOS:
        child=D(files[scenario+'.process.json']);child.update(startedNs=3000000000,endedNs=4000000000);child['environment'].update(FONTCONFIG_FILE=str(stage/'fontconfig.xml'),XDG_CACHE_HOME=str(stage/'cache'));files[scenario+'.process.json']=E(child)
    expected['schema']='bw.gui-hdd.actual-expectation.v5'
    for stage in ('before','after'):
        value=D(files['runtime.'+stage+'.json']);value['schema']='bw.gui-hdd.runtime-observation.v5';value['nativeFontDirectories']={path:{'identity':dict(cache['identity'],ino=24+index,mode=stat.S_IFDIR|0o555),'names':names} for index,(path,names) in enumerate(((str(r.native_font_layout(reference)[0]),sorted(('fonts','cache','NOTICE','fontconfig.xml','staging.original.json'))),(str(r.native_font_layout(reference)[0]/'fonts'),['selected.ttf'])))};value['files']=copy.deepcopy(request['runtime']['files']);value['identities'].update({path:{'dev':row['identity']['dev'],'ino':row['identity']['ino']} for path,row in staged.items()});files['runtime.'+stage+'.json']=E(value)
    request['nativeFontAdmission']=reference
    use_finite_basis_fixture(request,expected)
    native_v5_refresh(files,expected,reference,originals,request)
    native_stage.update(requestSha256=expected['requestSha256'],referenceSha256=expected['nativeFontReferenceSha256'],eventSha256=H(files['event.original.json']));files['native-font.stage.json']=E(native_stage)
    _FIXTURE_V5=copy.deepcopy((files,expected))
    return files,expected

class Originals(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.files,cls.expected=fixture()
    def fresh(self):return copy.deepcopy(self.files),copy.deepcopy(self.expected)
    def rejects(self,mutate):
        files,expected=self.fresh();mutate(files,expected)
        with self.assertRaises((ValueError,KeyError,TypeError)):r.audit(*sealed(files,expected))
    def test_complete_manufactured_positive(self):
        files,expected=sealed(*self.fresh());result=r.audit(files,expected);self.assertTrue(result['pass']);self.assertEqual(result['forwardDebug']['instructions'],2)
        self.assertEqual(c.parse_request(files['request.original.json'],expected['requestSha256']),r.parse_request(files['request.original.json'],expected['requestSha256']))
    def test_external_request_pin_survives_rehash(self):
        def cut(f,e):
            request=D(f['request.original.json']);request['pullRequest']=124;f['request.original.json']=E(request)
            event=D(f['event.original.json']);event['number']=124;event['pull_request']['number']=124;f['event.original.json']=E(event)
        self.rejects(cut)
    def test_build_admission_external_pin(self):self.rejects(lambda f,e:e.__setitem__('buildSourceAdmissionSha256','0'*64))
    def test_prior_inventory_external_original(self):self.rejects(lambda f,e:e['inventoryOriginal'].__setitem__('sha256','0'*64))
    def test_source_original_rehashed(self):self.rejects(lambda f,e:f.__setitem__('source.after.json',E(dict(D(f['source.after.json']),head='f'*40))))
    def test_full_width_register_mutation(self):
        def cut(f,e):
            trace=D(f['forward-debug/forward-trace.json']);trace[4]['regs']['edi']=0xcdef;f['forward-debug/forward-trace.json']=E(trace)
        self.rejects(cut)
    def test_step_mutation(self):
        def cut(f,e):
            trace=D(f['forward-debug/forward-trace.json'])
            for item in trace[5:]:item['regs']['eax']-=1
            trace[6]['renderedRegisters']='EAX '+format(trace[5]['regs']['eax'],'08X')+' EDI 89ABCDEF'
            f['forward-debug/forward-trace.json']=E(trace)
        self.rejects(cut)
    def test_resumed_original_not_retained(self):
        def cut(f,e):
            witness=D(f['freedos-hdd-persistence/session-witnesses.json']);witness['retained']['cpuCycles']+=1;f['freedos-hdd-persistence/session-witnesses.json']=E(witness)
        self.rejects(cut)
    def test_fresh_chooser_missing_marker(self):
        def cut(f,e):
            observations=D(f['freedos-hdd-persistence/observations.json']);observations[1]['text']='C:\\>';f['freedos-hdd-persistence/observations.json']=E(observations)
        self.rejects(cut)
    def test_browser_actual_process_wrong_inode(self):
        def cut(f,e):
            process=D(f['forward-debug.process.json']);process['descendantSamples'][0]['descendants'][0]['executableIdentity']['ino']+=1;f['forward-debug.process.json']=E(process)
        self.rejects(cut)
    def test_rendered_memory_text_fully_rehashed(self):
        def cut(f,e):
            trace=D(f['forward-debug/forward-trace.json']);trace[6]['cells'][0]['text']='00';f['forward-debug/forward-trace.json']=E(trace)
        self.rejects(cut)
    def test_rendered_memory_address_and_interaction(self):
        for key,value in (('address',0x7c01),('role','button'),('text','fa'),('text','FAextra')):
            def cut(f,e):
                trace=D(f['forward-debug/forward-trace.json']);trace[6]['cells'][0][key]=value;f['forward-debug/forward-trace.json']=E(trace)
            self.rejects(cut)
    def test_rendered_full_width_registers_fully_rehashed(self):
        for rendered in ('EAX 5678 EDI CDEF','EAX 12345678 EDI 89ABCDEF','EAX 12345679 EDI 89ABCDEF0'):
            def cut(f,e):
                trace=D(f['forward-debug/forward-trace.json']);trace[6]['renderedRegisters']=rendered;f['forward-debug/forward-trace.json']=E(trace)
            self.rejects(cut)
    def test_remaining_escaped_descendant(self):
        def cut(f,e):
            process=D(f['forward-debug.process.json']);process['remainingDescendants']=[{'pid':900}];f['forward-debug.process.json']=E(process)
        self.rejects(cut)
    def test_boolean_job_identity(self):self.rejects(lambda f,e:e['job'].__setitem__('id',True))
    def test_official_artifact_size(self):
        files,expected=sealed(*self.fresh());expected['artifact']['size_in_bytes']+=1
        with self.assertRaises(ValueError):r.audit(files,expected)
    def test_unknown_original_role(self):
        with self.assertRaises(ValueError):r.archive_originals(packet(dict(self.files,unexpected=b'not admitted')))
    def test_tracked_git_stdout_rehashed(self):
        def cut(f,e):
            raw=b'f'*40+b'\n';f['git-0.stdout']=raw;process=D(f['git-0.process.json']);process['streams']['stdout']=ROW(raw);f['git-0.process.json']=E(process)
        self.rejects(cut)
    def test_duplicate_json_and_nonfinite(self):
        for raw in (b'{"x":1,"x":2}',b'{"x":NaN}',b'{"x":1e999}'):
            for module in (r,c):
                with self.assertRaises(ValueError):module.decode(raw)
    def test_fat_exact_extent_and_chain(self):
        original=image_();self.assertEqual(r.fat_marker(original)['clusters'],1)
        p=17*512;fat=p+512;directory=fat+82*512
        cuts=[]
        value=bytearray(original);value[directory+28:directory+32]=(20).to_bytes(4,'little');cuts.append(value)
        value=bytearray(original);value[directory+32:directory+64]=value[directory:directory+32];cuts.append(value)
        value=bytearray(original);value[directory+11]=0xf;cuts.append(value)
        value=bytearray(original)
        for at in (fat,fat+41*512):value[at+4:at+6]=(3).to_bytes(2,'little');value[at+6:at+8]=b'\xff\xff'
        cuts.append(value)
        for value in cuts:
            with self.assertRaises(ValueError):r.fat_marker(bytes(value))
    def test_traversal_and_symlink_archive(self):
        for name in ('../bad','/bad','originals/../bad'):
            with self.assertRaises(ValueError):r.archive_originals(zip_({name:b'bad'}))
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as archive:
            info=zipfile.ZipInfo('result.json');info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;archive.writestr(info,b'target')
        with self.assertRaises(ValueError):r.archive_originals(out.getvalue())
    def test_frontend_nested_tar_safe(self):
        out=io.BytesIO()
        with tarfile.open(fileobj=out,mode='w') as archive:
            for name,raw in {'index.html':b'index','brickwright-build.json':b'{}'}.items():
                info=tarfile.TarInfo(name);info.size=len(raw);archive.addfile(info,io.BytesIO(raw))
        raw=zip_({'artifact.tar':out.getvalue()});self.assertEqual(c.frontend_files(raw)[:2],r.read_frontend(raw))
        with self.assertRaises(ValueError):r.read_frontend(zip_({'../index.html':b'escape'}))
    def frontend_zip_profile(self,cut=None,contents=None,compression=zipfile.ZIP_STORED):
        contents=contents or {'index.html':b'<html>manufactured</html>','brickwright-build.json':E({'commit':'a'*7})}
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w',compression=compression) as archive:
            for name,raw in contents.items():
                info=zipfile.ZipInfo(name+'XXhidden' if name=='index.html' and cut=='nul-name' else name);info.create_system=3;info.compress_type=compression
                info.external_attr=((stat.S_IFIFO if name=='index.html' and cut=='fifo' else stat.S_IFREG)|0o644)<<16
                if cut=='mode-zero':info.external_attr=0o600<<16
                archive.writestr(info,raw)
            if cut not in (None,'nul-name','fifo','mode-zero'):
                directory=cut in ('empty-directory','directory-payload','file-directory','symlink-directory','double-slash-directory','duplicate-directory')
                name='assets/' if directory else '../late.txt' if cut=='path' else 'index.html' if cut=='duplicate-file' else 'late.txt'
                if cut=='double-slash-directory':name='assets//'
                info=zipfile.ZipInfo(name);info.create_system=3;info.compress_type=compression
                kind={'late-fifo':stat.S_IFIFO,'socket':stat.S_IFSOCK,'block':stat.S_IFBLK,'directory-file':stat.S_IFDIR,'file-directory':stat.S_IFREG,'symlink-directory':stat.S_IFLNK}.get(cut,stat.S_IFDIR if directory else stat.S_IFREG)
                info.external_attr=(kind|0o644)<<16
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore',UserWarning);archive.writestr(info,b'payload' if cut=='directory-payload' or not directory else b'')
                    if cut=='duplicate-directory':archive.writestr(info,b'')
        raw=out.getvalue()
        if cut=='nul-name':raw=raw.replace(b'index.htmlXXhidden',b'index.html\x00Xhidden')
        if cut in ('encrypted','compression','extent'):
            raw=bytearray(raw)
            for marker,flag,method,size in ((b'PK\x03\x04',6,8,22),(b'PK\x01\x02',8,10,24)):
                start=raw.rfind(marker);self.assertGreaterEqual(start,0)
                if cut=='encrypted':raw[start+flag:start+flag+2]=(1).to_bytes(2,'little')
                elif cut=='compression':raw[start+method:start+method+2]=(99).to_bytes(2,'little')
                else:raw[start+size:start+size+4]=(r.FILE_CAP+1).to_bytes(4,'little')
            raw=bytes(raw)
        return raw
    def test_frontend_zip_header_policy_preserves_direct_and_pages_positives(self):
        for cut,compression in ((None,zipfile.ZIP_STORED),('mode-zero',zipfile.ZIP_STORED),('empty-directory',zipfile.ZIP_DEFLATED)):
            raw=self.frontend_zip_profile(cut,compression=compression);observed=c.frontend_files(raw)
            self.assertEqual(observed[:2],r.read_frontend(raw));self.assertEqual(set(observed[2]),{'index.html','brickwright-build.json'})
            if cut=='empty-directory':
                with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                    info=archive.getinfo('assets/');self.assertEqual(info.file_size,0);self.assertGreater(info.compress_size,0)
        out=io.BytesIO()
        with tarfile.open(fileobj=out,mode='w') as archive:
            for name,raw in {'index.html':b'index','brickwright-build.json':b'{}'}.items():
                info=tarfile.TarInfo(name);info.size=len(raw);archive.addfile(info,io.BytesIO(raw))
        raw=zip_({'artifact.tar':out.getvalue()});self.assertEqual(c.frontend_files(raw)[:2],r.read_frontend(raw))
    def test_frontend_v9_roster_subset_admits_only_reviewed_members(self):
        contents=pages_contents();contents['static/assets/yosys.core.big.wasm']=b'\0'*(r.FILE_CAP+1)
        raw=zip_({'artifact.tar':pages_tar(contents)})
        observed=c.frontend_files(raw,True);self.assertEqual(observed[:2],r.read_frontend(raw,True))
        self.assertEqual(len(observed[2]),r.ACTUAL_V9_FRONTEND_COUNT);self.assertNotIn('static/assets/unrelated.wasm',observed[2])
        self.assertNotIn('static/assets/yosys.core.big.wasm',observed[2]);self.assertIn('index.html',observed[2])
        self.assertEqual(r.ACTUAL_V9_FRONTEND_ROSTER,c.ACTUAL_V9_FRONTEND_ROSTER);self.assertEqual(r.ACTUAL_V9_FRONTEND_AGGREGATE_CAP,c.ACTUAL_V9_FRONTEND_AGGREGATE_CAP)
        with self.assertRaises(ValueError):c.frontend_files(raw)   # the full-build policy still refuses the oversize member
        first=roster_name(r.ACTUAL_V9_FRONTEND_ROSTER[1])
        self.assertEqual(r.ACTUAL_V9_FRONTEND_CHUNK_ROLES,c.ACTUAL_V9_FRONTEND_CHUNK_ROLES);self.assertEqual(r.ACTUAL_V9_NUMERIC_CHUNK,c.ACTUAL_V9_NUMERIC_CHUNK)
        self.assertNotIn('chunks/99.'+'d'*20+'.js',observed[2])
        for p in r.ACTUAL_V9_FRONTEND_ROSTER:self.assertIsNone(re.fullmatch(r.ACTUAL_V9_NUMERIC_CHUNK,roster_name(p)),p)
        for cut in ('missing','duplicate-match','oversize','aggregate','plain-zip','symlink'):
            f=pages_contents()
            if cut=='missing':f.pop(first)
            elif cut=='duplicate-match':f[first.replace('aaaa','bbbb',1)]=b'second'
            elif cut=='oversize':f[first]=b'\0'*(r.FILE_CAP+1)
            elif cut=='aggregate':
                for p in r.ACTUAL_V9_FRONTEND_ROSTER[1:4]:f[roster_name(p)]=b'\0'*(24<<20)
            if cut=='plain-zip':raw=zip_(f)
            elif cut=='symlink':
                out=io.BytesIO()
                with tarfile.open(fileobj=out,mode='w') as archive:
                    for name,body in f.items():
                        info=tarfile.TarInfo(name)
                        if name==first:info.type=tarfile.SYMTYPE;info.linkname='index.html';archive.addfile(info)
                        else:info.size=len(body);archive.addfile(info,io.BytesIO(body))
                raw=zip_({'artifact.tar':out.getvalue()})
            else:raw=zip_({'artifact.tar':pages_tar(f)})
            for gate in (c.frontend_files,r.read_frontend):
                with self.subTest(cut=cut,gate=gate.__name__),self.assertRaises(ValueError):gate(raw,True)
    def test_frontend_v9_chunk_roles_survive_renumbering_and_refuse_zero_or_two(self):
        # A renumbered build: every role chunk gets a new id (and some lose or gain
        # a content hash). Selection follows the role marker, not the id.
        base=pages_contents();renum={k:v for k,v in base.items() if not re.fullmatch(r.ACTUAL_V9_NUMERIC_CHUNK,k)}
        renum.update(role_chunks(start=7000,hashed=False))
        for contents in (base,renum):
            raw=zip_({'artifact.tar':pages_tar(contents)});observed=c.frontend_files(raw,True)
            self.assertEqual(observed[:2],r.read_frontend(raw,True));self.assertEqual(len(observed[2]),r.ACTUAL_V9_FRONTEND_COUNT)
            selected=sorted(k for k in observed[2] if re.fullmatch(r.ACTUAL_V9_NUMERIC_CHUNK,k))
            self.assertEqual(selected,sorted(k for k,v in contents.items() if re.fullmatch(r.ACTUAL_V9_NUMERIC_CHUNK,k) and k!='chunks/99.'+'d'*20+'.js'))
        role,marker=r.ACTUAL_V9_FRONTEND_CHUNK_ROLES[0];target=('"'+marker+'"').encode()
        name=[k for k,v in base.items() if target in v][0]
        second=('"'+r.ACTUAL_V9_FRONTEND_CHUNK_ROLES[1][1]+'"').encode()
        for cut in ('zero','two','zero-and-two','both-roles','marker-unquoted'):
            f=dict(base)
            if cut=='zero':f.pop(name)
            elif cut=='zero-and-two':   # same member COUNT, wrong roles: only the per-role tally sees it
                f.pop(name);f['chunks/8889.'+'e'*20+'.js']=b'var t='+second+b';'
            elif cut=='two':f['chunks/8888.'+'e'*20+'.js']=b'var t='+target+b';'
            elif cut=='both-roles':f[name]=f[name]+b'var u="'+r.ACTUAL_V9_FRONTEND_CHUNK_ROLES[1][1].encode()+b'";'
            else:f[name]=marker.encode()
            raw=zip_({'artifact.tar':pages_tar(f)})
            for gate in (c.frontend_files,r.read_frontend):
                with self.subTest(cut=cut,gate=gate.__name__),self.assertRaises(ValueError):gate(raw,True)
    def test_frontend_zip_all_headers_refuse_before_any_inflate(self):
        for cut in ('nul-name','fifo','late-fifo','socket','block','directory-file','file-directory','symlink-directory','directory-payload',
          'double-slash-directory','duplicate-directory','duplicate-file','path','encrypted','compression','extent'):
            raw=self.frontend_zip_profile(cut)
            for gate in (c.frontend_files,r.read_frontend):
                with patch.object(zipfile.ZipFile,'read',side_effect=AssertionError('no inflation before complete header census')) as inflated:
                    with self.assertRaises(ValueError,msg=(cut,gate.__name__)):gate(raw)
                    inflated.assert_not_called()
    def test_frontend_zip_rehashed_actual_v4_packet_refuses_hidden_names_and_types(self):
        for cut in ('nul-name','fifo','directory-payload'):
            files,expected=fixture_v4()
            frontend=self.frontend_zip_profile(cut);files['frontend.original.zip']=frontend
            request=D(files['request.original.json']);request['build'].update(metadataBytes=len(frontend),zipBytes=len(frontend),sha256=H(frontend));refresh_v4_request(files,expected,request)
            artifact=D(files['build-artifact.original.json']);artifact.update(size_in_bytes=len(frontend),digest='sha256:'+H(frontend));files['build-artifact.original.json']=E(artifact)
            process=D(files['frontend-acquisition.process.json']);process['streams']['stdout']=ROW(frontend);files['frontend-acquisition.process.json']=E(process)
            with self.assertRaisesRegex(ValueError,'frontend ZIP',msg=cut):r.audit(*sealed(files,expected))
    def original_zip_profile(self,files,prefixed=False,cut=None):
        contents={name:raw for name,raw in files.items() if name!='inventory.json'}
        contents['inventory.json']=E({'schema':'bw.gui-hdd.originals.v1','files':{name:ROW(raw) for name,raw in contents.items()}})
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as archive:
            for name,raw in sorted(contents.items()):
                header=('originals/' if prefixed else '')+name+('XXhidden' if name=='result.json' and cut=='nul-name' else '')
                info=zipfile.ZipInfo(header);info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
                info.external_attr=((stat.S_IFIFO if name=='result.json' and cut=='fifo' else stat.S_IFREG)|0o644)<<16
                if cut=='mode-zero':info.external_attr=0o600<<16
                archive.writestr(info,raw)
            if prefixed:
                archive.writestr('controller.stdout',b'');archive.writestr('controller.stderr',b'')
            if cut not in (None,'fifo','nul-name','mode-zero'):
                directory=cut in ('empty-directory','directory-payload','symlink-directory','file-directory','duplicate-directory')
                name='late/' if directory else '../result.json' if cut=='path' else 'result.json' if cut=='duplicate-file' else 'unexpected' if cut=='unknown-role' else 'controller.stdout'
                info=zipfile.ZipInfo(name);info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
                kind={'late-fifo':stat.S_IFIFO,'socket':stat.S_IFSOCK,'file-directory':stat.S_IFREG,'symlink-directory':stat.S_IFLNK}.get(cut,stat.S_IFDIR if directory else stat.S_IFREG)
                info.external_attr=(kind|0o644)<<16
                import warnings
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore',UserWarning);archive.writestr(info,b'payload' if cut=='directory-payload' or not directory else b'')
                    if cut=='duplicate-directory':archive.writestr(info,b'')
        raw=out.getvalue()
        if cut=='nul-name':raw=raw.replace(b'result.jsonXXhidden',b'result.json\x00Xhidden')
        if cut in ('encrypted','compression','extent'):
            raw=bytearray(raw)
            for marker,flag,method,size in ((b'PK\x03\x04',6,8,22),(b'PK\x01\x02',8,10,24)):
                start=raw.rfind(marker);self.assertGreaterEqual(start,0)
                if cut=='encrypted':raw[start+flag:start+flag+2]=(1).to_bytes(2,'little')
                elif cut=='compression':raw[start+method:start+method+2]=(99).to_bytes(2,'little')
                else:raw[start+size:start+size+4]=(r.FILE_CAP+1).to_bytes(4,'little')
            raw=bytes(raw)
        return raw
    def original_zip_expectation(self,raw,expected):
        expected=copy.deepcopy(expected);expected.update(artifactBytes=len(raw),artifactSha256=H(raw))
        expected['artifact'].update(size_in_bytes=len(raw),digest='sha256:'+H(raw));return expected
    def test_actual_original_zip_preserves_prefixed_unprefixed_v3_v4_packets(self):
        for version,factory in ((3,fixture),(4,fixture_v4)):
            files,expected=factory()
            for prefixed in (False,True):
                raw=self.original_zip_profile(files,prefixed,cut='empty-directory');parsed=r.archive_originals(raw)
                verdict=r.audit(parsed,self.original_zip_expectation(raw,expected));self.assertTrue(verdict['pass']);self.assertEqual(verdict['schema'],'bw.gui-hdd.reader.v'+str(version))
            raw=self.original_zip_profile(files,cut='mode-zero');self.assertTrue(r.audit(r.archive_originals(raw),self.original_zip_expectation(raw,expected))['pass'])
    def test_actual_original_zip_rehashed_header_failures_never_inflate(self):
        files,expected=fixture_v4()
        for cut in ('fifo','nul-name','directory-payload','late-fifo','socket','file-directory','symlink-directory','duplicate-directory',
          'duplicate-file','path','unknown-role','encrypted','compression','extent'):
            raw=self.original_zip_profile(files,cut=cut);selected=self.original_zip_expectation(raw,expected)
            with patch.object(zipfile.ZipFile,'read',side_effect=AssertionError('outer header census before any inflation')) as inflated:
                with self.assertRaises(ValueError,msg=cut):r.audit(r.archive_originals(raw),selected)
                inflated.assert_not_called()
    def test_closed_request_schemas_numeric_alias(self):
        request=D(self.files['request.original.json'])
        for field,value in (('attempt',True),('attempt',1.0),('runId',True)):
            changed=copy.deepcopy(request);changed['build'][field]=value;raw=E(changed)
            for module in (r,c):
                with self.assertRaises(ValueError):module.parse_request(raw,H(raw))
    def test_actual_guard_before_any_edge(self):
        for args in (['guard'],['actual','--request','missing','--expected-sha256','0'*64,'--output','missing'],['preflight']):
            with patch.object(c,'regular',side_effect=AssertionError('read edge')),patch.object(c,'Hosted',side_effect=AssertionError('child edge')):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        with patch.object(c,'INVENTORY_ENABLED',False):
            for args in (['inventory-guard'],['inventory']):
                with patch.object(c,'regular',side_effect=AssertionError('read edge')),patch.object(c,'Hosted',side_effect=AssertionError('child edge')):
                    with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
    def test_enabled_inventory_guard_has_no_edges_or_actual_authority(self):
        self.assertIs(c.INVENTORY_ENABLED,True);self.assertIs(c.ACTUAL_ENABLED,False)
        with patch.object(c,'regular',side_effect=AssertionError('read edge')),patch.object(c,'Hosted',side_effect=AssertionError('child edge')),patch.object(c,'inventory_observation',side_effect=AssertionError('inventory edge')):
            self.assertEqual(c.main(['inventory-guard']),0)
            with self.assertRaisesRegex(ValueError,'fixed independent digest'):c.main(['inventory'])
            for mode in ('guard','preflight','actual'):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main([mode])
    def test_held_nofollow_bounded_read(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            path=pathlib.Path(temporary)/'original';path.write_bytes(b'ok');link=path.with_name('alias');link.symlink_to(path.name)
            for module,read in ((r,r.bounded_input),(c,c.regular)):
                self.assertEqual(read(path,2),b'ok')
                with self.assertRaises(ValueError):read(path,1)
                with self.assertRaises(ValueError):read(link,2)
    def test_startup_v3_explicit_policy_and_old_actual_schema_refusal(self):
        request=D(self.files['request.original.json'])
        for module in (c,r):
            self.assertEqual(module.startup_policy(),request['pythonStartup'])
            for version in ('v1','v2'):
                changed=copy.deepcopy(request);changed['schema']='bw.gui-hdd.actual-request.'+version;raw=E(changed)
                with self.assertRaises(ValueError):module.parse_request(raw,H(raw))
            changed=copy.deepcopy(request);changed['pythonStartup']['sourceImportClosureQualified']=True;raw=E(changed)
            with self.assertRaises(ValueError):module.parse_request(raw,H(raw))
    def test_rehashed_startup_observations_do_not_replace_fixed_expectation(self):
        mutations=(('options',r.PYTHON_OPTIONS[:2]+['-B']),('cachePrefix','/different'),('path',r.PYTHON_PATH+['/checkout']),
          ('flags',dict(D(self.files['python-startup.before.json'])['flags'],no_site=0)),('dontWriteBytecode',False),
          ('zipAbsent',False),('xoptions',{'pycache_prefix':'/different'}),('arguments',['invented','actual']))
        self.assertTrue(r.audit(*sealed(*self.fresh()))['pass'])
        for key,value in mutations:
            files,expected=self.fresh()
            for stage in ('before','after'):
                row=D(files['python-startup.'+stage+'.json']);row[key]=value;files['python-startup.'+stage+'.json']=E(row)
            with self.assertRaisesRegex(ValueError,'startup'):r.audit(*sealed(files,expected))
    def test_rehashed_nonempty_replaced_prefix_and_original_stat_refuse(self):
        for key,value in (('empty',False),('ino',999),('mode',stat.S_IFDIR|0o755),('mtimeNs',1800000000000000000)):
            files,expected=self.fresh()
            for stage in ('before','after'):
                row=D(files['python-startup.'+stage+'.json']);row['prefix'][key]=value;files['python-startup.'+stage+'.json']=E(row)
            with self.assertRaises(ValueError):r.audit(*sealed(files,expected))
        for raw in (self.files['python-startup.original.txt'].replace(b'created-exclusive',b'adopted-existing'),
          self.files['python-startup.original.txt'].replace(b'4 123',b'04 123'),b'x'*4097):
            for module in (c,r):
                with self.assertRaises(ValueError):module.startup_installation(raw)
    def test_official_startup_steps_are_external_ordered_successful_joins(self):
        for action in ('missing','order','failed','duplicate'):
            files,expected=self.fresh();steps=expected['job']['steps']
            if action=='missing':steps.pop(0)
            elif action=='order':steps.reverse()
            elif action=='failed':steps[0]['conclusion']='failure'
            else:steps.append(copy.deepcopy(steps[0]))
            with self.assertRaisesRegex(ValueError,'startup'):r.audit(*sealed(files,expected))
    def test_startup_capture_executes_real_validator_with_mocked_host_edges(self):
        row=D(self.files['python-startup.before.json']);arguments=row['arguments'][2:]
        class Flags:
            isolated=1;no_site=1;no_user_site=1;dont_write_bytecode=1;ignore_environment=1;safe_path=True;optimize=0
        with patch.object(c,'regular',return_value=self.files['python-startup.original.txt']),patch.object(c,'empty_python_prefix',return_value=row['prefix']),patch.object(c.sys,'orig_argv',row['options']+row['arguments']),patch.object(c.sys,'executable',c.PYTHON_EXECUTABLE),patch.object(c.sys,'flags',Flags()),patch.object(c.sys,'dont_write_bytecode',True),patch.object(c.sys,'path',c.PYTHON_PATH),patch.object(c.sys,'pycache_prefix',c.PYTHON_CACHE),patch.object(c.sys,'_xoptions',{'pycache_prefix':c.PYTHON_CACHE}),patch.object(c.Path,'resolve',return_value=pathlib.Path(c.PYTHON_EXECUTABLE)),patch.object(c.os.path,'lexists',return_value=False):
            self.assertEqual(c.observe_python_startup('/checkout','actual',arguments)[1],row)
            with patch.object(c.sys,'dont_write_bytecode',False):
                with self.assertRaises(ValueError):c.observe_python_startup('/checkout','actual',arguments)
    def test_empty_prefix_real_helper_held_checks_and_close_first_failure(self):
        class Info:
            st_dev=4;st_ino=123;st_mode=stat.S_IFDIR|0o555;st_uid=1001;st_gid=1001;st_nlink=2;st_size=4096;st_mtime_ns=1700000000000000000
            st_ctime_ns=1700000000000000000
        class Entries:
            def __init__(self,items):self.items=iter(items)
            def __enter__(self):return self.items
            def __exit__(self,*args):pass
        with patch.object(c.Path,'resolve',return_value=pathlib.Path(c.PYTHON_CACHE)),patch.object(c.os,'lstat',return_value=Info()),patch.object(c.os,'open',return_value=77) as opened,patch.object(c.os,'fstat',return_value=Info()),patch.object(c.os,'scandir',return_value=Entries([])),patch.object(c.os,'close') as closed:
            self.assertTrue(c.empty_python_prefix()['empty']);self.assertEqual(opened.call_args.args[1],c.os.O_RDONLY|c.os.O_NOFOLLOW|c.os.O_NONBLOCK|c.os.O_DIRECTORY);closed.assert_called_once_with(77)
            with patch.object(c.Path,'resolve',return_value=pathlib.Path('/different')):
                with self.assertRaisesRegex(ValueError,'canonical'):c.empty_python_prefix()
            changed=Info();changed.st_ino=999
            with patch.object(c.os,'lstat',side_effect=[Info(),changed]),patch.object(c.os,'scandir',return_value=Entries([])):
                with self.assertRaisesRegex(ValueError,'readback'):c.empty_python_prefix()
            with patch.object(c.os,'scandir',return_value=Entries(['unexpected'])),patch.object(c.os,'close',side_effect=OSError('close-secondary')):
                with self.assertRaisesRegex(ValueError,'remain empty'):c.empty_python_prefix()
            with patch.object(c.os,'scandir',return_value=Entries([])),patch.object(c.os,'close',side_effect=OSError('close-only')):
                with self.assertRaisesRegex(OSError,'close-only'):c.empty_python_prefix()
    def test_actual_shell_startup_is_before_first_python_and_inventory_is_held(self):
        workflow=(root/'.github/workflows/i80386-hdd-gui-actual.yml').read_text()
        v7=workflow.split('  actual-v7:',1)[1].split('  actual-v8:',1)[0]
        v8=workflow.split('  actual-v8:',1)[1].split('  actual-v9:',1)[0].split('  font-bridge:',1)[0]
        self.assertIn('if: >-\n      '+chr(36)+'{{ false &&',v7)
        self.assertIn('if: >-\n      '+chr(36)+'{{ false &&',v8)
        for version,actual in (('v7',v7),('v8',v8)):
            self.assertLess(actual.index('mkdir -m 0555 "$prefix"'),actual.index('/usr/bin/python3.12 -I -S -B -X'))
            self.assertNotIn('/usr/bin/python3 -B',actual)
            self.assertEqual(actual.count('/usr/bin/python3.12 -I -S -B -X pycache_prefix='+r.PYTHON_CACHE),4 if version=='v8' else 3)
            self.assertIn('test "$(realpath -e "$parent")" = "$parent"',actual)
            self.assertNotIn('rm ',actual)
    @contextlib.contextmanager
    def inventory_edges(self,files=None,aliases=None,directories=None,faults=None,clock=None,event_transform=None,typed=False,finite=False,finite_version=4):
        faults=faults or {};events=[];request=D(self.files['request.original.json']);original_sha=c.sha
        class NodeBytes(bytes):
            def __len__(self):return 124827920
        node=NodeBytes(b'node');default=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh']
        template={'schema':'bw.gui-hdd.inventory-template.v2','sourceHead':'a'*40,'files':default if files is None else files,
          'aliases':aliases or [],'directoryAliases':directories or [],'node':'/node','python':'/usr/bin/python3.12','chromium':'/chrome',
          'tools':{'git':'/usr/bin/git','gh':'/usr/bin/gh'}}
        if typed:template.update(schema='bw.gui-hdd.inventory-template.v3',emptyPythonSources=self.empty_selection())
        if finite:
            template.update(schema='bw.gui-hdd.inventory-template.v'+str(finite_version),emptyPythonSources=self.empty_selection(),files=sorted(template['files']),libraries=['/usr/lib/libselected.so'],scope=finite_scope_fixture(finite_version))
            request['installedFiles']['node_modules/bw-circuit-ui/package.json']=ROW(b'cui')
        if finite and finite_version in (7,8,9,10):
            template['dependencyPins']=copy.deepcopy(c.FINITE_V7_PINS)
            request['source']['files']['vendor-pins.json']=ROW(E(c.FINITE_V7_PINS))
        if finite and finite_version in (8,9,10):template['bootstrapSource']=copy.deepcopy(c.BOOTSTRAP_SOURCE)
        if finite and finite_version==9:
            template['files']=sorted(set(template['files'])|{'/etc/resolv.conf'})
            template['dependencyPins']=copy.deepcopy(c.FINITE_V9_PINS)
            request['source']['files']['vendor-pins.json']=ROW(E(c.FINITE_V9_PINS))
        if finite and finite_version==10:
            template['files']=sorted(set(template['files'])|{'/run/systemd/resolve/stub-resolv.conf'})
            template.update(dependencyPins=copy.deepcopy(c.FINITE_V10_PINS),resolverRole={'path':'/etc/resolv.conf',
              'allowedKinds':['regular','symlink'],'symlinkAlternatives':[{'linkText':'../run/systemd/resolve/stub-resolv.conf','target':'/run/systemd/resolve/stub-resolv.conf'}]})
            request['source']['files']['vendor-pins.json']=ROW(E(c.FINITE_V10_PINS))
        raw=E(template);pin=H(raw);event=D(base64.b64decode(self.expected['inventoryOriginal']['base64']))['event']
        event=D(base64.b64decode(event['base64']));event['pull_request']['body']='<!-- BW_GUI_HDD_INVENTORY_SHA256='+pin+' -->'
        if finite:event['label']['name']='x86-hdd-gui-finite-inventory-v'+str(finite_version);event['pull_request']['body']=finite_body_fixture(raw,finite_version)
        event_raw=event_transform(event) if event_transform else E(event)
        env={'GITHUB_EVENT_PATH':'/event','GITHUB_RUN_ID':'90','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'inventory','GITHUB_REPOSITORY':c.REPOSITORY,
          'GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_WORKFLOW_REF':c.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@refs/pull/123/merge','GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','BW_EXPECTED_HEAD':'a'*40}
        if finite:env['GITHUB_JOB']='finite-inventory-'+('five' if finite_version==5 else 'six' if finite_version==6 else 'seven' if finite_version==7 else 'eight' if finite_version==8 else 'nine' if finite_version==9 else 'v'+str(finite_version))
        if finite and finite_version==6:
            env['BW_FINITE_INVENTORY_V6_SHA256']=pin
            env['BW_FINITE_INVENTORY_V6_TEMPLATE_B64']=base64.b64encode(raw).decode()
        if finite and finite_version in (7,8,9,10):
            env['BW_FINITE_INVENTORY_V7_SHA256']=pin
            env['BW_FINITE_INVENTORY_V7_TEMPLATE_B64']=base64.b64encode(raw).decode()
        if finite and finite_version==8:
            env['BW_FINITE_INVENTORY_V8_SHA256']=pin
            env['BW_FINITE_INVENTORY_V8_TEMPLATE_B64']=base64.b64encode(raw).decode()
        if finite and finite_version==9:
            env['BW_FINITE_INVENTORY_V9_SHA256']=pin
            env['BW_FINITE_INVENTORY_V9_TEMPLATE_B64']=base64.b64encode(raw).decode()
        if finite and finite_version==10:
            prelude={'schema':'bw.gui-hdd.actual-v9-prelude.v1','repository':c.REPOSITORY,'pullRequest':123,
              'source':request['source'],'template':ROW(raw),'build':{},'nativeFontAdmission':{},'nativeSourceGit':{},
              'dispatch':{'ref':'refs/heads/lane/manufactured-finite10','workflow':{'path':c.ACTUAL_V8_WORKFLOW,'sha256':request['source']['files'][c.ACTUAL_V8_WORKFLOW]['sha256']}},'resources':copy.deepcopy(c.ACTUAL_V9_RESOURCES)}
            v8files,_v8expected,_v8env=self.actual_v8_packet();v8request=D(v8files['request.original.json'])
            for key in ('build','nativeFontAdmission','nativeSourceGit'):prelude[key]=copy.deepcopy(v8request[key])
            prelude['build'].update(head=request['source']['head'],sourceFiles=request['source']['files'])
            prelude['build']['sourceAdmission'].update(checkoutTree=request['source']['tree'],sourceFiles=request['source']['files'])
            prelude_raw=E(prelude);ref=prelude['dispatch']['ref']
            env.update(GITHUB_JOB='actual-v9',GITHUB_EVENT_NAME='workflow_dispatch',GITHUB_WORKFLOW_SHA='a'*40,
              GITHUB_REF=ref,GITHUB_REF_TYPE='branch',GITHUB_REF_NAME=ref[len('refs/heads/'):],GITHUB_SHA='a'*40,
              GITHUB_WORKFLOW_REF=c.REPOSITORY+'/'+c.ACTUAL_V8_WORKFLOW+'@'+ref,
              BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64=base64.b64encode(prelude_raw).decode(),BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256=H(prelude_raw),
              BW_FINITE_INVENTORY_V10_TEMPLATE_B64=base64.b64encode(raw).decode(),BW_FINITE_INVENTORY_V10_SHA256=pin)
            event_raw=E({'ref':ref,'repository':{'full_name':c.REPOSITORY},'sender':{'login':'CrispStrobe'},
              'inputs':{'protocol':'actual-v9','pull_request':'123','source_head':'a'*40,'source_ref':ref,
                        'prelude_sha256':H(prelude_raw),'request_sha256':'','tag_name':''}})
        saved={}
        if finite:saved['/checkout/gui-finite-inventory-v'+str(finite_version)+'/guard-admission.json']=E(finite_guard_fixture(request['source'],raw,event_raw,env,finite_version))
        def regular(path,cap):
            path=str(path);events.append(('read',path))
            if ('read',path) in faults:raise faults['read',path]
            if path=='/event':return event_raw
            if path in saved:return saved[path]
            if path.endswith(('/gui-finite-inventory-v8/bootstrap.stdout','/gui-finite-inventory-v9/bootstrap.stdout','/gui-finite-inventory-v10/bootstrap.stdout')):return b'Prepared official Ubuntu archive: 0 source file(s) changed\n'
            if path.endswith(('/gui-finite-inventory-v8/bootstrap.stderr','/gui-finite-inventory-v9/bootstrap.stderr','/gui-finite-inventory-v10/bootstrap.stderr')):return b''
            if path=='/node':return node
            if path=='/checkout/vendor-pins.json' and finite and finite_version in (7,8,9,10):return E(c.FINITE_V10_PINS if finite_version==10 else c.FINITE_V9_PINS if finite_version==9 else c.FINITE_V7_PINS)
            if path.startswith('/checkout/'):return ('source:'+path.removeprefix('/checkout/')).encode()
            return path.encode()
        def lstat(path):
            path=str(path);events.append(('lstat',path))
            if ('lstat',path) in faults:raise faults['lstat',path]
            mode=stat.S_IFLNK|0o777 if path in template['aliases']+template['directoryAliases'] else stat.S_IFREG|0o444
            return SimpleNamespace(st_dev=1,st_ino=2,st_mode=mode,st_uid=0,st_gid=0,st_nlink=1,st_size=124827920 if path=='/node' else len(path.encode()),st_mtime_ns=1)
        def readlink(path):
            events.append(('readlink',path))
            if ('readlink',path) in faults:raise faults['readlink',path]
            return '/node'
        class Capture:
            def __init__(self,path):events.append(('capture',str(path)));self.root=path;self.files={}
        class Hosted:
            def __init__(self,where,capture,environment):events.append(('Hosted',None));self.capture=capture;self.attempts=set();self.deadline=1800
            def git(self,args):
                events.append(('git',args));role='git-'+str(len(self.attempts));self.attempts.add(role)
                if args[0]=='rev-parse':body=(request['source']['head' if args[1]=='HEAD' else 'tree']+'\n').encode()
                else:
                    name=args[2].split(':',1)[1]
                    body=E(c.FINITE_V10_PINS if finite_version==10 else c.FINITE_V9_PINS if finite_version==9 else c.FINITE_V7_PINS) if finite and finite_version in (7,8,9,10) and name=='vendor-pins.json' else ('source:'+name).encode()
                process={'argv':['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']+args,'exitCode':0};saved[str(self.capture.root/(role+'.process.json'))]=E(process)
                self.capture.files[role+'.stdout']=ROW(body);self.capture.files[role+'.stderr']=ROW(b'');return body
        def inventory(path):
            events.append(('installed',str(path)));prefix=str(path).removeprefix('/checkout/')+'/'
            return {name.removeprefix(prefix):row for name,row in request['installedFiles'].items() if name.startswith(prefix)}
        def runtime(value):events.append(('runtime',None));return {}
        with patch.object(c,'regular_empty',side_effect=regular),patch.object(c,'regular',side_effect=regular),patch.object(c.os,'lstat',side_effect=lstat),patch.object(c.os,'readlink',side_effect=readlink),patch.object(c,'sha',side_effect=lambda raw:'fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48' if raw is node else original_sha(raw)),patch.object(c,'observe_runtime',side_effect=runtime),patch.object(c,'Originals',Capture),patch.object(c,'Hosted',Hosted),patch.object(c,'inventory',side_effect=inventory),patch.object(c.time,'monotonic',side_effect=clock or (lambda:10)):
            yield raw,pin,env,events
    def test_failed_inventory_collects_all_required_files_and_aliases_without_tools(self):
        selected=['/missing-font','/denied-font','/good-font','/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh']
        faults={('lstat','/missing-font'):FileNotFoundError('FIRST_FONT'),('read','/denied-font'):PermissionError('SECOND_FONT'),('readlink','/bad-link'):OSError('THIRD_LINK')}
        with self.inventory_edges(selected,['/bad-link','/good-link'],faults=faults) as (raw,pin,env,events):
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/inventory.original.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-failure.v2');self.assertFalse(value['candidate']);self.assertFalse(value['qualified'])
        self.assertEqual(value['firstFailure']['message'],'FIRST_FONT');self.assertEqual([x['message'] for x in value['secondary']],['SECOND_FONT','THIRD_LINK'])
        self.assertEqual(set(value['files']),set(selected));self.assertEqual(value['files']['/good-font']['status'],'observed');self.assertIn('file',value['files']['/node'])
        self.assertEqual(value['aliases']['/good-link']['status'],'observed');self.assertFalse(value['gitSource']['reached']);self.assertIsNone(value['gitSource']['head'])
        self.assertTrue(value['template']['bindingVerified']);self.assertEqual(value['template']['sha256'],pin);self.assertTrue(value['event']['bindingVerified'])
        self.assertFalse(any(row[0] in ('runtime','Hosted','git','installed','capture') for row in events));self.assertLess(len(E(value)),c.JSON_CAP)
    def test_successful_inventory_keeps_exact_v2_shape_and_existing_source_gate(self):
        with self.inventory_edges() as (raw,pin,env,events):value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/inventory.original.json')
        self.assertEqual(set(value),set('schema observationOnly templateSha256 source installedFiles runtime event commands platform'.split()))
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v2');self.assertEqual(value['source'],D(self.files['source.before.json']))
        self.assertTrue(value['observationOnly']);self.assertEqual(value['templateSha256'],pin)
        self.assertLess(next(i for i,x in enumerate(events) if x[0]=='runtime'),next(i for i,x in enumerate(events) if x[0]=='Hosted'))
        self.assertEqual(len([x for x in events if x[0]=='git']),len(c.SOURCE)+2)
    def test_inventory_deadline_stops_later_reads_but_reports_entire_roster(self):
        ticks=iter([0,1,181,182,183,184])
        with self.inventory_edges(['/first','/second','/third'],['/late-link'],clock=lambda:next(ticks)) as (raw,pin,env,events):
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/inventory.original.json')
        self.assertIn('deadline',value['firstFailure']['message']);self.assertEqual(set(value['files']),{'/first','/second','/third'})
        self.assertEqual([path for operation,path in events if operation=='read' and path!='/event'],['/first'])
        self.assertFalse(value['files']['/second']['attempted']);self.assertEqual(value['files']['/second']['status'],'unvisited-deadline')
        self.assertFalse(value['files']['/third']['attempted']);self.assertEqual(value['files']['/third']['status'],'unvisited-deadline')
        self.assertTrue(value['files']['/first']['attempted']);self.assertEqual(value['files']['/first']['status'],'failed')
        self.assertFalse(value['aliases']['/late-link']['attempted']);self.assertEqual(value['aliases']['/late-link']['status'],'unvisited-deadline')
        self.assertFalse(any(operation=='runtime' for operation,path in events))
    def test_inventory_roster_caps_and_mismatched_template_stop_before_selected_reads(self):
        for files in (['/x']*2,['/x'+str(i) for i in range(513)]):
            with self.inventory_edges(files) as (raw,pin,env,events):value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
            self.assertIsNotNone(value['firstFailure']);self.assertFalse(value['files']);self.assertFalse(any(x[0]=='lstat' for x in events))
        with self.inventory_edges() as (raw,pin,env,events):value=c.inventory_observation(raw,'0'*64,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertFalse(value['template']['bindingVerified']);self.assertIsNone(value['event']);self.assertEqual(events,[])
    def test_maximal_failed_inventory_unicode_errors_remain_capped_and_canonical(self):
        files=['/selected/file-'+str(i) for i in range(512)];aliases=['/selected/alias-'+str(i) for i in range(256)]
        faults={('lstat',name):OSError('\U00010348'*5000) for name in files+aliases}
        with self.inventory_edges(files,aliases,faults=faults) as (raw,pin,env,events):value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(len(value['files']),512);self.assertEqual(len(value['aliases']),256);self.assertEqual(len(value['secondary']),767)
        self.assertLess(len(E(value)),c.JSON_CAP);self.assertEqual(E(D(E(value))),E(value));self.assertLessEqual(len(value['firstFailure']['message'].encode()),1024)
        self.assertFalse(any(row[0] in ('runtime','Hosted','git') for row in events))
    def test_failed_inventory_cli_saves_only_failure_original_and_returns_nonzero(self):
        with self.inventory_edges(['/missing'],faults={('lstat','/missing'):FileNotFoundError('FIRST')}) as (raw,pin,env,events):value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            output=pathlib.Path(temporary)/'inventory.original.json'
            with patch.object(c,'regular',return_value=raw),patch.object(c,'inventory_observation',return_value=value),patch.dict(c.os.environ,env,clear=True):
                self.assertEqual(c.main(['inventory','--request','/request','--expected-sha256',pin,'--output',str(output)]),1)
            self.assertFalse(output.exists());saved=output.with_name('inventory-failure.json');self.assertEqual(saved.read_bytes(),E(value))
            with patch.object(c.sys,'stderr',io.StringIO()) as stderr:self.assertEqual(c.retain_inventory_observation(value,output),1)
            self.assertEqual(value['firstFailure']['message'],'FIRST');self.assertEqual(D(stderr.getvalue().encode())['secondary'][-1]['phase'],'inventory-failure-retention')
    def test_inventory_failure_write_and_close_do_not_replace_first_refusal(self):
        for fault in ('write','close','both'):
            value={'schema':'bw.gui-hdd.inventory-failure.v2','candidate':False,'qualified':False,'firstFailure':{'phase':'inventory-file','name':'FileNotFoundError','message':'ORIGINAL_MISSING'},'secondary':[]}
            class Output:
                def __enter__(self):return self
                def write(self,raw):
                    if fault in ('write','both'):raise OSError('WRITE_FAILED')
                    return len(raw)
                def close(self):
                    if fault in ('close','both'):raise OSError('CLOSE_FAILED')
            with patch.object(c.Path,'open',return_value=Output()),patch.object(c.sys,'stderr',io.StringIO()) as stderr:
                self.assertEqual(c.retain_inventory_observation(value,'/out/success.json'),1)
            diagnostic=D(stderr.getvalue().encode());self.assertEqual(diagnostic['firstFailure']['message'],'ORIGINAL_MISSING')
            self.assertEqual([row['message'] for row in diagnostic['secondary']],['WRITE_FAILED','CLOSE_FAILED'] if fault=='both' else [fault.upper()+'_FAILED'])
    def test_inventory_success_retention_is_original_path_and_status_zero(self):
        with self.inventory_edges() as (raw,pin,env,events):value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            path=pathlib.Path(temporary)/'inventory.original.json';self.assertEqual(c.retain_inventory_observation(value,path),0)
            self.assertEqual(path.read_bytes(),E(value));self.assertFalse(path.with_name('inventory-failure.json').exists())
    def failure_event_fixture(self,event_transform=None):
        selected=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/missing-font']
        with self.inventory_edges(selected,faults={('lstat','/missing-font'):FileNotFoundError('FIRST_FONT')},event_transform=event_transform) as (raw,pin,env,events):
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v2','source':D(self.files['source.before.json']),
          'template':ROW(raw),'failure':ROW(E(value)),'runId':90,'workflowSha':'d'*40}
        return value,raw,expected
    def rehash_failure(self,value,expected):
        value['diagnostic']['pathBytes']=sum(len(E({path:row}))+len(E(row.get('error')))+32 for role in ('files','aliases','directoryAliases') for path,row in value[role].items())
        frame=copy.deepcopy(value);frame.update(files={},aliases={},directoryAliases={},firstFailure=None,secondary=[],gitSource={'reached':False,'head':None,'tree':None,'files':{}},diagnostic={'pathBytes':0,'limitBytes':0,'complete':False})
        value['diagnostic']['limitBytes']=c.JSON_CAP-len(E(frame))-8192;expected['failure']=ROW(E(value))
    def test_failure_v2_exact_event_bytes_standalone_reader_positive_and_cli(self):
        value,template,expected=self.failure_event_fixture(lambda event:(json.dumps(event,indent=2)+'  \n').encode())
        event_raw=base64.b64decode(value['event']['original']['base64']);self.assertTrue(event_raw.endswith(b'  \n'));self.assertNotEqual(event_raw,E(D(event_raw)))
        verdict=r.verify_inventory_failure(E(value),template,expected);self.assertTrue(verdict['eventJoined']);self.assertTrue(verdict['failureObserved'])
        self.assertFalse(verdict['candidate']);self.assertFalse(verdict['qualified']);self.assertFalse(verdict['gitSourceReached']);self.assertEqual(verdict['firstFailure']['message'],'FIRST_FONT')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,raw in (('failure',E(value)),('template',template),('expected',E(expected))):(folder/name).write_bytes(raw)
            with patch.object(r.sys,'stdout',io.StringIO()) as stdout:
                self.assertEqual(r.main(['--inventory-failure',str(folder/'failure'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]),0)
            self.assertEqual(D(stdout.getvalue().encode()),verdict)
    def test_failure_v2_rehashed_wrong_event_head_marker_and_platform_refuse(self):
        for cut in ('head','marker','workflow','run','ref'):
            value,template,expected=self.failure_event_fixture();event=D(base64.b64decode(value['event']['original']['base64']))
            if cut=='head':event['pull_request']['head']['sha']='f'*40
            elif cut=='marker':event['pull_request']['body']='<!-- BW_GUI_HDD_INVENTORY_SHA256='+'0'*64+' -->'
            elif cut=='workflow':value['platform']['GITHUB_WORKFLOW_SHA']='f'*40
            elif cut=='run':value['platform']['GITHUB_RUN_ID']='999'
            else:value['platform']['GITHUB_WORKFLOW_REF']='wrong-ref'
            raw=E(event);value['event'].update(ROW(raw));value['event']['original']['base64']=base64.b64encode(raw).decode()
            self.rehash_failure(value,expected)
            with self.assertRaises(ValueError):r.verify_inventory_failure(E(value),template,expected)
        value,template,expected=self.failure_event_fixture();expected['template']['sha256']='0'*64
        with self.assertRaises(ValueError):r.verify_inventory_failure(E(value),template,expected)
    def test_failure_v2_matches_actual_stat_domain_and_refuses_cross_role_facts(self):
        value,template,expected=self.failure_event_fixture()
        for name in ('metadataBefore','metadataAfter'):value['files']['/chrome'][name].update(nlink=2,mtime_ns=-1)
        self.rehash_failure(value,expected);self.assertTrue(r.verify_inventory_failure(E(value),template,expected)['eventJoined'])
        value['files']['/chrome']['linkText']='invented';self.rehash_failure(value,expected)
        with self.assertRaises(ValueError):r.verify_inventory_failure(E(value),template,expected)
        with self.inventory_edges(['/node','/missing'],['/node-alias'],faults={('lstat','/missing'):FileNotFoundError('FIRST')}) as (raw,pin,env,events):
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        expected['template']=ROW(raw);value['aliases']['/node-alias']['file']=ROW(b'invented');self.rehash_failure(value,expected)
        with self.assertRaises(ValueError):r.verify_inventory_failure(E(value),raw,expected)
    def test_failure_v2_partial_raw_event_and_old_version_never_claim_join(self):
        for cut in ('partial','extent','hash','unavailable','v1'):
            value,template,expected=self.failure_event_fixture()
            if cut=='partial':value['event']['original']['base64']=value['event']['original']['base64'][:-4]
            elif cut=='extent':value['event']['byteLength']-=1
            elif cut=='hash':value['event']['sha256']='0'*64
            elif cut=='unavailable':value['event']['original'].update(available=False,base64=None,reason='not retained')
            else:value['schema']='bw.gui-hdd.inventory-failure.v1'
            expected['failure']=ROW(E(value))
            with self.assertRaises((ValueError,TypeError)):r.verify_inventory_failure(E(value),template,expected)
    def test_failure_v2_oversize_unavailable_event_preserves_first_refusal(self):
        def oversized(event):
            event['padding']='x'*(c.INVENTORY_FAILURE_EVENT_CAP+1);return E(event)
        value,template,expected=self.failure_event_fixture(oversized)
        self.assertEqual(value['firstFailure']['message'],'FIRST_FONT');self.assertEqual(value['secondary'][-1]['phase'],'inventory-event-original')
        self.assertFalse(value['event']['original']['available']);self.assertIsNone(value['event']['original']['base64']);self.assertLess(len(E(value)),c.JSON_CAP)
        with self.assertRaises(ValueError):r.verify_inventory_failure(E(value),template,expected)
        with self.inventory_edges(faults={('read','/event'):PermissionError('EVENT_UNREADABLE')}) as (raw,pin,env,events):
            missing=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(missing['firstFailure']['message'],'EVENT_UNREADABLE');self.assertIsNone(missing['event']);self.assertEqual(missing['secondary'][-1]['phase'],'inventory-event-original')
        self.assertFalse(any(operation in ('lstat','runtime','Hosted') for operation,path in events))
    def test_failure_v2_event_frame_reservation_caps_path_output_honestly(self):
        files=['/selected/'+'x'*480+str(i) for i in range(512)];aliases=['/selected/'+'y'*480+str(i) for i in range(256)]
        faults={('lstat',name):OSError('\\'*5000) for name in files+aliases}
        with self.inventory_edges(files,aliases,faults=faults) as (raw,pin,env,events):value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertFalse(value['diagnostic']['complete']);self.assertLessEqual(len(E(value)),c.JSON_CAP)
        self.assertEqual(value['firstFailure']['path'],files[0]);self.assertIn('path diagnostic cap',value['secondary'][-1]['message'])
        self.assertTrue(value['event']['original']['available']);self.assertFalse(any(operation in ('runtime','Hosted','git') for operation,path in events))
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v2','source':D(self.files['source.before.json']),'template':ROW(raw),'failure':ROW(E(value)),'runId':90,'workflowSha':'d'*40}
        with self.assertRaisesRegex(ValueError,'complete bounded'):r.verify_inventory_failure(E(value),raw,expected)
    def test_failure_v2_rehashed_incomplete_roster_and_forged_budget_refuse(self):
        for cut in ('incomplete','missing','budget','accounting'):
            value,template,expected=self.failure_event_fixture()
            if cut=='incomplete':value['diagnostic']['complete']=False
            elif cut=='missing':value['files'].pop('/missing-font')
            elif cut=='budget':value['diagnostic']['limitBytes']+=1
            else:value['diagnostic']['pathBytes']+=1
            expected['failure']=ROW(E(value))
            with self.assertRaises(ValueError):r.verify_inventory_failure(E(value),template,expected)
    def empty_selection(self):
        return {c.EMPTY_PYTHON_PATH:{'role':'python-empty-package-source','byteLength':0,'sha256':H(b''),'uid':0,'gid':0,'mode':0o644}}
    @contextlib.contextmanager
    def empty_source_edges(self,cut=None,close_error=False):
        events=[];base={'dev':1,'ino':2,'mode':stat.S_IFREG|0o644,'uid':0,'gid':0,'nlink':1,'size':0,'mtime_ns':-1};named_count=0;held_count=0
        if cut in ('mode','uid','gid','nlink','size'):
            base[cut]={'mode':stat.S_IFLNK|0o777,'uid':1,'gid':1,'nlink':2,'size':1}[cut]
        def info():return SimpleNamespace(**{'st_'+key:value for key,value in base.items()})
        def named(path):
            nonlocal named_count
            events.append(('named',str(path)));named_count+=1
            if cut=='named-first-error' or cut=='named-error' and named_count==2:raise OSError('NAMED_READBACK')
            value=info()
            if cut=='named-drift' and named_count==2:value.st_ino+=1
            return value
        def held(fd):
            nonlocal held_count
            events.append(('held',fd));held_count+=1
            if cut=='held-error':raise OSError('HELD_FAILED')
            value=info()
            if cut=='held-before-drift' or cut=='held-after-drift' and held_count==2:value.st_ino+=1
            if cut and cut.startswith('drift-') and held_count==2:setattr(value,'st_'+cut[6:],getattr(value,'st_'+cut[6:])+1)
            return value
        def open_(path,flags):
            events.append(('open',flags))
            if cut=='open-error':raise OSError('OPEN_FAILED')
            return 41
        def read_(fd,cap):
            events.append(('read',cap))
            if cut=='read-error':raise OSError('READ_FAILED')
            return b'X' if cut=='nonempty' else b''
        def close_(fd):
            events.append(('close',fd))
            if cut=='close-error' or close_error:raise OSError('CLOSE_FAILED')
        with patch.object(c.Path,'lstat',named),patch.object(c.Path,'resolve',return_value=pathlib.Path(c.EMPTY_PYTHON_PATH)),patch.object(c.os,'open',side_effect=open_),patch.object(c.os,'fstat',side_effect=held),patch.object(c.os,'read',side_effect=read_),patch.object(c.os,'close',side_effect=close_):
            yield events
    def selected_empty_source_fixture(self):
        # Exercise the real typed reader against its existing manufactured
        # kernel edges, independently of the host's Python installation.
        observed={};selection=self.empty_selection()[c.EMPTY_PYTHON_PATH]
        with self.empty_source_edges():c.read_empty_python_source(c.EMPTY_PYTHON_PATH,selection,observed)
        def selected(path,admitted,target):
            if type(path) is not str or path!=c.EMPTY_PYTHON_PATH or E(admitted)!=E(selection):
                raise ValueError('fixture selected empty Python source identity')
            target.update(copy.deepcopy(observed))
        return selected
    def typed_inventory_fixture(self,failed=False,cut=None,close_error=False):
        faults={('lstat','/missing-font'):FileNotFoundError('FIRST_FONT')} if failed else {}
        files=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh']+(['/missing-font'] if failed else [])
        with self.inventory_edges(files,faults=faults,typed=True) as (raw,pin,env,events),self.empty_source_edges(cut,close_error) as typed_events:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v3' if value['schema'].startswith('bw.gui-hdd.inventory-failure.') else 'bw.gui-hdd.inventory-admission.v3',
          'source':D(self.files['source.before.json']),'template':ROW(raw),'runId':90,'workflowSha':'d'*40}
        expected['failure' if 'failure' in expected['schema'] else 'original']=ROW(E(value))
        return value,raw,expected,events,typed_events
    def rehash_typed_inventory(self,value,template,expected):
        raw=E(template);expected['template']=ROW(raw)
        if 'templateSha256' in value:value['templateSha256']=H(raw)
        else:value['template'].update(ROW(raw),expectedSha256=H(raw))
        event=value['event'];original=event.get('original',event);event_raw=D(base64.b64decode(original['base64']))
        event_raw['pull_request']['body']='<!-- BW_GUI_HDD_INVENTORY_SHA256='+H(raw)+' -->';event_raw=E(event_raw)
        event.update(ROW(event_raw));original['base64']=base64.b64encode(event_raw).decode()
        if 'diagnostic' in value:
            roles=('files','emptyPythonSources','aliases','directoryAliases')
            value['diagnostic']['pathBytes']=sum(len(E({path:row}))+len(E(row.get('error')))+32 for role in roles for path,row in value[role].items())
            frame=copy.deepcopy(value);frame.update(files={},emptyPythonSources={},aliases={},directoryAliases={},firstFailure=None,secondary=[],gitSource={'reached':False,'head':None,'tree':None,'files':{}},diagnostic={'pathBytes':0,'limitBytes':0,'complete':False})
            value['diagnostic']['limitBytes']=c.JSON_CAP-len(E(frame))-8192
        expected['failure' if 'failure' in expected['schema'] else 'original']=ROW(E(value));return raw
    def test_typed_empty_source_held_eof_readback_close_positive(self):
        observed={}
        with self.empty_source_edges() as events:c.read_empty_python_source(c.EMPTY_PYTHON_PATH,self.empty_selection()[c.EMPTY_PYTHON_PATH],observed)
        self.assertEqual(events,[('named',c.EMPTY_PYTHON_PATH),('open',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK),('held',41),('read',1),('held',41),('named',c.EMPTY_PYTHON_PATH),('close',41)])
        self.assertEqual(observed['read'],{'byteLength':0,'sha256':H(b''),'eof':True});r.verify_empty_python_source(observed)
    def test_typed_source_rejects_wrong_selection_before_any_read(self):
        for cut in ('path','role','hash','bool','float','negative','nonempty','owner','mode','extra'):
            selected=self.empty_selection();row=selected[c.EMPTY_PYTHON_PATH]
            if cut=='path':selected['/usr/lib/python3.12/fake/__init__.py']=selected.pop(c.EMPTY_PYTHON_PATH)
            elif cut=='role':row['role']='executable'
            elif cut=='hash':row['sha256']='0'*64
            elif cut in ('bool','float','negative'):row['byteLength']={'bool':False,'float':0.0,'negative':-1}[cut]
            elif cut=='nonempty':row.update(byteLength=1,sha256=H(b'X'))
            elif cut=='owner':row['uid']=1
            elif cut=='mode':row['mode']=0o444
            else:row['extra']=True
            with patch.object(c.os,'open') as opened,self.assertRaises(ValueError):c.empty_python_policy(selected,[],[],[])
            opened.assert_not_called()
        for role in ('files','aliases','directories'):
            args=[[],[],[]];args[('files','aliases','directories').index(role)]=[c.EMPTY_PYTHON_PATH]
            with self.assertRaises(ValueError):c.empty_python_policy(self.empty_selection(),*args)
        with self.assertRaises(ValueError):c.empty_python_policy(self.empty_selection(),['/p'+str(i) for i in range(512)],[],[])
    def test_typed_exception_does_not_relax_generic_positive_file_policy(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            path=pathlib.Path(temporary)/'library.so';path.write_bytes(b'')
            with self.assertRaises(ValueError):c.regular(path,1)
            with self.assertRaises(ValueError):c.check_file(path,{'byteLength':0,'sha256':H(b'')})
            path.write_bytes(b'X');self.assertEqual(c.check_file(path,ROW(b'X')),b'X')
        for path in ('/etc/fonts/font.conf','/usr/bin/python3.12','/usr/lib/python3.12/urllib/__pycache__/__init__.cpython-312.pyc'):
            selected={path:self.empty_selection()[c.EMPTY_PYTHON_PATH]}
            for module in (c,r):
                with self.assertRaises(ValueError):module.empty_python_policy(selected,[],[],[])
        request=D(self.files['request.original.json'])
        for path in (request['runtime']['node'],request['runtime']['chromium']):
            changed=copy.deepcopy(request);changed['runtime']['files'][path]={'byteLength':0,'sha256':H(b'')};raw=E(changed)
            for module in (c,r):
                with self.assertRaises(ValueError):module.parse_request(raw,H(raw))
    def test_typed_source_os_failures_identity_drift_and_secondary_close(self):
        for cut in ('mode','uid','gid','nlink','size','named-first-error','open-error','held-error','held-before-drift','held-after-drift','named-drift','named-error','nonempty','read-error','close-error')+tuple('drift-'+key for key in ('dev','ino','mode','uid','gid','nlink','size','mtime_ns')):
            observed={}
            with self.empty_source_edges(cut) as events,self.assertRaises((ValueError,OSError)):c.read_empty_python_source(c.EMPTY_PYTHON_PATH,self.empty_selection()[c.EMPTY_PYTHON_PATH],observed)
            self.assertEqual(sum(operation=='close' for operation,arg in events),0 if cut in ('mode','uid','gid','nlink','size','named-first-error','open-error') else 1)
        with self.empty_source_edges('read-error',True),self.assertRaisesRegex(OSError,'READ_FAILED') as error:
            c.read_empty_python_source(c.EMPTY_PYTHON_PATH,self.empty_selection()[c.EMPTY_PYTHON_PATH],{})
        self.assertEqual([str(item) for item in error.exception.inventory_secondary],['CLOSE_FAILED'])
    def test_typed_metadata_v3_complete_producer_reader_and_cli(self):
        value,template,expected,events,typed_events=self.typed_inventory_fixture()
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v3');self.assertNotIn(c.EMPTY_PYTHON_PATH,value['runtime']['files'])
        verdict=r.verify_inventory_original(E(value),template,expected);self.assertFalse(verdict['actualRequestSupported']);self.assertFalse(verdict['qualified'])
        self.assertTrue(any(operation=='git' for operation,arg in events))
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,raw in (('original',E(value)),('template',template),('expected',E(expected))):(folder/name).write_bytes(raw)
            with patch.object(r.sys,'stdout',io.StringIO()) as stdout:self.assertEqual(r.main(['--inventory-original',str(folder/'original'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]),0)
            self.assertEqual(D(stdout.getvalue().encode()),verdict)
    def test_typed_failure_v3_keeps_font_primary_and_close_secondary(self):
        value,template,expected,events,typed_events=self.typed_inventory_fixture(True,'read-error',True)
        self.assertEqual(value['firstFailure']['message'],'FIRST_FONT');self.assertEqual([error['message'] for error in value['secondary']],['READ_FAILED','CLOSE_FAILED'])
        self.assertFalse(any(operation in ('runtime','Hosted','git') for operation,arg in events))
        verdict=r.verify_inventory_failure(E(value),template,expected);self.assertFalse(verdict['qualified']);self.assertEqual(verdict['counts']['emptyPythonSources'],{'failed':1})
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            target=pathlib.Path(temporary)/'inventory.original.json';self.assertEqual(c.retain_inventory_observation(value,target),1)
            self.assertFalse(target.exists());self.assertEqual(D(target.with_name('inventory-failure.json').read_bytes()),value)
    def test_typed_failure_close_secondary_before_alias_refusal_is_retained(self):
        faults={('lstat','/missing-font'):FileNotFoundError('FONT_FIRST'),('readlink','/bad-link'):OSError('ALIAS_LAST')}
        with self.inventory_edges(['/node','/missing-font'],['/bad-link'],faults=faults,typed=True) as (raw,pin,env,events),self.empty_source_edges('read-error',True):
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual([error['message'] for error in [value['firstFailure']]+value['secondary']],['FONT_FIRST','READ_FAILED','CLOSE_FAILED','ALIAS_LAST'])
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v3','source':D(self.files['source.before.json']),'template':ROW(raw),'failure':ROW(E(value)),'runId':90,'workflowSha':'d'*40}
        self.assertTrue(r.verify_inventory_failure(E(value),raw,expected)['failureObserved'])
        for close_snapshot in (False,True):
            value,raw,expected,events,typed_events=self.typed_inventory_fixture(True,'close-error' if close_snapshot else None)
            self.assertEqual(value['firstFailure']['message'],'FIRST_FONT')
            self.assertEqual(value['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['status'],'failed' if close_snapshot else 'observed')
            self.assertTrue(r.verify_inventory_failure(E(value),raw,expected)['failureObserved'])
    def test_typed_v3_rehashed_observation_adversaries_refuse_both_readers(self):
        for failed in (False,True):
            for cut in ('eof','hash','nonempty','identity','float','bool','mode','owner','links','close','missing','extra'):
                value,raw,expected,events,typed_events=self.typed_inventory_fixture(failed);template=D(raw);observed=value['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['source']
                if cut=='eof':observed['read']['eof']=False
                elif cut=='hash':observed['read']['sha256']='0'*64
                elif cut=='nonempty':observed['read'].update(byteLength=1,sha256=H(b'X'),eof=False)
                elif cut=='identity':observed['heldAfter']['ino']+=1
                elif cut=='float':observed['heldBefore']['uid']=0.0
                elif cut=='bool':observed['namedAfter']['gid']=False
                elif cut in ('mode','owner','links'):
                    key={'mode':'mode','owner':'uid','links':'nlink'}[cut]
                    for name in ('namedBefore','heldBefore','heldAfter','namedAfter'):observed[name][key]=1 if cut=='owner' else 0 if cut=='mode' else 2
                elif cut=='close':observed['close']['succeeded']=False
                elif cut=='missing':value['emptyPythonSources']={}
                else:observed['invented']=True
                raw=self.rehash_typed_inventory(value,template,expected)
                with self.assertRaises((ValueError,KeyError),msg=str((failed,cut))): (r.verify_inventory_failure if failed else r.verify_inventory_original)(E(value),raw,expected)
    def test_typed_v3_rehashed_selection_oldschema_and_positive_zero_refuse(self):
        for cut in ('role','path','hash','nonempty','duplicate','zero-executable','v2'):
            value,raw,expected,events,typed_events=self.typed_inventory_fixture();template=D(raw);row=template['emptyPythonSources'][c.EMPTY_PYTHON_PATH]
            if cut=='role':row['role']='library'
            elif cut=='path':template['emptyPythonSources']['/usr/bin/python3.12']=template['emptyPythonSources'].pop(c.EMPTY_PYTHON_PATH)
            elif cut=='hash':row['sha256']='0'*64
            elif cut=='nonempty':row.update(byteLength=1,sha256=H(b'X'))
            elif cut=='duplicate':template['files'].append(c.EMPTY_PYTHON_PATH)
            elif cut=='zero-executable':value['runtime']['files']['/chrome']={'byteLength':0,'sha256':H(b'')}
            else:template['schema']='bw.gui-hdd.inventory-template.v2';value['schema']='bw.gui-hdd.inventory-original.v2'
            raw=self.rehash_typed_inventory(value,template,expected)
            with self.assertRaises(ValueError):r.verify_inventory_original(E(value),raw,expected)
        request=D(self.files['request.original.json']);request['runtime']['emptyPythonSources']=self.empty_selection()
        with self.assertRaises(ValueError):c.parse_request(E(request),H(E(request)))
        with self.assertRaises(ValueError):r.parse_request(E(request),H(E(request)))
    def run_actual_v4(self,fault=None,after=False,retention=False,drift=False):
        files,expected=fixture_v4();request=D(files['request.original.json']);order=[]
        original_regular=c.regular;original_inventory=c.inventory;original_runtime=c.observe_runtime;original_empty=c.read_empty_python_source;original_save=c.Originals.save;original_sha=c.sha
        typed_events=[];runtime_count=0
        class NodeBytes(bytes):
            def __len__(self):return 124827920
        node=NodeBytes(b'node');runtime_bytes={'/node':node,'/usr/bin/python3.12':b'python','/usr/lib/libselected.so':b'selected-library','/chrome':b'chrome','/usr/bin/git':b'git','/usr/bin/gh':b'gh'}
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);(checkout/'gui-originals').mkdir()
            event=checkout/'event.json';event.write_bytes(files['event.original.json'])
            env={'GITHUB_EVENT_PATH':str(event),'GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request',
              'GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual',
              'BW_EXPECTED_HEAD':'a'*40,'GH_TOKEN':'manufactured-not-a-credential'}
            def regular(path,cap):
                if str(path)==str(checkout/'vendor-pins.json'):return E({'bw-board':c.BOARD,'bw-circuit-ui':c.HISTORICAL_CUI,'sb3-creator':c.SB3})
                return original_regular(path,cap)
            def check_file(path,row):
                name=str(path).removeprefix(str(checkout)+'/')
                if str(path) in runtime_bytes:return runtime_bytes[str(path)]
                if name in request['source']['files']:return ('source:'+name).encode()
                return b'externally mocked installed/input bytes'
            def inventory(path,*args):
                name=str(path).removeprefix(str(checkout)+'/')
                if name.startswith('node_modules/'):
                    return {k.removeprefix(name+'/'):v for k,v in request['installedFiles'].items() if k.startswith(name+'/')}
                return original_inventory(path,*args)
            def runtime(request):
                nonlocal runtime_count
                order.append('runtime');runtime_count+=1;active=(runtime_count==2)==after
                aliases=dict(request['runtime']['aliases'],**request['runtime']['directoryAliases'])
                def metadata(path):
                    path=str(path);mode=stat.S_IFLNK|0o777 if path in aliases else stat.S_IFREG|0o444 if path in runtime_bytes else stat.S_IFDIR|0o755
                    return SimpleNamespace(st_dev=4,st_ino=5,st_mode=mode,st_uid=0,st_gid=0,st_nlink=1,st_size=1,st_mtime_ns=1)
                def resolve(path,**kwargs):return pathlib.Path('/usr/bin/python3.12') if str(path) in ('/proc/self/exe',c.sys.executable) else path
                def empty(path,selection,observed):
                    original_identity=c.identity
                    def identity(info):
                        row=original_identity(info)
                        if drift and runtime_count==2:row['ino']+=1
                        return row
                    with self.empty_source_edges(fault if active else None,close_error=bool(fault and active)) as calls,patch.object(c,'identity',side_effect=identity):
                        try:return original_empty(path,selection,observed)
                        finally:typed_events.append(copy.deepcopy(calls))
                with patch.object(c.Path,'resolve',resolve),patch.object(c.Path,'stat',side_effect=lambda *args,**kwargs:SimpleNamespace(st_dev=4,st_ino=5)),patch.object(c.os,'lstat',side_effect=metadata),patch.object(c.os,'readlink',side_effect=lambda path:aliases[str(path)]['linkText']),patch.object(c,'directory_identity',return_value={'dev':4,'ino':6,'mode':stat.S_IFDIR|0o755}),patch.object(c.os,'sched_getaffinity',return_value={0}),patch.object(c.resource,'getrlimit',return_value=(-1,-1)),patch.object(c,'read_empty_python_source',side_effect=empty):
                    return original_runtime(request)
            def save(output,name,raw):
                if retention and name.startswith('runtime.') and D(raw)['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['status']=='failed':raise OSError('TYPED_RETENTION')
                return original_save(output,name,raw)
            def startup(where,mode,args):
                observation=D(files['python-startup.before.json']);observation['arguments']=['scripts/run-i80386-hdd-gui-actual.py',mode]+args
                return files['python-startup.original.txt'],observation
            class Fake:
                def __init__(self,where,output,environment):self.output=output;self.attempts=set()
                def git(self,args):
                    order.append('git');role='git-'+str(len(self.attempts));self.attempts.add(role)
                    if args[0]=='rev-parse':stdout=(request['source']['head' if args[1]=='HEAD' else 'tree']+'\n').encode()
                    else:stdout=('source:'+args[2].split(':',1)[1]).encode()
                    prefix=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
                    self.output.save(role+'.stdout',stdout);self.output.save(role+'.stderr',b'');self.output.save(role+'.process.json',E(proc(prefix+args,stdout)))
                    return stdout
                def api(self,route):
                    order.append('api');role='build-run' if '/runs/' in route else ('build-job' if '/jobs/' in route else 'build-artifact')
                    return files[role+'.original.json']
                def run(self,role,argv,environment,seconds,*args):
                    order.append(role);self.attempts.add(role)
                    if role=='frontend-acquisition':
                        self.output.save(role+'.stderr',b'');self.output.save(role+'.process.json',E(proc(argv,files['frontend.original.zip'])))
                        return files['frontend.original.zip']
                    directory=pathlib.Path(environment['PROOF_OUTPUT']);directory.mkdir()
                    admission=(self.output.root/'probe-admission.json').read_bytes()
                    for name,raw in files.items():
                        if not name.startswith(role+'/'):continue
                        leaf=name.split('/',1)[1]
                        if leaf=='admission.json':raw=admission
                        if leaf=='proof.json':
                            proof=D(raw);proof['admissionSha256']=H(admission);raw=E(proof)
                        (directory/leaf).write_bytes(raw)
                    child=D(files[role+'.process.json']);child['argv']=argv;child['environment']=environment
                    for stream in ('stdout','stderr'):self.output.save(role+'.'+stream,b'')
                    self.output.save(role+'.process.json',E(child));return b''
            with patch.object(c,'sha',side_effect=lambda raw:'fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48' if raw is node else original_sha(raw)),patch.object(c.Originals,'save',save),patch.object(c,'regular',side_effect=regular),patch.object(c,'check_file',side_effect=check_file),patch.object(c,'inventory',side_effect=inventory),patch.object(c,'observe_runtime',side_effect=runtime),patch.object(c,'observe_python_startup',side_effect=startup):
                status=c.execute(files['request.original.json'],expected['requestSha256'],checkout,checkout/'gui-originals/originals',env,factory=Fake)
            observed={str(path.relative_to(checkout/'gui-originals/originals')):path.read_bytes() for path in (checkout/'gui-originals/originals').rglob('*') if path.is_file()}
            return status,observed,expected,order,typed_events
    def test_actual_v4_complete_packet_reaches_real_official_and_metadata_readers(self):
        files,expected=fixture_v4();verdict=r.audit(*sealed(files,expected))
        self.assertTrue(verdict['pass']);self.assertEqual(verdict['schema'],'bw.gui-hdd.reader.v4')
        request=D(files['request.original.json']);self.assertEqual(c.parse_request(E(request),H(E(request))),r.parse_request(E(request),H(E(request))))
        metadata=request['inventoryAdmission']['metadataAdmission'];result=r.verify_inventory_original(base64.b64decode(expected['inventoryOriginal']['base64']),base64.b64decode(expected['inventoryTemplate']['base64']),metadata)
        self.assertFalse(result['actualRequestSupported']);self.assertFalse(result['qualified']);self.assertIs(c.ACTUAL_ENABLED,False);self.assertIs(r.ACTUAL_ENABLED,False)
    def test_actual_v4_request_selection_type_and_legacy_version_refusals(self):
        for cut in ('path','role','hash','nonempty','bool','float','duplicate','version','reference-schema','workflow-content','metadata-schema'):
            files,expected=fixture_v4();request=D(files['request.original.json']);selection=request['runtime']['emptyPythonSources'];row=selection[c.EMPTY_PYTHON_PATH]
            if cut=='path':selection['/usr/lib/python3.12/other/__init__.py']=selection.pop(c.EMPTY_PYTHON_PATH)
            elif cut=='role':row['role']='executable'
            elif cut=='hash':row['sha256']='0'*64
            elif cut in ('nonempty','bool','float'):row['byteLength']={'nonempty':1,'bool':False,'float':0.0}[cut]
            elif cut=='duplicate':request['runtime']['files'][c.EMPTY_PYTHON_PATH]=ROW(b'X')
            elif cut=='version':request['schema']='bw.gui-hdd.actual-request.v3'
            elif cut=='reference-schema':request['inventoryAdmission']['schema']='bw.gui-hdd.inventory-admission.v3'
            elif cut=='workflow-content':request['inventoryAdmission']['workflow']['sha256']='0'*64
            else:request['inventoryAdmission']['metadataAdmission']['schema']='bw.gui-hdd.inventory-admission.v2'
            raw=E(request)
            for module in (c,r):
                with self.assertRaises(ValueError,msg=cut):module.parse_request(raw,H(raw))
    def test_actual_v4_coherently_rehashed_runtime_before_after_adversaries(self):
        base_files,base_expected=fixture_v4()
        baseline_hashes={name:H(raw) for name,raw in base_files.items()};baseline_expected=E(base_expected)
        for stage in ('before','after','both'):
            for cut in ('role','eof','hash','nonempty','bool','float','drift','close','missing','schema','extra','resource-float','file-float','cpu-null','cpu-empty','cpu-duplicate','cpu-bool','cpu-float','cpu-order','rlimit-null','rlimit-bool','rlimit-float','rlimit-extra','rlimit-missing','rlimit-pair'):
                files,expected=copy.deepcopy((base_files,base_expected));name='runtime.'+('before' if stage=='both' else stage)+'.json';runtime=D(files[name]);row=runtime['emptyPythonSources'][c.EMPTY_PYTHON_PATH];source=row['source']
                if cut=='role':row['role']='python-empty-package-source'
                elif cut=='eof':source['read']['eof']=False
                elif cut=='hash':source['read']['sha256']='0'*64
                elif cut=='nonempty':source['read'].update(byteLength=1,sha256=H(b'X'),eof=False)
                elif cut=='bool':source['heldBefore']['uid']=False
                elif cut=='float':source['namedAfter']['gid']=0.0
                elif cut=='drift':source['heldAfter']['ino']+=1
                elif cut=='close':source['close']['succeeded']=False
                elif cut=='missing':runtime['emptyPythonSources']={}
                elif cut=='schema':runtime['schema']='bw.gui-hdd.runtime-observation.v3'
                elif cut=='resource-float':runtime['resources']['controllerSeconds']=1800.0
                elif cut=='file-float':runtime['files']['/chrome']['byteLength']=6.0
                elif cut.startswith('cpu-'):runtime['availableCpus']={'cpu-null':None,'cpu-empty':[],'cpu-duplicate':[0,0],'cpu-bool':[False],'cpu-float':[0.0],'cpu-order':[1,0]}[cut]
                elif cut=='rlimit-null':runtime['rlimits']=None
                elif cut=='rlimit-bool':runtime['rlimits']['4'][0]=False
                elif cut=='rlimit-float':runtime['rlimits']['4'][0]=0.0
                elif cut=='rlimit-extra':runtime['rlimits']['invented']=[0,0]
                elif cut=='rlimit-missing':runtime['rlimits'].pop('4')
                elif cut=='rlimit-pair':runtime['rlimits']['4']=[-1]
                else:runtime['invented']=True
                files[name]=E(runtime)
                if stage=='both':files['runtime.after.json']=E(runtime)
                # Stored members exercise the same authenticated ZIP inventory and
                # semantic reader checks without repeating 75 expensive deflates.
                with self.assertRaises((ValueError,KeyError),msg=str((stage,cut))):r.audit(*sealed(files,expected,zipfile.ZIP_STORED))
        files,expected=copy.deepcopy((base_files,base_expected));runtime=D(files['runtime.after.json'])
        for snapshot in ('namedBefore','heldBefore','heldAfter','namedAfter'):runtime['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['source'][snapshot]['ino']+=1
        files['runtime.after.json']=E(runtime)
        with self.assertRaisesRegex(ValueError,'before/after identity'):r.audit(*sealed(files,expected))
        self.assertEqual({name:H(raw) for name,raw in base_files.items()},baseline_hashes)
        self.assertEqual(E(base_expected),baseline_expected)
    def test_actual_v4_external_reference_template_and_prior_observation_authority(self):
        for cut in ('reference-pin','template-pin','partial-template','outer-version','prior-close','workflow-conflict'):
            files,expected=fixture_v4();request=D(files['request.original.json'])
            if cut=='reference-pin':expected['inventoryReferenceSha256']='0'*64
            elif cut=='template-pin':expected['inventoryTemplate']['sha256']='0'*64
            elif cut=='partial-template':expected['inventoryTemplate']['base64']=expected['inventoryTemplate']['base64'][:-4]
            elif cut=='outer-version':expected.pop('schema');expected.pop('inventoryTemplate');expected.pop('inventoryReferenceSha256')
            elif cut=='workflow-conflict':
                request['inventoryAdmission']['workflow']['sha256']='0'*64;refresh_v4_request(files,expected,request)
            else:
                prior=D(base64.b64decode(expected['inventoryOriginal']['base64']));prior['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['source']['close']['succeeded']=False;raw=E(prior)
                expected['inventoryOriginal']=dict(ROW(raw),base64=base64.b64encode(raw).decode());request['inventoryAdmission']['metadataAdmission']['original']=ROW(raw);refresh_v4_request(files,expected,request)
            with self.assertRaises(ValueError,msg=cut):r.audit(*sealed(files,expected))
    def test_actual_v4_real_controller_runtime_reader_before_and_after(self):
        status,files,expected,order,calls=self.run_actual_v4();self.assertEqual(status,0);self.assertEqual(len(calls),2)
        self.assertTrue(all(sum(operation=='read' and cap==1 for operation,cap in events)==1 and sum(operation=='close' for operation,cap in events)==1 for events in calls))
        self.assertEqual(order.count('frontend-acquisition'),1);self.assertLess(order.index('api'),order.index('frontend-acquisition'))
        self.assertLess(order.index(r.SCENARIOS[0]),order.index(r.SCENARIOS[1]));self.assertEqual(r.audit(*sealed(files,expected))['schema'],'bw.gui-hdd.reader.v4')
    def test_actual_v4_controller_preserves_primary_secondary_partial_and_drift(self):
        for after,retention in ((False,False),(True,False),(False,True)):
            status,files,expected,order,calls=self.run_actual_v4('read-error',after,retention);self.assertEqual(status,1)
            result=D(files['result.json']);self.assertEqual(result['firstFailure']['message'],'READ_FAILED')
            self.assertEqual([row['message'] for row in result['secondary']],['CLOSE_FAILED']+(['TYPED_RETENTION'] if retention else []))
            name='runtime.'+('after' if after else 'before')+'.json'
            if not retention:self.assertEqual(D(files[name])['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['status'],'failed')
            if not after:self.assertNotIn('api',order);self.assertEqual(len(calls),2 if after else 1)
        status,files,expected,order,calls=self.run_actual_v4(drift=True);self.assertEqual(status,1)
        self.assertIn('before/after identity',D(files['result.json'])['firstFailure']['message']);self.assertEqual(len(calls),2)
    def test_metadata_before_acquisition(self):
        request=D(self.files['request.original.json']);args=[D(self.files[name+'.original.json']) for name in ('build-run','build-job','build-artifact')]
        c.admit_build_metadata(request,*args)
        for index,key,value in ((0,'id',True),(1,'conclusion','failure'),(2,'digest','sha256:'+'0'*64)):
            mutated=copy.deepcopy(args);mutated[index][key]=value
            with self.assertRaises(ValueError):c.admit_build_metadata(request,*mutated)
    def test_controller_routes_complete_mocked_attempt_into_standalone_reader(self):
        files,expected=self.fresh();request=D(files['request.original.json']);order=[]
        original_regular=c.regular;original_inventory=c.inventory
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);(checkout/'gui-originals').mkdir()
            event=checkout/'event.json';event.write_bytes(files['event.original.json'])
            env={'GITHUB_EVENT_PATH':str(event),'GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request',
              'GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual',
              'BW_EXPECTED_HEAD':'a'*40,'GH_TOKEN':'manufactured-not-a-credential'}
            def regular(path,cap):
                if str(path)==str(checkout/'vendor-pins.json'):return E({'bw-board':c.BOARD,'bw-circuit-ui':c.HISTORICAL_CUI,'sb3-creator':c.SB3})
                return original_regular(path,cap)
            def check_file(path,row):
                name=str(path).removeprefix(str(checkout)+'/')
                if name in request['source']['files']:return ('source:'+name).encode()
                return b'externally mocked installed/input bytes'
            def inventory(path,*args):
                name=str(path).removeprefix(str(checkout)+'/')
                if name.startswith('node_modules/'):
                    return {k.removeprefix(name+'/'):v for k,v in request['installedFiles'].items() if k.startswith(name+'/')}
                return original_inventory(path,*args)
            def runtime(request):order.append('runtime');return D(files['runtime.before.json'])
            def startup(where,mode,args):
                observation=D(files['python-startup.before.json']);observation['arguments']=['scripts/run-i80386-hdd-gui-actual.py',mode]+args
                return files['python-startup.original.txt'],observation
            class Fake:
                def __init__(self,where,output,environment):self.output=output;self.attempts=set()
                def git(self,args):
                    order.append('git');role='git-'+str(len(self.attempts));self.attempts.add(role)
                    if args[0]=='rev-parse':stdout=(request['source']['head' if args[1]=='HEAD' else 'tree']+'\n').encode()
                    else:stdout=('source:'+args[2].split(':',1)[1]).encode()
                    prefix=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
                    self.output.save(role+'.stdout',stdout);self.output.save(role+'.stderr',b'');self.output.save(role+'.process.json',E(proc(prefix+args,stdout)))
                    return stdout
                def api(self,route):
                    order.append('api');role='build-run' if '/runs/' in route else ('build-job' if '/jobs/' in route else 'build-artifact')
                    return files[role+'.original.json']
                def run(self,role,argv,environment,seconds,*args):
                    order.append(role);self.attempts.add(role)
                    if role=='frontend-acquisition':
                        self.output.save(role+'.stderr',b'');self.output.save(role+'.process.json',E(proc(argv,files['frontend.original.zip'])))
                        return files['frontend.original.zip']
                    directory=pathlib.Path(environment['PROOF_OUTPUT']);directory.mkdir()
                    admission=(self.output.root/'probe-admission.json').read_bytes()
                    for name,raw in files.items():
                        if not name.startswith(role+'/'):continue
                        leaf=name.split('/',1)[1]
                        if leaf=='admission.json':raw=admission
                        if leaf=='proof.json':
                            proof=D(raw);proof['admissionSha256']=H(admission);raw=E(proof)
                        (directory/leaf).write_bytes(raw)
                    child=D(files[role+'.process.json']);child['argv']=argv;child['environment']=environment
                    for stream in ('stdout','stderr'):self.output.save(role+'.'+stream,b'')
                    self.output.save(role+'.process.json',E(child));return b''
            with patch.object(c,'regular',side_effect=regular),patch.object(c,'check_file',side_effect=check_file),patch.object(c,'inventory',side_effect=inventory),patch.object(c,'observe_runtime',side_effect=runtime),patch.object(c,'observe_python_startup',side_effect=startup):
                status=c.execute(files['request.original.json'],expected['requestSha256'],checkout,checkout/'gui-originals/originals',env,factory=Fake)
            self.assertEqual(status,0);self.assertEqual(order[0],'runtime');self.assertEqual(order.count('frontend-acquisition'),1)
            self.assertLess(order.index('api'),order.index('frontend-acquisition'));self.assertLess(order.index(r.SCENARIOS[0]),order.index(r.SCENARIOS[1]))
            observed={str(path.relative_to(checkout/'gui-originals/originals')):path.read_bytes() for path in (checkout/'gui-originals/originals').rglob('*') if path.is_file()}
            self.assertTrue(r.audit(*sealed(observed,expected))['pass'])
    def test_child_retention_preserves_primary_and_independent_secondary_closes(self):
        saved={};attempts=[];closes=[]
        class Stream:
            def close(self):closes.append(self);raise OSError('close-secondary')
        class Child:
            pid=400;returncode=1;stdout=Stream();stderr=Stream()
            def poll(self):return 1
        class Output:
            def save(self,name,raw):
                attempts.append(name)
                if name.endswith('.stdout'):raise OSError('save-secondary')
                saved[name]=raw
        edge=c.Hosted(root,Output(),{})
        with patch.object(c.subprocess,'Popen',return_value=Child()),patch.object(c.signal,'signal'),patch.object(c,'process_identity',side_effect=ValueError('identity-primary')),patch.object(c,'remaining_processes',side_effect=OSError('census-secondary')),patch.object(c.sys,'stderr',io.StringIO()):
            with self.assertRaisesRegex(ValueError,'identity-primary'):edge.run('fake',['fake'],{},1)
        self.assertEqual(len(closes),2);self.assertEqual(attempts,['fake.stdout','fake.stderr','fake.process.json'])
        process=D(saved['fake.process.json']);self.assertEqual(process['firstFailure'],'identity-primary')
        self.assertEqual([x['phase'] for x in process['secondaryFailures']],['terminal-census','stream-close','stream-close','retain-stdout'])
    def test_close_only_child_failure_cannot_pass(self):
        saved={}
        class Stream:
            def fileno(self):return 7
            def close(self):raise OSError('close-only')
        class Child:
            pid=400;returncode=0;stdout=Stream();stderr=Stream()
            def poll(self):return 0
            def wait(self,**kwargs):return 0
        class Selector:
            def register(self,*args):pass
            def get_map(self):return {}
            def close(self):pass
        class Output:
            def save(self,name,raw):saved[name]=raw
        identity={'pid':400,'pgid':400,'sessionId':400,'startTicks':8,'parentPid':os.getpid()}
        edge=c.Hosted(root,Output(),{})
        with patch.object(c.subprocess,'Popen',return_value=Child()),patch.object(c.signal,'signal'),patch.object(c,'process_identity',return_value=identity),patch.object(c,'remaining_processes',return_value=[]),patch.object(c.os,'set_blocking'),patch.object(c.selectors,'DefaultSelector',return_value=Selector()):
            with self.assertRaisesRegex(OSError,'close-only'):edge.run('fake',['fake'],{},1)
        self.assertEqual(D(saved['fake.process.json'])['firstFailure'],'close-only')
    def test_preflight_positive_seal_only_failure_and_existing_primary(self):
        files,expected=self.fresh();request=D(files['request.original.json']);original_regular=c.regular;original_seal=c.Originals.seal
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);event=checkout/'event.json';event.write_bytes(files['event.original.json'])
            env={'GITHUB_EVENT_PATH':str(event),'GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe',
              'GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual','BW_EXPECTED_HEAD':'a'*40}
            class Fake:
                def __init__(self,*args):pass
                def git(self,args):
                    if args[0]=='rev-parse':return (request['source']['head' if args[1]=='HEAD' else 'tree']+'\n').encode()
                    return ('source:'+args[2].split(':',1)[1]).encode()
                def api(self,*args):raise AssertionError('preflight must not acquire metadata/frontend')
                def run(self,*args):raise AssertionError('preflight must not generate or execute a guest')
            def regular(path,cap):
                if pathlib.Path(path).name=='vendor-pins.json':return E({'bw-board':c.BOARD,'bw-circuit-ui':c.HISTORICAL_CUI,'sb3-creator':c.SB3})
                return original_regular(path,cap)
            def inventory(path):
                prefix=str(path).removeprefix(str(checkout)+'/')+'/'
                return {name.removeprefix(prefix):row for name,row in request['installedFiles'].items() if name.startswith(prefix)}
            for number,(fail_seal,fail_runtime) in enumerate(((False,False),(True,False),(True,True))):
                captured=[]
                def seal(output,result):
                    captured.append(result)
                    if fail_seal:raise OSError('seal-secondary' if fail_runtime else 'seal-only')
                    return original_seal(output,result)
                def runtime(request):
                    if fail_runtime:raise ValueError('runtime-primary')
                    return D(files['runtime.before.json'])
                def startup(where,mode,args):
                    observation=D(files['python-startup.before.json']);observation['arguments']=['scripts/run-i80386-hdd-gui-actual.py',mode]+args
                    return files['python-startup.original.txt'],observation
                with patch.object(c,'regular',side_effect=regular),patch.object(c,'check_file',side_effect=lambda path,row:('source:'+str(path).removeprefix(str(checkout)+'/')).encode()),patch.object(c,'inventory',side_effect=inventory),patch.object(c,'observe_runtime',side_effect=runtime),patch.object(c.Originals,'seal',autospec=True,side_effect=seal),patch.object(c.sys,'stderr',io.StringIO()),patch.object(c,'observe_python_startup',side_effect=startup):
                    status=c.execute(files['request.original.json'],expected['requestSha256'],checkout,checkout/('preflight-'+str(number)),env,factory=Fake,preflight=True)
                self.assertEqual(status,1 if fail_seal or fail_runtime else 0);self.assertEqual(len(captured),1)
                if fail_runtime:
                    self.assertEqual(captured[0]['firstFailure']['message'],'runtime-primary');self.assertEqual(captured[0]['secondary'][0]['message'],'seal-secondary')
                elif fail_seal:self.assertEqual(captured[0]['firstFailure']['message'],'seal-only')
                else:self.assertTrue(captured[0]['pass'])
    def test_failed_frontend_prefix_uses_archive_cap_without_duplicate_success(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary,patch.object(c,'FILE_CAP',2),patch.object(c,'ARCHIVE_CAP',8):
            output=c.Originals(pathlib.Path(temporary)/'originals');output.save('frontend.partial.zip',b'123')
            self.assertEqual((output.root/'frontend.partial.zip').read_bytes(),b'123')
            with self.assertRaises(ValueError):output.save('ordinary.stdout',b'123')
    def test_explicit_v2_schema_and_independent_directory_originals(self):
        request=D(self.files['request.original.json']);self.assertEqual(request['schema'],'bw.gui-hdd.actual-request.v3')
        request['schema']='bw.gui-hdd.actual-request.v1';raw=E(request)
        for module in (r,c):
            with self.assertRaises(ValueError):module.parse_request(raw,H(raw))
        def cut(f,e):
            observed=D(f['runtime.after.json']);observed['directoryIdentities']['/usr/lib']['mode']=stat.S_IFREG|0o644;f['runtime.after.json']=E(observed)
        self.rejects(cut)
    def test_declared_alias_relative_directory_chain_and_cycles(self):
        aliases={'/lib':{'linkText':'usr/lib','target':'/usr/lib'},'/usr/lib/selected':{'linkText':'libselected.so','target':'/usr/lib/libselected.so'}}
        for module in (r,c):
            self.assertEqual(module.declared_alias_resolution('/lib/selected',aliases),'/usr/lib/libselected.so')
            cycle={'/a':{'linkText':'b','target':'/b'},'/b':{'linkText':'a','target':'/a'}}
            with self.assertRaisesRegex(ValueError,'acyclic'):module.declared_alias_resolution('/a',cycle)
            with self.assertRaises(ValueError):module.declared_alias_resolution('/a',{'/a':{'linkText':'../escape','target':'/escape'}})
    def test_directory_alias_requires_selected_descendants_and_combined_cap(self):
        runtime=D(self.files['request.original.json'])['runtime']
        for module in (r,c):
            module.runtime_alias_policy(runtime)
            changed=copy.deepcopy(runtime);changed['directoryAliases']['/runtime-lib']={'linkText':'unselected','target':'/unselected'}
            with self.assertRaisesRegex(ValueError,'descendants'):module.runtime_alias_policy(changed)
            changed=copy.deepcopy(runtime);changed['aliases']={'/a'+str(i):{'linkText':'/usr/bin/python3.12','target':'/usr/bin/python3.12'} for i in range(255)}
            changed['directoryAliases']['/second']={'linkText':'usr/lib','target':'/usr/lib'}
            with self.assertRaisesRegex(ValueError,'bounded'):module.runtime_alias_policy(changed)
    def test_observed_alias_walk_refuses_undeclared_links_and_cycles(self):
        aliases={'/lib':{'linkText':'usr/lib','target':'/usr/lib'},'/usr/lib/selected':{'linkText':'libselected.so','target':'/usr/lib/libselected.so'}}
        def info(mode,ino=3):return SimpleNamespace(st_dev=1,st_ino=ino,st_mode=mode,st_uid=0,st_gid=0,st_nlink=1,st_size=0,st_mtime_ns=1)
        def lstat(path):
            if path in aliases:return info(stat.S_IFLNK|0o777)
            return info(stat.S_IFREG|0o444 if path.endswith('.so') else stat.S_IFDIR|0o755)
        with patch.object(c.os,'lstat',side_effect=lstat),patch.object(c.os,'readlink',side_effect=lambda name:aliases[name]['linkText']):
            self.assertEqual(c.observed_alias_resolution('/lib/selected',aliases),'/usr/lib/libselected.so')
            with self.assertRaisesRegex(ValueError,'declared'):c.observed_alias_resolution('/lib/selected',{'/lib':aliases['/lib']})
        cycle={'/a':{'linkText':'a','target':'/a'}}
        with patch.object(c.os,'lstat',return_value=info(stat.S_IFLNK|0o777)),patch.object(c.os,'readlink',return_value='a'):
            with self.assertRaisesRegex(ValueError,'finite'):c.observed_alias_resolution('/a',cycle)
    def test_directory_target_nofollow_readback_and_close(self):
        def info(mode=stat.S_IFDIR|0o755,ino=3):return SimpleNamespace(st_dev=1,st_ino=ino,st_mode=mode,st_uid=0,st_gid=0,st_nlink=1,st_size=0,st_mtime_ns=1)
        for scenario in ('positive','file','changed','close'):
            held=info(stat.S_IFREG|0o644) if scenario=='file' else info()
            fstats=[held,info(ino=4) if scenario=='changed' else held]
            with patch.object(c.os,'lstat',return_value=held),patch.object(c.os,'open',return_value=91) as opened,patch.object(c.os,'fstat',side_effect=fstats),patch.object(c.os,'close',side_effect=OSError('close-only') if scenario=='close' else None) as closed:
                if scenario=='positive':self.assertEqual(c.directory_identity('/usr/lib')['ino'],3)
                else:
                    with self.assertRaises((ValueError,OSError)):c.directory_identity('/usr/lib')
                self.assertTrue(opened.call_args.args[1]&os.O_DIRECTORY);self.assertTrue(opened.call_args.args[1]&os.O_NOFOLLOW);closed.assert_called_once_with(91)
    def test_proc_stat_zero_size_bounded_held_identity_and_pid(self):
        raw=b'400 (owned ) name) '+b' '.join([b'R',b'1',b'400',b'400']+[b'0']*15+[b'8'])
        info=SimpleNamespace(st_dev=1,st_ino=2,st_mode=stat.S_IFREG|0o444,st_size=0)
        position=0
        def read(fd,count):
            nonlocal position
            value=raw[position:position+count];position+=len(value);return value
        with patch.object(c.os,'open',return_value=92) as opened,patch.object(c.os,'fstat',return_value=info),patch.object(c.os,'read',side_effect=read),patch.object(c.os,'close') as closed:
            self.assertEqual(c.process_identity(400)['startTicks'],8);closed.assert_called_once_with(92)
            self.assertTrue(opened.call_args.args[1]&os.O_NOFOLLOW)
        with patch.object(c,'proc_stat',return_value=raw):
            with self.assertRaisesRegex(ValueError,'PID'):c.process_identity(401)
    def test_proc_stat_overflow_retains_primary_on_close_error(self):
        info=SimpleNamespace(st_dev=1,st_ino=2,st_mode=stat.S_IFREG|0o444,st_size=0);remaining=5000;reads=[]
        def read(fd,count):
            nonlocal remaining
            reads.append(count);amount=min(count,remaining);remaining-=amount;return b'x'*amount
        with patch.object(c.os,'open',return_value=92),patch.object(c.os,'fstat',return_value=info),patch.object(c.os,'read',side_effect=read),patch.object(c.os,'close',side_effect=OSError('close-secondary')) as closed:
            with self.assertRaisesRegex(ValueError,'cap'):c.proc_stat(400)
            self.assertEqual(sum(reads),4097);closed.assert_called_once_with(92)
    def test_both_proc_censuses_are_lazy_capped_and_close(self):
        for operation in (lambda:c.descendants(400),lambda:c.remaining_processes(400,{})):
            consumed=[];closed=[]
            class Entries:
                def __enter__(self):return self
                def __exit__(self,*args):closed.append(True)
                def __iter__(self):
                    for i in range(9000):consumed.append(i);yield SimpleNamespace(name='non-pid')
            with patch.object(c.os,'scandir',return_value=Entries()),patch.object(c,'process_identity',side_effect=AssertionError('nonpid must not read stat')):
                with self.assertRaisesRegex(ValueError,'census'):operation()
            self.assertEqual(len(consumed),8193);self.assertEqual(closed,[True])
    def test_remaining_escaped_descendant_keeps_start_identity(self):
        row={'pid':450,'state':'R','parentPid':1,'pgid':999,'sessionId':999,'startTicks':7}
        with patch.object(c,'proc_pids',return_value=iter([450])),patch.object(c,'process_identity',return_value=row):
            self.assertEqual(c.remaining_processes(400,{450:dict(row)}),[row])
        with patch.object(c,'proc_pids',return_value=iter([450])),patch.object(c,'process_identity',return_value=dict(row,startTicks=8)):
            self.assertEqual(c.remaining_processes(400,{450:dict(row)}),[])
    def test_reader_has_no_producer_or_execution_import(self):
        tree=ast.parse((root/'scripts/read-i80386-hdd-gui-originals.py').read_text());names=[]
        for node in ast.walk(tree):
            if isinstance(node,ast.Import):names.extend(x.name for x in node.names)
            if isinstance(node,ast.ImportFrom):names.append(node.module)
        self.assertFalse(any(name and any(x in name for x in ('subprocess','playwright','run_i80386','actual_controller')) for name in names))
    def test_capped_failed_frontend_prefix_policy(self):
        self.assertIn("frontend.partial.zip",(root/'scripts/run-i80386-hdd-gui-actual.py').read_text())
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            output=c.Originals(pathlib.Path(temporary)/'originals');output.save('frontend.partial.zip',b'prefix')
            with self.assertRaises(ValueError):output.save('frontend.partial.zip',b'retry')
            self.assertEqual((output.root/'frontend.partial.zip').read_bytes(),b'prefix')

    @contextlib.contextmanager
    def font_discovery_edges(self,partial=False,close_error=False,missing=False,tool_mode=0o755,config_raw=None,read_error=False):
        source=D(self.files['source.before.json']);config=config_raw or b'<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><include>conf.d</include><dir>/usr/share/fonts</dir></fontconfig>'
        main='/etc/fonts/fonts.conf';alias='/etc/fonts/conf.d/10-family.conf';target='/usr/share/fontconfig/conf.avail/10-family.conf';font='/usr/share/fonts/Mock.ttf'
        rawfiles={main:config,target:b'<fontconfig><alias><family>Mock</family></alias></fontconfig>',font:b'fontbytes',
          '/usr/bin/git':b'selectedgit','/usr/bin/dpkg-query':b'selecteddpkg'}
        names={'/etc/fonts/conf.d':['10-family.conf'],'/usr/share/fonts':['Mock.ttf'],'/usr/local/share/fonts':[]}
        baseline={'schema':'bw.gui-hdd.inventory-template.v3','files':[main,target,font]+(['/etc/fonts/conf.avail/missing.conf'] if partial else []),'aliases':[alias]}
        request={'schema':'bw.gui-hdd.font-discovery-request.v1','source':source,'baseline':dict(ROW(E(baseline)),base64=base64.b64encode(E(baseline)).decode())};raw=E(request)
        env={'GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'font-discovery',
          'GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_WORKFLOW_REF':r.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@refs/pull/123/merge','BW_EXPECTED_HEAD':'a'*40,'GITHUB_EVENT_PATH':'/event'}
        event={'action':'labeled','label':{'name':'x86-hdd-gui-font-discovery'},'sender':{'login':'CrispStrobe'},'repository':{'full_name':r.REPOSITORY},'number':123,
          'pull_request':{'number':123,'state':'open','head':{'sha':'a'*40,'repo':{'full_name':r.REPOSITORY,'fork':False}},'base':{'ref':'main','repo':{'full_name':r.REPOSITORY}},
          'body':'<!-- BW_GUI_HDD_FONT_DISCOVERY_SHA256='+H(raw)+' -->'}}
        store={'/event':E(event)};events=[];fdpaths={};readat={};counter=[0]
        def info(path):
            path=str(path)
            if path==alias:mode=stat.S_IFLNK|0o777;size=len(target)
            elif path in names:mode=stat.S_IFDIR|0o755;size=4096
            elif path in rawfiles:mode=stat.S_IFREG|(tool_mode if path.startswith('/usr/bin/') else 0o644);size=len(rawfiles[path])
            else:raise FileNotFoundError(path)
            if missing and path==font:raise FileNotFoundError('FONT_READ_FIRST')
            return SimpleNamespace(**{'st_'+k:v for k,v in {'dev':1,'ino':sorted(list(rawfiles)+list(names)+[alias]).index(path)+10,'mode':mode,'uid':0,'gid':0,'nlink':1,'size':size,'mtime_ns':-2}.items()})
        class Scan:
            def __init__(self,path):self.path=str(path)
            def __enter__(self):return iter(SimpleNamespace(name=n) for n in names[self.path])
            def __exit__(self,*args):pass
        def open_(path,flags):
            self.assertEqual(flags,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK);fd=50+len(fdpaths);fdpaths[fd]=str(path);readat[fd]=0;events.append(('open',str(path)));return fd
        def read_(fd,size):
            path=fdpaths[fd]
            if read_error and path==font:raise OSError('FONT_READ_FIRST')
            at=readat[fd];raw=rawfiles[path][at:at+size];readat[fd]+=len(raw);return raw
        def close_(fd):
            events.append(('close',fdpaths[fd]))
            if close_error and fdpaths[fd]==font:raise OSError('FONT_CLOSE_FIRST')
        class Output:
            def __init__(self,path):self.root=pathlib.Path(path);self.files={}
            def save(self,name,data):store[str(self.root/name)]=data;self.files[name]=ROW(data)
        class Edge:
            def __init__(self,root,output,env):self.output=output;self.attempts=set();self.deadline=10**20
            def git(self,args):
                role='git-'+str(len(self.attempts));self.attempts.add(role)
                data=((source['head' if args[1]=='HEAD' else 'tree']+'\n').encode() if args[0]=='rev-parse' else ('source:'+args[2].split(':',1)[1]).encode())
                argv=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']+args
                self.output.save(role+'.stdout',data);self.output.save(role+'.stderr',b'');self.output.save(role+'.process.json',E({'argv':argv,'exitCode':0}));events.append(('git',args));return data
            def run(self,role,argv,environment,seconds,stdout_cap):
                self.attempts.add(role);events.append(('probe',role));counter[0]+=1
                if role=='font-packages':out=b'fonts-mock\t1.0\tinstalled\n'
                elif role=='font-owners':out=''.join('fonts-mock: '+path+'\n' for path in argv[3:] if 'missing.conf' not in path).encode()
                else:out=''.join(path+'\n' for path in sorted({main,target,font,alias})).encode()
                err=b'dpkg-query: no path found matching pattern /etc/fonts/conf.avail/missing.conf\n' if partial and role=='font-owners' else b''
                record=proc(argv,out,err,environment,seconds=.001);record['identity'].update(parentPid=900,state='S');record.update(startedNs=counter[0]*10000000,endedNs=counter[0]*10000000+1000)
                if err:record.update(exitCode=1,firstFailure='child nonzero exit')
                for suffix,data in (('stdout',out),('stderr',err),('process.json',E(record))):self.output.save(role+'.'+suffix,data)
                if err:raise ValueError('OWNERS_PARTIAL_FIRST')
                return out
        def regular_(path,cap):
            path=str(path)
            data=store.get(path)
            if data is None and path.startswith('/checkout/'):data=('source:'+path[len('/checkout/'):]).encode()
            if data is None:raise FileNotFoundError(path)
            self.assertLessEqual(len(data),cap);return data
        with patch.object(c,'Originals',Output),patch.object(c,'Hosted',Edge),patch.object(c,'regular',regular_),patch.object(c.Path,'lstat',lambda path:info(path)),patch.object(c.Path,'resolve',lambda path,strict=True:path),\
          patch.object(c.Path,'exists',lambda path:str(path) in store),patch.object(c.os,'scandir',Scan),patch.object(c.os,'readlink',lambda path:target),\
          patch.object(c.os,'open',open_),patch.object(c.os,'read',read_),patch.object(c.os,'fstat',lambda fd:info(fdpaths[fd])),patch.object(c.os,'close',close_):
            yield raw,env,events
    def font_discovery_fixture(self,**kw):
        with self.font_discovery_edges(**kw) as (request,env,events):value=c.collect_font_discovery(request,H(request),pathlib.Path('/checkout'),env,'/out/fonts.json')
        expected={'schema':'bw.gui-hdd.font-discovery-expectation.v1','source':D(request)['source'],'request':ROW(request),'original':ROW(E(value)),'runId':200,'workflowSha':'d'*40}
        return value,request,expected,events
    def test_font_discovery_complete_readonly_three_probe_original(self):
        value,request,expected,events=self.font_discovery_fixture();self.assertIsNone(value['firstFailure']);self.assertTrue(value['complete'])
        self.assertEqual([item[1] for item in events if item[0]=='probe'],['font-packages','font-owners','font-manifests'])
        verdict=r.verify_font_discovery(E(value),request,expected);self.assertFalse(verdict['candidate']);self.assertFalse(verdict['activeFontSelectionProved']);self.assertFalse(verdict['actualRequestSupported'])
        self.assertEqual(value['configs']['/usr/share/fontconfig/conf.avail/10-family.conf']['unsupported'],['opaque element alias'])
        self.assertEqual(value['configReferences']['references'][0]['targets'],['/usr/share/fontconfig/conf.avail/10-family.conf'])
    def test_font_discovery_partial_ownership_preserves_raw_and_stops(self):
        value,request,expected,events=self.font_discovery_fixture(partial=True)
        self.assertEqual(value['firstFailure']['message'],'OWNERS_PARTIAL_FIRST');self.assertFalse(value['complete']);self.assertEqual(len(value['commands']),2)
        self.assertIn('/etc/fonts/conf.avail/missing.conf',value['baselineMissing']);self.assertIn(b'fonts-mock:',base64.b64decode(value['commands'][1]['stdout']['base64']))
        self.assertTrue(r.verify_font_discovery(E(value),request,expected)['observationOnly'])
    def test_font_discovery_required_read_close_and_suid_stop_before_packages(self):
        for kw,message in (({'close_error':True},'FONT_CLOSE_FIRST'),({'missing':True},'FONT_READ_FIRST'),({'tool_mode':0o4755},'nonwritable root-owned')):
            value,request,expected,events=self.font_discovery_fixture(**kw)
            self.assertIn(message,value['firstFailure']['message']);self.assertFalse(any(op=='probe' for op,arg in events));self.assertFalse(value['complete'])
        with patch.object(c,'FONT_DISCOVERY_ENABLED',False),patch.object(c.Path,'cwd',side_effect=AssertionError('guard touched OS')),patch.object(c,'regular',side_effect=AssertionError('guard read input')):
            for mode in ('font-discovery-guard','font-discovery'):
                with self.assertRaisesRegex(ValueError,'font discovery disabled'):c.main([mode])
    def test_font_discovery_config_cap_and_frame_reserve_keep_bounded_failure(self):
        value,request,expected,events=self.font_discovery_fixture(config_raw=b'X'*65537)
        self.assertIsNotNone(value['firstFailure']);self.assertNotIn('original',value['files']['/etc/fonts/fonts.conf'])
        self.assertFalse(any(op=='open' and path=='/etc/fonts/fonts.conf' for op,path in events));self.assertFalse(value['commands'])
        with patch.object(c,'JSON_CAP',(2<<20)+1024):value,request,expected,events=self.font_discovery_fixture()
        self.assertIn('reserve',value['firstFailure']['message']);self.assertLessEqual(len(E(value)),(2<<20)+1024);self.assertFalse(value['commands'])
        self.assertTrue(r.verify_font_discovery(E(value),request,expected)['observationOnly'])
    def test_font_discovery_read_primary_close_secondary_order(self):
        value,request,expected,events=self.font_discovery_fixture(read_error=True,close_error=True)
        self.assertEqual(value['firstFailure']['message'],'FONT_READ_FIRST');self.assertEqual([e['message'] for e in value['secondary']],['FONT_CLOSE_FIRST'])
        self.assertFalse(value['commands']);self.assertFalse(value['files']['/usr/share/fonts/Mock.ttf']['close']['succeeded'])
        self.assertFalse(r.verify_font_discovery(E(value),request,expected)['qualified'])
    def test_font_discovery_independent_rehashed_semantic_refusals(self):
        for cut in ('pin','event','head','source','tool-mode','float','alias','config','include','process','stream','package','owner','manifest','later-tool','candidate','native','source-empty','orphan','exit-bool','process-extra','tool-readback','omitted-file'):
            value,request,expected,events=self.font_discovery_fixture();request_value=D(request)
            if cut=='pin':expected['request']['sha256']='0'*64
            elif cut in ('event','head'):
                event=D(base64.b64decode(value['event']['base64']))
                if cut=='event':event['sender']['login']='foreign'
                else:event['pull_request']['head']['sha']='f'*40
                value['event']=c.font_blob(E(event))
            elif cut=='source':value['sourceCommands'][3]['stdout']['sha256']='0'*64
            elif cut=='tool-mode':
                for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):value['tools']['/usr/bin/git'][key]['mode']|=0o4000
            elif cut=='float':value['files']['/usr/share/fonts/Mock.ttf']['heldBefore']['uid']=0.0
            elif cut=='alias':value['aliases']['/etc/fonts/conf.d/10-family.conf']['target']='/etc/fonts/other.conf'
            elif cut=='config':value['files']['/etc/fonts/fonts.conf']['original']=c.font_blob(b'<fontconfig/>')
            elif cut=='include':value['configReferences']['references'][0]['targets']=[]
            elif cut=='process':value['commands'][0]['process']['identity']['sessionId']+=1
            elif cut=='stream':value['commands'][0]['stdout']=c.font_blob(b'invented\n')
            elif cut in ('package','owner','manifest'):
                index={'package':0,'owner':1,'manifest':2}[cut];command=value['commands'][index]
                raw=(b'fonts-mock\t1.0\tnot-installed\n' if cut=='package' else b'unknown: /etc/fonts/fonts.conf\n' if cut=='owner' else b'/different\n')
                command['stdout']=c.font_blob(raw);command['process']['streams']['stdout']=ROW(raw)
                if cut=='package':value['packages']={'fonts-mock':{'version':'1.0','status':'not-installed'}}
            elif cut=='later-tool':value['commands'][0]['process'].update(exitCode=1,firstFailure='failed');value.update(complete=False,firstFailure={'phase':'font-packages','path':None,'name':'ValueError','message':'failed'})
            elif cut=='source-empty':value['sourceCommands']=[]
            elif cut=='orphan':value['directories']['/usr/share/fonts/orphan']=copy.deepcopy(value['directories']['/usr/local/share/fonts'])
            elif cut=='exit-bool':value['commands'][0]['process']['exitCode']=False
            elif cut=='process-extra':value['commands'][0]['process']['invented']=True
            elif cut=='tool-readback':
                for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):value['commands'][0]['tool'][key]['ino']+=1
            elif cut=='omitted-file':value['files'].pop('/usr/share/fonts/Mock.ttf')
            elif cut=='candidate':value['candidate']=True
            else:value['activeFontSelectionProved']=True
            expected['original']=ROW(E(value))
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_discovery(E(value),request,expected)
    def test_font_xml_opaque_prolog_no_entities_cycles_or_native_selection(self):
        for raw in (b'<!DOCTYPE fontconfig SYSTEM "file:///etc/passwd"><fontconfig/>',b'<!DOCTYPE fontconfig [<!ENTITY x "oops">]><fontconfig>&x;</fontconfig>'):
            for module in (c,r):
                with self.assertRaises(ValueError):module.font_xml(raw)
        raw=b'<fontconfig><include prefix="xdg">fonts.conf</include><include ignore_missing="yes">/etc/fonts/not-present.conf</include></fontconfig>'
        for module in (c,r):
            parsed=module.font_xml(raw);self.assertEqual(parsed['unsupported'],['unsupported include reference']);self.assertFalse(parsed['nativeSelectionInterpreted'])
            config=module.font_xml(b'<fontconfig><include>/etc/fonts/fonts.conf</include></fontconfig>')
            graph=module.font_config_links({'/etc/fonts/fonts.conf':config},{},{},{})
            self.assertEqual(graph['cycles'],[['/etc/fonts/fonts.conf','/etc/fonts/fonts.conf']])
    def test_font_discovery_retention_primary_and_close_are_not_success(self):
        value,request,expected,events=self.font_discovery_fixture();written=[]
        class Complete:
            def write(self,raw):written.append(raw);return len(raw)
            def close(self):written.append('closed')
        with patch.object(c.Path,'open',return_value=Complete()):self.assertEqual(c.retain_font_discovery(value,'/out/fonts.json'),0)
        self.assertEqual(written,[E(value),'closed'])
        class CloseOnly(Complete):
            def close(self):raise OSError('CLOSE_ONLY')
        with patch.object(c.Path,'open',return_value=CloseOnly()),patch.object(c.sys,'stderr',io.StringIO()):self.assertEqual(c.retain_font_discovery(value,'/out/fonts.json'),1)
        self.assertEqual(value['firstFailure']['message'],'CLOSE_ONLY');self.assertEqual(value['firstFailure']['phase'],'retention-close')
        value,request,expected,events=self.font_discovery_fixture(partial=True)
        class Sink:
            def write(self,raw):raise OSError('WRITE_LATER')
            def close(self):raise OSError('CLOSE_LAST')
        with patch.object(c.Path,'open',return_value=Sink()),patch.object(c.sys,'stderr',io.StringIO()) as stderr:
            self.assertEqual(c.retain_font_discovery(value,'/out/fonts.json'),1)
        self.assertEqual(value['firstFailure']['message'],'OWNERS_PARTIAL_FIRST');self.assertEqual([row['message'] for row in value['secondary']],['WRITE_LATER','CLOSE_LAST'])
        self.assertIn('OWNERS_PARTIAL_FIRST',stderr.getvalue())
        value,request,expected,events=self.font_discovery_fixture(partial=True)
        with patch.object(c,'JSON_CAP',1),patch.object(c.Path,'open',side_effect=AssertionError('oversize must not open')),patch.object(c.sys,'stderr',io.StringIO()) as stderr:
            self.assertEqual(c.retain_font_discovery(value,'/out/fonts.json'),1)
        self.assertEqual(value['firstFailure']['message'],'OWNERS_PARTIAL_FIRST');self.assertIn('bounded discovery original',value['secondary'][0]['message'])
        self.assertIn('OWNERS_PARTIAL_FIRST',stderr.getvalue());self.assertLessEqual(len(stderr.getvalue().encode()),8192)
        value,request,expected,events=self.font_discovery_fixture(partial=True)
        encode_calls=[0];original_encode=c.encode
        def fail_first_encode(item):
            encode_calls[0]+=1
            if encode_calls[0]==1:raise ValueError('ENCODE_LATER')
            return original_encode(item)
        with patch.object(c,'encode',fail_first_encode),patch.object(c.sys,'stderr',io.StringIO()) as stderr:
            self.assertEqual(c.retain_font_discovery(value,'/out/fonts.json'),1)
        self.assertEqual(value['firstFailure']['message'],'OWNERS_PARTIAL_FIRST');self.assertEqual(value['secondary'][0]['message'],'ENCODE_LATER')
        value,request,expected,events=self.font_discovery_fixture(partial=True)
        with patch.object(c.Path,'open',side_effect=OSError('OPEN_LATER')),patch.object(c.sys.stderr,'write',side_effect=OSError('DIAGNOSTIC_LAST')):
            self.assertEqual(c.retain_font_discovery(value,'/out/fonts.json'),1)
        self.assertEqual(value['firstFailure']['message'],'OWNERS_PARTIAL_FIRST');self.assertEqual([row['message'] for row in value['secondary']],['OPEN_LATER','DIAGNOSTIC_LAST'])

    def test_font_workflow_installer_cli_and_standalone_reader_positive(self):
        with self.font_discovery_edges() as (request_raw,env,events):pass
        stages=[]
        with patch.object(c,'FONT_DISCOVERY_ENABLED',True):self.assertEqual(c.main(['font-discovery-guard']),0)
        stages.extend(['guard','setup-mock'])
        blob=hashlib.sha1(b'blob '+str(len(request_raw)).encode()+b'\0'+request_raw).hexdigest();installed=[];calls=[]
        response=E({'sha':blob,'encoding':'base64','size':len(request_raw),'content':base64.b64encode(request_raw).decode()})
        def api(edge,route):
            self.assertEqual(route,'/git/blobs/'+blob);self.assertEqual(edge.env['GH_TOKEN'],'installer-only');calls.append(('api',route));return response
        def open_(target,flags,mode):
            self.assertEqual(str(target),'/inputs/request.json');self.assertEqual(flags,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW);self.assertEqual(mode,0o600);calls.append(('open',));return 70
        def write_(fd,raw):self.assertEqual(fd,70);installed.append(raw);return len(raw)
        def chmod_(fd,mode):self.assertEqual((fd,mode),(70,0o444));calls.append(('readonly',))
        def close_(fd):self.assertEqual(fd,70);calls.append(('close',))
        with patch.object(c.Hosted,'api',api),patch.object(c.Path,'resolve',lambda path,strict=True:path),patch.object(c.Path,'exists',return_value=False),\
          patch.object(c.os,'open',open_),patch.object(c.os,'write',write_),patch.object(c.os,'fchmod',chmod_),patch.object(c.os,'close',close_),patch.object(c,'regular',return_value=request_raw):
            result=c.install_input(blob,H(request_raw),'/inputs/request.json',{'GH_TOKEN':'installer-only'})
        self.assertEqual(result,dict(ROW(request_raw),gitBlob=blob));self.assertEqual(installed,[request_raw]);self.assertEqual([call[0] for call in calls],['api','open','readonly','close']);stages.append('install')
        captured=[]
        class Sink:
            def write(self,raw):captured.append(raw);return len(raw)
            def close(self):pass
        with self.font_discovery_edges() as (request,env,events):
            self.assertEqual(request,installed[0]);previous=c.regular
            def read(path,cap):return installed[0] if str(path)=='/inputs/request.json' else previous(path,cap)
            with patch.object(c,'FONT_DISCOVERY_ENABLED',True),patch.object(c.Path,'cwd',return_value=pathlib.Path('/checkout')),patch.dict(c.os.environ,dict(env,GH_TOKEN='',GITHUB_TOKEN=''),clear=True),\
              patch.object(c,'regular',read),patch.object(c.Path,'open',return_value=Sink()):
                self.assertEqual(c.main(['font-discovery','--request','/inputs/request.json','--expected-sha256',H(request),'--output','/out/fonts.json']),0)
        stages.extend(['collect','always-upload-mock']);self.assertEqual(stages,['guard','setup-mock','install','collect','always-upload-mock'])
        self.assertEqual(len(captured),1);value=D(captured[0]);self.assertTrue(value['complete']);self.assertIsNone(value['firstFailure'])
        self.assertTrue(all('GH_TOKEN' not in command['process']['environment'] and 'GITHUB_TOKEN' not in command['process']['environment'] for command in value['commands']))
        expected={'schema':'bw.gui-hdd.font-discovery-expectation.v1','source':D(request)['source'],'request':ROW(request),'original':ROW(captured[0]),'runId':200,'workflowSha':'d'*40}
        verdict=r.verify_font_discovery(captured[0],request,expected);self.assertFalse(verdict['candidate']);self.assertFalse(verdict['qualified'])
    def test_font_workflow_guard_refusal_and_partial_collector_always_retain(self):
        stages=[];status=0
        # Model only the finite workflow ordering; the source guard is real.
        try:
            with patch.object(c,'FONT_DISCOVERY_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('guard must precede input')),patch.object(c.Path,'cwd',side_effect=AssertionError('guard must precede setup')):
                c.main(['font-discovery-guard'])
            stages.extend(['setup','input'])
        except ValueError:status=1
        finally:stages.append('always-upload-mock')
        self.assertEqual(status,1);self.assertEqual(stages,['always-upload-mock'])
        retained=[];captures=[];uploaded=[]
        class Sink:
            def write(self,raw):retained.append(raw);return len(raw)
            def close(self):pass
        with self.font_discovery_edges(partial=True) as (request,env,events):
            output_class=c.Originals
            class RememberOutput(output_class):
                def __init__(self,*args):super().__init__(*args);captures.append(self)
            previous=c.regular
            def read(path,cap):return request if str(path)=='/inputs/request.json' else previous(path,cap)
            try:
                with patch.object(c,'FONT_DISCOVERY_ENABLED',True),patch.object(c.Path,'cwd',return_value=pathlib.Path('/checkout')),patch.dict(c.os.environ,dict(env,GH_TOKEN='',GITHUB_TOKEN=''),clear=True),                  patch.object(c,'regular',read),patch.object(c.Path,'open',return_value=Sink()),patch.object(c,'Originals',RememberOutput):
                    self.assertEqual(c.main(['font-discovery-guard']),0)
                    status=c.main(['font-discovery','--request','/inputs/request.json','--expected-sha256',H(request),'--output','/out/fonts.json'])
            finally:
                # The reviewed upload path includes the complete auxiliary tree.
                uploaded.extend(str(output.root/name) for output in captures for name in output.files)
        self.assertEqual(status,1);value=D(retained[0]);self.assertEqual(value['firstFailure']['message'],'OWNERS_PARTIAL_FIRST')
        for suffix in ('stdout','stderr','process.json'):self.assertIn('/out/fonts-process-originals/font-owners.'+suffix,uploaded)
        self.assertTrue(base64.b64decode(value['commands'][-1]['stdout']['base64']).startswith(b'fonts-mock: '));self.assertFalse(value['complete'])
        self.assertFalse(any(name.endswith('/font-manifests.process.json') for name in uploaded))
    def test_font_workflow_event_refusal_precedes_source_and_package_edges(self):
        for key,replacement in (('GITHUB_RUN_ATTEMPT','2'),('GITHUB_JOB','inventory'),('BW_EXPECTED_HEAD','f'*40),('GITHUB_ACTOR','foreign')):
            with self.font_discovery_edges() as (request,env,events):
                env[key]=replacement;value=c.collect_font_discovery(request,H(request),pathlib.Path('/checkout'),env,'/out/fonts.json')
            self.assertIsNotNone(value['firstFailure']);self.assertFalse(value['complete']);self.assertFalse(value['sourceCommands']);self.assertFalse(value['commands'])
            self.assertFalse(any(op in ('git','probe') for op,arg in events))

    def font_delivery_fixture(self,partial=False):
        value,request_raw,old_expected,events=self.font_discovery_fixture(partial=partial);request=D(request_raw)
        # A manufactured executing workflow selection, distinct from its
        # source commit. It is never an official event or activation evidence.
        workflow=(root/'.github/workflows/i80386-hdd-gui-actual.yml').read_bytes()
        prefix,job=workflow.split(b'\n  font-discovery:\n');self.assertIn(b'$'+b'{{ true &&',job);self.assertNotIn(b'$'+b'{{ false &&',job)
        request['source']['files'][r.FONT_WORKFLOW_PATH]=ROW(workflow);request_raw=E(request)
        value['request']=c.font_blob(request_raw);event=D(base64.b64decode(value['event']['base64']));event['pull_request']['body']='<!-- BW_GUI_HDD_FONT_DISCOVERY_SHA256='+H(request_raw)+' -->';value['event']=c.font_blob(E(event))
        files={name:b'' for name in ('guard.stdout','guard.stderr','npm.stdout','npm.stderr','chromium-install.stdout','chromium-install.stderr','input-install.stdout','input-install.stderr','controller.stdout','controller.stderr')}
        files['request.json']=request_raw;files['input-install.stdout']=E(dict(ROW(request_raw),gitBlob=hashlib.sha1(b'blob '+str(len(request_raw)).encode()+b'\0'+request_raw).hexdigest()))
        ordinal=0
        def raw_process(argv,stdout,stderr=b''):
            nonlocal ordinal
            ordinal+=1;pid=1000+ordinal;process=proc(argv,stdout,stderr,c.clean_env(),seconds=.001)
            process['identity'].update(pid=pid,pgid=pid,sessionId=pid,parentPid=900,state='S')
            process.update(startedNs=ordinal*10000000,endedNs=ordinal*10000000+1000);return process
        for index,command in enumerate(value['sourceCommands']):
            if index<2:stdout=(request['source']['head' if index==0 else 'tree']+'\n').encode()
            else:
                path=sorted(r.SOURCE)[index-2];stdout=workflow if path==r.FONT_WORKFLOW_PATH else ('source:'+path).encode()
            command['stdout']=ROW(stdout);process=raw_process(command['argv'],stdout)
            for suffix,raw in (('stdout',stdout),('stderr',b''),('process.json',E(process))):files[r.FONT_PROCESS_ROOT+'git-'+str(index)+'.'+suffix]=raw
        for command in value['commands']:
            stdout=base64.b64decode(command['stdout']['base64']);stderr=base64.b64decode(command['stderr']['base64']);process=raw_process(command['argv'],stdout,stderr)
            if command['process']['firstFailure'] is not None:
                process.update(exitCode=1,firstFailure='child nonzero exit');value['firstFailure']['message']='child nonzero exit'
            command['process']=process
            for suffix,raw in (('stdout',stdout),('stderr',stderr),('process.json',E(process))):files[r.FONT_PROCESS_ROOT+command['role']+'.'+suffix]=raw
        files['font-discovery-original.json']=E(value);archive=zip_(files);blob=hashlib.sha1(b'blob '+str(len(workflow)).encode()+b'\0'+workflow).hexdigest()
        expected={'schema':'bw.gui-hdd.font-discovery-delivery-expectation.v1','source':request['source'],'request':ROW(request_raw),'archive':ROW(archive),
          'runId':200,'jobId':201,'artifactId':202,'prNumber':123,'workflow':{'commit':'d'*40,'base':'e'*40,'tree':'f'*40,'blob':blob,**ROW(workflow)}}
        proof=E({'schema':'bw.gui-hdd.workflow-api-proof.v1','commit':c.font_blob(E({'sha':'d'*40,'tree':{'sha':'f'*40},'parents':[{'sha':'e'*40},{'sha':'a'*40}]})),
          'tree':c.font_blob(E({'sha':'f'*40,'truncated':False,'tree':[{'path':r.FONT_WORKFLOW_PATH,'type':'blob','mode':'100644','sha':blob,'size':len(workflow)}]}))})
        run={'id':200,'run_attempt':1,'head_sha':'a'*40,'event':'pull_request','repository':{'full_name':r.REPOSITORY},'head_repository':{'full_name':r.REPOSITORY,'fork':False},
          'actor':{'login':'CrispStrobe'},'triggering_actor':{'login':'CrispStrobe'},'path':r.FONT_WORKFLOW_PATH,'status':'in_progress','conclusion':None,'pull_requests':[{'number':123,'head':{'sha':'9'*40}}]}
        names=['Run actions/checkout@11d5960a326750d5838078e36cf38b85af677262','Refuse unreviewed discovery before setup or input retrieval',
          'Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020','Install unchanged selected packages and Chromium for font observation',
          'Install externally selected immutable discovery request','Record bounded read-only font discovery without credentials','Run actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']
        job={'id':201,'run_id':200,'run_attempt':1,'head_sha':'a'*40,'runner_id':300,'runner_name':'Manufactured hosted runner','labels':['ubuntu-24.04'],'name':'font-discovery','status':'completed','conclusion':'failure' if partial else 'success',
          'started_at':'2026-10-18T00:00:00Z','completed_at':'2026-10-18T00:01:00Z','steps':[
          {'number':index+1,'name':name,'status':'completed','conclusion':'failure' if partial and index==5 else 'success',
          'started_at':'2026-10-18T00:00:'+str(index*2).zfill(2)+'Z','completed_at':'2026-10-18T00:00:'+str(index*2+1).zfill(2)+'Z'} for index,name in enumerate(names)]}
        artifact={'total_count':1,'artifacts':[{'id':202,'name':'i80386-hdd-gui-font-discovery-200-1','expired':False,'size_in_bytes':len(archive),'digest':'sha256:'+H(archive),'workflow_run':{'id':200,'head_sha':'a'*40}}]}
        metadata={'run':E(run),'job':E(job),'artifact':E(artifact),'workflowProof':proof};expected['metadata']={key:ROW(raw) for key,raw in metadata.items()}
        return files,request_raw,expected,metadata,workflow
    def font_workflow_v2(self,proof):
        import zlib
        def packed(row):
            raw=base64.b64decode(row['base64']);compressed=zlib.compress(raw)
            return {'codec':'zlib','original':ROW(raw),'compressed':dict(ROW(compressed),base64=base64.b64encode(compressed).decode())}
        return E({'schema':'bw.gui-hdd.workflow-api-proof.v2',**{key:packed(proof[key]) for key in ('commit','tree')}})
    def test_font_workflow_v2_large_api_original_and_legacy_full_delivery_equivalence(self):
        files,request,expected,metadata,workflow=self.font_delivery_fixture();archive=self.rebind_font_delivery(files,expected,metadata)
        old_proof=metadata['workflowProof'];old_expected=copy.deepcopy(expected);legacy=r.verify_font_delivery(archive,request,expected,metadata,workflow)
        metadata['workflowProof']=self.font_workflow_v2(D(old_proof));expected['metadata']['workflowProof']=ROW(metadata['workflowProof'])
        self.assertEqual(r.verify_font_delivery(archive,request,expected,metadata,workflow),legacy)
        self.assertEqual(D(old_proof)['schema'],'bw.gui-hdd.workflow-api-proof.v1')
        self.assertEqual(r.verify_font_delivery(archive,request,old_expected,dict(metadata,workflowProof=old_proof),workflow),legacy)
        proof=D(old_proof);tree=D(base64.b64decode(proof['tree']['base64']))
        # Manufactured ordinary recursive API entries, not retained official
        # metadata. Their varied paths/blob hashes exercise the real size gap.
        for index in range(12056):
            h=hashlib.sha256(str(index).encode()).hexdigest()[:40]
            tree['tree'].append({'path':'manufactured/'+h+'/'+str(index),'mode':'100644','type':'blob','sha':h,'size':index+1,
              'url':'https://api.github.com/repos/CrispStrobe/brickwright-lite/git/blobs/'+h})
        raw=E(tree);self.assertTrue(3330000<len(raw)<3400000);self.assertEqual(len(tree['tree']),12057)
        proof['tree']=dict(ROW(raw),base64=base64.b64encode(raw).decode());unpacked=E(proof)
        self.assertGreater(len(unpacked),r.JSON_CAP)
        with self.assertRaisesRegex(ValueError,'bounded JSON original'):r.decode(unpacked)
        metadata['workflowProof']=self.font_workflow_v2(proof);self.assertLess(len(metadata['workflowProof']),r.JSON_CAP)
        expected['metadata']['workflowProof']=ROW(metadata['workflowProof'])
        self.assertEqual(r.font_workflow_api_original(D(metadata['workflowProof'])['tree'],'bw.gui-hdd.workflow-api-proof.v2'),raw)
        self.assertEqual(r.verify_font_delivery(archive,request,expected,metadata,workflow),legacy)
    def test_font_workflow_v2_offline_cli_and_failed_partial_legacy_equivalence(self):
        for partial in (False,True):
            files,request,expected,metadata,workflow=self.font_delivery_fixture(partial);archive=self.rebind_font_delivery(files,expected,metadata)
            legacy=r.verify_font_delivery(archive,request,expected,metadata,workflow)
            metadata['workflowProof']=self.font_workflow_v2(D(metadata['workflowProof']));expected['metadata']['workflowProof']=ROW(metadata['workflowProof'])
            mapping={'/archive':archive,'/request':request,'/expected':E(expected),'/workflow':workflow,**{'/'+key:raw for key,raw in metadata.items()}}
            def read(path,cap):self.assertLessEqual(len(mapping[path]),cap);return mapping[path]
            args=['--font-discovery-delivery','/archive','--request','/request','--expected','/expected','--run','/run','--job','/job','--artifact','/artifact','--workflow-proof','/workflowProof','--workflow','/workflow']
            with patch.object(r,'bounded_input',read),patch.object(r.sys,'stdout',io.StringIO()) as stdout:self.assertEqual(r.main(args),0)
            self.assertEqual(D(stdout.getvalue().encode()),legacy);self.assertEqual(legacy['producingConclusion'],'failure' if partial else 'success')
            self.assertFalse(legacy['candidate']);self.assertFalse(legacy['qualified']);self.assertFalse(legacy['activeFontSelectionProved'])
    def test_font_workflow_v2_coherent_compression_refusals(self):
        import zlib
        files,request,expected,metadata,workflow=self.font_delivery_fixture();base=D(self.font_workflow_v2(D(metadata['workflowProof'])))
        def blob(raw):return dict(ROW(raw),base64=base64.b64encode(raw).decode())
        for cut in ('schema','codec','extra','extra-original','extra-compressed','bool-length','float-length','oversize-original','oversize-compressed',
          'under-length','over-length','wrong-original-hash','wrong-compressed-hash','compressed-extent','noncanonical-base64','malformed','truncated','trailing','multistream','bomb','duplicate-json'):
            proof=copy.deepcopy(base);row=proof['tree'];compressed=base64.b64decode(row['compressed']['base64']);raw=zlib.decompress(compressed)
            if cut=='schema':proof['schema']='bw.gui-hdd.workflow-api-proof.v3'
            elif cut=='codec':row['codec']='gzip'
            elif cut=='extra':row['verified']=True
            elif cut=='extra-original':row['original']['base64']=base64.b64encode(raw).decode()
            elif cut=='extra-compressed':row['compressed']['verified']=True
            elif cut=='bool-length':row['original']['byteLength']=True
            elif cut=='float-length':row['original']['byteLength']=float(len(raw))
            elif cut=='oversize-original':row['original']['byteLength']=r.JSON_CAP+1
            elif cut=='oversize-compressed':row['compressed']['byteLength']=r.JSON_CAP+1
            elif cut=='under-length':row['original']['byteLength']-=1
            elif cut=='over-length':row['original']['byteLength']+=1
            elif cut=='wrong-original-hash':row['original']['sha256']='0'*64
            elif cut=='wrong-compressed-hash':row['compressed']['sha256']='0'*64
            elif cut=='compressed-extent':row['compressed']['byteLength']+=1
            elif cut=='noncanonical-base64':row['compressed']['base64']+='\n'
            elif cut=='malformed':row['compressed']=blob(b'not zlib')
            elif cut=='truncated':row['compressed']=blob(compressed[:-1])
            elif cut=='trailing':row['compressed']=blob(compressed+b'extra')
            elif cut=='multistream':row['compressed']=blob(compressed+zlib.compress(b'{}'))
            elif cut=='bomb':
                expanded=b'X'*(r.JSON_CAP+1);row['compressed']=blob(zlib.compress(expanded));row['original']=dict(ROW(expanded),byteLength=16)
            else:
                raw=b'{"sha":"f","sha":"f"}\n';row['original']=ROW(raw);row['compressed']=blob(zlib.compress(raw))
            encoded=E(proof);expected['metadata']['workflowProof']=ROW(encoded)
            with self.assertRaises(ValueError,msg=cut):r.font_delivery_workflow(encoded,workflow,expected)
    def test_font_workflow_v2_bounds_before_inflate_and_single_bounded_call(self):
        import zlib
        files,request,expected,metadata,workflow=self.font_delivery_fixture();proof=D(self.font_workflow_v2(D(metadata['workflowProof'])));row=proof['tree']
        for cut in ('oversize-original','oversize-compressed','bad-compressed-hash'):
            bad=copy.deepcopy(row)
            if cut=='oversize-original':bad['original']['byteLength']=r.JSON_CAP+1
            elif cut=='oversize-compressed':bad['compressed']['byteLength']=r.JSON_CAP+1
            else:bad['compressed']['sha256']='0'*64
            with patch.object(zlib,'decompressobj',side_effect=AssertionError('inflate must not start')) as inflater:
                with self.assertRaises(ValueError,msg=cut):r.font_workflow_api_original(bad,proof['schema'])
                inflater.assert_not_called()
        actual=zlib.decompressobj();limits=[]
        class BoundedInflater:
            def decompress(self,raw,limit):limits.append(limit);return actual.decompress(raw,limit)
            @property
            def eof(self):return actual.eof
            @property
            def unused_data(self):return actual.unused_data
            @property
            def unconsumed_tail(self):return actual.unconsumed_tail
        with patch.object(zlib,'decompressobj',return_value=BoundedInflater()):
            raw=r.font_workflow_api_original(row,proof['schema'])
        self.assertEqual(limits,[row['original']['byteLength']+1]);self.assertEqual(ROW(raw),row['original'])
    def rebind_font_delivery(self,files,expected,metadata):
        archive=zip_(files);expected['archive']=ROW(archive);artifact=D(metadata['artifact']);item=artifact['artifacts'][0] if 'artifacts' in artifact else artifact
        item.update(size_in_bytes=len(archive),digest='sha256:'+H(archive));metadata['artifact']=E(artifact);expected['metadata']={key:ROW(raw) for key,raw in metadata.items()};return archive
    def test_font_delivery_complete_official_envelope_and_cli_without_whole_run_success(self):
        files,request,expected,metadata,workflow=self.font_delivery_fixture();archive=self.rebind_font_delivery(files,expected,metadata)
        verdict=r.verify_font_delivery(archive,request,expected,metadata,workflow)
        self.assertTrue(verdict['complete']);self.assertEqual(verdict['producingConclusion'],'success');self.assertIsNone(verdict['firstFailure'])
        self.assertFalse(verdict['candidate']);self.assertFalse(verdict['qualified']);self.assertFalse(verdict['activeFontSelectionProved']);self.assertFalse(verdict['actualRequestSupported'])
        self.assertNotEqual(verdict['sourceHead'],verdict['workflowCommit'])
        mapping={'/archive':archive,'/request':request,'/expected':E(expected),'/workflow':workflow,**{'/'+key:raw for key,raw in metadata.items()}}
        def read(path,cap):self.assertLessEqual(len(mapping[path]),cap);return mapping[path]
        args=['--font-discovery-delivery','/archive','--request','/request','--expected','/expected','--run','/run','--job','/job','--artifact','/artifact','--workflow-proof','/workflowProof','--workflow','/workflow']
        with patch.object(r,'bounded_input',read),patch.object(r.sys,'stdout',io.StringIO()) as stdout:self.assertEqual(r.main(args),0)
        self.assertEqual(D(stdout.getvalue().encode()),verdict)
    def test_font_delivery_failed_partial_retains_primary_and_cannot_promote(self):
        files,request,expected,metadata,workflow=self.font_delivery_fixture(True);archive=self.rebind_font_delivery(files,expected,metadata)
        verdict=r.verify_font_delivery(archive,request,expected,metadata,workflow)
        self.assertEqual(verdict['producingConclusion'],'failure');self.assertFalse(verdict['complete']);self.assertEqual(verdict['firstFailure']['message'],'child nonzero exit')
        job=D(metadata['job']);job['conclusion']='success';job['steps'][5]['conclusion']='success';metadata['job']=E(job);archive=self.rebind_font_delivery(files,expected,metadata)
        with self.assertRaisesRegex(ValueError,'successful producing job requires complete'):r.verify_font_delivery(archive,request,expected,metadata,workflow)
        files,request,expected,metadata,workflow=self.font_delivery_fixture();job=D(metadata['job']);job['conclusion']='failure';job['steps'][5]['conclusion']='failure';metadata['job']=E(job);archive=self.rebind_font_delivery(files,expected,metadata)
        with self.assertRaisesRegex(ValueError,'failed producing job retains'):r.verify_font_delivery(archive,request,expected,metadata,workflow)
    def test_font_delivery_coherent_official_metadata_and_workflow_refusals(self):
        for cut in ('run-id','run-float','run-head','repo','actor','job-id','job-queued','job-attempt','job-name','job-clock','step-type','step-order','step-status','artifact-id','artifact-head','artifact-name','artifact-expired','artifact-digest','artifact-size','pr-number','workflow-pin','workflow-parent','workflow-tree','workflow-path','workflow-mode','workflow-blob','workflow-truncated','triggering-actor','runner-id','runner-name','runner-label','parent-order'):
            files,request,expected,metadata,workflow=self.font_delivery_fixture();run=D(metadata['run']);job=D(metadata['job']);artifact=D(metadata['artifact']);item=artifact['artifacts'][0];proof=D(metadata['workflowProof']);commit=D(base64.b64decode(proof['commit']['base64']));tree=D(base64.b64decode(proof['tree']['base64']))
            if cut=='run-id':run['id']+=1
            elif cut=='run-float':run['id']=float(run['id'])
            elif cut=='run-head':run['head_sha']='9'*40
            elif cut=='repo':run['repository']['full_name']='foreign/repo'
            elif cut=='actor':run['actor']['login']='foreign'
            elif cut=='job-id':job['id']+=1
            elif cut=='job-queued':job['status']='queued'
            elif cut=='job-attempt':job['run_attempt']=True
            elif cut=='job-name':job['name']='actual'
            elif cut=='job-clock':job['completed_at']='2026-10-17T23:59:00Z'
            elif cut=='step-type':job['steps'][0]['number']=True
            elif cut=='step-order':job['steps'][0],job['steps'][1]=job['steps'][1],job['steps'][0]
            elif cut=='step-status':job['steps'][4]['conclusion']='failure'
            elif cut=='artifact-id':item['id']+=1
            elif cut=='artifact-head':item['workflow_run']['head_sha']='9'*40
            elif cut=='artifact-name':item['name']='i80386-hdd-gui-200-1'
            elif cut=='artifact-expired':item['expired']=True
            elif cut=='artifact-digest':item['digest']='sha256:'+'0'*64
            elif cut=='artifact-size':item['size_in_bytes']=float(item['size_in_bytes'])
            elif cut=='pr-number':run['pull_requests'][0]['number']=124
            elif cut=='workflow-pin':workflow+=b'\n'
            elif cut=='workflow-parent':commit['parents'][1]['sha']='9'*40
            elif cut=='workflow-tree':tree['sha']='9'*40
            elif cut=='workflow-path':tree['tree'][0]['path']='.github/workflows/foreign.yml'
            elif cut=='workflow-mode':tree['tree'][0]['mode']='100755'
            elif cut=='workflow-blob':tree['tree'][0]['sha']='9'*40
            elif cut=='workflow-truncated':tree['truncated']=True
            elif cut=='triggering-actor':run['triggering_actor']['login']='foreign'
            elif cut=='runner-id':job['runner_id']=True
            elif cut=='runner-name':job['runner_name']=''
            elif cut=='runner-label':job['labels']=['ubuntu-latest']
            else:commit['parents'].reverse()
            proof.update(commit=c.font_blob(E(commit)),tree=c.font_blob(E(tree)));metadata.update(run=E(run),job=E(job),artifact=E(artifact),workflowProof=E(proof))
            # Preserve intentionally conflicting official artifact identity/size.
            archive=zip_(files);expected['metadata']={key:ROW(raw) for key,raw in metadata.items()}
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_delivery(archive,request,expected,metadata,workflow)
    def test_font_delivery_coherent_raw_stream_process_source_clock_refusals(self):
        for cut in ('source-summary','source-clock','source-raw','stream-float','stderr-bool','parent','identity-bool','process-extra','embedded','missing-triple','unknown-role','request','event-head','primary','self-parent','source-package-clock','cleared-primary','sample-order','sample-duplicate','terminal-duplicate'):
            files,request,expected,metadata,workflow=self.font_delivery_fixture(partial=cut in ('primary','cleared-primary','terminal-duplicate'));value=D(files['font-discovery-original.json']);role=r.FONT_PROCESS_ROOT+'git-0';process=D(files[role+'.process.json'])
            if cut=='source-summary':value['sourceCommands'][0]['stdout']['sha256']='0'*64
            elif cut=='source-clock':process['startedNs']=process['endedNs']+1
            elif cut=='source-raw':files[role+'.stdout']=b'wrong source\n';process['streams']['stdout']=ROW(files[role+'.stdout'])
            elif cut=='stream-float':process['streams']['stdout']['byteLength']=float(process['streams']['stdout']['byteLength'])
            elif cut=='stderr-bool':process['streams']['stderr']['byteLength']=False
            elif cut=='parent':process['identity']['parentPid']+=1
            elif cut=='identity-bool':process['identity']['startTicks']=True
            elif cut=='process-extra':process['invented']=True
            elif cut=='embedded':value['commands'][0]['process']['identity']['pid']+=1
            elif cut=='missing-triple':files.pop(r.FONT_PROCESS_ROOT+'git-1.stderr')
            elif cut=='unknown-role':files['unexpected.json']=b'{}'
            elif cut=='request':files['request.json']=b'{}\n'
            elif cut=='event-head':
                event=D(base64.b64decode(value['event']['base64']));event['pull_request']['head']['sha']='9'*40;value['event']=c.font_blob(E(event))
            elif cut=='primary':value['firstFailure']['message']='INVENTED_PRIMARY'
            elif cut=='self-parent':process['identity']['parentPid']=process['identity']['pid']
            elif cut=='source-package-clock':
                for index,command in enumerate(value['commands']):
                    command['process'].update(startedNs=index*10000000+1,endedNs=index*10000000+1000)
                    files[r.FONT_PROCESS_ROOT+command['role']+'.process.json']=E(command['process'])
            elif cut=='cleared-primary':
                command=value['commands'][-1];command['process']['firstFailure']=None;files[r.FONT_PROCESS_ROOT+command['role']+'.process.json']=E(command['process'])
            elif cut=='sample-order':process['descendantSamples']=[{'atNs':process['endedNs'],'descendants':[]},{'atNs':process['startedNs'],'descendants':[]}]
            elif cut=='sample-duplicate':process['descendantSamples']=[{'atNs':process['startedNs'],'descendants':[copy.deepcopy(process['identity']),copy.deepcopy(process['identity'])]}]
            elif cut=='terminal-duplicate':
                command=value['commands'][-1];command['process']['remainingDescendants']=[copy.deepcopy(command['process']['identity']),copy.deepcopy(command['process']['identity'])];files[r.FONT_PROCESS_ROOT+command['role']+'.process.json']=E(command['process'])
            files[role+'.process.json']=E(process);files['font-discovery-original.json']=E(value);archive=self.rebind_font_delivery(files,expected,metadata)
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_delivery(archive,request,expected,metadata,workflow)
    def test_font_delivery_zip_preinflate_role_caps_and_early_missing_refuse(self):
        files,request,expected,metadata,workflow=self.font_delivery_fixture()
        for cut in ('unknown','duplicate','symlink','special','encrypted','oversize','path','early','missing-original','nul','directory-payload'):
            data=io.BytesIO()
            with zipfile.ZipFile(data,'w',compression=zipfile.ZIP_STORED) as archive:
                for name,raw in files.items():
                    if cut=='early' and name not in ('guard.stdout','guard.stderr'):continue
                    if cut=='missing-original' and name=='font-discovery-original.json':continue
                    if cut=='nul' and name=='guard.stdout':name='guard.stdoutXjunk'
                    if cut=='oversize' and name=='controller.stdout':raw=b'x'*16385
                    info=zipfile.ZipInfo(name)
                    if cut in ('symlink','special') and name=='guard.stdout':info.external_attr=(stat.S_IFLNK|0o777 if cut=='symlink' else stat.S_IFIFO|0o600)<<16
                    archive.writestr(info,raw)
                if cut in ('unknown','duplicate','path','directory-payload'):
                    name='unexpected' if cut=='unknown' else 'guard.stdout' if cut=='duplicate' else '../escape' if cut=='path' else r.FONT_PROCESS_ROOT
                    archive.writestr(name,b'x')
            raw=data.getvalue()
            if cut=='nul':raw=raw.replace(b'guard.stdoutXjunk',b'guard.stdout\x00junk')
            if cut=='encrypted':
                raw=bytearray(raw);at=raw.find(b'PK\x01\x02');raw[at+8:at+10]=(1).to_bytes(2,'little');raw=bytes(raw)
            with patch.object(r.zipfile.ZipFile,'read',side_effect=AssertionError('must refuse full census before inflate')):
                with self.assertRaises(ValueError,msg=cut):r.font_delivery_archive(raw)

    def test_font_enabled_default_guard_has_no_edges_and_no_actual_authority(self):
        self.assertIs(c.FONT_DISCOVERY_ENABLED,True);self.assertIs(c.ACTUAL_ENABLED,False);self.assertIs(r.ACTUAL_ENABLED,False)
        with patch.object(c,'regular',side_effect=AssertionError('guard read input')),patch.object(c,'Hosted',side_effect=AssertionError('guard API/process')),\
          patch.object(c,'Originals',side_effect=AssertionError('guard evidence setup')),patch.object(c,'install_input',side_effect=AssertionError('guard input retrieval')),\
          patch.object(c,'collect_font_discovery',side_effect=AssertionError('guard collection')),patch.object(c.Path,'cwd',side_effect=AssertionError('guard cwd')),\
          patch.object(c.os,'open',side_effect=AssertionError('guard opened file')):
            self.assertEqual(c.main(['font-discovery-guard']),0)
            for mode in ('guard','preflight','actual'):
                with self.assertRaisesRegex(ValueError,'GUI actual disabled'):c.main([mode])
    def test_font_enabled_collection_still_refuses_wrong_request_and_source(self):
        for cut in ('wrong-pin','noncanonical','wrong-schema','source-drift'):
            with self.font_discovery_edges() as (request,env,events):
                value=D(request)
                if cut=='wrong-schema':value['schema']='bw.gui-hdd.actual-request.v4'
                if cut=='source-drift':value['source']['files'][sorted(c.SOURCE)[0]]['sha256']='0'*64
                request=E(value)+(b' ' if cut=='noncanonical' else b'');pin='0'*64 if cut=='wrong-pin' else H(request);previous=c.regular
                def read(path,cap):
                    raw=previous(path,cap)
                    if str(path)=='/event':
                        event=D(raw);event['pull_request']['body']='<!-- BW_GUI_HDD_FONT_DISCOVERY_SHA256='+pin+' -->';return E(event)
                    return raw
                with patch.object(c,'regular',read):observed=c.collect_font_discovery(request,pin,pathlib.Path('/checkout'),env,'/out/fonts.json')
            self.assertIsNotNone(observed['firstFailure'],cut);self.assertFalse(observed['complete']);self.assertFalse(observed['candidate']);self.assertFalse(observed['qualified'])
            self.assertFalse(observed['commands']);self.assertFalse(observed['directories']);self.assertFalse(any(op=='probe' for op,arg in events))
            if cut=='source-drift':
                self.assertIn('discovery source Git/live/external join',observed['firstFailure']['message']);self.assertTrue(any(op=='git' for op,arg in events))
            else:self.assertFalse(events)

    @contextlib.contextmanager
    def font_chain_edges(self,two=True,cut=None,actual_sources=False):
        entry='/usr/share/fonts/entry.ttf';bridge='/etc/alternatives/choice.ttf';terminal='/usr/share/fonts/family/end.ttf'
        links={entry:bridge if two else terminal}
        if two:links[bridge]=terminal
        if cut=='escape':links[bridge]='/etc/passwd'
        if cut=='cycle':links[bridge]=entry
        if cut=='hop':links={entry:bridge,**{'/etc/alternatives/'+str(i):'/etc/alternatives/'+str(i+1) for i in range(12)}};links[bridge]='/etc/alternatives/0'
        if cut=='wrong-intermediate':links[entry]='/etc/alternatives/nested/choice.ttf'
        source=D(self.files['source.before.json']);selected={path:(root/path).read_bytes() if actual_sources else ('source:'+path).encode() for path in sorted(c.SOURCE)};source['files']={path:ROW(raw) for path,raw in selected.items()};baseline={'schema':'bw.gui-hdd.inventory-template.v3','files':['/etc/fonts/conf.avail/missing.conf'],'aliases':[]}
        request=E({'schema':'bw.gui-hdd.font-chain-request.v1','source':source,'baseline':c.font_blob(E(baseline)),'entry':entry})
        env={'GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'font-chain','GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_WORKFLOW_REF':r.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@refs/pull/123/merge','BW_EXPECTED_HEAD':source['head'],'GITHUB_EVENT_PATH':'/event'}
        event={'action':'labeled','label':{'name':'x86-hdd-gui-font-chain'},'sender':{'login':'CrispStrobe'},'repository':{'full_name':r.REPOSITORY},'number':123,'pull_request':{'number':123,'state':'open','head':{'sha':source['head'],'repo':{'full_name':r.REPOSITORY,'fork':False}},'base':{'ref':'main','repo':{'full_name':r.REPOSITORY}},'body':'<!-- BW_GUI_HDD_FONT_CHAIN_SHA256='+H(request)+' -->'}}
        if cut=='event':event['label']['name']='x86-hdd-gui-font-discovery'
        store={'/request':request,'/event':E(event)};fdpaths={};at={};events=[];counts={}
        def info(path):
            path=str(path);counts[path]=counts.get(path,0)+1
            if path in links:mode=stat.S_IFLNK|0o777;size=len(links[path])
            elif path=='/usr/bin/git':mode=stat.S_IFREG|0o755;size=9
            elif path==terminal:mode=(stat.S_IFDIR if cut=='directory' else stat.S_IFIFO if cut=='fifo' else stat.S_IFREG)|0o644;size=9
            else:mode=stat.S_IFDIR|0o755;size=4096
            uid=1000 if cut=='terminal-owner' and path==terminal and counts[path]>1 else 0
            if cut=='parent-write' and path=='/usr/share/fonts' or cut=='terminal-parent-write' and path=='/usr/share/fonts/family':mode|=0o022
            if cut=='link-swap' and path==bridge and counts[path]>1:mode=stat.S_IFDIR|0o755
            values={'dev':1,'ino':sum(path.encode())+10,'mode':mode,'uid':uid,'gid':0,'nlink':1,'size':size,'mtime_ns':-2}
            if cut=='drift' and path==bridge and counts[path]>3:values['ino']+=1
            return SimpleNamespace(**{'st_'+k:v for k,v in values.items()})
        def open_(path,flags):
            path=str(path);events.append(('open',path));fd=100+len(fdpaths);fdpaths[fd]=path;at[fd]=0
            if path in links:self.assertEqual(flags,os.O_PATH|os.O_NOFOLLOW)
            elif path not in (terminal,'/usr/bin/git'):self.assertTrue(flags&os.O_DIRECTORY)
            if cut=='open' and path==terminal:raise OSError('OPEN_FIRST')
            return fd
        def read_(fd,count):
            if cut=='read-close' and fdpaths[fd]==terminal:raise OSError('READ_FIRST')
            data=b'fontbytes'[at[fd]:at[fd]+count];at[fd]+=len(data);return data
        def close_(fd):
            events.append(('close',fdpaths[fd]))
            if cut in ('close','read-close') and fdpaths[fd]==terminal or cut=='link-read-close' and fdpaths[fd]==bridge:raise OSError('CLOSE_SECOND')
        def regular_(path,cap):
            path=str(path);data=store.get(path)
            if data is None and path.startswith('/checkout/'):data=selected[path[len('/checkout/'):]]
            if cut=='live-source' and path.startswith('/checkout/'):data=b'wrong'
            if cut=='git-retention' and path.endswith('git-0.stdout'):raise OSError('RETAIN_SECOND')
            self.assertIsNotNone(data,path);self.assertLessEqual(len(data),cap);return data
        class Output:
            def __init__(self,path):self.root=pathlib.Path(path);self.files={}
            def save(self,name,data):store[str(self.root/name)]=data;self.files[name]=ROW(data)
        class Edge:
            def __init__(self,root,output,env):self.output=output;self.attempts=[];self.deadline=10**20
            def git(self,args):
                role='git-'+str(len(self.attempts));self.attempts.append(role);events.append(('git',role))
                data=(source['head' if args[1]=='HEAD' else 'tree']+'\n').encode() if args[0]=='rev-parse' else selected[args[2].split(':',1)[1]]
                argv=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']+args
                process=proc(argv,data,b'',c.clean_env(),seconds=.001);process['identity'].update(parentPid=900,state='S')
                if cut=='git-retention':process.update(exitCode=1,firstFailure='GIT_FIRST')
                for suffix,raw in (('stdout',data),('stderr',b''),('process.json',E(process))):self.output.save(role+'.'+suffix,raw)
                if cut=='git-retention':raise OSError('GIT_FIRST')
                return data
            def run(self,*args):raise AssertionError('no package/native probe in passive chain')
        class Writer:
            def __init__(self,path,mode):self.path=str(path);self.data=b'';self.assert_mode=mode
            def write(self,data):self.data+=data;return len(data)
            def close(self):store[self.path]=self.data
        def pathopen(path,mode):self.assertEqual(mode,'xb');self.assertNotIn(str(path),store);return Writer(path,mode)
        def readlink(path,dir_fd=None):
            self.assertEqual(path,'')
            if cut=='link-read-close' and fdpaths[dir_fd]==bridge:raise OSError('LINK_READ_FIRST')
            target=links[fdpaths[dir_fd]]
            return target+'x' if cut=='link-text' and counts.get(fdpaths[dir_fd],0)>2 else target
        with patch.object(c.Path,'cwd',return_value=pathlib.Path('/checkout')),patch.object(c,'FONT_CHAIN_ENABLED',True),patch.dict(c.os.environ,env,clear=True),patch.object(c,'Originals',Output),patch.object(c,'Hosted',Edge),patch.object(c,'regular',regular_),patch.object(c.Path,'lstat',lambda path:info(path)),patch.object(c.Path,'resolve',lambda path,strict=True:path),patch.object(c.Path,'exists',lambda path:str(path) in store),patch.object(c.Path,'open',pathopen),patch.object(c.os,'readlink',readlink),patch.object(c.os,'open',open_),patch.object(c.os,'read',read_),patch.object(c.os,'fstat',lambda fd:info(fdpaths[fd])),patch.object(c.os,'close',close_):
            yield request,env,events,store
    def chain_fixture(self,**kw):
        with self.font_chain_edges(**kw) as (request,env,events,store):
            status=c.main(['font-chain','--request','/request','--expected-sha256',H(request),'--output','/out/chain.json'])
            raw=store['/out/chain.json']
        expected={'schema':'bw.gui-hdd.font-chain-expectation.v1','source':D(request)['source'],'request':ROW(request),'original':ROW(raw),'runId':200,'workflowSha':'d'*40}
        return D(raw),request,expected,events,status
    def test_font_chain_real_cli_direct_twohop_and_reader_cli(self):
        for two in (False,True):
            value,request,expected,events,status=self.chain_fixture(two=two);self.assertEqual(status,0,value['firstFailure']);self.assertEqual(len(value['links']),2 if two else 1)
            verdict=r.verify_font_chain(E(value),request,expected);self.assertTrue(verdict['complete']);self.assertFalse(verdict['qualified']);self.assertFalse(verdict['sourceRuntimeObserved'])
            inputs={'/original':E(value),'/request':request,'/expected':E(expected)};out=io.StringIO()
            with patch.object(r,'bounded_input',lambda path,cap:inputs[path]),contextlib.redirect_stdout(out):
                self.assertEqual(r.main(['--font-chain','/original','--request','/request','--expected','/expected']),0)
            self.assertEqual(D(out.getvalue().encode()),verdict);self.assertEqual(value['commands'],[]);self.assertIsNone(value['packages'])
    def test_font_chain_disabled_guard_has_no_io_or_output(self):
        with patch.object(c,'regular',side_effect=AssertionError('input')),patch.object(c.Path,'cwd',side_effect=AssertionError('cwd')),patch.object(c,'collect_font_chain',side_effect=AssertionError('collector')):
            for mode in ('font-chain','font-chain-guard'):
                with self.assertRaisesRegex(ValueError,'font chain disabled'):c.main([mode])
        self.assertFalse(c.FONT_CHAIN_ENABLED);self.assertFalse(c.ACTUAL_ENABLED);self.assertTrue(c.FONT_DISCOVERY_ENABLED)
    def test_font_chain_failed_os_paths_keep_first_failure_no_probes(self):
        for cut in ('escape','cycle','hop','wrong-intermediate','directory','fifo','drift','link-swap','link-read-close','parent-write','terminal-owner','open','close','read-close','live-source','git-retention'):
            value,request,expected,events,status=self.chain_fixture(cut=cut);self.assertEqual(status,1,cut);self.assertIsNotNone(value['firstFailure'],cut);self.assertFalse(value['complete']);self.assertEqual(value['commands'],[])
            if cut=='link-read-close':self.assertEqual(value['firstFailure']['message'],'LINK_READ_FIRST');self.assertEqual(value['secondary'][0]['message'],'CLOSE_SECOND')
            if cut=='read-close':self.assertEqual(value['firstFailure']['message'],'READ_FIRST');self.assertEqual(value['secondary'][0]['message'],'CLOSE_SECOND')
            if cut=='git-retention':self.assertEqual(value['firstFailure']['message'],'GIT_FIRST');self.assertEqual(value['secondary'][0]['message'],'RETAIN_SECOND')
            # Failed source/event admission has no valid inner-original join yet.
            if cut not in ('live-source','git-retention'):self.assertFalse(r.verify_font_chain(E(value),request,expected)['complete'])
    def test_font_chain_independent_coherent_semantic_refusals(self):
        for cut in ('version','field','bool','float','kind','first','terminal','escape','cycle','parent-omit','parent-write','link-text','link-drift','file-eof','file-hash','file-size','file-close','source','event','packages','hop'):
            value,request,expected,events,status=self.chain_fixture()
            if cut=='version':value['schema']='bw.gui-hdd.font-chain-original.v2'
            elif cut=='field':value['selfApproved']=True
            elif cut=='bool':value['links'][0]['namedBefore']['uid']=False
            elif cut=='float':value['links'][0]['namedBefore']['uid']=0.0
            elif cut=='kind':value['links'][0]['kind']='directory-alias'
            elif cut=='first':value['links'][0]['path']='/usr/share/fonts/other.ttf'
            elif cut=='terminal':value['terminal']['path']='/usr/share/fonts/other.ttf'
            elif cut=='escape':value['links'][1]['linkBefore']=value['links'][1]['linkAfter']='/etc/passwd'
            elif cut=='cycle':value['links'][1]['linkBefore']=value['links'][1]['linkAfter']=value['links'][0]['path']
            elif cut=='parent-omit':value['parents'].pop(0)
            elif cut=='parent-write':
                for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):value['parents'][0][key]['mode']|=0o022
            elif cut=='link-text':value['links'][0]['linkAfter']+='x'
            elif cut=='link-drift':value['links'][0]['heldAfter']['ino']+=1
            elif cut=='file-eof':value['terminal']['observation']['file']['eof']=False
            elif cut=='file-hash':value['terminal']['observation']['file']['sha256']='invalid'
            elif cut=='file-size':value['terminal']['observation']['file']['byteLength']+=1
            elif cut=='file-close':value['terminal']['observation']['close']['succeeded']=False
            elif cut=='source':value['sourceCommands'].pop()
            elif cut=='event':
                event=D(base64.b64decode(value['event']['base64']));event['label']['name']='x86-hdd-gui-font-discovery';value['event']=c.font_blob(E(event))
            elif cut=='packages':value['packages']={}
            elif cut=='hop':value['links']*=5
            expected['original']=ROW(E(value))
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_chain(E(value),request,expected)
    def test_font_chain_failed_suffix_terminal_and_role_counterexamples(self):
        # Coherently re-pinned packets reproduce the independent review's
        # accepted failed suffix/escape and irrelevant role-field counterexamples.
        for cut in ('failed-suffix-garbage','failed-suffix-typed','failed-missing-link-terminal','failed-invalid-next-suffix','failed-invalid-next-typed','failed-terminal-escape','irrelevant-terminal-original','irrelevant-tool-original'):
            value,request,expected,events,status=self.chain_fixture(cut='escape' if cut in ('failed-invalid-next-suffix','failed-invalid-next-typed') else None)
            if cut.startswith('failed'):
                value['complete']=False;value['firstFailure']={'phase':'chain','path':None,'name':'ValueError','message':'retained failure'}
            if cut=='failed-suffix-garbage':
                value['links'][0]['linkBefore']=None;value['links'][1]={'completelyUnvalidatedSuffix':True}
            elif cut=='failed-suffix-typed':value['links'][0]['linkBefore']=None;value['terminal']=None
            elif cut=='failed-missing-link-terminal':value['links'][-1]['linkBefore']=None
            elif cut=='failed-invalid-next-suffix':value['links'].append({'completelyUnvalidatedSuffix':True})
            elif cut=='failed-invalid-next-typed':value['links'].append(copy.deepcopy(value['links'][-1]))
            elif cut=='failed-terminal-escape':value['terminal']['path']='/etc/passwd'
            elif cut=='irrelevant-terminal-original':value['terminal']['observation']['original']={'invented':True}
            else:value['tool']['original']={'invented':True}
            expected['original']=ROW(E(value))
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_chain(E(value),request,expected)

    def test_font_chain_failed_parent_ancestry_and_valid_prefixes(self):
        value,request,expected,events,status=self.chain_fixture(cut='close')
        extra=copy.deepcopy(value['parents'][0]);extra['path']='/home/secret';value['parents'].append(extra)
        expected['original']=ROW(E(value))
        with self.assertRaisesRegex(ValueError,'derived chain ancestry'):r.verify_font_chain(E(value),request,expected)
        # Parent refusal can precede the first link or occur after the last
        # derived hop but before any terminal/next-link row exists.
        for cut,count in (('parent-write',0),('terminal-parent-write',2)):
            value,request,expected,events,status=self.chain_fixture(cut=cut)
            self.assertEqual(status,1);self.assertEqual(len(value['links']),count);self.assertIsNone(value['terminal'])
            self.assertFalse(r.verify_font_chain(E(value),request,expected)['complete'])

    def test_font_chain_request_version_and_closed_selection(self):
        value,raw,expected,events,status=self.chain_fixture();request=D(raw)
        for cut in ('version','extra','entry','type'):
            changed=copy.deepcopy(request)
            if cut=='version':changed['schema']='bw.gui-hdd.font-discovery-request.v1'
            elif cut=='extra':changed['hopLimit']=100
            elif cut=='entry':changed['entry']='/etc/alternatives/choice.ttf'
            else:changed['entry']=True
            for module in (c,r):
                with self.assertRaises(ValueError,msg=cut):module.font_chain_request(E(changed),H(E(changed)))
    def test_font_chain_frame_and_deadline_prevent_kernel_work(self):
        for cut in ('frame','deadline'):
            with self.font_chain_edges() as (request,env,events,store):
                with patch.object(c,'JSON_CAP',(2<<20)+32) if cut=='frame' else patch.object(c.time,'monotonic',side_effect=[0,181]):
                    value=c.collect_font_chain(request,H(request),pathlib.Path('/checkout'),env,'/out/chain.json')
                self.assertIsNotNone(value['firstFailure']);self.assertFalse(value['complete']);self.assertFalse(events);self.assertFalse(value['commands'])

    def test_font_chain_actual_source21_extent_fits_held_frame_reserve(self):
        with self.font_chain_edges(actual_sources=True) as (request,env,events,store):
            self.assertEqual(c.main(['font-chain','--request','/request','--expected-sha256',H(request),'--output','/out/chain.json']),0)
            value=D(store['/out/chain.json']);selected=sum(row['byteLength'] for row in D(request)['source']['files'].values())
            self.assertGreater(selected,1400000);self.assertLess(len(E(value)),c.JSON_CAP-(2<<20))
            triples=[path for path in store if '-process-originals/' in path];self.assertEqual(len(triples),3*(len(c.SOURCE)+2))
            self.assertEqual(sum(len(store[path]) for path in triples if path.endswith('.stdout')),selected+82)
            expected={'schema':'bw.gui-hdd.font-chain-expectation.v1','source':D(request)['source'],'request':ROW(request),'original':ROW(E(value)),'runId':200,'workflowSha':'d'*40}
            self.assertTrue(r.verify_font_chain(E(value),request,expected)['complete'])
    def test_font_chain_critical_predicate_removal_mutations_detected(self):
        source=(root/'scripts/run-i80386-hdd-gui-actual.py').read_text()
        for old,new,method,cut in (
          ("need(target.startswith(FONT_CHAIN_ROOTS) or target.startswith('/etc/alternatives/'),'finite font or alternatives bridge')","need(True,'finite font or alternatives bridge')",'font_chain_next','escape'),
          ("need(not target.startswith('/etc/alternatives/') or target.count('/')==3,'single alternatives child')","need(True,'single alternatives child')",'font_chain_next','wrong-intermediate'),
          ("need(path not in seen,'chain cycle refused')","need(True,'chain cycle refused')",'collect_font_chain','cycle'),
          ("need(len(value['links'])<min(FONT_CHAIN_HOPS,256),'combined chain alias/hop cap')","need(True,'combined chain alias/hop cap')",'collect_font_chain','hop'),
          ("before.st_mode&0o6022==0 and Path(path).resolve(strict=True)==Path(path)","Path(path).resolve(strict=True)==Path(path)",'font_chain_witness','parent-write'),
          ("need(row['namedBefore']==row['heldBefore']==row['heldAfter']==row['namedAfter'],'stable chain witness readback')","need(True,'stable chain witness readback')",'font_chain_witness','drift'),
          ("need(kind=='link' and stat.S_ISLNK(before.st_mode),'typed chain symlink')","need(True,'typed chain symlink')",'font_chain_witness','link-swap'),
          ("else:source_error.font_chain_secondary=getattr(source_error,'font_chain_secondary',[])+[exc]","else:source_error=exc",'collect_font_chain','git-retention'),
          ("terminal_info['uid']==0 and not terminal_info['mode']&0o6022","True",'collect_font_chain','terminal-owner')
        ):
            self.assertIn(old,source);namespace={'__name__':'chain_mutant'};exec(compile(source.replace(old,new,1),'chain-mutant','exec'),namespace)
            # Other function globals must point at the mocked module kernel edges.
            function=namespace[method];function=type(function)(function.__code__,c.__dict__,function.__name__,function.__defaults__,function.__closure__)
            with patch.object(c,method,function):value,request,expected,events,status=self.chain_fixture(cut=cut)
            # Removing one fence either wrongly completes collection or changes
            # the actual refusal: the exact original gate must remain observable.
            with self.font_chain_edges(cut=cut) as (raw,env,ops,store):baseline=c.collect_font_chain(raw,H(raw),pathlib.Path('/checkout'),env,'/out/chain.json')
            self.assertNotEqual((status,value['firstFailure']),(1,baseline['firstFailure']),cut)

    def font_bridge_prior_fixture(self,large=False):
        value,request,expected,events=self.font_discovery_fixture()
        oldentry='/usr/share/fonts/truetype/prior.ttf';bridge='/etc/alternatives/choice.ttf'
        value.update(complete=False,commands=[],packages=None,firstFailure={'phase':'directory','path':str(pathlib.Path(oldentry).parent),'name':'ValueError','message':'font alias canonical allowed regular target'})
        parent=copy.deepcopy(value['directories']['/usr/share/fonts']);parent['entries']=['prior.ttf'];value['directories'][str(pathlib.Path(oldentry).parent)]=parent
        value['directories']['/usr/share/fonts']['entries'].append('truetype');value['directories']['/usr/share/fonts']['entries'].sort()
        info=copy.deepcopy(next(iter(value['aliases'].values()))['namedBefore']);info.update(mode=stat.S_IFLNK|0o777,size=len(bridge),uid=0)
        value['aliases'][oldentry]={'namedBefore':info,'namedAfter':copy.deepcopy(info),'linkText':bridge}
        if large:
            path='/etc/fonts/fonts.conf';row=value['files'][path];data=base64.b64decode(row['original']['base64']).replace(b'</fontconfig>',b' '*60000+b'</fontconfig>')
            row['original']=c.font_blob(data);row['file'].update(ROW(data))
            for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):row[key]['size']=len(data)
            event=D(base64.b64decode(value['event']['base64']));body=event['pull_request']['body']
            low,high=0,261000
            while low<high:
                mid=(low+high)//2;event['pull_request']['body']=body+' '*mid;value['event']=c.font_blob(E(event))
                if len(E(value))<446776:low=mid+1
                else:high=mid
            event['pull_request']['body']=body+' '*low;value['event']=c.font_blob(E(event));self.assertLessEqual(len(E(event)),256<<10);self.assertGreaterEqual(len(E(value)),446776)
        original=E(value);expected['original']=ROW(original)
        self.assertFalse(r.verify_font_discovery(original,request,expected)['complete'])
        return {'schema':'bw.gui-hdd.font-bridge-prior.v1','sourceEntry':oldentry,'request':c.font_blob(request),'original':c.font_blob(original),'expectation':expected}
    def font_bridge_fixture(self,cut=None,large=False):
        prior=self.font_bridge_prior_fixture(large)
        with self.font_chain_edges(actual_sources=large,cut=cut if cut in ('close','parent-write','terminal-parent-write','read-close','link-read-close','escape') else None) as (chainrequest,env,events,store):
            source=D(chainrequest)['source'];request=E({'schema':'bw.gui-hdd.font-bridge-request.v1','source':source,'baseline':D(base64.b64decode(prior['request']['base64']))['baseline'],'entry':'/etc/alternatives/choice.ttf','prior':prior})
            if cut in ('prior-pin','prior-stat','prior-type','prior-target','prior-link','prior-run','prior-baseline','mode'):
                q=D(request)
                if cut=='prior-pin':q['prior']['expectation']['original']['sha256']='0'*64
                elif cut=='prior-run':q['prior']['expectation']['runId']+=1
                elif cut=='prior-baseline':q['baseline']=c.font_blob(E({'schema':'bw.gui-hdd.inventory-template.v3','files':[],'aliases':[]}))
                elif cut=='mode':q['schema']='bw.gui-hdd.font-chain-request.v1'
                else:
                    original=D(base64.b64decode(q['prior']['original']['base64']));alias=original['aliases'][prior['sourceEntry']]
                    if cut=='prior-stat':alias['namedAfter']['ino']+=1
                    elif cut=='prior-type':alias['namedBefore']['uid']=False;alias['namedAfter']['uid']=False
                    elif cut=='prior-target':alias['target']='/usr/share/fonts/guessed.ttf'
                    else:alias['linkText']='/etc/alternatives/other.ttf'
                    raw=E(original);q['prior']['original']=c.font_blob(raw);q['prior']['expectation']['original']=ROW(raw)
                request=E(q)
            store['/request']=request;event=D(store['/event']);event['label']['name']='x86-hdd-gui-font-bridge';event['pull_request']['body']='<!-- BW_GUI_HDD_FONT_BRIDGE_SHA256='+H(request)+' -->';
            if large:event['pull_request']['body']+=' '*((256<<10)-len(E(event)))
            store['/event']=E(event)
            env['GITHUB_JOB']='font-bridge';oldstat=c.Path.lstat;oldopen=c.os.open;oldresolve=c.Path.resolve;oldlink=c.os.readlink;oldfstat=c.os.fstat;oldclose=c.os.close
            def guarded(operation,path,*args,**kw):
                self.assertFalse(str(path)==prior['sourceEntry'] or str(path).startswith(str(pathlib.Path(prior['sourceEntry']).parent)),'old entry/unsafe parent was reobserved')
                result=operation(path,*args,**kw)
                if cut=='back-to-entry' and hasattr(result,'st_mode') and stat.S_ISLNK(result.st_mode):result.st_size=len(prior['sourceEntry'])
                return result
            def fstat_(fd):
                info=oldfstat(fd)
                if cut=='back-to-entry' and stat.S_ISLNK(info.st_mode):info.st_size=len(prior['sourceEntry'])
                return info
            def close_(fd):
                if cut=='bridge-link-close' and stat.S_ISLNK(oldfstat(fd).st_mode):raise OSError('LINK_CLOSE_FIRST')
                return oldclose(fd)
            with patch.object(c,'FONT_BRIDGE_ENABLED',True),patch.dict(c.os.environ,env,clear=True),patch.object(c.Path,'lstat',lambda path:guarded(oldstat,path)),patch.object(c.Path,'resolve',lambda path,**kw:guarded(oldresolve,path,**kw)),patch.object(c.os,'open',lambda path,*args:guarded(oldopen,path,*args)),patch.object(c.os,'close',close_),patch.object(c.os,'fstat',fstat_),patch.object(c.os,'readlink',lambda path,**kw:prior['sourceEntry'] if cut=='back-to-entry' else oldlink(path,**kw)),patch.object(c.os,'scandir',side_effect=AssertionError('no font directory census')):
                status=c.main(['font-bridge','--request','/request','--expected-sha256',H(request),'--output','/out/bridge.json'])
            value=D(store['/out/bridge.json'])
        expected={'schema':'bw.gui-hdd.font-bridge-expectation.v1','source':source,'request':ROW(request),'original':ROW(E(value)),'runId':200,'workflowSha':'d'*40,'prior':r.font_bridge_reference(prior,'/etc/alternatives/choice.ttf')}
        return value,request,expected,events,status
    def test_font_bridge_prior_referenced_real_cli_and_independent_reader(self):
        value,request,expected,events,status=self.font_bridge_fixture();self.assertEqual(status,0,value['firstFailure']);self.assertEqual(len(value['links']),1)
        verdict=r.verify_font_bridge(E(value),request,expected);self.assertTrue(verdict['complete']);self.assertFalse(verdict['sourceEntryReobserved']);self.assertFalse(verdict['currentEntryAssociationObserved']);self.assertFalse(verdict['qualified'])
        inputs={'/original':E(value),'/request':request,'/expected':E(expected)};out=io.StringIO()
        with patch.object(r,'bounded_input',lambda path,cap:inputs[path]),contextlib.redirect_stdout(out):self.assertEqual(r.main(['--font-bridge','/original','--request','/request','--expected','/expected']),0)
        self.assertEqual(D(out.getvalue().encode()),verdict)
    def test_font_bridge_invalid_prior_refuses_before_observation_boundaries(self):
        for cut in ('prior-pin','prior-stat','prior-type','prior-target','prior-link','prior-run','prior-baseline','mode'):
            value,request,expected,events,status=self.font_bridge_fixture(cut=cut);self.assertEqual(status,1,cut);self.assertFalse(events,cut);self.assertFalse(value['complete']);self.assertEqual(value['sourceCommands'],[])
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_bridge(E(value),request,expected)
        with patch.object(c,'FONT_BRIDGE_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('read input')),patch.object(c.Path,'cwd',side_effect=AssertionError('cwd')):
            for mode in ('font-bridge','font-bridge-guard'):
                with self.assertRaisesRegex(ValueError,'font bridge disabled'):c.main([mode])
        self.assertTrue(c.FONT_BRIDGE_ENABLED);self.assertFalse(c.FONT_CHAIN_ENABLED);self.assertFalse(c.ACTUAL_ENABLED)
    def test_font_bridge_failed_reads_and_closed_mode_policies(self):
        for cut in ('close','read-close','escape'):
            value,request,expected,events,status=self.font_bridge_fixture(cut=cut);self.assertEqual(status,1);self.assertFalse(r.verify_font_bridge(E(value),request,expected)['complete'])
        value,request,expected,events,status=self.font_bridge_fixture()
        for cut in ('prior-outer','association','entry-observed','version','tool-original','parent','terminal'):
            v=copy.deepcopy(value);e=copy.deepcopy(expected)
            if cut=='prior-outer':e['prior']['runId']+=1
            elif cut=='association':v['currentEntryAssociationObserved']=True
            elif cut=='entry-observed':v['sourceEntryReobserved']=True
            elif cut=='version':v['schema']='bw.gui-hdd.font-chain-original.v1'
            elif cut=='tool-original':v['tool']['original']={}
            elif cut=='parent':row=copy.deepcopy(v['parents'][0]);row['path']='/opt/unrelated';v['parents'].append(row);v['complete']=False;v['firstFailure']={'phase':'chain','path':None,'name':'ValueError','message':'failed'}
            else:v['terminal']['path']='/etc/passwd';v['complete']=False;v['firstFailure']={'phase':'chain','path':None,'name':'ValueError','message':'failed'}
            e['original']=ROW(E(v))
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_bridge(E(v),request,e)
    def test_font_bridge_actual_prior_size_preserves_frame_and_input_caps(self):
        value,request,expected,events,status=self.font_bridge_fixture(large=True);self.assertEqual(status,0,value['firstFailure']);self.assertGreaterEqual(D(request)['prior']['original']['byteLength'],446776)
        self.assertLessEqual(len(request),c.JSON_CAP//4);self.assertLess(len(E(value)),c.JSON_CAP-(2<<20));self.assertTrue(r.verify_font_bridge(E(value),request,expected)['complete'])
        prior=D(request)['prior'];prior['original']['byteLength']=c.JSON_CAP//4+1
        with patch.object(c.base64,'b64decode',side_effect=AssertionError('oversized input decoded')):
            with self.assertRaises(ValueError):c.font_bridge_blob(prior['original'])

    def test_font_bridge_never_reobserves_historical_source_entry(self):
        value,request,expected,events,status=self.font_bridge_fixture(cut='back-to-entry')
        self.assertEqual(status,1);self.assertEqual(value['firstFailure']['message'],'historical source entry cannot be reobserved');self.assertIsNone(value['terminal'])
        self.assertFalse(r.verify_font_bridge(E(value),request,expected)['complete'])
        for kind in ('link','terminal'):
            value,request,expected,events,status=self.font_bridge_fixture();sourceEntry=D(request)['prior']['sourceEntry']
            for row in value['links']:
                row['linkBefore']=row['linkAfter']=sourceEntry
                for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):row[key]['size']=len(sourceEntry)
            if kind=='terminal':value['terminal']['path']=sourceEntry
            else:row=copy.deepcopy(value['links'][0]);row['path']=sourceEntry;value['links'].append(row)
            expected['original']=ROW(E(value))
            with self.assertRaises(ValueError):r.verify_font_bridge(E(value),request,expected)
    def test_font_bridge_critical_prior_and_policy_mutations_detected(self):
        source=(root/'scripts/run-i80386-hdd-gui-actual.py').read_text()
        old="need(encode(alias['namedBefore'])==encode(alias['namedAfter']) and alias['linkText']==entry and type(alias['linkText']) is str and\n      alias['namedBefore']['size']==len(entry.encode()),'stable incomplete prior alias with exact literal bridge text/extent')"
        cuts=[(old,"need(True,'stable incomplete prior alias with exact literal bridge text/extent')",'font_bridge_prior','prior-stat'),
          ("need(encode(selected[role])==encode({key:prior[role][key] for key in ('byteLength','sha256')}),'externally selected prior pin join')","need(True,'externally selected prior pin join')",'font_bridge_prior','prior-pin'),
          ("for key,item in info.items():integer(item,-2**63 if key=='mtime_ns' else 0,2**63-1 if key=='mtime_ns' else 2**64-1)","for key,item in info.items():pass",'font_bridge_prior','prior-type'),
          ("need(path!=request['prior']['sourceEntry'],'historical source entry cannot be reobserved')","need(True,'historical source entry cannot be reobserved')",'collect_font_bridge','back-to-entry')]
        for old,new,name,cut in cuts:
            self.assertIn(old,source);namespace={'__name__':'bridge_mutant'};exec(compile(source.replace(old,new,1),'bridge-mutant','exec'),namespace);f=namespace[name];f=type(f)(f.__code__,c.__dict__,f.__name__,f.__defaults__,f.__closure__)
            with patch.object(c,name,f):mutant=self.font_bridge_fixture(cut=cut)
            baseline=self.font_bridge_fixture(cut=cut)
            self.assertNotEqual((mutant[-1],mutant[0]['firstFailure']),(baseline[-1],baseline[0]['firstFailure']),cut)
        reader=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text();old="need(encode(font_bridge_reference(request['prior'],request['entry']))==encode(expected['prior']),'independently selected prior reference')";self.assertIn(old,reader)
        namespace={'__name__':'bridge_reader_mutant'};exec(compile(reader.replace(old,"need(True,'independently selected prior reference')",1),'bridge-reader-mutant','exec'),namespace)
        value,request,expected,events,status=self.font_bridge_fixture();expected['prior']['runId']+=1
        with self.assertRaises(ValueError):r.verify_font_bridge(E(value),request,expected)
        self.assertTrue(namespace['verify_font_bridge'](E(value),request,expected)['complete'])

    def test_font_bridge_forbidden_rebound_does_not_authorize_new_parents(self):
        value,request,expected,events,status=self.font_bridge_fixture(cut='back-to-entry');self.assertEqual(status,1)
        original=copy.deepcopy(value);sourceEntry=D(request)['prior']['sourceEntry'];oldparent=str(pathlib.Path(sourceEntry).parent)
        extra=copy.deepcopy(value['parents'][0]);extra['path']=oldparent;value['parents'].append(extra);expected['original']=ROW(E(value))
        with self.assertRaisesRegex(ValueError,'derived chain ancestry|ordered derived prefix'):r.verify_font_bridge(E(value),request,expected)
        # Removing this one fence reproduces the peer's coherently re-pinned
        # failed packet acceptance, rather than merely changing an error string.
        source=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text();predicate="if current==request['prior']['sourceEntry']:";self.assertIn(predicate,source)
        namespace={'__name__':'bridge_rebound_mutant'};exec(compile(source.replace(predicate,'if False:',1),'bridge-rebound-mutant','exec'),namespace)
        mutant_packet=copy.deepcopy(original);present={row['path'] for row in mutant_packet['parents']}
        for path in reversed(list(pathlib.Path(sourceEntry).parents)):
            if str(path) not in present:
                row=copy.deepcopy(extra);row['path']=str(path);mutant_packet['parents'].append(row);present.add(str(path))
        selected=copy.deepcopy(expected);selected['original']=ROW(E(mutant_packet))
        with self.assertRaises(ValueError):r.verify_font_bridge(E(mutant_packet),request,selected)
        self.assertFalse(namespace['verify_font_bridge'](E(mutant_packet),request,selected)['complete'])
        # A shared ancestor already justified by an independently observed new
        # font path remains admissible; the historical parent is not blacklisted.
        value=original;newalias=oldparent+'/another.ttf';link=copy.deepcopy(value['links'][0]);link['path']=newalias;value['links'].append(link)
        value['links'][0]['linkBefore']=value['links'][0]['linkAfter']=newalias
        for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):value['links'][0][key]['size']=len(newalias)
        present={row['path'] for row in value['parents']}
        for path in reversed(list(pathlib.Path(newalias).parents)):
            if str(path) not in present:
                row=copy.deepcopy(extra);row['path']=str(path);value['parents'].append(row);present.add(str(path))
        expected['original']=ROW(E(value))
        self.assertFalse(r.verify_font_bridge(E(value),request,expected)['complete'])

    def test_font_bridge_failed_witness_cannot_authorize_suffix_or_derived_parent(self):
        for cut in ('link-close','link-drift','parent-close','parent-drift','parent-write'):
            value,request,expected,events,status=self.font_bridge_fixture();value['complete']=False;value['firstFailure']={'phase':'chain','path':None,'name':'OSError','message':'first witness failure'}
            row=value['links'][0] if cut.startswith('link') else value['parents'][0]
            if cut.endswith('close'):row['close']['succeeded']=False
            elif cut.endswith('write'):
                for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):row[key]['mode']|=0o022
            else:row['heldAfter']['ino']+=1
            expected['original']=ROW(E(value))
            with self.assertRaises(ValueError,msg=cut):r.verify_font_bridge(E(value),request,expected)
        for cut in ('bridge-link-close','link-read-close','terminal-parent-write'):
            value,request,expected,events,status=self.font_bridge_fixture(cut=cut);self.assertEqual(status,1,cut);self.assertIsNone(value['terminal'])
            self.assertFalse(r.verify_font_bridge(E(value),request,expected)['complete'])

    def test_font_chain_prefix_repairs_held_partial_dependency_counterexamples(self):
        source=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text()
        link_gate="        try:font_chain_witness_row(row,True)\n        except ValueError:\n            need(not value['complete'] and index==len(links)-1 and value['terminal'] is None,'failed chain link witness ends observation before following hop');break\n"
        parent_gate="    needed_parents={str(parent) for row in links for parent in Path(row['path']).parents}\n    if terminal is not None:needed_parents.update(str(parent) for parent in Path(terminal['path']).parents)\n    parentmap={row['path']:row for row in parents}\n    need(needed_parents<=set(parentmap),'all parents consumed by retained chain witnesses are present')\n    for path in needed_parents:font_chain_witness_row(parentmap[path],True)\n    for index,row in enumerate(parents):\n        try:font_chain_witness_row(row,True)\n        except ValueError:need(not value['complete'] and index==len(parents)-1 and row['path'] not in needed_parents,'failed parent ends unconsumed chain observation prefix')\n"
        for gate in (link_gate,parent_gate):self.assertIn(gate,source)
        mutants=[]
        for gate in (link_gate,parent_gate):
            namespace={'__name__':'chain_prefix_mutant'};exec(compile(source.replace(gate,'',1),'chain-prefix-mutant','exec'),namespace);mutants.append(namespace['verify_font_chain'])
        for cut in ('link-close','link-drift','parent-close','parent-drift','parent-write'):
            value,request,expected,events,status=self.chain_fixture();value['complete']=False;value['firstFailure']={'phase':'chain','path':None,'name':'OSError','message':'retained dependency failure'}
            row=value['links'][0] if cut.startswith('link') else value['parents'][0]
            if cut.endswith('close'):row['close']['succeeded']=False
            elif cut.endswith('write'):
                for key in ('namedBefore','heldBefore','heldAfter','namedAfter'):row[key]['mode']|=0o022
            else:row['heldAfter']['ino']+=1
            expected['original']=ROW(E(value))
            with self.assertRaises(ValueError,msg=cut):r.verify_font_chain(E(value),request,expected)
            # Each repair-omission mutant reproduces the held old-mode acceptance.
            self.assertFalse(mutants[0 if cut.startswith('link') else 1](E(value),request,expected)['complete'])
    def test_font_chain_prefix_failed_link_does_not_authorize_next_parent(self):
        value,request,expected,events,status=self.chain_fixture(cut='drift');self.assertEqual(status,1);self.assertIsNone(value['terminal']);self.assertIsNotNone(value['links'][-1]['linkBefore'])
        self.assertFalse(r.verify_font_chain(E(value),request,expected)['complete'])
        extra=copy.deepcopy(value['parents'][0]);extra['path']='/usr/share/fonts/family';value['parents'].append(extra);expected['original']=ROW(E(value))
        with self.assertRaisesRegex(ValueError,'derived chain ancestry'):r.verify_font_chain(E(value),request,expected)
    def test_font_chain_prefix_preserves_complete_shared_and_real_failed_prefixes(self):
        for two in (False,True):
            value,request,expected,events,status=self.chain_fixture(two=two);self.assertEqual(status,0);self.assertTrue(r.verify_font_chain(E(value),request,expected)['complete'])
            self.assertEqual(len({row['path'] for row in value['parents']}),len(value['parents']))
        for cut in ('link-read-close','drift','parent-write','terminal-parent-write','close','read-close'):
            value,request,expected,events,status=self.chain_fixture(cut=cut);self.assertEqual(status,1,cut)
            verdict=r.verify_font_chain(E(value),request,expected);self.assertFalse(verdict['complete']);self.assertFalse(verdict['qualified'])
            if cut in ('link-read-close','drift','parent-write','terminal-parent-write'):self.assertIsNone(value['terminal'])
        with self.font_chain_edges() as (request,env,events,store):
            close=c.os.close
            def fail_link_close(fd):
                if stat.S_ISLNK(c.os.fstat(fd).st_mode):raise OSError('FINAL_LINK_CLOSE')
                return close(fd)
            with patch.object(c.os,'close',fail_link_close):
                self.assertEqual(c.main(['font-chain','--request','/request','--expected-sha256',H(request),'--output','/out/close.json']),1)
            value=D(store['/out/close.json']);self.assertEqual(value['firstFailure']['message'],'FINAL_LINK_CLOSE');self.assertIsNotNone(value['links'][-1]['linkBefore']);self.assertIsNone(value['terminal'])
        expected={'schema':'bw.gui-hdd.font-chain-expectation.v1','source':D(request)['source'],'request':ROW(request),'original':ROW(E(value)),'runId':200,'workflowSha':'d'*40}
        self.assertFalse(r.verify_font_chain(E(value),request,expected)['complete'])

    def font_bridge_delivery_fixture(self,failed=False,failure_cut=None):
        failed=failed or failure_cut is not None;key=(failed,failure_cut)
        cache=getattr(type(self),'_bridge_delivery_seeds',{})
        if key in cache:return copy.deepcopy(cache[key])
        value,request_raw,inner,events,status=self.font_bridge_fixture(cut=failure_cut or ('close' if failed else None))
        workflow=b'name: manufactured separate bridge workflow\n';request=D(request_raw);request['source']['files'][r.FONT_WORKFLOW_PATH]=ROW(workflow);request_raw=E(request)
        value['request']=c.font_blob(request_raw);event=D(base64.b64decode(value['event']['base64']));event['pull_request']['body']='<!-- BW_GUI_HDD_FONT_BRIDGE_SHA256='+H(request_raw)+' -->';value['event']=c.font_blob(E(event))
        files={name:b'' for name in r.FONT_BRIDGE_TOP};files['request.json']=request_raw
        files['input-install.stdout']=E(dict(ROW(request_raw),gitBlob=hashlib.sha1(b'blob '+str(len(request_raw)).encode()+b'\0'+request_raw).hexdigest()))
        for index,command in enumerate(value['sourceCommands']):
            stdout=(request['source']['head' if index==0 else 'tree']+'\n').encode() if index<2 else workflow if sorted(r.SOURCE)[index-2]==r.FONT_WORKFLOW_PATH else ('source:'+sorted(r.SOURCE)[index-2]).encode()
            command['stdout']=ROW(stdout);process=proc(command['argv'],stdout,b'',c.clean_env(),seconds=.001);pid=2000+index
            process['identity'].update(pid=pid,pgid=pid,sessionId=pid,parentPid=900,state='S');process.update(startedNs=10000000*(index+1),endedNs=10000000*(index+1)+1000)
            for suffix,raw in (('stdout',stdout),('stderr',b''),('process.json',E(process))):files[r.FONT_BRIDGE_PROCESS_ROOT+'git-'+str(index)+'.'+suffix]=raw
        files['font-bridge-original.json']=E(value);self.assertEqual(len(files),81)
        blob=hashlib.sha1(b'blob '+str(len(workflow)).encode()+b'\0'+workflow).hexdigest()
        proof=E({'schema':'bw.gui-hdd.workflow-api-proof.v1','commit':c.font_blob(E({'sha':'d'*40,'tree':{'sha':'f'*40},'parents':[{'sha':'e'*40},{'sha':'a'*40}]})), 'tree':c.font_blob(E({'sha':'f'*40,'truncated':False,'tree':[{'path':r.FONT_WORKFLOW_PATH,'type':'blob','mode':'100644','sha':blob,'size':len(workflow)}]}))})
        run={'id':200,'run_attempt':1,'head_sha':'a'*40,'event':'pull_request','repository':{'full_name':r.REPOSITORY},'head_repository':{'full_name':r.REPOSITORY,'fork':False},'actor':{'login':'CrispStrobe'},'triggering_actor':{'login':'CrispStrobe'},'path':r.FONT_WORKFLOW_PATH,'status':'in_progress','conclusion':None,'pull_requests':[{'number':123,'head':{'sha':'9'*40}}]}
        names=['Run actions/checkout@11d5960a326750d5838078e36cf38b85af677262','Refuse unreviewed bridge before setup or input retrieval','Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020','Install unchanged selected packages and Chromium for bridge observation','Install externally selected immutable bridge request','Record bounded read-only font bridge without credentials','Run actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02']
        job={'id':201,'run_id':200,'run_attempt':1,'head_sha':'a'*40,'runner_id':300,'runner_name':'Manufactured bridge runner','labels':['ubuntu-24.04'],'name':'font-bridge','status':'completed','conclusion':'failure' if failed else 'success','started_at':'2026-10-19T00:00:00Z','completed_at':'2026-10-19T00:01:00Z','steps':[{'number':i+1,'name':name,'status':'completed','conclusion':'failure' if failed and i==5 else 'success','started_at':'2026-10-19T00:00:'+str(i*2).zfill(2)+'Z','completed_at':'2026-10-19T00:00:'+str(i*2+1).zfill(2)+'Z'} for i,name in enumerate(names)]}
        archive=zip_(files);artifact={'total_count':1,'artifacts':[{'id':202,'name':'i80386-hdd-gui-font-bridge-200-1','expired':False,'size_in_bytes':len(archive),'digest':'sha256:'+H(archive),'workflow_run':{'id':200,'head_sha':'a'*40}}]}
        metadata={'run':E(run),'job':E(job),'artifact':E(artifact),'workflowProof':proof};expected={'schema':'bw.gui-hdd.font-bridge-delivery-expectation.v1','source':request['source'],'request':ROW(request_raw),'archive':ROW(archive),'runId':200,'jobId':201,'artifactId':202,'prNumber':123,'workflow':{'commit':'d'*40,'base':'e'*40,'tree':'f'*40,'blob':blob,**ROW(workflow)},'metadata':{key:ROW(raw) for key,raw in metadata.items()},'prior':inner['prior']}
        result=(files,request_raw,expected,metadata,workflow);cache[key]=copy.deepcopy(result);type(self)._bridge_delivery_seeds=cache
        return result
    def bridge_delivery_seal(self,files,expected,metadata):
        expected=copy.deepcopy(expected);metadata=dict(metadata);archive=zip_(files);artifact=D(metadata['artifact']);artifact['artifacts'][0].update(size_in_bytes=len(archive),digest='sha256:'+H(archive));metadata['artifact']=E(artifact)
        expected['archive']=ROW(archive);expected['metadata']={key:ROW(raw) for key,raw in metadata.items()}
        return archive,expected,metadata
    def test_font_bridge_delivery_complete_failed_and_metadata_cli(self):
        for failed in (False,True):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture(failed);archive,expected,metadata=self.bridge_delivery_seal(files,expected,metadata)
            admission=r.admit_font_bridge_metadata(request,expected,metadata,workflow);self.assertFalse(admission['acquisitionAuthorized']);self.assertFalse(admission['archiveObserved']);self.assertFalse(admission['eventObserved']);self.assertFalse(admission['rawOriginalsAudited'])
            verdict=r.verify_font_bridge_delivery(archive,request,expected,metadata,workflow);self.assertEqual(verdict['complete'],not failed);self.assertEqual(verdict['producingConclusion'],'failure' if failed else 'success');self.assertFalse(verdict['qualified']);self.assertFalse(verdict['currentEntryAssociationObserved'])
            inputs={'/archive':archive,'/request':request,'/expected':E(expected),'/workflow':workflow,**{'/'+key:raw for key,raw in metadata.items()}};reads=[]
            def bounded(path,cap):reads.append(path);self.assertLessEqual(len(inputs[path]),cap);return inputs[path]
            tail=['--request','/request','--expected','/expected','--run','/run','--job','/job','--artifact','/artifact','--workflow-proof','/workflowProof','--workflow','/workflow']
            for args in (['--font-bridge-metadata',*tail],['--font-bridge-delivery','/archive',*tail]):
                out=io.StringIO();reads.clear()
                with patch.object(r,'bounded_input',bounded),contextlib.redirect_stdout(out):self.assertEqual(r.main(args),0)
                self.assertEqual(D(out.getvalue().encode()),admission if args[0]=='--font-bridge-metadata' else verdict)
                if args[0]=='--font-bridge-metadata':self.assertNotIn('/archive',reads)
                else:self.assertEqual(reads[-1],'/archive')
    def test_font_bridge_delivery_metadata_refuses_before_archive_open(self):
        files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture();run=D(metadata['run']);run['actor']['login']='foreign';metadata['run']=E(run);expected['metadata']['run']=ROW(metadata['run'])
        inputs={'/request':request,'/expected':E(expected),'/workflow':workflow,**{'/'+key:raw for key,raw in metadata.items()}}
        def bounded(path,cap):self.assertNotEqual(path,'/archive','archive opened before metadata admission');return inputs[path]
        with patch.object(r,'bounded_input',bounded),patch.object(r,'font_bridge_delivery_archive',side_effect=AssertionError('ZIP parsed before metadata')):
            with self.assertRaises(ValueError):r.main(['--font-bridge-delivery','/archive','--request','/request','--expected','/expected','--run','/run','--job','/job','--artifact','/artifact','--workflow-proof','/workflowProof','--workflow','/workflow'])
    def test_font_bridge_delivery_rehashed_official_and_prior_refusals(self):
        for cut in ('job-mode','attempt','bool-id','actor','head','runner','step-order','setup-failed','cancelled','artifact-name','artifact-size','artifact-digest','expired','prior','workflow','workflow-source','schema'):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture();run=D(metadata['run']);job=D(metadata['job']);artifact=D(metadata['artifact'])
            if cut=='job-mode':job['name']='font-discovery'
            elif cut=='attempt':job['run_attempt']=2
            elif cut=='bool-id':job['id']=True
            elif cut=='actor':run['triggering_actor']['login']='foreign'
            elif cut=='head':run['head_sha']='0'*40
            elif cut=='runner':job['runner_id']=0
            elif cut=='step-order':job['steps'][0],job['steps'][1]=job['steps'][1],job['steps'][0]
            elif cut=='setup-failed':job['steps'][3]['conclusion']='failure'
            elif cut=='cancelled':job['conclusion']='cancelled'
            elif cut=='artifact-name':artifact['artifacts'][0]['name']='i80386-hdd-gui-font-discovery-200-1'
            elif cut=='artifact-size':artifact['artifacts'][0]['size_in_bytes']+=1
            elif cut=='artifact-digest':artifact['artifacts'][0]['digest']='sha256:'+'0'*64
            elif cut=='expired':artifact['artifacts'][0]['expired']=True
            elif cut=='prior':expected['prior']['runId']+=1
            elif cut=='workflow':workflow+=b'changed'
            elif cut=='workflow-source':
                q=D(request);q['source']['files'][r.FONT_WORKFLOW_PATH]['sha256']='0'*64;request=E(q);expected['source']=q['source'];expected['request']=ROW(request)
            else:expected['schema']='bw.gui-hdd.font-discovery-delivery-expectation.v1'
            metadata.update(run=E(run),job=E(job),artifact=E(artifact));expected['metadata']={key:ROW(raw) for key,raw in metadata.items()}
            with self.assertRaises(ValueError,msg=cut):r.admit_font_bridge_metadata(request,expected,metadata,workflow)
    def test_font_bridge_delivery_raw_role_and_inner_semantic_refusals(self):
        for cut in ('missing','extra','raw-source','raw-argv','raw-env','raw-time','raw-primary','raw-pid','raw-bool','raw-stderr','raw-close','event','prior','inner-mode','association','retention','source-prefix','source-retention','retention-phase','secondary-retention','source-path-none','unrelated-failure-path','secondary-path-none','secondary-path-unrelated','raw-gap'):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture(failed=cut in ('source-retention','retention-phase','secondary-retention','source-path-none','unrelated-failure-path','secondary-path-none','secondary-path-unrelated','raw-gap'));value=D(files['font-bridge-original.json']);role=r.FONT_BRIDGE_PROCESS_ROOT+'git-0';process=D(files[role+'.process.json'])
            if cut=='missing':files.pop(role+'.stderr')
            elif cut=='extra':files[r.FONT_BRIDGE_PROCESS_ROOT+'font-packages.stdout']=b''
            elif cut=='raw-source':files[role+'.stdout']=b'invented\n';process['streams']['stdout']=ROW(files[role+'.stdout'])
            elif cut=='raw-gap':
                for index in range(1,23):
                    name=r.FONT_BRIDGE_PROCESS_ROOT+'git-'+str(index)+'.process.json';row=D(files[name]);row['startedNs']+=201*10**9;row['endedNs']+=201*10**9;files[name]=E(row)
            elif cut=='raw-argv':process['argv'][-1]='other'
            elif cut=='raw-env':process['environment']['HOME']='/invented'
            elif cut=='raw-time':process['endedNs']=process['startedNs']
            elif cut=='raw-primary':process.update(exitCode=1,firstFailure='child refused')
            elif cut=='raw-pid':process['identity']['parentPid']=process['identity']['pid']
            elif cut=='raw-bool':process['exitCode']=False
            elif cut=='raw-stderr':files[role+'.stderr']=b'warning';process['streams']['stderr']=ROW(b'warning')
            elif cut=='raw-close':process['secondaryFailures']=[{'phase':'close','name':'OSError','message':'close failed'}];process['firstFailure']='close failed'
            elif cut=='event':event=D(base64.b64decode(value['event']['base64']));event['label']['name']='x86-hdd-gui-font-chain';value['event']=c.font_blob(E(event))
            elif cut=='prior':old=D(base64.b64decode(D(request)['prior']['original']['base64']));old['aliases'][D(request)['prior']['sourceEntry']]['namedAfter']['ino']+=1;q=D(request);q['prior']['original']=c.font_blob(E(old));request=E(q);files['request.json']=request
            elif cut=='inner-mode':value['schema']='bw.gui-hdd.font-chain-original.v1'
            elif cut=='association':value['sourceEntryReobserved']=True
            elif cut=='retention':files['controller.stderr']=b'close refusal'
            elif cut=='source-retention':value['firstFailure']['phase']='source-retention'
            elif cut=='retention-phase':value['firstFailure']['phase']='retention'
            elif cut=='source-path-none':value['firstFailure']['path']=None
            elif cut=='unrelated-failure-path':value['firstFailure']['path']='/opt/not-attempted'
            elif cut in ('secondary-path-none','secondary-path-unrelated'):value['secondary']=[{'phase':'close','path':None if cut=='secondary-path-none' else '/opt/not-attempted','name':'OSError','message':'close failed'}]
            elif cut=='secondary-retention':value['secondary']=[{'phase':'source-retention','path':value['firstFailure']['path'],'name':'OSError','message':'retention failed'}]
            else:value['sourceCommands'].pop()
            files[role+'.process.json']=E(process);files['font-bridge-original.json']=E(value)
            archive,expected,metadata=self.bridge_delivery_seal(files,expected,metadata)
            if cut=='prior':expected['request']=ROW(request)
            with self.assertRaises((ValueError,KeyError),msg=cut):r.verify_font_bridge_delivery(archive,request,expected,metadata,workflow)
    def test_font_bridge_delivery_header_roster_before_inflation(self):
        for cut in ('missing','extra','mixed','directory-payload','special','oversized','request-cap'):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture()
            if cut=='missing':files.pop('guard.stdout')
            elif cut=='extra':files['unknown.txt']=b''
            elif cut=='mixed':files['gui-font-bridge/guard.stdout']=files.pop('guard.stdout')
            elif cut=='directory-payload':files['gui-font-bridge/']=b'payload'
            elif cut=='request-cap':files['request.json']=b'x'*(r.JSON_CAP//4+1)
            elif cut=='oversized':files[r.FONT_BRIDGE_PROCESS_ROOT+'git-0.stdout']=b'x'*(r.STREAM_CAP+1)
            if cut=='special':
                output=io.BytesIO()
                with zipfile.ZipFile(output,'w') as archive:
                    for name,raw in files.items():
                        info=zipfile.ZipInfo(name);info.external_attr=((stat.S_IFIFO|0o600)<<16) if name=='guard.stdout' else 0;archive.writestr(info,raw)
                raw=output.getvalue()
            else:raw=zip_(files)
            with patch.object(zipfile.ZipFile,'open',side_effect=AssertionError('inflated before whole header admission')):
                with self.assertRaises(ValueError,msg=cut):r.font_bridge_delivery_archive(raw)
        files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture();prefixed={'gui-font-bridge/'+name:raw for name,raw in files.items()};archive,expected,metadata=self.bridge_delivery_seal(prefixed,expected,metadata)
        self.assertTrue(r.verify_font_bridge_delivery(archive,request,expected,metadata,workflow)['complete'])


        for prefix,dirs in (('',[r.FONT_BRIDGE_PROCESS_ROOT]),('gui-font-bridge/',['gui-font-bridge/','gui-font-bridge/'+r.FONT_BRIDGE_PROCESS_ROOT])):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture();layout={prefix+name:raw for name,raw in files.items()};layout.update({name:b'' for name in dirs})
            archive,expected,metadata=self.bridge_delivery_seal(layout,expected,metadata);self.assertTrue(r.verify_font_bridge_delivery(archive,request,expected,metadata,workflow)['complete'])
        for prefix,orphan in (('','gui-font-bridge/'),('','gui-font-bridge/'+r.FONT_BRIDGE_PROCESS_ROOT),('gui-font-bridge/',r.FONT_BRIDGE_PROCESS_ROOT)):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture();layout={prefix+name:raw for name,raw in files.items()};layout[orphan]=b''
            raw=zip_(layout)
            with patch.object(zipfile.ZipFile,'open',side_effect=AssertionError('inflated orphan-layout directory')):
                with self.assertRaisesRegex(ValueError,'selected file layout'):r.font_bridge_delivery_archive(raw)
    def test_font_bridge_delivery_critical_predicate_omissions_detected(self):
        source=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text()
        cases=[("need(prior_end-first_start<=200*10**9,'bridge raw source span profile at most200s; not controller duration or preemption')","need(True,'bridge raw source span profile at most200s; not controller duration or preemption')",'raw-span'),
          ("need(directories<=allowed_directories,'bridge directory records belong to selected file layout')","need(True,'bridge directory records belong to selected file layout')",'directory-layout'),("need(encode(source['files'][FONT_WORKFLOW_PATH])==encode({k:workflow[k] for k in ('byteLength','sha256')}),'bridge executing workflow content joins reviewed source21 workflow')","need(True,'bridge executing workflow content joins reviewed source21 workflow')",'workflow-source'),("need(encode(request['source'])==encode(expected['source']) and encode(font_bridge_reference(request['prior'],request['entry']))==encode(expected['prior']),'bridge current source and historical prior independently selected')","need(True,'bridge current source and historical prior independently selected')",'prior'),
          ("job.get('name')=='font-bridge'","True",'job'),
          ("need(required=={name for name,item in headers},'exact bridge delivery role closure; unsupported early/source failures refuse')","need(True,'exact bridge delivery role closure; unsupported early/source failures refuse')",'missing'),
          ("need(encode(command['stdout'])==encode(process['streams']['stdout']) and encode(command['stderr'])==encode(process['streams']['stderr']) and type(command['exitCode']) is int and command['exitCode']==0,'bridge descriptor/raw source join')","need(True,'bridge descriptor/raw source join')",'raw-descriptor'),
          ("need(encode(process['streams']['stdout'])==encode(selected),'bridge raw source/external bytes join')","need(True,'bridge raw source/external bytes join')",'raw-source')]
        for old,new,cut in cases:
            self.assertIn(old,source);namespace={'__name__':'bridge_delivery_mutant'};exec(compile(source.replace(old,new,1),'bridge-delivery-mutant','exec'),namespace)
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture()
            if cut=='workflow-source':
                q=D(request);q['source']['files'][r.FONT_WORKFLOW_PATH]['sha256']='0'*64;request=E(q);expected['source']=q['source'];expected['request']=ROW(request)
            elif cut=='prior':expected['prior']['runId']+=1
            elif cut=='job':job=D(metadata['job']);job['name']='font-discovery';metadata['job']=E(job)
            elif cut=='missing':files.pop('guard.stdout')
            elif cut=='directory-layout':files['gui-font-bridge/']=b''
            else:
                if cut=='raw-span':
                    for index in range(1,23):
                        name=r.FONT_BRIDGE_PROCESS_ROOT+'git-'+str(index)+'.process.json';row=D(files[name]);row['startedNs']+=201*10**9;row['endedNs']+=201*10**9;files[name]=E(row)
                    value=D(files['font-bridge-original.json'])
                    with self.assertRaises(ValueError):r.font_bridge_delivery_raw(value,files,D(request))
                    namespace['font_bridge_delivery_raw'](value,files,D(request));continue
                role=r.FONT_BRIDGE_PROCESS_ROOT+'git-0';process=D(files[role+'.process.json'])
                if cut=='raw-descriptor':
                    # Only the source summary can differ while raw selected bytes
                    # remain fixed; exercise this validator directly below.
                    value=D(files['font-bridge-original.json']);value['sourceCommands'][0]['stdout']['sha256']='0'*64
                    with self.assertRaises(ValueError):r.font_bridge_delivery_raw(value,files,D(request))
                    namespace['font_bridge_delivery_raw'](value,files,D(request));continue
                files[role+'.stdout']=b'wrong source\n';process['streams']['stdout']=ROW(files[role+'.stdout']);files[role+'.process.json']=E(process)
                # Coherently alter summary too; inner source validation normally
                # rejects this independently, so isolate the final raw pin gate.
                value=D(files['font-bridge-original.json']);value['sourceCommands'][0]['stdout']=ROW(files[role+'.stdout'])
                with self.assertRaises(ValueError):r.font_bridge_delivery_raw(value,files,D(request))
                namespace['font_bridge_delivery_raw'](value,files,D(request));continue
            archive,expected,metadata=self.bridge_delivery_seal(files,expected,metadata)
            if cut in ('missing','directory-layout'):
                with self.assertRaises(ValueError):r.font_bridge_delivery_archive(archive)
                result=namespace['font_bridge_delivery_archive'](archive)
                if cut=='missing':self.assertNotIn('guard.stdout',result)
                else:self.assertEqual(len(result),81)
                continue
            with self.assertRaises(ValueError):r.admit_font_bridge_metadata(request,expected,metadata,workflow)
            self.assertFalse(namespace['admit_font_bridge_metadata'](request,expected,metadata,workflow)['acquisitionAuthorized'])

    def test_font_bridge_delivery_supported_failed_filesystem_prefixes(self):
        for cut in ('read-close','bridge-link-close','terminal-parent-write','back-to-entry'):
            files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture(failure_cut=cut);archive,expected,metadata=self.bridge_delivery_seal(files,expected,metadata)
            verdict=r.verify_font_bridge_delivery(archive,request,expected,metadata,workflow);self.assertFalse(verdict['complete']);self.assertEqual(verdict['producingConclusion'],'failure');self.assertFalse(verdict['sourceEntryReobserved'])
        files,request,expected,metadata,workflow=self.font_bridge_delivery_fixture(failed=True);value=D(files['font-bridge-original.json']);row=copy.deepcopy(value['parents'][1]);row['namedBefore']['mode']|=0o022
        for key in ('heldBefore','heldAfter','namedAfter'):row[key]=None
        row['close']={'attempted':False,'succeeded':False};value['parents']=value['parents'][:1]+[row];value.update(links=[],terminal=None,firstFailure={'phase':'chain','path':D(request)['entry'],'name':'ValueError','message':'canonical nonwritable chain parent'})
        files['font-bridge-original.json']=E(value);archive,expected,metadata=self.bridge_delivery_seal(files,expected,metadata)
        self.assertFalse(r.verify_font_bridge_delivery(archive,request,expected,metadata,workflow)['complete'])

    def test_font_bridge_live_guard_has_zero_observation_edges_and_held_modes_refuse(self):
        self.assertTrue(c.FONT_BRIDGE_ENABLED)
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(c.argparse,'_',lambda text:text))
            for name in ('regular','collect_font_bridge','retain_font_bridge','font_read','Hosted','Originals'):
                stack.enter_context(patch.object(c,name,side_effect=AssertionError('observation edge '+name)))
            for name in ('cwd','lstat','resolve'):
                stack.enter_context(patch.object(c.Path,name,side_effect=AssertionError('path edge '+name)))
            for name in ('open','stat','lstat','readlink','scandir'):
                stack.enter_context(patch.object(c.os,name,side_effect=AssertionError('OS edge '+name)))
            stack.enter_context(patch.object(c.subprocess,'Popen',side_effect=AssertionError('process edge')))
            self.assertEqual(c.main(['font-bridge-guard']),0)
            for mode in ('font-chain-guard','guard'):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main([mode])
        with patch.object(c,'FONT_BRIDGE_ENABLED',False):
            with self.assertRaisesRegex(ValueError,'font bridge disabled'):c.main(['font-bridge-guard'])
    def test_font_bridge_invalid_events_refuse_before_git_or_font_observation(self):
        value,request,expected,events,status=self.font_bridge_fixture();head=D(request)['source']['head']
        event={'action':'labeled','label':{'name':'x86-hdd-gui-font-bridge'},'sender':{'login':'CrispStrobe'},'repository':{'full_name':c.REPOSITORY},'number':123,'pull_request':{'number':123,'state':'open','head':{'sha':head,'repo':{'full_name':c.REPOSITORY,'fork':False}},'base':{'ref':'main','repo':{'full_name':c.REPOSITORY}},'body':'<!-- BW_GUI_HDD_FONT_BRIDGE_SHA256='+H(request)+' -->'}}
        env={'GITHUB_REPOSITORY':c.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'font-bridge','GITHUB_RUN_ID':'1234','BW_EXPECTED_HEAD':head,'GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_WORKFLOW_REF':c.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@refs/pull/123/merge','GITHUB_EVENT_PATH':'/event'}
        c.font_bridge_event(E(event),H(request),head,env)
        for cut in ('action','label','actor','fork','head','base','marker','attempt','job'):
            e=copy.deepcopy(event);platform=copy.deepcopy(env)
            if cut=='action':e['action']='opened'
            elif cut=='label':e['label']['name']='x86-hdd-gui-font-discovery'
            elif cut=='actor':e['sender']['login']='other'
            elif cut=='fork':e['pull_request']['head']['repo']['fork']=True
            elif cut=='head':e['pull_request']['head']['sha']='0'*40
            elif cut=='base':e['pull_request']['base']['ref']='other'
            elif cut=='marker':e['pull_request']['body']='unselected'
            elif cut=='attempt':platform['GITHUB_RUN_ATTEMPT']='2'
            else:platform['GITHUB_JOB']='font-discovery'
            with patch.object(c,'regular',return_value=E(e)),patch.object(c,'font_read',side_effect=AssertionError('font edge')) as read,patch.object(c,'Hosted',side_effect=AssertionError('Git edge')) as hosted,patch.object(c,'Originals',side_effect=AssertionError('retention edge')) as retained:
                observed=c.collect_font_bridge(request,H(request),pathlib.Path('/checkout'),platform,'/out/original.json')
            self.assertFalse(observed['complete'],cut);self.assertEqual(observed['firstFailure']['name'],'ValueError',cut);self.assertEqual(observed['sourceCommands'],[],cut)
            read.assert_not_called();hosted.assert_not_called();retained.assert_not_called()

    def native_fresh(self):
        files,expected=fixture_v5();reference=D(files['request.original.json'])['nativeFontAdmission']
        originals={key:base64.b64decode(row['base64']) for key,row in expected['nativeFontOriginals'].items()}
        return files,expected,reference,originals
    def test_current_v5_native_original_and_current_job_readback_positive(self):
        files,expected=fixture_v5();result=r.audit(*sealed(files,expected));self.assertTrue(result['pass']);self.assertEqual(result['schema'],'bw.gui-hdd.reader.v5')
        self.assertEqual(c.parse_request(files['request.original.json'],expected['requestSha256']),r.parse_request(files['request.original.json'],expected['requestSha256']))
        self.assertIs(c.ACTUAL_ENABLED,False);self.assertIs(r.ACTUAL_ENABLED,False)
        self.assertLess(len(files['request.original.json']),r.JSON_CAP);self.assertLess(len(E(expected)),r.JSON_CAP)
    def test_current_v5_requires_same_external_version_and_native_reference(self):
        for mutation in ('missing','old-expectation','old-request'):
            files,expected=fixture_v5();request=D(files['request.original.json'])
            if mutation=='missing':del request['nativeFontAdmission']
            elif mutation=='old-request':request['schema']='bw.gui-hdd.actual-request.v4'
            else:expected['schema']='bw.gui-hdd.actual-expectation.v4'
            refresh_v4_request(files,expected,request)
            with self.assertRaises(ValueError):r.audit(files,expected)
    def test_current_v5_native_reference_external_selection_survives_rehash(self):
        files,expected,reference,originals=self.native_fresh();request=D(files['request.original.json']);request['nativeFontAdmission']['artifactSha256']='3'*64
        refresh_v4_request(files,expected,request)
        with self.assertRaisesRegex(ValueError,'independently selected native-font reference'):r.audit(files,expected)
    def test_current_v5_rehashed_native_failures_and_metadata_refuse(self):
        for role,key,value,match in (
          ('original','complete',False,'complete finite native'),('original','firstFailure',{'phase':'native'},'complete finite native'),
          ('original','selectedNativeRuntimeReadbackProved',False,'complete finite native'),
          ('readerReport','selectedFontSha256','4'*64,'independent native-reader'),
          ('readerReport','browserFontSelectionProved',True,'observation boundary'),
          ('run','head_sha','4'*40,'official native run'),('job','run_id',999,'native producing job'),
          ('artifact','expired',True,'native original artifact'),('artifact','id',True,'bounded integer')):
            files,expected,reference,originals=self.native_fresh();changed=D(originals[role]);changed[key]=value;originals[role]=E(changed)
            if role=='original':
                prior=D(originals['expectation']);prior.update(originalSha256=H(originals[role]),originalBytes=len(originals[role]));originals['expectation']=E(prior)
            native_v5_refresh(files,expected,reference,originals)
            with self.assertRaisesRegex(ValueError,match):r.audit(files,expected)
    def test_current_v5_native_official_steps_and_event_refuse_coherent_rehash(self):
        for cut in ('step','event','workflow','source','native-file','report-map'):
            files,expected,reference,originals=self.native_fresh()
            if cut=='step':
                value=D(originals['job']);value['steps'][0]['conclusion']='skipped';originals['job']=E(value)
            elif cut=='event':
                value=D(originals['event']);value['pull_request']['body']='no immutable marker';originals['event']=E(value)
                prior=D(originals['expectation']);prior['eventSha256']=H(originals['event']);originals['expectation']=E(prior)
                value=D(originals['original']);value['event']={'bytes':len(originals['event']),'sha256':H(originals['event'])};originals['original']=E(value)
            elif cut=='workflow':reference['workflow']['commit']='5'*40
            elif cut=='source':
                value=D(originals['original']);next(iter(value['source'].values()))['sha256']='5'*64;originals['original']=E(value)
            elif cut=='native-file':
                value=D(originals['original']);value['nativeRuntime']['after']['files']['/usr/bin/fc-match']['sha256']='5'*64;originals['original']=E(value)
            else:
                value=D(originals['readerReport']);value['nativeRuntimeFiles']['/usr/bin/fc-match']['sha256']='5'*64;originals['readerReport']=E(value)
            prior=D(originals['expectation']);prior.update(originalSha256=H(originals['original']),originalBytes=len(originals['original']));originals['expectation']=E(prior)
            native_v5_refresh(files,expected,reference,originals)
            with self.assertRaises(ValueError):r.audit(files,expected)
    def test_current_v5_font_tool_library_current_job_bytes_before_after(self):
        for stage in ('before','after'):
            for path in ('/checkout/gui-inputs/native-font/fonts/selected.ttf','/usr/bin/fc-match','/usr/lib/libfontconfig-selected.so'):
                files,expected=fixture_v5();value=D(files['runtime.'+stage+'.json']);value['files'][path]['sha256']='0'*64;files['runtime.'+stage+'.json']=E(value)
                with self.assertRaisesRegex(ValueError,'runtime external graph'):r.audit(files,expected)
    def test_current_v5_font_urls_require_full_commit_and_safe_path_before_fetch(self):
        selected='https://raw.githubusercontent.com/google/fonts/'+'9'*40+'/apache/robotomono/RobotoMono%5Bwght%5D.ttf'
        for module in (c,r):
            self.assertEqual(module.google_fonts_raw_url(selected),selected)
            self.assertEqual(module.native_font_fetch_argv(selected,30,4)[-1],selected)
        root='https://raw.githubusercontent.com/google/fonts/'
        bad=(root+'main/apache/robotomono/font.ttf',root+'9'*7+'/font.ttf',
             root+'A'*40+'/font.ttf',root+'9'*40+'/',root+'9'*40+'/../font.ttf',
             root+'9'*40+'/%2e%2e/font.ttf',root+'9'*40+'/font%2Fother.ttf',
             root+'9'*40+'/font\\name.ttf',root+'9'*40+'/font.ttf?branch=main',
             root+'9'*40+'/font.ttf#part',root+'9'*40+'/font\n.ttf')
        for module in (c,r):
            for url in bad:
                with self.subTest(module=module.__name__,url=url),self.assertRaises(ValueError):
                    module.google_fonts_raw_url(url)
                with self.subTest(module=module.__name__,url=url),self.assertRaises(ValueError):
                    module.native_font_fetch_argv(url,30,4)
                files,_=fixture_v5();request=D(files['request.original.json'])
                reference=copy.deepcopy(request['nativeFontAdmission']);reference['font']['url']=url
                with self.subTest(module=module.__name__,url=url),self.assertRaises(ValueError):
                    module.actual_native_font_reference(reference,request['runtime'])
    def test_current_v5_cannot_replace_held_runtime_rows_with_native_extension(self):
        files,expected,reference,originals=self.native_fresh();request=D(files['request.original.json']);path='/usr/lib/libselected.so'
        reference['files'][path]=ROW(b'changed');request['runtime']['files'][path]=ROW(b'changed')
        native=D(originals['request']);native['selection']['runtime']['files'][path]={'bytes':7,'sha256':H(b'changed')};originals['request']=E(native)
        # Reference parser accepts selected current rows; metadata join must still
        # preserve the independently admitted old row rather than union overwrite.
        request['nativeFontAdmission']=reference
        with self.assertRaisesRegex(ValueError,'preserves held metadata'):
            e=copy.deepcopy(expected);e['nativeFontOriginals']['request']=dict(ROW(originals['request']),base64=base64.b64encode(originals['request']).decode())
            r.join_actual_typed_inventory(request,D(base64.b64decode(e['inventoryOriginal']['base64'])),e)
    def staged_request(self,checkout):
        files,expected=fixture_v5();request=D(E(D(files['request.original.json'])).replace(b'/checkout',str(checkout).encode()))
        stage,config=c.native_font_layout(request['nativeFontAdmission']);request['runtime']['files'][str(stage/'fontconfig.xml')]=ROW(config)
        return request
    def staged_host(self,checkout,output,fault=None):
        testcase=self
        class Fake:
            def __init__(self):
                (checkout/'event.json').write_bytes(E({'testOnly':True}))
                self.env={'GITHUB_WORKSPACE':str(checkout),'GITHUB_EVENT_PATH':str(checkout/'event.json'),'GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual','GITHUB_REPOSITORY':r.REPOSITORY};self.calls=[]
            def run(self,role,argv,env,seconds,cap):
                self.calls.append(role);raw=b'font' if role=='native-font.font' else b'notice'
                if fault==role:raw=b'prefix'
                output.save(role+'.stdout',raw);output.save(role+'.stderr',b'')
                value=proc(argv,raw,env=env)
                if fault==role:value.update(exitCode=1,firstFailure='manufactured GET failure')
                output.save(role+'.process.json',E(value))
                if fault==role:raise ValueError('manufactured GET failure')
                testcase.assertEqual(argv,c.native_font_fetch_argv(argv[-1],seconds,len(raw)));testcase.assertEqual(cap,len(raw))
                return raw
        return Fake()
    def test_current_v5_real_inline_stage_reuses_originals_without_second_get(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);(checkout/'gui-inputs').mkdir();(checkout/'gui-setup').mkdir();request=self.staged_request(checkout);pin=H(E(request))
            output=c.Originals(checkout/'gui-setup/preflight');host=self.staged_host(checkout,output)
            stage=c.prepare_native_font(request,pin,checkout,host,output,True)
            self.assertEqual(host.calls,['native-font.font','native-font.notice']);self.assertEqual((stage/'fonts/selected.ttf').read_bytes(),b'font')
            self.assertEqual(stat.S_IMODE(stage.stat().st_mode),0o555);self.assertEqual(stat.S_IMODE((stage/'cache').stat().st_mode),0o700)
            actual=c.Originals(checkout/'actual-font-originals');c.prepare_native_font(request,pin,checkout,host,actual,False)
            self.assertEqual(host.calls,['native-font.font','native-font.notice']);self.assertEqual(output.files['native-font.stage.json'],actual.files['native-font.stage.json'])
            with self.assertRaises(FileExistsError):c.prepare_native_font(request,pin,checkout,host,c.Originals(checkout/'duplicate'),True)
            (stage/'fonts/selected.ttf').chmod(0o644);(stage/'fonts/selected.ttf').write_bytes(b'evil')
            with self.assertRaisesRegex(ValueError,'readonly staged file identity'):c.prepare_native_font(request,pin,checkout,host,c.Originals(checkout/'changed'),False)
    def test_current_v5_second_get_failure_keeps_first_and_partial_originals(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);(checkout/'gui-inputs').mkdir();(checkout/'gui-setup').mkdir();request=self.staged_request(checkout)
            output=c.Originals(checkout/'gui-setup/preflight');host=self.staged_host(checkout,output,'native-font.notice')
            with self.assertRaisesRegex(ValueError,'manufactured GET failure'):c.prepare_native_font(request,H(E(request)),checkout,host,output,True)
            self.assertEqual((output.root/'native-font.font.stdout').read_bytes(),b'font');self.assertEqual((output.root/'native-font.notice.stdout').read_bytes(),b'prefix')
            self.assertFalse((checkout/'gui-inputs/native-font/staging.original.json').exists());self.assertEqual(len(host.calls),2)
    def test_current_v5_source_event_tool_admission_precedes_any_font_get(self):
        for fault in (None,'event','runtime','source'):
            with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
                checkout=pathlib.Path(temporary);(checkout/'gui-inputs').mkdir();(checkout/'gui-setup').mkdir();request=self.staged_request(checkout);raw=E(request);pin=H(raw);order=[]
                event={'action':'labeled','label':{'name':c.LABEL},'sender':{'login':'CrispStrobe'},'repository':{'full_name':c.REPOSITORY},'number':123,
                  'pull_request':{'number':123,'state':'open','head':{'sha':'a'*40,'repo':{'full_name':c.REPOSITORY,'fork':False}},'base':{'ref':'main','repo':{'full_name':c.REPOSITORY}},'body':'<!-- BW_GUI_HDD_REQUEST_SHA256='+pin+' -->'}}
                if fault=='event':event['action']='synchronize'
                (checkout/'event.json').write_bytes(E(event));env={'GITHUB_EVENT_PATH':str(checkout/'event.json'),'GITHUB_WORKSPACE':str(checkout),'GITHUB_REPOSITORY':c.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ATTEMPT':'1','GITHUB_RUN_ID':'200','GITHUB_JOB':'actual','BW_EXPECTED_HEAD':'a'*40}
                original_regular=c.regular
                def regular(path,cap):
                    if str(path)==str(checkout/'vendor-pins.json'):return E({'bw-board':c.BOARD,'bw-circuit-ui':c.HISTORICAL_CUI,'sb3-creator':c.SB3})
                    return original_regular(path,cap)
                def inventory(path,*args):
                    prefix=str(path).removeprefix(str(checkout)+'/');order.append('installed:'+prefix)
                    return {key.removeprefix(prefix+'/'):value for key,value in request['installedFiles'].items() if key.startswith(prefix+'/')}
                def check_file(path,row):
                    name=str(path).removeprefix(str(checkout)+'/')
                    if name in request['source']['files']:
                        order.append('source:'+name)
                        return b'wrong' if fault=='source' else ('source:'+name).encode()
                    return b'manufactured admitted critical file'
                def runtime(value):
                    order.append('runtime')
                    if fault=='runtime':raise ValueError('manufactured tool drift')
                    return {'testOnly':True}
                class Fake:
                    def __init__(self,root_,output,env_):self.env=env_;self.output=output
                    def git(self,args):return (('a'*40 if args[1]=='HEAD' else 'b'*40)+'\n').encode() if args[0]=='rev-parse' else ('source:'+args[-1].split(':',1)[1]).encode()
                def stage(request_,expected_,root_,host,output,preflight):
                    order.append('font-stage');self.assertIn('runtime',order);self.assertIn('installed:node_modules/bw-circuit-ui',order)
                    self.assertTrue(all('source:'+path in order for path in c.SOURCE));return checkout/'gui-inputs/native-font'
                with patch.object(c,'regular',side_effect=regular),patch.object(c,'inventory',side_effect=inventory),patch.object(c,'check_file',side_effect=check_file),patch.object(c,'observe_python_startup',return_value=(b'manufactured startup',{})),patch.object(c,'observe_runtime',side_effect=runtime),patch.object(c,'prepare_native_font',side_effect=stage):
                    status=c.execute(raw,pin,checkout,checkout/'gui-setup/preflight',env,factory=Fake,preflight=True)
                self.assertEqual(status,0 if fault is None else 1)
                self.assertEqual('font-stage' in order,fault is None)

    def test_current_v5_owned_cache_empty_files_symlink_and_count_bounds(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            cache=pathlib.Path(temporary)/'cache';cache.mkdir(mode=0o700);self.assertEqual(c.native_font_cache(cache)['entries'],{})
            (cache/'empty').write_bytes(b'');self.assertEqual(c.native_font_cache(cache)['entries']['empty']['byteLength'],0)
            (cache/'alias').symlink_to('/must-not-read')
            with self.assertRaisesRegex(ValueError,'no-link'):c.native_font_cache(cache)
            (cache/'alias').unlink()
            other=pathlib.Path(temporary)/'outside';other.write_bytes(b'owned but outside cache');os.link(other,cache/'hardlink')
            with self.assertRaisesRegex(ValueError,'external hardlink'):c.native_font_cache(cache)
            with self.assertRaisesRegex(ValueError,'bounded no-link staged'):c.staged_regular(cache/'hardlink',1024)
            (cache/'hardlink').unlink()
            for index in range(128):(cache/('item-'+str(index))).write_bytes(b'')
            with self.assertRaisesRegex(ValueError,'128-entry') as caught:c.native_font_cache(cache)
            partial=D(caught.exception.gui_cache_original);self.assertEqual(len(partial['entries']),128);self.assertFalse(partial['quotaEnforced'])
    def test_current_v5_staging_original_and_real_browser_env_refuse_rehash(self):
        for cut in ('config','url','get-body','env','cache-cap','cache-quota','cache-alias','cache-hardlink','directories','event','serial'):
            files,expected=fixture_v5()
            if cut=='config':files['native-font.config.original.xml']=b'<fontconfig><dir>/usr/share/fonts</dir></fontconfig>'
            elif cut=='url':value=D(files['native-font.stage.json']);value['fontUrl']='https://example.invalid/font';files['native-font.stage.json']=E(value)
            elif cut=='get-body':
                files['native-font.font.stdout']=b'evil';value=D(files['native-font.font.process.json']);value['streams']['stdout']=ROW(b'evil');files['native-font.font.process.json']=E(value)
            elif cut=='env':value=D(files['forward-debug.process.json']);value['environment']['FONTCONFIG_FILE']='/etc/fonts/fonts.conf';files['forward-debug.process.json']=E(value)
            elif cut=='directories':
                value=D(files['runtime.after.json']);next(iter(value['nativeFontDirectories'].values()))['names'].append('unreviewed.ttf');files['runtime.after.json']=E(value)
            elif cut=='event':
                value=D(files['native-font.stage.json']);value['platform']['GITHUB_RUN_ID']='201';files['native-font.stage.json']=E(value)
            elif cut=='serial':
                value=D(files['native-font.notice.process.json']);value['startedNs']=1;files['native-font.notice.process.json']=E(value)
            else:
                value=D(files['native-font.cache.after.json'])
                if cut=='cache-hardlink':
                    value['entries']['linked']={'kind':'file','identity':dict(value['identity'],mode=stat.S_IFREG|0o644,nlink=2,size=3),'byteLength':3,'sha256':H(b'abc')};value['totalBytes']=3
                elif cut=='cache-cap':value['totalBytes']=8*1024*1024+1
                elif cut=='cache-quota':value['quotaEnforced']=True
                else:value['identity']['mode']=stat.S_IFLNK|0o700
                files['native-font.cache.after.json']=E(value)
            with self.assertRaises(ValueError):r.audit(files,expected)

    def finite_inventory_fixture(self,failed=False):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']+(['/missing-library'] if failed else [])
        faults={('lstat','/missing-library'):FileNotFoundError('FIRST_FINITE_LIBRARY')} if failed else {}
        with patch.object(c,'FINITE_INVENTORY_ENABLED',True),self.inventory_edges(paths,faults=faults,finite=True) as (raw,pin,env,events),self.empty_source_edges() as typed:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v4' if failed else 'bw.gui-hdd.inventory-admission.v4',
          'source':D(self.files['source.before.json']),'template':ROW(raw),'runId':90,'workflowSha':'d'*40}
        expected['failure' if failed else 'original']=ROW(E(value));return value,raw,expected,events
    def test_finite_v4_real_collector_standalone_reader_without_probes(self):
        value,raw,expected,events=self.finite_inventory_fixture()
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v4',value.get('firstFailure'))
        result=r.verify_inventory_original(E(value),raw,expected);self.assertEqual(result['schema'],'bw.gui-hdd.inventory-reader.v4')
        self.assertIn(('installed','/checkout/node_modules/bw-circuit-ui'),events)
        for key in ('fontSelectionProved','browserFontSelectionProved','guestApproved'):self.assertIs(value[key],False)
        self.assertFalse(value['scope']['globalFontDiscovery']);self.assertFalse(result['actualRequestSupported'])
        self.assertEqual(sum(event[0]=='git' for event in events),2+len(c.SOURCE))
        self.assertLess(len(raw),32768);self.assertLess(len(E(value)),r.JSON_CAP)
    def test_finite_v4_flags_refuse_before_all_edges_and_legacy_entry_is_distinct(self):
        self.assertIs(c.FINITE_INVENTORY_ENABLED,False);self.assertIs(c.ACTUAL_ENABLED,False)
        with patch.object(c.Path,'cwd',side_effect=AssertionError('cwd')),patch.object(c,'regular',side_effect=AssertionError('read')),patch.object(c,'admit_finite_inventory_before_setup',side_effect=AssertionError('guard')):
            for args in (['finite-inventory-guard'],['finite-inventory','--request','none','--expected-sha256','0'*64,'--output','none']):
                with self.assertRaisesRegex(ValueError,'finite v4 inventory disabled'):c.main(args)
        _,raw,_,_=self.finite_inventory_fixture()
        with patch.object(c,'regular',return_value=raw),patch.object(c,'inventory_observation',side_effect=AssertionError('old mode called new observer')):
            with self.assertRaisesRegex(ValueError,'distinct finite and historical'):c.main(['inventory','--request','selected','--expected-sha256',H(raw),'--output','selected-out'])
    def test_finite_v4_enabled_cli_routes_only_admitted_metadata_no_installer_or_guest(self):
        self.assertFalse(c.FINITE_INVENTORY_ENABLED);self.assertFalse(c.ACTUAL_ENABLED)
        with patch.object(c,'FINITE_INVENTORY_ENABLED',True),patch.dict(c.os.environ,{},clear=True),patch.object(c.Path,'cwd',return_value=pathlib.Path('/checkout')),patch.object(c,'regular',side_effect=AssertionError('unadmitted input read')),patch.object(c,'execute',side_effect=AssertionError('guest')):
            with self.assertRaisesRegex(ValueError,'hexadecimal digest'):c.main(['finite-inventory-guard'])
        with patch.object(c,'FINITE_INVENTORY_ENABLED',True),patch.dict(c.os.environ,{},clear=True),patch.object(c.Path,'cwd',return_value=pathlib.Path('/checkout')),patch.object(c,'admit_finite_inventory_before_setup',return_value={'pass':True}) as guard,patch.object(c,'execute',side_effect=AssertionError('guest')),patch.object(c,'install_input',side_effect=AssertionError('input GET')):
            self.assertEqual(c.main(['finite-inventory-guard']),0);guard.assert_called_once_with(pathlib.Path('/checkout'),{})
        value,raw,_,_=self.finite_inventory_fixture();pin=H(raw)
        with patch.object(c,'FINITE_INVENTORY_ENABLED',True),patch.dict(c.os.environ,{'BW_FINITE_INVENTORY_V4_SHA256':pin},clear=True),patch.object(c.Path,'cwd',return_value=pathlib.Path('/checkout')),patch.object(c,'regular',return_value=raw),patch.object(c,'inventory_observation',return_value=value) as collect,patch.object(c,'retain_inventory_observation',return_value=0),patch.object(c,'execute',side_effect=AssertionError('guest')),patch.object(c,'install_input',side_effect=AssertionError('input GET')):
            self.assertEqual(c.main(['finite-inventory','--request','/checkout/gui-finite-inventory-v4/runtime-template.json','--expected-sha256',pin,'--output','/checkout/gui-finite-inventory-v4/inventory-original.json']),0)
            self.assertEqual(collect.call_count,1);self.assertEqual(collect.call_args.args[:2],(raw,pin))

    def test_finite_v4_scope_required_roles_body_transport_and_cap_cuts(self):
        _,raw,_,_=self.finite_inventory_fixture();template=D(raw)
        for module in (c,r):
            self.assertEqual(module.finite_inventory_body_template(finite_body_fixture(raw),H(raw)),raw)
            for path in ('/etc/fonts/fonts.conf','/usr/share/fontconfig/conf.avail/20.conf','/usr/share/fonts/selected.ttf','/usr/local/share/fonts/extra.otf','/var/cache/fontconfig/cache','/checkout/gui-inputs/native-font/fonts/selected.ttf'):
                changed=copy.deepcopy(template);changed['files']=sorted(changed['files']+[path]);encoded=E(changed)
                with self.assertRaisesRegex(ValueError,'excludes global'):module.finite_inventory_template(encoded,H(encoded))
            for cut in ('curl','library','scope','guest','empty','duplicate'):
                changed=copy.deepcopy(template)
                if cut=='curl':changed['files'].remove('/usr/bin/curl')
                elif cut=='library':changed['libraries']=['/not-selected.so']
                elif cut=='scope':changed['scope']['globalFontDiscovery']=True
                elif cut=='guest':changed['scope']['guestApproved']=True
                elif cut=='empty':changed['emptyPythonSources'][c.EMPTY_PYTHON_PATH]['byteLength']=1
                else:changed['aliases']=[changed['files'][0]]
                encoded=E(changed)
                with self.assertRaises(ValueError):module.finite_inventory_template(encoded,H(encoded))
            body=finite_body_fixture(raw)
            for changed in (body+body,body.replace('END','BEGIN'),body.replace(H(raw),'0'*64),body.replace('templateBase64','unknown'),body.replace('"schema":','"schema" :')):
                with self.assertRaises(ValueError):module.finite_inventory_body_template(changed,H(raw))
            large=copy.deepcopy(template);large['files']=sorted(large['files']+['/selected/'+str(index)+'x'*330 for index in range(110)]);encoded=E(large)
            self.assertGreater(len(encoded),32768);self.assertLess(len(encoded),65536)
            with self.assertRaisesRegex(ValueError,'selected finite v4 template bytes'):module.finite_inventory_template(encoded,H(encoded))
        text=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text();old='FINITE_INVENTORY_TEMPLATE_CAP = 32 << 10';self.assertIn(old,text)
        namespace={'__name__':'finite_template_cap_mutant'};exec(compile(text.replace(old,'FINITE_INVENTORY_TEMPLATE_CAP = 64 << 10',1),'finite-cap-mutant','exec'),namespace)
        self.assertEqual(namespace['finite_inventory_template'](encoded,H(encoded)),large)
    def test_finite_v4_event_first_attempt_owner_body_and_source_cuts(self):
        value,raw,_,_=self.finite_inventory_fixture();event_raw=base64.b64decode(value['event']['base64']);env=value['platform']
        for module in (c,r):
            self.assertEqual(module.bind_finite_inventory_event(event_raw,'a'*40,H(raw),env),raw)
            for key,wrong in (('GITHUB_RUN_ATTEMPT','2'),('GITHUB_JOB','inventory'),('GITHUB_ACTOR','other'),('BW_EXPECTED_HEAD','f'*40)):
                with self.assertRaises(ValueError):module.bind_finite_inventory_event(event_raw,'a'*40,H(raw),dict(env,**{key:wrong}))
            for cut in ('label','fork','head','body'):
                event=D(event_raw)
                if cut=='label':event['label']['name']='x86-hdd-gui-inventory'
                elif cut=='fork':event['pull_request']['head']['repo']['fork']=True
                elif cut=='head':event['pull_request']['head']['sha']='f'*40
                else:event['pull_request']['body']='missing wrapper'
                with self.assertRaises(ValueError):module.bind_finite_inventory_event(E(event),'a'*40,H(raw),env)
    def test_finite_v4_prepackage_guard_real_source_reads_and_no_url_transport(self):
        _,template_raw,_,_=self.finite_inventory_fixture()
        for fault in (None,'source','event','source-retention'):
            with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
                checkout=pathlib.Path(temporary)
                for path in c.SOURCE:
                    target=checkout/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(('source:'+path).encode())
                if fault in ('source','source-retention'):(checkout/sorted(c.SOURCE)[0]).write_bytes(b'wrong')
                event={'action':'labeled','label':{'name':'x86-hdd-gui-finite-inventory-v4'},'sender':{'login':'CrispStrobe'},'repository':{'full_name':c.REPOSITORY},'number':123,
                  'pull_request':{'number':123,'state':'open','head':{'sha':'a'*40,'repo':{'full_name':c.REPOSITORY,'fork':False}},'base':{'ref':'main','repo':{'full_name':c.REPOSITORY}},'body':finite_body_fixture(template_raw)}}
                if fault=='event':event['label']['name']='old'
                (checkout/'event.json').write_bytes(E(event));calls=[]
                env={'GITHUB_WORKSPACE':str(checkout),'GITHUB_EVENT_PATH':str(checkout/'event.json'),'GITHUB_RUN_ID':'90','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'finite-inventory-v4',
                  'GITHUB_REPOSITORY':c.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','BW_EXPECTED_HEAD':'a'*40,'BW_FINITE_INVENTORY_V4_SHA256':H(template_raw),'GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_WORKFLOW_REF':c.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@refs/pull/123/merge'}
                class GitOnly:
                    def __init__(self,*args):pass
                    def git(self,args):
                        calls.append(args)
                        return ((('a'*40 if args[1]=='HEAD' else 'b'*40)+'\n').encode() if args[0]=='rev-parse' else ('source:'+args[-1].split(':',1)[1]).encode())
                if fault:
                    with patch.object(c,'FINITE_INVENTORY_ENABLED',True),patch.object(c.Originals,'seal',side_effect=OSError('SECONDARY_SEAL')) if fault=='source-retention' else contextlib.nullcontext(),contextlib.redirect_stderr(io.StringIO()) as diagnostic:
                        with self.assertRaises(ValueError) as caught:c.admit_finite_inventory_before_setup(checkout,env,factory=GitOnly)
                    if fault=='source-retention':
                        self.assertIn('SECONDARY_SEAL',diagnostic.getvalue());self.assertEqual(caught.exception.gui_secondary[-1][0],'finite-guard-retention')
                    self.assertFalse((checkout/'gui-finite-inventory-v4/runtime-template.json').exists())
                    if fault=='event':self.assertEqual(calls,[])
                else:
                    with patch.object(c,'FINITE_INVENTORY_ENABLED',True):result=c.admit_finite_inventory_before_setup(checkout,env,factory=GitOnly)
                    self.assertTrue(result['pass']);self.assertEqual(len(calls),len(c.SOURCE)+2)
                    selected=checkout/'gui-finite-inventory-v4/runtime-template.json';self.assertEqual(selected.read_bytes(),template_raw);self.assertEqual(stat.S_IMODE(selected.stat().st_mode),0o444)
                    guard=(checkout/'gui-finite-inventory-v4/guard-admission.json').read_bytes();self.assertEqual(r.finite_inventory_guard_original(guard,template_raw,E(event),env),result)
    def test_finite_v4_failed_original_is_preserved_without_promoting_legacy(self):
        value,raw,expected,events=self.finite_inventory_fixture(True)
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-failure.v4');self.assertIn('FIRST_FINITE_LIBRARY',value['firstFailure']['message']);self.assertFalse(value['gitSource']['reached'])
        result=r.verify_inventory_failure(E(value),raw,expected);self.assertFalse(result['qualified']);self.assertFalse(result['candidate'])
        self.assertFalse(any(event[0]=='git' for event in events));self.assertIs(value['guestApproved'],False)
        changed=copy.deepcopy(value);changed['guestApproved']=True
        frame=copy.deepcopy(changed);frame.update(files={},emptyPythonSources={},aliases={},directoryAliases={},firstFailure=None,secondary=[],gitSource={'reached':False,'head':None,'tree':None,'files':{}},diagnostic={'pathBytes':0,'limitBytes':0,'complete':False})
        changed['diagnostic']['limitBytes']=r.JSON_CAP-len(E(frame))-8192;selected=copy.deepcopy(expected);selected['failure']=ROW(E(changed))
        with self.assertRaisesRegex(ValueError,'grants no font/browser/guest authority'):r.verify_inventory_failure(E(changed),raw,selected)
    def test_finite_v4_coherent_source_guard_cui_and_authority_cuts(self):
        value,raw,expected,_=self.finite_inventory_fixture()
        for cut in ('cui','guard-source','guard-setup','guest','scope','event'):
            changed=copy.deepcopy(value)
            if cut=='cui':del changed['installedFiles']['node_modules/bw-circuit-ui/package.json']
            elif cut.startswith('guard-'):
                guard=D(base64.b64decode(changed['guardAdmission']['base64']))
                if cut=='guard-source':guard['source']['tree']='f'*40
                else:guard['setupTrustBoundary']['completeRuntimeBeforeSetupProved']=True
                encoded=E(guard);changed['guardAdmission']=dict(ROW(encoded),base64=base64.b64encode(encoded).decode())
            elif cut=='guest':changed['guestApproved']=True
            elif cut=='scope':changed['scope']['historicalGlobalRosterQualified']=True
            else:changed['platform']['GITHUB_JOB']='inventory'
            selected=copy.deepcopy(expected);selected['original']=ROW(E(changed))
            with self.assertRaises(ValueError):r.verify_inventory_original(E(changed),raw,selected)
    def test_finite_v4_workflow_guard_before_packages_and_v5_exact_basis(self):
        workflow=(root/'.github/workflows/i80386-hdd-gui-actual.yml').read_text()
        block=workflow.split('  finite-inventory-v4:',1)[1].split('  finite-inventory-five:',1)[0]
        self.assertIn(chr(36)+'{{ false &&',block);self.assertIn('x86-hdd-gui-finite-inventory-v4',block)
        self.assertLess(block.index('finite-inventory-guard'),block.index('actions/setup-node@'));self.assertLess(block.index('finite-inventory-guard'),block.index('npm ci'))
        self.assertIn('github.event.pull_request.head.repo.fork == false',block);self.assertIn("github.event.pull_request.base.ref == 'main'",block)
        self.assertNotIn('install-input',block);self.assertNotIn('BW_TEMPLATE_BLOB',block)
        armed=workflow.split('  finite-inventory-five:',1)[1].split('  actual:',1)[0]
        self.assertIn(chr(36)+'{{ false &&',armed);self.assertIn('x86-hdd-gui-finite-inventory-v5',armed)
        self.assertLess(armed.index('finite-inventory-v5-guard'),armed.index('actions/setup-node@'))
        files,expected=fixture_v5();request=D(files['request.original.json']);self.assertEqual(request['inventoryAdmission']['schema'],'bw.gui-hdd.actual-finite-inventory-reference.v1')
        self.assertEqual(request['inventoryAdmission']['metadataAdmission']['schema'],'bw.gui-hdd.inventory-admission.v4');self.assertTrue(r.audit(files,expected)['pass'])
        request['inventoryAdmission']['schema']='bw.gui-hdd.actual-inventory-reference.v1';raw=E(request)
        for module in (c,r):
            with self.assertRaises(ValueError):module.parse_request(raw,H(raw))

    def finite_v5_packet(self):
        value,old_raw,expected,_=self.finite_inventory_fixture()
        template=D(old_raw);template['schema']='bw.gui-hdd.inventory-template.v5';template['scope']=c.finite_v5_scope();raw=E(template)
        wrapper={'schema':'bw.gui-hdd.finite-inventory-transport.v5','sha256':H(raw),
          'templateBase64':base64.b64encode(raw).decode()}
        event=D(base64.b64decode(value['event']['base64']))
        event['label']['name']='x86-hdd-gui-finite-inventory-v5'
        event['pull_request']['body']=c.FINITE_V5_BEGIN+'\n'+E(wrapper).decode()+c.FINITE_V5_END
        event_raw=E(event)
        value['schema']='bw.gui-hdd.inventory-original.v5';value['templateSha256']=H(raw)
        value['scope']=c.finite_v5_scope();value['event']=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode())
        value['platform']['GITHUB_JOB']='finite-inventory-five'
        for name in c.INSTALLED_V5_CRITICAL:value['installedFiles'].setdefault(name,ROW(b'critical'))
        value['installedFiles']['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        guard=D(base64.b64decode(value['guardAdmission']['base64']))
        guard.update(schema='bw.gui-hdd.finite-inventory-guard.v5',templateSha256=H(raw),eventSha256=H(event_raw))
        guard['platform']['GITHUB_JOB']='finite-inventory-five'
        guard_raw=E(guard);value['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
        expected['schema']='bw.gui-hdd.inventory-admission.v5';expected['template']=ROW(raw);expected['original']=ROW(E(value))
        return value,raw,expected
    def finite_v6_packet(self):
        value,old_raw,expected=self.finite_v5_packet()
        template=D(old_raw);template['schema']='bw.gui-hdd.inventory-template.v6';raw=E(template)
        event=D(base64.b64decode(value['event']['base64']))
        event['label']['name']='x86-hdd-gui-finite-inventory-v6'
        event['pull_request']['body']+='\n'+c.FINITE_V6_BEGIN+'\n'+H(raw)+'\n'+c.FINITE_V6_END
        event_raw=E(event)
        value['schema']='bw.gui-hdd.inventory-original.v6';value['templateSha256']=H(raw)
        value['event']=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode())
        value['platform']['GITHUB_JOB']='finite-inventory-six'
        value['installedFiles']['node_modules/bw-circuit-ui/src/index.js']=ROW(b'actual index')
        guard=D(base64.b64decode(value['guardAdmission']['base64']))
        guard.update(schema='bw.gui-hdd.finite-inventory-guard.v6',templateSha256=H(raw),eventSha256=H(event_raw))
        guard['platform']['GITHUB_JOB']='finite-inventory-six'
        guard_raw=E(guard);value['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
        variables={'BW_FINITE_INVENTORY_V6_SHA256':H(raw),
          'BW_FINITE_INVENTORY_V6_TEMPLATE_B64':base64.b64encode(raw).decode()}
        expected.update(schema='bw.gui-hdd.inventory-admission.v6',template=ROW(raw),original=ROW(E(value)),repositoryVariables=variables)
        return value,raw,expected
    def finite_v7_packet(self):
        # Manufactured current-supplier input only; no installed observation is inferred.
        value,old_raw,expected=self.finite_v6_packet()
        vendor=E(c.FINITE_V7_PINS);vendor_row=ROW(vendor)
        template=D(old_raw);template.update(schema='bw.gui-hdd.inventory-template.v7',
          dependencyPins=copy.deepcopy(c.FINITE_V7_PINS));raw=E(template)
        source=copy.deepcopy(value['source']);source['files']['vendor-pins.json']=vendor_row
        value['source']=source;expected['source']=source
        for name in tuple(value['installedFiles']):
            if name.startswith('node_modules/bw-circuit-ui/'):
                value['installedFiles'][name]=ROW(('synthetic-408:'+name).encode())
        for name,(size,sha256) in c.FINITE_V7_CUI_WITNESSES.items():
            value['installedFiles'][name]={'byteLength':size,'sha256':sha256}
        event=D(base64.b64decode(value['event']['base64']))
        event['label']['name']='x86-hdd-gui-finite-inventory-v7'
        event['pull_request']['body']+='\n'+c.FINITE_V7_BEGIN+'\n'+H(raw)+'\n'+c.FINITE_V7_END
        event_raw=E(event)
        value.update(schema='bw.gui-hdd.inventory-original.v7',templateSha256=H(raw),
          event=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode()),
          dependencyPins=copy.deepcopy(c.FINITE_V7_PINS))
        value['platform']['GITHUB_JOB']='finite-inventory-seven'
        index=2+sorted(c.SOURCE).index('vendor-pins.json')
        value['commands'][index]['stdout']=vendor_row
        guard=D(base64.b64decode(value['guardAdmission']['base64']))
        guard.update(schema='bw.gui-hdd.finite-inventory-guard.v7',templateSha256=H(raw),
          eventSha256=H(event_raw),source=source,dependencyPins=copy.deepcopy(c.FINITE_V7_PINS),
          vendorPinsOriginal=dict(vendor_row,base64=base64.b64encode(vendor).decode()))
        guard['platform']['GITHUB_JOB']='finite-inventory-seven'
        guard_raw=E(guard);value['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
        variables={'BW_FINITE_INVENTORY_V7_SHA256':H(raw),
          'BW_FINITE_INVENTORY_V7_TEMPLATE_B64':base64.b64encode(raw).decode()}
        expected.update(schema='bw.gui-hdd.inventory-admission.v7',template=ROW(raw),
          original=ROW(E(value)),repositoryVariables=variables,
          dependencyPins=copy.deepcopy(c.FINITE_V7_PINS))
        return value,raw,expected
    def finite_v8_packet(self):
        value,old,expected=self.finite_v7_packet();template=D(old)
        template.update(schema='bw.gui-hdd.inventory-template.v8',dependencyPins=copy.deepcopy(c.FINITE_V8_PINS),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE));raw=E(template)
        event=D(base64.b64decode(value['event']['base64']));event['label']['name']='x86-hdd-gui-finite-inventory-v8'
        event['pull_request']['body']+='\n'+c.FINITE_V8_BEGIN+'\n'+H(raw)+'\n'+c.FINITE_V8_END;event_raw=E(event)
        value.update(schema='bw.gui-hdd.inventory-original.v8',templateSha256=H(raw),event=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode()),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE))
        value['platform']['GITHUB_JOB']='finite-inventory-eight'
        guard=finite_guard_fixture(value['source'],raw,event_raw,value['platform'],8)
        value['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode())
        value['bootstrapAdmission']=guard['bootstrapAdmission']
        value['bootstrapHelper']=c.bootstrap_helper_output(b'Prepared official Ubuntu archive: 0 source file(s) changed\n',b'')
        expected.update(schema='bw.gui-hdd.inventory-admission.v8',template=ROW(raw),original=ROW(E(value)),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE),dependencyPins=copy.deepcopy(c.FINITE_V8_PINS),
          repositoryVariables={'BW_FINITE_INVENTORY_V8_SHA256':H(raw),'BW_FINITE_INVENTORY_V8_TEMPLATE_B64':base64.b64encode(raw).decode()})
        return value,raw,expected

    def test_finite_v8_retired_defaults_disabled_seams_and_historical_identity_independence(self):
        self.assertIs(c.FINITE_INVENTORY_V7_ENABLED,False);self.assertIs(c.FINITE_INVENTORY_V8_ENABLED,False)
        self.assertIs(r.FINITE_INVENTORY_V7_READER_ENABLED,True);self.assertIs(r.FINITE_INVENTORY_V8_READER_ENABLED,True)
        with patch.object(c,'FINITE_INVENTORY_V8_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('read')),patch.object(c,'Hosted',side_effect=AssertionError('tool')):
            for args in (['finite-inventory-v7-guard'],['finite-inventory-v8-guard'],['finite-inventory-v8','--request','x','--expected-sha256','0'*64,'--output','x']):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        old=copy.deepcopy(c.FINITE_V7_PINS)
        with patch.object(c,'CURRENT_BOARD','0'*40),patch.object(c,'CUI','1'*40):self.assertEqual(c.FINITE_V7_PINS,old)
        self.assertIsNot(c.FINITE_V7_CUI_WITNESSES,c.FINITE_V8_CUI_WITNESSES)

    def test_finite_v8_coherent_current_role_drift_keeps_historical_f7(self):
        old,old_raw,old_expected=self.finite_v7_packet()
        old6,raw6,expected6=self.finite_v6_packet()
        current,raw,expected=self.finite_v8_packet()
        pins={'bw-board':'2'*40,'bw-circuit-ui':'3'*40,'sb3-creator':'5'*40}
        witnesses={name:(size+1,'4'*64) for name,(size,digest_) in c.FINITE_V8_CUI_WITNESSES.items()}
        with patch.object(c,'CURRENT_SB3',pins['sb3-creator']),patch.object(r,'CURRENT_SB3',pins['sb3-creator']),patch.object(c,'CURRENT_BOARD',pins['bw-board']),patch.object(c,'CUI',pins['bw-circuit-ui']),patch.object(r,'CURRENT_BOARD',pins['bw-board']),patch.object(r,'CUI_V8',pins['bw-circuit-ui']),patch.object(c,'FINITE_V8_PINS',pins),patch.object(r,'FINITE_V8_PINS',pins),patch.object(c,'FINITE_V8_CUI_WITNESSES',witnesses),patch.object(r,'FINITE_V8_CUI_WITNESSES',witnesses):
            for module in (c,r):module.finite_v6_template(raw6,H(raw6))
            self.assertEqual(r.verify_inventory_original(E(old6),raw6,expected6)['schema'],'bw.gui-hdd.inventory-reader.v6')
            # Real historical parser/guard/reader continue accepting old identities.
            for module in (c,r):
                module.finite_v7_template(old_raw,H(old_raw))
                guard=base64.b64decode(old['guardAdmission']['base64']);event=base64.b64decode(old['event']['base64'])
                module.finite_v7_guard_original(guard,old_raw,event,old['platform'])
            self.assertEqual(r.verify_inventory_original(E(old),old_raw,old_expected)['schema'],'bw.gui-hdd.inventory-reader.v7')
            changed=copy.deepcopy(expected);changed['dependencyPins']=copy.deepcopy(pins)
            with self.assertRaises(ValueError):r.verify_inventory_original(E(current),raw,changed)
            # Coherently author new current pins/source/guard/template, leaving OLD
            # installed witnesses: current admission must still reject those rows.
            template=D(raw);template['dependencyPins']=copy.deepcopy(pins);newraw=E(template)
            value=copy.deepcopy(current);vendor=E(pins);value['source']['files']['vendor-pins.json']=ROW(vendor)
            value['dependencyPins']=copy.deepcopy(pins);value['templateSha256']=H(newraw)
            event=D(base64.b64decode(value['event']['base64']));event['pull_request']['body']=finite_body_fixture(newraw,8);eventraw=E(event)
            value['event']=dict(ROW(eventraw),base64=base64.b64encode(eventraw).decode())
            value['commands'][2+sorted(c.SOURCE).index('vendor-pins.json')]['stdout']=ROW(vendor)
            guard=finite_guard_fixture(value['source'],newraw,eventraw,value['platform'],8)
            value['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode())
            changed.update(source=value['source'],template=ROW(newraw),original=ROW(E(value)),repositoryVariables={'BW_FINITE_INVENTORY_V8_SHA256':H(newraw),'BW_FINITE_INVENTORY_V8_TEMPLATE_B64':base64.b64encode(newraw).decode()})
            with self.assertRaisesRegex(ValueError,'source identity witness'):r.verify_inventory_original(E(value),newraw,changed)
            for name,(size,digest_) in witnesses.items():value['installedFiles'][name]={'byteLength':size,'sha256':digest_}
            changed['original']=ROW(E(value))
            self.assertEqual(r.verify_inventory_original(E(value),newraw,changed)['schema'],'bw.gui-hdd.inventory-reader.v8')

    def test_finite_v8_real_guard_cli_before_packages_and_coherent_preedge_cuts(self):
        value,raw,expected=self.finite_v8_packet();event=base64.b64decode(value['event']['base64']);calls=[]
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            for path,row in expected['source']['files'].items():
                target=checkout/path;target.parent.mkdir(exist_ok=True,parents=True)
                body=E(c.FINITE_V8_PINS) if path=='vendor-pins.json' else ('source:'+path).encode()
                self.assertEqual(ROW(body),row);target.write_bytes(body)
            helper=checkout/c.BOOTSTRAP_HELPER;helper.parent.mkdir(exist_ok=True,parents=True);helper.write_bytes((root/c.BOOTSTRAP_HELPER).read_bytes())
            eventpath=checkout/'event.json';eventpath.write_bytes(event)
            env=dict(value['platform'],**expected['repositoryVariables'],GITHUB_WORKSPACE=str(checkout),GITHUB_EVENT_PATH=str(eventpath),GITHUB_WORKFLOW_REF=value['platform']['GITHUB_WORKFLOW_REF'],GITHUB_EVENT_NAME='pull_request',GITHUB_ACTOR='CrispStrobe')
            class Fake:
                def __init__(self,where,capture,environment):calls.append(('host',str(where)))
                def git(self,args):
                    calls.append(('git',args))
                    if args==['rev-parse','HEAD']:return (expected['source']['head']+'\n').encode()
                    if args==['rev-parse','HEAD^{tree}']:return (expected['source']['tree']+'\n').encode()
                    if args[0]=='ls-tree':return (c.BOOTSTRAP_SOURCE['mode']+' blob '+c.BOOTSTRAP_SOURCE['gitBlob']+'\t'+c.BOOTSTRAP_HELPER+'\n').encode()
                    return (checkout/args[2].split(':',1)[1]).read_bytes()
            with patch.object(c,'FINITE_INVENTORY_V8_ENABLED',True),patch.object(c.Path,'cwd',return_value=checkout),patch.dict(c.os.environ,env),patch.object(c,'Hosted',Fake):
                self.assertEqual(c.main(['finite-inventory-v8-guard']),0)
            guard=(checkout/'gui-finite-inventory-v8/guard-admission.json').read_bytes()
            self.assertTrue(r.finite_v8_guard_original(guard,raw,event,env)['pass'])
            self.assertEqual(len([entry for kind,entry in calls if kind=='git']),2+len(c.SOURCE)+2)
            before=list(calls)
            for cut in ('label','head','attempt-bool','attempt-float','event-number-bool','old-template','helper-path','helper-blob','helper-mode','helper-size-bool','helper-sha'):
                changed_env=dict(env);changed_event=D(event);template=D(raw)
                if cut=='label':changed_event['label']['name']='x86-hdd-gui-finite-inventory-v7'
                elif cut=='head':changed_env['BW_EXPECTED_HEAD']='0'*40
                elif cut=='attempt-bool':changed_env['GITHUB_RUN_ATTEMPT']=True
                elif cut=='attempt-float':changed_env['GITHUB_RUN_ATTEMPT']=1.0
                elif cut=='event-number-bool':changed_event['number']=True
                else:
                    if cut=='old-template':template['schema']='bw.gui-hdd.inventory-template.v7'
                    else:
                        key={'helper-path':'path','helper-blob':'gitBlob','helper-mode':'mode','helper-size-bool':'byteLength','helper-sha':'sha256'}[cut]
                        template['bootstrapSource'][key]=True if key=='byteLength' else 'foreign'
                    selected=E(template);changed_env['BW_FINITE_INVENTORY_V8_SHA256']=H(selected);changed_env['BW_FINITE_INVENTORY_V8_TEMPLATE_B64']=base64.b64encode(selected).decode();changed_event['pull_request']['body']=finite_body_fixture(selected,8)
                with patch.object(c,'FINITE_INVENTORY_V8_ENABLED',True),patch.object(c.Path,'cwd',return_value=checkout),patch.object(c.os,'environ',changed_env),patch.object(c,'regular',return_value=E(changed_event)),patch.object(c,'Hosted',side_effect=AssertionError('Git/package/browser edge')):
                    with self.subTest(cut=cut),self.assertRaises(ValueError):c.main(['finite-inventory-v8-guard'])
            self.assertEqual(calls,before)

    @patch.object(c,'FINITE_INVENTORY_V8_ENABLED',True)
    def test_finite_v8_genuine_partial_failure_reader_retains_first_error(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so','/denied']
        with self.inventory_edges(paths,finite=True,finite_version=8,faults={('read','/denied'):OSError('FIRST_SELECTED_READ')}) as (raw,pin,env,events),self.empty_source_edges():
            failed=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(failed['schema'],'bw.gui-hdd.inventory-failure.v8');self.assertEqual(failed['firstFailure']['message'],'FIRST_SELECTED_READ')
        self.assertFalse(any(kind in ('installed','git') for kind,item in events))
        _value,_raw,selected=self.finite_v8_packet()
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v8','source':selected['source'],'template':ROW(raw),'failure':ROW(E(failed)),'runId':90,'workflowSha':'d'*40,'dependencyPins':copy.deepcopy(c.FINITE_V8_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),
          'repositoryVariables':{'BW_FINITE_INVENTORY_V8_SHA256':pin,'BW_FINITE_INVENTORY_V8_TEMPLATE_B64':base64.b64encode(raw).decode()}}
        verdict=r.verify_inventory_failure(E(failed),raw,expected)
        self.assertTrue(verdict['failureObserved']);self.assertFalse(verdict['qualified']);self.assertFalse(verdict['candidate']);self.assertFalse(verdict['gitSourceReached'])
        for cut in ('old-schema','old-job','event-bool','wrong-helper'):
            value=copy.deepcopy(failed);chosen=copy.deepcopy(expected)
            if cut=='old-schema':value['schema']='bw.gui-hdd.inventory-failure.v7'
            elif cut=='old-job':value['platform']['GITHUB_JOB']='finite-inventory-seven'
            elif cut=='event-bool':value['event']['byteLength']=True
            else:chosen['bootstrapSource']['path']='scripts/foreign.mjs'
            chosen['failure']=ROW(E(value))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_failure(E(value),raw,chosen)

    def test_finite_v8_independent_reader_and_source_sidecar_cuts(self):
        value,raw,expected=self.finite_v8_packet()
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v8')
        for cut in ('path','blob','mode','bytes','sha','workspace','head','helper-output','helper-stderr','old-job','old-pins'):
            packet=copy.deepcopy(value);chosen=copy.deepcopy(expected)
            if cut in ('path','blob','mode','bytes','sha'):
                key={'path':'path','blob':'gitBlob','mode':'mode','bytes':'byteLength','sha':'sha256'}[cut]
                chosen['bootstrapSource'][key]='foreign' if key!='byteLength' else True
            elif cut=='workspace':packet['bootstrapAdmission']['workspace']['sha256']='0'*64
            elif cut=='head':packet['bootstrapAdmission']['gitHead']='0'*40
            elif cut=='helper-output':packet['bootstrapHelper']['stdout']=dict(ROW(b'foreign'),base64=base64.b64encode(b'foreign').decode())
            elif cut=='helper-stderr':packet['bootstrapHelper']['stderr']=dict(ROW(b'error'),base64=base64.b64encode(b'error').decode())
            elif cut=='old-job':packet['platform']['GITHUB_JOB']='finite-inventory-seven'
            else:chosen['dependencyPins']['bw-board']=c.BOARD
            chosen['original']=ROW(E(packet))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original(E(packet),raw,chosen)
        args=['--inventory-original-v8','--original','x','--template','y','--expected','z']
        with patch.object(r,'FINITE_INVENTORY_V8_READER_ENABLED',False),patch.object(r,'bounded_input',side_effect=AssertionError('original read')):
            with self.assertRaisesRegex(ValueError,'disabled'):r.main(args)
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,data in (('original',E(value)),('template',raw),('expected',E(expected))):(folder/name).write_bytes(data)
            args=['--inventory-original-v8','--original',str(folder/'original'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]
            with contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(r.main(args),0)
            report=D(output.getvalue().encode())
            self.assertEqual(report['schema'],'bw.gui-hdd.inventory-reader.v8');self.assertFalse(report['qualified'])

    def test_finite_v9_disabled_cli_and_resolver_role_policy(self):
        self.assertIs(c.FINITE_INVENTORY_V8_ENABLED,False);self.assertIs(c.FINITE_INVENTORY_V9_ENABLED,False)
        self.assertIs(r.FINITE_INVENTORY_V8_READER_ENABLED,True);self.assertIs(r.FINITE_INVENTORY_V9_READER_ENABLED,True)
        with patch.object(c,'FINITE_INVENTORY_V9_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('read')),patch.object(c,'Hosted',side_effect=AssertionError('tool')):
            for version in (8,9):
                for args in (['finite-inventory-v'+str(version)+'-guard'],['finite-inventory-v'+str(version),'--request','x','--expected-sha256','0'*64,'--output','x']):
                    with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        value,raw,expected=self.finite_v9_packet();template=D(raw)
        for module in (c,r):
            module.finite_v9_template(raw,H(raw))
            for role in ('files','aliases','directoryAliases'):
                for malformed in (None,{},'not-a-roster',[{}],[None],['/usr/lib/x.so',1]):
                    changed=copy.deepcopy(template);changed[role]=malformed;body=E(changed)
                    with self.subTest(role=role,malformed=malformed),self.assertRaises(ValueError):module.finite_v9_template(body,H(body))
            for malformed in (None,{},'not-a-library',[{}],[1]):
                changed=copy.deepcopy(template);changed['libraries']=malformed;body=E(changed)
                with self.subTest(libraries=malformed),self.assertRaises(ValueError):module.finite_v9_template(body,H(body))
            for cut in ('missing','alias','directory'):
                changed=copy.deepcopy(template);changed['files'].remove('/etc/resolv.conf')
                if cut=='alias':changed['aliases']=sorted(changed['aliases']+['/etc/resolv.conf'])
                if cut=='directory':changed['directoryAliases']=sorted(changed['directoryAliases']+['/etc/resolv.conf'])
                body=E(changed)
                with self.subTest(cut=cut),self.assertRaises(ValueError):module.finite_v9_template(body,H(body))
        # No dynamic type fallback: a selected resolver symlink is a regular-file
        # observation failure, before installed census or Git/tool edges.
        with patch.object(c,'FINITE_INVENTORY_V9_ENABLED',True),self.inventory_edges(['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so'],finite=True,finite_version=9,faults={('read','/etc/resolv.conf'):ValueError('selected regular resolver is symlink')}) as (body,pin,env,events),self.empty_source_edges():
            original=c.os.lstat
            def resolver_link(path):
                info=original(path)
                if str(path)=='/etc/resolv.conf':info.st_mode=stat.S_IFLNK|0o777
                return info
            with patch.object(c.os,'lstat',side_effect=resolver_link):failed=c.inventory_observation(body,pin,pathlib.Path('/checkout'),env,'/out/a.json')
            self.assertEqual(failed['schema'],'bw.gui-hdd.inventory-failure.v9');self.assertEqual(failed['firstFailure']['message'],'selected regular resolver is symlink')
            self.assertFalse(any(kind in ('git','installed') for kind,item in events))

    def test_finite_v9_current_role_drift_preserves_historical_eight(self):
        old,oldraw,oldexpected=self.finite_v8_packet();current,raw,expected=self.finite_v9_packet()
        oldpins=copy.deepcopy(c.FINITE_V8_PINS);oldwitness=copy.deepcopy(c.FINITE_V8_CUI_WITNESSES)
        self.assertIsNot(c.FINITE_V8_CUI_WITNESSES,c.FINITE_V9_CUI_WITNESSES)
        self.assertIsNot(r.FINITE_V8_CUI_WITNESSES,r.FINITE_V9_CUI_WITNESSES)
        pins={'bw-board':'2'*40,'bw-circuit-ui':'3'*40,'sb3-creator':'5'*40}
        witnesses={name:(size+1,'4'*64) for name,(size,digest_) in c.FINITE_V9_CUI_WITNESSES.items()}
        with patch.object(c,'CURRENT_BOARD',pins['bw-board']),patch.object(r,'CURRENT_BOARD',pins['bw-board']),patch.object(c,'CUI',pins['bw-circuit-ui']),patch.object(r,'CUI_V8',pins['bw-circuit-ui']),patch.object(c,'CURRENT_SB3',pins['sb3-creator']),patch.object(r,'CURRENT_SB3',pins['sb3-creator']),patch.object(c,'FINITE_V9_PINS',pins),patch.object(r,'FINITE_V9_PINS',pins),patch.object(c,'FINITE_V9_CUI_WITNESSES',witnesses),patch.object(r,'FINITE_V9_CUI_WITNESSES',witnesses):
            for module in (c,r):
                self.assertEqual(module.FINITE_V8_PINS,oldpins);self.assertEqual(module.FINITE_V8_CUI_WITNESSES,oldwitness)
                module.finite_v8_template(oldraw,H(oldraw))
                module.finite_v8_guard_original(base64.b64decode(old['guardAdmission']['base64']),oldraw,base64.b64decode(old['event']['base64']),old['platform'])
                with self.assertRaises(ValueError):module.finite_v9_template(raw,H(raw))
            self.assertEqual(r.verify_inventory_original(E(old),oldraw,oldexpected)['schema'],'bw.gui-hdd.inventory-reader.v8')
            template=D(raw);template['dependencyPins']=copy.deepcopy(pins);newraw=E(template)
            value=copy.deepcopy(current);vendor=E(pins);value['source']['files']['vendor-pins.json']=ROW(vendor);value['dependencyPins']=copy.deepcopy(pins);value['templateSha256']=H(newraw)
            event=D(base64.b64decode(value['event']['base64']));event['pull_request']['body']=finite_body_fixture(newraw,9);eventraw=E(event);value['event']=dict(ROW(eventraw),base64=base64.b64encode(eventraw).decode())
            value['commands'][2+sorted(c.SOURCE).index('vendor-pins.json')]['stdout']=ROW(vendor)
            guard=finite_guard_fixture(value['source'],newraw,eventraw,value['platform'],9);value['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode())
            changed=copy.deepcopy(expected);changed.update(source=value['source'],dependencyPins=copy.deepcopy(pins),template=ROW(newraw),original=ROW(E(value)),repositoryVariables={'BW_FINITE_INVENTORY_V9_SHA256':H(newraw),'BW_FINITE_INVENTORY_V9_TEMPLATE_B64':base64.b64encode(newraw).decode()})
            with self.assertRaisesRegex(ValueError,'source identity witness'):r.verify_inventory_original_v9(E(value),newraw,changed)
            for name,(size,digest_) in witnesses.items():value['installedFiles'][name]={'byteLength':size,'sha256':digest_}
            changed['original']=ROW(E(value));self.assertEqual(r.verify_inventory_original_v9(E(value),newraw,changed)['schema'],'bw.gui-hdd.inventory-reader.v9')

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_finite_v9_current_actual8_rejects_coherent_historical_reference(self):
        files,expected,env=self.actual_v8_packet();request=D(files['request.original.json'])
        old,oldraw,oldmetadata=self.finite_v8_packet()
        historical=copy.deepcopy(request['inventoryAdmission']);historical.update(schema='bw.gui-hdd.actual-finite-inventory-reference.v5',metadataAdmission=oldmetadata)
        for module in (c,r):
            self.assertEqual(module.actual_inventory_reference_v8(historical),oldmetadata)
            current=module.parse_request(files['request.original.json'],H(files['request.original.json']))
            self.assertEqual(current['inventoryAdmission']['schema'],'bw.gui-hdd.actual-finite-inventory-reference.v6')
            self.assertEqual(current['inventoryAdmission']['metadataAdmission']['schema'],'bw.gui-hdd.inventory-admission.v9')
            changed=copy.deepcopy(request);changed['inventoryAdmission']=copy.deepcopy(historical);raw=E(changed)
            with self.assertRaisesRegex(ValueError,'finite V9 reference'):module.parse_request(raw,H(raw))
        changed=copy.deepcopy(request);changed['inventoryAdmission']=historical;raw=E(changed)
        with patch.object(c,'Hosted',side_effect=AssertionError('source/media/Build/browser edge')),patch.object(c,'Originals',side_effect=AssertionError('new capture edge')),patch.object(c,'regular',side_effect=AssertionError('new input edge')):
            with self.assertRaisesRegex(ValueError,'finite V9 reference'):c.admit_actual_v8_bootstrap(raw,H(raw),pathlib.Path('/checkout'),env,pathlib.Path('/out/bootstrap.json'))

    def finite_v9_packet(self):
        value,old,expected=self.finite_v7_packet();template=D(old)
        # F9 selects the current CUI; it no longer coincides with the F7 literal pins.
        vendor_row=ROW(E(c.FINITE_V9_PINS));source=copy.deepcopy(value['source']);source['files']['vendor-pins.json']=vendor_row
        value['source']=source;expected['source']=source;value['dependencyPins']=copy.deepcopy(c.FINITE_V9_PINS)
        value['commands'][2+sorted(c.SOURCE).index('vendor-pins.json')]['stdout']=vendor_row
        for name,(size,sha256) in c.FINITE_V9_CUI_WITNESSES.items():value['installedFiles'][name]={'byteLength':size,'sha256':sha256}
        template.update(schema='bw.gui-hdd.inventory-template.v9',dependencyPins=copy.deepcopy(c.FINITE_V9_PINS),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE))
        template['files']=sorted(set(template['files'])|{'/etc/resolv.conf'});value['runtime']['files']['/etc/resolv.conf']=ROW(b'resolver');raw=E(template)
        event=D(base64.b64decode(value['event']['base64']));event['label']['name']='x86-hdd-gui-finite-inventory-v9'
        event['pull_request']['body']+='\n'+c.FINITE_V9_BEGIN+'\n'+H(raw)+'\n'+c.FINITE_V9_END;event_raw=E(event)
        value.update(schema='bw.gui-hdd.inventory-original.v9',templateSha256=H(raw),event=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode()),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE))
        value['platform']['GITHUB_JOB']='finite-inventory-nine'
        guard=finite_guard_fixture(value['source'],raw,event_raw,value['platform'],9)
        value['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode())
        value['bootstrapAdmission']=guard['bootstrapAdmission']
        value['bootstrapHelper']=c.bootstrap_helper_output(b'Prepared official Ubuntu archive: 0 source file(s) changed\n',b'')
        expected.update(schema='bw.gui-hdd.inventory-admission.v9',template=ROW(raw),original=ROW(E(value)),bootstrapSource=copy.deepcopy(c.BOOTSTRAP_SOURCE),dependencyPins=copy.deepcopy(c.FINITE_V9_PINS),
          repositoryVariables={'BW_FINITE_INVENTORY_V9_SHA256':H(raw),'BW_FINITE_INVENTORY_V9_TEMPLATE_B64':base64.b64encode(raw).decode()})
        return value,raw,expected

    def test_finite_v9_real_guard_cli_before_packages_and_coherent_preedge_cuts(self):
        value,raw,expected=self.finite_v9_packet();event=base64.b64decode(value['event']['base64']);calls=[]
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            for path,row in expected['source']['files'].items():
                target=checkout/path;target.parent.mkdir(exist_ok=True,parents=True)
                body=E(c.FINITE_V9_PINS) if path=='vendor-pins.json' else ('source:'+path).encode()
                self.assertEqual(ROW(body),row);target.write_bytes(body)
            helper=checkout/c.BOOTSTRAP_HELPER;helper.parent.mkdir(exist_ok=True,parents=True);helper.write_bytes((root/c.BOOTSTRAP_HELPER).read_bytes())
            eventpath=checkout/'event.json';eventpath.write_bytes(event)
            env=dict(value['platform'],**expected['repositoryVariables'],GITHUB_WORKSPACE=str(checkout),GITHUB_EVENT_PATH=str(eventpath),GITHUB_WORKFLOW_REF=value['platform']['GITHUB_WORKFLOW_REF'],GITHUB_EVENT_NAME='pull_request',GITHUB_ACTOR='CrispStrobe')
            class Fake:
                def __init__(self,where,capture,environment):calls.append(('host',str(where)))
                def git(self,args):
                    calls.append(('git',args))
                    if args==['rev-parse','HEAD']:return (expected['source']['head']+'\n').encode()
                    if args==['rev-parse','HEAD^{tree}']:return (expected['source']['tree']+'\n').encode()
                    if args[0]=='ls-tree':return (c.BOOTSTRAP_SOURCE['mode']+' blob '+c.BOOTSTRAP_SOURCE['gitBlob']+'\t'+c.BOOTSTRAP_HELPER+'\n').encode()
                    return (checkout/args[2].split(':',1)[1]).read_bytes()
            with patch.object(c,'FINITE_INVENTORY_V9_ENABLED',True),patch.object(c.Path,'cwd',return_value=checkout),patch.dict(c.os.environ,env),patch.object(c,'Hosted',Fake):
                self.assertEqual(c.main(['finite-inventory-v9-guard']),0)
            guard=(checkout/'gui-finite-inventory-v9/guard-admission.json').read_bytes()
            self.assertTrue(r.finite_v9_guard_original(guard,raw,event,env)['pass'])
            self.assertEqual(len([entry for kind,entry in calls if kind=='git']),2+len(c.SOURCE)+2)
            before=list(calls)
            for cut in ('label','head','attempt-bool','attempt-float','event-number-bool','old-template','helper-path','helper-blob','helper-mode','helper-size-bool','helper-sha'):
                changed_env=dict(env);changed_event=D(event);template=D(raw)
                if cut=='label':changed_event['label']['name']='x86-hdd-gui-finite-inventory-v8'
                elif cut=='head':changed_env['BW_EXPECTED_HEAD']='0'*40
                elif cut=='attempt-bool':changed_env['GITHUB_RUN_ATTEMPT']=True
                elif cut=='attempt-float':changed_env['GITHUB_RUN_ATTEMPT']=1.0
                elif cut=='event-number-bool':changed_event['number']=True
                else:
                    if cut=='old-template':template['schema']='bw.gui-hdd.inventory-template.v8'
                    else:
                        key={'helper-path':'path','helper-blob':'gitBlob','helper-mode':'mode','helper-size-bool':'byteLength','helper-sha':'sha256'}[cut]
                        template['bootstrapSource'][key]=True if key=='byteLength' else 'foreign'
                    selected=E(template);changed_env['BW_FINITE_INVENTORY_V9_SHA256']=H(selected);changed_env['BW_FINITE_INVENTORY_V9_TEMPLATE_B64']=base64.b64encode(selected).decode();changed_event['pull_request']['body']=finite_body_fixture(selected,9)
                with patch.object(c,'FINITE_INVENTORY_V9_ENABLED',True),patch.object(c.Path,'cwd',return_value=checkout),patch.object(c.os,'environ',changed_env),patch.object(c,'regular',return_value=E(changed_event)),patch.object(c,'Hosted',side_effect=AssertionError('Git/package/browser edge')):
                    with self.subTest(cut=cut),self.assertRaises(ValueError):c.main(['finite-inventory-v9-guard'])
            self.assertEqual(calls,before)

    @patch.object(c,'FINITE_INVENTORY_V9_ENABLED',True)
    def test_finite_v9_genuine_partial_failure_reader_retains_first_error(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so','/denied']
        with self.inventory_edges(paths,finite=True,finite_version=9,faults={('read','/denied'):OSError('FIRST_SELECTED_READ')}) as (raw,pin,env,events),self.empty_source_edges():
            failed=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(failed['schema'],'bw.gui-hdd.inventory-failure.v9');self.assertEqual(failed['firstFailure']['message'],'FIRST_SELECTED_READ')
        self.assertFalse(any(kind in ('installed','git') for kind,item in events))
        _value,_raw,selected=self.finite_v9_packet()
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v9','source':selected['source'],'template':ROW(raw),'failure':ROW(E(failed)),'runId':90,'workflowSha':'d'*40,'dependencyPins':copy.deepcopy(c.FINITE_V9_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),
          'repositoryVariables':{'BW_FINITE_INVENTORY_V9_SHA256':pin,'BW_FINITE_INVENTORY_V9_TEMPLATE_B64':base64.b64encode(raw).decode()}}
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary);requested=folder/'inventory-original.json';target=folder/'inventory-failure.json'
            self.assertEqual(c.retain_inventory_observation(failed,requested),1)
            retained=target.read_bytes();self.assertEqual(retained,E(failed));self.assertFalse(requested.exists())
            expected['failure']=ROW(retained)
            replay=copy.deepcopy(failed);first=copy.deepcopy(replay['firstFailure'])
            with contextlib.redirect_stderr(io.StringIO()) as diagnostic:
                self.assertEqual(c.retain_inventory_observation(replay,requested),1)
            self.assertEqual(target.read_bytes(),retained);self.assertFalse(requested.exists())
            refusal=D(diagnostic.getvalue().encode())
            self.assertEqual(refusal['firstFailure'],first)
            self.assertEqual(refusal['secondary'][-1]['name'],'FileExistsError')
            self.assertEqual(refusal['secondary'][-1]['phase'],'inventory-failure-retention')
            (folder/'template.json').write_bytes(raw);(folder/'expected.json').write_bytes(E(expected))
            args=['--inventory-failure-v9','--original',str(target),'--template',str(folder/'template.json'),'--expected',str(folder/'expected.json')]
            with patch.object(r,'FINITE_INVENTORY_V9_READER_ENABLED',True),patch.object(r,'verify_inventory_failure_v9',wraps=r.verify_inventory_failure_v9) as verify,contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(r.main(args),0)
            verify.assert_called_once_with(retained,raw,expected)
            verdict=D(output.getvalue().encode())
        self.assertTrue(verdict['failureObserved']);self.assertFalse(verdict['qualified']);self.assertFalse(verdict['candidate']);self.assertFalse(verdict['gitSourceReached'])
        for cut in ('old-schema','old-job','event-bool','wrong-helper'):
            value=copy.deepcopy(failed);chosen=copy.deepcopy(expected)
            if cut=='old-schema':value['schema']='bw.gui-hdd.inventory-failure.v8'
            elif cut=='old-job':value['platform']['GITHUB_JOB']='finite-inventory-eight'
            elif cut=='event-bool':value['event']['byteLength']=True
            else:chosen['bootstrapSource']['path']='scripts/foreign.mjs'
            chosen['failure']=ROW(E(value))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_failure_v9(E(value),raw,chosen)

    def test_finite_v9_independent_reader_and_source_sidecar_cuts(self):
        value,raw,expected=self.finite_v9_packet()
        self.assertEqual(r.verify_inventory_original_v9(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v9')
        for cut in ('path','blob','mode','bytes','sha','workspace','head','helper-output','helper-stderr','old-job','old-pins','old-schema'):
            packet=copy.deepcopy(value);chosen=copy.deepcopy(expected)
            if cut in ('path','blob','mode','bytes','sha'):
                key={'path':'path','blob':'gitBlob','mode':'mode','bytes':'byteLength','sha':'sha256'}[cut]
                chosen['bootstrapSource'][key]='foreign' if key!='byteLength' else True
            elif cut=='workspace':packet['bootstrapAdmission']['workspace']['sha256']='0'*64
            elif cut=='head':packet['bootstrapAdmission']['gitHead']='0'*40
            elif cut=='helper-output':packet['bootstrapHelper']['stdout']=dict(ROW(b'foreign'),base64=base64.b64encode(b'foreign').decode())
            elif cut=='helper-stderr':packet['bootstrapHelper']['stderr']=dict(ROW(b'error'),base64=base64.b64encode(b'error').decode())
            elif cut=='old-job':packet['platform']['GITHUB_JOB']='finite-inventory-eight'
            elif cut=='old-schema':packet['schema']='bw.gui-hdd.inventory-original.v8'
            else:chosen['dependencyPins']['bw-board']=c.BOARD
            chosen['original']=ROW(E(packet))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original_v9(E(packet),raw,chosen)
        args=['--inventory-original-v9','--original','x','--template','y','--expected','z']
        with patch.object(r,'FINITE_INVENTORY_V9_READER_ENABLED',False),patch.object(r,'bounded_input',side_effect=AssertionError('original read')):
            with self.assertRaisesRegex(ValueError,'disabled'):r.main(args)
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,data in (('original',E(value)),('template',raw),('expected',E(expected))):(folder/name).write_bytes(data)
            args=['--inventory-original-v9','--original',str(folder/'original'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]
            with patch.object(r,'FINITE_INVENTORY_V9_READER_ENABLED',True),contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(r.main(args),0)
            report=D(output.getvalue().encode())
            self.assertEqual(report['schema'],'bw.gui-hdd.inventory-reader.v9');self.assertFalse(report['qualified'])

    @patch.object(c,'FINITE_INVENTORY_V9_ENABLED',True)
    def test_finite_v9_connected_collector_and_independent_reader(self):
        # Only kernel, tool and installed-tree edges are mocked. The producer
        # constructs the original and the independent reader grades its bytes.
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(('synthetic-408:'+name).encode()) for name in c.INSTALLED_V6_CRITICAL}
        selected.update({name:{'byteLength':size,'sha256':sha256}
          for name,(size,sha256) in c.FINITE_V9_CUI_WITNESSES.items()})
        selected['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        def installed(root,prefix,failure,checkout_root,critical,identity_witnesses=None):
            self.assertIs(critical,c.INSTALLED_V6_CRITICAL)
            self.assertIs(identity_witnesses,c.FINITE_V9_CUI_WITNESSES)
            return {name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        with self.inventory_edges(paths,finite=True,finite_version=9) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed) as scan:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v9',value.get('firstFailure'))
        self.assertEqual(scan.call_count,4)
        self.assertNotIn('node_modules/bw-circuit-ui/src/current.js',value['installedFiles'])
        self.assertEqual(value['installedFiles']['node_modules/bw-circuit-ui/src/index.js'],selected['node_modules/bw-circuit-ui/src/index.js'])
        expected={'schema':'bw.gui-hdd.inventory-admission.v9','source':value['source'],
          'template':ROW(raw),'original':ROW(E(value)),'runId':90,'workflowSha':'d'*40,
          'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),'dependencyPins':copy.deepcopy(c.FINITE_V9_PINS),
          'repositoryVariables':{'BW_FINITE_INVENTORY_V9_SHA256':pin,
            'BW_FINITE_INVENTORY_V9_TEMPLATE_B64':base64.b64encode(raw).decode()}}
        # Retain the genuine collector result through the same exclusive
        # finalizer used by CLI, then grade its exact retained bytes.
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            target=pathlib.Path(temporary)/'inventory-original.json'
            self.assertEqual(c.retain_inventory_observation(value,target),0)
            retained=target.read_bytes()
            self.assertEqual(retained,E(value))
            self.assertFalse(target.with_name('inventory-failure.json').exists())
            expected['original']=ROW(retained)
            self.assertEqual(r.verify_inventory_original_v9(retained,raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v9')
            with self.assertRaises(FileExistsError):c.retain_inventory_observation(value,target)
            self.assertEqual(target.read_bytes(),retained)
        for cut in ('vendor-witness','vendor-source','wrong-408','missing-index','old-job'):
            changed=copy.deepcopy(value);admission=copy.deepcopy(expected)
            if cut=='vendor-witness':
                guard=D(base64.b64decode(changed['guardAdmission']['base64']))
                guard['vendorPinsOriginal']['sha256']='0'*64
                guard_raw=E(guard);changed['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
            elif cut=='vendor-source':admission['source']['files']['vendor-pins.json']['sha256']='0'*64
            elif cut=='wrong-408':admission['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
            elif cut=='missing-index':del changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
            else:changed['platform']['GITHUB_JOB']='finite-inventory-six'
            admission['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original_v9(E(changed),raw,admission)
    @patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True)
    def test_finite_v7_synthetic_current_pins_reader_and_guard_disabled(self):
        value,raw,expected=self.finite_v7_packet()
        self.assertIs(c.FINITE_INVENTORY_V7_ENABLED,True)
        self.assertIs(r.FINITE_INVENTORY_V7_READER_ENABLED,True)
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],
                         'bw.gui-hdd.inventory-reader.v7')
        with patch.object(c,'FINITE_INVENTORY_V7_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('host read')):
            for args in (['finite-inventory-v7-guard'],['finite-inventory-v7','--request','x','--expected-sha256','0'*64,'--output','x']):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        workflow=(root/'.github/workflows/i80386-hdd-gui-actual.yml').read_text()
        job=workflow.split('  finite-inventory-seven:',1)[1]
        self.assertIn(chr(36)+'{{ false &&',job)
        self.assertLess(job.index('finite-inventory-v7-guard'),job.index('actions/setup-node@'))
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,data in (('original',E(value)),('template',raw),('expected',E(expected))):(folder/name).write_bytes(data)
            args=['--inventory-original-v7','--original',str(folder/'original'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]
            with patch.object(r,'FINITE_INVENTORY_V7_READER_ENABLED',False),patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError('original read')):
                with self.assertRaisesRegex(ValueError,'disabled'):r.main(args)
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(r.main(args),0)
            self.assertFalse(D(output.getvalue().encode())['qualified'])
    @patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True)
    def test_finite_v7_armed_cli_refuses_wrong_admission_before_setup(self):
        self.assertIs(c.FINITE_INVENTORY_V7_ENABLED,True)
        value,raw,expected=self.finite_v7_packet()
        event_raw=base64.b64decode(value['event']['base64'])
        env=dict(value['platform'],**expected['repositoryVariables'])
        self.assertEqual(c.bind_finite_v7_event(event_raw,expected['source']['head'],H(raw),env),raw)
        cuts=('label','source','template-hash','template-canonical','template-pins','head','body',
              'duplicate-body','attempt-bool','attempt-float','attempt-int','event-number-bool')
        for cut in cuts:
            changed=copy.deepcopy(env);event=D(event_raw)
            if cut=='label':event['label']['name']='x86-hdd-gui-finite-inventory-v6'
            elif cut=='source':changed['BW_EXPECTED_HEAD']='0'*40
            elif cut=='template-hash':changed['BW_FINITE_INVENTORY_V7_SHA256']='0'*64
            elif cut in ('template-canonical','template-pins'):
                selected=D(raw)
                if cut=='template-pins':selected['dependencyPins']['bw-board']=c.BOARD
                encoded=E(selected)
                if cut=='template-canonical':encoded=encoded.rstrip(b'\n')
                pin=H(encoded);event['pull_request']['body']=event['pull_request']['body'].replace(H(raw),pin)
                changed['BW_FINITE_INVENTORY_V7_SHA256']=pin
                changed['BW_FINITE_INVENTORY_V7_TEMPLATE_B64']=base64.b64encode(encoded).decode()
            elif cut=='head':event['pull_request']['head']['sha']='0'*40
            elif cut=='body':event['pull_request']['body']=event['pull_request']['body'].replace(H(raw),'0'*64)
            elif cut=='duplicate-body':event['pull_request']['body']+='\n'+c.FINITE_V7_BEGIN+'\n'+H(raw)+'\n'+c.FINITE_V7_END
            elif cut.startswith('attempt-'):changed['GITHUB_RUN_ATTEMPT']={'attempt-bool':True,'attempt-float':1.0,'attempt-int':1}[cut]
            else:event['number']=True
            changed_raw=E(event)
            with self.subTest(cut=cut),tempfile.TemporaryDirectory(dir=root.parent) as temporary:
                checkout=pathlib.Path(temporary);changed.update(GITHUB_WORKSPACE=str(checkout),GITHUB_EVENT_PATH='/event')
                with patch.object(c.Path,'cwd',return_value=checkout),patch.object(c.os,'environ',changed),\
                     patch.object(c,'regular',return_value=changed_raw),\
                     patch.object(c,'Originals',side_effect=AssertionError('capture/setup edge reached')):
                    with self.assertRaises(ValueError) as failure:c.main(['finite-inventory-v7-guard'])
                self.assertNotIn('disabled',str(failure.exception))
                self.assertFalse((checkout/'gui-finite-inventory-v7').exists())
    @patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True)
    def test_finite_v7_synthetic_wrong_source_pin_and_index_refuse(self):
        value,raw,expected=self.finite_v7_packet()
        for cut in ('old-91','missing-index','empty-index','wrong-vendor-source','wrong-run','wrong-workflow','wrong-variable','false-guest'):
            changed=copy.deepcopy(value);selected=copy.deepcopy(expected)
            if cut=='old-91':selected['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
            elif cut=='missing-index':del changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
            elif cut=='empty-index':changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']=ROW(b'')
            elif cut=='wrong-vendor-source':selected['source']['files']['vendor-pins.json']['sha256']='0'*64
            elif cut=='wrong-run':selected['runId']+=1
            elif cut=='wrong-workflow':selected['workflowSha']='0'*40
            elif cut=='wrong-variable':selected['repositoryVariables']['BW_FINITE_INVENTORY_V7_SHA256']='0'*64
            else:changed['guestApproved']=True
            selected['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):
                r.verify_inventory_original(E(changed),raw,selected)
    @patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True)
    def test_finite_v7_eight_source_identity_witnesses_reject_old_and_hybrid_rows(self):
        value,raw,expected=self.finite_v7_packet()
        self.assertEqual(len(c.FINITE_V7_CUI_WITNESSES),18)
        self.assertEqual(c.FINITE_V7_CUI_WITNESSES,r.FINITE_V7_CUI_WITNESSES)
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v7')
        for cut in ('complete-old','one-old','one-missing','one-alias','coherent-repin'):
            changed=copy.deepcopy(value);selected=copy.deepcopy(expected)
            path=sorted(c.FINITE_V7_CUI_WITNESSES)[0]
            if cut=='complete-old':
                for name in changed['installedFiles']:
                    if name.startswith('node_modules/bw-circuit-ui/'):
                        changed['installedFiles'][name]=ROW(('synthetic-old:'+name).encode())
            elif cut in ('one-old','coherent-repin'):
                changed['installedFiles'][path]=ROW(('synthetic-old:'+path).encode())
                if cut=='coherent-repin':
                    selected['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
                    changed['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
            elif cut=='one-missing':del changed['installedFiles'][path]
            else:changed['installedFiles'][path+'-alias']=changed['installedFiles'].pop(path)
            selected['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):
                r.verify_inventory_original(E(changed),raw,selected)
        for path in c.FINITE_V7_CUI_WITNESSES:
            changed=copy.deepcopy(value);selected=copy.deepcopy(expected)
            changed['installedFiles'][path]=ROW(('synthetic-old:'+path).encode())
            selected['original']=ROW(E(changed))
            with self.subTest(stale_path=path),self.assertRaises(ValueError):
                r.verify_inventory_original(E(changed),raw,selected)
    @patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True)
    def test_finite_v7_connected_collector_and_independent_reader(self):
        # Only kernel, tool and installed-tree edges are mocked. The producer
        # constructs the original and the independent reader grades its bytes.
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(('synthetic-408:'+name).encode()) for name in c.INSTALLED_V6_CRITICAL}
        selected.update({name:{'byteLength':size,'sha256':sha256}
          for name,(size,sha256) in c.FINITE_V7_CUI_WITNESSES.items()})
        selected['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        def installed(root,prefix,failure,checkout_root,critical,identity_witnesses=None):
            self.assertIs(critical,c.INSTALLED_V6_CRITICAL)
            self.assertIs(identity_witnesses,c.FINITE_V7_CUI_WITNESSES)
            return {name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        with self.inventory_edges(paths,finite=True,finite_version=7) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed) as scan:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v7',value.get('firstFailure'))
        self.assertEqual(scan.call_count,4)
        self.assertNotIn('node_modules/bw-circuit-ui/src/current.js',value['installedFiles'])
        self.assertEqual(value['installedFiles']['node_modules/bw-circuit-ui/src/index.js'],selected['node_modules/bw-circuit-ui/src/index.js'])
        expected={'schema':'bw.gui-hdd.inventory-admission.v7','source':value['source'],
          'template':ROW(raw),'original':ROW(E(value)),'runId':90,'workflowSha':'d'*40,
          'dependencyPins':copy.deepcopy(c.FINITE_V7_PINS),
          'repositoryVariables':{'BW_FINITE_INVENTORY_V7_SHA256':pin,
            'BW_FINITE_INVENTORY_V7_TEMPLATE_B64':base64.b64encode(raw).decode()}}
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v7')
        for cut in ('vendor-witness','vendor-source','wrong-408','missing-index','old-job'):
            changed=copy.deepcopy(value);admission=copy.deepcopy(expected)
            if cut=='vendor-witness':
                guard=D(base64.b64decode(changed['guardAdmission']['base64']))
                guard['vendorPinsOriginal']['sha256']='0'*64
                guard_raw=E(guard);changed['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
            elif cut=='vendor-source':admission['source']['files']['vendor-pins.json']['sha256']='0'*64
            elif cut=='wrong-408':admission['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
            elif cut=='missing-index':del changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
            else:changed['platform']['GITHUB_JOB']='finite-inventory-six'
            admission['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original(E(changed),raw,admission)
    @patch.object(c,'FINITE_INVENTORY_V8_ENABLED',True)
    def test_finite_v8_connected_collector_and_independent_reader(self):
        # Only kernel, tool and installed-tree edges are mocked. The producer
        # constructs the original and the independent reader grades its bytes.
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(('synthetic-408:'+name).encode()) for name in c.INSTALLED_V6_CRITICAL}
        selected.update({name:{'byteLength':size,'sha256':sha256}
          for name,(size,sha256) in c.FINITE_V8_CUI_WITNESSES.items()})
        selected['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        def installed(root,prefix,failure,checkout_root,critical,identity_witnesses=None):
            self.assertIs(critical,c.INSTALLED_V6_CRITICAL)
            self.assertIs(identity_witnesses,c.FINITE_V8_CUI_WITNESSES)
            return {name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        with self.inventory_edges(paths,finite=True,finite_version=8) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed) as scan:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v8',value.get('firstFailure'))
        self.assertEqual(scan.call_count,4)
        self.assertNotIn('node_modules/bw-circuit-ui/src/current.js',value['installedFiles'])
        self.assertEqual(value['installedFiles']['node_modules/bw-circuit-ui/src/index.js'],selected['node_modules/bw-circuit-ui/src/index.js'])
        expected={'schema':'bw.gui-hdd.inventory-admission.v8','source':value['source'],
          'template':ROW(raw),'original':ROW(E(value)),'runId':90,'workflowSha':'d'*40,
          'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),'dependencyPins':copy.deepcopy(c.FINITE_V8_PINS),
          'repositoryVariables':{'BW_FINITE_INVENTORY_V8_SHA256':pin,
            'BW_FINITE_INVENTORY_V8_TEMPLATE_B64':base64.b64encode(raw).decode()}}
        # Retain the genuine collector result through the same exclusive
        # finalizer used by CLI, then grade its exact retained bytes.
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            target=pathlib.Path(temporary)/'inventory-original.json'
            self.assertEqual(c.retain_inventory_observation(value,target),0)
            retained=target.read_bytes()
            self.assertEqual(retained,E(value))
            self.assertFalse(target.with_name('inventory-failure.json').exists())
            expected['original']=ROW(retained)
            self.assertEqual(r.verify_inventory_original(retained,raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v8')
            with self.assertRaises(FileExistsError):c.retain_inventory_observation(value,target)
            self.assertEqual(target.read_bytes(),retained)
        for cut in ('vendor-witness','vendor-source','wrong-408','missing-index','old-job'):
            changed=copy.deepcopy(value);admission=copy.deepcopy(expected)
            if cut=='vendor-witness':
                guard=D(base64.b64decode(changed['guardAdmission']['base64']))
                guard['vendorPinsOriginal']['sha256']='0'*64
                guard_raw=E(guard);changed['guardAdmission']=dict(ROW(guard_raw),base64=base64.b64encode(guard_raw).decode())
            elif cut=='vendor-source':admission['source']['files']['vendor-pins.json']['sha256']='0'*64
            elif cut=='wrong-408':admission['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
            elif cut=='missing-index':del changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
            else:changed['platform']['GITHUB_JOB']='finite-inventory-six'
            admission['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original(E(changed),raw,admission)
    @patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True)
    def test_finite_v7_real_scanner_index_only_and_failed_partial(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        real_lstat=os.lstat;typed_source=self.selected_empty_source_fixture()
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            for name in c.INSTALLED_V6_CRITICAL:
                path=checkout/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'synthetic-408')
            tiny_witnesses={name:(len(b'synthetic-408'),H(b'synthetic-408')) for name in c.FINITE_V7_CUI_WITNESSES}
            for name in tiny_witnesses:
                path=checkout/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'synthetic-408')
            witness=checkout/sorted(tiny_witnesses)[0]
            index=checkout/'node_modules/bw-circuit-ui/src/index.js'
            self.assertFalse((checkout/'node_modules/bw-circuit-ui/src/current.js').exists())
            for state in ('present','missing','empty','stale-witness'):
                if state=='missing':index.unlink()
                elif state=='empty':index.write_bytes(b'')
                elif state=='stale-witness':index.write_bytes(b'synthetic-408');witness.write_bytes(b'old-91')
                with self.inventory_edges(paths,finite=True,finite_version=7) as (raw,pin,env,events):
                    fake_regular=c.regular.side_effect;fake_lstat=c.os.lstat.side_effect
                    event_raw=fake_regular('/event',c.INVENTORY_FAILURE_EVENT_CAP)
                    source=D(self.files['request.original.json'])['source']
                    source['files']['vendor-pins.json']=ROW(E(c.FINITE_V7_PINS))
                    guard_raw=E(finite_guard_fixture(source,raw,event_raw,env,7))
                    def selected_regular(path,cap):
                        if str(path)==str(checkout/'gui-finite-inventory-v7/guard-admission.json'):return guard_raw
                        if str(path).startswith(str(checkout)+'/'):
                            name=str(pathlib.Path(path).relative_to(checkout))
                            return E(c.FINITE_V7_PINS) if name=='vendor-pins.json' else ('source:'+name).encode()
                        return fake_regular(path,cap)
                    selected_lstat=fixture_lstat((checkout,),real_lstat,fake_lstat)
                    with patch.object(c,'read_empty_python_source',side_effect=typed_source),patch.object(c,'regular',side_effect=selected_regular),patch.object(c.os,'lstat',side_effect=selected_lstat),patch.object(c,'FINITE_INVENTORY_V7_ENABLED',True),patch.object(c,'FINITE_V7_CUI_WITNESSES',tiny_witnesses),patch.object(r,'FINITE_V7_CUI_WITNESSES',tiny_witnesses):
                        value=c.inventory_observation(raw,pin,checkout,env,'/out/a.json')
                        selected={'schema':'bw.gui-hdd.inventory-admission.v7' if state=='present' else 'bw.gui-hdd.inventory-failure-expectation.v7',
                          'source':source,'template':ROW(raw),'runId':90,'workflowSha':'d'*40,
                          'dependencyPins':copy.deepcopy(c.FINITE_V7_PINS),
                          'repositoryVariables':{'BW_FINITE_INVENTORY_V7_SHA256':pin,
                            'BW_FINITE_INVENTORY_V7_TEMPLATE_B64':base64.b64encode(raw).decode()}}
                        selected['original' if state=='present' else 'failure']=ROW(E(value))
                        if state=='present':
                            self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v7',value.get('firstFailure'))
                            self.assertEqual(value['installedFiles']['node_modules/bw-circuit-ui/src/index.js'],ROW(b'synthetic-408'))
                            self.assertEqual(r.verify_inventory_original(E(value),raw,selected)['schema'],'bw.gui-hdd.inventory-reader.v7')
                        else:
                            self.assertEqual(value['installedProgress']['path'],str(witness.relative_to(checkout)) if state=='stale-witness' else 'node_modules/bw-circuit-ui/src/index.js')
                            self.assertFalse(value['qualified']);self.assertFalse(value['guestApproved'])
                            if state=='stale-witness':
                                self.assertEqual(value['installedProgress']['file']['sha256'],H(b'old-91'))
                                self.assertEqual(value['firstFailure']['phase'],'inventory-installed')
                                self.assertEqual(value['firstFailure']['path'],str(witness.relative_to(checkout)))
                            self.assertEqual(r.verify_inventory_failure(E(value),raw,selected)['schema'],'bw.gui-hdd.inventory-failure-reader.v7')
    def test_finite_v6_index_transport_reader_and_disabled_route(self):
        value,raw,expected=self.finite_v6_packet()
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v6')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,data in (('original',E(value)),('template',raw),('expected',E(expected))):(folder/name).write_bytes(data)
            args=['--inventory-original-v6','--original',str(folder/'original'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]
            with contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(r.main(args),0)
            self.assertFalse(D(output.getvalue().encode())['qualified'])
        for cut in ('missing-index','empty-index','wrong-variable','wrong-label','old-job'):
            changed=copy.deepcopy(value);selected=copy.deepcopy(expected)
            if cut=='missing-index':del changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
            elif cut=='empty-index':changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']=ROW(b'')
            elif cut=='wrong-variable':selected['repositoryVariables']['BW_FINITE_INVENTORY_V6_SHA256']='0'*64
            elif cut=='wrong-label':
                event=D(base64.b64decode(changed['event']['base64']));event['label']['name']='x86-hdd-gui-finite-inventory-v5'
                encoded=E(event);changed['event']=dict(ROW(encoded),base64=base64.b64encode(encoded).decode())
                guard=D(base64.b64decode(changed['guardAdmission']['base64']));guard['eventSha256']=H(encoded)
                item=E(guard);changed['guardAdmission']=dict(ROW(item),base64=base64.b64encode(item).decode())
            else:changed['platform']['GITHUB_JOB']='finite-inventory-five'
            selected['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original(E(changed),raw,selected)
        with patch.object(c,'FINITE_INVENTORY_V6_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('host read')):
            for args in (['finite-inventory-v6-guard'],['finite-inventory-v6','--request','x','--expected-sha256','0'*64,'--output','x']):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        workflow=(root/'.github/workflows/i80386-hdd-gui-actual.yml').read_text()
        new=workflow.split('  finite-inventory-six:',1)[1]
        self.assertIn(chr(36)+'{{ false &&',new)
        self.assertLess(new.index('finite-inventory-v6-guard'),new.index('actions/setup-node@'))
    def test_finite_v6_body_variable_and_event_refuse_before_git_or_setup(self):
        value,raw,expected=self.finite_v6_packet()
        event_raw=base64.b64decode(value['event']['base64'])
        env=dict(value['platform'],**expected['repositoryVariables'])
        self.assertEqual(c.bind_finite_v6_event(event_raw,expected['source']['head'],H(raw),env),raw)
        for cut in ('sha','base64','body','duplicate-marker','event-label','source-head'):
            changed=copy.deepcopy(env);event=D(event_raw)
            if cut=='sha':changed['BW_FINITE_INVENTORY_V6_SHA256']='0'*64
            elif cut=='base64':changed['BW_FINITE_INVENTORY_V6_TEMPLATE_B64']+='='
            elif cut=='body':event['pull_request']['body']=event['pull_request']['body'].replace(H(raw),'0'*64,1)
            elif cut=='duplicate-marker':event['pull_request']['body']+='\n'+c.FINITE_V6_BEGIN+'\n'+H(raw)+'\n'+c.FINITE_V6_END
            elif cut=='event-label':event['label']['name']='x86-hdd-gui-finite-inventory-v5'
            else:event['pull_request']['head']['sha']='0'*40
            changed_raw=E(event)
            with self.subTest(cut=cut),self.assertRaises(ValueError):
                c.bind_finite_v6_event(changed_raw,expected['source']['head'],H(raw),changed)
            with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
                checkout=pathlib.Path(temporary);changed.update(GITHUB_WORKSPACE=str(checkout),GITHUB_EVENT_PATH='/event')
                with patch.object(c,'FINITE_INVENTORY_V6_ENABLED',True),patch.object(c,'regular',return_value=changed_raw),patch.object(c,'Originals',side_effect=AssertionError('Git edge reached')):
                    with self.assertRaises(ValueError):c.admit_finite_v6_before_setup(checkout,changed)
                self.assertFalse((checkout/'gui-finite-inventory-v6').exists())
    def test_finite_v5_connected_collector_wire_and_independent_reader(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(b'critical') for name in c.INSTALLED_V5_CRITICAL}
        selected['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        def installed(root,prefix,failure,checkout_root):
            self.assertEqual(root,checkout_root/prefix)
            return {name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        with patch.object(c,'FINITE_INVENTORY_V5_ENABLED',True),self.inventory_edges(paths,finite=True,finite_version=5) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed) as installed_call:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v5',value.get('firstFailure'))
        expected={'schema':'bw.gui-hdd.inventory-admission.v5','source':D(self.files['source.before.json']),
          'template':ROW(raw),'original':ROW(E(value)),'runId':90,'workflowSha':'d'*40}
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v5')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,data in (('original',E(value)),('template',raw),('expected',E(expected))):
                (folder/name).write_bytes(data)
            arguments=['--inventory-original-v5','--original',str(folder/'original'),
              '--template',str(folder/'template'),'--expected',str(folder/'expected')]
            with contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(r.main(arguments),0)
            self.assertEqual(D(output.getvalue().encode())['schema'],'bw.gui-hdd.inventory-reader.v5')
        self.assertEqual(installed_call.call_count,4)
        self.assertEqual(sum(event[0]=='git' for event in events),2+len(c.SOURCE))
        self.assertEqual(value['installedFiles']['node_modules/bw-board/docs/receipts/zero.stdout'],ROW(b''))
        for key in ('fontSelectionProved','browserFontSelectionProved','guestApproved'):self.assertIs(value[key],False)
    def test_finite_v6_connected_collector_and_reader_use_corrected_cui_entry(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(b'critical') for name in c.INSTALLED_V6_CRITICAL}
        selected['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        def installed(root,prefix,failure,checkout_root,critical):
            self.assertIs(critical,c.INSTALLED_V6_CRITICAL)
            return {name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        with patch.object(c,'FINITE_INVENTORY_V6_ENABLED',True),self.inventory_edges(paths,finite=True,finite_version=6) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed) as scan:
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v6',value.get('firstFailure'))
        self.assertEqual(scan.call_count,4)
        self.assertEqual(value['installedFiles']['node_modules/bw-circuit-ui/src/index.js'],ROW(b'critical'))
        self.assertNotIn('node_modules/bw-circuit-ui/src/current.js',value['installedFiles'])
        expected={'schema':'bw.gui-hdd.inventory-admission.v6','source':D(self.files['source.before.json']),
          'template':ROW(raw),'original':ROW(E(value)),'runId':90,'workflowSha':'d'*40,
          'repositoryVariables':{'BW_FINITE_INVENTORY_V6_SHA256':pin,
            'BW_FINITE_INVENTORY_V6_TEMPLATE_B64':base64.b64encode(raw).decode()}}
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v6')
        self.assertTrue(all(value[key] is False for key in ('fontSelectionProved','browserFontSelectionProved','guestApproved')))
    def test_finite_v6_real_installed_scanner_collector_and_reader_index_only(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        real_lstat=os.lstat;typed_source=self.selected_empty_source_fixture()
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            for name in c.INSTALLED_V6_CRITICAL:
                path=checkout/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'critical')
            zero=checkout/'node_modules/bw-board/docs/receipts/empty.stdout'
            zero.parent.mkdir(parents=True,exist_ok=True);zero.write_bytes(b'')
            self.assertFalse((checkout/'node_modules/bw-circuit-ui/src/current.js').exists())
            index=checkout/'node_modules/bw-circuit-ui/src/index.js'
            for state in ('present','missing','empty'):
                if state=='missing':index.unlink()
                elif state=='empty':index.write_bytes(b'')
                with self.inventory_edges(paths,finite=True,finite_version=6) as (raw,pin,env,events):
                    fake_regular=c.regular.side_effect;fake_lstat=c.os.lstat.side_effect
                    event_raw=fake_regular('/event',c.INVENTORY_FAILURE_EVENT_CAP)
                    source=D(self.files['request.original.json'])['source']
                    guard_raw=E(finite_guard_fixture(source,raw,event_raw,env,6))
                    def selected_regular(path,cap):
                        if str(path)==str(checkout/'gui-finite-inventory-v6/guard-admission.json'):return guard_raw
                        if str(path).startswith(str(checkout)+'/'):return ('source:'+str(pathlib.Path(path).relative_to(checkout))).encode()
                        return fake_regular(path,cap)
                    selected_lstat=fixture_lstat((checkout,),real_lstat,fake_lstat)
                    with patch.object(c,'read_empty_python_source',side_effect=typed_source),patch.object(c,'regular',side_effect=selected_regular),patch.object(c.os,'lstat',side_effect=selected_lstat),patch.object(c,'FINITE_INVENTORY_V6_ENABLED',True):
                        value=c.inventory_observation(raw,pin,checkout,env,'/out/a.json')
                variables={'BW_FINITE_INVENTORY_V6_SHA256':pin,
                  'BW_FINITE_INVENTORY_V6_TEMPLATE_B64':base64.b64encode(raw).decode()}
                selected={'schema':'bw.gui-hdd.inventory-admission.v6' if state=='present' else 'bw.gui-hdd.inventory-failure-expectation.v6',
                  'source':D(self.files['source.before.json']),'template':ROW(raw),
                  'runId':90,'workflowSha':'d'*40,'repositoryVariables':variables}
                selected['original' if state=='present' else 'failure']=ROW(E(value))
                if state=='present':
                    self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v6',value.get('firstFailure'))
                    self.assertEqual(value['installedFiles']['node_modules/bw-circuit-ui/src/index.js'],ROW(b'critical'))
                    self.assertNotIn('node_modules/bw-circuit-ui/src/current.js',value['installedFiles'])
                    self.assertEqual(r.verify_inventory_original(E(value),raw,selected)['schema'],'bw.gui-hdd.inventory-reader.v6')
                else:
                    self.assertEqual(value['installedProgress']['path'],'node_modules/bw-circuit-ui/src/index.js')
                    self.assertFalse(value['qualified']);self.assertFalse(value['guestApproved'])
                    self.assertEqual(r.verify_inventory_failure(E(value),raw,selected)['schema'],'bw.gui-hdd.inventory-failure-reader.v6')
            index.write_bytes(b'critical')
            old_basis={'installedProgress':{'package':None,'path':None,'entryStat':None,'file':None,
              'completedPrefixes':[],'completedRows':0,'totalBytes':0}}
            with self.assertRaisesRegex(ValueError,'missing source-fixed installed package/module role'):
                c.installed_inventory_v5(checkout/'node_modules/bw-circuit-ui','node_modules/bw-circuit-ui',
                    old_basis,checkout,c.INSTALLED_V5_CRITICAL)
            self.assertEqual(old_basis['installedProgress']['path'],'node_modules/bw-circuit-ui/src/current.js')
    def test_finite_v6_global_cap_refusal_keeps_admissible_partial_progress(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            path=checkout/'node_modules/bw-circuit-ui/package.json'
            path.parent.mkdir(parents=True);path.write_bytes(b'x')
            for dimension in ('rows','bytes'):
                progress={'package':None,'path':None,'entryStat':None,'file':None,
                  'completedPrefixes':['node_modules/bw-board'],'completedRows':16384 if dimension=='rows' else 1,
                  'totalBytes':1 if dimension=='rows' else 4*c.BUILD_CAP}
                with self.subTest(dimension=dimension),self.assertRaisesRegex(ValueError,'finite v6 aggregate'):
                    c.installed_inventory_v5(path.parent,'node_modules/bw-circuit-ui',
                      {'installedProgress':progress},checkout,c.INSTALLED_V6_CRITICAL)
                self.assertEqual(progress['path'],'node_modules/bw-circuit-ui/package.json')
                self.assertEqual(progress['completedRows'],16384 if dimension=='rows' else 1)
                self.assertEqual(progress['totalBytes'],1 if dimension=='rows' else 4*c.BUILD_CAP)
                r.installed_progress_v5(progress)
    def test_finite_v5_first_installed_failure_prefix_and_coherent_reader_cuts(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        source={}
        with self.empty_source_edges():c.read_empty_python_source(c.EMPTY_PYTHON_PATH,self.empty_selection()[c.EMPTY_PYTHON_PATH],source)
        def typed(path,selection,observed):observed.update(copy.deepcopy(source))
        real_lstat=os.lstat
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            for name in c.INSTALLED_V5_CRITICAL:
                path=checkout/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'critical')
            receipt=checkout/'node_modules/bw-board/docs/receipts/zero.stdout'
            receipt.parent.mkdir(parents=True,exist_ok=True);receipt.write_bytes(b'')
            failed=checkout/'node_modules/bw-circuit-ui/src/current.js';failed.write_bytes(b'')
            genuine=c.installed_inventory_v5
            def installed(selected_root,prefix,failure,checkout_root):
                self.assertEqual(selected_root,checkout_root/prefix)
                self.assertTrue((checkout/prefix).exists(),(prefix,str(checkout)))
                self.assertTrue((checkout/prefix).resolve(strict=True)==checkout.resolve(strict=True)/prefix,prefix)
                return genuine(checkout/prefix,prefix,failure,checkout)
            with patch.object(c,'FINITE_INVENTORY_V5_ENABLED',True),self.inventory_edges(paths,finite=True,finite_version=5) as (raw,pin,env,events),patch.object(c,'read_empty_python_source',side_effect=typed),patch.object(c,'installed_inventory_v5',side_effect=installed):
                faux_lstat=c.os.lstat
                with patch.object(c.os,'lstat',side_effect=fixture_lstat((checkout,),real_lstat,faux_lstat)):
                    value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-failure.v5')
        self.assertEqual(value['firstFailure']['phase'],'inventory-installed',value['firstFailure'])
        self.assertEqual(value['firstFailure']['path'],'node_modules/bw-circuit-ui/src/current.js')
        self.assertEqual(value['installedProgress']['completedPrefixes'],['node_modules/bw-board'])
        expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v5','source':D(self.files['source.before.json']),
          'template':ROW(raw),'failure':ROW(E(value)),'runId':90,'workflowSha':'d'*40}
        result=r.verify_inventory_failure(E(value),raw,expected)
        self.assertFalse(result['qualified']);self.assertTrue(result['gitSourceReached'])
        for cut in ('path','prefix','bool','scope'):
            changed=copy.deepcopy(value)
            if cut=='path':changed['installedProgress']['path']='node_modules/bw-board/other'
            elif cut=='prefix':changed['installedProgress']['completedPrefixes']=['node_modules/playwright']
            elif cut=='bool':changed['installedProgress']['completedRows']=False
            else:changed['scope']['installedEmptyRegularScoped']=False
            selected_expected=copy.deepcopy(expected);selected_expected['failure']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):
                r.verify_inventory_failure(E(changed),raw,selected_expected)
    def test_finite_v5_independent_full_packet_and_real_seven_token_cli(self):
        value,raw,expected=self.finite_v5_packet()
        self.assertEqual(r.verify_inventory_original(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v5')
        self.assertEqual(value['installedFiles']['node_modules/bw-board/docs/receipts/zero.stdout'],ROW(b''))
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            folder=pathlib.Path(temporary)
            for name,data in (('original',E(value)),('template',raw),('expected',E(expected))):
                (folder/name).write_bytes(data)
            args=['--inventory-original-v5','--original',str(folder/'original'),'--template',str(folder/'template'),'--expected',str(folder/'expected')]
            with contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(r.main(args),0)
            self.assertEqual(D(output.getvalue().encode())['schema'],'bw.gui-hdd.inventory-reader.v5')
            for bad in (args[:-1],args+['--extra'],args+['--original',str(folder/'original')]):
                with self.assertRaises((ValueError,SystemExit)):r.main(bad)
    def test_finite_v5_zero_scope_and_guard_refusals(self):
        value,raw,expected=self.finite_v5_packet()
        for cut in ('critical-zero','outside-zero','wrong-empty-sha','missing-cui','job','scope'):
            changed=copy.deepcopy(value)
            if cut=='critical-zero':changed['installedFiles']['node_modules/bw-board/src/index.js']=ROW(b'')
            elif cut=='outside-zero':changed['installedFiles']['other/empty']=ROW(b'')
            elif cut=='wrong-empty-sha':changed['installedFiles']['node_modules/bw-board/docs/receipts/zero.stdout']['sha256']='0'*64
            elif cut=='missing-cui':del changed['installedFiles']['node_modules/bw-circuit-ui/package.json']
            elif cut=='job':changed['platform']['GITHUB_JOB']='finite-inventory-v4'
            else:changed['scope']['installedEmptyRegularScoped']=False
            selected=copy.deepcopy(expected);selected['original']=ROW(E(changed))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_inventory_original(E(changed),raw,selected)
        self.assertFalse(c.FINITE_INVENTORY_V5_ENABLED);self.assertFalse(c.FINITE_INVENTORY_V6_ENABLED);self.assertFalse(c.ACTUAL_V6_ENABLED)
        with patch.object(c,'FINITE_INVENTORY_V5_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('host read')):
            for args in (['finite-inventory-v5-guard'],['finite-inventory-v5','--request','x','--expected-sha256','0'*64,'--output','x']):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        with patch.object(c,'ACTUAL_V6_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('host read')):
            for args in (['actual-v6-guard'],['actual-v6-preflight'],['actual-v6']):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main(args)
        with patch.object(c,'observe_python_startup',side_effect=AssertionError('retired v6 startup')):
            with self.assertRaisesRegex(ValueError,'disabled'):c.main(['actual-v6-guard'])
    def test_finite_v5_source_zero_and_critical_mutants_are_nonvacuous(self):
        value,raw,expected=self.finite_v5_packet();rows=copy.deepcopy(value['installedFiles'])
        wrong=copy.deepcopy(rows);wrong['node_modules/bw-board/docs/receipts/zero.stdout']['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'zero installed'):c.installed_rows_v5(wrong)
        source=(root/'scripts/run-i80386-hdd-gui-actual.py').read_text()
        zero="need(row['byteLength']>0 or row['sha256']==EMPTY_SHA256,"
        self.assertIn(zero,source)
        mutant=source.replace(zero,"need(True,",1)
        scope={'__name__':'v5_zero_mutant'};exec(compile(mutant,'v5-zero-mutant','exec'),scope)
        self.assertEqual(scope['installed_rows_v5'](wrong),wrong)
        critical=copy.deepcopy(rows);critical['node_modules/bw-board/src/index.js']=ROW(b'')
        with self.assertRaises(ValueError):c.installed_rows_v5(critical)
        exact="if name in critical:integer(row['byteLength'],1,FILE_CAP)"
        self.assertIn(exact,source)
        scope={'__name__':'v5_critical_mutant'}
        exec(compile(source.replace(exact,'if name in critical:pass',1),'v5-critical-mutant','exec'),scope)
        self.assertEqual(scope['installed_rows_v5'](critical),critical)
    def test_finite_v5_real_installed_fd_zero_and_bounded_partial_failure(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);progress={'package':None,'path':None,'entryStat':None,'file':None,
              'completedPrefixes':[],'completedRows':0,'totalBytes':0};failure={'installedProgress':progress}
            for prefix in c.INSTALLED_V5_ROOTS:
                for name in c.INSTALLED_V5_CRITICAL:
                    if name.startswith(prefix+'/'):
                        path=checkout/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'critical')
                if prefix=='node_modules/bw-board':
                    path=checkout/prefix/'docs/receipts/empty.stdout';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'')
            selected={}
            for prefix in c.INSTALLED_V5_ROOTS:
                selected.update({prefix+'/'+name:row for name,row in c.installed_inventory_v5(checkout/prefix,prefix,failure,checkout).items()})
            self.assertEqual(selected['node_modules/bw-board/docs/receipts/empty.stdout'],ROW(b''))
            self.assertEqual(r.installed_rows_v5(selected),selected)
            self.assertEqual(progress['completedPrefixes'],list(c.INSTALLED_V5_ROOTS))
            with self.assertRaisesRegex(ValueError,'canonical bounded regular'):c.regular(checkout/'node_modules/bw-board/docs/receipts/empty.stdout',1)
            critical=checkout/'node_modules/bw-board/src/index.js';critical.write_bytes(b'')
            progress.update(package=None,path=None,entryStat=None,file=None,completedPrefixes=[],completedRows=0,totalBytes=0)
            with self.assertRaisesRegex(ValueError,'nonempty source-fixed'):c.installed_inventory_v5(checkout/'node_modules/bw-board','node_modules/bw-board',failure,checkout)
            self.assertEqual(progress['path'],'node_modules/bw-board/src/index.js')
            r.installed_progress_v5(progress)
            critical.write_bytes(b'critical')
            (checkout/'node_modules/bw-board/docs/receipts/link').symlink_to('empty.stdout')
            progress.update(package=None,path=None,entryStat=None,file=None,completedPrefixes=[],completedRows=0,totalBytes=0)
            with self.assertRaisesRegex(ValueError,'symlink refused'):c.installed_inventory_v5(checkout/'node_modules/bw-board','node_modules/bw-board',failure,checkout)
            self.assertEqual(progress['path'],'node_modules/bw-board/docs/receipts/link')
            self.assertIsNotNone(progress['entryStat']);r.installed_progress_v5(progress)
            outside=checkout.parent/'outside-installed-root'
            with self.assertRaisesRegex(ValueError,'belongs to checkout'):
                c.installed_inventory_v5(outside/'node_modules/bw-board','node_modules/bw-board',failure,checkout)
    def test_finite_v5_read_and_close_failure_order(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            path=pathlib.Path(temporary)/'regular';path.write_bytes(b'content')
            original_close=c.os.close
            def broken_close(fd):original_close(fd);raise OSError('SECOND_CLOSE')
            def progress():return {'stage':'not-started','namedBefore':None,'heldBefore':None,'heldAfter':None,
              'namedAfter':None,'bytesRead':0,'sha256':H(b''),'eof':False,'complete':False,
              'closeAttempted':False,'closeSucceeded':False}
            first=progress()
            with patch.object(c.os,'read',side_effect=OSError('FIRST_READ')),patch.object(c.os,'close',side_effect=broken_close):
                with self.assertRaisesRegex(OSError,'FIRST_READ') as caught:c.installed_regular_v5(path,32,first)
            self.assertEqual([str(x) for x in caught.exception.inventory_secondary],['SECOND_CLOSE'])
            self.assertEqual(first['stage'],'read')
            self.assertTrue(first['closeAttempted']);self.assertFalse(first['closeSucceeded']);self.assertFalse(first['complete'])
            second=progress()
            with patch.object(c.os,'close',side_effect=broken_close):
                with self.assertRaisesRegex(OSError,'SECOND_CLOSE'):c.installed_regular_v5(path,32,second)
            self.assertEqual(second['bytesRead'],7);self.assertTrue(second['eof']);self.assertFalse(second['complete'])
            self.assertEqual(second['stage'],'close')
            overflow=progress();path.write_bytes(b'123456')
            with patch.object(c.os,'read',return_value=b'1234567'):
                with self.assertRaisesRegex(ValueError,'stable installed original'):c.installed_regular_v5(path,6,overflow)
            self.assertEqual(overflow['bytesRead'],7)
            self.assertEqual(overflow['stage'],'readback')
            self.assertEqual(overflow['sha256'],H(b'1234567'))
            self.assertTrue(overflow['closeSucceeded'])
            observed={'package':'node_modules/bw-board','path':'node_modules/bw-board/docs/receipts/overflow',
              'entryStat':overflow['namedBefore'],'file':overflow,'completedPrefixes':[],'completedRows':0,'totalBytes':0}
            r.installed_progress_v5(observed)
            rejected=copy.deepcopy(observed);rejected['file']['bytesRead']=r.FILE_CAP+2
            with self.assertRaises(ValueError):r.installed_progress_v5(rejected)

    def test_finite_v5_installed_digest_feeds_each_byte_once(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            path=pathlib.Path(temporary)/'regular';raw=b'A'*(384<<10);path.write_bytes(raw)
            fed=[0];original=hashlib.sha256
            class CountedDigest:
                def __init__(self,initial=b''):
                    fed[0]+=len(initial);self.value=original(initial)
                def update(self,part):
                    fed[0]+=len(part);self.value.update(part)
                def hexdigest(self):return self.value.hexdigest()
            progress={'stage':'not-started','namedBefore':None,'heldBefore':None,'heldAfter':None,
              'namedAfter':None,'bytesRead':0,'sha256':original(b'').hexdigest(),'eof':False,
              'complete':False,'closeAttempted':False,'closeSucceeded':False}
            with patch.object(c.hashlib,'sha256',side_effect=CountedDigest):
                self.assertEqual(c.installed_regular_v5(path,c.FILE_CAP,progress),raw)
            self.assertEqual(fed[0],len(raw))
            self.assertEqual(progress['sha256'],original(raw).hexdigest())
            self.assertTrue(progress['complete']);self.assertTrue(progress['closeSucceeded'])

    def actual_v6_packet(self):
        files,expected,reference,originals=NativeV2Originals().fresh()
        request=D(files['request.original.json']);request['schema']='bw.gui-hdd.actual-request.v6'
        for name in c.INSTALLED_V6_CRITICAL:request['installedFiles'].setdefault(name,ROW(b'critical'))
        request['installedFiles']['node_modules/bw-board/docs/receipts/zero.stdout']=ROW(b'')
        for stage in ('before','after'):files['installed.'+stage+'.json']=E(request['installedFiles'])
        use_finite_basis_fixture(request,expected,6)
        git_rows={}
        for path in sorted(c.NATIVE_FONT_SOURCE):
            raw=('native-source:'+path).encode()
            git_rows[path]={'mode':'100644','gitBlob':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\x00'+raw).hexdigest(),
                'bytes':len(raw),'sha256':H(raw)}
        request['nativeSourceGit']={'observed':{'head':reference['source']['head'],'files':copy.deepcopy(git_rows)},
            'finite':{'head':request['inventoryAdmission']['metadataAdmission']['source']['head'],'files':copy.deepcopy(git_rows)},
            'current':{'head':request['source']['head'],'files':copy.deepcopy(git_rows)}}
        expected.update(schema='bw.gui-hdd.actual-expectation.v6',nativeSourceGitSha256=H(E(request['nativeSourceGit'])))
        native_v5_refresh(files,expected,reference,originals,request)
        event=D(files['event.original.json']);event['label']['name']='x86-hdd-gui-actual-v6'
        event['pull_request']['body']='<!-- BW_GUI_HDD_ACTUAL_V6_REQUEST_SHA256='+expected['requestSha256']+' -->'
        files['event.original.json']=E(event)
        stage=D(files['native-font.stage.json']);stage['eventSha256']=H(files['event.original.json']);files['native-font.stage.json']=E(stage)
        prefix=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false',
          '-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
        for old in (len(r.SOURCE)+5,len(r.SOURCE)+6):
            for suffix in ('stdout','stderr','process.json'):
                files['git-'+str(old+10)+'.'+suffix]=files.pop('git-'+str(old)+'.'+suffix)
        start=len(r.SOURCE)+2
        for index,path in enumerate(sorted(git_rows)):
            row=git_rows[path];raw=('native-source:'+path).encode()
            for offset,args,out in ((0,['ls-tree','-z',request['source']['head'],'--',path],
                ('100644 blob '+row['gitBlob']+'\t'+path+'\0').encode()),
              (1,['cat-file','blob',request['source']['head']+':'+path],raw)):
                role='git-'+str(start+2*index+offset)
                files[role+'.stdout']=out;files[role+'.stderr']=b''
                files[role+'.process.json']=E(proc(prefix+args,out))
        files['native-source-git.before.json']=E({'schema':'bw.gui-hdd.native-source-git.v6',
          'head':request['source']['head'],'tree':request['source']['tree'],'files':git_rows})
        return files,expected

    def actual_v7_packet(self):
        files,expected=self.actual_v6_packet()
        request=D(files['request.original.json']);request['schema']='bw.gui-hdd.actual-request.v7'
        files['request.original.json']=E(request);pin=H(files['request.original.json'])
        expected.update(schema='bw.gui-hdd.actual-expectation.v7',requestSha256=pin,
          artifactName='i80386-hdd-gui-actual-v7-200-1')
        expected['job']['name']='actual-v7';expected['artifact']['name']=expected['artifactName']
        expected['job']['steps']=[{'name':name,'status':'completed','conclusion':'success'} for name in r.STARTUP_STEPS_V7]
        event=D(files['event.original.json']);event['label']['name']='x86-hdd-gui-actual-v7'
        event['pull_request']['body']='<!-- BW_GUI_HDD_ACTUAL_V7_REQUEST_SHA256='+pin+' -->'
        files['event.original.json']=E(event)
        result=D(files['result.json']);result.update(schema='bw.gui-hdd.result.v7',requestSha256=pin)
        files['result.json']=E(result)
        for stage in ('before','after'):
            name='python-startup.'+stage+'.json';startup=D(files[name])
            startup['arguments'][1]='actual-v7'
            startup['arguments'][startup['arguments'].index('--expected-sha256')+1]=pin
            files[name]=E(startup)
        stage=D(files['native-font.stage.json'])
        stage.update(requestSha256=pin,eventSha256=H(files['event.original.json']))
        stage['platform']['GITHUB_JOB']='actual-v7'
        files['native-font.stage.json']=E(stage)
        return files,expected

    def actual_v8_packet(self):
        files,expected=self.actual_v7_packet()
        request=D(files['request.original.json']);request['schema']='bw.gui-hdd.actual-request.v8'
        request['dependencyPins']=copy.deepcopy(c.FINITE_V9_PINS)
        vendor=E(request['dependencyPins']);vendor_row=ROW(vendor)
        request['source']['files']['vendor-pins.json']=vendor_row
        request['criticalFiles']['vendor-pins.json']=vendor_row
        request['build']['sourceFiles']['vendor-pins.json']=vendor_row
        request['build']['sourceAdmission']['sourceFiles']['vendor-pins.json']=vendor_row
        for stage_name in ('before','after'):
            source=D(files['source.'+stage_name+'.json'])
            source['files']['vendor-pins.json']=vendor_row
            files['source.'+stage_name+'.json']=E(source)
        vendor_index=2+sorted(r.SOURCE).index('vendor-pins.json')
        files['git-'+str(vendor_index)+'.stdout']=vendor
        process=D(files['git-'+str(vendor_index)+'.process.json'])
        process['streams']['stdout']=vendor_row
        files['git-'+str(vendor_index)+'.process.json']=E(process)
        head=request['source']['head'];tag='bw-gui-hdd-actual-v8-'+head
        request['dispatch']={'tagName':tag,'tagRef':'refs/tags/'+tag,
          'workflow':{'path':c.ACTUAL_V8_WORKFLOW,
                      'sha256':request['source']['files'][c.ACTUAL_V8_WORKFLOW]['sha256']}}
        use_finite_v9_basis_fixture(request,expected)
        for stage in ('before','after'):
            runtime=D(files['runtime.'+stage+'.json']);runtime['files']['/etc/resolv.conf']=ROW(b'resolver');files['runtime.'+stage+'.json']=E(runtime)
        for stage in ('before','after'):files['installed.'+stage+'.json']=E(request['installedFiles'])
        files['request.original.json']=E(request);pin=H(files['request.original.json'])
        expected.update(schema='bw.gui-hdd.actual-expectation.v8',requestSha256=pin,
          dependencyPins=request['dependencyPins'],vendorPinsSha256=vendor_row['sha256'],
          buildSourceAdmissionSha256=H(E(request['build']['sourceAdmission'])),
          artifactName='i80386-hdd-gui-actual-v8-200-1')
        expected['run']['event']='workflow_dispatch';expected['job']['name']='actual-v8'
        expected['artifact']['name']=expected['artifactName']
        expected['job']['steps']=[{'number':number,'name':name,'status':'completed','conclusion':'success'} for number,name in enumerate((
          'Run actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
          'Install empty Python cache prefix and refuse unreviewed v8 source',
          'Install externally admitted v8 request and bootstrap source before package setup',
          'Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
          'Repeat v8 inventory installation exactly, without frontend build',
          'Refuse v8 runtime/source drift using retained admitted request',
          'Prepare unchanged authenticated free media once for v8',
          'One official frontend acquisition and two serial genuine v8 UI scenarios',
          'Run actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
          'Run actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'),1)]
        event={'inputs':{'pull_request':str(request['pullRequest']),'source_head':head,
                         'request_sha256':pin,'tag_name':tag},'ref':'refs/tags/'+tag,
               'repository':{'full_name':c.REPOSITORY},'sender':{'login':'CrispStrobe'},
               'workflow':c.ACTUAL_V8_WORKFLOW}
        files['event.original.json']=E(event)
        env={'GITHUB_REPOSITORY':c.REPOSITORY,'GITHUB_EVENT_NAME':'workflow_dispatch',
          'GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1',
          'GITHUB_JOB':'actual-v8','GITHUB_REF':'refs/tags/'+tag,'GITHUB_REF_TYPE':'tag',
          'GITHUB_REF_NAME':tag,'GITHUB_SHA':head,
          'GITHUB_WORKFLOW_REF':c.REPOSITORY+'/'+c.ACTUAL_V8_WORKFLOW+'@refs/tags/'+tag,
          'GITHUB_WORKFLOW_SHA':head,'BW_EXPECTED_HEAD':head}
        pr={'number':request['pullRequest'],'state':'open','draft':False,
          'head':{'sha':head,'repo':{'full_name':c.REPOSITORY,'fork':False}},
          'base':{'ref':'main','repo':{'full_name':c.REPOSITORY}},
          'body':'<!-- BW_GUI_HDD_ACTUAL_V8_REQUEST_SHA256='+pin+' -->'}
        ref={'ref':'refs/tags/'+tag,'object':{'type':'commit','sha':head}}
        files['dispatch-pr.original.json']=E(pr);files['dispatch-tag.original.json']=E(ref)
        expected['dispatchProof']={'pullRequest':ROW(files['dispatch-pr.original.json']),
          'tagRef':ROW(files['dispatch-tag.original.json'])}
        result=D(files['result.json']);result.update(schema='bw.gui-hdd.result.v8',requestSha256=pin,
          dependencyPins=request['dependencyPins'],
          dispatchPlatform=c.dispatch_platform_v8(env))
        files['result.json']=E(result)
        for stage in ('before','after'):
            name='python-startup.'+stage+'.json';startup=D(files[name])
            startup['arguments'][1]='actual-v8'
            startup['arguments'][startup['arguments'].index('--expected-sha256')+1]=pin
            files[name]=E(startup)
        stage=D(files['native-font.stage.json'])
        stage.update(requestSha256=pin,eventSha256=H(files['event.original.json']),source=request['source'])
        stage['platform']['GITHUB_JOB']='actual-v8'
        files['native-font.stage.json']=E(stage)
        admission=D(files['probe-admission.json']);admission.update(boardPin=c.CURRENT_BOARD,criticalFiles=request['criticalFiles'])
        admission_raw=E(admission);files['probe-admission.json']=admission_raw
        for scenario in r.SCENARIOS:
            files[scenario+'/admission.json']=admission_raw
            proof=D(files[scenario+'/proof.json'])
            proof.update(boardPin=c.CURRENT_BOARD,admissionSha256=H(admission_raw))
            files[scenario+'/proof.json']=E(proof)
        witness={'source':copy.deepcopy(c.BOOTSTRAP_SOURCE),'gitHead':head,'workspace':{'byteLength':c.BOOTSTRAP_SOURCE['byteLength'],'sha256':c.BOOTSTRAP_SOURCE['sha256']}}
        files['bootstrap-admission.json']=E({'schema':'bw.gui-hdd.actual-bootstrap-admission.v1','pass':True,'requestSha256':pin,'source':request['source'],'bootstrapAdmission':witness,'platform':c.dispatch_platform_v8(env),'runtimeObserved':False,'guestApproved':False,'firstFailure':None,'secondary':[]})
        files['bootstrap-helper.stdout']=b'Prepared official Ubuntu archive: 0 source file(s) changed\n';files['bootstrap-helper.stderr']=b''
        return files,expected,env

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_current_board_split_holds_legacy_and_refuses_coherent_probe_drift(self):
        self.assertEqual(c.BOARD,r.BOARD)
        self.assertEqual(c.CURRENT_BOARD,r.CURRENT_BOARD)
        self.assertNotEqual(c.CURRENT_BOARD,c.BOARD)
        self.assertEqual(c.FINITE_V7_PINS['bw-board'],c.CURRENT_BOARD)
        value,raw,selected=self.finite_v7_packet()
        template=D(raw);template['dependencyPins']['bw-board']=c.BOARD
        changed_raw=E(template)
        for module in (c,r):
            with self.assertRaises(ValueError):module.finite_v7_template(changed_raw,H(changed_raw))
        files,expected,_env=self.actual_v8_packet()
        request=D(files['request.original.json']);request['dependencyPins']['bw-board']=c.BOARD
        changed_raw=E(request)
        for module in (c,r):
            with self.assertRaisesRegex(ValueError,'current V8 dependency pins'):
                module.parse_request(changed_raw,H(changed_raw))
        text=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text()
        node=next(n for n in ast.parse(text).body if isinstance(n,ast.FunctionDef) and n.name=='audit')
        audit_source=ast.get_source_segment(text,node)
        selector="selected_board = CURRENT_BOARD if version=='bw.gui-hdd.actual-request.v8' else BOARD"
        self.assertEqual(audit_source.count(selector),1)
        for current in (False,True):
            packet_=self.actual_v8_packet() if current else self.actual_v7_packet()
            files,expected=packet_[:2]
            if current:
                # The fixture starts with logical triplets. Retain the actual
                # V8 producer's closed physical envelopes before reader admission.
                with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
                    output=c.V8Originals(pathlib.Path(temporary)/'git-envelope-originals')
                    indices=sorted(int(name.removeprefix('git-').removesuffix('.stdout'))
                                   for name in files if name.startswith('git-') and name.endswith('.stdout'))
                    for index in indices:
                        for suffix in c.V8Originals.MEMBER_ORDER:
                            name='git-'+str(index)+'.'+suffix
                            output.save(name,files.pop(name))
                    files.update({path.name:path.read_bytes() for path in output.root.iterdir()})
            wanted=c.CURRENT_BOARD if current else c.BOARD
            wrong=c.BOARD if current else c.CURRENT_BOARD
            self.assertEqual(D(files['probe-admission.json'])['boardPin'],wanted)
            self.assertTrue(r.audit(*sealed(copy.deepcopy(files),copy.deepcopy(expected)))['pass'])
            for role in ('admission',*r.SCENARIOS):
                changed=copy.deepcopy(files)
                if role=='admission':
                    admission=D(changed['probe-admission.json']);admission['boardPin']=wrong
                    admission_raw=E(admission);changed['probe-admission.json']=admission_raw
                    for scenario in r.SCENARIOS:
                        changed[scenario+'/admission.json']=admission_raw
                        proof=D(changed[scenario+'/proof.json'])
                        proof.update(boardPin=wrong,admissionSha256=H(admission_raw))
                        changed[scenario+'/proof.json']=E(proof)
                else:
                    proof=D(changed[role+'/proof.json']);proof['boardPin']=wrong
                    changed[role+'/proof.json']=E(proof)
                with self.subTest(current=current,role=role),self.assertRaisesRegex(ValueError,
                     'actual probe source/build admission joins' if role=='admission' else 'scenario proof source/admission identity'):
                    r.audit(*sealed(copy.deepcopy(changed),copy.deepcopy(expected)))
                if role=='admission':
                    # A source-derived one-selector mutation must actually
                    # misadmit this coherent wrong-board packet; no verdict mock.
                    namespace=dict(r.__dict__)
                    mutant=audit_source.replace(selector,'selected_board = '+('BOARD' if current else 'CURRENT_BOARD'),1)
                    exec(compile(mutant,'board-selector-counterfactual','exec'),namespace)
                    self.assertTrue(namespace['audit'](*sealed(copy.deepcopy(changed),copy.deepcopy(expected)))['pass'])

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_bootstrap_cli_and_missing_packet_before_guest_edges(self):
        files,expected,env=self.actual_v8_packet();request=D(files['request.original.json'])
        historical,old_expected=self.actual_v7_packet()
        for role in ('bootstrap-admission.json','bootstrap-helper.stdout','bootstrap-helper.stderr'):historical[role]=files[role]
        with self.assertRaisesRegex(ValueError,'closed original artifact census'):r.audit(*sealed(historical,old_expected))
        for mode in ('actual-v8-preflight','actual-v8'):
            for cut in ('missing','request','source','helper','platform','secondary','guest','runtime'):
                value=D(files['bootstrap-admission.json'])
                if cut=='request':value['requestSha256']='0'*64
                elif cut=='source':value['source']['head']='0'*40
                elif cut=='helper':value['bootstrapAdmission']['workspace']['sha256']='0'*64
                elif cut=='platform':value['platform']['GITHUB_REF']='refs/heads/main'
                elif cut=='secondary':value['secondary']=[{'name':'OSError','message':'retained failure'}]
                elif cut=='guest':value['guestApproved']=True
                elif cut=='runtime':value['runtimeObserved']=True
                def read(path,cap):
                    if str(path).endswith('gui-setup/bootstrap-admission.json'):
                        if cut=='missing':raise FileNotFoundError('missing bootstrap admission')
                        return E(value)
                    raise AssertionError('source/media/runtime/Build read before bootstrap refusal')
                with tempfile.TemporaryDirectory(dir=root.parent) as temporary,patch.object(c,'regular',side_effect=read),patch.object(c,'observe_python_startup',side_effect=AssertionError('startup edge')),patch.object(c,'Hosted',side_effect=AssertionError('tool/GET/guest edge')):
                    output=pathlib.Path(temporary)/'originals'
                    self.assertEqual(c.execute(files['request.original.json'],expected['requestSha256'],pathlib.Path('/checkout'),output,env,startup_mode=mode),1)
                    self.assertIsNotNone(D((output/'result.json').read_bytes())['firstFailure'])
        # Genuine bootstrap function + CLI dispatch with only Git process edge mocked.
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary);(checkout/'gui-inputs').mkdir();(checkout/'gui-setup').mkdir();input_=checkout/'gui-inputs/request.json';input_.write_bytes(files['request.original.json']);input_.chmod(0o444)
            for path,row in request['source']['files'].items():
                target=checkout/path;target.parent.mkdir(exist_ok=True,parents=True)
                raw=E(request['dependencyPins']) if path=='vendor-pins.json' else ('source:'+path).encode()
                self.assertEqual(ROW(raw),row);target.write_bytes(raw)
            target=checkout/c.BOOTSTRAP_HELPER;target.parent.mkdir(exist_ok=True,parents=True);target.write_bytes((root/c.BOOTSTRAP_HELPER).read_bytes())
            calls=[]
            class Fake:
                def __init__(self,where,capture,environment):pass
                def git(self,args):
                    calls.append(args)
                    if args==['rev-parse','HEAD']:return (request['source']['head']+'\n').encode()
                    if args==['rev-parse','HEAD^{tree}']:return (request['source']['tree']+'\n').encode()
                    if args[0]=='ls-tree':return (c.BOOTSTRAP_SOURCE['mode']+' blob '+c.BOOTSTRAP_SOURCE['gitBlob']+'\t'+c.BOOTSTRAP_HELPER+'\n').encode()
                    return (checkout/args[2].split(':',1)[1]).read_bytes()
            event=checkout/'event.json';event.write_bytes(files['event.original.json']);environment=dict(env,GITHUB_WORKSPACE=str(checkout),GITHUB_EVENT_PATH=str(event));output=checkout/'gui-setup/bootstrap-admission.json'
            with patch.object(c,'Hosted',Fake):
                # Explicit factory because the definition captures the reviewed original class.
                packet=c.admit_actual_v8_bootstrap(files['request.original.json'],expected['requestSha256'],checkout,environment,output,factory=Fake)
            self.assertTrue(packet['pass']);self.assertEqual(packet['requestSha256'],expected['requestSha256']);self.assertEqual(len(calls),2+len(c.SOURCE)+2)
            before={str(path.relative_to(checkout)):path.read_bytes() for path in checkout.rglob('*') if path.is_file()};before_calls=list(calls)
            with patch.object(c,'exclusive_stage_write',side_effect=AssertionError('replay write')),patch.object(Fake,'__init__',side_effect=AssertionError('replay process/capture edge')):
                with self.assertRaisesRegex(ValueError,'new canonical evidence root'):c.admit_actual_v8_bootstrap(files['request.original.json'],expected['requestSha256'],checkout,environment,output,factory=Fake)
            self.assertEqual(calls,before_calls);self.assertEqual({str(path.relative_to(checkout)):path.read_bytes() for path in checkout.rglob('*') if path.is_file()},before)
            # A separate fresh authored CLI fixture; no admission function is mocked.
            with tempfile.TemporaryDirectory(dir=root.parent) as fresh:
                target=pathlib.Path(fresh)
                for name,raw in before.items():
                    if name.startswith('gui-setup/'):continue
                    path=target/name;path.parent.mkdir(exist_ok=True,parents=True);path.write_bytes(raw)
                (target/'gui-setup').mkdir()
                original_checkout=checkout;checkout=target;newenv=dict(environment,GITHUB_WORKSPACE=str(target),GITHUB_EVENT_PATH=str(target/'event.json'))
                args=['actual-v8-bootstrap','--request',str(target/'gui-inputs/request.json'),'--expected-sha256',expected['requestSha256'],'--output',str(target/'gui-setup/bootstrap-admission.json')]
                with patch.object(c.Path,'cwd',return_value=target),patch.dict(c.os.environ,newenv),patch.object(c,'Hosted',Fake),patch.object(c,'observe_python_startup',return_value=(b'',{})) as observed,contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(c.main(args),0)
                self.assertEqual(observed.call_args.args[1],'actual-v8-bootstrap')
                self.assertTrue(D((target/'gui-setup/bootstrap-admission.json').read_bytes())['pass'])
                checkout=original_checkout


    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_foreign_f9_source_refuses_before_any_bootstrap_edge(self):
        files,expected,env=self.actual_v8_packet();request=D(files['request.original.json'])
        for cut in ('head','tree','source-row'):
            changed=copy.deepcopy(request);reference=changed['inventoryAdmission'];metadata=reference['metadataAdmission']
            if cut=='head':
                metadata['source']['head']='c'*40;template=base64.b64decode(metadata['repositoryVariables']['BW_FINITE_INVENTORY_V9_TEMPLATE_B64']);value=D(template);value['sourceHead']='c'*40;raw=E(value)
                metadata['template']=ROW(raw);metadata['repositoryVariables']={'BW_FINITE_INVENTORY_V9_SHA256':H(raw),'BW_FINITE_INVENTORY_V9_TEMPLATE_B64':base64.b64encode(raw).decode()}
            elif cut=='tree':metadata['source']['tree']='c'*40
            else:metadata['source']['files']['package.json']['sha256']='0'*64
            raw=E(changed)
            for module in (c,r):
                with self.subTest(cut=cut,module=module.__name__),self.assertRaisesRegex(ValueError,'same F9 checkout'):
                    module.parse_request(raw,H(raw))

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_request_event_and_separate_pr_tag_admission(self):
        files,expected,env=self.actual_v8_packet();raw=files['request.original.json']
        request=c.parse_request(raw,H(raw))
        for cut in ('historical-cui','missing-cui','extra-pin'):
            changed=copy.deepcopy(request)
            if cut=='historical-cui':changed['dependencyPins']['bw-circuit-ui']=c.HISTORICAL_CUI
            elif cut=='missing-cui':del changed['dependencyPins']['bw-circuit-ui']
            else:changed['dependencyPins']['unreviewed']='0'*40
            changed_raw=E(changed)
            with self.subTest(cut=cut),self.assertRaisesRegex(ValueError,'current V8 dependency pins'):
                c.parse_request(changed_raw,H(changed_raw))
        self.assertEqual(request['dispatch']['tagRef'],env['GITHUB_REF'])
        self.assertEqual(c.bind_event(files['event.original.json'],request,H(raw),env)['inputs']['tag_name'],
                         request['dispatch']['tagName'])
        pr,ref=c.admit_dispatch_sources_v8(files['dispatch-pr.original.json'],
                                            files['dispatch-tag.original.json'],request,H(raw))
        self.assertEqual(pr['head']['sha'],ref['object']['sha'])
        for cut in ('wrong-event-source','wrong-ref','wrong-pr-head','wrong-tag-object','wrong-body-pin'):
            event=D(files['event.original.json']);changed_env=dict(env)
            pr=D(files['dispatch-pr.original.json']);ref=D(files['dispatch-tag.original.json'])
            if cut=='wrong-event-source':event['inputs']['source_head']='b'*40
            elif cut=='wrong-ref':changed_env['GITHUB_REF']='refs/heads/main'
            elif cut=='wrong-pr-head':pr['head']['sha']='b'*40
            elif cut=='wrong-tag-object':ref['object']['type']='tag'
            else:pr['body']='<!-- BW_GUI_HDD_ACTUAL_V7_REQUEST_SHA256='+H(raw)+' -->'
            with self.subTest(cut=cut),self.assertRaises(ValueError):
                if cut in ('wrong-event-source','wrong-ref'):c.bind_event(E(event),request,H(raw),changed_env)
                else:c.admit_dispatch_sources_v8(E(pr),E(ref),request,H(raw))

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_execute_retains_event_and_pr_primary_before_next_api(self):
        files,expected,env=self.actual_v8_packet();request=D(files['request.original.json'])
        def startup(where,mode,args):
            observed=D(files['python-startup.before.json'])
            c.validate_startup(observed,c.startup_installation(files['python-startup.original.txt']),mode,args)
            return files['python-startup.original.txt'],observed
        class MemoryOriginals:
            def __init__(self,path):self.root=pathlib.Path(path);self.raw={};self.files={};self.total=0
            def save(self,name,raw):
                if name in self.raw:raise AssertionError('duplicate original')
                self.raw[name]=raw;self.files[name]=ROW(raw);self.total+=len(raw)
            def seal(self,result):self.save('result.json',E(result))
        for cut in ('event-input','pr-head','tag-read'):
            source=copy.deepcopy(files);api_calls=[];instances=[]
            if cut=='event-input':
                event=D(source['event.original.json']);event['inputs']['source_head']='b'*40
                source['event.original.json']=E(event)
            if cut=='pr-head':
                pr=D(source['dispatch-pr.original.json']);pr['head']['sha']='b'*40
                source['dispatch-pr.original.json']=E(pr)
            class Saved(MemoryOriginals):
                def __init__(self,path):super().__init__(path);instances.append(self)
            class Fake:
                def __init__(self,where,output,environment):self.output=output;self.index=0
                def git(self,args):
                    role='git-'+str(self.index if self.index<len(c.SOURCE)+12 else self.index+3)
                    self.index+=1
                    return source[role+'.stdout']
                def api(self,route):
                    api_calls.append(route)
                    if route.startswith('/pulls/'):return source['dispatch-pr.original.json']
                    raise OSError('selected tag API failed after accepted PR')
            def raw(path,cap):
                for role in ('bootstrap-admission.json','bootstrap-helper.stdout','bootstrap-helper.stderr'):
                    if str(path)=='/checkout/gui-setup/'+role:return source[role]
                if str(path)=='/mock/event.json':return source['event.original.json']
                raise AssertionError('unexpected original read')
            def selected_file(path,row):
                name=str(path).removeprefix('/checkout/')
                return source['git-'+str(2+sorted(r.SOURCE).index(name))+'.stdout'] if name=='vendor-pins.json' else ('source:'+name).encode()
            with (patch.object(c,'V8Originals',Saved),patch.object(c,'observe_python_startup',side_effect=startup),
                  patch.object(c,'regular_empty',side_effect=raw),patch.object(c,'regular',side_effect=raw),patch.object(c,'check_file',side_effect=selected_file),
                  patch.object(c,'observe_runtime',return_value=D(files['runtime.before.json']))):
                status=c.execute(source['request.original.json'],expected['requestSha256'],pathlib.Path('/checkout'),
                  pathlib.Path('/checkout/gui-originals/originals'),dict(env,GITHUB_EVENT_PATH='/mock/event.json'),
                  factory=Fake,startup_mode='actual-v8')
            self.assertEqual(status,1,cut)
            retained=instances[0].raw;failure=D(retained['result.json'])['firstFailure']
            self.assertEqual(retained['event.original.json'],source['event.original.json'])
            if cut=='event-input':
                self.assertIn('dispatch inputs',failure['message']);self.assertEqual(api_calls,[])
                self.assertNotIn('dispatch-pr.original.json',retained)
            else:
                self.assertEqual(retained['dispatch-pr.original.json'],source['dispatch-pr.original.json'])
                self.assertNotIn('dispatch-tag.original.json',retained)
                self.assertEqual(api_calls,['/pulls/'+str(request['pullRequest'])] if cut=='pr-head' else
                  ['/pulls/'+str(request['pullRequest']),'/git/ref/tags/'+request['dispatch']['tagName']])
                self.assertIn('PR' if cut=='pr-head' else 'tag API failed',failure['message'])
            self.assertEqual(D(retained['result.json'])['secondary'],[],cut)

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_real_originals_seal_and_bounded_git_envelopes(self):
        global FIXTURE_CHECKOUT,_FIXTURE_V5
        temporary_root=tempfile.TemporaryDirectory(dir=root.parent)
        checkout=pathlib.Path(temporary_root.name);previous_checkout=FIXTURE_CHECKOUT;previous_fixture=_FIXTURE_V5
        FIXTURE_CHECKOUT=str(checkout);_FIXTURE_V5=None
        try:files,expected,env=self.actual_v8_packet()
        finally:FIXTURE_CHECKOUT=previous_checkout;_FIXTURE_V5=previous_fixture
        request=D(files['request.original.json']);actual_regular=c.regular
        def startup(where,mode,args):
            observed=D(files['python-startup.before.json'])
            observed['arguments'][-1]=args[-1]
            c.validate_startup(observed,c.startup_installation(files['python-startup.original.txt']),mode,args)
            return files['python-startup.original.txt'],observed
        def regular(path,cap):
            for role in ('bootstrap-admission.json','bootstrap-helper.stdout','bootstrap-helper.stderr'):
                if str(path)==str(checkout/'gui-setup'/role):return files[role]
            name=str(path)
            if name=='/mock/event.json':return files['event.original.json']
            if name==str(checkout/'vendor-pins.json'):return E({'bw-board':c.CURRENT_BOARD,'bw-circuit-ui':c.CUI,'sb3-creator':c.SB3})
            if name.endswith('/brickwright-build.json'):return E({'commit':request['build']['checkoutHead'][:7]})
            if '/originals/'+c.SCENARIOS[0]+'/' in name or '/originals/'+c.SCENARIOS[1]+'/' in name:
                return actual_regular(path,cap)
            raise AssertionError('unexpected selected read '+name)
        def check_file(path,row):
            name=str(path).removeprefix(str(checkout)+'/')
            if name=='vendor-pins.json':return files['git-'+str(2+sorted(r.SOURCE).index(name))+'.stdout']
            if name in request['source']['files']:return ('source:'+name).encode()
            if name in c.NATIVE_FONT_SOURCE:return ('native-source:'+name).encode()
            return b'bounded mocked selected file edge'
        def installed(path,prefix,failure,root_,critical):
            self.assertEqual(critical,c.INSTALLED_V6_CRITICAL)
            return {name.removeprefix(prefix+'/'):row for name,row in request['installedFiles'].items()
                    if name.startswith(prefix+'/')}
        def stage(request_,pin,root_,hosted,output,preflight):
            self.assertFalse(preflight)
            names=['native-font.stage.json','native-font.config.original.xml','native-font.cache.before.json']
            names += ['native-font.'+role+'.'+suffix for role in ('font','notice')
                      for suffix in ('stdout','stderr','process.json')]
            for name in names:output.save(name,files[name])
            return checkout/'gui-inputs/native-font'
        class Fake:
            def __init__(self,where,output,environment):self.output=output;self.index=0
            def git(self,args):
                role='git-'+str(self.index if self.index<len(c.SOURCE)+12 else self.index+3)
                self.index+=1
                for suffix in ('stdout','stderr','process.json'):
                    self.output.save(role+'.'+suffix,files[role+'.'+suffix])
                return files[role+'.stdout']
            def api(self,route):
                if route.startswith('/pulls/'):return files['dispatch-pr.original.json']
                if route.startswith('/git/ref/tags/'):return files['dispatch-tag.original.json']
                role='build-run' if '/runs/' in route else 'build-job' if '/jobs/' in route else 'build-artifact'
                return files[role+'.original.json']
            def run(self,role,argv,environment,seconds,*args):
                if role=='frontend-acquisition':
                    self.output.save(role+'.stderr',b'')
                    self.output.save(role+'.process.json',files[role+'.process.json'])
                    return files['frontend.original.zip']
                child=D(files[role+'.process.json']);child['argv']=argv;child['environment']=environment
                for suffix in ('stdout','stderr'):self.output.save(role+'.'+suffix,files[role+'.'+suffix])
                self.output.save(role+'.process.json',E(child))
                for name,raw in files.items():
                    if name.startswith(role+'/'):
                        if name.endswith('/admission.json'):raw=(self.output.root/'probe-admission.json').read_bytes()
                        if name.endswith('/proof.json'):
                            proof=D(raw);proof['admissionSha256']=H((self.output.root/'probe-admission.json').read_bytes());raw=E(proof)
                        target=self.output.root/name;target.parent.mkdir(parents=True,exist_ok=True)
                        target.write_bytes(raw)
                return b''
        with contextlib.nullcontext(temporary_root.name):
            destination=checkout/'gui-originals/originals'
            destination.parent.mkdir(parents=True)
            with (patch.object(c,'observe_python_startup',side_effect=startup),
                  patch.object(c,'regular_empty',side_effect=regular),patch.object(c,'regular',side_effect=regular),patch.object(c,'check_file',side_effect=check_file),
                  patch.object(c,'installed_inventory_v5',side_effect=installed),
                  patch.object(c,'observe_runtime',return_value=D(files['runtime.before.json'])),
                  patch.object(c,'prepare_native_font',side_effect=stage),
                  patch.object(c,'native_font_cache',return_value=D(files['native-font.cache.after.json'])),
                  patch.object(c,'install_members',return_value=(D(files['frontend.members.json']),D(files['build.inventory.json']))),
                  patch.object(c,'inventory',return_value=D(files['build.inventory.json']))):
                status=c.execute(files['request.original.json'],expected['requestSha256'],checkout,
                    destination,dict(env,GITHUB_EVENT_PATH='/mock/event.json',GH_TOKEN='mock-no-network'),
                    factory=Fake,startup_mode='actual-v8')
            produced={str(path.relative_to(destination)):path.read_bytes() for path in destination.rglob('*') if path.is_file()}
            self.assertEqual(status,0,D(produced['result.json']))
            self.assertEqual(D(produced['probe-admission.json'])['boardPin'],c.CURRENT_BOARD)
            physical=D(produced['inventory.json'])['files']
            self.assertEqual(set(physical),set(produced)-{'inventory.json'})
            self.assertLess(len(physical),128)
            git_roles=sorted(name for name in physical if name.startswith('git-'))
            self.assertEqual(len(git_roles),35)
            self.assertFalse(any(name.endswith(('.stdout','.stderr','.process.json')) for name in git_roles))
            for name in git_roles:
                envelope=D(produced[name]);self.assertTrue(envelope['complete'])
                self.assertEqual(envelope['firstFailure'],None)
                for suffix,member in envelope['members'].items():
                    raw=base64.b64decode(member['base64'],validate=True)
                    self.assertEqual(ROW(raw),{'byteLength':member['byteLength'],'sha256':member['sha256']})
                    self.assertEqual(raw,files[name.removesuffix('.original.json')+'.'+suffix])
            artifact=packet({name:raw for name,raw in produced.items() if name!='inventory.json'})
            self.assertLessEqual(len(artifact),384<<20)
            selected=copy.deepcopy(expected)
            def bind_artifact(raw,metadata):
                chosen=copy.deepcopy(metadata);chosen['artifactBytes']=len(raw);chosen['artifactSha256']=H(raw)
                chosen['artifact']['size_in_bytes']=len(raw);chosen['artifact']['digest']='sha256:'+H(raw)
                return chosen
            selected=bind_artifact(artifact,selected)
            originals=r.archive_originals(artifact)
            self.assertEqual(originals['inventory.json'],produced['inventory.json'])
            verdict=r.audit(originals,selected)
            self.assertEqual(verdict['schema'],'bw.gui-hdd.reader.v8')
            self.assertTrue(verdict['pass'])
            old_pin='91d8434a79d373cef2837c137ab356356f1a3b44'
            external_drift=copy.deepcopy(selected)
            external_drift['dependencyPins']['bw-circuit-ui']=old_pin
            with self.assertRaisesRegex(ValueError,'external current V8 dependency pins'):
                r.audit(originals,external_drift)
            result_drift={name:raw for name,raw in produced.items() if name!='inventory.json'}
            result=D(result_drift['result.json'])
            result['dependencyPins']['bw-circuit-ui']=old_pin
            result_drift['result.json']=E(result)
            result_zip=packet(result_drift)
            with self.assertRaisesRegex(ValueError,'retained V8 result dependency pins'):
                r.audit(r.archive_originals(result_zip),bind_artifact(result_zip,selected))
            raw_vendor={name:raw for name,raw in produced.items() if name!='inventory.json'}
            vendor_role='git-'+str(2+sorted(r.SOURCE).index('vendor-pins.json'))+'.original.json'
            vendor_envelope=D(raw_vendor[vendor_role]);vendor=E({'bw-board':c.CURRENT_BOARD,'bw-circuit-ui':old_pin,'sb3-creator':c.SB3})
            vendor_envelope['members']['stdout']={'byteLength':len(vendor),'sha256':H(vendor),
                                                  'base64':base64.b64encode(vendor).decode('ascii')}
            child=D(base64.b64decode(vendor_envelope['members']['process.json']['base64'],validate=True))
            child['streams']['stdout']=ROW(vendor)
            child_raw=E(child)
            vendor_envelope['members']['process.json']={'byteLength':len(child_raw),'sha256':H(child_raw),
                                                        'base64':base64.b64encode(child_raw).decode('ascii')}
            raw_vendor[vendor_role]=E(vendor_envelope)
            vendor_zip=packet(raw_vendor)
            with self.assertRaises(ValueError):
                r.audit(r.archive_originals(vendor_zip),bind_artifact(vendor_zip,selected))
            parts=checkout/'parts';parts.mkdir();rows={}
            small={key:copy.deepcopy(value) for key,value in selected.items()
                   if key not in ('inventoryOriginal','inventoryTemplate','nativeFontOriginals')}
            for role,name in r.ACTUAL_V6_PART_FILES.items():
                item=selected['nativeFontOriginals'][role.split('.',1)[1]] if role.startswith('nativeFontOriginals.') else selected[role]
                raw=base64.b64decode(item['base64'],validate=True)
                (parts/name).write_bytes(raw);rows[role]=ROW(raw)
            manifest=checkout/'manifest.json';manifest.write_bytes(E({'schema':'bw.gui-hdd.actual-v8-parts-manifest.v1',
                'expected':small,'parts':rows}))
            artifact_path=checkout/'artifact.zip';artifact_path.write_bytes(artifact)
            self.assertTrue(r.ACTUAL_V8_READER_ENABLED)
            with patch.object(r,'ACTUAL_V8_READER_ENABLED',False),patch.object(r,'bounded_input',side_effect=AssertionError('reader host read before false V8 guard')):
                with self.assertRaisesRegex(ValueError,'disabled'):
                    r.main(['--actual-v8-parts','--manifest',str(manifest),
                        '--parts',str(parts),'--artifact',str(artifact_path)])
            with patch.object(r,'ACTUAL_V8_READER_ENABLED',True),patch.object(r.sys,'stdout',io.StringIO()) as stream:
                self.assertEqual(r.main(['--actual-v8-parts','--manifest',str(manifest),
                    '--parts',str(parts),'--artifact',str(artifact_path)]),0)
                self.assertEqual(D(stream.getvalue().encode()),verdict)
            changed_metadata=copy.deepcopy(selected)
            changed_metadata['job']['steps'][0]['number']=False
            with self.assertRaises(ValueError):r.audit(originals,changed_metadata)
            for cut in ('workflow-257','packed-alias','null-member','process-cap'):
                changed={name:raw for name,raw in produced.items() if name!='inventory.json'}
                if cut=='workflow-257':
                    event=D(changed['event.original.json']);event['workflow']='w'*257
                    changed['event.original.json']=E(event)
                else:
                    envelope=D(changed['git-0.original.json'])
                    if cut=='packed-alias':
                        changed['git-00.original.json']=changed.pop('git-0.original.json')
                    elif cut=='null-member':
                        envelope['members']['stderr']=None;envelope['complete']=False
                        envelope['firstFailure']={'phase':'child','name':'OSError','message':'retained incomplete Git original'}
                        changed['git-0.original.json']=E(envelope)
                    else:
                        raw=b'x'*(r.JSON_CAP+1)
                        envelope['members']['process.json']={'byteLength':len(raw),'sha256':H(raw),
                            'base64':base64.b64encode(raw).decode('ascii')}
                        changed['git-0.original.json']=E(envelope)
                changed_zip=packet(changed)
                changed_originals=r.archive_originals(changed_zip)
                with self.subTest(cut=cut),self.assertRaises(ValueError):
                    r.audit(changed_originals,bind_artifact(changed_zip,selected))
        temporary_root.cleanup()

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_partial_git_capture_retains_first_error_and_caps(self):
        def result(first=None):return {'schema':'bw.gui-hdd.result.v8','pass':first is None,
            'firstFailure':first,'secondary':[]}
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            base=pathlib.Path(temporary)
            partial=c.V8Originals(base/'partial')
            partial.save('git-0.stdout',b'first raw prefix')
            first={'phase':'child','name':'OSError','message':'observed stream read failure'}
            partial.seal(result(first))
            envelope=D((partial.root/'git-0.original.json').read_bytes())
            self.assertFalse(envelope['complete']);self.assertEqual(envelope['firstFailure'],first)
            self.assertEqual(envelope['members']['stdout']['sha256'],H(b'first raw prefix'))
            self.assertIsNone(envelope['members']['stderr']);self.assertIsNone(envelope['members']['process.json'])
            self.assertEqual(set(D((partial.root/'inventory.json').read_bytes())['files']),
                             {'git-0.original.json','result.json'})
            over=c.V8Originals(base/'over-cap')
            with self.assertRaisesRegex(ValueError,'bounded decoded'):
                over.save('git-0.stdout',b'x'*(c.STREAM_CAP+1))
            self.assertEqual(over.git_pending[0],{},'rejected over-cap raw never enters complete envelope')
            over.seal(result({'phase':'child','name':'ValueError','message':'bounded decoded V8 Git originals'}))
            self.assertIsNone(D((over.root/'git-0.original.json').read_bytes())['members']['stdout'])
            self.assertFalse(D((over.root/'result.json').read_bytes())['pass'])
            for bad in ('git-00.stdout','git-'+str(len(c.SOURCE)+17)+'.stdout','git-0.stderr',
                        'git-arbitrary.stdout','git-0.original.json'):
                candidate=c.V8Originals(base/('bad-'+bad.replace('.','-')))
                with self.subTest(bad=bad),self.assertRaises(ValueError):candidate.save(bad,b'x')
            duplicate=c.V8Originals(base/'duplicate')
            duplicate.save('git-0.stdout',b'x')
            with self.assertRaisesRegex(ValueError,'ordered exclusive'):
                duplicate.save('git-0.stdout',b'x')
            inconsistent=c.V8Originals(base/'inconsistent')
            inconsistent.save('git-0.stdout',b'x')
            terminal=result({'phase':'child','name':'OSError','message':'first failed read'})
            terminal['pass']=True
            inconsistent.seal(terminal)
            self.assertFalse(D((inconsistent.root/'result.json').read_bytes())['pass'])
            self.assertEqual(D((inconsistent.root/'git-0.original.json').read_bytes())['firstFailure'],terminal['firstFailure'])
            write=c.V8Originals(base/'write-failure')
            original_save=c.Originals.save
            def fail_envelope(instance,name,raw):
                if name=='git-0.original.json':raise OSError('injected exclusive envelope write failure')
                return original_save(instance,name,raw)
            with patch.object(c.Originals,'save',fail_envelope),patch.object(c.sys,'stderr',io.StringIO()) as diagnostics:
                write.save('git-0.stdout',b'a');write.save('git-0.stderr',b'')
                with self.assertRaisesRegex(OSError,'exclusive envelope write'):
                    write.save('git-0.process.json',E({'observed':'process'}))
                terminal=result();write.seal(terminal)
            self.assertFalse(D((write.root/'result.json').read_bytes())['pass'])
            self.assertIn('git-0',diagnostics.getvalue())
            self.assertNotIn('git-0.original.json',D((write.root/'inventory.json').read_bytes())['files'])
            self.assertEqual(terminal['firstFailure']['message'],'injected exclusive envelope write failure')
            close=c.V8Originals(base/'close-failure');original_open=pathlib.Path.open
            class ClosingFault:
                def __init__(self,stream):self.stream=stream
                def __enter__(self):return self.stream.__enter__()
                def __exit__(self,*args):
                    self.stream.__exit__(*args)
                    raise OSError('injected envelope close failure')
            def selected_open(path,*args,**kwargs):
                stream=original_open(path,*args,**kwargs)
                return ClosingFault(stream) if path.name=='git-0.original.json' else stream
            with patch.object(pathlib.Path,'open',selected_open),patch.object(c.sys,'stderr',io.StringIO()):
                close.save('git-0.stdout',b'a');close.save('git-0.stderr',b'')
                with self.assertRaisesRegex(OSError,'envelope close'):
                    close.save('git-0.process.json',E({'observed':'process'}))
                closed_result=result();close.seal(closed_result)
            self.assertFalse(D((close.root/'result.json').read_bytes())['pass'])
            self.assertTrue((close.root/'git-0.original.json').is_file())
            self.assertNotIn('git-0.original.json',D((close.root/'inventory.json').read_bytes())['files'])

    @patch.object(c,'ACTUAL_V8_ENABLED',True)
    def test_actual_v8_three_true_main_startup_modes_and_wrong_logical_modes(self):
        files,expected,env=self.actual_v8_packet()
        self.assertTrue(c.ACTUAL_V8_ENABLED)
        with patch.object(c,'ACTUAL_V8_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('host read before false V8 guard')):
            for mode in ('actual-v8-guard','actual-v8-preflight','actual-v8','actual-v8-bootstrap'):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main([mode])
        prefix=D(files['python-startup.before.json'])['prefix']
        flags=D(files['python-startup.before.json'])['flags']
        original_resolve=pathlib.Path.resolve
        def selected_resolve(path,*args,**kwargs):
            return pathlib.Path(c.PYTHON_EXECUTABLE) if str(path)=='/proc/self/exe' else original_resolve(path,*args,**kwargs)
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            for mode in ('actual-v8-guard','actual-v8-preflight','actual-v8'):
                output=pathlib.Path(temporary)/mode
                command=['scripts/run-i80386-hdd-gui-actual.py',mode]
                if mode!='actual-v8-guard':
                    command+=['--request',str(root/'gui-inputs/request.json'),
                      '--expected-sha256',expected['requestSha256'],'--output',str(output)]
                def regular_edge(path,cap):
                    name=str(path)
                    for role in ('bootstrap-admission.json','bootstrap-helper.stdout','bootstrap-helper.stderr'):
                        if name.endswith('gui-setup/'+role):return files[role]
                    if name.endswith(c.BOOTSTRAP_HELPER):return (root/c.BOOTSTRAP_HELPER).read_bytes()
                    if name.endswith('python-startup.original.txt'):return files['python-startup.original.txt']
                    if name.endswith('gui-inputs/request.json'):return files['request.original.json']
                    if name=='/mock/event.json':return files['event.original.json']
                    raise AssertionError('unexpected host read after source/event admission')
                with (patch.object(c,'ACTUAL_V8_ENABLED',True),patch.object(c,'regular_empty',side_effect=regular_edge),patch.object(c,'regular',side_effect=regular_edge),
                      patch.dict(c.os.environ,dict(env,GITHUB_EVENT_PATH='/mock/event.json')),
                      patch.object(c,'observe_runtime',side_effect=OSError('runtime OS boundary after V8 event')),
                      patch.object(c,'empty_python_prefix',return_value=prefix),
                      patch.object(c.sys,'orig_argv',c.PYTHON_OPTIONS+command),
                      patch.object(c.sys,'flags',SimpleNamespace(**flags)),
                      patch.object(c.sys,'executable',c.PYTHON_EXECUTABLE),
                      patch.object(c.sys,'path',c.PYTHON_PATH),
                      patch.object(c.sys,'pycache_prefix',c.PYTHON_CACHE),
                      patch.object(c.sys,'_xoptions',{'pycache_prefix':c.PYTHON_CACHE}),
                      patch.object(c.sys,'dont_write_bytecode',True),
                      patch.object(c.os.path,'lexists',return_value=False),
                      patch.object(c.Path,'resolve',selected_resolve)):
                    if mode=='actual-v8-guard':self.assertEqual(c.main([mode]),0)
                    else:
                        self.assertEqual(c.main([mode,*command[2:]]),1)
                        retained=D((output/'python-startup.before.json').read_bytes())
                        self.assertEqual(retained['arguments'][1],mode)
                        self.assertEqual((output/'event.original.json').read_bytes(),files['event.original.json'])
                        result=D((output/'result.json').read_bytes())
                        self.assertEqual(result['schema'],'bw.gui-hdd.result.v8')
                        self.assertIn('runtime OS boundary after V8 event',result['firstFailure']['message'])
                wrong=D(files['python-startup.before.json'])
                wrong['arguments'][1]='guard' if mode.endswith('guard') else 'preflight' if mode.endswith('preflight') else 'actual'
                with self.assertRaisesRegex(ValueError,'startup observations'):
                    c.validate_startup(wrong,c.startup_installation(files['python-startup.original.txt']),mode,command[2:])

    def test_actual_v7_independent_full_packet_and_parts(self):
        files,expected=self.actual_v7_packet();raw=files['request.original.json']
        self.assertEqual(c.parse_request(raw,H(raw)),r.parse_request(raw,H(raw)))
        env={'GITHUB_REPOSITORY':r.REPOSITORY,'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe',
          'GITHUB_RUN_ID':'200','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual-v7','BW_EXPECTED_HEAD':'a'*40}
        for binder in (c.bind_event,r.bind_event):
            self.assertEqual(binder(files['event.original.json'],D(raw),H(raw),env)['label']['name'],'x86-hdd-gui-actual-v7')
            for wrong in ('actual','actual-v6'):
                with self.assertRaises(ValueError):binder(files['event.original.json'],D(raw),H(raw),dict(env,GITHUB_JOB=wrong))
        originals,selected=sealed(files,expected)
        self.assertEqual(r.audit(originals,selected)['schema'],'bw.gui-hdd.reader.v7')
        artifact=packet(files)
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            base=pathlib.Path(temporary);parts=base/'parts';parts.mkdir()
            manifest_path=base/'manifest.json';artifact_path=base/'artifact.zip';artifact_path.write_bytes(artifact)
            selected_small={key:copy.deepcopy(value) for key,value in selected.items()
              if key not in ('inventoryOriginal','inventoryTemplate','nativeFontOriginals')}
            roles={}
            for role,name in r.ACTUAL_V6_PART_FILES.items():
                item=selected['nativeFontOriginals'][role.split('.',1)[1]] if role.startswith('nativeFontOriginals.') else selected[role]
                original=base64.b64decode(item['base64'],validate=True)
                (parts/name).write_bytes(original);roles[role]=ROW(original)
            manifest=E({'schema':'bw.gui-hdd.actual-v7-parts-manifest.v1','expected':selected_small,'parts':roles})
            manifest_path.write_bytes(manifest)
            self.assertEqual(r.actual_v7_parts_expected(manifest_path,parts),selected)
            self.assertTrue(r.ACTUAL_V7_READER_ENABLED)
            with patch.object(r,'ACTUAL_V7_READER_ENABLED',False),patch.object(r,'bounded_input',side_effect=AssertionError('reader host read before guard')):
                with self.assertRaisesRegex(ValueError,'disabled'):
                    r.main(['--actual-v7-parts','--manifest',str(manifest_path),
                      '--parts',str(parts),'--artifact',str(artifact_path)])
            with patch.object(r,'ACTUAL_V7_READER_ENABLED',True),patch.object(r.sys,'stdout',io.StringIO()) as stream:
                self.assertEqual(r.main(['--actual-v7-parts','--manifest',str(manifest_path),
                  '--parts',str(parts),'--artifact',str(artifact_path)]),0)
                self.assertEqual(D(stream.getvalue().encode()),r.audit(originals,selected))
            for cut in ('event-label','startup-mode','job','artifact-name'):
                changed=copy.deepcopy(files);chosen=copy.deepcopy(expected)
                if cut=='event-label':
                    value=D(changed['event.original.json']);value['label']['name']='x86-hdd-gui-actual-v6'
                    changed['event.original.json']=E(value)
                elif cut=='startup-mode':
                    value=D(changed['python-startup.before.json']);value['arguments'][1]='actual'
                    changed['python-startup.before.json']=E(value)
                elif cut=='job':chosen['job']['name']='actual'
                else:
                    chosen['artifactName']='i80386-hdd-gui-200-1';chosen['artifact']['name']=chosen['artifactName']
                with self.subTest(cut=cut),self.assertRaises(ValueError):r.audit(*sealed(changed,chosen))
            (parts/'unexpected').write_bytes(b'X')
            with self.assertRaises(r.ActualV6PartsFailure):r.actual_v7_parts_expected(manifest_path,parts)

    def test_actual_v7_three_real_startup_mode_bindings(self):
        files,expected=self.actual_v7_packet()
        self.assertFalse(c.ACTUAL_V7_ENABLED);self.assertFalse(c.ACTUAL_V6_ENABLED)
        with patch.object(c,'ACTUAL_V7_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('host read before V7 guard')):
            for mode in ('actual-v7-guard','actual-v7-preflight','actual-v7'):
                with self.assertRaisesRegex(ValueError,'disabled'):c.main([mode])
        installed=c.startup_installation(files['python-startup.original.txt'])
        prefix=D(files['python-startup.before.json'])['prefix']
        flags=D(files['python-startup.before.json'])['flags']
        original_resolve=pathlib.Path.resolve
        def selected_resolve(path,*args,**kwargs):
            return pathlib.Path(c.PYTHON_EXECUTABLE) if str(path)=='/proc/self/exe' else original_resolve(path,*args,**kwargs)
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            for mode in ('actual-v7-guard','actual-v7-preflight','actual-v7'):
                output=pathlib.Path(temporary)/mode
                command=['scripts/run-i80386-hdd-gui-actual.py',mode]
                if mode!='actual-v7-guard':
                    command+=['--request',str(root/'gui-inputs/request.json'),'--expected-sha256',expected['requestSha256'],'--output',str(output)]
                def regular_edge(path,cap):
                    name=str(path)
                    if name.endswith('python-startup.original.txt'):return files['python-startup.original.txt']
                    if name.endswith('gui-inputs/request.json'):return files['request.original.json']
                    if name=='/mock/event.json':return files['event.original.json']
                    raise AssertionError('unexpected host read after source/event admission')
                with (patch.object(c,'ACTUAL_V7_ENABLED',True),patch.object(c,'regular',side_effect=regular_edge),
                      patch.dict(c.os.environ,{'GITHUB_EVENT_PATH':'/mock/event.json','GITHUB_REPOSITORY':c.REPOSITORY,
                        'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ATTEMPT':'1',
                        'GITHUB_RUN_ID':'200','GITHUB_JOB':'actual-v7','BW_EXPECTED_HEAD':'a'*40}),
                      patch.object(c,'observe_runtime',side_effect=OSError('runtime OS boundary after event admission')),
                      patch.object(c,'empty_python_prefix',return_value=prefix),
                      patch.object(c.sys,'orig_argv',c.PYTHON_OPTIONS+command),
                      patch.object(c.sys,'flags',SimpleNamespace(**flags)),
                      patch.object(c.sys,'executable',c.PYTHON_EXECUTABLE),
                      patch.object(c.sys,'path',c.PYTHON_PATH),
                      patch.object(c.sys,'pycache_prefix',c.PYTHON_CACHE),
                      patch.object(c.sys,'_xoptions',{'pycache_prefix':c.PYTHON_CACHE}),
                      patch.object(c.sys,'dont_write_bytecode',True),
                      patch.object(c.os.path,'lexists',return_value=False),
                      patch.object(c.Path,'resolve',selected_resolve)):
                    if mode=='actual-v7-guard':self.assertEqual(c.main([mode]),0)
                    else:
                        self.assertEqual(c.main([mode,*command[2:]]),1)
                        retained=D((output/'python-startup.before.json').read_bytes())
                        self.assertEqual(retained['arguments'][1],mode)
                        result=D((output/'result.json').read_bytes())
                        self.assertEqual(result['schema'],'bw.gui-hdd.result.v7')
                        self.assertIn('runtime OS boundary after event admission',result['firstFailure']['message'])
                        self.assertEqual((output/'event.original.json').read_bytes(),files['event.original.json'])
                wrong=D(files['python-startup.before.json']);wrong['arguments'][1]='guard' if mode.endswith('guard') else 'preflight' if mode.endswith('preflight') else 'actual'
                with self.assertRaisesRegex(ValueError,'startup observations'):
                    c.validate_startup(wrong,installed,mode,command[2:])

    def test_actual_v7_execute_emits_reader_accepted_complete_packet(self):
        files,expected=self.actual_v7_packet();request=D(files['request.original.json']);instances=[]
        class MemoryOriginals:
            def __init__(self,path):
                self.root=pathlib.Path(path);self.raw={};self.files={};self.total=0;instances.append(self)
            def save(self,name,raw):
                self.assert_unique(name);self.raw[name]=raw;self.files[name]=ROW(raw);self.total+=len(raw)
            def assert_unique(self,name):
                if name in self.raw:raise AssertionError('duplicate retained role '+name)
            def seal(self,result):self.save('result.json',E(result))
        def startup(where,mode,args):
            observation=D(files['python-startup.before.json'])
            c.validate_startup(observation,c.startup_installation(files['python-startup.original.txt']),mode,args)
            return files['python-startup.original.txt'],observation
        def regular(path,cap):
            name=str(path)
            if name=='/mock/event.json':return files['event.original.json']
            if name=='/checkout/vendor-pins.json':return E({'bw-board':c.BOARD,'bw-circuit-ui':c.HISTORICAL_CUI,'sb3-creator':c.SB3})
            if name.endswith('/brickwright-build.json'):return E({'commit':request['build']['checkoutHead'][:7]})
            raise AssertionError('unexpected raw host read '+name)
        def check_file(path,row):
            name=str(path).removeprefix('/checkout/')
            if name in request['source']['files']:return ('source:'+name).encode()
            if name in c.NATIVE_FONT_SOURCE:return ('native-source:'+name).encode()
            return b'bounded mocked selected file edge'
        def installed(path,prefix,failure,root_,critical):
            self.assertEqual(critical,c.INSTALLED_V6_CRITICAL)
            return {name.removeprefix(prefix+'/'):row for name,row in request['installedFiles'].items()
              if name.startswith(prefix+'/')}
        def stage(request_,pin,root_,hosted,output,preflight):
            self.assertFalse(preflight)
            names=['native-font.stage.json','native-font.config.original.xml','native-font.cache.before.json']
            names += ['native-font.'+role+'.'+suffix for role in ('font','notice')
              for suffix in ('stdout','stderr','process.json')]
            for name in names:
                output.save(name,files[name])
            return pathlib.Path('/checkout/gui-inputs/native-font')
        class Fake:
            def __init__(self,where,output,env):self.output=output;self.index=0
            def git(self,args):
                role='git-'+str(self.index if self.index<len(c.SOURCE)+12 else self.index+3);self.index+=1
                raw=files[role+'.stdout']
                for suffix,value in (('stdout',raw),('stderr',files[role+'.stderr']),('process.json',files[role+'.process.json'])):
                    self.output.save(role+'.'+suffix,value)
                return raw
            def api(self,route):
                role='build-run' if '/runs/' in route else 'build-job' if '/jobs/' in route else 'build-artifact'
                return files[role+'.original.json']
            def run(self,role,argv,environment,seconds,*args):
                if role=='frontend-acquisition':
                    self.output.save(role+'.stderr',b'')
                    self.output.save(role+'.process.json',files[role+'.process.json'])
                    return files['frontend.original.zip']
                child=D(files[role+'.process.json']);child['argv']=argv;child['environment']=environment
                for suffix in ('stdout','stderr'):self.output.save(role+'.'+suffix,files[role+'.'+suffix])
                self.output.save(role+'.process.json',E(child))
                for name,raw in files.items():
                    if name.startswith(role+'/'):
                        if name.endswith('/admission.json'):raw=self.output.raw['probe-admission.json']
                        if name.endswith('/proof.json'):
                            proof=D(raw);proof['admissionSha256']=H(self.output.raw['probe-admission.json']);raw=E(proof)
                        self.output.save(name,raw)
                return b''
        env={'GITHUB_EVENT_PATH':'/mock/event.json','GITHUB_REPOSITORY':c.REPOSITORY,
          'GITHUB_EVENT_NAME':'pull_request','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ATTEMPT':'1',
          'GITHUB_RUN_ID':'200','GITHUB_JOB':'actual-v7','BW_EXPECTED_HEAD':'a'*40,
          'GH_TOKEN':'mock-only-no-network'}
        with (patch.object(c,'Originals',MemoryOriginals),patch.object(c,'observe_python_startup',side_effect=startup),
              patch.object(c,'regular',side_effect=regular),patch.object(c,'check_file',side_effect=check_file),
              patch.object(c,'installed_inventory_v5',side_effect=installed),
              patch.object(c,'observe_runtime',return_value=D(files['runtime.before.json'])),
              patch.object(c,'prepare_native_font',side_effect=stage),
              patch.object(c,'native_font_cache',return_value=D(files['native-font.cache.after.json'])),
              patch.object(c,'install_members',return_value=(D(files['frontend.members.json']),D(files['build.inventory.json']))),
              patch.object(c,'inventory',return_value=D(files['build.inventory.json']))):
            status=c.execute(files['request.original.json'],expected['requestSha256'],pathlib.Path('/checkout'),
              pathlib.Path('/checkout/gui-originals/originals'),env,factory=Fake,startup_mode='actual-v7')
        self.assertEqual(status,0,D(instances[0].raw['result.json']))
        produced=instances[0].raw
        self.assertEqual(D(produced['result.json'])['schema'],'bw.gui-hdd.result.v7')
        self.assertEqual(D(produced['event.original.json'])['label']['name'],'x86-hdd-gui-actual-v7')
        originals,selected=sealed(produced,expected)
        self.assertEqual(r.audit(originals,selected)['schema'],'bw.gui-hdd.reader.v7')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            base=pathlib.Path(temporary);parts=base/'parts';parts.mkdir()
            artifact=packet(produced);(base/'artifact.zip').write_bytes(artifact)
            small={key:copy.deepcopy(value) for key,value in selected.items()
              if key not in ('inventoryOriginal','inventoryTemplate','nativeFontOriginals')}
            rows={}
            for role,name in r.ACTUAL_V6_PART_FILES.items():
                item=selected['nativeFontOriginals'][role.split('.',1)[1]] if role.startswith('nativeFontOriginals.') else selected[role]
                raw=base64.b64decode(item['base64'],validate=True)
                (parts/name).write_bytes(raw);rows[role]=ROW(raw)
            (base/'manifest.json').write_bytes(E({'schema':'bw.gui-hdd.actual-v7-parts-manifest.v1',
              'expected':small,'parts':rows}))
            with patch.object(r,'ACTUAL_V7_READER_ENABLED',True),patch.object(r.sys,'stdout',io.StringIO()) as stream:
                self.assertEqual(r.main(['--actual-v7-parts','--manifest',str(base/'manifest.json'),
                  '--parts',str(parts),'--artifact',str(base/'artifact.zip')]),0)
                self.assertEqual(D(stream.getvalue().encode()),r.audit(originals,selected))
        changed=copy.deepcopy(produced);terminal=D(changed['result.json']);terminal['schema']='bw.gui-hdd.result.v1'
        changed['result.json']=E(terminal)
        with self.assertRaisesRegex(ValueError,'authoritative terminal'):r.audit(*sealed(changed,expected))

    def test_actual_v6_request_and_full_independent_reader_packet(self):
        files,expected=self.actual_v6_packet();request=D(files['request.original.json'])
        self.assertEqual(c.parse_request(files['request.original.json'],expected['requestSha256']),request)
        self.assertEqual(r.parse_request(files['request.original.json'],expected['requestSha256']),request)
        repinned=copy.deepcopy(request)
        selected=repinned['inventoryAdmission']['metadataAdmission']
        original_template=D(base64.b64decode(selected['repositoryVariables']['BW_FINITE_INVENTORY_V6_TEMPLATE_B64']))
        self.assertEqual(original_template['sourceHead'],selected['source']['head'])
        original_template['sourceHead']='d'*40
        repinned_template=E(original_template)
        selected['template']=ROW(repinned_template)
        selected['repositoryVariables']={
            'BW_FINITE_INVENTORY_V6_SHA256':H(repinned_template),
            'BW_FINITE_INVENTORY_V6_TEMPLATE_B64':base64.b64encode(repinned_template).decode()}
        self.assertNotEqual(original_template['sourceHead'],selected['source']['head'])
        repinned_raw=E(repinned)
        for parser in (c.parse_request,r.parse_request):
            with self.assertRaisesRegex(ValueError,'template source head|template extent and source head'):
                parser(repinned_raw,H(repinned_raw))
        for cut in ('old-reference','old-metadata','old-entry'):
            changed=copy.deepcopy(request)
            if cut=='old-reference':changed['inventoryAdmission']['schema']='bw.gui-hdd.actual-finite-inventory-reference.v2'
            elif cut=='old-metadata':changed['inventoryAdmission']['metadataAdmission']['schema']='bw.gui-hdd.inventory-admission.v5'
            else:
                del changed['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
                changed['installedFiles']['node_modules/bw-circuit-ui/src/current.js']=ROW(b'old-only')
            raw=E(changed)
            with self.subTest(cut=cut):
                for parser in (c.parse_request,r.parse_request):
                    with self.assertRaises(ValueError):parser(raw,H(raw))
        originals,selected=sealed(files,expected)
        self.assertEqual(r.audit(originals,selected)['schema'],'bw.gui-hdd.reader.v6')
        delivery={'artifact':packet(files),'expected':E(selected)}
        with patch.object(r,'bounded_input',side_effect=lambda path,cap:delivery[path]),patch.object(r.sys,'stdout',io.StringIO()) as stream:
            self.assertEqual(r.main(['artifact','expected']),0)
            self.assertEqual(D(stream.getvalue().encode())['schema'],'bw.gui-hdd.reader.v6')
        for cut in ('native-git-listing','native-git-blob','native-git-report','h0-a-row','native-external','empty-outside','empty-critical','event-label'):
            changed=copy.deepcopy(files);chosen=copy.deepcopy(expected)
            first=sorted(c.NATIVE_FONT_SOURCE)[0];role='git-'+str(len(r.SOURCE)+2)
            if cut=='native-git-listing':
                changed[role+'.stdout']=b'100644 blob '+b'0'*40+b'\t'+first.encode()+b'\x00'
                item=D(changed[role+'.process.json']);item['streams']['stdout']=ROW(changed[role+'.stdout']);changed[role+'.process.json']=E(item)
            elif cut=='native-git-blob':
                role='git-'+str(len(r.SOURCE)+3);changed[role+'.stdout']=b'forged'
                item=D(changed[role+'.process.json']);item['streams']['stdout']=ROW(changed[role+'.stdout']);changed[role+'.process.json']=E(item)
            elif cut=='native-git-report':
                item=D(changed['native-source-git.before.json']);item['files'][first]['bytes']+=1;changed['native-source-git.before.json']=E(item)
            elif cut=='h0-a-row':
                item=D(changed['request.original.json']);item['nativeSourceGit']['observed']['files'][first]['gitBlob']='0'*40
                changed['request.original.json']=E(item);chosen['requestSha256']=H(changed['request.original.json'])
            elif cut=='native-external':chosen['nativeSourceGitSha256']='0'*64
            elif cut in ('empty-outside','empty-critical'):
                item=D(changed['installed.before.json'])
                if cut=='empty-outside':item['other/empty']=ROW(b'')
                else:item['node_modules/bw-board/src/index.js']=ROW(b'')
                changed['installed.before.json']=E(item)
            else:
                event=D(changed['event.original.json']);event['label']['name']='x86-hdd-gui-actual';changed['event.original.json']=E(event)
            with self.subTest(cut=cut),self.assertRaises((ValueError,KeyError)):
                r.audit(*sealed(changed,chosen))

    def test_actual_v6_parts_exact_transport_and_full_reader_parity(self):
        files,expected=self.actual_v6_packet();originals,selected=sealed(files,expected)
        artifact=packet(files)
        self.assertEqual(r.audit(originals,selected)['schema'],'bw.gui-hdd.reader.v6')
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            base=pathlib.Path(temporary);parts=base/'parts';parts.mkdir()
            manifest_path=base/'manifest.json';artifact_path=base/'artifact.zip'
            artifact_path.write_bytes(artifact)
            def write_parts(chosen):
                small={key:copy.deepcopy(value) for key,value in chosen.items()
                       if key not in ('inventoryOriginal','inventoryTemplate','nativeFontOriginals')}
                roles={};raws={}
                for role,name in r.ACTUAL_V6_PART_FILES.items():
                    item=chosen['nativeFontOriginals'][role.split('.',1)[1]] if role.startswith('nativeFontOriginals.') else chosen[role]
                    raw=base64.b64decode(item['base64'],validate=True)
                    (parts/name).write_bytes(raw);roles[role]={'byteLength':len(raw),'sha256':H(raw)};raws[role]=raw
                manifest=E({'schema':'bw.gui-hdd.actual-v6-parts-manifest.v1','expected':small,'parts':roles})
                manifest_path.write_bytes(manifest)
                self.assertLessEqual(len(manifest)+sum(len(raw) for raw in raws.values()),r.JSON_CAP)
                return manifest,raws
            manifest,raws=write_parts(selected)
            self.assertEqual(r.actual_v6_parts_expected(manifest_path,parts),selected)
            with patch.object(r.sys,'stdout',io.StringIO()) as stream:
                self.assertEqual(r.main(['--actual-v6-parts','--manifest',str(manifest_path),'--parts',str(parts),
                                         '--artifact',str(artifact_path)]),0)
                new=D(stream.getvalue().encode())
            old=r.audit(originals,selected)
            self.assertEqual(new,old)
            # All reader predicates remain live after reconstruction. Rewrapping a
            # semantically false request cannot gain a verdict through the new route.
            changed=copy.deepcopy(files);request=D(changed['request.original.json'])
            del request['installedFiles']['node_modules/bw-circuit-ui/src/index.js']
            request['installedFiles']['node_modules/bw-circuit-ui/src/current.js']=ROW(b'old-only')
            changed['request.original.json']=E(request)
            chosen=copy.deepcopy(selected);chosen['requestSha256']=H(changed['request.original.json'])
            bad_artifact=packet(changed);chosen['artifactBytes']=len(bad_artifact);chosen['artifactSha256']=H(bad_artifact)
            chosen['artifact']['size_in_bytes']=len(bad_artifact);chosen['artifact']['digest']='sha256:'+H(bad_artifact)
            artifact_path.write_bytes(bad_artifact);write_parts(chosen)
            with self.assertRaises(ValueError):r.audit(*sealed(changed,chosen))
            with self.assertRaises(ValueError):r.main(['--actual-v6-parts','--manifest',str(manifest_path),
                                                       '--parts',str(parts),'--artifact',str(artifact_path)])
            artifact_path.write_bytes(artifact);write_parts(selected)
            # Closed census, role extent, aliases, canonical manifest, and old
            # positional size cap are independent of the packet's guest verdict.
            (parts/'extra').write_bytes(b'x')
            with self.assertRaises(r.ActualV6PartsFailure):r.actual_v6_parts_expected(manifest_path,parts)
            (parts/'extra').unlink()
            original=(parts/'inventory-template.json').read_bytes()
            (parts/'inventory-template.json').unlink();(parts/'inventory-template.json').symlink_to('inventory-original.json')
            with self.assertRaises(r.ActualV6PartsFailure):r.actual_v6_parts_expected(manifest_path,parts)
            (parts/'inventory-template.json').unlink();(parts/'inventory-template.json').write_bytes(original)
            item=D(manifest);item['parts']['inventoryOriginal']['byteLength']=r.JSON_CAP
            manifest_path.write_bytes(E(item))
            original_open=r.os.open
            def refuse_directory_open(path,*args,**kwargs):
                if pathlib.Path(path)==parts:raise AssertionError('aggregate gate opened parts directory')
                return original_open(path,*args,**kwargs)
            with patch.object(r.os,'open',side_effect=refuse_directory_open):
                with self.assertRaisesRegex(ValueError,'aggregate'):r.actual_v6_parts_expected(manifest_path,parts)
            manifest_path.write_bytes(manifest)
            (parts/'native-event.json').write_bytes(b'X'+raws['nativeFontOriginals.event'][1:])
            with self.assertRaises(r.ActualV6PartsFailure):r.actual_v6_parts_expected(manifest_path,parts)
            (parts/'native-event.json').write_bytes(raws['nativeFontOriginals.event'])
            manifest_path.write_bytes(manifest[:-1]+b' \n')
            with self.assertRaisesRegex(ValueError,'canonical closed'):r.actual_v6_parts_expected(manifest_path,parts)
            manifest_path.write_bytes(manifest)
            with self.assertRaisesRegex(ValueError,'exact seven-token'):
                r.main(['--actual-v6-parts','--parts',str(parts),'--manifest',str(manifest_path),
                        '--artifact',str(artifact_path)])
            oversized=base/'oversized-expected.json';oversized.write_bytes(b' '* (r.JSON_CAP+1))
            with self.assertRaises(ValueError):r.main([str(artifact_path),str(oversized)])

    def test_actual_v6_parts_first_read_error_and_close_secondary(self):
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            path=pathlib.Path(temporary)/'original.json';path.write_bytes(b'{"value":1}\n')
            original_close=r.os.close
            def close_then_fail(descriptor):
                original_close(descriptor)
                raise OSError('mock close failure after retained first read failure')
            with (patch.object(r.os,'read',side_effect=OSError('mock first read failure')),
                  patch.object(r.os,'close',side_effect=close_then_fail)):
                with self.assertRaises(r.ActualV6PartsFailure) as caught:
                    r.actual_v6_part_read(path,1024,'manifest')
            self.assertEqual(caught.exception.firstFailure['phase'],'manifest')
            self.assertIn('first read failure',caught.exception.firstFailure['message'])
            self.assertEqual(len(caught.exception.secondary),1)
            self.assertEqual(caught.exception.secondary[0]['phase'],'manifest-close')

    def test_actual_v6_current_native_git_and_cross_head_mutants(self):
        files,expected=self.actual_v6_packet();request=D(files['request.original.json'])
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            checkout=pathlib.Path(temporary)
            for path in c.NATIVE_FONT_SOURCE:
                selected=checkout/path;selected.parent.mkdir(parents=True,exist_ok=True)
                selected.write_bytes(('native-source:'+path).encode())
            class Git:
                def __init__(self,selection):self.selection=selection;self.calls=[]
                def git(self,args):
                    self.calls.append(args);path=args[-1].split(':',1)[-1];row=self.selection['files'][path]
                    return ('100644 blob '+row['gitBlob']+'\t'+path+'\x00').encode() if args[0]=='ls-tree' else ('native-source:'+path).encode()
            class Output:
                def __init__(self):self.files={}
                def save(self,name,raw):self.files[name]=raw
            edge=Git(request['nativeSourceGit']['current']);output=Output()
            observed=c.observe_native_source_git_v6(request,checkout,edge,output)
            self.assertEqual(observed['files'],request['nativeSourceGit']['current']['files'])
            self.assertEqual(len(edge.calls),10)
            self.assertEqual(D(output.files['native-source-git.before.json']),observed)
            forged=copy.deepcopy(request);first=sorted(c.NATIVE_FONT_SOURCE)[0]
            broken_h1=copy.deepcopy(request);broken_h1['nativeSourceGit']['finite']['files'][first]['gitBlob']='0'*40
            for module in (c,r):
                with self.assertRaisesRegex(ValueError,'H0/H1/A|H0, finite H1'):
                    module.native_source_git_v6(broken_h1['nativeSourceGit'],broken_h1['nativeFontAdmission'],
                                                broken_h1['inventoryAdmission'],broken_h1['source']['head'])
            for label in ('observed','finite','current'):forged['nativeSourceGit'][label]['files'][first]['gitBlob']='0'*40
            self.assertEqual(c.native_source_git_v6(forged['nativeSourceGit'],forged['nativeFontAdmission'],forged['inventoryAdmission'],forged['source']['head']),forged['nativeSourceGit'])
            with self.assertRaisesRegex(ValueError,'current native source Git/live exact bytes'):
                c.observe_native_source_git_v6(forged,checkout,Git(forged['nativeSourceGit']['current']),Output())
            drift=checkout/first;drift.write_bytes(b'changed-current-file')
            with self.assertRaisesRegex(ValueError,'admitted file changed'):
                c.observe_native_source_git_v6(request,checkout,Git(request['nativeSourceGit']['current']),Output())

    def test_current_v5_build_whole_tree_and_current_head_are_live(self):
        for role in ('head','tree'):
            files,expected=fixture_v5();request=D(files['request.original.json'])
            if role=='head':request['build']['head']='f'*40
            else:request['build']['sourceAdmission']['checkoutTree']='f'*40
            raw=E(request)
            for module in (c,r):
                with self.assertRaisesRegex(ValueError,'complete checkout tree'):module.parse_request(raw,H(raw))
    def test_current_v5_installed_cui_before_after_and_missing_census(self):
        for stage in ('before','after'):
            files,expected=fixture_v5();value=D(files['installed.'+stage+'.json']);value['node_modules/bw-circuit-ui/src/current.js']['sha256']='0'*64;files['installed.'+stage+'.json']=E(value)
            with self.assertRaisesRegex(ValueError,'installed graph original'):r.audit(files,expected)
        files,expected=fixture_v5();request=D(files['request.original.json']);del request['installedFiles']['node_modules/bw-circuit-ui/package.json'];raw=E(request)
        for module in (c,r):
            with self.assertRaisesRegex(ValueError,'Circuit UI inventory'):module.parse_request(raw,H(raw))

    def test_current_v5_font_identity_request_parser_mutant_is_detected(self):
        files,expected=fixture_v5();request=D(files['request.original.json']);request['nativeFontAdmission']['files']['/usr/lib/libfontconfig-selected.so']['sha256']='0'*64
        raw=E(request)
        for module in (r,c):
            with self.assertRaisesRegex(ValueError,'current GUI runtime readback'):module.parse_request(raw,H(raw))
        text=(root/'scripts/read-i80386-hdd-gui-originals.py').read_text()
        old="need(encode(row)==encode(runtime['files'].get(path)),'native file joins current GUI runtime readback selection')"
        self.assertIn(old,text);namespace={'__name__':'native_font_current_readback_mutant'}
        exec(compile(text.replace(old,"need(True,'native file joins current GUI runtime readback selection')",1),'native-readback-mutant','exec'),namespace)
        self.assertEqual(namespace['parse_request'](raw,H(raw)),request)

    def assert_noncurrent_board_refuses_actual_formats(self,noncurrent):
        self.assertNotEqual(noncurrent,r.BOARD)
        for factory in (fixture,fixture_v4):
            files,expected=factory();self.assertTrue(r.audit(*sealed(copy.deepcopy(files),copy.deepcopy(expected)))['pass'])
            for role in ('admission',*r.SCENARIOS):
                changed=copy.deepcopy(files)
                if role=='admission':
                    admission=D(changed['probe-admission.json']);admission['boardPin']=noncurrent;raw=E(admission);changed['probe-admission.json']=raw
                    for scenario in r.SCENARIOS:
                        changed[scenario+'/admission.json']=raw;proof=D(changed[scenario+'/proof.json']);proof.update(boardPin=noncurrent,admissionSha256=H(raw));changed[scenario+'/proof.json']=E(proof)
                else:
                    proof=D(changed[role+'/proof.json']);proof['boardPin']=noncurrent;changed[role+'/proof.json']=E(proof)
                with self.assertRaisesRegex(ValueError,'actual probe source/build admission joins' if role=='admission' else 'scenario proof source/admission identity'):
                    r.audit(*sealed(changed,copy.deepcopy(expected)))
    def test_current_board_requires_current_admission_and_scenario_pins_v3_v4(self):
        self.assert_noncurrent_board_refuses_actual_formats('0'*40)

    @patch.object(c,'FINITE_INVENTORY_V10_ENABLED',True)
    def test_producer_finite_v10_connected_collector_retention_and_independent_reader(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(('synthetic:'+name).encode()) for name in c.INSTALLED_V6_CRITICAL}
        selected.update({name:{'byteLength':size,'sha256':pin} for name,(size,pin) in c.FINITE_V10_CUI_WITNESSES.items()})
        def installed(where,prefix,failure,checkout,critical,identity_witnesses=None):
            self.assertIs(identity_witnesses,c.FINITE_V10_CUI_WITNESSES)
            return {name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        with self.inventory_edges(paths,finite=True,finite_version=10) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed),patch.object(c,'actual_v9_read_state',return_value=({}, {'deadlineMonotonicNs':1000000000000})):
            value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
        self.assertEqual(value['schema'],'bw.gui-hdd.inventory-original.v10',value.get('firstFailure'))
        self.assertEqual(value['resolverObservation'],{'kind':'regular','path':'/etc/resolv.conf'})
        variables={key:env[key] for key in ('BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64','BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256','BW_FINITE_INVENTORY_V10_TEMPLATE_B64','BW_FINITE_INVENTORY_V10_SHA256')}
        expected={'schema':'bw.gui-hdd.inventory-admission.v10','source':value['source'],'template':ROW(raw),'original':ROW(E(value)),
          'runId':90,'workflowSha':'a'*40,'dependencyPins':copy.deepcopy(c.FINITE_V10_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),'repositoryVariables':variables}
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            target=pathlib.Path(temporary)/'inventory-original.json';self.assertEqual(c.retain_inventory_observation(value,target),0)
            self.assertEqual(r.verify_inventory_original_v10(target.read_bytes(),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v10')
            with self.assertRaises(FileExistsError):c.retain_inventory_observation(value,target)


    @patch.object(c,'FINITE_INVENTORY_V10_ENABLED',True)
    def test_producer_finite_v10_symlink_connected_collector_and_failed_resolver_reader(self):
        paths=['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so']
        selected={name:ROW(('synthetic:'+name).encode()) for name in c.INSTALLED_V6_CRITICAL}
        selected.update({name:{'byteLength':size,'sha256':pin} for name,(size,pin) in c.FINITE_V10_CUI_WITNESSES.items()})
        installed=lambda where,prefix,*args,**kwargs:{name.removeprefix(prefix+'/'):row for name,row in selected.items() if name.startswith(prefix+'/')}
        for failed in (False,True):
            with self.subTest(failed=failed),self.inventory_edges(paths,finite=True,finite_version=10) as (raw,pin,env,events),self.empty_source_edges(),patch.object(c,'installed_inventory_v5',side_effect=installed) as scan,patch.object(c,'actual_v9_read_state',return_value=({}, {'deadlineMonotonicNs':1000000000000})):
                base=c.os.lstat
                def resolver(path):
                    info=base(path)
                    if str(path)=='/etc/resolv.conf':info.st_mode=(stat.S_IFIFO|0o600) if failed else (stat.S_IFLNK|0o777);info.st_size=39
                    return info
                with patch.object(c.os,'lstat',side_effect=resolver),patch.object(c.os,'readlink',return_value='../run/systemd/resolve/stub-resolv.conf'):
                    value=c.inventory_observation(raw,pin,pathlib.Path('/checkout'),env,'/out/a.json')
                if failed:scan.assert_not_called()
            variables={key:env[key] for key in ('BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64','BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256','BW_FINITE_INVENTORY_V10_TEMPLATE_B64','BW_FINITE_INVENTORY_V10_SHA256')}
            source=D(base64.b64decode(env['BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64']))['source']
            expected={'schema':'bw.gui-hdd.inventory-failure-expectation.v10' if failed else 'bw.gui-hdd.inventory-admission.v10','source':source,
              'template':ROW(raw),'runId':90,'workflowSha':'a'*40,'dependencyPins':copy.deepcopy(c.FINITE_V10_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),'repositoryVariables':variables}
            if failed:
                self.assertEqual(value['schema'],'bw.gui-hdd.inventory-failure.v10');self.assertEqual(value['firstFailure']['phase'],'inventory-resolver')
                expected['failure']=ROW(E(value));self.assertEqual(r.verify_inventory_failure(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-failure-reader.v10')
                self.assertFalse(value['gitSource']['reached'])
            else:
                expected['original']=ROW(E(value));self.assertEqual(value['resolverObservation']['kind'],'symlink')
                self.assertEqual(r.verify_inventory_original_v10(E(value),raw,expected)['schema'],'bw.gui-hdd.inventory-reader.v10')


    def reader_finite_v10_packet(self,symlink=False):
        value,old,expected=self.finite_v9_packet();template=D(old)
        # Keep the exact current source graph and literal witnesses, not old pin reinterpretation.
        vendor_raw=E(r.FINITE_V10_PINS);vendor=ROW(vendor_raw)
        source=copy.deepcopy(value['source']);source['files']['vendor-pins.json']=vendor
        value['source']=source;expected['source']=source;value['dependencyPins']=copy.deepcopy(r.FINITE_V10_PINS)
        value['commands'][2+sorted(r.SOURCE).index('vendor-pins.json')]['stdout']=vendor
        for name,(size,pin) in r.FINITE_V10_CUI_WITNESSES.items():value['installedFiles'][name]={'byteLength':size,'sha256':pin}
        endpoint='/run/systemd/resolve/stub-resolv.conf';link='../run/systemd/resolve/stub-resolv.conf'
        template.update(schema='bw.gui-hdd.inventory-template.v10',dependencyPins=copy.deepcopy(r.FINITE_V10_PINS),resolverRole={'path':'/etc/resolv.conf','allowedKinds':['regular','symlink'],'symlinkAlternatives':[{'linkText':link,'target':endpoint}]})
        template['files']=sorted(set(template['files'])-{'/etc/resolv.conf'}|{endpoint})
        value['runtime']['files'][endpoint]=ROW(b'endpoint')
        observed={'kind':'symlink','path':'/etc/resolv.conf','linkText':link,'target':endpoint} if symlink else {'kind':'regular','path':'/etc/resolv.conf'}
        if symlink:
            value['runtime']['files'].pop('/etc/resolv.conf',None);value['runtime']['aliases']['/etc/resolv.conf']={'linkText':link,'target':endpoint}
        raw=E(template)
        files,_,_=self.actual_v8_packet();request=D(files['request.original.json'])
        prelude={'schema':'bw.gui-hdd.actual-v9-prelude.v1','repository':r.REPOSITORY,'pullRequest':8,'source':source,'template':ROW(raw),'build':request['build'],'nativeFontAdmission':request['nativeFontAdmission'],'nativeSourceGit':request['nativeSourceGit'],'dispatch':{'ref':'refs/heads/lane/test-only-v9','workflow':{'path':'.github/workflows/i80386-hdd-gui-actual.yml','sha256':source['files']['.github/workflows/i80386-hdd-gui-actual.yml']['sha256']}},'resources':{'jobSeconds':2100,'ackWaitSeconds':180,'cleanupReserveSeconds':60,'scenarioSeconds':{'freedos-hdd-persistence':1250,'forward-debug':180}}}
        prelude['build'].update(head=source['head'],sourceFiles=source['files'])
        prelude['build']['sourceAdmission'].update(checkoutTree=source['tree'],sourceFiles=source['files'])
        prelude_raw=E(prelude)
        variables={'BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256':H(prelude_raw),'BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64':base64.b64encode(prelude_raw).decode(),'BW_FINITE_INVENTORY_V10_SHA256':H(raw),'BW_FINITE_INVENTORY_V10_TEMPLATE_B64':base64.b64encode(raw).decode()}
        platform=value['platform'];platform.update(GITHUB_JOB='actual-v9',GITHUB_EVENT_NAME='workflow_dispatch',GITHUB_WORKFLOW_SHA=source['head'],GITHUB_WORKFLOW_REF=r.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@'+prelude['dispatch']['ref'])
        event={'repository':{'full_name':r.REPOSITORY},'sender':{'login':'CrispStrobe'},'ref':prelude['dispatch']['ref'],'inputs':{'protocol':'actual-v9','source_ref':prelude['dispatch']['ref'],'pull_request':'8','source_head':source['head'],'request_sha256':'','tag_name':'','prelude_sha256':H(prelude_raw)}}
        event_raw=E(event)
        guard=D(base64.b64decode(value['guardAdmission']['base64']));guard.update(schema='bw.gui-hdd.finite-inventory-guard.v10',templateSha256=H(raw),eventSha256=H(event_raw),source=source,dependencyPins=copy.deepcopy(r.FINITE_V10_PINS),vendorPinsOriginal=dict(vendor,base64=base64.b64encode(vendor_raw).decode()),platform={key:platform.get(key)for key in ('GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_JOB','GITHUB_REPOSITORY','GITHUB_WORKFLOW_SHA','BW_EXPECTED_HEAD')})
        guard['bootstrapAdmission']['gitHead']=source['head']
        value.update(schema='bw.gui-hdd.inventory-original.v10',templateSha256=H(raw),event=dict(ROW(event_raw),base64=base64.b64encode(event_raw).decode()),guardAdmission=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode()),resolverObservation=observed,bootstrapAdmission=guard['bootstrapAdmission'])
        expected.update(schema='bw.gui-hdd.inventory-admission.v10',template=ROW(raw),original=ROW(E(value)),workflowSha=source['head'],dependencyPins=copy.deepcopy(r.FINITE_V10_PINS),repositoryVariables=variables)
        return value,raw,expected,prelude_raw

    def test_reader_f10_both_roles_and_coherently_rehashed_role_adversaries(self):
        for symlink in (False,True):
            value,raw,expected,_=self.reader_finite_v10_packet(symlink)
            result=r.verify_inventory_original_v10(E(value),raw,expected)
            self.assertEqual(result['schema'],'bw.gui-hdd.inventory-reader.v10');self.assertFalse(result['qualified']);self.assertFalse(result['actualRequestSupported'])
            for cut in ('wrong-kind','missing-resolver','overlap','endpoint','old-pins','guest-authority','link-text'):
                changed=copy.deepcopy(value)
                if cut=='wrong-kind':changed['resolverObservation']['kind']='socket'
                elif cut=='missing-resolver':changed['runtime']['files'].pop('/etc/resolv.conf',None);changed['runtime']['aliases'].pop('/etc/resolv.conf',None)
                elif cut=='overlap':changed['runtime']['files']['/etc/resolv.conf']=ROW(b'invented');changed['runtime']['aliases']['/etc/resolv.conf']={'linkText':'../run/systemd/resolve/stub-resolv.conf','target':'/run/systemd/resolve/stub-resolv.conf'}
                elif cut=='endpoint':changed['runtime']['files'].pop('/run/systemd/resolve/stub-resolv.conf')
                elif cut=='old-pins':changed['dependencyPins']=copy.deepcopy(r.FINITE_V9_PINS)
                elif cut=='guest-authority':changed['guestApproved']=True
                else:changed['resolverObservation']['linkText']='unselected'
                selected=copy.deepcopy(expected);selected['original']=ROW(E(changed))
                with self.subTest(symlink=symlink,cut=cut),self.assertRaises((ValueError,KeyError)):r.verify_inventory_original_v10(E(changed),raw,selected)

    def test_reader_f10_unknown_template_target_and_dispatch_cuts(self):
        value,raw,expected,prelude_raw=self.reader_finite_v10_packet(True)
        template=D(raw)
        for cut in ('unknown-target','overlap','old-schema','old-pins','extra-kind'):
            changed=copy.deepcopy(template)
            if cut=='unknown-target':changed['resolverRole']['symlinkAlternatives']=[{'linkText':'/unselected','target':'/unselected'}]
            elif cut=='overlap':changed['files'].append('/etc/resolv.conf')
            elif cut=='old-schema':changed['schema']='bw.gui-hdd.inventory-template.v9'
            elif cut=='old-pins':changed['dependencyPins']=copy.deepcopy(r.FINITE_V9_PINS)
            else:changed['resolverRole']['allowedKinds'].append('fifo')
            body=E(changed)
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.finite_v10_template(body,H(body))
        event=base64.b64decode(value['event']['base64']);env=dict(value['platform'],**expected['repositoryVariables'])
        self.assertEqual(r.bind_finite_v10_event(event,value['source']['head'],H(raw),env),raw)
        for field in ('GITHUB_JOB','GITHUB_RUN_ATTEMPT','GITHUB_WORKFLOW_SHA','BW_EXPECTED_HEAD'):
            changed=dict(env);changed[field]='unselected'
            with self.subTest(field=field),self.assertRaises(ValueError):r.bind_finite_v10_event(event,value['source']['head'],H(raw),changed)

    def reader_phase_v9_packet(self):
        value,template,admission,prelude=self.reader_finite_v10_packet(True)
        run={'id':90,'run_attempt':1,'status':'in_progress','conclusion':None,'event':'workflow_dispatch','head_sha':value['source']['head'],'path':'.github/workflows/i80386-hdd-gui-actual.yml','repository':{'full_name':r.REPOSITORY},'actor':{'login':'CrispStrobe'}}
        job={'started_at':'2026-10-28T00:00:00Z','id':91,'run_id':90,'run_attempt':1,'head_sha':value['source']['head'],'name':'actual-v9','status':'in_progress','conclusion':None,'steps':[{'number':i,'name':name,'status':'completed','conclusion':'success'}for i,name in enumerate(r.STARTUP_STEPS_V9[:4],1)]+[{'number':5,'name':'Await ACK','status':'in_progress','conclusion':None}]}
        deadline={'schema':'bw.gui-hdd.actual-v9-deadline.v1','runId':90,'runAttempt':1,'jobId':91,'sourceHead':value['source']['head'],'startedMonotonicNs':8000000000,'deadlineMonotonicNs':2108000000000,'cleanupReserveSeconds':60,'clock':{'schema':'bw.gui-hdd.actual-v9-clock.v1','jobStartedAt':'2026-10-28T00:00:00Z','httpDate':'Wed, 28 Oct 2026 00:00:01 GMT','requestMonotonicNs':10000000000,'responseMonotonicNs':11000000000,'requestWallTimeNs':10000000000,'responseWallTimeNs':11000000000,'serverDateSeconds':1793145601,'jobStartedSeconds':1793145600,'elapsedUpperNs':3000000000}}
        raw_event=base64.b64decode(value['event']['base64'])
        files={'gui-actual-v9/prelude.original.json':prelude,'gui-actual-v9/event.original.json':raw_event,'gui-actual-v9/dispatch-job.original.json':E(job),'gui-actual-v9/deadline.json':E(deadline),'gui-actual-v9/dispatch-clock.original.json':E(deadline['clock']),'gui-finite-inventory-v10/runtime-template.json':template,'gui-finite-inventory-v10/event.original.json':raw_event,'gui-finite-inventory-v10/guard-admission.json':base64.b64decode(value['guardAdmission']['base64']),'gui-finite-inventory-v10/inventory.json':E(value),'gui-finite-inventory-v10/bootstrap.stdout':base64.b64decode(value['bootstrapHelper']['stdout']['base64']),'gui-finite-inventory-v10/bootstrap.stderr':b''}
        prefix=['/usr/bin/git','--no-replace-objects','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
        source=value['source'];args=[['rev-parse','HEAD'],['rev-parse','HEAD^{tree}']]+[['cat-file','blob',source['head']+':'+path]for path in sorted(r.SOURCE)]
        source_bytes={path:E(r.FINITE_V10_PINS) if path=='vendor-pins.json' else ('source:'+path).encode()for path in r.SOURCE}
        helper=r.BOOTSTRAP_SOURCE;helperraw=(root/helper['path']).read_bytes()
        for family,guard_stage in (('inventory-git-originals',False),('guard-originals',True)):
            log={};selected=args+([['ls-tree',source['head'],'--',helper['path']],['cat-file','blob',source['head']+':'+helper['path']]]if guard_stage else [])
            for i,arguments in enumerate(selected):
                if i<2:body=(source['head' if i==0 else 'tree']+'\n').encode()
                elif i<2+len(r.SOURCE):body=source_bytes[sorted(r.SOURCE)[i-2]]
                elif arguments[0]=='ls-tree':body=(helper['mode']+' blob '+helper['gitBlob']+'\t'+helper['path']+'\n').encode()
                else:body=helperraw
                role='git-'+str(i);log[role+'.stdout']=body;log[role+'.stderr']=b'';log[role+'.process.json']=E(proc(prefix+arguments,body))
            if guard_stage:
                log['template.original.json']=template;log['event.original.json']=raw_event
                log['result.json']=base64.b64decode(value['guardAdmission']['base64']);log['inventory.json']=E({'schema':'bw.gui-hdd.originals.v1','files':{name:ROW(raw)for name,raw in log.items()}})
            for name,body in log.items():files['gui-finite-inventory-v10/'+family+'/'+name]=body
        source_guard={'jobs.original.json':E({'total_count':1,'jobs':[job]}),'pr.original.json':E({'number':8,'state':'open','draft':False,'head':{'sha':source['head'],'repo':{'full_name':r.REPOSITORY,'fork':False}},'base':{'ref':'main','repo':{'full_name':r.REPOSITORY}},'body':'<!-- BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256='+H(prelude)+' -->'}),'result.json':E({'schema':'bw.gui-hdd.actual-v9-source-guard.v1','pass':True,'guestApproved':False,'firstFailure':None})}
        source_guard['inventory.json']=E({'schema':'bw.gui-hdd.originals.v1','files':{name:ROW(raw)for name,raw in source_guard.items()}})
        for name,body in source_guard.items():files['gui-actual-v9/guard-originals/'+name]=body
        raw=zip_(files)
        artifact={'id':92,'name':'i80386-hdd-gui-actual-v9-phase-90-1','expired':False,'size_in_bytes':len(raw),'digest':'sha256:'+H(raw),'workflow_run':{'id':90,'head_sha':value['source']['head']}}
        expected={'schema':'bw.gui-hdd.actual-v9-phase-expectation.v1','source':value['source'],'prelude':ROW(prelude),'template':ROW(template),'inventory':ROW(E(value)),'inventoryAdmission':admission,'run':run,'job':job,'artifact':artifact,'uploadStep':{'number':4,'name':'Retain immutable V10 same-job phase originals'},'artifactBytes':len(raw),'artifactSha256':H(raw),'workflowSha':value['source']['head']}
        return files,expected

    def test_reader_v9_phase_inprogress_is_not_final_or_guest_success(self):
        files,expected=self.reader_phase_v9_packet();report=r.verify_actual_v9_phase(zip_(files),expected)
        # Event 41628975547 uploaded exactly this roster: 79 guard + 69 inventory Git + 15 top-level originals.
        self.assertEqual(len(files),163);self.assertEqual(set(files),r.actual_v9_phase_roles())
        self.assertEqual(sum(name.startswith('gui-finite-inventory-v10/guard-originals/')for name in files),79)
        self.assertEqual(sum(name.startswith('gui-finite-inventory-v10/inventory-git-originals/')for name in files),69);self.assertFalse(report['guestApproved']);self.assertFalse(report['jobSuccessProved'])
        for cut in ('upload-incomplete','wrong-job','completed-run','artifact-rebound','injected-guest','deadline','missing-guard','inventory-drift','raw-source','raw-guard','missing-triplet','over-roster','over-roster-git','guard-template','guard-event','missing-guard-template'):
            f=copy.deepcopy(files);e=copy.deepcopy(expected)
            if cut=='upload-incomplete':e['job']['steps'][3].update(status='in_progress',conclusion=None)
            elif cut=='wrong-job':e['job']['id']=999
            elif cut=='completed-run':e['run'].update(status='completed',conclusion='success')
            elif cut=='artifact-rebound':e['artifact']['workflow_run']['id']=999
            elif cut=='injected-guest':f['gui-actual-v9/proof.json']=E({'pass':True})
            elif cut=='deadline':v=D(f['gui-actual-v9/deadline.json']);v['deadlineMonotonicNs']+=1;f['gui-actual-v9/deadline.json']=E(v)
            elif cut=='missing-guard':f.pop('gui-finite-inventory-v10/guard-admission.json')
            elif cut=='raw-source':f['gui-finite-inventory-v10/inventory-git-originals/git-2.stdout']=b'changed'
            elif cut=='raw-guard':f['gui-finite-inventory-v10/guard-originals/result.json']=E({'pass':True})
            elif cut=='missing-triplet':f.pop('gui-finite-inventory-v10/inventory-git-originals/git-0.stderr')
            elif cut=='over-roster':f['gui-finite-inventory-v10/guard-originals/extra.json']=b'{}'
            elif cut=='over-roster-git':
                for suffix in ('stdout','stderr','process.json'):f['gui-finite-inventory-v10/inventory-git-originals/git-23.'+suffix]=b''
            elif cut in ('guard-template','guard-event','missing-guard-template'):
                prefix='gui-finite-inventory-v10/guard-originals/'
                if cut=='missing-guard-template':f.pop(prefix+'template.original.json')
                else:f[prefix+('template' if cut=='guard-template' else 'event')+'.original.json']+=b' '
                manifest=D(f[prefix+'inventory.json']);manifest['files']={name:ROW(f[prefix+name])for name in manifest['files']if prefix+name in f};f[prefix+'inventory.json']=E(manifest)
            else:v=D(f['gui-finite-inventory-v10/inventory.json']);v['runtime']['files']['/run/systemd/resolve/stub-resolv.conf']=ROW(b'changed');f['gui-finite-inventory-v10/inventory.json']=E(v)
            raw=zip_(f);e.update(artifactBytes=len(raw),artifactSha256=H(raw));e['artifact'].update(size_in_bytes=len(raw),digest='sha256:'+H(raw))
            with self.subTest(cut=cut),self.assertRaises((ValueError,KeyError)):r.verify_actual_v9_phase(raw,e)
        for target in ('selected','retained'):
            for field,value in (('head_sha',None),('head_sha',True),('head_sha','0'*40),('run_attempt',None),('run_attempt',True),('run_attempt',2)):
                f=copy.deepcopy(files);e=copy.deepcopy(expected)
                if target=='selected':
                    job=e['job']
                    if value is None:job.pop(field)
                    else:job[field]=value
                else:
                    job=D(f['gui-actual-v9/dispatch-job.original.json'])
                    if value is None:job.pop(field)
                    else:job[field]=value
                    f['gui-actual-v9/dispatch-job.original.json']=E(job)
                    prefix='gui-actual-v9/guard-originals/'
                    jobs=D(f[prefix+'jobs.original.json']);jobs['jobs'][0]=copy.deepcopy(job);f[prefix+'jobs.original.json']=E(jobs)
                    manifest=D(f[prefix+'inventory.json'])
                    for name in manifest['files']:manifest['files'][name]=ROW(f[prefix+name])
                    f[prefix+'inventory.json']=E(manifest)
                raw=zip_(f);e.update(artifactBytes=len(raw),artifactSha256=H(raw));e['artifact'].update(size_in_bytes=len(raw),digest='sha256:'+H(raw))
                with self.subTest(target=target,field=field,value=value),self.assertRaises(ValueError):r.verify_actual_v9_phase(raw,e)


    def reader_ack_v9_packet(self):
        value,template,admission,prelude_raw=self.reader_finite_v10_packet(True);prelude=D(prelude_raw);head=value['source']['head']
        same={'schema':'bw.gui-hdd.same-job.v1','runId':90,'runAttempt':1,'jobId':91,'preludeSha256':H(prelude_raw),'templateSha256':H(template),'inventorySha256':H(E(value)),'artifactId':92,'artifactSha256':'a'*64,'ackRef':'refs/heads/bw-gui-hdd-actual-v9-ack-90-91-'+head}
        request={key:prelude[key]for key in ('repository','pullRequest','source','build','nativeFontAdmission','nativeSourceGit','dispatch')};request['sameJob']=same;request['schema']='bw.gui-hdd.actual-request.v9'
        request_raw=E(request);ack={'schema':'bw.gui-hdd.actual-v9-ack.v1','repository':r.REPOSITORY,'sourceHead':head,**{key:same[key]for key in ('runId','runAttempt','jobId','preludeSha256','templateSha256','inventorySha256','artifactId','artifactSha256')},'request':dict(ROW(request_raw),gitBlob=r.git_blob_sha_v9(request_raw))};ack_raw=E(ack)
        commit='c'*40;tree='d'*40;ackblob=r.git_blob_sha_v9(ack_raw)
        files={'request.original.json':request_raw,'same-job/ack.original.json':ack_raw,'same-job/ack-ref.original.json':E({'ref':same['ackRef'],'object':{'type':'commit','sha':commit}}),'same-job/ack-commit.original.json':E({'sha':commit,'parents':[],'tree':{'sha':tree}}),'same-job/ack-tree.original.json':E({'sha':tree,'truncated':False,'tree':[{'path':name,'mode':'100644','type':'blob','sha':r.git_blob_sha_v9(raw),'size':len(raw)}for name,raw in [('ack.json',ack_raw),('request.json',request_raw)]]}),'same-job/ack-blob.original.json':E({'sha':ackblob,'size':len(ack_raw),'encoding':'base64','content':base64.b64encode(ack_raw).decode()}),'same-job/input-install.json':E(ack['request']),'same-job/prelude.original.json':prelude_raw,'same-job/template.original.json':template,'same-job/inventory.original.json':E(value),'same-job/deadline.json':E({'schema':'bw.gui-hdd.actual-v9-deadline.v1','runId':90,'runAttempt':1,'jobId':91,'sourceHead':head,'startedMonotonicNs':8000000000,'deadlineMonotonicNs':2108000000000,'cleanupReserveSeconds':60,'clock':{'schema':'bw.gui-hdd.actual-v9-clock.v1','jobStartedAt':'2026-10-28T00:00:00Z','httpDate':'Wed, 28 Oct 2026 00:00:01 GMT','requestMonotonicNs':10000000000,'responseMonotonicNs':11000000000,'requestWallTimeNs':10000000000,'responseWallTimeNs':11000000000,'serverDateSeconds':1793145601,'jobStartedSeconds':1793145600,'elapsedUpperNs':3000000000}})}
        files['same-job/ack-ref-after.original.json']=files['same-job/ack-ref.original.json']
        return files,request,{'ackCommit':commit,'ackBlob':ackblob,'ackSha256':H(ack_raw)}

    def test_reader_v9_ack_exact_reachable_request_and_negative_object_roles(self):
        files,request,expected=self.reader_ack_v9_packet();self.assertEqual(r.verify_actual_v9_ack(files,request,expected)['jobId'],91)
        for cut in ('wrong-job','replayed-request','mutable-history','missing-request','symlink','wrong-ref','changed-blob','install-substitution'):
            f=copy.deepcopy(files);e=copy.deepcopy(expected)
            if cut=='wrong-job':v=D(f['same-job/ack.original.json']);v['jobId']=999;f['same-job/ack.original.json']=E(v)
            elif cut=='replayed-request':f['request.original.json']+=b' '
            elif cut=='mutable-history':v=D(f['same-job/ack-commit.original.json']);v['parents']=[{'sha':'f'*40}];f['same-job/ack-commit.original.json']=E(v)
            elif cut in ('missing-request','symlink'):
                v=D(f['same-job/ack-tree.original.json'])
                if cut=='missing-request':v['tree']=v['tree'][:1]
                else:v['tree'][1]['mode']='120000'
                f['same-job/ack-tree.original.json']=E(v)
            elif cut=='wrong-ref':v=D(f['same-job/ack-ref.original.json']);v['ref']='refs/heads/other';f['same-job/ack-ref.original.json']=E(v)
            elif cut=='changed-blob':v=D(f['same-job/ack-blob.original.json']);v['content']=base64.b64encode(b'changed').decode();f['same-job/ack-blob.original.json']=E(v)
            else:f['same-job/input-install.json']=E(dict(D(f['same-job/input-install.json']),sha256='0'*64))
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.verify_actual_v9_ack(f,request,e)

    def reader_final_v9_packet(self):
        files,expected,env=self.actual_v8_packet();request=D(files['request.original.json'])
        value,template,admission,prelude_raw=self.reader_finite_v10_packet(True);prelude=D(prelude_raw)
        request.update(schema='bw.gui-hdd.actual-request.v9',pullRequest=prelude['pullRequest'],source=copy.deepcopy(value['source']),build=copy.deepcopy(prelude['build']),dependencyPins=copy.deepcopy(r.FINITE_V10_PINS),dispatch=copy.deepcopy(prelude['dispatch']))
        vendor=E(r.FINITE_V10_PINS);request['criticalFiles']['vendor-pins.json']=ROW(vendor)
        for name,row in value['installedFiles'].items():request['installedFiles'][name]=row
        value['installedFiles']=copy.deepcopy(request['installedFiles'])
        for role in ('files','aliases','directoryAliases'):
            if role=='files':request['runtime'][role].pop('/etc/resolv.conf',None)
            if role=='files':request['runtime'][role].update(value['runtime'][role])
            else:request['runtime'][role]=copy.deepcopy(value['runtime'][role])
        admission.update(original=ROW(E(value)),runId=200)
        value['platform']['GITHUB_RUN_ID']='200'
        guard=D(base64.b64decode(value['guardAdmission']['base64']));guard['platform']['GITHUB_RUN_ID']='200';value['guardAdmission']=dict(ROW(E(guard)),base64=base64.b64encode(E(guard)).decode());admission['original']=ROW(E(value))
        reference=copy.deepcopy(request['inventoryAdmission']);reference.update(schema='bw.gui-hdd.actual-finite-inventory-reference.v7',metadataAdmission=admission,jobId=expected['jobId'],artifactId=992,artifactSha256='a'*64);reference['workflow']['commit']=value['source']['head'];request['inventoryAdmission']=reference
        head=request['source']['head'];jobid=expected['jobId']
        same={'schema':'bw.gui-hdd.same-job.v1','runId':200,'runAttempt':1,'jobId':jobid,'preludeSha256':H(prelude_raw),'templateSha256':H(template),'inventorySha256':H(E(value)),'artifactId':992,'artifactSha256':'a'*64,'ackRef':'refs/heads/bw-gui-hdd-actual-v9-ack-200-'+str(jobid)+'-'+head};request['sameJob']=same
        raw=E(request);pin=H(raw);files['request.original.json']=raw
        expected.update(schema='bw.gui-hdd.actual-expectation.v9',requestSha256=pin,buildSourceAdmissionSha256=H(E(request['build']['sourceAdmission'])),inventoryOriginal=dict(ROW(E(value)),base64=base64.b64encode(E(value)).decode()),inventoryTemplate=dict(ROW(template),base64=base64.b64encode(template).decode()),inventoryReferenceSha256=H(E(reference)),dependencyPins=request['dependencyPins'],vendorPinsSha256=ROW(vendor)['sha256'],artifactName='i80386-hdd-gui-actual-v9-200-1')
        for phase in ('before','after'):
            files['source.'+phase+'.json']=E(request['source']);files['installed.'+phase+'.json']=E(request['installedFiles'])
            runtime=D(files['runtime.'+phase+'.json'])
            for role in ('files','aliases','directoryAliases'):runtime[role]=copy.deepcopy(request['runtime'][role])
            runtime['identities']={path:runtime['identities'].get(path,{'dev':1,'ino':100+i})for i,path in enumerate(sorted(request['runtime']['files']))}
            runtime['directoryIdentities']={row['target']:runtime['directoryIdentities'].get(row['target'],{'dev':1,'ino':2,'mode':stat.S_IFDIR|0o755})for row in runtime['directoryAliases'].values()}
            files['runtime.'+phase+'.json']=E(runtime)
            startup=D(files['python-startup.'+phase+'.json']);startup['arguments'][1]='actual-v9';startup['arguments'][startup['arguments'].index('--expected-sha256')+1]=pin;files['python-startup.'+phase+'.json']=E(startup)
        index=2+sorted(r.SOURCE).index('vendor-pins.json');files['git-'+str(index)+'.stdout']=vendor;process=D(files['git-'+str(index)+'.process.json']);process['streams']['stdout']=ROW(vendor);files['git-'+str(index)+'.process.json']=E(process)
        event=base64.b64decode(value['event']['base64']);files['event.original.json']=event
        env.update(GITHUB_JOB='actual-v9',GITHUB_REF=request['dispatch']['ref'],GITHUB_REF_TYPE='branch',GITHUB_REF_NAME=request['dispatch']['ref'].removeprefix('refs/heads/'),GITHUB_WORKFLOW_REF=r.REPOSITORY+'/.github/workflows/i80386-hdd-gui-actual.yml@'+request['dispatch']['ref'])
        platform=dict(env,schema='bw.gui-hdd.actual-v9-platform.v1')
        pr=D(files['dispatch-pr.original.json']);pr['number']=request['pullRequest'];pr['body']='<!-- BW_GUI_HDD_ACTUAL_V9_REQUEST_SHA256='+pin+' -->';files['dispatch-pr.original.json']=E(pr)
        files.pop('dispatch-tag.original.json');files['dispatch-branch.original.json']=E({'ref':request['dispatch']['ref'],'object':{'type':'commit','sha':head}})
        expected['dispatchProof']={'pullRequest':ROW(files['dispatch-pr.original.json']),'branchRef':ROW(files['dispatch-branch.original.json'])}
        expected['job'].update(name='actual-v9',run_attempt=1,head_sha=head);expected['job']['steps']=[{'number':i,'name':name,'status':'completed','conclusion':'success'}for i,name in enumerate(r.STARTUP_STEPS_V9,1)];expected['artifact']['name']=expected['artifactName']
        result=D(files['result.json']);result.update(schema='bw.gui-hdd.result.v9',requestSha256=pin,dependencyPins=request['dependencyPins'],dispatchPlatform=platform);files['result.json']=E(result)
        stage=D(files['native-font.stage.json']);stage.update(requestSha256=pin,eventSha256=H(event),source=request['source']);stage['platform']['GITHUB_JOB']='actual-v9';files['native-font.stage.json']=E(stage)
        v9members,v9build=r.read_frontend(files['frontend.original.zip'],True);files['frontend.members.json']=E(v9members);files['build.inventory.json']=E(v9build)
        proof_admission=D(files['probe-admission.json']);proof_admission.update(boardPin=r.FINITE_V10_PINS['bw-board'],criticalFiles=request['criticalFiles'],buildFiles=v9build);files['probe-admission.json']=E(proof_admission)
        for scenario in r.SCENARIOS:
            files[scenario+'/admission.json']=E(proof_admission);proof=D(files[scenario+'/proof.json']);proof.update(boardPin=r.FINITE_V10_PINS['bw-board'],admissionSha256=H(E(proof_admission)));files[scenario+'/proof.json']=E(proof)
            process=D(files[scenario+'.process.json']);process['environment']['PROOF_BROWSER_SHA256']=request['runtime']['files'][request['runtime']['chromium']]['sha256'];files[scenario+'.process.json']=E(process)
            launch=D(files[scenario+'/browser-launch.json']);launch.update(sha256=request['runtime']['files'][request['runtime']['chromium']]['sha256'],byteLength=request['runtime']['files'][request['runtime']['chromium']]['byteLength']);files[scenario+'/browser-launch.json']=E(launch)
        for role in ('bootstrap-admission.json','bootstrap-helper.stdout','bootstrap-helper.stderr'):files.pop(role)
        ack={'schema':'bw.gui-hdd.actual-v9-ack.v1','repository':r.REPOSITORY,'sourceHead':head,**{key:same[key]for key in ('runId','runAttempt','jobId','preludeSha256','templateSha256','inventorySha256','artifactId','artifactSha256')},'request':dict(ROW(raw),gitBlob=r.git_blob_sha_v9(raw))};ack_raw=E(ack);commit='c'*40;tree='d'*40;blob=r.git_blob_sha_v9(ack_raw)
        files.update({'same-job/prelude.original.json':prelude_raw,'same-job/event.original.json':event,'same-job/dispatch-job.original.json':E({'id':jobid,'run_id':200,'run_attempt':1,'head_sha':head,'name':'actual-v9','status':'in_progress','started_at':'2026-10-28T00:00:00Z'}),'same-job/ack.original.json':ack_raw,'same-job/ack-ref.original.json':E({'ref':same['ackRef'],'object':{'type':'commit','sha':commit}}),'same-job/ack-commit.original.json':E({'sha':commit,'parents':[],'tree':{'sha':tree}}),'same-job/ack-tree.original.json':E({'sha':tree,'truncated':False,'tree':[{'path':name,'mode':'100644','type':'blob','sha':r.git_blob_sha_v9(body),'size':len(body)}for name,body in [('ack.json',ack_raw),('request.json',raw)]]}),'same-job/ack-blob.original.json':E({'sha':blob,'size':len(ack_raw),'encoding':'base64','content':base64.b64encode(ack_raw).decode()}),'same-job/input-install.json':E(ack['request']),'same-job/inventory.original.json':E(value),'same-job/template.original.json':template,'same-job/dispatch-pr.original.json':files['dispatch-pr.original.json'],'same-job/runtime-after-ack.json':files['runtime.before.json']})
        files['same-job/ack-ref-after.original.json']=files['same-job/ack-ref.original.json']
        phase_files,phase_expected=self.reader_phase_v9_packet();deadline=D(phase_files['gui-actual-v9/deadline.json']);deadline.update(runId=200,jobId=jobid);files['same-job/deadline.json']=E(deadline);files['same-job/dispatch-clock.original.json']=E(deadline['clock'])
        files['same-job/entry-budget.json']=E({'schema':'bw.gui-hdd.actual-v9-entry-budget.v1','observedMonotonicNs':12000000000,'deadlineMonotonicNs':deadline['deadlineMonotonicNs'],'remainingNs':deadline['deadlineMonotonicNs']-12000000000,'requiredNs':1490000000000})
        files['runtime.entry.json']=files['runtime.before.json']
        core=D(files['runtime.before.json']);core['schema']='bw.gui-hdd.runtime-observation.v4';core.pop('nativeFontDirectories')
        stage,_=r.native_font_layout(request['nativeFontAdmission'])
        for path in (request['nativeFontAdmission']['font']['path'],request['nativeFontAdmission']['font']['licensePath'],str(stage/'fontconfig.xml')):
            core['files'].pop(path);core['identities'].pop(path)
        files['same-job/core-runtime-after-ack.json']=E(core)
        for i,scenario in enumerate(r.SCENARIOS):
            process=D(files[scenario+'.process.json']);process.update(startedNs=20000000000+i*10000000000,endedNs=21000000000+i*10000000000);files[scenario+'.process.json']=E(process)
        expected.update(ackCommit=commit,ackBlob=blob,ackSha256=H(ack_raw))
        with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
            output=c.V8Originals(pathlib.Path(temporary)/'git-envelopes')
            indices=sorted(int(name.removeprefix('git-').removesuffix('.stdout'))for name in files if name.startswith('git-') and name.endswith('.stdout'))
            for i in indices:
                for suffix in c.V8Originals.MEMBER_ORDER:output.save('git-'+str(i)+'.'+suffix,files.pop('git-'+str(i)+'.'+suffix))
            files.update({path.name:path.read_bytes()for path in output.root.iterdir()})
        return files,expected

    def test_reader_v9_complete_terminal_packet_and_coherently_rehashed_negatives(self):
        files,expected=self.reader_final_v9_packet()
        self.assertTrue(r.audit_v9(files,expected)['pass'])
        archived=copy.deepcopy(files);archived['inventory.json']=E({'schema':'bw.gui-hdd.originals.v1','files':{name:ROW(raw)for name,raw in archived.items()}});archive=zip_({'originals/'+name:raw for name,raw in archived.items()})
        selected=copy.deepcopy(expected);selected.update(artifactBytes=len(archive),artifactSha256=H(archive));selected['artifact'].update(size_in_bytes=len(archive),digest='sha256:'+H(archive))
        self.assertTrue(r.audit_v9(r.archive_originals_v9(archive),selected)['pass'])
        for cut in ('not-terminal','failed-job','foreign-artifact','post-ack-drift','budget','guest-proof','cleanup','core-omission','core-resolver-drift','missing-staging'):
            f=copy.deepcopy(files);e=copy.deepcopy(expected)
            if cut=='not-terminal':e['run'].update(status='in_progress',conclusion=None)
            elif cut=='failed-job':e['job']['conclusion']='failure'
            elif cut=='foreign-artifact':e['artifact']['workflow_run']['id']=999
            elif cut=='post-ack-drift':v=D(f['same-job/runtime-after-ack.json']);v['files']['/etc/unselected']=ROW(b'changed');f['same-job/runtime-after-ack.json']=E(v)
            elif cut=='budget':v=D(f['same-job/entry-budget.json']);v['remainingNs']=1;f['same-job/entry-budget.json']=E(v)
            elif cut=='guest-proof':v=D(f['forward-debug/proof.json']);v['boardPin']='0'*40;f['forward-debug/proof.json']=E(v)
            elif cut=='core-omission':v=D(f['same-job/core-runtime-after-ack.json']);v['files'].pop('/run/systemd/resolve/stub-resolv.conf');f['same-job/core-runtime-after-ack.json']=E(v)
            elif cut=='core-resolver-drift':v=D(f['same-job/core-runtime-after-ack.json']);v['aliases']['/etc/resolv.conf']['linkText']='changed';f['same-job/core-runtime-after-ack.json']=E(v)
            elif cut=='missing-staging':v=D(f['same-job/runtime-after-ack.json']);path=D(f['request.original.json'])['nativeFontAdmission']['font']['path'];v['files'].pop(path);f['same-job/runtime-after-ack.json']=E(v)
            else:v=D(f['forward-debug.process.json']);v['remainingDescendants']=[{'pid':999}];f['forward-debug.process.json']=E(v)
            with self.subTest(cut=cut),self.assertRaises((ValueError,KeyError)):r.audit_v9(f,e)
        for target in ('selected','retained'):
            for field,value in (('head_sha',None),('head_sha',True),('head_sha','0'*40),('run_attempt',None),('run_attempt',True),('run_attempt',2)):
                f=copy.deepcopy(files);e=copy.deepcopy(expected)
                job=e['job'] if target=='selected' else D(f['same-job/dispatch-job.original.json'])
                if value is None:job.pop(field)
                else:job[field]=value
                if target=='retained':f['same-job/dispatch-job.original.json']=E(job)
                if 'inventory.json' in f:
                    manifest=D(f['inventory.json'])
                    for name in manifest['files']:manifest['files'][name]=ROW(f[name])
                    f['inventory.json']=E(manifest)
                with self.subTest(target=target,field=field,value=value),self.assertRaises(ValueError):r.audit_v9(f,e)


    def reader_v9_parts_write(self,base,selected):
        parts=base/'parts';parts.mkdir(exist_ok=True);roles={}
        small={key:copy.deepcopy(value)for key,value in selected.items()if key not in ('inventoryOriginal','inventoryTemplate','nativeFontOriginals')}
        for role,name in r.ACTUAL_V6_PART_FILES.items():
            item=selected['nativeFontOriginals'][role.split('.',1)[1]]if role.startswith('nativeFontOriginals.')else selected[role]
            raw=base64.b64decode(item['base64'],validate=True);(parts/name).write_bytes(raw);roles[role]=ROW(raw)
        manifest={'schema':'bw.gui-hdd.actual-v9-parts-manifest.v1','expected':small,'parts':roles}
        path=base/'manifest.json';path.write_bytes(E(manifest));return path,parts,manifest

    def test_actual_v9_parts_large_raw_transport_fits_without_expanded_json_cap_raise(self):
        _,selected=self.reader_final_v9_packet()
        # A manufactured transport payload, not an admitted inventory/guest result.
        raw=E({'manufacturedTransportPadding':'x'*3200000});selected['inventoryOriginal']=dict(ROW(raw),base64=base64.b64encode(raw).decode())
        with tempfile.TemporaryDirectory(dir=root.parent)as temporary:
            path,parts,manifest=self.reader_v9_parts_write(pathlib.Path(temporary),selected)
            self.assertGreater(len(E(selected)),r.JSON_CAP)
            self.assertLessEqual(len(E(manifest))+sum(row['byteLength']for row in manifest['parts'].values()),r.JSON_CAP)
            self.assertEqual(r.actual_v9_parts_expected(path,parts),selected)
            for cut in ('aggregate','role-cap','manifest-cap','v8-schema','extra-key','missing-ack','duplicate-key'):
                changed=copy.deepcopy(manifest)
                if cut=='aggregate':changed['parts']['inventoryOriginal']['byteLength']=r.JSON_CAP
                elif cut=='role-cap':changed['parts']['inventoryOriginal']['byteLength']=r.JSON_CAP+1
                elif cut=='manifest-cap':changed['expected']['extra']='x'*65536
                elif cut=='v8-schema':changed['schema']='bw.gui-hdd.actual-v8-parts-manifest.v1'
                elif cut=='extra-key':changed['extra']=True
                elif cut=='missing-ack':changed['expected'].pop('ackCommit')
                encoded=E(changed)
                if cut=='duplicate-key':encoded=encoded.replace(b'{',b'{"schema":"duplicate",',1)
                path.write_bytes(encoded)
                with self.subTest(cut=cut),self.assertRaises(ValueError):r.actual_v9_parts_expected(path,parts)

    def test_actual_v9_parts_complete_final_reader_and_cli_parity(self):
        files,expected=self.reader_final_v9_packet();archived=copy.deepcopy(files)
        archived['inventory.json']=E({'schema':'bw.gui-hdd.originals.v1','files':{name:ROW(raw)for name,raw in archived.items()}})
        artifact=zip_({'originals/'+name:raw for name,raw in archived.items()})
        selected=copy.deepcopy(expected);selected.update(artifactBytes=len(artifact),artifactSha256=H(artifact));selected['artifact'].update(size_in_bytes=len(artifact),digest='sha256:'+H(artifact))
        direct=r.audit_v9(r.archive_originals_v9(artifact),selected)
        with tempfile.TemporaryDirectory(dir=root.parent)as temporary:
            base=pathlib.Path(temporary);path,parts,_=self.reader_v9_parts_write(base,selected);artifact_path=base/'artifact.zip';artifact_path.write_bytes(artifact)
            self.assertEqual(r.actual_v9_parts_expected(path,parts),selected)
            with patch.object(r,'ACTUAL_V9_READER_ENABLED',True),patch.object(r.sys,'stdout',io.StringIO())as output:
                self.assertEqual(r.main(['--actual-v9-parts','--manifest',str(path),'--parts',str(parts),'--artifact',str(artifact_path)]),0)
                self.assertEqual(D(output.getvalue().encode()),direct)
            with patch.object(r,'ACTUAL_V9_READER_ENABLED',True),self.assertRaisesRegex(ValueError,'exact seven-token'):
                r.main(['--actual-v9-parts','--parts',str(parts),'--manifest',str(path),'--artifact',str(artifact_path)])

    def test_actual_v9_parts_closed_files_aliases_swaps_and_read_close_failures(self):
        _,selected=self.reader_final_v9_packet()
        for cut in ('extra','missing','symlink-file','hardlink','symlink-directory','swap','hash','manifest-alias','read-close'):
            with self.subTest(cut=cut),tempfile.TemporaryDirectory(dir=root.parent)as temporary:
                base=pathlib.Path(temporary);path,parts,manifest=self.reader_v9_parts_write(base,selected)
                name=parts/'native-event.json'
                if cut=='extra':(parts/'extra.json').write_bytes(b'{}')
                elif cut=='missing':name.unlink()
                elif cut=='symlink-file':saved=base/'saved';name.rename(saved);name.symlink_to(saved)
                elif cut=='hardlink':r.os.link(name,base/'second-link')
                elif cut=='symlink-directory':alias=base/'alias';alias.symlink_to(parts,target_is_directory=True);parts=alias
                elif cut=='swap':other=parts/'native-request.json';a=name.read_bytes();b=other.read_bytes();name.write_bytes(b);other.write_bytes(a)
                elif cut=='hash':raw=name.read_bytes();name.write_bytes(b'X'+raw[1:])
                elif cut=='manifest-alias':alias=base/'alias.json';alias.symlink_to(path);path=alias
                if cut=='read-close':
                    close=r.os.close
                    def close_fail(fd):close(fd);raise OSError('manufactured close secondary')
                    with patch.object(r.os,'read',side_effect=OSError('manufactured primary read')),patch.object(r.os,'close',side_effect=close_fail),self.assertRaises(r.ActualV6PartsFailure)as caught:r.actual_v9_parts_expected(path,parts)
                    self.assertIn('primary read',caught.exception.firstFailure['message']);self.assertEqual(caught.exception.secondary[0]['phase'],'manifest-close')
                else:
                    with self.assertRaises(r.ActualV6PartsFailure):r.actual_v9_parts_expected(path,parts)

    def test_actual_v9_parts_disabled_before_any_input_and_closed_selected_roles(self):
        with patch.object(r,'ACTUAL_V9_READER_ENABLED',False),patch.object(r,'actual_v9_parts_expected',side_effect=AssertionError('parts read')),patch.object(r,'bounded_input',side_effect=AssertionError('artifact read')),self.assertRaises(ValueError):
            r.main(['--actual-v9-parts','--manifest','unread','--parts','unread','--artifact','unread'])
        _,selected=self.reader_final_v9_packet()
        for cut in ('extra-role','missing-role','wrong-expectation','missing-ack-blob','missing-ack-sha'):
            with tempfile.TemporaryDirectory(dir=root.parent)as temporary:
                path,parts,manifest=self.reader_v9_parts_write(pathlib.Path(temporary),selected)
                if cut=='extra-role':manifest['parts']['unknown']=ROW(b'{}')
                elif cut=='missing-role':manifest['parts'].pop('nativeFontOriginals.event')
                elif cut=='wrong-expectation':manifest['expected']['schema']='bw.gui-hdd.actual-expectation.v8'
                else:manifest['expected'].pop('ackBlob'if cut=='missing-ack-blob'else'ackSha256')
                path.write_bytes(E(manifest))
                with self.subTest(cut=cut),self.assertRaises(ValueError):r.actual_v9_parts_expected(path,parts)

    def test_reader_v9_clock_checkout_cost_and_roundtrip_bound(self):
        phase,e=self.reader_phase_v9_packet();deadline=D(phase['gui-actual-v9/deadline.json']);self.assertEqual(r.actual_v9_deadline(E(deadline),{'runId':90,'jobId':91},deadline['sourceHead']),deadline)
        for cut in ('ignore-checkout','clock-rollback','date-parse','date-seconds','elapsed','boolean','reserve'):
            changed=copy.deepcopy(deadline)
            if cut=='ignore-checkout':changed['startedMonotonicNs']=changed['clock']['responseMonotonicNs'];changed['deadlineMonotonicNs']=changed['startedMonotonicNs']+2100000000000
            elif cut=='clock-rollback':changed['clock']['requestMonotonicNs']=changed['clock']['responseMonotonicNs']+1
            elif cut=='date-parse':changed['clock']['httpDate']='Wed, 28 Oct 2026 00:00:01 +0000'
            elif cut=='date-seconds':changed['clock']['serverDateSeconds']+=1
            elif cut=='elapsed':changed['clock']['elapsedUpperNs']-=1
            elif cut=='boolean':changed['clock']['responseMonotonicNs']=True
            else:changed['cleanupReserveSeconds']=1
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.actual_v9_deadline(E(changed),{'runId':90,'jobId':91},changed['sourceHead'])

        # Recompute every derived clock/deadline fact: only the reviewed bounds refuse.
        for cut in ('31-second-roundtrip','2101-second-job-age'):
            changed=copy.deepcopy(deadline);clock=changed['clock']
            clock.update(requestMonotonicNs=10000000000000,responseMonotonicNs=10001000000000)
            if cut=='31-second-roundtrip':clock['responseMonotonicNs']=clock['requestMonotonicNs']+31000000000
            else:clock.update(httpDate='Wed, 28 Oct 2026 00:35:01 GMT',serverDateSeconds=clock['jobStartedSeconds']+2101)
            clock['elapsedUpperNs']=(clock['serverDateSeconds']+1-clock['jobStartedSeconds'])*1000000000+clock['responseMonotonicNs']-clock['requestMonotonicNs']
            changed['startedMonotonicNs']=clock['responseMonotonicNs']-clock['elapsedUpperNs'];changed['deadlineMonotonicNs']=changed['startedMonotonicNs']+2100000000000
            with self.subTest(cut=cut),self.assertRaisesRegex(ValueError,'bounded official job age and metadata interval'):
                r.actual_v9_deadline(E(changed),{'runId':90,'jobId':91},changed['sourceHead'])

    def test_reader_v9_and_f10_default_disabled_before_any_input_read(self):
        for mode in ('--actual-v9-phase','--actual-v9','--inventory-original-v10','--inventory-failure-v10'):
            args=[mode,'--artifact','unread','--expected','unread']if mode.startswith('--actual')else[mode,'--original','unread','--template','unread','--expected','unread']
            with self.subTest(mode=mode),patch.object(r,'ACTUAL_V9_READER_ENABLED',False),patch.object(r,'FINITE_INVENTORY_V10_READER_ENABLED',False),patch.object(r,'bounded_input',side_effect=AssertionError('input read before disabled guard')),self.assertRaises(ValueError):r.main(args)

    def test_producer_actual_v9_armed_cli_routes_preserve_startup_and_request_boundaries(self):
        self.assertTrue(c.ACTUAL_V9_ENABLED);self.assertTrue(c.FINITE_INVENTORY_V10_ENABLED)
        for mode,edge in (('actual-v9-guard','actual_v9_guard'),('actual-v9-prelude','actual_v9_recheck_prelude'),('actual-v9-ack','actual_v9_wait_ack')):
            sequence=[]
            def startup(*args):sequence.append(('startup',args[1],args[2]))
            def admitted(*args):sequence.append(('admission',mode));return {'schema':'manufactured-control-result','guestApproved':False}
            with self.subTest(mode=mode),patch.object(c,'observe_python_startup',side_effect=startup)as observed,patch.object(c,edge,side_effect=admitted)as reached,patch.object(c.sys,'stdout',io.StringIO())as output:
                self.assertEqual(c.main([mode]),0);self.assertEqual(D(output.getvalue().encode())['guestApproved'],False)
                self.assertEqual(sequence,[('startup',mode,[]),('admission',mode)]);reached.assert_called_once()
                sequence.clear()
                with self.assertRaisesRegex(ValueError,'closed no-argument'):c.main([mode,'--output','unselected'])
                self.assertEqual(sequence,[])
        files,_=self.reader_final_v9_packet();raw=files['request.original.json'];pin=H(raw)
        for mode in ('actual-v9-preflight','actual-v9'):
            with self.subTest(mode=mode),patch.object(c,'regular',return_value=raw)as read,patch.object(c,'execute',return_value={'manufactured':True,'guestApproved':False})as execute:
                result=c.main([mode,'--request','selected-request','--expected-sha256',pin,'--output','selected-output'])
                self.assertFalse(result['guestApproved']);read.assert_called_once_with('selected-request',c.JSON_CAP)
                self.assertEqual(execute.call_args.args[:2],(raw,pin));self.assertEqual(execute.call_args.kwargs,{'preflight':mode=='actual-v9-preflight','startup_mode':mode})
        _,template,_,_=self.reader_finite_v10_packet();template_pin=H(template)
        with patch.dict(c.os.environ,{'BW_FINITE_INVENTORY_V10_SHA256':template_pin}),patch.object(c,'actual_v9_read_state',return_value=({},{})),patch.object(c,'regular',return_value=template),patch.object(c,'actual_v9_template_from_env',return_value=template),patch.object(c,'inventory_observation',return_value={'manufactured':True,'guestApproved':False})as collect,patch.object(c,'retain_inventory_observation',side_effect=lambda value,path:value):
            self.assertFalse(c.main(['finite-inventory-v10','--request','selected-template','--expected-sha256',template_pin,'--output','selected-output'])['guestApproved'])
            collect.assert_called_once();self.assertEqual(collect.call_args.args[:2],(template,template_pin));collect.reset_mock()
            with self.assertRaisesRegex(ValueError,'same admitted finite10 template'):c.main(['finite-inventory-v10','--request','selected-template','--expected-sha256','0'*64,'--output','selected-output'])
            collect.assert_not_called()
        with patch.object(c,'FINITE_INVENTORY_V10_ENABLED',False),patch.object(c,'regular',side_effect=AssertionError('request read with coupled gate false')):
            with self.assertRaisesRegex(ValueError,'disabled'):c.main(['actual-v9'])

    def test_reader_actual_v9_armed_cli_complete_phase_and_final_parity(self):
        self.assertTrue(r.ACTUAL_V9_READER_ENABLED);self.assertTrue(r.FINITE_INVENTORY_V10_READER_ENABLED)
        phase_files,phase_expected=self.reader_phase_v9_packet();phase_raw=zip_(phase_files)
        phase_expected.update(artifactBytes=len(phase_raw),artifactSha256=H(phase_raw));phase_expected['artifact'].update(size_in_bytes=len(phase_raw),digest='sha256:'+H(phase_raw))
        final_files,final_expected=self.reader_final_v9_packet();archived=copy.deepcopy(final_files)
        archived['inventory.json']=E({'schema':'bw.gui-hdd.originals.v1','files':{name:ROW(raw)for name,raw in archived.items()}})
        final_raw=zip_({'originals/'+name:raw for name,raw in archived.items()})
        final_expected.update(artifactBytes=len(final_raw),artifactSha256=H(final_raw));final_expected['artifact'].update(size_in_bytes=len(final_raw),digest='sha256:'+H(final_raw))
        for mode,artifact,expected in (('--actual-v9-phase',phase_raw,phase_expected),('--actual-v9',final_raw,final_expected)):
            selected={'selected-expected':E(expected),'selected-artifact':artifact};reads=[]
            def bounded(path,cap):
                self.assertIn(str(path),selected);raw=selected[str(path)];self.assertLessEqual(len(raw),cap);reads.append(str(path));return raw
            with self.subTest(mode=mode),patch.object(r,'bounded_input',side_effect=bounded),patch.object(r.sys,'stdout',io.StringIO())as output:
                self.assertEqual(r.main([mode,'--artifact','selected-artifact','--expected','selected-expected']),0)
                report=D(output.getvalue().encode());self.assertFalse(report['guestApproved']if mode=='--actual-v9-phase'else report.get('executionApproved',False))
                self.assertEqual(reads,['selected-expected','selected-artifact'])
                if mode=='--actual-v9-phase':self.assertTrue(report['phaseAdmitted']);self.assertFalse(report['jobSuccessProved'])
                else:self.assertEqual(report,r.audit_v9(r.archive_originals_v9(artifact),expected))

        for symlink in (False,True):
            value,template,expected,_=self.reader_finite_v10_packet(symlink);selected={'selected-original':E(value),'selected-template':template,'selected-expected':E(expected)}
            def bounded(path,cap):
                self.assertIn(str(path),selected);raw=selected[str(path)];self.assertLessEqual(len(raw),cap);return raw
            with self.subTest(resolverSymlink=symlink),patch.object(r,'bounded_input',side_effect=bounded),patch.object(r.sys,'stdout',io.StringIO())as output:
                self.assertEqual(r.main(['--inventory-original-v10','--original','selected-original','--template','selected-template','--expected','selected-expected']),0)
                self.assertEqual(D(output.getvalue().encode()),r.verify_inventory_original_v10(E(value),template,expected))

    def test_producer_actual_v9_full_parse_join_and_coherent_phase_cuts(self):
        files,expected=self.reader_final_v9_packet();raw=files['request.original.json'];request=c.parse_request(raw,H(raw))
        prelude=D(files['same-job/prelude.original.json']);ack=D(files['same-job/ack.original.json']);deadline=D(files['same-job/deadline.json'])
        inventory=files['same-job/inventory.original.json'];template=files['same-job/template.original.json']
        c.actual_v9_join_request(request,ack,prelude,deadline,inventory,template)
        for cut in ('old-pins','wrong-job','different-inventory','changed-resolver','missing-alias','wrong-build','added-runtime-file'):
            changed=copy.deepcopy(request)
            if cut=='old-pins':changed['dependencyPins']=copy.deepcopy(c.FINITE_V9_PINS)
            elif cut=='wrong-job':changed['sameJob']['jobId']+=1
            elif cut=='different-inventory':changed['sameJob']['inventorySha256']='0'*64
            elif cut=='changed-resolver':changed['runtime']['files']['/etc/resolv.conf']=ROW(b'changed')
            elif cut=='missing-alias':changed['runtime']['aliases'].pop(next(iter(changed['runtime']['aliases'])))
            elif cut=='wrong-build':changed['build']['jobId']+=1
            else:changed['runtime']['files']['/etc/unselected-host-config']=ROW(b'extra')
            with self.subTest(cut=cut),self.assertRaises(ValueError):
                parsed=c.parse_request(E(changed),H(E(changed)))
                c.actual_v9_join_request(parsed,ack,prelude,deadline,inventory,template)

    def test_producer_actual_v9_execute_preserves_samejob_and_primary_branch_failure(self):
        files,expected=self.reader_final_v9_packet()
        job=D(files['same-job/dispatch-job.original.json']);job['run_attempt']=1;files['same-job/dispatch-job.original.json']=E(job)
        request=D(files['request.original.json']);pin=H(files['request.original.json'])
        env=dict(request['inventoryAdmission']['metadataAdmission']['repositoryVariables'])
        env.update({key:value for key,value in D(files['result.json'])['dispatchPlatform'].items() if key!='schema'})
        env['GITHUB_EVENT_PATH']='/mock/event.json'
        class Memory:
            def __init__(self,path):self.root=pathlib.Path(path);self.raw={};self.files={};self.total=0;instances.append(self)
            def save(self,name,raw):
                if name in self.raw:raise AssertionError('duplicate original')
                self.raw[name]=raw;self.files[name]=ROW(raw);self.total+=len(raw)
            def seal(self,result):self.save('result.json',E(result))
        def startup(where,mode,args):
            observed=D(files['python-startup.before.json']);observed['arguments']=['scripts/run-i80386-hdd-gui-actual.py',mode]+args
            c.validate_startup(observed,c.startup_installation(files['python-startup.original.txt']),mode,args)
            return files['python-startup.original.txt'],observed
        def raw(path,cap):
            text=str(path)
            if text=='/mock/event.json':return files['event.original.json']
            if text=='/checkout/gui-inputs/request.json':return files['request.original.json']
            if text.startswith('/checkout/gui-actual-v9/'):return files['same-job/'+text.removeprefix('/checkout/gui-actual-v9/')]
            raise AssertionError('unexpected read '+text)
        def selected_file(path,row):
            name=str(path).removeprefix('/checkout/')
            return E(c.FINITE_V10_PINS) if name=='vendor-pins.json' else ('source:'+name).encode()
        for cut in ('pr-head','branch-head'):
            instances=[];calls=[];pr=D(files['dispatch-pr.original.json']);branch=D(files['dispatch-branch.original.json'])
            if cut=='pr-head':pr['head']['sha']='0'*40
            else:branch['object']['sha']='0'*40
            class Fake:
                def __init__(self,where,output,environment):self.output=output;self.index=0;self.deadline=1800
                def git(self,args):
                    self.index+=1
                    if args[0]=='rev-parse':return (request['source']['head' if args[1]=='HEAD' else 'tree']+'\n').encode()
                    return selected_file('/checkout/'+args[2].split(':',1)[1],{})
                def api(self,route):
                    calls.append(route)
                    return E(pr) if route.startswith('/pulls/') else E(branch)
                def run(self,*args):raise AssertionError('guest/build edge before PR and branch admission')
            with patch.object(c,'V8Originals',Memory),patch.object(c,'regular',side_effect=raw),patch.object(c,'regular_empty',side_effect=raw),patch.object(c,'check_file',side_effect=selected_file),patch.object(c,'observe_python_startup',side_effect=startup),patch.object(c,'observe_runtime',return_value=D(files['runtime.before.json'])),patch.object(c.time,'monotonic_ns',return_value=12000000000),patch.object(c.time,'monotonic',return_value=12):
                result=c.execute(files['request.original.json'],pin,pathlib.Path('/checkout'),pathlib.Path('/checkout/owned-originals'),env,factory=Fake,startup_mode='actual-v9')
            self.assertEqual(result,1);retained=instances[0].raw;failure=D(retained['result.json'])['firstFailure']
            self.assertTrue('same-job/ack.original.json' in retained,failure);self.assertTrue('event.original.json' in retained,failure)
            self.assertIn('PR marker/head' if cut=='pr-head' else 'source branch',failure['message'])
            self.assertEqual(len(calls),1 if cut=='pr-head' else 2)
            self.assertEqual(D(retained['result.json'])['secondary'],[])
        base_job=D(files['same-job/dispatch-job.original.json']);guard_env=dict(env,GITHUB_WORKSPACE='/checkout')
        class MetadataReached(Exception):pass
        class GuardFake:
            def __init__(self,where,output,environment):
                self.deadline=1800
                clock=D(files['same-job/dispatch-clock.original.json'])
                self.metadata_clocks={'/actions/runs/'+env['GITHUB_RUN_ID']+'/attempts/1/jobs':{key:clock[key]for key in ('httpDate','requestMonotonicNs','responseMonotonicNs','requestWallTimeNs','responseWallTimeNs')}}
            def api(self,route):return E({'total_count':1,'jobs':[copy.deepcopy(current_job)]})
        for field,value in ((None,None),('head_sha',None),('head_sha',True),('head_sha','0'*40),('run_attempt',None),('run_attempt',True),('run_attempt',2)):
            current_job=copy.deepcopy(base_job)
            if field is not None:
                if value is None:current_job.pop(field)
                else:current_job[field]=value
            instances=[]
            with patch.object(c,'ACTUAL_V9_ENABLED',True),patch.object(c,'FINITE_INVENTORY_V10_ENABLED',True),patch.object(c,'Originals',Memory),patch.object(c,'regular',return_value=files['event.original.json']),patch.object(c.Path,'resolve',lambda path,strict=False:path),patch.object(c.Path,'exists',return_value=True),patch.object(c.Path,'lstat',return_value=SimpleNamespace(st_mode=stat.S_IFDIR|0o700)),patch.object(c,'exclusive_stage_write'),patch.object(c,'admit_finite_v10_before_setup',side_effect=MetadataReached('typed metadata admitted')) as next_edge,patch.object(c.time,'monotonic_ns',return_value=12000000000),patch.object(c.time,'monotonic',return_value=12):
                if field is None:
                    with self.assertRaises(MetadataReached):c.actual_v9_guard(pathlib.Path('/checkout'),guard_env,factory=GuardFake)
                    self.assertEqual(next_edge.call_count,1)
                else:
                    with self.subTest(field=field,value=value),self.assertRaises(ValueError):c.actual_v9_guard(pathlib.Path('/checkout'),guard_env,factory=GuardFake)
                    next_edge.assert_not_called()
            if field is not None:
                def state_raw(path,cap):
                    if str(path)=='/checkout/gui-actual-v9/dispatch-job.original.json':return E(current_job)
                    return raw(path,cap)
                with patch.object(c,'regular',side_effect=state_raw),patch.object(c.time,'monotonic_ns',return_value=12000000000):
                    with self.assertRaises(ValueError):c.actual_v9_read_state(pathlib.Path('/checkout'),env)


    def test_producer_actual_v9_ack_positive_exact_install_reobserve_and_replay_refusal(self):
        files,expected=self.reader_final_v9_packet();request=D(files['request.original.json']);ack=D(files['same-job/ack.original.json'])
        job=D(files['same-job/dispatch-job.original.json']);job['run_attempt']=1;files['same-job/dispatch-job.original.json']=E(job)
        env=dict(request['inventoryAdmission']['metadataAdmission']['repositoryVariables'])
        env.update({key:value for key,value in D(files['result.json'])['dispatchPlatform'].items() if key!='schema'})
        writes={};instances=[];calls=[];installs=[]
        class Memory:
            def __init__(self,path):self.root=pathlib.Path(path);self.raw={};instances.append(self)
            def save(self,name,raw):
                if name in self.raw:raise AssertionError('duplicate ACK original')
                self.raw[name]=raw
            def seal(self,result):self.save('result.json',E(result))
        class Fake:
            def __init__(self,where,output,environment):self.deadline=1800
            def api(self,route):
                calls.append(route)
                if route.startswith('/git/ref/'):return files['same-job/ack-ref.original.json']
                if route.startswith('/git/commits/'):return files['same-job/ack-commit.original.json']
                if route.startswith('/git/trees/'):return files['same-job/ack-tree.original.json']
                if route.startswith('/git/blobs/'):return files['same-job/ack-blob.original.json']
                if route.startswith('/pulls/'):return files['dispatch-pr.original.json']
                raise AssertionError('unselected metadata route')
        def raw(path,cap):
            text=str(path)
            if text in writes:return writes[text]
            if text=='/checkout/gui-finite-inventory-v10/inventory.json':return files['same-job/inventory.original.json']
            if text.startswith('/checkout/gui-actual-v9/'):return files['same-job/'+text.removeprefix('/checkout/gui-actual-v9/')]
            raise AssertionError('unselected local original')
        def install(blob,digest,target,environment,deadline=None):
            self.assertEqual((blob,digest),(ack['request']['gitBlob'],ack['request']['sha256']))
            self.assertLessEqual(deadline,192);installs.append((blob,digest))
            if str(target) in writes:raise FileExistsError('exclusive input')
            writes[str(target)]=files['request.original.json'];return dict(ack['request'])
        def keep(path,raw):
            if str(path) in writes:raise FileExistsError('exclusive state')
            writes[str(path)]=raw
        def observe(initial):
            core=D(files['same-job/core-runtime-after-ack.json'])
            self.assertEqual(initial['schema'],'bw.gui-hdd.actual-request.v4')
            self.assertEqual(initial['runtime']['files'],core['files'])
            return core
        with patch.object(c,'ACTUAL_V9_ENABLED',True),patch.object(c,'FINITE_INVENTORY_V10_ENABLED',True),patch.object(c,'Originals',Memory),patch.object(c,'regular',side_effect=raw),patch.object(c.Path,'exists',lambda path:str(path) in writes),patch.object(c,'install_input',side_effect=install),patch.object(c,'exclusive_stage_write',side_effect=keep),patch.object(c,'observe_runtime',side_effect=observe) as observed,patch.object(c.time,'monotonic_ns',return_value=12000000000),patch.object(c.time,'monotonic',return_value=12):
            installed=c.actual_v9_wait_ack(pathlib.Path('/checkout'),env,factory=Fake,sleep=lambda _:self.fail('ACK available on first poll'))
            self.assertEqual(installed,ack['request']);self.assertEqual(len(installs),1);self.assertEqual(observed.call_count,1)
            self.assertEqual(D(writes['/checkout/gui-actual-v9/core-runtime-after-ack.json'])['files'],D(files['same-job/core-runtime-after-ack.json'])['files'])
            before=len(calls)
            with self.assertRaisesRegex(ValueError,'exclusive ACK/request'):c.actual_v9_wait_ack(pathlib.Path('/checkout'),env,factory=Fake)
            self.assertEqual(len(calls),before);self.assertEqual(len(installs),1)
        self.assertTrue(D(instances[0].raw['result.json'])['pass'])
        retained=dict(files)
        for name,raw in writes.items():
            if name.startswith('/checkout/gui-actual-v9/'):retained['same-job/'+name.removeprefix('/checkout/gui-actual-v9/')]=raw
        r.verify_actual_v9_ack(retained,request,expected)
        r.verify_actual_v9_core_runtime(retained,request,D(files['same-job/inventory.original.json']))
        c.actual_v9_verify_core(D(retained['same-job/core-runtime-after-ack.json']),D(files['runtime.before.json']),request)


    def test_producer_actual_v9_core_and_native_staging_exact_negatives(self):
        files,_expected=self.reader_final_v9_packet();request=D(files['request.original.json']);core=D(files['same-job/core-runtime-after-ack.json']);full=D(files['runtime.before.json'])
        c.actual_v9_verify_core(core,full,request)
        for cut in ('omitted-core','changed-resolver','missing-staged-font','changed-staged-notice','extra-core','new-alias'):
            a=copy.deepcopy(core);b=copy.deepcopy(full)
            if cut=='omitted-core':a['files'].pop(next(iter(a['files'])))
            elif cut=='changed-resolver':a['aliases']['/etc/resolv.conf']['linkText']='unselected'
            elif cut=='missing-staged-font':b['files'].pop(request['nativeFontAdmission']['font']['path'])
            elif cut=='changed-staged-notice':b['files'][request['nativeFontAdmission']['font']['licensePath']]=ROW(b'changed')
            elif cut=='extra-core':a['files']['/etc/unselected']=ROW(b'extra')
            else:a['aliases']['/etc/unselected']={'linkText':'/node','target':'/node'}
            with self.subTest(cut=cut),self.assertRaises(ValueError):c.actual_v9_verify_core(a,b,request)


    def test_producer_actual_v9_external_wait_expires_without_install_or_guest(self):
        files,_expected=self.reader_final_v9_packet();request=D(files['request.original.json'])
        job=D(files['same-job/dispatch-job.original.json']);job['run_attempt']=1;files['same-job/dispatch-job.original.json']=E(job)
        env=dict(request['inventoryAdmission']['metadataAdmission']['repositoryVariables']);env.update({key:value for key,value in D(files['result.json'])['dispatchPlatform'].items() if key!='schema'})
        clock=[12];calls=[];sealed=[]
        class Memory:
            def __init__(self,path):self.root=pathlib.Path(path)
            def save(self,*args):pass
            def seal(self,result):sealed.append(copy.deepcopy(result))
        class Missing:
            def __init__(self,*args):self.deadline=1800
            def api(self,route):
                calls.append(route);raise c.urllib.error.HTTPError('https://api.github.com/owned-ACK',404,'absent',None,None)
        def raw(path,cap):
            text=str(path)
            if text=='/checkout/gui-finite-inventory-v10/inventory.json':return files['same-job/inventory.original.json']
            if text.startswith('/checkout/gui-actual-v9/'):return files['same-job/'+text.removeprefix('/checkout/gui-actual-v9/')]
            raise AssertionError('unselected original')
        def sleep(seconds):clock[0]+=seconds
        with patch.object(c,'ACTUAL_V9_ENABLED',True),patch.object(c,'FINITE_INVENTORY_V10_ENABLED',True),patch.object(c,'Originals',Memory),patch.object(c,'regular',side_effect=raw),patch.object(c.Path,'exists',return_value=False),patch.object(c,'install_input') as install,patch.object(c,'observe_runtime') as observe,patch.object(c.time,'monotonic',side_effect=lambda:clock[0]),patch.object(c.time,'monotonic_ns',side_effect=lambda:int(clock[0]*10**9)):
            with self.assertRaisesRegex(ValueError,'admission deadline expired'):
                c.actual_v9_wait_ack(pathlib.Path('/checkout'),env,factory=Missing,sleep=sleep)
            install.assert_not_called();observe.assert_not_called()
        self.assertEqual(clock[0],192);self.assertLessEqual(len(calls),37);self.assertEqual(len(set(calls)),1)
        self.assertEqual(len(sealed),1);self.assertFalse(sealed[0]['pass']);self.assertFalse(sealed[0]['guestApproved'])
        self.assertIn('admission deadline expired',sealed[0]['firstFailure']['message'])


class NativeV2Originals(unittest.TestCase):
    def fresh(self):
        files,expected=fixture_v5();request=D(files['request.original.json']);ref=request['nativeFontAdmission']
        originals={k:base64.b64decode(v['base64']) for k,v in expected['nativeFontOriginals'].items()}
        ref.update(schema='bw.gui-hdd.actual-native-font-reference.v2',artifactName='i80386-native-font-selection-v2-300-1')
        native=D(originals['request']);native['schema']='bw.gui-hdd.native-font-request.v2';originals['request']=E(native).rstrip(b'\n')
        event=D(originals['event']);event['label']['name']='x86-native-font-selection-v2'
        event['pull_request']['body']='<!-- BW_NATIVE_FONT_V2_REQUEST_SHA256='+H(originals['request'])+' -->'
        originals['event']=json.dumps(event,indent=2).encode()+b'\n'
        identity={'uid':1001,'gid':1002,'resuid':[1001]*3,'resgid':[1002]*3}
        unit='bw-native-font-v2-300-1.service';cg='/system.slice/'+unit;raw=('0::'+cg+'\n').encode()
        file_identity={'dev':5,'ino':6,'mode':stat.S_IFREG|0o444,'uid':1001,'gid':1002}
        witness={'path':'/proc/self/cgroup','role':'self-proc','before':file_identity,'after':file_identity,'named':file_identity,
          'bytesRead':len(raw),'prefixBytes':len(raw),'prefixSha256':H(raw),'prefixBase64':base64.b64encode(raw).decode(),
          'closeAttempted':True,'closed':True,'complete':True}
        observed=D(originals['original']);observed.update(schema='bw.gui-hdd.native-font-original.v2',servicePartial=None,
          service={phase:{'unit':unit,'cgroupPath':cg,'processIdentity':copy.deepcopy(identity),'selfProc':copy.deepcopy(witness)} for phase in ('before','after')})
        observed['platform'].update(GITHUB_JOB='native-font-selection-v2',BW_NATIVE_V2_INVOKER_UID='1001',BW_NATIVE_V2_INVOKER_GID='1002')
        terminal={'LoadState':'not-found','ActiveState':'inactive','SubState':'dead','Result':'success','ExecMainCode':'0',
          'ExecMainStatus':'0','ControlGroup':'','MainPID':'0','ControlPID':'0','KillMode':'control-group'}
        census={'exists':False,'populated':None,'procs':None,'threads':None,'nrDescendants':None,'nrDyingDescendants':None}
        outer={'schema':'bw.gui-hdd.native-font-service.v2','unit':unit,'cgroupPath':cg,'serviceExitCode':0,'originalPresent':True,
          'pre':{'unit':terminal,'cgroup':census},'post':{'unit':terminal,'cgroup':census},
          'cleanup':{'stopAttempted':False,'stopExitCode':None,'resetAttempted':False,'resetExitCode':None},
          'outsideFiniteCleanupProved':True,'firstFailure':None,'secondary':[],'invokerIdentity':identity,
          'innerComplete':True,'innerBeforeObserved':True,'innerFirstFailure':None}
        originals['original']=E(observed);originals['service']=E(outer)
        prior=D(originals['expectation']);prior['schema']='bw.gui-hdd.native-font-expectation.v2';originals['expectation']=E(prior)
        report=D(originals['readerReport']);report['schema']='bw.gui-hdd.native-font-reader.v2';originals['readerReport']=E(report)
        job=D(originals['job']);job['name']='native-font-selection-v2';originals['job']=E(job)
        artifact=D(originals['artifact']);artifact['name']=ref['artifactName'];originals['artifact']=E(artifact)
        self.refresh(files,expected,ref,originals,request)
        return files,expected,ref,originals
    def refresh(self,files,expected,ref,originals,request=None):
        observed=D(originals['original'])
        for role in ('request','event'):observed[role]={'bytes':len(originals[role]),'sha256':H(originals[role])}
        originals['original']=E(observed);prior=D(originals['expectation'])
        for role in ('request','event','original','service'):prior[role+'Sha256']=H(originals[role])
        prior.update(originalBytes=len(originals['original']),serviceBytes=len(originals['service']));originals['expectation']=E(prior)
        native_v5_refresh(files,expected,ref,originals,request)
    def test_full_v2_current_packet_producer_parser_and_standalone_reader(self):
        files,expected,ref,originals=self.fresh()
        request=c.parse_request(files['request.original.json'],expected['requestSha256'])
        self.assertEqual(request,r.parse_request(files['request.original.json'],expected['requestSha256']))
        complete,selected=sealed(files,expected);verdict=r.audit(complete,selected);self.assertTrue(verdict['pass'])
        self.assertEqual(verdict['schema'],'bw.gui-hdd.reader.v5')
        delivery=packet(files);inputs={'artifact':delivery,'expected':E(selected)}
        def bounded(path,cap):
            self.assertIn(path,inputs);self.assertLessEqual(len(inputs[path]),cap);return inputs[path]
        stream=io.StringIO()
        with patch.object(r,'bounded_input',side_effect=bounded),patch.object(r.sys,'stdout',stream):
            self.assertEqual(r.main(['artifact','expected']),0)
        self.assertEqual(D(stream.getvalue().encode()),verdict)
        self.assertFalse(c.ACTUAL_ENABLED);self.assertFalse(r.ACTUAL_ENABLED)
        self.assertLess(len(files['request.original.json']),r.JSON_CAP);self.assertLess(len(E(expected)),r.JSON_CAP)
    def test_authored_zip_ignores_host_time_with_original_helper_counterfactual(self):
        def legacy_zip(files):
            out=io.BytesIO()
            with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as archive:
                for name,raw in sorted(files.items()):archive.writestr(name,raw)
            return out.getvalue()
        files={'owned.txt':b'authored bytes','owned-dir/':b'','unicode-\u00e5.txt':b'authored UTF8 name'}
        fixed=(1980,1,1,0,0,0,1,1,-1)
        with patch.object(zipfile.time,'localtime',return_value=fixed):
            self.assertEqual(zip_(files),legacy_zip(files),'only date selection changes: original compression/attributes/data remain exact')
        early=(2026,10,24,0,0,0,5,297,-1);late=(2026,10,24,0,0,2,5,297,-1)
        with patch.object(zipfile.time,'localtime',side_effect=[early]*len(files)+[late]*len(files)) as clock:
            first=zip_(files);second=zip_(files);self.assertEqual(first,second);clock.assert_not_called()
        with patch.object(zipfile.time,'localtime',side_effect=[early]*len(files)+[late]*len(files)):
            before=legacy_zip(files);after=legacy_zip(files)
        self.assertNotEqual(before,after);self.assertNotEqual(H(before),H(after))
        for raw in (first,second,before,after):
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                self.assertEqual(archive.namelist(),sorted(files))
                for info in archive.infolist():
                    self.assertEqual(archive.read(info),files[info.filename]);self.assertEqual(info.compress_type,zipfile.ZIP_DEFLATED)
                    self.assertEqual(info.external_attr,((0o40775<<16)|0x10) if info.filename.endswith('/') else 0o600<<16)
    def test_v2_identity_role_owner_and_outer_coherent_mutations(self):
        for cut in ('owner','gid','triplet','path','bytes','close','after','partial','outer-identity','outer-pid','outer-cgroup','inner','failure','current-runtime'):
            files,expected,ref,originals=self.fresh();observed=D(originals['original']);outer=D(originals['service'])
            before=observed['service']['before'];w=before['selfProc']
            if cut=='owner':
                for name in ('before','after','named'):w[name]['uid']=0
            elif cut=='gid':observed['platform']['BW_NATIVE_V2_INVOKER_GID']='1001'
            elif cut=='triplet':before['processIdentity']['resuid']=[0,1001,1001]
            elif cut=='path':w['path']='/proc/1/cgroup'
            elif cut=='bytes':w['prefixSha256']=H(b'other')
            elif cut=='close':w['closed']=False
            elif cut=='after':observed['service']['after']['processIdentity']['gid']=1003
            elif cut=='partial':observed['servicePartial']={'phase':'before'}
            elif cut=='outer-identity':outer['invokerIdentity']['uid']=1003
            elif cut=='outer-pid':outer['post']['unit']['MainPID']='42'
            elif cut=='outer-cgroup':outer['post']['cgroup']=dict(exists=True,populated=1,procs=[42],threads=[42],nrDescendants=1,nrDyingDescendants=0)
            elif cut=='inner':outer['innerComplete']=False
            elif cut=='failure':observed['firstFailure']={'phase':'native-font-observation','name':'ValueError','message':'retained failure'}
            else:
                value=D(files['runtime.after.json']);value['files']['/usr/bin/fc-match']['sha256']='0'*64;files['runtime.after.json']=E(value)
            originals['original']=E(observed);originals['service']=E(outer);self.refresh(files,expected,ref,originals)
            with self.subTest(cut=cut),self.assertRaises(ValueError):r.audit(*sealed(files,expected))
    def test_v1_v2_schema_job_marker_label_artifact_are_not_interchangeable(self):
        for role,cut in (('request','schema'),('original','schema'),('service','schema'),('expectation','schema'),('readerReport','schema'),('job','name'),('event','marker'),('event','label'),('artifact','name')):
            files,expected,ref,originals=self.fresh();value=D(originals[role])
            if cut=='schema':value['schema']=value['schema'][:-1]+'1'
            elif cut=='marker':value['pull_request']['body']=value['pull_request']['body'].replace('BW_NATIVE_FONT_V2_','BW_NATIVE_FONT_')
            elif cut=='label':value['label']['name']='x86-native-font-selection-v1'
            else:value[cut]='native-font-selection' if role=='job' else 'i80386-native-font-selection-300-1'
            originals[role]=E(value);self.refresh(files,expected,ref,originals)
            with self.subTest(role=role,cut=cut),self.assertRaises(ValueError):r.audit(*sealed(files,expected))
        files,expected,ref,originals=self.fresh();ref['schema']='bw.gui-hdd.actual-native-font-reference.v1';self.refresh(files,expected,ref,originals)
        for module in (c,r):
            with self.assertRaises(ValueError):module.parse_request(files['request.original.json'],expected['requestSha256'])
    def test_v2_identity_guard_removal_mutant_accepts_same_hostile_packet(self):
        files,expected,ref,originals=self.fresh();observed=D(originals['original'])
        for phase in ('before','after'):
            for name in ('before','after','named'):observed['service'][phase]['selfProc'][name]['uid']=0
        originals['original']=E(observed);self.refresh(files,expected,ref,originals)
        selected=sealed(files,expected)
        with self.assertRaisesRegex(ValueError,'native v2 stable self-proc owner'):r.audit(*selected)
        with patch.object(r,'join_native_v2_identity',return_value=None):self.assertTrue(r.audit(*selected)['pass'])
    def test_v1_manufactured_historical_admission_stays_distinct(self):
        files,expected=fixture_v5();self.assertTrue(r.audit(*sealed(files,expected))['pass'])

suite=unittest.TestSuite(Originals(name) for name in unittest.defaultTestLoader.getTestCaseNames(Originals) if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_')))
result=unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({'controls':result.testsRun,'failures':len(result.failures),'errors':len(result.errors)}))
sys.exit(not result.wasSuccessful())
`;

test('original controls stdout is one complete JSON summary without ignored output', () => {
    const summary = {controls:107,failures:0,errors:0};
    const raw = JSON.stringify(summary);
    assert.deepEqual(readOriginalControlSummary(`  ${raw}\n`),summary);
    for (const output of [`unexpected prefix\n${raw}`,`${raw}\nunexpected suffix`,`${raw}\n${raw}`]) {
        assert.throws(() => readOriginalControlSummary(output),SyntaxError);
    }
});

test('parallel original control deadline and child failures cannot be ignored', async () => {
    const failure=await runControlChildren([{argv:['/usr/bin/python3','-c','import sys;sys.exit(3)']}],1000);
    assert.equal(failure.results[0].code,3);assert.equal(failure.results[0].error,null);assert.equal(failure.expired,false);
    const timeout=await runControlChildren([{argv:['/usr/bin/python3','-c','import time;time.sleep(1)']}],10);
    assert.equal(timeout.expired,true);assert.notEqual(timeout.results[0].code,0);
    const bytes=3*1024*1024;
    const emitted='import sys;sys.stdout.buffer.write(b"x"*'+bytes+')';
    const aggregate=await runControlChildren([
        {argv:['/usr/bin/python3','-c',emitted]},
        {argv:['/usr/bin/python3','-c',emitted]}],5000);
    assert.equal(aggregate.expired,false);
    assert.equal(aggregate.aggregateOverflow,true,'two individually bounded children exceed the one retained 4 MiB budget');
    assert.ok(aggregate.capturedBytes<=4*1024*1024);
    assert.ok(aggregate.results.every(result=>result.overflow===false && result.stdout.length<4*1024*1024));
});

test('mixed inventory fixture lstat preserves real ancestors and refuses mock leakage', () => {
    const start=controls.indexOf('suite=unittest.TestSuite(Originals(name)');
    const end=controls.indexOf('\n',start);
    assert.ok(start>=0&&end>start);
    const selected=controls.slice(0,start)+"suite=unittest.TestSuite([FixturePaths('test_real_ancestors_children_and_mocked_siblings')])"+controls.slice(end);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(readOriginalControlSummary(result.stdout),{controls:1,failures:0,errors:0});
});

test('standalone original reader: complete manufactured packet and coherent negative controls', async () => {
    const original="suite=unittest.TestSuite(Originals(name) for name in unittest.defaultTestLoader.getTestCaseNames(Originals) if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_')))";
    assert.ok(controls.includes(original));
    const specs=[];
    for(const parity of [0,1]){
        const selected=controls.replace(original,
            "suite=unittest.TestSuite(Originals(name) for index,name in enumerate(unittest.defaultTestLoader.getTestCaseNames(Originals)) if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_')) and index%2=="+parity+")");
        assert.notEqual(selected,controls);
        specs.push({argv:['/usr/bin/python3','-B','-',root],input:selected});
    }
    const {results,expired,aggregateOverflow,capturedBytes,elapsedMs}=await runControlChildren(specs,60000);
    assert.equal(expired,false,'one shared 60-second deadline covers both historical shards');
    assert.equal(aggregateOverflow,false,'one retained 4 MiB budget covers both historical shards');
    assert.ok(capturedBytes<=4*1024*1024);
    assert.ok(elapsedMs<=60000,'whole historical control wall budget');
    let total=0;
    for(const result of results){
        assert.equal(result.error,null,`${result.error?.stack || ''}\n${result.stderr}`);
        assert.equal(result.code,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
        assert.equal(result.signal,null,'each historical child exited normally');
        assert.equal(result.overflow,false,'retained 4 MiB child output bound');
        const summary=readOriginalControlSummary(result.stdout);
        assert.ok(summary.controls>0);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
        total+=summary.controls;
    }
    const historicalMethodCount=167;
    const sameJobMethodCount=14; // Seven new reader and seven connected producer methods.
    const sameJobPartsMethodCount=4;
    const armedEntryMethodCount=2;
    const frontendRosterMethodCount=2; // V9 reviewed frontend subset and numeric-chunk roles.
    assert.equal(total,historicalMethodCount+sameJobMethodCount+sameJobPartsMethodCount+armedEntryMethodCount+frontendRosterMethodCount,
        'all 167 historical plus 14 same-job plus 4 V9 parts plus 2 armed-entry plus 2 frontend roster methods remain covered exactly once');
});

test('actual v6 parts: exact bounded transport and independent reader parity', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_actual_v6_parts_')");
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ''}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=1);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('actual v7 parts: distinct packet, exact bounded transport and reader refusals', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_actual_v7_')");
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ''}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=1);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('actual v8 dispatch request, platform and separate PR/tag source admission', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_actual_v8_')");
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ''}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.equal(summary.controls,8);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('finite inventory v4: body-first guard, source-only producer and independent original controls', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_finite_v4')");
    assert.notEqual(selected, controls);
    const result = spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=8);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('finite inventory v6: distinct installed entry, transport and independent original controls', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_finite_v6')");
    assert.notEqual(selected, controls);
    const result = spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=3);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('finite inventory v7: current synthetic supplier pins and independent original controls', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_finite_v7')");
    assert.notEqual(selected, controls);
    const result = spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=6);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('finite inventory v8: current synthetic supplier pins and independent original controls', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_finite_v8')");
    assert.notEqual(selected, controls);
    const result = spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=6);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});
test('finite inventory v9: current synthetic supplier pins and independent original controls', () => {
    const selected = controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_finite_v9')");
    assert.notEqual(selected, controls);
    const result = spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=6);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('native v2 GUI join: complete packet, source-bound identity and coherent refusals', () => {
    const old="suite=unittest.TestSuite(Originals(name) for name in unittest.defaultTestLoader.getTestCaseNames(Originals) if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_')))";
    const selected=controls.replace(old,'suite=unittest.defaultTestLoader.loadTestsFromTestCase(NativeV2Originals)');
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(readOriginalControlSummary(result.stdout),{controls:6,failures:0,errors:0});
});

const probe=fs.readFileSync(new URL('../scripts/verify-i80386-local-hdd-gui.mjs',import.meta.url),'utf8');
const extract=name=>{
    const declaration=probe.indexOf(`function ${name} (`);
    assert.ok(declaration>=0,`probe declaration ${name}`);
    const start=probe.slice(declaration-6,declaration)==='async ' ? declaration-6 : declaration;
    return probe.slice(start,probe.indexOf('\n}',declaration)+2);
};
const context=vm.createContext({assert,Buffer});
vm.runInContext(`${extract('forwardBootDisk')}\n${extract('forwardStepTransition')}`,context);
test('authored forward boot is finite and preserves full-width register setup',()=>{
    const disk=vm.runInContext('forwardBootDisk()',context);
    assert.equal(disk.length,34816);assert.equal(disk.subarray(0,21).toString('hex'),'fa31c08ed866b87856341266bfefcdab896640ebfc');
    assert.equal(disk.subarray(510,512).toString('hex'),'55aa');
});
test('actual probe step assertions reject truncated EDI, multi-step and no progress',()=>{
    const before={regs:{pc:0x7c11,eax:0xffffffff},cpuCycles:3};
    const after={regs:{pc:0x7c13,eax:0,edi:0x89abcdef},cpuCycles:4,phase:'paused'};
    context.before=before;context.after=after;vm.runInContext('forwardStepTransition(before,after)',context);
    for(const change of [{regs:{...after.regs,edi:0xcdef}},{cpuCycles:3},{regs:{...after.regs,pc:0x7c11}},{regs:{...after.regs,eax:1}}]){
        context.after={...after,...change};assert.throws(()=>vm.runInContext('forwardStepTransition(before,after)',context));
    }
});
test('selected browser path reaches both new Chromium launch descriptors',()=>{
    assert.equal((probe.match(/chromium\.launch\(\{headless:true,executablePath\}\)/g)||[]).length,1);
    assert.equal((probe.match(/await admittedBrowser\(/g)||[]).length,2);
    assert.match(probe,/PROOF_BROWSER_SHA256/);assert.match(probe,/sameAsOriginal:await second.evaluate/);
});

// The product handlers run verbatim against delayed browser File/prompt and
// React commit boundaries. No target, session or guest behavior is simulated.
const manager=fs.readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/machine-manager.jsx',import.meta.url),'utf8');
const drawer=fs.readFileSync(new URL('../overlay/scratch-gui/src/components/tw-pseudocode/debug-drawer.jsx',import.meta.url),'utf8');
const between=(source,start,end)=>{
    const from=source.indexOf(start);assert.ok(from>=0);
    const to=source.indexOf(end,from);assert.ok(to>from);return source.slice(from,to);
};
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('forward Boot waits for actual MachineManager asynchronous conf state, without blocking File selection',async()=>{
    const inputHandler=between(manager,'const file = e.target.files?.[0];','}} />');
    let rendered='',pending='',bootText=null,changed,release;
    const scope=vm.createContext({assert,Buffer,setText:value=>{pending=value;},document:{querySelector:()=>({value:rendered})}});
    vm.runInContext(`const actualConfChange=async e=>{${inputHandler}};${extract('forwardLocalMedia')}`,scope);
    const page={
        getByTestId:name=>({
            setInputFiles:async input=>{
                if(name==='bw-mm-local-conf'){
                    release=deferred();changed=scope.actualChange({target:{files:[{text:()=>release.promise}]}});
                    // A real input's dispatched event does not await its async listener.
                    assert.equal(rendered,'');
                } else assert.equal(name,'bw-mm-local-disk');
            },
            click:async()=>{assert.equal(name,'bw-mm-local-run');bootText=rendered;},
            waitFor:async()=>{assert.equal(name,'bw-machine-manager');}
        }),
        waitForFunction:async(predicate,expected,options)=>{
            assert.equal(options.timeout,10000);assert.equal(bootText,null);
            assert.equal(vm.runInContext('('+predicate.toString()+')(expected)',Object.assign(scope,{expected})),false);
            release.resolve(expected);await changed;
            assert.equal(rendered,'');assert.equal(bootText,null);rendered=pending;
            assert.equal(vm.runInContext('('+predicate.toString()+')(expected)',scope),true);
        }
    };
    scope.actualChange=vm.runInContext('actualConfChange',scope);scope.page=page;
    await vm.runInContext('forwardLocalMedia(page,Buffer.alloc(34816))',scope);
    assert.match(bootText,/imgmount c "forward-owned.img" -t hdd -size 512,17,4,1/);
    // The pre-fix ordering demonstrably booted while the actual handler was pending.
    rendered='';pending='';bootText=null;
    await page.getByTestId('bw-mm-local-conf').setInputFiles({});await page.getByTestId('bw-mm-local-run').click();
    assert.equal(bootText,'');release.resolve('eventually-read');await changed;assert.equal(pending,'eventually-read');
});

test('physical memory waits for actual async jump and rendered address, not the preexisting read-only label',async()=>{
    const {memoryJump,memorySessionCurrent}=await import('../overlay/scratch-gui/src/lib/bw-debug/memory-view.js');
    const jumpHandler=between(drawer,"const raw = await promptAsync('Memory address (hex)', address(start));",'}}>Go to address');
    const answer=deferred(),committed=deferred();let listener,renderedPage=0,pendingPage,handler,done=false;
    const capabilities={},runner={},session={runner,capabilities,spacesDeclared:true};
    const scope=vm.createContext({assert,Promise,promptAsync:()=>answer.promise,address:()=> '00000000',start:0,
        memorySessionCurrent,session,current:()=>({...session,mounted:true}),memoryJump,
        spec:{id:'mem',addressMin:0,addressMax:0xffffffff,maxReadBytes:1048576},
        component:{setState:state=>{pendingPage=state.page;}}});
    vm.runInContext(`const actualJump=async function(){${jumpHandler}};${extract('forwardMemoryPage')}`,scope);
    const panel={getByRole:()=>({click:async()=>{
        handler=vm.runInContext('actualJump.call(component)',scope);
        listener({type:()=> 'prompt',message:()=> 'Memory address (hex)',accept:async value=>{assert.equal(value,'7C00');answer.resolve(value);}});
    }}),locator:selector=>({waitFor:async options=>{
        assert.equal(selector,'[title="00007C00 — read-only"]');assert.equal(options.timeout,10000);
        await handler;assert.equal(pendingPage,0x7c00/128);assert.equal(renderedPage,0);
        // The old Read-only label has remained visible, while count() for the
        // requested cell would still be zero until this separate commit.
        await committed.promise;assert.equal(renderedPage,pendingPage);
    }})};
    scope.page={waitForEvent:async name=>{assert.equal(name,'dialog');return new Promise(resolve=>{listener=resolve;});}};scope.panel=panel;
    const operation=vm.runInContext('forwardMemoryPage(page,panel)',scope).then(()=>{done=true;});
    await tick();assert.equal(done,false);assert.equal(renderedPage,0);assert.equal(pendingPage,248);
    renderedPage=pendingPage;committed.resolve();await operation;assert.equal(done,true);
});

test('drawer and register readiness follow actual React toggle and full-width formatting before inspection',async()=>{
    const toggle=between(drawer,'toggle () {','\n\n    /**');
    let pendingOpen,open=false,opened=false,registersReady=false,rendered='EAX 12345677 EDI 89ABCDEF';
    const drawerCommit=deferred(),registerCommit=deferred();
    const scope=vm.createContext({assert,component:{state:{open:false},setState:update=>{pendingOpen=update({open:false}).open;}},
        document:{querySelector:()=>({innerText:rendered})}});
    vm.runInContext(`const actualToggle={${toggle}};${extract('forwardOpenDrawer')}\n${extract('forwardRegistersReady')}`,scope);
    const panel={getByRole:(role,options)=>({
        click:async()=>{assert.match(String(options.name),/Under the hood/);vm.runInContext('actualToggle.toggle.call(component)',scope);},
        waitFor:async settings=>{
            assert.equal(options.name,'Step instruction');assert.equal(settings.timeout,10000);
            assert.equal(pendingOpen,true);assert.equal(open,false);await drawerCommit.promise;assert.equal(open,true);
        }
    })};
    scope.panel=panel;
    const opening=vm.runInContext('forwardOpenDrawer(panel)',scope).then(()=>{opened=true;});
    await tick();assert.equal(opened,false);open=pendingOpen;drawerCommit.resolve();await opening;
    const formatExpression=between(drawer,"{typeof v === 'boolean' ?",'\n                            </span>').trim();
    const format=new Function('v','k','hex8','hex16','WIDE','return '+formatExpression.slice(1,-1));
    const eax=format(0x12345678,'eax');const edi=format(0x89abcdef,'edi');
    assert.equal(eax,'12345678');assert.equal(edi,'89ABCDEF');
    scope.page={waitForFunction:async(predicate,expected,options)=>{
        assert.equal(expected,0x12345678);assert.equal(options.timeout,10000);scope.expected=expected;
        const check=()=>vm.runInContext('('+predicate.toString()+')(expected)',scope);
        assert.equal(check(),false);await registerCommit.promise;
        rendered='EAX '+eax+' EDI '+edi;assert.equal(check(),true);
    }};
    const reading=vm.runInContext('forwardRegistersReady(page,0x12345678)',scope).then(()=>{registersReady=true;});
    await tick();assert.equal(registersReady,false);registerCommit.resolve();await reading;
});

test('metadata diagnostic step and job budgets contain the collector without widening actual',()=>{
    const workflow=fs.readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml',import.meta.url),'utf8');
    const inventory=workflow.split('  inventory:')[1].split('  actual:')[0];
    const controller=fs.readFileSync(new URL('../scripts/run-i80386-hdd-gui-actual.py',import.meta.url),'utf8');
    const collectorSeconds=Number(controller.match(/deadline=time\.monotonic\(\)\+(\d+)/)[1]);
    const setupMinutes=Number(inventory.split('name: Install unchanged selected packages')[1].match(/timeout-minutes: (\d+)/)[1]);
    const recordMinutes=Number(inventory.split('name: Install externally selected immutable template')[1].match(/timeout-minutes: (\d+)/)[1]);
    const jobMinutes=Number(inventory.match(/timeout-minutes: (\d+)/)[1]);
    assert.ok(recordMinutes*60>=collectorSeconds+60,'diagnostic record step cannot preempt the collector budget');
    assert.ok(jobMinutes>=setupMinutes+recordMinutes+1,'metadata job includes setup, record and finite overhead margin');
    assert.match(workflow.split('  actual:')[1].split('  actual-v7:')[0],/false &&/);
    const actualV7=workflow.split('  actual-v7:')[1].split('  actual-v8:')[0];
    const actualV8=workflow.split('  actual-v8:')[1].split('  actual-v9:')[0].split('  font-bridge:')[0];
    assert.match(actualV7,/false &&/);
    assert.match(actualV8,/false && github\.event_name == 'workflow_dispatch'/);
    assert.match(actualV7,/timeout-minutes: 35/);
    assert.match(actualV8,/timeout-minutes: 35/);
    assert.match(controller,/ACTUAL_ENABLED = False/);
});

// The command/event/resource contract is distinct from font selection or runtime
// approval. These checks are also applied to coherent workflow drift examples.
function fontDiscoveryWorkflowContract (workflow, controller) {
    const marker='\n  font-discovery:\n';
    assert.equal(workflow.split(marker).length,2,'one discovery job');
    const job=workflow.split(marker)[1];
    const [header,...steps]=job.split(/\n      - /);
    assert.match(header,/\$\{\{ true &&/,'metadata-only source job enabled');
    const conditions=["github.event_name == 'pull_request'","github.event.action == 'labeled'",
        "github.event.label.name == 'x86-hdd-gui-font-discovery'","github.actor == 'CrispStrobe'",
        "github.repository == 'CrispStrobe/brickwright-lite'","github.run_attempt == 1",
        'github.event.pull_request.head.repo.full_name == github.repository',
        'github.event.pull_request.head.repo.fork == false',"github.event.pull_request.base.ref == 'main'"];
    const predicate=header.split('    if: >-\n')[1]?.split('\n    runs-on:')[0].trim().replace(/\s+/g,' ');
    assert.equal(predicate,'${{ true && '+conditions.join(' && ')+' }}','one exact non-bypassable predicate');
    const headerKeys=[...header.matchAll(/^    ([a-z-]+):/gm)].map(match=>match[1]);
    assert.deepEqual(headerKeys,['if','runs-on','timeout-minutes','env','steps'],'closed unique job fields');
    const scalarMap=(text,indent)=>{
        const out={};
        for(const line of text.trimEnd().split('\n')){
            const match=line.match(new RegExp('^'+' '.repeat(indent)+'([A-Za-z_][A-Za-z_0-9-]*): (.+)$'));
            assert.ok(match,'plain fixed YAML scalar row');assert.ok(!Object.hasOwn(out,match[1]),'duplicate YAML key');out[match[1]]=match[2];
        }
        return out;
    };
    const envText=header.split('    env:\n')[1]?.split('    steps:')[0];
    const jobEnv=scalarMap(envText,6);
    const expectedEnv={BW_EXPECTED_HEAD:'${{ github.event.pull_request.head.sha }}',BW_FONT_DISCOVERY_BLOB:'${{ vars.BW_GUI_HDD_FONT_DISCOVERY_BLOB }}',
        BW_FONT_DISCOVERY_SHA256:'${{ vars.BW_GUI_HDD_FONT_DISCOVERY_SHA256 }}'};
    for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','LD_PRELOAD','LD_AUDIT','LD_LIBRARY_PATH','PYTHONPATH','PYTHONHOME',
        'PYTHONSTARTUP','PYTHONUSERBASE','PYTHONINSPECT','PYTHONPYCACHEPREFIX','BASH_ENV','ENV'])expectedEnv[key]="''";
    assert.deepEqual(jobEnv,expectedEnv,'closed scrubbed job environment');
    assert.match(header,/runs-on: ubuntu-24\.04/);
    assert.match(header,/BW_EXPECTED_HEAD: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
    assert.match(header,/BW_FONT_DISCOVERY_BLOB: \$\{\{ vars\.BW_GUI_HDD_FONT_DISCOVERY_BLOB \}\}/);
    assert.match(header,/BW_FONT_DISCOVERY_SHA256: \$\{\{ vars\.BW_GUI_HDD_FONT_DISCOVERY_SHA256 \}\}/);
    assert.doesNotMatch(header,/GH_TOKEN|GITHUB_TOKEN/,'no job-wide credentials');
    for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','LD_PRELOAD','LD_AUDIT','LD_LIBRARY_PATH','PYTHONPATH','PYTHONHOME',
        'PYTHONSTARTUP','PYTHONUSERBASE','PYTHONINSPECT','PYTHONPYCACHEPREFIX','BASH_ENV','ENV']){
        assert.match(header,new RegExp('^      '+key+": ''$",'m'),'scrub '+key);
    }
    assert.equal(steps.length,7,'finite checkout/guard/Node/setup/install/collect/upload sequence');
    const [checkout,guard,node,setup,install,collect,upload]=steps;
    for(const step of steps){
        const keys=[step.split(':',1)[0],...[...step.matchAll(/^        ([a-z-]+):/gm)].map(match=>match[1])];
        assert.equal(keys.length,new Set(keys).size,'no duplicate step fields');
        assert.ok(keys.every(key=>['uses','name','with','run','timeout-minutes','env','if'].includes(key)),'closed finite step keys');
        const pieces=step.split('\n        env:\n');assert.ok(pieces.length<=2,'single step environment');
        if(pieces.length===2){
            const env=scalarMap(pieces[1].split('\n        run:')[0],10);
            assert.deepEqual(env,step===install?{GH_TOKEN:'${{ github.token }}'}:{GH_TOKEN:"''",GITHUB_TOKEN:"''"},'exact credential scope');
            assert.ok(step===install||step===collect,'environment only on input and collector steps');
        }
    }
    assert.deepEqual(scalarMap(checkout.split('\n        with:\n')[1],10),{ref:'${{ github.event.pull_request.head.sha }}','persist-credentials':'false'});
    assert.deepEqual(scalarMap(node.split('\n        with:\n')[1],10),{'node-version':'22.23.3'});
    assert.deepEqual(scalarMap(upload.split('\n        with:\n')[1],10),{name:'i80386-hdd-gui-font-discovery-${{ github.run_id }}-${{ github.run_attempt }}',
        path:'gui-font-discovery','if-no-files-found':'error','retention-days':'14'});
    assert.match(checkout,/^uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262\n/);
    assert.match(checkout,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,'checkout exact immutable head');
    assert.match(checkout,/persist-credentials: false/);
    assert.match(guard,/scripts\/run-i80386-hdd-gui-actual\.py font-discovery-guard/,'source guard precedes Node setup and retrieval');
    assert.match(node,/^uses: actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n/);
    assert.match(node,/node-version: 22\.23\.3/);
    assert.match(setup,/npm ci --ignore-scripts --no-audit --no-fund/);
    assert.match(setup,/node node_modules\/playwright\/cli\.js install --with-deps chromium/);
    assert.doesNotMatch(job,/npm (?:run )?build|fc-list|fc-cache|apt(?:-get)? /,'no frontend build, extra font tools or package fallback');
    assert.match(guard,/mkdir gui-font-discovery\n/,'exclusive observation root');assert.doesNotMatch(guard,/mkdir -p/);
    for(const step of [guard,setup,install,collect]){
        assert.match(step,/set -euo pipefail/);assert.match(step,/set -o noclobber/,'never overwrite an original');
        assert.doesNotMatch(step,/\|\||set \+e|continue-on-error|exit 0|;\s*true/,'collector refusal cannot be masked');
    }
    assert.equal(job.split('GH_TOKEN: ${{ github.token }}').length,2,'only one credential-bearing step');
    assert.match(install,/GH_TOKEN: \$\{\{ github\.token \}\}/);assert.doesNotMatch(guard+node+setup+upload,/GH_TOKEN|GITHUB_TOKEN/);
    assert.match(collect,/GH_TOKEN: ''/);assert.match(collect,/GITHUB_TOKEN: ''/);assert.doesNotMatch(collect,/github\.token/);
    for(const [step,mode] of [[guard,'font-discovery-guard'],[install,'install-input'],[collect,'font-discovery']]){
        assert.match(step,new RegExp('/usr/bin/python3 -I -B scripts/run-i80386-hdd-gui-actual\\.py '+mode+'(?: \\\\|\\n)'),'isolated system Python invocation');
    }
    assert.match(install,/--blob "\$BW_FONT_DISCOVERY_BLOB" --expected-sha256 "\$BW_FONT_DISCOVERY_SHA256"/);
    assert.match(install,/--output "\$GITHUB_WORKSPACE\/gui-font-discovery\/request\.json"/);
    assert.match(collect,/--request "\$GITHUB_WORKSPACE\/gui-font-discovery\/request\.json"/);
    assert.match(collect,/--expected-sha256 "\$BW_FONT_DISCOVERY_SHA256"/);
    assert.match(collect,/--output "\$GITHUB_WORKSPACE\/gui-font-discovery\/font-discovery-original\.json"/);
    for(const [step,name] of [[guard,'guard'],[install,'input-install'],[collect,'controller']]){
        assert.ok(step.includes('> gui-font-discovery/'+name+'.stdout 2> gui-font-discovery/'+name+'.stderr'),'retain '+name+' streams');
    }
    assert.match(upload,/^uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n/);
    assert.match(upload,/if: always\(\)/,'retain refusal and child originals after failure');
    assert.match(upload,/path: gui-font-discovery\n/,'retain entire tree including process originals');
    assert.match(upload,/name: i80386-hdd-gui-font-discovery-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
    assert.match(upload,/if-no-files-found: error/);assert.match(upload,/retention-days: 14/);
    const minutes=part=>Number(part.match(/timeout-minutes: (\d+)/)[1]);
    const definition=controller.split('def collect_font_discovery(')[1].split('\n\ndef font_packages(')[0];
    const seconds=Number(definition.match(/deadline=time\.monotonic\(\)\+(\d+)/)[1]);
    assert.equal(seconds,180);assert.ok(minutes(collect)*60>=seconds+60,'collector leaves terminal retention margin');
    assert.equal(minutes(setup),10);assert.equal(minutes(install),1);assert.equal(minutes(collect),4);assert.equal(minutes(header),16);
    assert.ok(minutes(header)>=minutes(setup)+minutes(install)+minutes(collect)+1,'separate finite job backstop includes overhead');
    assert.match(controller,/FONT_DISCOVERY_ENABLED = True/);assert.match(controller,/ACTUAL_ENABLED = False/);
}

test('enabled font-discovery source delivers pinned inputs to the finite observation contract',()=>{
    const workflow=fs.readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml',import.meta.url),'utf8');
    const controller=fs.readFileSync(new URL('../scripts/run-i80386-hdd-gui-actual.py',import.meta.url),'utf8');
    fontDiscoveryWorkflowContract(workflow,controller);
    const marker='\n  font-discovery:\n',prefix=workflow.split(marker)[0]+marker,job=workflow.split(marker)[1];
    const shift=(from,to)=>{assert.ok(job.includes(from),from);return prefix+job.replace(from,to);};
    const variants=[
        shift('> gui-font-discovery/controller.stdout 2> gui-font-discovery/controller.stderr','> gui-font-discovery/controller.stdout 2> gui-font-discovery/controller.stderr || true'),
        shift('name: Record bounded read-only font discovery without credentials','name: Record bounded read-only font discovery without credentials\n        continue-on-error: true'),
        shift("github.event.pull_request.base.ref == 'main' }}","github.event.pull_request.base.ref == 'main' || true }}"),
        shift("GH_TOKEN: ''","GH_TOKEN: ''\n          GH_TOKEN: ${{ github.token }}"),
        shift("NODE_OPTIONS: ''","NODE_OPTIONS: ''\n      NODE_OPTIONS: '--eval=unreviewed'"),
        shift("        env:\n          GH_TOKEN: ''","        GH_TOKEN: ${{ github.token }}\n        env:\n          GH_TOKEN: ''"),
        shift('${{ true &&','${{ false &&'),shift('x86-hdd-gui-font-discovery','x86-hdd-gui-inventory'),
        shift('github.run_attempt == 1','github.run_attempt == 2'),shift('github.event.pull_request.head.repo.fork == false','true'),
        shift('ref: ${{ github.event.pull_request.head.sha }}','ref: ${{ github.sha }}'),shift('node-version: 22.23.3','node-version: 22'),
        shift('actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/checkout@v4'),
        shift("GH_TOKEN: ''",'GH_TOKEN: ${{ github.token }}'),shift('BW_EXPECTED_HEAD:', 'GH_TOKEN: ${{ github.token }}\n      BW_EXPECTED_HEAD:'),
        shift('if: always()','if: success()'),shift('path: gui-font-discovery\n','path: gui-font-discovery/font-discovery-original.json\n'),
        shift('timeout-minutes: 4','timeout-minutes: 2'),shift('npm ci --ignore-scripts','npm ci'),
        shift('mkdir gui-font-discovery\n','mkdir -p gui-font-discovery\n'),shift('set -o noclobber\n','true\n'),
        shift("NODE_OPTIONS: ''","NODE_OPTIONS: '--eval=unreviewed'"),shift('/usr/bin/python3 -I -B','/usr/bin/python3 -B'),
        shift('--blob "$BW_FONT_DISCOVERY_BLOB"','--blob "$UNREVIEWED_BLOB"'),
        shift('--output "$GITHUB_WORKSPACE/gui-font-discovery/font-discovery-original.json"','--output "$GITHUB_WORKSPACE/elsewhere.json"')
    ];
    const parts=job.split(/\n      - /);const swapped=[parts[0],parts[1],parts[3],parts[2],...parts.slice(4)].join('\n      - ');variants.push(prefix+swapped);
    for(const changed of variants)assert.throws(()=>fontDiscoveryWorkflowContract(changed,controller));
});


function fontBridgeDeliveryWorkflowContract (workflow, controller) {
    const marker='\n  font-bridge:\n';
    assert.equal(workflow.split(marker).length,2);
    const job=workflow.split(marker)[1].split('\n  # Observation delivery only.')[0];
    const [header,...steps]=job.split(/\n      - /);
    const conditions=["github.event_name == 'pull_request'","github.event.action == 'labeled'","github.event.label.name == 'x86-hdd-gui-font-bridge'","github.actor == 'CrispStrobe'","github.repository == 'CrispStrobe/brickwright-lite'",'github.run_attempt == 1','github.event.pull_request.head.repo.full_name == github.repository','github.event.pull_request.head.repo.fork == false',"github.event.pull_request.base.ref == 'main'"];
    const predicate=header.split('    if: >-\n')[1].split('\n    runs-on:')[0].trim().replace(/\s+/g,' ');
    assert.equal(predicate,'${{ true && '+conditions.join(' && ')+' }}');
    assert.match(controller,/FONT_BRIDGE_ENABLED = True/);
    assert.match(controller,/ACTUAL_ENABLED = False/);
    assert.equal(steps.length,7);assert.match(header,/runs-on: ubuntu-24\.04/);assert.match(header,/timeout-minutes: 16/);
    assert.doesNotMatch(job,/continue-on-error|\|\| true|npm (?:run )?build|fc-list|fc-cache/);
    for(const key of ['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','LD_PRELOAD','LD_AUDIT','LD_LIBRARY_PATH','PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONUSERBASE','PYTHONINSPECT','PYTHONPYCACHEPREFIX','BASH_ENV','ENV'])assert.match(header,new RegExp('^      '+key+": ''$",'m'));
    assert.doesNotMatch(header,/GH_TOKEN|GITHUB_TOKEN/);
    const [checkout,guard,node,setup,install,collect,upload]=steps;
    assert.match(checkout,/uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);assert.match(checkout,/ref: \$\{\{ github.event.pull_request.head.sha \}\}/);assert.match(checkout,/persist-credentials: false/);
    assert.match(guard,/font-bridge-guard/);assert.match(guard,/mkdir gui-font-bridge/);assert.match(guard,/set -o noclobber/);
    assert.match(node,/actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);assert.match(node,/node-version: 22.23.3/);
    assert.match(setup,/timeout-minutes: 10/);assert.match(setup,/npm ci --ignore-scripts --no-audit --no-fund/);assert.match(setup,/playwright\/cli.js install --with-deps chromium/);
    assert.match(install,/timeout-minutes: 1/);assert.match(install,/GH_TOKEN: \$\{\{ github.token \}\}/);assert.match(install,/--blob "\$BW_FONT_BRIDGE_BLOB" --expected-sha256 "\$BW_FONT_BRIDGE_SHA256"/);
    assert.match(collect,/timeout-minutes: 4/);assert.match(collect,/GH_TOKEN: ''\n          GITHUB_TOKEN: ''/);assert.match(collect,/font-bridge \\/);assert.match(collect,/--output "\$GITHUB_WORKSPACE\/gui-font-bridge\/font-bridge-original.json"/);
    assert.match(upload,/actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);assert.match(upload,/if: always\(\)/);assert.match(upload,/name: i80386-hdd-gui-font-bridge-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);assert.match(upload,/path: gui-font-bridge/);
}

test('bridge delivery job uses exact owned event with pinned bounded source guards',()=>{
    const workflow=fs.readFileSync(new URL('../.github/workflows/i80386-hdd-gui-actual.yml',import.meta.url),'utf8');
    const controller=fs.readFileSync(new URL('../scripts/run-i80386-hdd-gui-actual.py',import.meta.url),'utf8');
    fontBridgeDeliveryWorkflowContract(workflow,controller);
    const marker='\n  font-bridge:\n',prefix=workflow.split(marker)[0]+marker,parts=workflow.split(marker)[1].split('\n  # Observation delivery only.'),job=parts[0],suffix='\n  # Observation delivery only.'+parts[1];
    assert.throws(()=>fontBridgeDeliveryWorkflowContract(prefix+job.replace('${{ true &&','${{ true || true &&')+suffix,controller));
    for(const [old,value] of [['${{ true &&','${{ false &&'],['github.run_attempt == 1','github.run_attempt == 2'],['font-bridge-guard','font-chain-guard'],['if: always()','if: success()'],['GH_TOKEN: \'\'','GH_TOKEN: ${{ github.token }}'],['timeout-minutes: 16','timeout-minutes: 8'],['--ignore-scripts','--foreground-scripts'],['node-version: 22.23.3','node-version: 22']]){
        assert.ok(job.includes(old));assert.throws(()=>fontBridgeDeliveryWorkflowContract(prefix+job.replace(old,value)+suffix,controller));
    }
});

// Canonical declarations are selected by their actual dependency sections.
const guiCuiSelection = (dependency='bw-circuit-ui') => {
    const json = path => JSON.parse(fs.readFileSync(root+path,'utf8'));
    const rootPackage=json('package.json'), guiPackage=json('packages/scratch-gui/package.json');
    const rootLock=json('package-lock.json'), guiLock=json('packages/scratch-gui/package-lock.json');
    return [rootPackage.devDependencies[dependency],guiPackage.dependencies[dependency],
        rootLock.packages[''].devDependencies[dependency],guiLock.packages[''].dependencies[dependency],
        rootLock.packages['node_modules/'+dependency].resolved,guiLock.packages['node_modules/'+dependency].resolved,
        json('vendor-pins.json')[dependency]];
};
const assertGuiCuiSelection = (consumer, selected, dependency='bw-circuit-ui') => {
    assert.match(consumer,/^[0-9a-f]{40}$/);
    assert.deepEqual(selected,[...Array(4).fill('github:CrispStrobe/'+dependency+'#'+consumer),
        ...Array(2).fill('git+ssh://git@github.com/CrispStrobe/'+dependency+'.git#'+consumer),consumer]);
};
test('GUI consumer explicitly matches current canonical Board and CUI declarations', () => {
    const controller=fs.readFileSync(root+'scripts/run-i80386-hdd-gui-actual.py','utf8');
    const reader=fs.readFileSync(root+'scripts/read-i80386-hdd-gui-originals.py','utf8');
    const pattern=/^FINITE_V10_PINS = \{'bw-board':'([0-9a-f]{40})','bw-circuit-ui':'([0-9a-f]{40})','sb3-creator':'([0-9a-f]{40})'\}$/m;
    for(const [dependency,index] of [['bw-board',1],['bw-circuit-ui',2]]){
        const consumer=controller.match(pattern)?.[index], selected=guiCuiSelection(dependency);
        assertGuiCuiSelection(consumer,selected,dependency);
        assertGuiCuiSelection(reader.match(pattern)?.[index],selected,dependency);
        assert.throws(()=>assertGuiCuiSelection('0'.repeat(40),selected,dependency));
        for(let i=0;i<selected.length;i++){
            const drift=[...selected];drift[i]=drift[i].replace(consumer,'0'.repeat(40));
            assert.throws(()=>assertGuiCuiSelection(consumer,drift,dependency));
        }
        for(const source of [controller,reader]){
            const changed=source.replace(pattern,line=>line.replace(consumer,'0'.repeat(40)));
            assert.notEqual(changed,source);
            assert.throws(()=>assertGuiCuiSelection(changed.match(pattern)?.[index],selected,dependency));
        }
    }
    assert.doesNotMatch(reader,/^CUI = /m,'unused historical reader literal removed without changing old validators');
});
const producerV10Controls = String.raw`
class ProducerV10(unittest.TestCase):
    def test_actual9_dispatch_inputs_admit_only_omitted_empty_historical_inputs(self):
        head='a'*40;ref='refs/heads/lane/manufactured-inputs'
        prelude={'pullRequest':123,'source':{'head':head},'dispatch':{'ref':ref}}
        env={'GITHUB_REPOSITORY':c.REPOSITORY,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_ACTOR':'CrispStrobe','GITHUB_RUN_ATTEMPT':'1',
             'GITHUB_RUN_ID':'7','GITHUB_JOB':'actual-v9','GITHUB_REF':ref,'GITHUB_REF_TYPE':'branch','GITHUB_REF_NAME':ref[len('refs/heads/'):],
             'GITHUB_SHA':head,'GITHUB_WORKFLOW_SHA':head,'BW_EXPECTED_HEAD':head,'GITHUB_WORKFLOW_REF':c.REPOSITORY+'/'+c.ACTUAL_V8_WORKFLOW+'@'+ref}
        base={'protocol':'actual-v9','pull_request':'123','source_head':head,'source_ref':ref,'prelude_sha256':'b'*64}
        def event(inputs):return E({'ref':ref,'repository':{'full_name':c.REPOSITORY},'sender':{'login':'CrispStrobe'},'inputs':inputs})
        for inputs in (base,dict(base,request_sha256='',tag_name='')):
            c.bind_actual_v9_event(event(inputs),prelude,'b'*64,env)
        bad=[dict(base,request_sha256=''),dict(base,tag_name=''),dict(base,request_sha256='c'*64,tag_name=''),
             dict(base,request_sha256='',tag_name='x'),{k:v for k,v in base.items() if k!='prelude_sha256'},dict(base,extra=''),
             dict(base,pull_request='124'),dict(base,protocol='actual-v8'),dict(base,pull_request=123),None]
        for inputs in bad:
            with self.subTest(inputs=repr(inputs)):
                with self.assertRaisesRegex(ValueError,'closed exact actual9 dispatch inputs'):c.bind_actual_v9_event(event(inputs),prelude,'b'*64,env)
    def role(self):
        return {'path':'/etc/resolv.conf','allowedKinds':['regular','symlink'],'symlinkAlternatives':[{'linkText':'../run/systemd/resolve/stub-resolv.conf','target':'/run/systemd/resolve/stub-resolv.conf'}]}
    def template(self):
        files=sorted(['/node','/usr/bin/python3.12','/chrome','/usr/bin/git','/usr/bin/gh','/usr/bin/curl','/usr/lib/libselected.so','/run/systemd/resolve/stub-resolv.conf'])
        return {'schema':'bw.gui-hdd.inventory-template.v10','sourceHead':'a'*40,'files':files,'aliases':[],
          'directoryAliases':[],'node':'/node','python':'/usr/bin/python3.12','chromium':'/chrome','tools':{'git':'/usr/bin/git','gh':'/usr/bin/gh'},
          'emptyPythonSources':Originals.empty_selection(None),'libraries':['/usr/lib/libselected.so'],'scope':c.finite_v5_scope(),
          'dependencyPins':copy.deepcopy(c.FINITE_V10_PINS),'bootstrapSource':copy.deepcopy(c.BOOTSTRAP_SOURCE),'resolverRole':self.role()}
    def prelude(self):
        template=self.template();raw=E(template)
        source={'head':'a'*40,'tree':'b'*40,'files':{name:ROW(('source:'+name).encode()) for name in c.SOURCE}}
        build={'runId':80,'attempt':1,'head':source['head'],'jobId':81,'jobName':'build','artifactId':82,'name':'github-pages',
          'metadataBytes':1,'zipBytes':1,'sha256':'c'*64,'checkoutHead':source['head'],'sourceFiles':source['files'],
          'sourceAdmission':{'schema':'bw.gui-hdd.frontend-source-admission.v1','checkoutHead':source['head'],'checkoutTree':source['tree'],
            'sourceFiles':source['files'],'checkoutLog':ROW(b'log'),'workflow':{'commit':source['head'],'path':'.github/workflows/build.yml','sha256':'d'*64}}}
        return {'schema':'bw.gui-hdd.actual-v9-prelude.v1','repository':c.REPOSITORY,'pullRequest':123,'source':source,
          'template':ROW(raw),'build':build,'nativeFontAdmission':{},'nativeSourceGit':{},
          'dispatch':{'ref':'refs/heads/lane/manufactured-v9','workflow':{'path':c.ACTUAL_V8_WORKFLOW,'sha256':source['files'][c.ACTUAL_V8_WORKFLOW]['sha256']}},
          'resources':copy.deepcopy(c.ACTUAL_V9_RESOURCES)}
    def env(self,prelude):
        raw=E(prelude);template=E(self.template());head=prelude['source']['head'];ref=prelude['dispatch']['ref']
        return {'GITHUB_REPOSITORY':c.REPOSITORY,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_ACTOR':'CrispStrobe',
          'GITHUB_RUN_ID':'90','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'actual-v9','GITHUB_REF':ref,'GITHUB_REF_TYPE':'branch',
          'GITHUB_REF_NAME':ref[len('refs/heads/'):],'GITHUB_SHA':head,'GITHUB_WORKFLOW_SHA':head,'BW_EXPECTED_HEAD':head,
          'GITHUB_WORKFLOW_REF':c.REPOSITORY+'/'+c.ACTUAL_V8_WORKFLOW+'@'+ref,
          'BW_GUI_HDD_ACTUAL_V9_PRELUDE_SHA256':H(raw),'BW_GUI_HDD_ACTUAL_V9_PRELUDE_B64':base64.b64encode(raw).decode(),
          'BW_FINITE_INVENTORY_V10_SHA256':H(template),'BW_FINITE_INVENTORY_V10_TEMPLATE_B64':base64.b64encode(template).decode()}
    def event(self,value):
        return E({'inputs':{'protocol':'actual-v9','pull_request':'123','source_head':value['source']['head'],
           'source_ref':value['dispatch']['ref'],'prelude_sha256':H(E(value)),'request_sha256':'','tag_name':''},
           'ref':value['dispatch']['ref'],'repository':{'full_name':c.REPOSITORY},'sender':{'login':'CrispStrobe'}})
    def test_template_and_dispatch_are_closed_and_separate(self):
        template=self.template();c.finite_v10_template(E(template),H(E(template)))
        prelude=self.prelude();env=self.env(prelude);raw=self.event(prelude)
        self.assertEqual(c.actual_v9_prelude_from_env(env),prelude)
        self.assertEqual(c.bind_finite_v10_event(raw,'a'*40,H(E(template)),env),E(template))
        for key,value in [('GITHUB_JOB','actual-v8'),('GITHUB_SHA','0'*40),('GITHUB_RUN_ATTEMPT','2'),('GITHUB_REF_TYPE','tag')]:
            changed=dict(env);changed[key]=value
            with self.assertRaises(ValueError):c.bind_finite_v10_event(raw,'a'*40,H(E(template)),changed)
        for cut in ('kind','target','literal','overlap','missing-endpoint','historical-pins'):
            changed=copy.deepcopy(template)
            if cut=='kind':changed['resolverRole']['allowedKinds']=['regular']
            if cut=='target':changed['resolverRole']['symlinkAlternatives'][0]['target']='/etc/passwd'
            if cut=='literal':changed['resolverRole']['symlinkAlternatives'][0]['linkText']='/run/systemd/resolve/stub-resolv.conf'
            if cut=='overlap':changed['files']=sorted(changed['files']+['/etc/resolv.conf'])
            if cut=='missing-endpoint':changed['files'].remove('/run/systemd/resolve/stub-resolv.conf')
            if cut=='historical-pins':changed['dependencyPins']=copy.deepcopy(c.FINITE_V9_PINS)
            with self.assertRaises(ValueError):c.finite_v10_template(E(changed),H(E(changed)))
    def info(self,mode,ino=1):
        return SimpleNamespace(st_dev=1,st_ino=ino,st_mode=mode,st_uid=0,st_gid=0,st_nlink=1,st_size=39,st_mtime_ns=3)
    def test_both_observed_resolver_branches_and_metadata_races(self):
        template=self.template();endpoint='/run/systemd/resolve/stub-resolv.conf';path='/etc/resolv.conf';literal=self.role()['symlinkAlternatives'][0]['linkText']
        for kind in ('regular','symlink'):
            with self.subTest(kind=kind):
                runtime={'files':{endpoint:ROW(b'endpoint')},'aliases':{},'directoryAliases':{}}
                failure={'firstFailure':None,'secondary':[]};kept=[]
                mode=(stat.S_IFREG|0o644) if kind=='regular' else (stat.S_IFLNK|0o777)
                with patch.object(c.os,'lstat',return_value=self.info(mode)),patch.object(c.os,'readlink',return_value=literal),patch.object(c,'regular',return_value=b'resolver'),patch.object(c,'check_file',return_value=b'endpoint'):
                    value=c.observe_resolver_role(template,runtime,failure,lambda *args:kept.append(args),c.time.monotonic()+5)
                self.assertEqual(value['kind'],kind);self.assertIsNone(failure['firstFailure']);self.assertEqual(len(kept),1)
                self.assertEqual(path in runtime['files'],kind=='regular');self.assertEqual(path in runtime['aliases'],kind=='symlink')
                c.runtime_alias_policy(runtime)
        for cut in ('unknown-link','inode-race','wrong-type','endpoint-drift','expired'):
            runtime={'files':{endpoint:ROW(b'endpoint')},'aliases':{},'directoryAliases':{}};failure={'firstFailure':None,'secondary':[]}
            before=self.info(stat.S_IFLNK|0o777);after=self.info(stat.S_IFLNK|0o777,2)
            if cut=='wrong-type':before=self.info(stat.S_IFIFO|0o600)
            with patch.object(c.os,'lstat',side_effect=[before,after] if cut=='inode-race' else lambda _:before),patch.object(c.os,'readlink',return_value='unselected' if cut=='unknown-link' else literal),patch.object(c,'check_file',side_effect=ValueError('endpoint changed') if cut=='endpoint-drift' else None):
                value=c.observe_resolver_role(template,runtime,failure,lambda *args:None,c.time.monotonic()+(-1 if cut=='expired' else 5))
            self.assertIsNone(value);self.assertIsNotNone(failure['firstFailure'])
    def ack_fixture(self):
        prelude=self.prelude();template=E(self.template());inventory=E({'schema':'manufactured'});head=prelude['source']['head']
        deadline={'runId':90,'runAttempt':1,'jobId':91,'sourceHead':head}
        request=E({'schema':'manufactured-request'});git=lambda raw:hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        ack={'schema':'bw.gui-hdd.actual-v9-ack.v1','repository':c.REPOSITORY,'runId':90,'runAttempt':1,'jobId':91,'sourceHead':head,
           'preludeSha256':H(E(prelude)),'templateSha256':H(template),'inventorySha256':H(inventory),'artifactId':92,'artifactSha256':'c'*64,
           'request':dict(ROW(request),gitBlob=git(request))}
        raw=E(ack);blob={'sha':git(raw),'encoding':'base64','size':len(raw),'content':base64.b64encode(raw).decode()}
        tree={'sha':'d'*40,'truncated':False,'tree':[{'path':'ack.json','mode':'100644','type':'blob','sha':git(raw),'size':len(raw)},
          {'path':'request.json','mode':'100644','type':'blob','sha':git(request),'size':len(request)}]}
        commit={'sha':'e'*40,'parents':[],'tree':{'sha':tree['sha']}}
        ref={'ref':c.actual_v9_ack_ref(90,91,head),'object':{'type':'commit','sha':commit['sha']}}
        return [ref,commit,tree,blob],prelude,deadline,inventory,template
    def test_closed_ack_objects_and_all_binding_cuts(self):
        objects,prelude,deadline,inventory,template=self.ack_fixture()
        ack,_=c.actual_v9_ack_objects(*(E(item) for item in objects),prelude,deadline,inventory,template)
        self.assertEqual(ack['jobId'],91)
        for index,mutate in ((0,lambda x:x.update(ref=c.actual_v9_ack_ref(90,92,'a'*40))),
          (1,lambda x:x.update(parents=[{'sha':'f'*40}])),(2,lambda x:x.update(truncated=True)),
          (2,lambda x:x['tree'].pop()),(2,lambda x:x['tree'][1].update(sha='0'*40)),
          (3,lambda x:x.update(content=base64.b64encode(b'changed').decode()))):
            changed=copy.deepcopy(objects);mutate(changed[index])
            with self.assertRaises(ValueError):c.actual_v9_ack_objects(*(E(item) for item in changed),prelude,deadline,inventory,template)
        for key,value in [('runId',91),('jobId',92),('sourceHead','f'*40)]:
            changed=dict(deadline);changed[key]=value
            with self.assertRaises(ValueError):c.actual_v9_ack_objects(*(E(item) for item in objects),prelude,changed,inventory,template)
    def test_job_deadline_and_guest_budget_refuse_expiry(self):
        prelude=self.prelude();env=self.env(prelude)
        clock=c.actual_v9_clock({'schema':'bw.gui-hdd.actual-v9-clock.v1','jobStartedAt':'2026-10-28T12:00:00Z',
          'httpDate':'Wed, 28 Oct 2026 12:00:00 GMT','requestMonotonicNs':2000000000,'responseMonotonicNs':3000000000,
          'requestWallTimeNs':10**18,'responseWallTimeNs':10**18+1000000000},construct=True)
        value={'schema':'bw.gui-hdd.actual-v9-deadline.v1','runId':90,'runAttempt':1,'jobId':91,'sourceHead':'a'*40,
          'startedMonotonicNs':1000000000,'deadlineMonotonicNs':2101000000000,'cleanupReserveSeconds':60,'clock':clock}
        with patch.object(c.time,'monotonic_ns',return_value=4000000000):
            c.actual_v9_deadline(value,prelude,env,91);c.actual_v9_check_remaining(value,1490)
        with patch.object(c.time,'monotonic_ns',return_value=700000000000):
            with self.assertRaises(ValueError):c.actual_v9_check_remaining(value,1490)
        with patch.object(c.time,'monotonic_ns',return_value=2101000000000):
            with self.assertRaises(ValueError):c.actual_v9_deadline(value,prelude,env,91)
    def test_official_clock_accounts_checkout_and_ignores_host_wall_skew(self):
        raw={'schema':'bw.gui-hdd.actual-v9-clock.v1','jobStartedAt':'2026-10-28T12:00:00Z',
          'httpDate':'Wed, 28 Oct 2026 12:02:00 GMT','requestMonotonicNs':500000000000,'responseMonotonicNs':501000000000,
          'requestWallTimeNs':10**18,'responseWallTimeNs':10**18+1000000000}
        clock=c.actual_v9_clock(raw,construct=True);self.assertEqual(clock['elapsedUpperNs'],122000000000)
        skew=copy.deepcopy(raw);skew['responseWallTimeNs']=1
        self.assertEqual(c.actual_v9_clock(skew,construct=True)['elapsedUpperNs'],clock['elapsedUpperNs'])
        for change in ({'jobStartedAt':'2026-10-28T12:03:00Z'},{'httpDate':'not a date'},{'responseMonotonicNs':raw['requestMonotonicNs']-1}):
            changed=dict(raw,**change)
            with self.assertRaises(ValueError):c.actual_v9_clock(changed,construct=True)
    def test_ack_missing_or_failed_phase_never_installs(self):
        with patch.object(c,'ACTUAL_V9_ENABLED',True),patch.object(c,'FINITE_INVENTORY_V10_ENABLED',True),patch.object(c,'actual_v9_read_state',return_value=(self.prelude(),{'deadlineMonotonicNs':10**18})),patch.object(c,'regular',return_value=E({'schema':'bw.gui-hdd.inventory-failure.v10'})),patch.object(c,'install_input') as install:
            with self.assertRaisesRegex(ValueError,'partial inventory'):
                c.actual_v9_wait_ack(pathlib.Path('/manufactured'),self.env(self.prelude()))
            install.assert_not_called()
    def test_current_and_historical_supplier_roles_are_independent(self):
        old=copy.deepcopy(c.FINITE_V9_PINS);witness=copy.deepcopy(c.FINITE_V9_CUI_WITNESSES)
        with patch.object(c,'CUI','0'*40),patch.object(c,'CURRENT_BOARD','1'*40),patch.object(c,'CURRENT_SB3','2'*40):
            self.assertEqual(c.FINITE_V9_PINS,old)
            self.assertEqual(c.FINITE_V9_CUI_WITNESSES,witness)
            self.assertEqual(c.FINITE_V10_PINS['bw-board'],'33d3ee399db9224105e70f34864f1af962ccdb41')
        for mode in ('actual-v9-guard','actual-v9-ack','actual-v9','finite-inventory-v10'):
            with self.assertRaisesRegex(ValueError,'disabled'):
                with patch.object(c,'ACTUAL_V9_ENABLED',False):c.main([mode])
`;

test('finite10 producer: typed resolver, exact same-job dispatch, ACK and deadline controls', () => {
    const suite="suite=unittest.TestSuite(Originals(name) for name in unittest.defaultTestLoader.getTestCaseNames(Originals) if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_')))";
    const selected=controls.replace(suite,producerV10Controls+'\nsuite=unittest.defaultTestLoader.loadTestsFromTestCase(ProducerV10)');
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ''}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=6);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});

test('same-job actual9 producer: connected inventory, ACK, request and exact staging controls', () => {
    const original="suite=unittest.TestSuite(Originals(name) for name in unittest.defaultTestLoader.getTestCaseNames(Originals) if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_')))";
    const selected=controls.replace(original,"suite=unittest.TestSuite(Originals(name) for name in unittest.defaultTestLoader.getTestCaseNames(Originals) if name.startswith(('test_producer_finite_v10','test_producer_actual_v9')))");
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ''}\n${result.stdout}\n${result.stderr}`);
    const summary=readOriginalControlSummary(result.stdout);
    assert.ok(summary.controls>=6);assert.equal(summary.failures,0);assert.equal(summary.errors,0);
});


test('actual v9 parts: bounded raw transport, same-job final parity and coherent refusals', () => {
    const selected=controls.replace("if not name.startswith(('test_finite_v4','test_finite_v6','test_finite_v7','test_finite_v8','test_finite_v9','test_actual_v6_parts_','test_actual_v8_'))", "if name.startswith('test_actual_v9_parts_')");
    assert.notEqual(selected,controls);
    const result=spawnSync('/usr/bin/python3',['-B','-',root],{input:selected,cwd:root,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
    assert.equal(result.status,0,`${result.error?.stack || ""}\nsignal=${result.signal}\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(readOriginalControlSummary(result.stdout),{controls:4,failures:0,errors:0});
});
