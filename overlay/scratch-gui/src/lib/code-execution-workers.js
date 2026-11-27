// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors

// Literal worker programs, independent of Babel's generated helpers. They expose
// only console/input for the generic preview. Device/simulator runs have their
// own adapters. These workers are execution isolation, not a security sandbox.
const WORKER_START = String.raw`(function () {
    'use strict';
    var runId = null;
    var started = false;
    var finished = false;
    var limit = 65536;
    var outputCount = 0;
    var outputBuffer = '';
    var outputTimer = null;
    var inputSequence = 0;
    var pendingInput = null;
    var canPauseForInput = function () { return true; };
    var outputLimitSignal = {};

    function post(type, fields) {
        var message = fields || {};
        message.type = type;
        message.runId = runId;
        self.postMessage(message);
    }
    function flush() {
        if (outputTimer !== null) clearTimeout(outputTimer);
        outputTimer = null;
        while (outputBuffer.length) {
            var chunk = outputBuffer.slice(0, 4096);
            outputBuffer = outputBuffer.slice(chunk.length);
            post('out', {text: chunk});
        }
    }
    function errorText(error) {
        return String(error && error.stack || error || 'Worker error').slice(0, 4096);
    }
    function finish(type, text) {
        if (finished) return;
        flush();
        finished = true;
        post(type, text === undefined ? {} : {text: text});
    }
    function fail(error) {
        if (error === outputLimitSignal) finish('output-limit');
        else finish('error', errorText(error));
    }
    function write(text) {
        if (finished) return;
        text = String(text);
        var available = Math.max(0, limit - outputCount);
        var accepted = text.slice(0, available);
        outputCount += accepted.length;
        outputBuffer += accepted;
        if (outputBuffer.length >= 4096) flush();
        else if (outputBuffer.length && outputTimer === null) outputTimer = setTimeout(flush, 16);
        if (text.length > available) {
            finish('output-limit');
            throw outputLimitSignal;
        }
    }
    function resetOutput() {
        flush();
        post('output-reset');
        // outputCount deliberately survives replay: reset cannot evade the cap.
    }
    function ask(question) {
        if (finished) return Promise.reject(new Error('This code run has ended.'));
        if (pendingInput) return Promise.reject(new Error('Only one input request can be pending.'));
        var prompt = question === undefined || question === null ? '' : String(question);
        if (prompt.length > 4096) return Promise.reject(new Error('Input prompt exceeds the preview limit.'));
        if (inputSequence >= 1000) return Promise.reject(new Error('The program asked more than 1000 questions.'));
        return new Promise(function (resolve) {
            pendingInput = {requestId: ++inputSequence, resolve: resolve, pauseBudget: canPauseForInput()};
            flush();
            post('input', {requestId: pendingInput.requestId, prompt: prompt,
                pauseBudget: pendingInput.pauseBudget});
        });
    }
    function log() {
        var parts = Array.prototype.map.call(arguments, function (value) {
            if (typeof value === 'string') return value;
            try {
                var text = JSON.stringify(value);
                return text === undefined ? String(value) : text;
            } catch (error) { return String(value); }
        });
        write(parts.join(' ') + '\n');
    }
    var previewConsole = {log: log, error: log, warn: log, info: log, debug: log};
`;

const WORKER_END = String.raw`
    self.onmessage = function (event) {
        var message = event.data || {};
        if (message.type === 'input-ping') {
            if (!finished && started && message.runId === runId && pendingInput &&
                message.requestId === pendingInput.requestId && Number.isSafeInteger(message.probeId) &&
                message.probeId > 0) {
                post('input-pong', {requestId: pendingInput.requestId, probeId: message.probeId});
            }
            return;
        }
        if (message.type === 'input-reply') {
            if (!finished && message.runId === runId && pendingInput &&
                message.requestId === pendingInput.requestId && typeof message.value === 'string') {
                var request = pendingInput;
                pendingInput = null;
                request.resolve(message.value);
            }
            return;
        }
        if (message.type !== 'run' || started) return;
        started = true;
        runId = message.runId;
        if (typeof message.code !== 'string' || !Number.isSafeInteger(message.maxOutputChars) ||
            message.maxOutputChars <= 0) {
            fail(new Error('Invalid code run configuration.'));
            return;
        }
        limit = message.maxOutputChars;
        self.console = previewConsole;
        Promise.resolve().then(function () { return execute(message.code); }).then(function () {
            if (pendingInput) {
                fail(new Error('Await input(question) before the program completes.'));
                return;
            }
            finish('done');
        }, fail);
    };
    self.onerror = function (message, source, line, column, error) {
        if (started) fail(error || new Error(String(message)));
        return true;
    };
    self.onunhandledrejection = function (event) {
        if (event.preventDefault) event.preventDefault();
        if (started) fail(event.reason);
    };
})();`;

