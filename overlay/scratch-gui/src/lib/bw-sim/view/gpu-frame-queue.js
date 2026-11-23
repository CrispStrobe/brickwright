// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe

const FENCE_TIMEOUT_MS = 750;
const FALLBACK_FRAME_MS = 100;

// Keep at most one frame in flight. A driver that stops reporting fence
// progress falls back to paced drawing so a running scene never freezes.
export const createGpuFrameQueue = (gl, now = () => performance.now()) => {
    const supported = typeof gl.fenceSync === 'function';
    let fence = null;
    let submittedAt = 0;
    let fallback = false;
    let nextFrame = 0;
    const release = () => {
        if (fence && !gl.isContextLost()) gl.deleteSync(fence);
        fence = null;
    };
    return {
        busy () {
            if (!supported) return false;
            if (gl.isContextLost()) { fence = null; return false; }
            if (fallback) return now() < nextFrame;
            if (!fence) return false;
            const status = gl.getSyncParameter(fence, gl.SYNC_STATUS);
            if (status === gl.SIGNALED) {
                release();
                return false;
            }
            if (status === gl.UNSIGNALED && now() - submittedAt < FENCE_TIMEOUT_MS) return true;
            release();
            fallback = true;
            return false;
        },
        submitted () {
            if (!supported || gl.isContextLost()) return;
            const time = now();
            if (fallback) { nextFrame = time + FALLBACK_FRAME_MS; return; }
            // A forced frame's new fence covers all earlier commands too.
            release();
            fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            submittedAt = time;
            if (fence) gl.flush();
            else {
                fallback = true;
                nextFrame = time + FALLBACK_FRAME_MS;
            }
        },
        dispose: release,
        get pending () { return fence ? 1 : 0; }
    };
};
