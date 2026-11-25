const validator = () => null;
validator.isRequired = validator;
export default new Proxy({}, {get: () => validator});
