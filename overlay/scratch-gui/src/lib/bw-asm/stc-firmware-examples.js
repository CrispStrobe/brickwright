import {stcAssemblyFirmware} from './stc-image.js';

export const STC_FIRMWARE_EXAMPLES = Object.freeze([
    {id: 'hourglass-stage2', label: 'Hourglass: LED scan and release',
        labelDe: 'Sanduhr: LED und hochohmige Pins',
        description: 'Early hourglass firmware alternates driving one LED and releasing the pins to high impedance. A second LED checks that an unselected line stays dark. Later tilt, sleep and EEPROM stages are not included.',
        descriptionDe: 'Die frühe Sanduhr-Firmware schaltet eine LED ein und gibt die Pins anschließend hochohmig frei. Eine zweite LED zeigt, dass eine unbenutzte Leitung dunkel bleibt. Spätere Neigungs-, Schlaf- und EEPROM-Stufen sind nicht enthalten.'},
    {id: 'clock-mod4', label: 'Clock: four digits and DS1302',
        labelDe: 'Uhr: vier Ziffern und DS1302',
        description: 'Four-digit clock firmware reads the DS1302 and multiplexes common-anode displays. The electrical simulation can run slower than real time. NMEA is disabled; EEPROM settings persistence is not simulated.',
        descriptionDe: 'Die Uhr-Firmware liest den DS1302 und multiplext Anzeigen mit gemeinsamer Anode. Die elektrische Simulation kann langsamer als Echtzeit laufen. NMEA ist ausgeschaltet; EEPROM-Einstellungen werden nicht dauerhaft gespeichert.'}
]);

export const STC_FIRMWARE_ASSET_ROOT = 'static/firmware/bw8051-1/';

/** Both artifacts load before the caller changes the current circuit. */
export async function loadStcFirmwareExample (id, fetchAsset = globalThis.fetch) {
    const example = STC_FIRMWARE_EXAMPLES.find(item => item.id === id);
    if (!example) throw new Error('Unknown STC firmware example');
    const read = async suffix => {
        const response = await fetchAsset(`${STC_FIRMWARE_ASSET_ROOT}${id}.${suffix}`);
        if (!response.ok) throw new Error(`${id}.${suffix}: HTTP ${response.status}`);
        return suffix === 'json' ? response.json() : response.text();
    };
    const [circuit, hex] = await Promise.all([read('json'), read('hex')]);
    if (!Array.isArray(circuit.parts) || !(Array.isArray(circuit.nets) || Array.isArray(circuit.wires))) {
        throw new Error('Firmware example has no circuit');
    }
    const device = String(circuit.board?.device || '').toLowerCase();
    const detail = stcAssemblyFirmware({target: device, bytes: new TextEncoder().encode(hex)}, circuit.board?.fosc);
    detail.firmware.name = `${id}.hex`;
    return {example, circuit, detail};
}
