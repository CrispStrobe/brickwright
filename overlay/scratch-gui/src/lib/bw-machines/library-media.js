import {makeT} from '../bw-i18n.js';
import {activateConfig} from './activate.js';
import {fromMediaManifest} from './importers.js';
import {validateMachineConfig} from './machine-config.js';

const mediaInfo = makeT({
    en: {sieve: 'CP/M Sieve', forthCpm: 'zForth on CP/M',
        ackPascal: 'Prints the primes first. The DOS service then reports a file-close error.',
        ubasic: 'Open the sample in BAS. Edit the program and run it again to see the new output in Controller.'},
    de: {sieve: 'CP/M-Primzahlsieb', forthCpm: 'zForth unter CP/M',
        ackPascal: 'Gibt zuerst die Primzahlen aus. Danach meldet der DOS-Dienst einen Fehler beim Schließen der Datei.',
        ubasic: 'Öffne das Beispiel in BAS. Bearbeite das Programm und starte es erneut, um die neue Ausgabe im Controller zu sehen.'}
});

export function localizedMedia (item, locale) {
    return {...item, title: item.titleKey ? mediaInfo(locale, item.titleKey) : item.title,
        summary: item.infoKey ? mediaInfo(locale, item.infoKey) : item.summary};
}

// Reviewed manifest references only. Program bytes stay in media-lab.
const MEDIA_REVISION = '081bd4156797cf8b14b9ceef7245ff9e100577e5';
const mediaDirectory = item => new URL(`https://raw.githubusercontent.com/CrispStrobe/brickwright-media-lab/${item.revision || MEDIA_REVISION}/projects/${item.project || item.id}/`);

const ackSamples = [
    ['pascal', 'ACK Pascal (DOS)', 'sieve.com', 'db1ce4885bc04a942ac503730168af5e639c584a81e1077e3fc7e21fb732ae5c'],
    ['c', 'ACK C (DOS)', 'fact.com', 'f53d2a613deb2b5da1b107c18570ae3e131c532ed76522279acbe85e0c916bf7'],
    ['modula2', 'ACK Modula-2 (DOS)', 'sievemod.com', 'c9be50f40ce0b8076872b861852d7c4e9f99491aabc7fdd0a04122fc6f6c66b1']
].map(([language, title, file, sha256]) => ({
    id: `ack-${language}`, project: 'ack', title, machine: 'i8086',
    license: 'BSD-3-Clause', licenseFile: 'COPYING.ACK',
    ...(language === 'pascal' ? {infoKey: 'ackPascal'} : {}),
    sample: {language, file, sha256}
}));

export const libraryMedia = [
    {id: 'forth-cpm', title: mediaInfo('en', 'forthCpm'), titleKey: 'forthCpm', machine: 'z80', license: 'MIT'},
    {id: 'cpm-software', title: mediaInfo('en', 'sieve'), titleKey: 'sieve', machine: 'z80', license: 'BSD-2-Clause',
        code: {language: 'c', path: 'src/sieve.c', compilerTarget: 'z80-cpm'}},
    {id: 'fe-dos', title: 'fe Lisp (DOS)', machine: 'i8086', license: 'MIT'},
    {id: 'forth-dos', title: 'zForth (DOS)', machine: 'i8086', license: 'MIT'},
    {id: 'tcl-dos', title: 'partcl Tcl (DOS)', machine: 'i8086', license: 'MIT'},
    {id: 'ubasic-dos', title: 'uBASIC (DOS)', machine: 'i8086', license: 'BSD-3-Clause',
        infoKey: 'ubasic',
        code: {language: 'basic', path: 'samples/demo.bas', dosSourceName: 'PROG.BAS'}},
    ...ackSamples,
    {id: 'x86-benchmarks/topbench', title: 'TOPBENCH (386)', machine: 'i80386', license: 'MIT', benchmark: 'topbench'},
    {id: 'picobb-rp2040', title: 'PicoBB BBC BASIC', machine: 'rp2040js', license: 'Zlib',
        revision: 'd6f09f79a6c73a2fcdf7f53b75624aa01f096baf',
        flashHash: 'f0acd59bfd93182c2dcde4af65d36f3d20cf2e8eecc6c6ec760c1ac9654264d8'},
    {id: 'piccolobasic-rp2040', title: 'PiccoloBASIC (UART)', machine: 'rp2040js', license: 'BSD-3-Clause',
        licenseFile: 'LICENSE', revision: 'a5a7e3c24658ef98675835faa3cc31222787814f'},
    {id: 'stefan-basic-rp2040', title: 'Stefan’s BASIC (UART)', machine: 'rp2040js',
        license: 'BSD-3-Clause AND LGPL-2.1-or-later', licenseFile: 'README.md',
        revision: 'ac3da4ed3ba0d79168903062dbef6667c361c614'}
];

export async function readMediaManifest (url) {
    const response = await fetch(url, {redirect: 'error'});
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    return response.json();
}

export async function openLibraryMedia (item) {
    const baseUrl = mediaDirectory(item);
    const source = new URL('brickwright-media.json', baseUrl).href;
    const manifest = await readMediaManifest(source);
    // ACK's pinned manifest predates the license field. Its sibling COPYING.ACK
    // and the per-program hashes were reviewed when these entries were admitted.
    const reviewedLegacyLicense = item.project === 'ack' && item.licenseFile === 'COPYING.ACK' &&
        manifest.license == null;
    if (manifest.machine !== item.machine ||
        (!reviewedLegacyLicense && manifest.license !== item.license) || manifest.boot === false) {
        throw new Error('Media manifest differs from the reviewed catalog entry.');
    }
    let launchManifest = manifest;
    if (item.sample) {
        const sample = manifest.programs?.find(program => program.language === item.sample.language);
        if (sample?.slots?.com !== item.sample.file || sample.program?.kind !== 'dos') {
            throw new Error('DOS sample differs from the reviewed catalog entry.');
        }
        launchManifest = {...manifest, title: item.title, license: item.license, program: sample.program,
            slots: {com: {url: item.sample.file, sha256: item.sample.sha256}}};
    }
    if (item.flashHash) {
        launchManifest = {...launchManifest, slots: {...launchManifest.slots,
            flash: {url: launchManifest.slots.flash, sha256: item.flashHash}}};
    }
    const config = fromMediaManifest(launchManifest, {source, baseUrl: baseUrl.href});
    const verdict = validateMachineConfig(config);
    if (!verdict.ok) throw new Error(verdict.errors.join('; '));
    return config;
}

export function libraryLicenseUrl (item) {
    return item.licenseFile ? new URL(item.licenseFile, mediaDirectory(item)).href : null;
}

export async function readLibraryCode (item) {
    if (!item.code) return null;
    const url = new URL(item.code.path, mediaDirectory(item));
    const response = await fetch(url, {redirect: 'error'});
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    return {language: item.code.language, text: await response.text(), title: item.title,
        machine: item.machine, url: url.href, compilerTarget: item.code.compilerTarget, dosSourceName: item.code.dosSourceName};
}

export async function loadPicoBasicFirmware (profile) {
    const entry = libraryMedia.find(item => item.id === profile.media);
    const config = await openLibraryMedia(entry);
    if (!config.slots.flash?.sha256) throw new Error('Pico BASIC firmware has no pinned SHA-256.');
    const {bootMedia} = await activateConfig(config);
    if (bootMedia?.slot !== 'flash' || bootMedia.picoBasicConsole !== profile.dialect) {
        throw new Error('Pico BASIC firmware does not match the selected profile.');
    }
    return bootMedia.bytes;
}
