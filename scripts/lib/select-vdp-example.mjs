// SPDX-License-Identifier: BSD-3-Clause
// Select only after the actual filtered example is visible; Playwright's click
// then performs its own actionability checks as well.
export async function selectVdpExample (page) {
    try {
        await page.locator('input[placeholder*="earch"], input[type="search"]').first().fill('VDP', {timeout: 4000});
    } catch (_) { /* The example may already be visible without search. */ }
    const example = page.locator('text=/6502 \\+ VDP/i').first();
    // Keep visibility and actionability within Playwright's existing 30 s
    // default click budget instead of giving each operation a fresh budget.
    const deadline = performance.now() + 30000;
    await example.waitFor({state: 'visible', timeout: 30000});
    const remaining = Math.max(1, Math.floor(deadline - performance.now()));
    await example.click({timeout: remaining});
}
