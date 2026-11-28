import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {bindGuiHarnessGit, inspectGuiHarnessSource} from '../scripts/lib/gui-harness-source.mjs';

// Explicit test-platform binding; never fall back to a PATH-resolved command.
const executable = process.env.BW_GUI_GIT_EXECUTABLE || '/usr/bin/git';
test('source attestation refuses omitted, relative and non-file executable bindings', () => {
    for (const inspect of [bindGuiHarnessGit, inspectGuiHarnessSource]) {
        for (const input of [undefined, 'git', './git']) assert.throws(() => inspect({root:process.cwd(),executable:input}), /absolute Git executable/);
    }
    assert.throws(() => inspectGuiHarnessSource({root:process.cwd(),executable:os.tmpdir()}), /regular file/);
});
test('explicit Git identity attests the actual clean checkout and rejects tracked edits', async () => {
    const root=await mkdtemp(path.join(os.tmpdir(),'owned-gui-source-'));
    const options={cwd:root,encoding:'utf8'};
    try {
        execFileSync(executable,['init','--quiet'],options);
        await writeFile(path.join(root,'owned.txt'),'reviewed\n');
        execFileSync(executable,['add','owned.txt'],options);
        execFileSync(executable,['-c','user.name=Owned test','-c','user.email=owned@example.invalid','commit','--quiet','-m','Owned fixture'],options);
        const observed=inspectGuiHarnessSource({root,executable});
        assert.equal(observed.sourceSha,execFileSync(executable,['rev-parse','HEAD'],options).trim());
        assert.match(observed.tool.version,/^git version /);
        assert.equal(observed.tool.sha256,createHash('sha256').update(await readFile(observed.tool.absolutePath)).digest('hex'));
        const inherited={GIT_DIR:process.env.GIT_DIR,GIT_WORK_TREE:process.env.GIT_WORK_TREE};
        try {
            process.env.GIT_DIR=path.join(root,'not-a-repository');process.env.GIT_WORK_TREE=os.tmpdir();
            assert.equal(inspectGuiHarnessSource({root,executable}).sourceSha,observed.sourceSha,'ambient repository overrides cannot redirect the actual checkout');
        } finally {for(const [key,value] of Object.entries(inherited)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
        await writeFile(path.join(root,'owned.txt'),'different\n');
        assert.throws(()=>inspectGuiHarnessSource({root,executable}),/tracked source must match/);
        // An experimental candidate deliberately has a tracked patch. The same
        // concrete tool binding must expose that patch without weakening the
        // ordinary clean-harness attestation above.
        const candidate = bindGuiHarnessGit({root, executable});
        assert.deepEqual(candidate.tool, observed.tool);
        assert.equal(candidate.run(['show', 'HEAD:owned.txt']), 'reviewed\n');
        const patch = candidate.run(['diff', '--no-ext-diff', '--binary', 'HEAD', '--']);
        assert.match(patch, /-reviewed\n\+different/);
        assert.throws(()=>bindGuiHarnessGit({root:path.dirname(root),executable}), /Git must inspect|not a git repository/,
            'a path outside the admitted checkout cannot borrow its source identity');
    } finally {await rm(root,{recursive:true,force:true});}
});

test('the official numeric harness installs the locked GUI without rewriting source', async () => {
    const workflow = await readFile(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8');
    const start = workflow.indexOf('      - name: Install the declared GUI dependencies\n');
    const end = workflow.indexOf('      - name: Apply the scratch-vm overlay\n', start);
    assert.ok(start >= 0 && end > start, 'numeric harness dependency-install boundary exists');
    const install = workflow.slice(start, end);
    assert.match(install, /npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund/);
    assert.match(install, /git diff --exit-code -- packages\/scratch-gui\/package\.json packages\/scratch-gui\/package-lock\.json/);
    assert.match(install, /sha256sum --check/);
    assert.doesNotMatch(install, /git (?:checkout|restore|reset)/, 'the guard must not conceal a changed lock');
});
