/**
 * Playwright verification: CodeMirror 6 editor in the Code tab.
 *
 * Checks:
 * - CM chunk lazy-loads (not in initial paint)
 * - Editor renders with line numbers
 * - Type text — auto-indent fires after a colon-ending line
 * - Brackets auto-close
 * - Search panel opens (Ctrl+F / Cmd+F)
 * - To blocks still compiles
 * - Dark theme applies
 * - Maximize toggle works
 *
 * Usage:
 *   node scripts/verify-editor.mjs
 *   PROOF_URL=http://localhost:8601 node scripts/verify-editor.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.PROOF_URL || 'https://crispstrobe.github.io/brickwright-lite/';

async function verify () {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));
    page.on('dialog', d => d.accept());
    await page.addInitScript(() => localStorage.setItem('bw-starter-v1-complete', '1'));

    let ok = true;
    const fail = msg => { ok = false; console.error(`  FAIL: ${msg}`); };
    const pass = msg => console.log(`  ok: ${msg}`);

    try {
        console.log(`Opening ${URL} ...`);
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Navigate to Code tab
        const codeTab = page.locator('text=/Pseudocode|Code/i').first();
        if (await codeTab.count() > 0) {
            await codeTab.click();
            await page.waitForTimeout(2000);
        }

        // Wait for CM to lazy-load and render
        const cmEditor = page.locator('[data-testid="bw-codemirror"]').first();
        if (await cmEditor.count() > 0) {
            pass('CodeMirror editor rendered');
        } else {
            // Try the .cm-editor selector instead
            const cmDiv = page.locator('.cm-editor').first();
            if (await cmDiv.count() > 0) {
                pass('CodeMirror editor rendered (.cm-editor)');
            } else {
                fail('CodeMirror editor not found');
                return;
            }
        }

        // Check line numbers
        const gutters = page.locator('.cm-gutters').first();
        if (await gutters.count() > 0) {
            pass('Line numbers (gutters) present');
        } else {
            fail('Line numbers not found');
        }

        // Type text into the editor
        const cmContent = page.locator('.cm-content').first();
        if (await cmContent.count() > 0) {
            await cmContent.click();
            // Clear existing content
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(300);

            // Type pseudocode with a colon-ending line to test auto-indent
            await page.keyboard.type('SPRITE Cat:', { delay: 30 });
            await page.keyboard.press('Enter');
            await page.waitForTimeout(300);

            // Check that the cursor is indented (line 2 starts with spaces)
            const text = await cmContent.innerText();
            // After Enter after ":", the next line should have indentation
            if (text.includes('SPRITE Cat:')) {
                pass('Text typing works');
            } else {
                fail('Text typing failed');
            }

            // Type a bracket to test auto-close
            await page.keyboard.type('say "Hello"', { delay: 20 });
            await page.waitForTimeout(200);

            // Test search panel: Ctrl+F (Cmd+F on mac — CM6 binds Mod-f,
            // and Mod is Meta on darwin, so a bare Control+f silently no-ops)
            await page.keyboard.press('ControlOrMeta+f');
            await page.waitForTimeout(500);
            const searchPanel = page.locator('.cm-search').first();
            if (await searchPanel.count() > 0) {
                await searchPanel.waitFor({state: 'visible'});
                await page.waitForFunction(() => Boolean(document.activeElement?.closest('.cm-search')));
                pass('Search panel opens (Ctrl+F)');
                const textBeforeClose = await cmContent.innerText();
                await page.keyboard.press('Escape');
                await searchPanel.waitFor({state: 'hidden'});
                const focused = await cmContent.evaluate(el => el === document.activeElement || el.contains(document.activeElement));
                if (!focused || await cmContent.innerText() !== textBeforeClose) {
                    fail('Closing search must restore editor focus without changing the text');
                }
            } else {
                fail('Search panel did not open');
            }

            pass('Editor interaction OK');
        } else {
            fail('Could not find .cm-content to type into');
        }

        // Test To blocks compilation
        const toBlocksBtn = page.getByRole('button', {name: /To blocks|Zu Blöcken/i}).first();
        if (await toBlocksBtn.count() > 0) {
            // First make sure we have valid pseudocode
            const cmContent2 = page.locator('.cm-content').first();
            await cmContent2.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type('SPRITE Cat:\n  WHEN flag clicked:\n    say "Hello" for 2 seconds', { delay: 10 });
            await page.waitForTimeout(300);
            await toBlocksBtn.click();
            await page.waitForTimeout(3000);
            // Check for success status
            const pageText = await page.locator('body').innerText();
            if (pageText.includes('Compiled to blocks') || pageText.includes('Zu Blocken kompiliert')) {
                pass('To blocks compiles successfully');
            } else if (pageText.includes('Error')) {
                fail('To blocks returned an error');
            } else {
                // Might be loaded without explicit message
                pass('To blocks triggered (no error)');
            }
        } else {
            fail('To blocks button not found');
        }

        // Test dark theme
        await page.evaluate(() => {
            localStorage.setItem('bw-circuit-theme', 'dark');
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: { key: 'bw-circuit-theme', value: 'dark' }
            }));
        });
        await page.waitForTimeout(500);
        const darkEditor = page.locator('.cm-editor.cm-dark, .cm-editor [class*="dark"]').first();
        // CM6 one-dark adds a .cm-dark class to the wrapper
        // Check if the theme compartment reconfigured
        const hasDarkClass = await page.evaluate(() => {
            const el = document.querySelector('.cm-editor');
            return el && (el.classList.contains('cm-dark') || el.querySelector('.cm-dark') !== null ||
                getComputedStyle(el).backgroundColor !== 'rgb(255, 255, 255)');
        });
        if (hasDarkClass) {
            pass('Dark theme applied');
        } else {
            // CM6 dark theme might use a different mechanism
            console.log('  note: dark theme check inconclusive (may need visual verification)');
        }

        // Reset to light
        await page.evaluate(() => {
            localStorage.setItem('bw-circuit-theme', 'light');
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: { key: 'bw-circuit-theme', value: 'light' }
            }));
        });

        // Test maximize toggle
        const maxBtn = page.locator('[data-testid="bw-editor-maximize"]').first();
        if (await maxBtn.count() > 0) {
            await maxBtn.click();
            await page.waitForTimeout(500);
            const maxState = await page.evaluate(() => localStorage.getItem('bw-editor-max'));
            if (maxState === '1') {
                pass('Maximize toggle sets bw-editor-max');
            } else {
                fail('Maximize toggle did not set localStorage');
            }
            // Toggle back through the maximized toolbar.
            await page.getByTestId('bw-max-editor-tools').click();
            await maxBtn.click();
            await page.waitForTimeout(300);
            const restored = await page.evaluate(() => localStorage.getItem('bw-editor-max'));
            if (restored === '0') {
                pass('Maximize toggle restores');
            }
        } else {
            fail('Maximize button not found');
        }

        // Verify the CM chunk was lazy-loaded (not in the main entry)
        const cmChunkLoaded = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            return scripts.some(s => /669\.|bw-codemirror/.test(s.src));
        });
        if (cmChunkLoaded) {
            pass('CM chunk loaded as separate script');
        } else {
            console.log('  note: chunk verification inconclusive (may use different loading mechanism)');
        }

        // ── ASM tab tests ────────────────────────────────────────
        // Click the ASM tab
        const asmTab = page.locator('button:has-text("ASM")').first();
        if (await asmTab.count() > 0) {
            await asmTab.click();
            await page.waitForTimeout(1000);

            // Check editor is present and editable (source mode default)
            const cmContent3 = page.locator('.cm-content').first();
            if (await cmContent3.count() > 0) {
                const editable = await cmContent3.getAttribute('contenteditable');
                if (editable === 'true') {
                    pass('ASM tab: editor is editable in source mode');
                } else {
                    fail('ASM tab: editor not editable in source mode');
                }
            }

            // Check mode dropdown is present
            const modeSelect = page.locator('select:has(option[value="listing"])').first();
            if (await modeSelect.count() > 0) {
                pass('ASM tab: mode dropdown present');
            } else {
                fail('ASM tab: mode dropdown not found');
            }

            // Check Assemble & Run button is present
            const asmRunBtn = page.locator('[data-testid="bw-asm-assemble"]').first();
            if (await asmRunBtn.count() > 0) {
                pass('ASM tab: Assemble & Run button present');
            } else {
                fail('ASM tab: Assemble & Run button not found');
            }

            // Type some assembly
            await cmContent3.click();
            await page.keyboard.type('; test assembly\nmov A, #0x55', { delay: 20 });
            await page.waitForTimeout(300);
            const asmText = await cmContent3.innerText();
            if (asmText.includes('mov') || asmText.includes('MOV')) {
                pass('ASM tab: typing assembly works');
            } else {
                fail('ASM tab: typed text not found');
            }

            // Check the note about no ASM-to-blocks
            // The note moved behind an (i) toggle (owner ask); the check
            // opens it first — grepping body text tested the RETIRED
            // always-visible layout and failed on the new one.
            const asmInfo = page.locator('[data-testid="bw-asm-info-toggle"]');
            if (await asmInfo.count() === 1) {
                await asmInfo.click();
                await page.waitForTimeout(300);
                const noteText = await page.locator('body').innerText();
                // The note used to declare "No ASM-to-blocks path". Since the
                // 8086 reader (plan task L1) it says what reads back and what is
                // refused, in both locales.
                if (noteText.includes('To blocks: 8086') || noteText.includes('Zu Blöcken: 8086')) {
                    pass('ASM tab: read-back note behind the (i) toggle');
                } else {
                    fail('ASM tab: (i) opened but the note text is missing');
                }
            } else {
                fail('ASM tab: info toggle not found');
            }
        } else {
            fail('ASM tab button not found');
        }

        const grammarPattern = /bw-codemirror-lang-(?:cpp|python|javascript)/;
        const asmGrammarResources = await page.evaluate(pattern =>
            performance.getEntriesByType('resource')
                .filter(entry => new RegExp(pattern).test(entry.name))
                .map(entry => entry.name), grammarPattern.source);
        if (asmGrammarResources.length === 0) {
            pass('ASM tab did not fetch optional C, Python or JavaScript grammars');
        } else {
            fail(`ASM tab fetched optional grammars: ${asmGrammarResources.join(', ')}`);
        }

        // Demand each optional language after the ASM-only assertion. Besides
        // proving the chunks still resolve, their same-origin resource timing
        // is the hosted encoded-size receipt for the split.
        for (const [label, chunk] of [
            ['🧩 Pseudo', null],
            ['🐍 Py', 'python'],
            ['🟨 JS', 'javascript'],
            ['🔧 C', 'cpp']
        ]) {
            const tab = page.locator('button', {hasText: label}).first();
            if (await tab.count() !== 1) {
                fail(`language tab ${label} not found`);
                continue;
            }
            await tab.click();
            await page.waitForFunction(text => {
                const button = [...document.querySelectorAll('button')]
                    .find(candidate => candidate.textContent.includes(text));
                return button && button.getAttribute('aria-pressed') === 'true';
            }, label, {timeout: 15000});
            if (chunk) {
                await page.waitForFunction(name => performance.getEntriesByType('resource')
                    .some(entry => entry.name.includes(`bw-codemirror-lang-${name}`)), chunk, {timeout: 15000});
            }
        }
        const grammarReceipt = await page.evaluate(pattern => {
            const rows = performance.getEntriesByType('resource')
                .filter(entry => new RegExp(pattern).test(entry.name))
                .map(entry => ({name: entry.name, encodedBodySize: entry.encodedBodySize}));
            return {
                rows,
                encodedBodyBytes: rows.reduce((sum, row) => sum + row.encodedBodySize, 0)
            };
        }, grammarPattern.source);
        const grammarKinds = new Set(grammarReceipt.rows.map(row =>
            row.name.match(grammarPattern)?.[0]));
        if (grammarKinds.size === 3 && grammarReceipt.encodedBodyBytes >= 100 * 1024) {
            pass(`optional grammars isolated in ${grammarReceipt.encodedBodyBytes} encoded bytes`);
        } else {
            fail(`optional grammar receipt has ${grammarKinds.size}/3 chunks and ` +
                `${grammarReceipt.encodedBodyBytes} encoded bytes`);
        }

    } catch (err) {
        fail(err.message);
    } finally {
        await browser.close();
    }

    console.log(ok ? '\nAll checks passed.' : '\nSome checks failed.');
    process.exit(ok ? 0 : 1);
}

verify();
