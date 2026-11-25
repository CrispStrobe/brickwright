// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('expected deployed commit required');
const url = 'https://brickwright.vercel.app/brickwright-version.json';
for (let attempt = 0; attempt < 12; attempt++) {
    const receipt = await fetch(`${url}?commit=${sha}&attempt=${attempt}`, {cache: 'no-store', signal: AbortSignal.timeout(10000)})
        .then(response => response.ok ? response.json() : null).catch(() => null);
    if (receipt?.commit === sha) {
        console.log(`Production domain serves ${sha}`);
        process.exit(0);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
}
throw new Error(`Deployment returned, but the production domain did not serve ${sha}`);
