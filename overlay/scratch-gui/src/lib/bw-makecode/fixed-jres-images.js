import {parseMakeCodeTs, tokenize} from './ts-import.js';
import {staticSdkNamespaceReceivers} from './static-sdk-namespaces.js';
import {decodeMkcdImage} from './arcade-assets.js';
import {toImgLiteral} from './pixel-image.js';

const parseOptions = {parameterDefaults:true, retainParentheses:true, retainWhenUsed:true,
    retainClassHeritage:true, retainCallableMetadata:true, retainPrimitiveProcedureDefaults:true};
const keyOf = (scope, name) => [...scope, name].join('.');
const root = node => node?.type === 'Identifier' ? node :
    ['Member','Index'].includes(node?.type) ? root(node.object) : null;
const pathOf = node => node?.type === 'Identifier' ? node.name :
    node?.type === 'Member' ? pathOf(node.object) + '.' + node.name : null;
const fail = reason => {throw new Error('Fixed-instance JRES image: ' + reason);};
const walk = (node, visit, parent = null) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {node.forEach(child => walk(child, visit, parent)); return;}
    visit(node, parent);
    Object.values(node).forEach(child => {if (child && typeof child === 'object') walk(child, visit, node);});
};

// Locate only real namespace-level declarations. Text matching below locates a
// byte range; it never supplies lexical, source-binding or resource authority.
const namespaceDeclarations = (body, visit, scope = []) => {
    for (const node of body || []) {
        if (node.type === 'Namespace') namespaceDeclarations(node.body, visit, [...scope,node.name]);
        else if (node.type === 'Declaration') visit(node, scope);
    }
};
const namespaceLines = tokens => {
    const openers = new Map(), stack = [], lines = new Map();
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!lines.has(token.startLine)) lines.set(token.startLine, stack.flatMap(frame => frame || []));
        if (token.type === 'namespace') {
            const parts = []; let j = i + 1;
            while (tokens[j]?.type === 'ident') {
                parts.push(tokens[j++].value);
                if (tokens[j]?.value !== '.') break;
                j++;
            }
            if (tokens[j]?.type === 'punct' && tokens[j].value === '{') openers.set(j,parts);
        }
        if (token.type === 'punct' && token.value === '{') stack.push(openers.get(i) || null);
        if (token.type === 'punct' && token.value === '}') stack.pop();
    }
    return lines;
};
const annotated = (lines, index) => {
    const comments = [];
    for (let i = index - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        if (!/^[ \t]*\/\/%/.test(lines[i])) break;
        // A block-comment terminator between metadata and code cannot be
        // interpreted as an actual single-line compiler annotation.
        if (/\/\*|\*\//.test(lines[i])) return false;
        comments.unshift(lines[i].replace(/^[ \t]*\/\/%/,''));
    }
    const flags = comments.join(' ').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
    return /(?:^|\s)fixedInstance(?:\s|$)/.test(flags) && /(?:^|\s)jres(?:\s|$)/.test(flags);
};
const factory = declaration => {
    const call = declaration.init;
    return call?.type === 'Call' && !call.isNew && !call.typeArguments?.length &&
        pathOf(call.callee) === 'image.ofBuffer' && call.args.length === 1 &&
        call.args[0]?.type === 'Template' && call.args[0].tag === 'hex' && call.args[0].value === '';
};

/** Materialize PXT's fixed JRES image initializers, never a whole library.
 * Original inputs and resolved SDK package/source order remain read-only.
 * Existing asset-pack/gallery.ts handling has a separate unchanged boundary.
 */
export function createFixedImageResourceMaterializer(originalFiles, resolved) {
    let context;
    const build = () => {
        if (context) return context;
        const cfg = JSON.parse(originalFiles['pxt.json']);
        const sources = new Map();
        for (const name of cfg.files) if (/\.ts$/.test(name)) {
            if (typeof originalFiles[name] !== 'string') fail('configured root source missing: ' + name);
            if (sources.has('root:' + name)) fail('duplicate configured root source: ' + name);
            sources.set('root:' + name,originalFiles[name]);
        }
        for (const [name,text] of Object.entries(resolved.generatedRootFiles || {})) {
            if (sources.has('root:' + name)) fail('generated root source would replace authored source: ' + name);
            sources.set('root:' + name,text);
        }
        for (const {id,file} of resolved.sourceOrder) {
            if (!/\.ts$/.test(file)) continue;
            const text = resolved.packages[id]?.files?.[file];
            if (typeof text !== 'string') fail('configured dependency source missing: ' + id + '/' + file);
            const key = 'dependency:' + id + '/' + file;
            if (sources.has(key)) fail('duplicate configured dependency source: ' + id + '/' + file);
            sources.set(key,text);
        }
        const records = new Map(), bodies = [], declared = new Map(), bindings = new Map();
        const names = (body,sourceKey,scope=[]) => {
            const key = scope.join('.'), set = declared.get(key) || new Set(); declared.set(key,set);
            for (const node of body || []) {
                const add = (name,decl) => {
                    set.add(name);
                    const qualified = keyOf(scope,name), owners = bindings.get(qualified) || [];
                    owners.push({sourceKey,node,decl});bindings.set(qualified,owners);
                };
                if (node.type === 'Declaration') node.decls.forEach(decl => add(decl.name,decl));
                if (['FunctionDeclaration','Class','Enum','Namespace'].includes(node.type)) add(node.name,null);
                if (node.type === 'Namespace') names(node.body,sourceKey,[...scope,node.name]);
            }
        };
        for (const [key,text] of sources) {
            const tokens = tokenize(text);
            if (tokens.some(token => token.unknownBefore || token.invalidLiteral)) fail('incomplete lexical source proof: ' + key);
            let program; try {program = parseMakeCodeTs(text,parseOptions);} catch (error) {fail('source proof refused ' + key + ': ' + error.message);}
            walk(program,node => {if (node.type === 'Unknown' || node.unsupported?.length) fail('incomplete executable source proof: ' + key);});
            records.set(key,{program,tokens,text});bodies.push(...program.body);names(program.body,key);
        }
        const program = {type:'Program',body:bodies}, sdk = staticSdkNamespaceReceivers(program,{builtinIdentifiers:['hex','img','globalThis','window','self','global','eval','Function']});
        walk(program,(node,parent) => {
            if (node.type === 'Namespace' && parent?.type === 'Program' && ['image','hex','img'].includes(node.name)) fail('namespace may replace SDK image/hex/img binding');
            if (node.type === 'Identifier' && ['globalThis','window','self','global','eval','Function'].includes(node.name) && sdk.has(node)) fail('ambient dynamic SDK mutation is unproved');
            const written = node.type === 'Assignment' ? node.left : node.type === 'Update' ? node.argument : null;
            const base = root(written);
            if (base && ['image','hex','img'].includes(base.name) && sdk.has(base)) fail('SDK image/hex/img writer');
            if (node.type === 'Identifier' && ['hex','img'].includes(node.name) && sdk.has(node)) fail('SDK hex/img extraction or replacement is unproved');
            if (node.type === 'Identifier' && node.name === 'image' && sdk.has(node) &&
                !(parent?.type === 'Member' && parent.object === node)) fail('SDK image escape or computed access');
            if (node.type === 'Member' && pathOf(node) === 'image.ofBuffer' && sdk.has(node) &&
                !(parent?.type === 'Call' && parent.callee === node)) fail('SDK image.ofBuffer extraction');
        });
        const resourceOwners = new Map();
        for (const [id,pkg] of Object.entries(resolved.packages)) for (const key of pkg.resourceIds || []) {
            const owners = resourceOwners.get(key) || new Set(); owners.add(id);resourceOwners.set(key,owners);
        }
        context = {records,declared,bindings,sdk,resourceOwners};return context;
    };
    return (packageId,file,source) => {
        // No parser/source-census work for packages with no bounded candidates.
        if (!source.includes('fixedInstance') || !source.includes('jres') || !/image\s*\.\s*ofBuffer\s*\(\s*hex``\s*\)/.test(source)) return {source,resources:[]};
        const sourceKey = packageId === null ? 'root:' + file : 'dependency:' + packageId + '/' + file;
        const ctx = build(), record = ctx.records.get(sourceKey);
        if (!record || record.text !== source) fail('actual configured package source differs');
        const declarations = new Map();
        namespaceDeclarations(record.program.body,(node,scope) => {
            for (const decl of node.decls) {
                const key = keyOf(scope,decl.name), list = declarations.get(key) || [];
                list.push({node,decl,scope});declarations.set(key,list);
            }
        });
        const lines = source.split(/\r\n|[\n\r\u2028\u2029]/), lineScopes = namespaceLines(record.tokens), edits = [], resources = [];
        let offset = 0;
        for (let index = 0; index < lines.length; index++) {
            const line = lines[index], match = /^([ \t]*)export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(image\s*\.\s*ofBuffer\s*\(\s*hex``\s*\))\s*;?[ \t]*$/.exec(line);
            if (match && annotated(lines,index)) {
                const lineNumber = index + 1, scope = lineScopes.get(lineNumber), key = scope && keyOf(scope,match[2]);
                const entries = key && declarations.get(key);
                if (entries?.length !== 1) fail('missing or ambiguous actual declaration: ' + match[2]);
                const {node,decl,scope:actualScope} = entries[0], owners = ctx.bindings.get(key);
                if (owners?.length !== 1 || owners[0].decl !== decl || owners[0].sourceKey !== sourceKey) fail('ambiguous configured declaration: ' + key);
                if (node.kind !== 'const' || !node.exported || node.decls.length !== 1 || !factory(decl) || !ctx.sdk.has(decl.init.callee)) fail('factory is not the unchanged actual SDK declaration: ' + key);
                const actualTokens = record.tokens.filter(token => token.startLine === lineNumber);
                const expected = ['export','const',match[2],'=','image','.','ofBuffer','(','hex','',')'];
                if (actualTokens.at(-1)?.value === ';') expected.push(';');
                if (actualTokens.length !== expected.length || actualTokens.some((token,i) =>
                    token.value !== expected[i] || (i === 9 && token.type !== 'template'))) fail('factory token span is not actual code: ' + key);
                for (let depth = 0; depth <= actualScope.length; depth++) {
                    const bound = ctx.declared.get(actualScope.slice(0,depth).join('.'));
                    if (bound?.has('image') || bound?.has('hex') || bound?.has('img')) fail('image/hex/img is shadowed in actual merged namespace: ' + key);
                }
                const pkg = packageId === null ? {resourceIds:resolved.rootResourceIds} : resolved.packages[packageId], entry = resolved.jres[key];
                if (!pkg.resourceIds?.includes(key) || (packageId === null ? ctx.resourceOwners.has(key) : ctx.resourceOwners.get(key)?.size !== 1)) fail('missing or ambiguous actual package resource: ' + key);
                if (!entry || entry.id !== key || String(entry.namespace || '').replace(/\.$/,'') !== actualScope.join('.') ||
                    entry.mimeType !== 'image/x-mkcd-f4' || entry.dataEncoding !== 'base64' || typeof entry.data !== 'string') fail('resource metadata does not match factory: ' + key);
                if (entry.data.length > 8 * 1024 * 1024) fail('resource exceeds bounded image decoder: ' + key);
                let image; try {image = decodeMkcdImage(entry.data);} catch {fail('invalid resource bytes: ' + key);}
                if (!image || image.width * image.height > 4 * 1024 * 1024) fail('invalid resource image: ' + key);
                const start = offset + line.indexOf(match[3]);
                edits.push({start,end:start+match[3].length,text:toImgLiteral(image)});
                resources.push({resourceId:key,namespace:actualScope.join('.'),name:decl.name,
                    resource:{...entry},palette:resolved.runtimeConfig?.palette?.slice() || null,
                    rootOverride:(resolved.rootResourceIds || []).includes(key),
                    width:image.width,height:image.height,pixels:Array.from(image.pixels),
                    allocation:'one existing declaration initializer at its original source position'});
            }
            offset += line.length;
            const ending = source.slice(offset).match(/^(?:\r\n|[\n\r\u2028\u2029])/);if (ending) offset += ending[0].length;
        }
        for (const edit of edits.reverse()) source = source.slice(0,edit.start) + edit.text + source.slice(edit.end);
        return {source,resources};
    };
}
