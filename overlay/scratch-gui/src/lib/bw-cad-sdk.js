// SPDX-License-Identifier: BSD-3-Clause
let sdk;
export const cadAssetURL = path => new URL(`static/cad-sdk/${path}`, document.baseURI).href;
export const loadCadSDK = () => {
    if (!sdk) sdk = import(/* webpackIgnore: true */ cadAssetURL('sdk.js')).catch(error => {
        sdk = null;
        throw error;
    });
    return sdk;
};
