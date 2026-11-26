export const MSBASIC_ROM_SHA256 = '89c5072ea5162f8990676492d8a4c04c8b4dd3d54186e48ca576f93f2e63816c';

export async function isBundledMicrosoftBasic (bytes) {
    if (bytes?.length !== 0x8000 || !globalThis.crypto?.subtle) return false;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') === MSBASIC_ROM_SHA256;
}

// Called between CPU slices. Only answer questions from this cold boot, in order.
export function createBasicStartup (prompts) {
    let next = 0;
    return {
        answer (lastLine, sendSerial) {
            const prompt = prompts[next];
            if (prompt && lastLine?.trim() === prompt.expect && sendSerial(prompt.send) === true) next++;
        },
        reset () { next = 0; }
    };
}

/** BASIC 1.1 recognizes uppercase tokens. Quoted strings retain their case. */
export function microsoftBasicLine(line) {
    return line.split('"').map((part, index) => index % 2 ? part :
        part.replace(/[a-z]/g, letter => letter.toUpperCase())).join('"') + '\r';
}
