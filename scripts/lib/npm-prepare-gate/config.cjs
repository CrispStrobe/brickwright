// npm's flat configuration supplies an absolute npm-cli.js path to pacote,
// so PATH alone cannot serialize Git preparation. Redirect that executable
// through the same gate; the gate executes the real npm with unchanged argv.
// Keep config.npmBin itself intact: npm exports it as lifecycle npm_execpath.
if (process.env.BW_LITE_SERIAL_GIT_PREPARE === '1') {
    const fs = require('node:fs');
    const path = require('node:path');
    const real = fs.realpathSync(process.env.BW_LITE_REAL_NPM);
    if (path.basename(real) !== 'npm-cli.js') throw new Error('Unrecognized npm executable layout');
    const npmRoot = path.dirname(path.dirname(real));
    const invoked = process.argv[1] && fs.existsSync(process.argv[1]) ? fs.realpathSync(process.argv[1]) : null;
    // NODE_OPTIONS is inherited by compiler/scripts too. They need no npm
    // configuration loading or patching, and retain their original startup.
    if (invoked !== real) return;
    const configPath = require.resolve('@npmcli/config', {paths: [npmRoot]});
    const Config = require(configPath);
    const gate = path.join(__dirname, 'npm');
    class SerialPreparationConfig extends Config {
        get flat () {
            const options = super.flat;
            options.npmBin = gate;
            return options;
        }
    }
    require.cache[configPath].exports = SerialPreparationConfig;
}
