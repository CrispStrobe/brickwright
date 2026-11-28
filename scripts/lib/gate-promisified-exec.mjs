// Recognize only the direct, imported promisify(execFile) shape used by a test.
// Refuse shadowing anywhere in the file rather than guessing lexical identity.
import {createRequire} from 'node:module';
import {posix as gatePath} from 'node:path';
const {parse} = createRequire(import.meta.url)('acorn');

const protectedNames = new Set(['execFile', 'promisify', 'process']);
const bindingHasProtectedName = node => {
    if (!node) return false;
    if (node.type === 'Identifier') return protectedNames.has(node.name);
    if (node.type === 'RestElement') return bindingHasProtectedName(node.argument);
    if (node.type === 'AssignmentPattern') return bindingHasProtectedName(node.left);
    if (node.type === 'ArrayPattern') return node.elements.some(bindingHasProtectedName);
    if (node.type === 'ObjectPattern') return node.properties.some(p => bindingHasProtectedName(p.type === 'RestElement' ? p.argument : p.value));
    return false;
};

export function directlyExecutesPromisifiedGate (source, gate) {
    let ast;
    try { ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'}); } catch { return false; }
    let childImport = false, utilImport = false, shadowed = false, found = false;
    const isProgram = argv => {
        if (argv?.type !== 'ArrayExpression') return false;
        const a = argv.elements;
        const first = a[0]?.value === '--import' && a[1]?.value === './scripts/lib/register-gui-scope.mjs' ? 2 : 0;
        return a[first]?.type === 'Literal' && a[first].value === `scripts/${gate}`;
    };
    for (const statement of ast.body) {
        if (statement.type !== 'ImportDeclaration') continue;
        for (const specifier of statement.specifiers) {
            if (!protectedNames.has(specifier.local.name)) continue;
            if (specifier.type === 'ImportSpecifier' && specifier.local.name === 'execFile' && specifier.imported.name === 'execFile' && statement.source.value === 'node:child_process' && !childImport) childImport = true;
            else if (specifier.type === 'ImportSpecifier' && specifier.local.name === 'promisify' && specifier.imported.name === 'promisify' && statement.source.value === 'node:util' && !utilImport) utilImport = true;
            else shadowed = true;
        }
    }
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'VariableDeclarator' && bindingHasProtectedName(node.id)) shadowed = true;
        if (/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type || '') &&
            (bindingHasProtectedName(node.id) || node.params.some(bindingHasProtectedName))) shadowed = true;
        if (node.type === 'CatchClause' && bindingHasProtectedName(node.param)) shadowed = true;
        if (node.type === 'ClassDeclaration' && bindingHasProtectedName(node.id)) shadowed = true;
        if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
            const target = node.left || node.argument;
            if (bindingHasProtectedName(target) || (target?.type === 'MemberExpression' && target.object?.type === 'Identifier' && target.object.name === 'process')) shadowed = true;
        }
        if (node.type === 'CallExpression' && node.callee?.type === 'CallExpression') {
            const inner = node.callee, args = node.arguments;
            const argv = args[1];
            if (inner.callee?.type === 'Identifier' && inner.callee.name === 'promisify' && inner.arguments.length === 1 &&
                inner.arguments[0]?.type === 'Identifier' && inner.arguments[0].name === 'execFile' &&
                args[0]?.type === 'MemberExpression' && !args[0].computed && args[0].object?.name === 'process' && args[0].property?.name === 'execPath' &&
                isProgram(argv)) found = true;
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    };
    visit(ast);
    return childImport && utilImport && !shadowed && found;
}

// Direct child-process coverage is about the actual program argument, not a
// path mentioned elsewhere in a test. This deliberately recognizes a bounded
// set of Node calls and immutable path bindings; unsupported syntax fails
// closed. Test sources are the direct children of test/, as in gate-coverage.
const directGateCache = new Map();
const directChildMethods = new Set(['execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']);
const gateCheckout = '/\0gate-checkout';
const gateTestDirectory = gateCheckout + '/test';
const unknownGateValue = Symbol('unknown gate value');

