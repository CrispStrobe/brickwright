// Validator-only fixture shim; execution and component behavior remain real.
const validator = () => null;
validator.isRequired = validator;
const factories = new Set(['arrayOf', 'objectOf', 'oneOf', 'oneOfType', 'shape', 'exact', 'instanceOf']);
export default new Proxy({}, {get: (_, key) => factories.has(key) ? () => validator : validator});
