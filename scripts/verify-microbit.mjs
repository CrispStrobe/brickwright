import {openCodeActions as openCodeMenu} from './lib-code-actions.mjs';
/**
 * Playwright verification: micro:bit MicroPython tab + simulator.
 *
 * Checks:
 * - Select micro:bit device → MicroPython tab appears
 * - Type/load a blink program → switch to micro:bit tab → sees `from microbit import *`
 * - Click "Run on Simulator" → right pane switches to sim iframe
 * - Simulator iframe loads (simulator.html present)
 * - Serial output area present
 * - Stop/Reset/Clear buttons present
 * - Stage-header micro:bit toggle button present
 * - Global green flag and the board-face Play button both run current code
 *
 * Usage:
 *   node scripts/verify-microbit.mjs
 *   PROOF_URL=http://localhost:8601 node scripts/verify-microbit.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.PROOF_URL || 'https://crispstrobe.github.io/brickwright-lite/';

async function verify () {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('dialog', d => d.accept());

    let ok = true;
    const fail = msg => { ok = false; console.error(`  FAIL: ${msg}`); };
    const pass = msg => console.log(`  ok: ${msg}`);

    // The starter-journeys overlay covers the page on a first visit and
    // intercepts every click — this gate spent its whole timeout retrying a
    // click the backdrop was swallowing. Every gate CI actually runs sets
    // this; the ones it does not run are where the rot collected.
    await page.addInitScript(() => {
        try {
            localStorage.setItem('bw-starter-v1-complete', '1');
        } catch (e) { /* private mode: the overlay is the least of it */ }
    });

    try {
        console.log(`Opening ${URL} ...`);
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Navigate to Code tab
        const codeTab = page.locator('text=/Pseudocode|Code/i').first();
        if (await codeTab.count() > 0) {
            await codeTab.click();
            await page.waitForTimeout(2000);
        } else {
            fail('Code tab not found');
            await browser.close();
            process.exit(1);
        }

        // ── 1. Verify micro:bit tab is NOT visible before selecting device ──
        let microbitTab = page.locator('button:has-text("micro:bit")').first();
        if (await microbitTab.count() === 0) {
            pass('micro:bit tab hidden when no device selected');
        } else {
            console.log('  note: micro:bit tab visible without device (might have prior state)');
        }

        // ── 2. Select micro:bit device ──
        const deviceSelect = page.locator('select[title*="Target device"]').first();
        if (await deviceSelect.count() > 0) {
            await deviceSelect.selectOption('microbit');
            await page.waitForTimeout(500);
            pass('Selected micro:bit device');
        } else {
            fail('Device selector not found');
            await browser.close();
            process.exit(1);
        }

        // ── 3. Verify micro:bit tab now appears ──
        microbitTab = page.locator('button:has-text("micro:bit")').first();
        if (await microbitTab.count() > 0) {
            pass('micro:bit tab appeared after selecting device');
        } else {
            fail('micro:bit tab not visible after selecting device');
        }

        // ── 4. Type a blink program in pseudocode ──
        const cmContent = page.locator('.cm-content').first();
        if (await cmContent.count() > 0) {
            await cmContent.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(300);
            // insertText, not type(): typing a newline makes the editor
            // auto-indent, and the typed spaces then stack on top, so the
            // program the gate ran was not the program written — its later
            // lines were over-indented and the parser dropped them (a
            // warning). Since D5 such lines are refused, and the gate would
            // test nothing; insertText puts in exactly this text.
            await page.keyboard.insertText(
                'DEVICE MICROBIT\nPIN led = P0 OUTPUT\n\nSPRITE Cat:\n  WHEN flag clicked:\n    forever:\n      turn on led\n      wait 0.5 seconds\n      turn off led\n      wait 0.5 seconds\n      print "blink"'
            );
            await page.waitForTimeout(500);
            pass('Typed blink program');
        } else {
            fail('Cannot find editor content area');
        }

        // ── 5. Switch to micro:bit tab → verify MicroPython output ──
        microbitTab = page.locator('button:has-text("micro:bit")').first();
        if (await microbitTab.count() > 0) {
            await microbitTab.click();
            await page.waitForTimeout(3000);

            const editorText = await page.locator('.cm-content').first().innerText().catch(() => '');
            if (editorText.includes('from microbit import')) {
                pass('MicroPython output contains "from microbit import"');
            } else {
                // Also check fallback textarea
                const ta = page.locator('textarea').first();
                const taText = await ta.inputValue().catch(() => '');
                if (taText.includes('from microbit import')) {
                    pass('MicroPython output contains "from microbit import" (fallback editor)');
                } else {
                    fail('MicroPython output missing "from microbit import"');
                    console.log('    got:', (editorText || taText).slice(0, 200));
                }
            }

            // Check for pin0 reference
            const fullText = await page.locator('.cm-content').first().innerText().catch(() => '');
            if (fullText.includes('pin0') || fullText.includes('write_digital')) {
                pass('MicroPython output contains pin operations');
            } else {
                console.log('  note: pin operations not found (may be expected for error output)');
            }

            // Check for print()
            if (fullText.includes('print(')) {
                pass('MicroPython output contains print()');
            } else {
                console.log('  note: print() not found in MicroPython output');
            }
        } else {
            fail('micro:bit tab not clickable');
        }

        // ── 6. Verify micropython bar (read-only hint + Run on Simulator) ──
        const mpBar = page.locator('[data-testid="bw-micropython-bar"]').first();
        if (await mpBar.count() > 0) {
            pass('MicroPython bar present (read-only hint)');
        } else {
            fail('MicroPython bar not found');
        }

        const flashBtn = page.locator('[data-testid="bw-microbit-flash"]').first();
        if (await flashBtn.count() > 0) {
            pass('Run on Simulator button present');
        } else {
            fail('Run on Simulator button not found');
        }

        // ── 7. Click Run on Simulator ──
        if (await flashBtn.count() > 0 && await flashBtn.isEnabled()) {
            await flashBtn.click();
            await page.waitForTimeout(2000);

            // Check that the right pane switched to the simulator
            const simPane = page.locator('[data-testid="bw-microbit-sim-pane"]').first();
            if (await simPane.count() > 0) {
                pass('Simulator pane rendered');
            } else {
                fail('Simulator pane not found after clicking Run');
            }

            // Check iframe
            const simIframe = page.locator('[data-testid="bw-microbit-iframe"]').first();
            if (await simIframe.count() > 0) {
                pass('Simulator iframe present');
                const src = await simIframe.getAttribute('src');
                if (src && src.includes('microbit-sim/simulator.html')) {
                    pass('Iframe src points to self-hosted simulator');
                } else {
                    fail(`Iframe src unexpected: ${src}`);
                }
            } else {
                fail('Simulator iframe not found');
            }

            // Check serial output area
            const serial = page.locator('[data-testid="bw-microbit-serial"]').first();
            if (await serial.count() > 0) {
                pass('Serial output terminal present');
            } else {
                fail('Serial output terminal not found');
            }

            // Check stop/reset buttons
            const stopBtn = page.locator('[data-testid="bw-microbit-stop"]').first();
            const resetBtn = page.locator('[data-testid="bw-microbit-reset"]').first();
            const clearBtn = page.locator('[data-testid="bw-microbit-clear-serial"]').first();
            if (await stopBtn.count() > 0) pass('Stop button present');
            else fail('Stop button not found');
            if (await resetBtn.count() > 0) pass('Reset button present');
            else fail('Reset button not found');
            if (await clearBtn.count() > 0) pass('Clear button present');
            else fail('Clear button not found');

            // Code-tab Run stages the program; the in-board Play gesture
            // unlocks audio and starts it. Prove that first-run handoff.
            const frame = page.frameLocator('[data-testid="bw-microbit-iframe"]');
            const boardPlay = frame.locator('.play-button').first();
            if (await boardPlay.count() > 0) {
                await boardPlay.click();
                await page.waitForFunction(element => !element.disabled, await stopBtn.elementHandle());
                if (await stopBtn.isEnabled()) pass('Code Run plus board-face Play starts the current program');
                else fail('Code Run did not stage a program for board-face Play');
            } else {
                fail('Board-face Play button not found');
            }

            await stopBtn.click();
            await page.waitForFunction(element => element.disabled, await stopBtn.elementHandle());
            const greenFlag = page.locator('[class*="green-flag_green-flag"], [aria-label*="Go"], [aria-label*="Start"]')
                .first();
            if (await greenFlag.count() > 0) {
                await greenFlag.click();
                await page.waitForFunction(element => !element.disabled, await stopBtn.elementHandle());
                if (await stopBtn.isEnabled()) pass('Global green flag runs the current MicroPython program');
                else fail('Global green flag did not start the micro:bit simulator');
            } else {
                fail('Global green flag not found');
            }

            // Consume the pending run, stop once more, then use the board face.
            await stopBtn.click();
            await page.waitForFunction(element => element.disabled, await stopBtn.elementHandle());
            if (await boardPlay.count() > 0) {
                await boardPlay.click();
                await page.waitForFunction(element => !element.disabled, await stopBtn.elementHandle());
                if (await stopBtn.isEnabled()) pass('Board-face Play requests and runs the current program');
                else fail('Board-face Play had no current program to run');
            } else {
                fail('Board-face Play button not found');
            }
        } else {
            console.log('  note: Run on Simulator button disabled or not found — skipping sim pane checks');
        }

        // ── 8. Stage-header micro:bit toggle ──
        // The toggle might not be visible if stage header is in fullscreen mode
        const bodyText = await page.locator('body').first().innerHTML();
        if (bodyText.includes('icon--microbit') || bodyText.includes('microbitSim')) {
            pass('Stage-header micro:bit toggle present in DOM');
        } else {
            console.log('  note: stage-header micro:bit icon not found in DOM (may need rebuild)');
        }

        // ── 9. Verify editor is read-only in micro:bit tab ──
        const cmContentRO = page.locator('.cm-content').first();
        if (await cmContentRO.count() > 0) {
            const editable = await cmContentRO.getAttribute('contenteditable');
            if (editable === 'false') {
                pass('micro:bit tab editor is read-only');
            } else {
                console.log(`  note: contenteditable=${editable} (may vary by CM config)`);
            }
        }

        // ── 10. Calliope is a real selectable simulator target, not a hidden
        // alias and not a circuit-bench error. Retarget in the live UI, run,
        // and require device-correct board identity on the shared pane.
        await deviceSelect.selectOption('calliopemini');
        const simFrameElement = page.locator('[data-testid="bw-microbit-iframe"]').first();
        await page.waitForFunction(element => /Calliope mini/i.test(element.title),
            await simFrameElement.elementHandle());
        const calliopeTitle = await simFrameElement.getAttribute('title').catch(() => '');
        if (/Calliope mini/i.test(calliopeTitle || '')) pass('Calliope mini has device-correct simulator identity');
        else fail(`Calliope simulator identity missing (title=${JSON.stringify(calliopeTitle)})`);
        const visibleError = await page.locator('body').first().innerText();
        if (!/matching circuit bench is not available/i.test(visibleError)) {
            pass('Calliope retarget does not demand a circuit bench');
        } else {
            fail('Calliope retarget still demands a circuit bench');
        }

        // ── 11. The real catalog journey that exposed the remaining gap:
        // load an authored micro:bit example, retarget it to Calliope, then
        // reach generated code and run it. A device-only test missed that the
        // tab visibility predicate named microbit but omitted calliopemini.
        await deviceSelect.selectOption('microbit');
        const actions = page.locator('[data-testid="bw-code-actions"]');
        await openCodeMenu(page);
        const catalogToggle = page.locator('[data-testid="bw-catalog-toggle"]');
        await catalogToggle.waitFor({state: 'visible', timeout: 15000});
        await catalogToggle.click();
        const catalogSearch = page.locator('[data-testid="bw-catalog-search"]');
        await catalogSearch.fill('Sensor Readout');
        const sensorExample = page.locator('[data-testid="bw-catalog-item"][title="mb02-sensors"]');
        await sensorExample.waitFor({state: 'visible', timeout: 15000});
        await sensorExample.click();
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.cm-content'))
            .some(element => /DEVICE MICROBIT/.test(element.textContent || '')));
        pass('authored Sensor Readout example loaded as micro:bit pseudocode');
        await deviceSelect.selectOption('calliopemini');
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.cm-content'))
            .some(element => /DEVICE CALLIOPEMINI/.test(element.textContent || '')));
        pass('authored Sensor Readout example retargeted to Calliope pseudocode');
        const calliopeTab = page.getByRole('button', {name: /Calliope/i}).first();
        await calliopeTab.waitFor({state: 'visible', timeout: 15000});
        await page.waitForFunction(element => element && !element.disabled,
            await calliopeTab.elementHandle(), {timeout: 15000});
        if (await calliopeTab.count() === 1) {
            pass('authored micro:bit example retains a device-correct generated-code tab after Calliope retarget');
        } else {
            fail('authored micro:bit example lost its generated-code tab after Calliope retarget');
        }
        await calliopeTab.click();
        const globalStop = page.locator('[data-testid="bw-microbit-stop"]').first();
        if (await globalStop.isEnabled()) await globalStop.click();
        await page.locator('[class*="green-flag_green-flag"], [aria-label*="Go"], [aria-label*="Start"]')
            .first().click();
        await page.waitForFunction(element => element && !element.disabled,
            await globalStop.elementHandle());
        if (await globalStop.isEnabled()) {
            pass('retargeted catalog example runs as Calliope from the global green flag');
        } else {
            fail('retargeted catalog example did not run as Calliope from the global green flag');
        }

    } catch (err) {
        fail(err.message);
    } finally {
        await browser.close();
    }

    console.log(ok ? '\nAll micro:bit checks passed.' : '\nSome checks failed.');
    process.exit(ok ? 0 : 1);
}

verify();
