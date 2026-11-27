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
            pendingInput = {requestId: ++inputSequence, resolve: resolve};
            flush();
            post('input', {requestId: pendingInput.requestId, prompt: prompt});
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
        // Promises belong to this run. Detached async tasks are not registered.
        var AsyncFunction = Object.getPrototypeOf(new Function('return async function () {};')()).constructor;
        var program = new AsyncFunction('console', 'prompt', 'input', 'Math', code);
        var answers = [];
        var randoms = [];
        var attempts = 0;
        var nativeRandom = Math.random;

        function attempt() {
            if (finished) return;
            if (attempts++) resetOutput();
            var nextAnswer = 0;
            var nextRandom = 0;
            var replayQuestion = null;
            function prompt(question) {
                if (nextAnswer < answers.length) return answers[nextAnswer++];
                if (!replayQuestion) replayQuestion = {question: question};
                throw replayQuestion;
            }
            function input(question) {
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
            return program(previewConsole, prompt, input, replayMath).then(afterAttempt, function (error) {
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

/** Console JavaScript: synchronous prompt replay and explicitly awaited input/tasks. */
export const JAVASCRIPT_WORKER_SOURCE = WORKER_START + JAVASCRIPT_BODY + WORKER_END;

/** Build the existing Skulpt interpreter's console worker from lazily loaded sources. */
export const createPythonWorkerSource = ({core, stdlib}) => {
    if (typeof core !== 'string' || typeof stdlib !== 'string') throw new Error('Skulpt sources must be text.');
    return `${core}\n;\n${stdlib}\n;\n${WORKER_START}${PYTHON_BODY}${WORKER_END}`;
};
