// The DOS uBASIC tokenizer recognises lower-case keywords and variables.
// Keep the user's text in Code and preserve the contents of string literals.
export const ubasicSource = source => source.replace(/"[^"\r\n]*"|[A-Z]+/g,
    token => token.startsWith('"') ? token : token.toLowerCase());
