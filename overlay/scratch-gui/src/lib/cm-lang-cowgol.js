import {StreamLanguage} from '@codemirror/language';

const keywords = /^(include|var|const|typedef|record|sub|endsub|end|if|then|elseif|else|while|loop|for|from|to|step|break|continue|return|and|or|not|as|is|sizeof|alias|implements|extern|intern)$/;
const types = /^(u?int(8|16|32|64)|uintptr|intptr|int|uint|bool)$/;

export const cowgolMode = {
    token (stream) {
        if (stream.eatSpace()) return null;
        if (stream.match(/^#.*/)) return 'comment';
        if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
        if (stream.match(/^'(?:[^'\\]|\\.)*'?/)) return 'string';
        if (stream.match(/^(?:0x[\da-fA-F]+|0b[01]+|\d+)\b/)) return 'number';
        if (stream.match(/^[A-Za-z_]\w*/)) {
            const word = stream.current();
            return keywords.test(word) ? 'keyword' : types.test(word) ? 'typeName' : 'variableName';
        }
        if (stream.match(/^(?::=|<=|>=|!=|<<|>>|[+*/%&|^~<>=-])/)) return 'operator';
        stream.next();
        return null;
    },
    languageData: {commentTokens: {line: '#'}}
};

export const cowgol = () => StreamLanguage.define(cowgolMode);