const JAVASCRIPT_BODY = String.raw`
    function execute(code) {
        // The body is an async function: explicit top-level await and returned
        // Promises belong to this run. Additional tasks must use codeRun.spawn;
        // arbitrary detached timers/promises are not discovered automatically.
        var AsyncFunction = Object.getPrototypeOf(new Function('return async function () {};')()).constructor;
        var program = new AsyncFunction('console', 'prompt', 'input', 'Math', code);
        var answers = [];
        var randoms = [];
        var attempts = 0;
        var nativeRandom = Math.random;
        var activeScope;
        // A global API avoids reserving a new parameter in existing authored
        // source. Generated owned-console source reserves its own codeRun name.
        Object.defineProperty(self, 'codeRun', {value: Object.freeze({
            version: 1,
            spawn: function (task) { return activeScope.spawn(task); },
            input: function (question) { return activeScope.input(question); },
            sleep: function (milliseconds) { return activeScope.sleep(milliseconds); }
        })});

        function attempt() {
            if (finished) return;
            if (attempts++) resetOutput();
            var nextAnswer = 0;
            var nextRandom = 0;
            var replayQuestion = null;
            var usedPrompt = false;
            var ownedUsed = false;
            var closed = false;
            var spawned = 0;
            var tasks = new Set();
            var sleeps = new Set();
            var root = {closed: false, input: null, sleeps: new Set()};
            var inputOwner = null;
            var resolveLifetime;
            var rejectLifetime;
            var lifetime = new Promise(function (resolve, reject) {
                resolveLifetime = resolve;
                rejectLifetime = reject;
            });
            canPauseForInput = function () {
                // Sleeping siblings still consume the console budget. Only a
                // sole tracked owner may wait for a human without that charge.
                return !ownedUsed || (inputOwner && !inputOwner.closed &&
                    tasks.size + (root.closed ? 0 : 1) === 1);
            };
            function inputState() {
                if (finished || !pendingInput) return;
                var pause = canPauseForInput();
                if (pendingInput.pauseBudget === pause) return;
                pendingInput.pauseBudget = pause;
                post('input-state', {requestId: pendingInput.requestId, pauseBudget: pause});
            }
            function failScope(error) {
                if (closed) return;
                closed = true;
                root.closed = true;
                tasks.forEach(function (task) { task.closed = true; });
                sleeps.forEach(function (timer) { clearTimeout(timer); });
                sleeps.clear();
                rejectLifetime(error);
            }
            function settleScope() {
                if (closed) return;
                inputState();
                if (!root.closed || tasks.size) return;
                if (pendingInput || sleeps.size) {
                    failScope(new Error('Await input and codeRun.sleep inside the entry or a registered task.'));
                    return;
                }
                closed = true;
                resolveLifetime();
            }
            function activateOwned(owner) {
                if (closed || finished || owner.closed) throw new Error('This code task has ended. Use the API supplied to the active task.');
                if (owner.input) throw new Error('Await the pending input in its owning entry or task before starting more work.');
                if (usedPrompt) throw new Error('Synchronous prompt replay cannot be mixed with codeRun tasks. Use codeRun.input.');
                if (pendingInput && !inputOwner) throw new Error('Finish the entry input before registering codeRun tasks.');
                ownedUsed = true;
            }
            function completeOwner(owner) {
                if (closed || owner.closed) return;
                owner.closed = true;
                if (owner !== root) tasks.delete(owner);
                if (owner.input || owner.sleeps.size) {
                    failScope(new Error('Await input and codeRun.sleep inside their owning entry or task.'));
                    return;
                }
                settleScope();
            }
            function apiFor(owner) { return Object.freeze({
                version: 1,
                spawn: function (task) {
                    activateOwned(owner);
                    if (typeof task !== 'function') throw new Error('codeRun.spawn requires a function.');
                    if (tasks.size >= 256 || spawned >= 10000) throw new Error('The codeRun task limit was exceeded.');
                    spawned++;
                    var child = {closed: false, input: null, sleeps: new Set()};
                    var childApi = apiFor(child);
                    tasks.add(child);
                    var promise = Promise.resolve().then(function () { return task(childApi); });
                    // Attach both handlers immediately. A task rejection fails
                    // the whole run. spawn is registration-only (returns void),
                    // not a join primitive: sequential work awaits local async
                    // functions within the same owner. No promise graph guessing.
                    promise.then(function () { completeOwner(child); }, failScope);
                    inputState();
                },
                input: function (question) {
                    activateOwned(owner);
                    if (pendingInput) throw new Error('Only one input request can be pending.');
                    if (owner.sleeps.size) throw new Error('Await pending sleeps in this task before requesting input.');
                    var token = {};
                    owner.input = token;
                    inputOwner = owner;
                    function releaseInput() {
                        if (owner.input === token) owner.input = null;
                        if (inputOwner === owner) inputOwner = null;
                    }
                    return ask(question).then(function (answer) {
                        releaseInput();
                        return answer;
                    }, function (error) {
                        releaseInput();
                        failScope(error);
                        throw error;
                    });
                },
                sleep: function (milliseconds) {
                    activateOwned(owner);
                    if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 2147483647) {
                        throw new Error('codeRun.sleep requires finite milliseconds between 0 and 2147483647.');
                    }
                    if (sleeps.size >= 256) throw new Error('The codeRun sleep limit was exceeded.');
                    return new Promise(function (resolve) {
                        var timer = setTimeout(function () {
                            sleeps.delete(timer);
                            owner.sleeps.delete(timer);
                            resolve();
                        }, milliseconds);
                        sleeps.add(timer);
                        owner.sleeps.add(timer);
                    });
                }
            }); }
            activeScope = apiFor(root);
            function prompt(question) {
                if (ownedUsed) throw new Error('Synchronous prompt replay cannot be mixed with codeRun tasks. Use codeRun.input.');
                usedPrompt = true;
                if (nextAnswer < answers.length) return answers[nextAnswer++];
                if (!replayQuestion) replayQuestion = {question: question};
                throw replayQuestion;
            }
            function input(question) {
                if (ownedUsed) return activeScope.input(question);
                if (replayQuestion) return Promise.reject(new Error('An unanswered prompt must finish before async input.'));
                if (nextAnswer < answers.length) return Promise.resolve(answers[nextAnswer++]);
                if (pendingInput) return Promise.reject(new Error('Only one input request can be pending.'));
                nextAnswer++;
                return ask(question).then(function (answer) { answers.push(answer); return answer; });
            }
            var replayMath = Object.create(Math, {random: {value: function () {
                if (nextRandom === randoms.length) randoms.push(nativeRandom());
                return randoms[nextRandom++];
            }}});
            function afterAttempt() {
                if (finished || !replayQuestion) return;
                return ask(replayQuestion.question).then(function (answer) {
                    answers.push(answer);
                    return attempt();
                });
            }
            Promise.resolve().then(function () { return program(previewConsole, prompt, input, replayMath); }).then(function () {
                completeOwner(root);
            }, function (error) {
                failScope(error);
            });
            return lifetime.then(afterAttempt, function (error) {
                if (!replayQuestion || error !== replayQuestion) throw error;
                return afterAttempt();
            });
        }
        return attempt();
    }
`;

const PYTHON_BODY = String.raw`
    function execute(code) {
        Sk.configure({
            output: write,
            read: function (file) {
                if (Sk.builtinFiles && Object.prototype.hasOwnProperty.call(Sk.builtinFiles.files, file)) {
                    return Sk.builtinFiles.files[file];
                }
                throw new Error('module ' + file + ' not found');
            },
            inputfun: ask,
            inputfunTakesPrompt: true,
            yieldLimit: 25,
            execLimit: null,
            __future__: Sk.python3
        });
        return Sk.misceval.asyncToPromise(function () {
            return Sk.importMainWithBody('<brickwright>', false, code, true);
        });
    }
`;

/** Console JS: legacy prompt replay, awaited entry, and versioned codeRun tasks. */
export const JAVASCRIPT_WORKER_SOURCE = WORKER_START + JAVASCRIPT_BODY + WORKER_END;

/** Build the existing Skulpt interpreter's console worker from lazily loaded sources. */
export const createPythonWorkerSource = ({core, stdlib}) => {
    if (typeof core !== 'string' || typeof stdlib !== 'string') throw new Error('Skulpt sources must be text.');
    return `${core}\n;\n${stdlib}\n;\n${WORKER_START}${PYTHON_BODY}${WORKER_END}`;
};
