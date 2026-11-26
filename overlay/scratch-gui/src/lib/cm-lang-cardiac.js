import {StreamLanguage} from '@codemirror/language';
import {CARDIAC_MNEMONICS} from './cardiac-program.js';

const statement = new Set([...CARDIAC_MNEMONICS, 'ORG', 'DAT', 'ENTRY']);

export const cardiac = () => StreamLanguage.define({
    token(stream) {
        if (stream.eatSpace()) return null;
        if (stream.match(/^(?:;|#|\/\/).*/)) return 'comment';
        if (stream.match(/^[a-z_]\w*:/i)) return 'definition';
        if (stream.match(/^[+-]?\d+/)) return 'number';
        const identifier = stream.match(/^[a-z_]\w*/i);
        if (identifier) return statement.has(identifier[0].toUpperCase()) ? 'keyword' : null;
        stream.next();
        return null;
    },
    languageData: {commentTokens: {line: ';'}}
});
