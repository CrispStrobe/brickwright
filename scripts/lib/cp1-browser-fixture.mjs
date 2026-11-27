// SPDX-License-Identifier: BSD-3-Clause
// Explicit dependency roots keep browser proofs on the supplied package bytes.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export async function cp1BrowserFixture ({root, deps, compilerDeps = deps, board, circuit}) {
    const requireDeps = createRequire(path.join(deps, '__cp1_browser__.cjs'));
    const requireCompiler = createRequire(path.join(compilerDeps, '__cp1_browser_compiler__.cjs'));
    const requireRoot = createRequire(path.join(root, 'package.json'));
    const {createServer, build, preview} = await import(pathToFileURL(requireCompiler.resolve('vite')).href);
    const {default: reactPlugin} = await import(pathToFileURL(requireCompiler.resolve('@vitejs/plugin-react')).href);
    // resolve() selects Playwright's CommonJS entry; importing that file by URL
    // exposes its API under default on Node 22/24, not named chromium. Use the
    // explicitly supplied registry's CJS API without guessing interop exports.
    const {chromium} = requireCompiler('playwright');
    if (typeof chromium?.launch !== 'function') throw new Error('The supplied Playwright registry has no Chromium launch API.');
    const react = requireDeps('react/package.json').version;
    const fixture = path.join(root, 'test/fixtures/cp1-panel');
    const component = path.join(root, 'overlay/scratch-gui/src/components/tw-pseudocode');
    const library = path.join(root, 'overlay/scratch-gui/src/lib');
    const config = {
        configFile: false, root: fixture, logLevel: 'warn',
        optimizeDeps: {entries: [path.join(fixture, circuit ? 'runner.html' : 'index.html')]},
        plugins: [{
            name: 'cp1-browser-fixture', enforce: 'pre',
            resolveId (source) {
                if (source === '@cp1-react-root') return '\0cp1-react-root.js';
                if (source.endsWith('/cp1-panel.css')) return '\0cp1-panel-style.js';
                if (circuit && source.endsWith('/circuit-theme.css')) return '\0cp1-circuit-style.js';
            },
            async load (id) {
                if (id === '\0cp1-react-root.js') {
                    return Number(react.split('.')[0]) >= 18
                        ? "import {createRoot} from 'react-dom/client';export const mount=createRoot;"
                        : "import ReactDOM from 'react-dom';export const mount=node=>({render:element=>ReactDOM.render(element,node),unmount:()=>ReactDOM.unmountComponentAtNode(node)});";
                }
                if (id === '\0cp1-circuit-style.js') {
                    // Lite compiles CSS with css-loader modules. Match its
                    // explicit :global selectors without editing supplier CSS.
                    const css = (await readFile(path.join(circuit, 'src/components/circuit-theme.css'), 'utf8'))
                        .replace(/:global\(([^)]+)\)/g, '$1');
                    return `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);`;
                }
                if (id !== '\0cp1-panel-style.js') return;
                const css = await readFile(path.join(component, 'cp1-panel.css'), 'utf8');
                const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)]
                    .map(match => [match[1], match[1]]));
                return `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);export default ${JSON.stringify(classes)};`;
            }
        }, reactPlugin()],
        resolve: {alias: [
            {find: 'react', replacement: path.join(deps, 'react')},
            {find: 'react-dom', replacement: path.join(deps, 'react-dom')},
            // React 16's development runtime imports prop-types/checkPropTypes;
            // leave that real subpath intact while stubbing component validators.
            {find: /^prop-types$/, replacement: path.join(fixture, 'prop-types.js')},
            {find: 'jszip', replacement: requireRoot.resolve('jszip/dist/jszip.min.js')},
            {find: /^bw-board$/, replacement: path.join(board, 'src/index.js')},
            {find: /^bw-board\/(roms?\/.*)$/, replacement: `${board}/$1`},
            {find: /^bw-board\/(.*)$/, replacement: `${board}/src/$1`},
            {find: '@cp1-panel', replacement: path.join(component, 'cp1-panel.jsx')},
            {find: '@cp1-host', replacement: path.join(component, 'cp1-host.jsx')},
            {find: '@cp1-surfaces', replacement: path.join(component, 'cp1-surfaces.js')},
            {find: '@cp1-machine', replacement: path.join(board, 'src/cp1-machine.js')},
            {find: '@cp1-runner', replacement: path.join(library, 'bw-debug/debug-runner.js')},
            {find: '@cp1-project-bundle', replacement: path.join(library, 'bw-project-bundle.js')},
            {find: '@cp1-project-load', replacement: path.join(library, 'bw-project-load.js')},
            ...(circuit ? [
                {find: '@cp1-cui-sidecars', replacement: path.join(circuit, 'src/model/sidecar-loader.js')},
                {find: '@cp1-cui-engine', replacement: path.join(circuit, 'src/engine.js')},
                {find: '@cp1-circuit-designer', replacement: path.join(circuit, 'src/components/CircuitDesigner.jsx')}
            ] : [])
        ]},
        server: {host: '127.0.0.1', port: 0, fs: {allow: [root, board, deps, compilerDeps, ...(circuit ? [circuit] : [])]}}
    };
    return {config, createServer, build, preview, chromium, react};
}
