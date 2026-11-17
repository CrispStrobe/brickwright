// Recognize only the direct, imported promisify(execFile) shape used by a test.
// Refuse shadowing anywhere in the file rather than guessing lexical identity.
import {createRequire} from 'node:module';
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
