/** Preview BASIC's ACIA text on a monitor while its VGA card is waiting for sync. */
export function mirrorBasicSerialOnVga(card, readLines, createCanvas = () => document.createElement('canvas')) {
    const hardwareFrame = card.videoFrame.bind(card);
    let canvas;
    let lastText;
    let frame;
    // Hardware uses its nonnegative VRAM write count. Keep the preview's
    // counters distinct so renderers repaint when switching sources.
    let generation = -1;
    card.videoFrame = () => {
        const video = hardwareFrame();
        if (video.signal) return video;
        const {width, height} = video;
        if (!canvas) canvas = createCanvas();
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            lastText = undefined;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return video;
        ctx.font = '9px monospace';
        const columns = Math.max(1, Math.floor((width - 8) / ctx.measureText('M').width));
        const rows = Math.max(1, Math.floor((height - 17) / 10));
        const visible = [];
        const lines = readLines();
        for (let i = lines.length - 1; i >= 0 && visible.length < rows; i--) {
            const line = lines[i];
            for (let start = Math.floor(Math.max(0, line.length - 1) / columns) * columns;
                start >= 0 && visible.length < rows; start -= columns) {
                visible.push(line.slice(start, start + columns));
            }
        }
        visible.reverse();
        const text = visible.join('\n');
        if (text === lastText) return frame;
        lastText = text;
        ctx.fillStyle = '#10171c';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#25465a';
        ctx.fillRect(0, 0, width, 14);
        ctx.fillStyle = '#e8f1f7';
        ctx.textBaseline = 'top';
        ctx.fillText('ACIA serial mirror', 4, 2);
        ctx.fillStyle = '#ccedda';
        for (const [row, line] of visible.entries()) ctx.fillText(line, 4, 16 + row * 10);
        frame = {width, height, rgba: ctx.getImageData(0, 0, width, height).data,
            signal: true, frame: --generation};
        return frame;
    };
}
