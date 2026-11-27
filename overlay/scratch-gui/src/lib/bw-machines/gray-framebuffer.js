// SPDX-License-Identifier: BSD-3-Clause

/** A visible, byte-per-pixel window in a declared 65C02 framebuffer chip. */
export function grayFramebufferSpec (chips, spec) {
    const {chip, at, width, height, stride, format, publishAt} = spec;
    const source = Array.isArray(chips) && chips.find(entry => entry?.kind === 'framebuffer' && entry.name === chip);
    if (!source || source.at !== at || !Number.isInteger(at) || at < 0 || typeof chip !== 'string' || !['gray8', 'gray6'].includes(format) ||
        ![width, height, stride].every(value => Number.isInteger(value) && value > 0) ||
        width > stride || stride * height > (source.size || 0x2000) || at + stride * height > 0x10000) {
        throw new Error('Invalid 65C02 grayscale framebuffer layout');
    }
    if (publishAt !== undefined && (!Number.isInteger(publishAt) || publishAt < 0 || publishAt > 0xffff ||
        (publishAt >= at && publishAt < at + (source.size || 0x2000)))) {
        throw new Error('Invalid 65C02 framebuffer publication address');
    }
    return {chip, at, width, height, stride, format, ...(publishAt !== undefined && {publishAt})};
}

/** Convert bus-observed pixels to the Controller video contract. */
export function createGrayFramebufferVideo (source, {width, height, stride, format}) {
    if (!source || typeof source.getFrame !== 'function') throw new Error('Missing 65C02 framebuffer chip');
    let video;
    return () => {
        if (video && video.frame === source.frame) return video;
        const gray = source.getFrame();
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byte = gray[y * stride + x];
                const value = format === 'gray6' ? (byte & 0x3f) * 255 / 63 : byte;
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

/** Freeze each frame on the guest's publication write, before the next draw starts. */
export function capturePublishedFramebuffer (machine, source, spec) {
    const video = createGrayFramebufferVideo(source, spec);
    const cpu = machine.cpu;
    const write = cpu.write;
    const publishAt = spec.publishAt;
    let published = null;
    let lastDraw = source.frame;
    cpu.write = (address, value) => {
        if (address !== publishAt) return write.call(cpu, address, value);
        const previous = machine.mem[publishAt];
        const result = write.call(cpu, address, value);
        if (machine.mem[publishAt] === ((previous + 1) & 0xff) && source.frame !== lastDraw) {
            published = video();
            lastDraw = source.frame;
        }
        return result;
    };
    return () => published;
}
