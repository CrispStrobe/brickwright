// SPDX-License-Identifier: BSD-3-Clause

/** A visible, byte-per-pixel window in a declared 65C02 framebuffer chip. */
export function grayFramebufferSpec (chips, spec) {
    const {chip, at, width, height, stride, format} = spec;
    const source = Array.isArray(chips) && chips.find(entry => entry?.kind === 'framebuffer' && entry.name === chip);
    if (!source || source.at !== at || !Number.isInteger(at) || at < 0 || typeof chip !== 'string' || format !== 'gray8' ||
        ![width, height, stride].every(value => Number.isInteger(value) && value > 0) ||
        width > stride || stride * height > (source.size || 0x2000) || at + stride * height > 0x10000) {
        throw new Error('Invalid 65C02 grayscale framebuffer layout');
    }
    return {chip, at, width, height, stride, format};
}

/** Convert bus-observed pixels to the Controller video contract. */
export function createGrayFramebufferVideo (source, {width, height, stride}) {
    if (!source || typeof source.getFrame !== 'function') throw new Error('Missing 65C02 framebuffer chip');
    let video;
    return () => {
        if (video && video.frame === source.frame) return video;
        const gray = source.getFrame();
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const value = gray[y * stride + x];
                const pixel = (y * width + x) * 4;
                rgba[pixel] = value;
                rgba[pixel + 1] = value;
                rgba[pixel + 2] = value;
                rgba[pixel + 3] = 255;
            }
        }
        video = {width, height, rgba, frame: source.frame, signal: true};
        return video;
    };
}
