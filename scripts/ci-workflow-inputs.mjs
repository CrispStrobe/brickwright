// Shared workflow census, maintained in CrispStrobe/bw-circuit-ui.
// MIT. Keep consumer copies byte-identical when adopting changes.
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative, posix} from 'node:path';

export function workflowSources(root) {
    const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? walk(path) : /\.ya?ml$/.test(entry.name) ? [path] : [];
    });
    return new Map(walk(join(root, '.github', 'workflows'))
        .map(file => [relative(root, file), readFileSync(file, 'utf8')]));
}


// Block scalars hold script or other literal data, not YAML mapping fields.
// Preserve line positions while removing their bodies from the checkout view.
// Quoted scalars that span lines fail closed: their text can imitate a block
// header at any indentation and must never hide a later real checkout.
function checkoutMappingLines(source, file) {
    let scalarIndent = null;
    let flowDepth = 0;
    let plainFlow = false;
    const quotedEnd = (line, at, number) => {
        const quote = line[at];
        for (let i = at + 1; i < line.length; i++) {
            if (quote === '"' && line[i] === '\\') { i++; continue; }
            if (line[i] !== quote) continue;
            if (quote === "'" && line[i + 1] === "'") { i++; continue; }
            return i + 1;
        }
        throw new Error(`${file}:${number}: unsupported multiline quoted YAML scalar`);
    };
    const space = (line, at) => {
        while (at < line.length && /\s/.test(line[at])) at++;
        return at;
    };
    const properties = (line, at, number) => {
        at = space(line, at);
        while (line[at] === '&' || line[at] === '!') {
            if (line.startsWith('!<', at)) {
                const end = line.indexOf('>', at + 2);
                if (end < 0) throw new Error(`${file}:${number}: unsupported multiline YAML tag`);
                at = end + 1;
            } else {
                while (at < line.length && !/[\s,\[\]{}]/.test(line[at])) at++;
            }
            at = space(line, at);
        }
        return at;
    };
    const inspectQuotes = (line, number) => {
        let at = space(line, 0);
        if (!flowDepth) {
            if (line[at] === '#') return;
            let before;
            do {
                before = at;
                while (/^[-?]\s/.test(line.slice(at))) at = space(line, at + 1);
                at = properties(line, at, number);
            } while (at !== before);
            if (line[at] !== '[' && line[at] !== '{') {
                if (line[at] === '"' || line[at] === "'") {
                    at = space(line, quotedEnd(line, at, number));
                    if (line[at] !== ':') return;
                } else {
                    const colon = line.slice(at).search(/:(?=\s|$)/);
                    if (colon < 0) return;
                    at += colon;
                }
                at = properties(line, at + 1, number);
            }
            if (line[at] === '"' || line[at] === "'") {
                quotedEnd(line, at, number);
                return;
            }
            if (line[at] !== '[' && line[at] !== '{') return;
            flowDepth++;
            plainFlow = false;
            at++;
        }
        for (; at < line.length && flowDepth; at++) {
            const ch = line[at];
            if (plainFlow) {
                if (ch === '#' && (at === 0 || /\s/.test(line[at - 1]))) return;
                if (ch !== ',' && ch !== ']' && ch !== '}' &&
                    !(ch === ':' && /\s/.test(line[at + 1] || ' '))) continue;
                plainFlow = false;
            }
            if (/\s/.test(ch) || ch === ',' || ch === ':' ||
                (ch === '?' && /\s/.test(line[at + 1] || ' '))) continue;
            if (ch === '#') return;
            if (ch === ']' || ch === '}') { flowDepth--; continue; }
            const beforeProperties = at;
            at = properties(line, at, number);
            if (at >= line.length) return;
            if (at !== beforeProperties) { at--; continue; }
            if (line[at] === '"' || line[at] === "'") {
                at = quotedEnd(line, at, number) - 1;
            } else if (line[at] === '[' || line[at] === '{') {
                flowDepth++;
            } else {
                plainFlow = true;
            }
        }
    };
    return source.split('\n').map((line, index) => {
        const indent = line.search(/\S/);
        if (scalarIndent !== null) {
            if (indent < 0 || indent > scalarIndent) return '';
            scalarIndent = null;
        }
        const inFlow = flowDepth > 0;
        inspectQuotes(line, index + 1);
        // A sequence's inline key starts after "- ". A later key in that same
        // step ends the scalar just as a following step does.
        const scalar = !inFlow && line.match(/^(\s*)(-\s+)?[^#\s][^:]*:\s*[|>](?:[1-9][+-]?|[+-][1-9]?)?\s*(?:#.*)?$/);
        if (scalar) scalarIndent = scalar[1].length + (scalar[2]?.length || 0);
        return line;
    });
}

// Deliberately require block-style external checkouts. A new syntax must be
// taught to the census with a failing fixture, rather than silently omitted.
export function checkoutSites(workflows) {
    const sites = [];
    for (const [file, source] of workflows) {
        const lines = checkoutMappingLines(source, file);
        for (let i = 0; i < lines.length; i++) {
            if (/^\s*#/.test(lines[i]) || !/\brepository\s*:/.test(lines[i])) continue;
            const repository = lines[i].match(/^\s*repository:\s*(.*?)\s*(?:#.*)?$/)?.[1];
            if (!repository) throw new Error(`${file}:${i + 1}: unsupported repository syntax`);
            const indent = lines[i].search(/\S/);
            let start = i;
            while (start > 0 && !/^\s*-\s/.test(lines[start])) start--;
            let end = i + 1;
            while (end < lines.length && !(lines[end].trim() && lines[end].search(/\S/) < indent)) end++;
            const step = lines.slice(start, end).join('\n');
            if (!/uses:\s*['"]?actions\/checkout@/.test(step)) {
                throw new Error(`${file}:${i + 1}: repository field outside a recognized checkout`);
            }
            const refs = lines.slice(start, end)
                .filter(line => line.search(/\S/) === indent)
                .map(line => line.match(/^\s*ref:\s*(.*?)\s*(?:#.*)?$/)?.[1]).filter(Boolean);
            // Observed by duplicate-ref fixture: one ref accepted, two refused.
            // This is checkout field cardinality, not a performance threshold.
            if (refs.length > 1) throw new Error(`${file}:${i + 1}: duplicate checkout ref`);
            const unquote = value => value?.replace(/^(['"])(.*)\1$/, '$2');
            sites.push({file, line: i + 1, repository: unquote(repository), ref: unquote(refs[0])});
        }
    }
    return sites;
}

export function assertCheckoutPins(workflows, allowedRef = () => false) {
    const sites = checkoutSites(workflows);
    for (const site of sites) {
        if (!/^[a-f0-9]{40}$/.test(site.ref || '') && !allowedRef(site)) {
            throw new Error(`${site.file}:${site.line} ${site.repository}: expected a full 40-character reviewed SHA; got ${site.ref || '<missing>'}`);
        }
    }
    return sites;
}

export function assertNoRawClones(workflows) {
    for (const [file, source] of workflows) {
        const code = source.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
        if (/\bgit\s+(?:\\\n\s*)?clone\b/.test(code)) {
            throw new Error(`${file}: unreviewed raw clone; record and enforce its exact pin contract`);
        }
    }
}

// Follow direct workflow script invocations and relative module imports. This
// complements the checkout census without treating test fixture strings as CI.
export function assertInvokedScriptsPinned(workflows, readScript) {
    const pending = [...workflows.values()].flatMap(source =>
        [...source.matchAll(/\b(?:node|bash|sh)\s+(scripts\/[\w./-]+\.(?:mjs|js|sh))\b/g)].map(m => m[1]));
    const visited = new Set();
    while (pending.length) {
        const file = pending.pop();
        if (visited.has(file)) continue;
        visited.add(file);
        const source = readScript(file);
        const code = source.split('\n').filter(line => !/^\s*(?:#|\/\/|\*)/.test(line)).join('\n');
        if (/\bgit\s+clone\b/.test(code)
            || /\(\s*['"]git['"]\s*,\s*\[\s*['"]clone['"]/.test(code)
            || /\bgit\(\s*['"]clone['"]/.test(code)) {
            throw new Error(`${file}: unreviewed script clone; enforce an exact pin contract before adding this site`);
        }
        for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+\.(?:mjs|js))['"]/g)) {
            const dependency = posix.normalize(posix.join(posix.dirname(file), match[1]));
            // Sibling modules belong to the separately pinned repository, not
            // this repository's script corpus.
            if (!dependency.startsWith('../')) pending.push(dependency);
        }
    }
    return [...visited].sort();
}
