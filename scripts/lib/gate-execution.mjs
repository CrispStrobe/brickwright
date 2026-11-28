// Static execution provenance for browser-gate coverage. This reads syntax; it
// never imports or evaluates a test or its local helpers as JavaScript.
// Supported values are literals, immutable arrays/objects, Node path builders,
// local functions, node:test callbacks and finite for-of/array callback flows.
// Unknown values, mutation and recursive call cycles receive no execution credit.
import {readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {parse} = createRequire(import.meta.url)('acorn');

const UNKNOWN = Symbol('unknown');
const NODE = Symbol('node executable');
const THROWN = Symbol('explicit throw');
const ASTS = new Map();
const RESULTS = new Map();
const parseSource = source => {
    if (!ASTS.has(source)) {
        let ast = null;
        try { ast = parse(source, {ecmaVersion: 'latest', sourceType: 'module'}); } catch {}
        ASTS.set(source, ast);
    }
    return ASTS.get(source);
};
const builtin = name => ({kind: 'builtin', name});
const object = (fields, unknownFields = false) => ({kind: 'object', fields, unknownFields});
const array = items => ({kind: 'array', items});
const fn = (node, scope, module) => ({kind: 'function', node, scope, module});
const namespaces = new Set(['node:test', 'node:assert', 'node:assert/strict',
    'node:child_process', 'node:path', 'node:url', 'node:process']);
const coreName = name => name.startsWith('node:') ? name : 'node:' + name;
const callbackMethods = new Set(['test', 'it', 'describe', 'before', 'after', 'beforeEach', 'afterEach']);
const spawners = new Set(['execFileSync', 'execFile', 'spawnSync', 'spawn']);
const mutations = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift']);

class Scope {
    constructor(parent = null, boundary = false) {
        this.parent = parent; this.values = new Map();
        this.functionScope = boundary || !parent ? this : parent.functionScope;
    }
    get(name) { return this.values.has(name) ? this.values.get(name) : this.parent?.get(name) ?? UNKNOWN; }
    set(name, value) { this.values.set(name, value); }
}

export function directlyExecutesGate(source, gate, options = {}) {
    if (typeof source !== 'string' || typeof gate !== 'string' ||
        path.basename(gate) !== gate || !source.includes(gate)) return false;
    const root = path.resolve(options.root || '/repository');
    const filename = path.resolve(options.filename || path.join(root, 'test/fixture.test.mjs'));
    const key = root + '\0' + filename + '\0' + gate + '\0' + source;
    if (!options.loadModule && RESULTS.has(key)) return RESULTS.get(key);
    const target = path.join(root, 'scripts', gate);
    const modules = new Map(), active = new Set(), invalid = new WeakSet();
    const load = options.loadModule || (file => {
        const realRoot = realpathSync(root), realFile = realpathSync(file);
        if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep))
            throw new Error('Local helper resolves outside the repository');
        return readFileSync(realFile, 'utf8');
    });
    let found = false;
    let currentCwd = root;
    const clean = value => value && typeof value === 'object' && invalid.has(value) ? UNKNOWN : value;
    const invalidate = value => { if (value && typeof value === 'object') invalid.add(value); };
    const inside = file => file === root || file.startsWith(root + path.sep);
    const isGatePath = (value, cwd = currentCwd) => {
        if (typeof value !== 'string') return false;
        if (path.isAbsolute(value)) return path.normalize(value) === target;
        if (typeof cwd !== 'string') return false;
        if (!path.isAbsolute(cwd)) {
            if (typeof currentCwd !== 'string') return false;
            cwd = path.resolve(currentCwd, cwd);
        }
        return path.resolve(cwd, value) === target;
    };

    const visit = (node, callback) => {
        if (!node || typeof node !== 'object') return;
        callback(node);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(x => visit(x, callback));
            else if (value && typeof value === 'object') visit(value, callback);
        }
    };
    const assignedNames = ast => {
        const names = new Set();
        const mark = pattern => {
            if (!pattern) return;
            if (pattern.type === 'Identifier') names.add(pattern.name);
            else if (pattern.type === 'MemberExpression') {
                // Changes to process.env do not change the Node executable.
                if (pattern.object.type === 'Identifier' && pattern.object.name === 'process' &&
                    !pattern.computed && pattern.property.name === 'env') return;
                let base = pattern;
                while (base.type === 'MemberExpression') base = base.object;
                if (base.type === 'Identifier') names.add(base.name);
            } else visit(pattern, n => { if (n.type === 'Identifier') names.add(n.name); });
        };
        visit(ast, node => {
            if (node.type === 'AssignmentExpression') mark(node.left);
            if (node.type === 'UpdateExpression') mark(node.argument);
        });
        return names;
    };
    const moduleFor = (file, supplied) => {
        if (modules.has(file)) return modules.get(file);
        let text;
        try { text = supplied ?? load(file); } catch { return null; }
        if (typeof text !== 'string') return null;
        const ast = parseSource(text);
        if (!ast) return null;
        const module = {file, ast, scope: new Scope(), assigned: assignedNames(ast), exports: new Map()};
        modules.set(file, module);
        module.scope.set('process', builtin('node:process'));
        module.scope.set('URL', builtin('URL'));
        return module;
    };
    const member = (value, name) => {
        value = clean(value);
        if (value?.kind === 'object') return clean(value.fields.get(name) ?? UNKNOWN);
        if (value?.kind === 'array') {
            if (name === 'length') return value.items.length;
            if (/^(?:0|[1-9][0-9]*)$/.test(String(name))) return clean(value.items[Number(name)] ?? UNKNOWN);
            return {kind: 'array-method', owner: value, name};
        }
        if (value?.kind === 'builtin') {
            if (value.name === 'node:process') {
                if (name === 'execPath') return NODE;
                if (name === 'cwd' || name === 'chdir') return builtin(name);
                return UNKNOWN;
            }
            if (value.name === 'test-context' && callbackMethods.has(name)) return builtin('test-callback');
            if (value.name === 'node:test' && callbackMethods.has(name)) return builtin('test-callback');
            if (value.name === 'test-callback' && ['only', 'skip', 'todo'].includes(name))
                return builtin(name === 'only' ? 'test-callback' : 'ignored-callback');
            if (value.name === 'node:assert' || value.name === 'node:assert/strict') return builtin('assert:' + name);
            if (['node:child_process', 'node:path', 'node:url'].includes(value.name))
                return builtin(value.name + ':' + name);
        }
        return UNKNOWN;
    };
    const bind = (pattern, value, scope, module) => {
        if (!pattern) return;
        if (pattern.type === 'Identifier') scope.set(pattern.name, clean(value));
        else if (pattern.type === 'AssignmentPattern')
            bind(pattern.left, value === undefined ? expression(pattern.right, scope, module) : value, scope, module);
        else if (pattern.type === 'RestElement') bind(pattern.argument, value, scope, module);
        else if (pattern.type === 'ObjectPattern') {
            for (const p of pattern.properties) {
                if (p.type === 'RestElement') { bind(p.argument, UNKNOWN, scope, module); continue; }
                const name = p.computed ? expression(p.key, scope, module) : p.key.name ?? p.key.value;
                bind(p.value, member(value, name), scope, module);
            }
        } else if (pattern.type === 'ArrayPattern') {
            pattern.elements.forEach((p, i) => bind(p,
                p?.type === 'RestElement' && value?.kind === 'array' ?
                    array(value.items.slice(i)) : member(value, i), scope, module));
        }
    };
    const imported = (specifier, name, module) => {
        const core = coreName(specifier);
        if (namespaces.has(core)) {
            if (name === '*' || name === 'default') return core === 'node:test' && name === 'default' ? builtin('test-callback') : builtin(core);
            return member(builtin(core), name);
        }
        if (!specifier.startsWith('.')) return UNKNOWN;
        const file = path.resolve(path.dirname(module.file), specifier);
        return inside(file) ? {kind: 'import', file, name} : UNKNOWN;
    };
    const hoistVars = (node, scope, module) => {
        if (!node || typeof node !== 'object' || /^(?:Function|ArrowFunction)/.test(node.type || '')) return;
        if (node.type === 'VariableDeclaration' && node.kind === 'var') for (const d of node.declarations) {
            const declared = new Scope();
            bind(d.id, UNKNOWN, declared, module);
            for (const name of declared.values.keys()) if (!scope.values.has(name)) scope.set(name, UNKNOWN);
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(n => hoistVars(n, scope, module));
            else if (value && typeof value === 'object') hoistVars(value, scope, module);
        }
    };
    const initialize = module => {
        if (!module || module.initialized) return;
        module.initialized = true;
        hoistVars(module.ast, module.scope, module);
        try { module.failed = block(module.ast.body, module.scope, module)?.kind === 'throw'; }
        catch (error) { if (error !== THROWN) throw error; module.failed = true; }
    };
    const resolveImport = value => {
        if (value?.kind !== 'import') return value;
        const importedModule = moduleFor(value.file);
        initialize(importedModule);
        if (!importedModule || importedModule.failed) return UNKNOWN;
        const exported = importedModule.exports.get(value.name);
        return typeof exported === 'string' ? importedModule.scope.get(exported) : exported ?? UNKNOWN;
    };
    const nodeEntry = argv => {
        if (argv?.kind !== 'array') return UNKNOWN;
        for (let i = 0; i < argv.items.length; i++) {
            const value = argv.items[i];
            if (typeof value !== 'string') return UNKNOWN;
            if (value === '--') return argv.items[i + 1] ?? UNKNOWN;
            if (['--import', '--require', '-r', '--loader'].includes(value)) {
                if (typeof argv.items[++i] !== 'string') return UNKNOWN;
                continue;
            }
            if (value.startsWith('--import=') || value.startsWith('--require=')) continue;
            if (['--no-warnings', '--trace-warnings', '--enable-source-maps', '--test'].includes(value)) continue;
            if (value.startsWith('-')) return UNKNOWN;
            return value;
        }
        return UNKNOWN;
    };
    const childCall = (name, args) => {
        const opts = name === 'fork' && args[1] !== undefined && args[1]?.kind !== 'array' ? args[1] : args[2];
        const option = field => opts === undefined ? undefined : opts?.kind === 'object' ?
            opts.fields.has(field) ? member(opts, field) : opts.unknownFields ? UNKNOWN : undefined : UNKNOWN;
        // Only a proven direct child launch earns credit; a shell can interpret
        // the executable/arguments, and unknown options may select a shell.
        const shell = option('shell');
        if (shell !== undefined && shell !== false) return UNKNOWN;
        const selectedCwd = option('cwd'), cwd = selectedCwd === undefined ? currentCwd : selectedCwd;
        if (name === 'fork') {
            const executable = option('execPath'), execArgv = option('execArgv');
            const entry = execArgv === undefined ? args[0] :
                execArgv?.kind === 'array' ? nodeEntry(array([...execArgv.items, args[0]])) : UNKNOWN;
            if ((executable === undefined || executable === NODE || executable === 'node') && isGatePath(entry, cwd)) found = true;
            return UNKNOWN;
        }
        if (spawners.has(name) && (args[0] === NODE || args[0] === 'node') &&
            isGatePath(nodeEntry(args[1]), cwd)) found = true;
        // Shell commands are deliberately not inferred from a substring. Existing
        // shell-only callers must be represented by their real executable flow.
        return UNKNOWN;
    };
    const call = (callee, args, scope, module) => {
        callee = clean(callee);
        if (callee?.kind === 'import') callee = resolveImport(callee);
        if (callee?.kind === 'function') {
            if (active.has(callee.node)) return UNKNOWN;
            active.add(callee.node);
            const local = new Scope(callee.scope, true);
            try {
                callee.node.params.forEach((p, i) => bind(p,
                    p.type === 'RestElement' ? array(args.slice(i)) : args[i], local, callee.module));
                hoistVars(callee.node.body, local, callee.module);
                if (callee.node.body.type !== 'BlockStatement') return expression(callee.node.body, local, callee.module);
                const result = block(callee.node.body.body, local, callee.module);
                if (result?.kind === 'throw') throw THROWN;
                return result?.value ?? UNKNOWN;
            } finally { active.delete(callee.node); }
        }
        if (callee?.kind === 'array-method') {
            const {owner, name} = callee;
            if (invalid.has(owner)) return UNKNOWN;
            if (mutations.has(name)) { invalidate(owner); return UNKNOWN; }
            if (['forEach', 'map', 'flatMap', 'some', 'every', 'filter'].includes(name)) {
                const values = [];
                for (let i = 0; i < owner.items.length; i++) {
                    if (invalid.has(owner)) return UNKNOWN;
                    const value = call(args[0], [owner.items[i], i, owner], scope, module);
                    values.push(value);
                    if (name === 'some' || name === 'every') {
                        if (value === UNKNOWN) return UNKNOWN;
                        if (name === 'some' && value) return true;
                        if (name === 'every' && !value) return false;
                    }
                }
                return name === 'map' ? array(values) : name === 'some' ? false : name === 'every' ? true : UNKNOWN;
            }
            return UNKNOWN;
        }
        if (callee?.kind === 'builtin') {
            const name = callee.name;
            if (name.startsWith('node:child_process:')) return childCall(name.slice('node:child_process:'.length), args);
            if (name === 'cwd') return currentCwd;
            if (name === 'chdir') { currentCwd = UNKNOWN; return UNKNOWN; }
            if (name === 'test-callback') {
                const options = args.find(x => x?.kind === 'object');
                const skip = options && member(options, 'skip');
                if (skip !== UNKNOWN && skip) return UNKNOWN;
                for (const arg of args) if (arg?.kind === 'function') call(arg, [builtin('test-context')], scope, module);
                return UNKNOWN;
            }
            if (name === 'ignored-callback') return UNKNOWN;
            if (name.startsWith('assert:')) {
                if (['assert:throws', 'assert:doesNotThrow', 'assert:rejects', 'assert:doesNotReject'].includes(name))
                    call(args[0], [], scope, module);
                return UNKNOWN;
            }
            if (name.startsWith('node:path:') && args.every(x => typeof x === 'string')) {
                const op = name.slice('node:path:'.length);
                if (op === 'resolve') {
                    if (args.some(value => path.isAbsolute(value))) return path.resolve(root, ...args);
                    return typeof currentCwd === 'string' ? path.resolve(currentCwd, ...args) : UNKNOWN;
                }
                if (op === 'join') return path.join(...args);
                if (op === 'dirname' && args.length === 1) return path.dirname(args[0]);
                if (op === 'normalize' && args.length === 1) return path.normalize(args[0]);
            }
            if (name === 'node:url:fileURLToPath' && typeof args[0] === 'string') {
                try { return fileURLToPath(args[0]); } catch { return UNKNOWN; }
            }
            if (name === 'URL' && args.every(x => typeof x === 'string')) {
                try { return new URL(...args).href; } catch { return UNKNOWN; }
            }
        }
        // An unknown callee is not evidence that it invokes callback arguments.
        args.forEach(invalidate);
        return UNKNOWN;
    };
    const expression = (node, scope, module) => {
        if (!node) return undefined;
        switch (node.type) {
        case 'Literal': return node.value;
        case 'Identifier': return module.assigned.has(node.name) ? UNKNOWN : clean(scope.get(node.name));
        case 'MetaProperty': return node.meta.name === 'import' ? object(new Map([
            ['dirname', path.dirname(module.file)], ['url', 'file://' + module.file]
        ])) : UNKNOWN;
        case 'MemberExpression': return member(expression(node.object, scope, module),
            node.computed ? expression(node.property, scope, module) : node.property.name);
        case 'ChainExpression': return expression(node.expression, scope, module);
        case 'AwaitExpression': return expression(node.argument, scope, module);
        case 'ArrowFunctionExpression': case 'FunctionExpression': return fn(node, scope, module);
        case 'ArrayExpression': {
            const items = [];
            for (const e of node.elements) {
                if (e?.type === 'SpreadElement') {
                    const v = expression(e.argument, scope, module);
                    items.push(...(v?.kind === 'array' ? v.items : [UNKNOWN]));
                } else items.push(expression(e, scope, module));
            }
            return array(items);
        }
        case 'ObjectExpression': {
            const fields = new Map();
            let unknownFields = false;
            const uncertain = () => {
                unknownFields = true;
                for (const key of fields.keys()) fields.set(key, UNKNOWN);
            };
            for (const p of node.properties) {
                if (p.type === 'SpreadElement') {
                    const v = expression(p.argument, scope, module);
                    if (v?.kind !== 'object' || v.unknownFields) uncertain();
                    if (v?.kind === 'object') for (const [key, value] of v.fields) fields.set(key, value);
                } else {
                    const key = p.computed ? expression(p.key, scope, module) : p.key.name ?? p.key.value;
                    const value = expression(p.value, scope, module);
                    if (key === UNKNOWN) uncertain();
                    // A literal prototype setter supplies inherited options; it
                    // is not an own field whose absent cwd/shell imply defaults.
                    else if (key === '__proto__' && !p.computed && !p.shorthand && !p.method && p.kind === 'init') unknownFields = true;
                    else fields.set(key, value);
                }
            }
            return object(fields, unknownFields);
        }
        case 'CallExpression': case 'NewExpression': {
            const callee = expression(node.callee, scope, module), args = [];
            for (const arg of node.arguments) {
                if (arg.type === 'SpreadElement') {
                    const v = expression(arg.argument, scope, module);
                    args.push(...(v?.kind === 'array' ? v.items : [UNKNOWN]));
                } else args.push(expression(arg, scope, module));
            }
            return call(callee, args, scope, module);
        }
        case 'TemplateLiteral': {
            let value = node.quasis[0].value.cooked;
            for (let i = 0; i < node.expressions.length; i++) {
                const part = expression(node.expressions[i], scope, module);
                if (!['string', 'number', 'boolean'].includes(typeof part)) return UNKNOWN;
                value += String(part) + node.quasis[i + 1].value.cooked;
            }
            return value;
        }
        case 'BinaryExpression': {
            const a = expression(node.left, scope, module), b = expression(node.right, scope, module);
            if (a === UNKNOWN || b === UNKNOWN) return UNKNOWN;
            if (node.operator === '+' && ['string', 'number'].includes(typeof a) && ['string', 'number'].includes(typeof b)) return a + b;
            if (node.operator === '===' || node.operator === '==') return a === b;
            if (node.operator === '!==' || node.operator === '!=') return a !== b;
            return UNKNOWN;
        }
        case 'UnaryExpression': {
            const value = expression(node.argument, scope, module);
            return node.operator === '!' && value !== UNKNOWN ? !value : UNKNOWN;
        }
        case 'LogicalExpression': {
            const left = expression(node.left, scope, module);
            if (left !== UNKNOWN) {
                if (node.operator === '&&') return left ? expression(node.right, scope, module) : left;
                if (node.operator === '||') return left ? left : expression(node.right, scope, module);
                if (node.operator === '??') return left == null ? expression(node.right, scope, module) : left;
            }
            expression(node.right, scope, module);
            return UNKNOWN;
        }
        case 'ConditionalExpression': {
            const condition = expression(node.test, scope, module);
            if (condition !== UNKNOWN) return expression(condition ? node.consequent : node.alternate, scope, module);
            expression(node.consequent, scope, module); expression(node.alternate, scope, module);
            return UNKNOWN;
        }
        case 'SequenceExpression': {
            let value;
            for (const e of node.expressions) value = expression(e, scope, module);
            return value;
        }
        case 'AssignmentExpression': {
            if (node.left.type === 'MemberExpression') {
                const original = n => n.type === 'Identifier' ? scope.get(n.name) :
                    n.type === 'MemberExpression' ? member(original(n.object),
                        n.computed ? expression(n.property, scope, module) : n.property.name) : UNKNOWN;
                invalidate(original(node.left.object));
            }
            return expression(node.right, scope, module);
        }
        case 'UpdateExpression': return UNKNOWN;
        default: return UNKNOWN;
        }
    };
    const statement = (node, scope, module) => {
        if (!node) return null;
        switch (node.type) {
        case 'ImportDeclaration':
            for (const s of node.specifiers) scope.set(s.local.name, imported(node.source.value,
                s.type === 'ImportNamespaceSpecifier' ? '*' : s.type === 'ImportDefaultSpecifier' ? 'default' : s.imported.name, module));
            break;
        case 'VariableDeclaration':
            for (const d of node.declarations) bind(d.id, expression(d.init, scope, module),
                node.kind === 'var' ? scope.functionScope : scope, module);
            break;
        case 'FunctionDeclaration': scope.set(node.id.name, fn(node, scope, module)); break;
        case 'ExpressionStatement': expression(node.expression, scope, module); break;
        case 'BlockStatement': return block(node.body, new Scope(scope), module);
        case 'ReturnStatement': return {kind: 'return', value: expression(node.argument, scope, module)};
        case 'ThrowStatement': expression(node.argument, scope, module); return {kind: 'throw', value: UNKNOWN};
        case 'BreakStatement': return {kind: 'break', label: node.label?.name};
        case 'ContinueStatement': return {kind: 'continue', label: node.label?.name};
        case 'IfStatement': {
            const condition = expression(node.test, scope, module);
            if (condition !== UNKNOWN) return statement(condition ? node.consequent : node.alternate, scope, module);
            const a = statement(node.consequent, new Scope(scope), module);
            const b = statement(node.alternate, new Scope(scope), module);
            return a && b ? {kind: a.kind, value: UNKNOWN} : null;
        }
        case 'ForOfStatement': {
            const values = expression(node.right, scope, module);
            if (values?.kind !== 'array') break;
            for (const value of values.items) {
                if (invalid.has(values)) break;
                const local = new Scope(scope);
                const binding = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left;
                bind(binding, value, node.left.kind === 'var' ? scope.functionScope : local, module);
                const result = statement(node.body, local, module);
                if (result?.kind === 'break' && !result.label) break;
                if (result?.kind === 'continue' && !result.label) continue;
                if (result) return result;
            }
            break;
        }
        case 'TryStatement': {
            let result;
            try { result = statement(node.block, scope, module); }
            catch (error) { if (error !== THROWN) throw error; result = {kind: 'throw', value: UNKNOWN}; }
            if (node.handler && result?.kind === 'throw') {
                const local = new Scope(scope);
                bind(node.handler.param, UNKNOWN, local, module);
                result = statement(node.handler.body, local, module);
            }
            if (node.finalizer) {
                const final = statement(node.finalizer, scope, module);
                if (final) return final;
            }
            return result;
        }
        case 'ExportNamedDeclaration':
            if (node.declaration) {
                statement(node.declaration, scope, module);
                if (node.declaration.type === 'FunctionDeclaration') module.exports.set(node.declaration.id.name, node.declaration.id.name);
                if (node.declaration.type === 'VariableDeclaration') for (const d of node.declaration.declarations)
                    if (d.id.type === 'Identifier') module.exports.set(d.id.name, d.id.name);
            }
            for (const s of node.specifiers) module.exports.set(s.exported.name, s.local.name);
            break;
        case 'ExportDefaultDeclaration':
            module.exports.set('default', node.declaration.type === 'FunctionDeclaration' ?
                fn(node.declaration, scope, module) : expression(node.declaration, scope, module));
            break;
        }
        return null;
    };
    const block = (body, scope, module) => {
        for (const n of body) {
            const declaration = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
            if (declaration?.type === 'VariableDeclaration' && declaration.kind !== 'var')
                for (const d of declaration.declarations) bind(d.id, UNKNOWN, scope, module);
            if (n.type === 'FunctionDeclaration') scope.set(n.id.name, fn(n, scope, module));
            if (n.type === 'ImportDeclaration') statement(n, scope, module);
        }
        for (const n of body) { const result = statement(n, scope, module); if (result) return result; }
        return null;
    };

    const main = moduleFor(filename, source);
    initialize(main);
    if (!options.loadModule) RESULTS.set(key, found);
    return found;
}
