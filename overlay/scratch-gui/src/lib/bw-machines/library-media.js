import {aceKimMedia} from './ace-kim-library.js';
import {makeT} from '../bw-i18n.js';
import {activateConfig, defaultImageFetcher} from './activate.js';
import {fromMediaManifest} from './importers.js';
import {validateMachineConfig} from './machine-config.js';
import {PICOBB_FLASH} from './pico-basic-flash.js';

const mediaInfo = makeT({
    en: {minix: 'Click the screen and press = to boot MINIX. Log in as root and try ls.', sieve: 'CP/M Sieve',
        animation6502: 'Watch the 6502 copy four frames to video RAM at $2000. The screen updates when the guest publishes a frame.',
        tali65c02: 'Choose ACIA in Controller. Define a word, or write grayscale pixels at $3000. Switch to Screen to see the framebuffer.', forthCpm: 'zForth on CP/M',
        ackPascal: 'Prints the primes first. The DOS service then reports a file-close error.',
        ubasic: 'Open the sample in BAS. Edit the program and run it again to see the new output in Controller.'},
    de: {minix: 'Klicke auf den Bildschirm und drücke =, um MINIX zu starten. Melde dich als root an und probiere ls.', sieve: 'CP/M-Primzahlsieb',
        animation6502: 'Der 6502 kopiert vier Bilder in den Bildspeicher ab $2000. Die Anzeige übernimmt fertige Bilder.',
        tali65c02: 'Wähle im Controller ACIA. Definiere ein Wort oder schreibe Graustufenpixel ab $3000. Wähle Bildschirm für die Bildausgabe.', forthCpm: 'zForth unter CP/M',
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

const kim1SectorImage = {
    file: 'sectors.img', sha256: 'a516c3b2aa55cca2ad08e3e333712d4f9c0a2130d0f844d31542d4543cd0ad47'
};
const kim1RamMap = {
    file: 'expanded-ram.raw', sha256: 'd564fab784e543c63fd82ebf6866ef23381642b270705aa9a66bce04d99d4825'
};

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
    aceKimMedia,
    ...[
        ['ram-check', 'KIM-4 RAM Check', '8170c7f0a8af2b7988bd4d3b176efcca2decd020ace6d900d7d961b24239dfea'],
        ['video', 'K-1008 Checkerboard', 'bd193b042c262ef7379b5a99178d8b8575808b75baa0e17f001c85d6d3b79ddf'],
        ['memory-map', 'Programmable Memory Card', 'eec8fc438012602df0f86b15cc18f4572f2aa55e058a7a9b0f84abec7c9a8410', kim1RamMap],
        ['sd-read', 'SPI SD Block Read', 'ab10c1fe35e6b2a01b88426c8612190ff44c5dacf835a9af52c3ab942a6563ca', kim1SectorImage],
        ['corsham-read', 'Corsham Disk Block Read', '3a6fe19806688acf96bf4e3d41f1c54734ef267ae34f5c73a30e936c9b13a798', kim1SectorImage]
    ].map(([preset, title, sha256, image]) => ({
        id: `kim1-expansion-demos/${preset}`, project: 'kim1-expansion-demos', title, machine: 'kim1',
        license: 'MIT', licenseFile: 'LICENSE',
        revision: image ? 'cf41bdea84b034514d9b15291877fbc47a92f8ad' : '5e54caab98d7ca6f641d7cc3e21f2ebdab937400',
        kim1Tape: {preset, file: `${preset}.ptp`, sha256, image}
    })),
    {id: '6502-animation', title: '6502 Animation Lab', machine: 'eater6502',
        license: 'MIT', licenseFile: 'LICENSE', infoKey: 'animation6502', framebufferFormat: 'gray6',
        revision: '5e54caab98d7ca6f641d7cc3e21f2ebdab937400',
        romHash: '45504aefefd3adc676028013b568332289876da79afc3f682045d6052e41c396'},
    {id: 'tali-forth-65c02', title: 'Tali Forth 2 with framebuffer', machine: 'eater6502',
        license: 'LicenseRef-Public-Domain', licenseFile: 'LICENSE.upstream', infoKey: 'tali65c02',
        revision: '5e54caab98d7ca6f641d7cc3e21f2ebdab937400',
        romHash: '81c331f6afcd7f7049dbf51e65d839d0a483ef0699697586819bbeff95e74703'},
    {id: 'minix-2.0', title: 'MINIX 2.0.4', machine: 'i80386', license: 'BSD-3-Clause',
        licenseFile: 'LICENSE', infoKey: 'minix', revision: 'b424a9a6d2826360351d1ed1fbcd7548c4edf9f8'},
    {id: 'x86-benchmarks/native-sieve', title: 'Native 386 Sieve', machine: 'i80386', license: 'MIT',
        licenseFile: 'LICENSE', revision: 'c8dc584d39b69b1ed9f98af69e548d9da3d5b240', benchmark: 'native-sieve'},
    {id: 'x86-benchmarks/topbench', title: 'TOPBENCH (386)', machine: 'i80386', license: 'MIT', benchmark: 'topbench'},
    {id: 'picobb-rp2040', title: 'PicoBB BBC BASIC', machine: 'rp2040js', license: 'Zlib',
        revision: 'd6f09f79a6c73a2fcdf7f53b75624aa01f096baf',
        flashHash: PICOBB_FLASH.sha256},
    {id: 'piccolobasic-rp2040', title: 'PiccoloBASIC (UART)', machine: 'rp2040js', license: 'BSD-3-Clause',
        licenseFile: 'README.md', revision: 'b1931dbdc0f17978b5db95ac7e9018b19913eaf7'},
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
    if (item.romHash) {
        launchManifest = {...launchManifest, slots: {...launchManifest.slots,
            rom: {url: launchManifest.slots.rom, sha256: item.romHash}}};
    }
    if (item.framebufferFormat) {
        const {framebuffer, frameSerialAddress} = manifest.observation;
        const {address, width, height, stride} = framebuffer;
        const chip = manifest.machineConfig.chips.find(entry => entry.kind === 'framebuffer' && entry.at === address)?.name;
        launchManifest = {...launchManifest, program: {...launchManifest.program, framebuffer: {
            chip, at: address, width, height, stride, format: item.framebufferFormat, publishAt: frameSerialAddress
        }}};
    }
    const config = fromMediaManifest(launchManifest, {source, baseUrl: baseUrl.href});
    const verdict = validateMachineConfig(config);
    if (!verdict.ok) throw new Error(verdict.errors.join('; '));
    return config;
}

export function libraryLicenseUrl (item) {
    return item.licenseFile ? new URL(item.licenseFile, mediaDirectory(item)).href : null;
}

export async function readKim1LibraryTape (item) {
    const {preset, file, sha256, image} = item.kim1Tape;
    const directory = mediaDirectory(item);
    const load = asset => defaultImageFetcher({url: new URL(asset.file, directory).href, sha256: asset.sha256});
    const [tape, mounted] = await Promise.all([load({file, sha256}), image && load(image)]);
    return {preset, title: item.title, program: new TextDecoder('utf-8', {fatal: true}).decode(tape.bytes),
        image: mounted?.bytes};
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
