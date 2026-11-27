// SPDX-License-Identifier: BSD-3-Clause
// Source aliases keep this qualification on explicit supplier and React bytes.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export async function cardiacBrowserFixture ({root, deps, compilerDeps = deps, board, circuit, example}) {
    const requireDeps = createRequire(path.join(deps, '__cardiac_browser__.cjs'));
    const requireCompiler = createRequire(path.join(compilerDeps, '__cardiac_browser_compiler__.cjs'));
    const requireRoot = createRequire(path.join(root, 'package.json'));
    const {createServer, build, preview} = await import(pathToFileURL(requireCompiler.resolve('vite')).href);
    const {default: reactPlugin} = await import(pathToFileURL(requireCompiler.resolve('@vitejs/plugin-react')).href);
    const {chromium} = requireCompiler('playwright');
    if (typeof chromium?.launch !== 'function') throw new Error('The supplied Playwright registry has no Chromium launch API.');
    const react = requireDeps('react/package.json').version;
    const fixture = path.join(root, 'test/fixtures/cardiac-lab');
    const component = path.join(root, 'overlay/scratch-gui/src/components/tw-pseudocode');
    const library = path.join(root, 'overlay/scratch-gui/src/lib');
    const config = {
        configFile: false, root: fixture, logLevel: 'warn',
        // Vite normally skips variable imports in node_modules. Circuit UI
        // ships source and lazily imports its SVG artwork; transform that
        // owned package exactly as when --circuit names a source checkout.
        build: {dynamicImportVarsOptions: {exclude: [/node_modules[\\/](?!bw-circuit-ui[\\/])/]}},
        optimizeDeps: {entries: [path.join(fixture, 'index.html')]},
        plugins: [{
            name: 'cardiac-browser-fixture', enforce: 'pre',
            resolveId (source, importer) {
                if (source === '@cardiac-react-root') return '\0cardiac-react-root.js';
                if (source.endsWith('/cardiac-panel.css') && importer?.startsWith(component)) return '\0cardiac-panel-style.js';
                if (source.endsWith('/circuit-theme.css')) return '\0cardiac-circuit-style.js';
            },
            async load (id) {
                if (id === '\0cardiac-react-root.js') {
                    return Number(react.split('.')[0]) >= 18
                        ? "import {createRoot} from 'react-dom/client';export const mount=createRoot;"
                        : "import ReactDOM from 'react-dom';export const mount=node=>({render:element=>ReactDOM.render(element,node),unmount:()=>ReactDOM.unmountComponentAtNode(node)});";
                }
                if (id === '\0cardiac-circuit-style.js') {
                    const css = (await readFile(path.join(circuit, 'src/components/circuit-theme.css'), 'utf8'))
                        .replace(/:global\(([^)]+)\)/g, '$1');
                    return `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);`;
                }
                if (id !== '\0cardiac-panel-style.js') return;
                const css = await readFile(path.join(component, 'cardiac-panel.css'), 'utf8');
                const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => [match[1], match[1]]));
                return `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);export default ${JSON.stringify(classes)};`;
            }
        }, reactPlugin()],
        resolve: {alias: [
            {find: 'react', replacement: path.join(deps, 'react')},
            {find: 'react-dom', replacement: path.join(deps, 'react-dom')},
            {find: /^prop-types$/, replacement: path.join(fixture, 'prop-types.js')},
            {find: 'jszip', replacement: requireRoot.resolve('jszip/dist/jszip.min.js')},
            {find: /^bw-board$/, replacement: path.join(board, 'src/index.js')},
            {find: /^bw-board\/(roms?\/.*)$/, replacement: `${board}/$1`},
            {find: /^bw-board\/(.*)$/, replacement: `${board}/src/$1`},
            {find: '@cardiac-host', replacement: path.join(component, 'cardiac-host.jsx')},
            {find: '@cardiac-surfaces', replacement: path.join(component, 'cardiac-surfaces.js')},
            {find: '@cardiac-runner', replacement: path.join(library, 'bw-debug/debug-runner.js')},
            {find: '@cardiac-project-bundle', replacement: path.join(library, 'bw-project-bundle.js')},
            {find: '@cardiac-project-load', replacement: path.join(library, 'bw-project-load.js')},
            {find: '@cardiac-cui-sidecars', replacement: path.join(circuit, 'src/model/sidecar-loader.js')},
            {find: '@cardiac-cui-engine', replacement: path.join(circuit, 'src/engine.js')},
            {find: '@cardiac-circuit-designer', replacement: path.join(circuit, 'src/components/CircuitDesigner.jsx')},
            {find: '@cardiac-circuit-example', replacement: example}
        ]},
        server: {host: '127.0.0.1', port: 0, hmr: false,
            fs: {allow: [root, board, circuit, deps, compilerDeps, path.dirname(example)]}}
    };
    return {config, createServer, build, preview, chromium, react};
}
