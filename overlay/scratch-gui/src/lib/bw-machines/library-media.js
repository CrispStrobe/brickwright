import {fromMediaManifest} from './importers.js';
import {validateMachineConfig} from './machine-config.js';

// Reviewed manifest references only. Program bytes stay in media-lab.
const MEDIA_REVISION = '081bd4156797cf8b14b9ceef7245ff9e100577e5';
const MEDIA_ROOT = `https://raw.githubusercontent.com/CrispStrobe/brickwright-media-lab/${MEDIA_REVISION}/projects/`;

export const libraryMedia = [
    {id: 'forth-cpm', title: 'zForth on CP/M', machine: 'z80', license: 'MIT'},
    {id: 'cpm-software', title: 'CP/M Sieve', machine: 'z80', license: 'BSD-2-Clause'},
    {id: 'fe-dos', title: 'fe Lisp (DOS)', machine: 'i8086', license: 'MIT'},
    {id: 'forth-dos', title: 'zForth (DOS)', machine: 'i8086', license: 'MIT'},
    {id: 'tcl-dos', title: 'partcl Tcl (DOS)', machine: 'i8086', license: 'MIT'},
    {id: 'ubasic-dos', title: 'uBASIC (DOS)', machine: 'i8086', license: 'BSD-3-Clause'},
    {id: 'x86-benchmarks/topbench', title: 'TOPBENCH (386)', machine: 'i80386', license: 'MIT', benchmark: 'topbench'},
    {id: 'picobb-rp2040', title: 'PicoBB BBC BASIC', machine: 'rp2040js', license: 'Zlib'}
];

export async function readMediaManifest (url) {
    const response = await fetch(url, {redirect: 'error'});
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    return response.json();
}

export async function openLibraryMedia (item) {
    const baseUrl = new URL(`${item.id}/`, MEDIA_ROOT);
    const source = new URL('brickwright-media.json', baseUrl).href;
    const manifest = await readMediaManifest(source);
    if (manifest.machine !== item.machine || manifest.license !== item.license || manifest.boot === false) {
        throw new Error('Media manifest differs from the reviewed catalog entry.');
    }
    const config = fromMediaManifest(manifest, {source, baseUrl: baseUrl.href});
    const verdict = validateMachineConfig(config);
    if (!verdict.ok) throw new Error(verdict.errors.join('; '));
    return config;
}