function analyzeDirectGateSource (source) {
    if (directGateCache.has(source)) return directGateCache.get(source);
    let ast;
    try { ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'}); } catch {
        directGateCache.set(source, null);
        return null;
    }
    const declarations = new Map(), imports = new Map(), constants = new Map();
    const changed = new Set(), memberWrites = [], calls = [];
    let cwdChanged = false, importMetaChanged = false;
    const bind = node => {
        if (!node) return;
        if (node.type === 'Identifier') declarations.set(node.name, (declarations.get(node.name) || 0) + 1);
        else if (node.type === 'RestElement') bind(node.argument);
        else if (node.type === 'AssignmentPattern') bind(node.left);
        else if (node.type === 'ArrayPattern') node.elements.forEach(bind);
        else if (node.type === 'ObjectPattern') node.properties.forEach(p => bind(p.type === 'RestElement' ? p.argument : p.value));
    };
    const changedTarget = node => {
        if (!node) return;
        if (node.type === 'Identifier') changed.add(node.name);
        else if (node.type === 'MemberExpression') memberWrites.push(node);
        else if (node.type === 'RestElement') changedTarget(node.argument);
        else if (node.type === 'AssignmentPattern') changedTarget(node.left);
        else if (node.type === 'ArrayPattern') node.elements.forEach(changedTarget);
        else if (node.type === 'ObjectPattern') node.properties.forEach(p => changedTarget(p.type === 'RestElement' ? p.argument : p.value));
    };
    const visit = (node, parent) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'ImportDeclaration') {
            for (const s of node.specifiers) {
                bind(s.local);
                imports.set(s.local.name, {module: node.source.value,
                    name: s.type === 'ImportSpecifier' ? s.imported.name : '*'});
            }
        }
        if (node.type === 'VariableDeclarator') {
            bind(node.id);
            if (parent.kind === 'const' && node.id.type === 'Identifier') constants.set(node.id.name, node.init);
        }
        if (/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type || '')) {
            bind(node.id);
            node.params.forEach(bind);
        }
        if (node.type === 'CatchClause') bind(node.param);
        if (/^(?:ClassDeclaration|ClassExpression)$/.test(node.type || '')) bind(node.id);
        if (node.type === 'AssignmentExpression') changedTarget(node.left);
        if (node.type === 'UpdateExpression') changedTarget(node.argument);
        if (node.type === 'UnaryExpression' && node.operator === 'delete') changedTarget(node.argument);
        if (node.type === 'CallExpression') calls.push(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => visit(child, node));
            else if (value && typeof value === 'object') visit(value, node);
        }
    };
    visit(ast, null);
    // An alias of an imported object is the same object when one of its
    // properties is overwritten. Resolve only direct immutable aliases.
    const originalName = (name, seen = new Set()) => {
        if (seen.has(name) || declarations.get(name) > 1) return name;
        seen.add(name);
        const init = constants.get(name);
        return init?.type === 'Identifier' ? originalName(init.name, seen) : name;
    };
    for (const member of memberWrites) {
        let base = member;
        while (base.object?.type === 'MemberExpression') base = base.object;
        let owner = base.object;
        if (owner?.type === 'Identifier') {
            const name = originalName(owner.name);
            if (constants.get(name)?.type === 'MetaProperty') owner = constants.get(name);
        }
        if (owner?.type === 'MetaProperty' && owner.meta.name === 'import' && owner.property.name === 'meta') {
            importMetaChanged = true;
            continue;
        }
        if (base.object?.type !== 'Identifier') continue;
        const name = originalName(base.object.name);
        const imported = imports.get(name);
        const isProcess = name === 'process' && !declarations.has(name) ||
            imported?.module === 'node:process' && imported.name === '*';
        // Changing process.env does not change the Node executable identity.
        if (isProcess && !base.computed && base.property.name === 'env') continue;
        changed.add(name);
    }
    const knownModule = value => ({kind: 'module', ...value});
    const valueOf = (node, seen = new Set()) => {
        if (!node) return unknownGateValue;
        if (node.type === 'Literal') return typeof node.value === 'string' && !node.value.includes('\0') ? node.value : unknownGateValue;
        if (node.type === 'Identifier') {
            const name = node.name;
            if (seen.has(name) || changed.has(name) || declarations.get(name) > 1) return unknownGateValue;
            if (name === 'process' && !declarations.has(name)) return knownModule({module: 'node:process', name: '*'});
            if (imports.has(name)) return knownModule(imports.get(name));
            if (!constants.has(name)) return unknownGateValue;
            return valueOf(constants.get(name), new Set([...seen, name]));
        }
        if (node.type === 'MemberExpression') {
            const property = node.computed
                ? node.property.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : null
                : node.property.name;
            if (property === null) return unknownGateValue;
            if (node.object?.type === 'MetaProperty' && node.object.meta.name === 'import' && node.object.property.name === 'meta') {
                if (importMetaChanged) return unknownGateValue;
                if (property === 'dirname') return gateTestDirectory;
                if (property === 'filename') return gateTestDirectory + '/gate.test.mjs';
                if (property === 'url') return {kind: 'file-url', path: gateTestDirectory + '/gate.test.mjs'};
            }
            const object = valueOf(node.object, seen);
            if (object?.kind !== 'module' || object.name !== '*') return unknownGateValue;
            if (object.module === 'node:process' && property === 'execPath') return {kind: 'node-executable'};
            return knownModule({module: object.module, name: property});
        }
        if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'URL' &&
            !declarations.has('URL') && !changed.has('URL') && node.arguments.length === 2) {
            const relative = valueOf(node.arguments[0], seen), base = valueOf(node.arguments[1], seen);
            if (typeof relative !== 'string' || /^(?:[a-z]+:|\/)/i.test(relative) || base?.kind !== 'file-url') return unknownGateValue;
            return {kind: 'file-url', path: gatePath.resolve(gatePath.dirname(base.path), relative)};
        }
        if (node.type === 'CallExpression') {
            const callee = valueOf(node.callee, seen);
            if (callee?.kind !== 'module') return unknownGateValue;
            const args = node.arguments.map(arg => valueOf(arg, seen));
            if (callee.module === 'node:url' && callee.name === 'fileURLToPath' && args.length === 1 && args[0]?.kind === 'file-url') return args[0].path;
            if (callee.module === 'node:process' && callee.name === 'cwd' && args.length === 0) return cwdChanged ? unknownGateValue : gateCheckout;
            if (callee.module !== 'node:path' || !['join', 'resolve', 'dirname'].includes(callee.name) ||
                !args.length || !args.every(arg => typeof arg === 'string')) return unknownGateValue;
            if (callee.name === 'dirname') return args.length === 1 ? gatePath.dirname(args[0]) : unknownGateValue;
            if (callee.name === 'resolve' && cwdChanged && !args.some(arg => gatePath.isAbsolute(arg))) return unknownGateValue;
            return callee.name === 'resolve' ? gatePath.resolve(gateCheckout, ...args) : gatePath.join(...args);
        }
        return unknownGateValue;
    };
    cwdChanged = calls.some(call => {
        const callee = valueOf(call.callee);
        return callee?.kind === 'module' && callee.module === 'node:process' && callee.name === 'chdir';
    });
    // Only literal objects or immutable direct aliases are known options.
    // Spreads, accessors and prototype injection can replace cwd/execPath.
    const boundNode = (node, seen = new Set()) => {
        if (node?.type !== 'Identifier') return node;
        if (seen.has(node.name) || changed.has(node.name) || declarations.get(node.name) !== 1 ||
            !constants.has(node.name)) return null;
        return boundNode(constants.get(node.name), new Set([...seen, node.name]));
    };
    const optionProperties = node => {
        if (!node || node.type === 'Identifier' && node.name === 'undefined' && !declarations.has('undefined')) return new Map();
        const object = boundNode(node);
        if (object?.type !== 'ObjectExpression') return null;
        const properties = new Map();
        for (const p of object.properties) {
            if (p.type !== 'Property' || p.computed || p.method || p.kind !== 'init') return null;
            const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
            if (typeof key !== 'string' || key === '__proto__' || properties.has(key)) return null;
            properties.set(key, p.value);
        }
        return properties;
    };
    const result = {calls, valueOf, boundNode, optionProperties, cwdChanged};
    directGateCache.set(source, result);
    return result;
}

