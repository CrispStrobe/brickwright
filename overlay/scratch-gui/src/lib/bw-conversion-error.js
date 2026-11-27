/** VM validation may reject with a serialized object rather than an Error. */
export const conversionFailure = error => {
    let value = error;
    if (typeof value === 'string') {
        try { const decoded = JSON.parse(value); if (decoded && typeof decoded === 'object') value = decoded; } catch { /* plain message */ }
    }
    const details = value?.sb3Errors?.length ? value.sb3Errors : value?.sb2Errors;
    if (value?.validationError && Array.isArray(details)) {
        const issues = details.map(detail => {
            const location = detail.instancePath || detail.dataPath || 'project';
            return `${location}: ${detail.message || detail.keyword || 'invalid value'}`;
        });
        return {message: [value.validationError, ...issues].join('\n'), issues: issues.length ? issues : [value.validationError]};
    }
    if (value?.code === 'PYTHON_CONVERSION_UNSUPPORTED' && Array.isArray(value.diagnostics)) {
        const diagnostics = value.diagnostics.filter(detail => typeof detail?.message === 'string').map(detail => {
            const span = detail.sourceSpan;
            const positions = [span?.start?.line, span?.start?.column, span?.end?.line, span?.end?.column];
            const sourceSpan = positions.every(position => Number.isSafeInteger(position) && position >= 1) ?
                {start: {line: positions[0], column: positions[1]}, end: {line: positions[2], column: positions[3]}} : null;
            return {code: typeof detail.code === 'string' ? detail.code : value.code,
                kind: 'unsupported', severity: 'error', message: detail.message, sourceSpan};
        });
        if (diagnostics.length) {
            const issues = diagnostics.map(detail => detail.sourceSpan ?
                `Line ${detail.sourceSpan.start.line}, column ${detail.sourceSpan.start.column}: ${detail.message}` : detail.message);
            return {message: typeof value.message === 'string' ? value.message : issues.join('\n'), issues,
                code: value.code, sourceSpan: diagnostics[0].sourceSpan, diagnostics};
        }
    }
    let message = typeof value === 'string' ? value : value?.message;
    if (!message) {
        try { message = JSON.stringify(value); } catch { /* cyclic exception object */ }
    }
    if (!message) message = 'The conversion failed without an error message.';
    return {message: String(message), issues: [String(message)]};
};
