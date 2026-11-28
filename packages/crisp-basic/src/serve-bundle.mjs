// SPDX-License-Identifier: BSD-3-Clause
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';

export const SERVE_HELP = `Usage: crispbasic serve program.html [--port PORT] [--json]

Serve one offline bundle on 127.0.0.1 with the cross-origin isolation headers
required by the full SDL WASM host. No sibling files or network assets are served.
--port defaults to 8080; use 0 for an available port. Stop with Ctrl-C.
`;

export async function serveBundle(filename, {port = 8080} = {}) {
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('port must be an integer from 0 to 65535');
    const path = resolve(filename);
    const info = await stat(path);
    if (!info.isFile() || info.size > 256 * 1024 * 1024) throw new Error('Bundle must be a file no larger than 256 MiB');
    const bytes = await readFile(path);
    const server = createServer((request, response) => {
        const headers = {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store'
        };
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, {...headers, Allow: 'GET, HEAD'});
            response.end();
            return;
        }
        if (request.url?.split('?')[0] !== '/') {
            response.writeHead(404, headers);
            response.end();
            return;
        }
        response.writeHead(200, {...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': bytes.length});
        response.end(request.method === 'HEAD' ? undefined : bytes);
    });
    await new Promise((accept, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); accept(); });
    });
    const address = server.address();
    let closing;
    const close = () => closing ??= new Promise((accept, reject) => {
        server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : accept());
        server.closeAllConnections();
    });
    return {path, port: address.port, url: `http://127.0.0.1:${address.port}/`, close};
}

export async function runServeCli(args, {writeOut = value => process.stdout.write(value), onServer} = {}) {
    const {values, positionals, tokens} = parseArgs({args, strict: true, allowPositionals: true, tokens: true,
        options: {port: {type: 'string'}, json: {type: 'boolean'}, help: {type: 'boolean'}}});
    if (values.help) { writeOut(SERVE_HELP); return; }
    const seen = new Set();
    for (const token of tokens) {
        if (token.kind !== 'option') continue;
        if (seen.has(token.name)) throw new Error(`--${token.name} may be specified only once`);
        seen.add(token.name);
    }
    if (positionals.length !== 1) throw new Error('serve expects one offline HTML file; use serve --help');
    if (values.port !== undefined && !/^\d+$/.test(values.port)) throw new Error('--port must be an integer from 0 to 65535');
    const server = await serveBundle(positionals[0], {port: values.port === undefined ? 8080 : Number(values.port)});
    let finish;
    const stopped = new Promise(resolve => { finish = resolve; });
    const close = async () => { try { await server.close(); } finally { finish(); } };
    const originalClose = server.close;
    server.close = async () => { try { await originalClose(); } finally { finish(); } };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    try {
        onServer?.(server);
        writeOut(values.json ? JSON.stringify({url: server.url, port: server.port, path: server.path}) + '\n' :
            `Serving ${server.path} at ${server.url}\nPress Ctrl-C to stop.\n`);
        await stopped;
    } finally {
        process.removeListener('SIGINT', close);
        process.removeListener('SIGTERM', close);
        await originalClose();
    }
}
