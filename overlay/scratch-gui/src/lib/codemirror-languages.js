import {pseudocode as pseudocodeLang} from './cm-lang-pseudocode.js';
import {basic as basicLang} from './cm-lang-basic.js';
import {asm as asmLang} from './cm-lang-asm.js';
import {cardiac as cardiacLang} from './cm-lang-cardiac.js';

// A stable, empty extension leaves CodeMirror usable as plain text while an
// optional grammar is in flight or unavailable.
export const plainTextLanguage = [];

export const immediateCodeMirrorLanguage = language => {
    switch (language) {
    case 'c':
    // NQC is a C dialect — `task`/`sub` and an API, not a different grammar —
    // so it gets C's highlighting rather than a mode of its own. The cost of
    // being wrong here is a keyword shown in the wrong colour.
    case 'nqc':
    case 'python':
    case 'micropython':
    case 'javascript':
        return undefined;
    case 'basic': return basicLang();
    case 'asm': return asmLang();
    case 'cardiac': return cardiacLang();
    case 'pseudocode':
    default:
        return pseudocodeLang();
    }
};

export const loadDeferredCodeMirrorLanguage = language => {
    switch (language) {
    case 'c':
    case 'nqc':
        return import(/* webpackChunkName: "bw-codemirror-lang-cpp" */ '@codemirror/lang-cpp')
            .then(module => module.cpp());
    case 'python':
    case 'micropython':
        return import(/* webpackChunkName: "bw-codemirror-lang-python" */ '@codemirror/lang-python')
            .then(module => module.python());
    case 'javascript':
        return import(/* webpackChunkName: "bw-codemirror-lang-javascript" */ '@codemirror/lang-javascript')
            .then(module => module.javascript());
    default:
        return Promise.resolve(immediateCodeMirrorLanguage(language));
    }
};
