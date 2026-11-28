// The parser and emitter belong to sb3-creator. This lazy entry point keeps
// Cowgol on the same source/pin boundary as the other Code-tab languages.
export {default} from '../sb3-creator-cowgol-reader.js';
import SB3Creator from '../sb3-creator-register-art.js';
export const generateCowgol = (project, options) => new SB3Creator().generateCowgol(project, options);