export function directlyExecutesChildProcessGate (source, gate) {
    const facts = analyzeDirectGateSource(source);
    if (!facts) return false;
    const isNode = value => value?.kind === 'node-executable' || value === 'node';
    const isPath = (value, options) => {
        const program = value?.kind === 'file-url' ? value.path : value;
        if (typeof program !== 'string') return false;
        const canonical = gatePath.join(gateCheckout, 'scripts', gate);
        if (gatePath.isAbsolute(program)) return gatePath.normalize(program) === canonical;
        let cwd = facts.cwdChanged ? unknownGateValue : gateCheckout;
        if (options.has('cwd')) {
            const value = facts.valueOf(options.get('cwd'));
            cwd = value?.kind === 'file-url' ? value.path : value;
            if (typeof cwd !== 'string') return false;
            if (!gatePath.isAbsolute(cwd)) {
                if (facts.cwdChanged) return false;
                cwd = gatePath.resolve(gateCheckout, cwd);
            }
        }
        return typeof cwd === 'string' && gatePath.resolve(cwd, program) === canonical;
    };
    const programArgument = argv => {
        if (argv?.type !== 'ArrayExpression') return unknownGateValue;
        const args = argv.elements;
        for (let i = 0; i < args.length; i++) {
            const value = facts.valueOf(args[i]);
            if (typeof value !== 'string') return unknownGateValue;
            if (value === '--') return facts.valueOf(args[i + 1]);
            if (['--import', '--require', '-r', '--loader', '--experimental-loader'].includes(value)) {
                if (typeof facts.valueOf(args[++i]) !== 'string') return unknownGateValue;
                continue;
            }
            if (/^--(?:import|require|loader|experimental-loader)=.+$/.test(value) ||
                /^(?:--no-warnings|--experimental-strip-types|--experimental-default-type=module|--disable-warning=.+)$/.test(value)) continue;
            if (value.startsWith('-')) return unknownGateValue;
            return value;
        }
        return unknownGateValue;
    };
    const directOptions = options => !options?.has('shell') ||
        options.get('shell')?.type === 'Literal' && options.get('shell').value === false;
    return facts.calls.some(call => {
        const method = facts.valueOf(call.callee);
        if (method?.kind !== 'module' || method.module !== 'node:child_process' || !directChildMethods.has(method.name)) return false;
        if (method.name === 'fork') {
            const argv = facts.boundNode(call.arguments[1]);
            const options = facts.optionProperties(argv?.type === 'ArrayExpression' ? call.arguments[2] : call.arguments[1]);
            if (!options || !directOptions(options) ||
                options.has('execPath') && !isNode(facts.valueOf(options.get('execPath')))) return false;
            if (options.has('execArgv')) {
                const args = options.get('execArgv');
                if (args.type !== 'ArrayExpression' || args.elements.length !== 0) return false;
            }
            return isPath(facts.valueOf(call.arguments[0]), options);
        }
        const executable = facts.valueOf(call.arguments[0]);
        if (!isNode(executable)) return false;
        const third = call.arguments[2];
        const callbackOnly = method.name === 'execFile' &&
            ['FunctionExpression', 'ArrowFunctionExpression'].includes(third?.type);
        const options = facts.optionProperties(callbackOnly ? null : third);
        return !!options && directOptions(options) && isPath(programArgument(call.arguments[1]), options);
    });
}
