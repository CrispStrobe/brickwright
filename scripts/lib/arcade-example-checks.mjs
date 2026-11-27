// SPDX-License-Identifier: BSD-3-Clause

// These gameplay probes use the real PXT screen and input events. The Scratch
// side of the acceptance inventory is test/pseudocode-game-examples.test.mjs.
const click = (x, y, delay = 0, expect) =>
    ({displayClick: {x, y, hold: 100}, delay, ...(expect ? {waitForGlobals: expect} : {})});

const directions = {U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight'};
const vaultSolutions = ['URRRLLURRLLURR', 'RUUDRRUDDRRUU', 'RDRDLRRDRU'];
const vaultSteps = vaultSolutions.flatMap((solution, chamber) =>
    [...solution].flatMap((move, index) => [
        {keyDown: directions[move], delay: 90},
        {keyUp: directions[move], delay: 60,
            ...(index === solution.length - 1 ? {waitForGlobals: {level: chamber + 2}} : {})}
    ]));

const lockSteps = [];
for (let boat = 1; boat <= 4; boat++) {
    if (boat > 1) lockSteps.push(click(80.5, 111.5, 0, {water: 0}));
    lockSteps.push(click(33.5, 111.5, 0, {lowerGate: 0, boatZone: 1}));
    lockSteps.push(click(80.5, 111.5, 0, {water: 1}));
    lockSteps.push(click(127.5, 111.5, 0, {boats: boat, upperGate: 0, boatZone: boat === 4 ? 2 : 0}));
}

export const arcadeExampleChecks = {
    twinwall: {
        name: 'independent paddle controls',
        options: {buttonActions: {afterGlobals: {started: 1}, steps: [
            {keyDown: 'w', waitForGlobals: {ly: 135, ry: 0}},
            {keyUp: 'w'},
            {keyDown: 'ArrowDown', waitForGlobals: {ly: 135, ry: -135}},
            {keyUp: 'ArrowDown'}
        ]}},
        observe: sample => ({
            paddles: {left: sample.ly, right: sample.ry},
            monitors: Object.entries(sample).filter(([key]) => /^__bwMonitorVisible_*$/.test(key))
        })
    },
    sigil_grid: {
        name: 'pointer opening and solo rival reply',
        options: {buttonActions: {afterGlobals: {started: 1, active: 1}, steps: [
            click(51.5, 29.5, 60, {moves: 2})
        ]}, inspectArrayValues: ['Board_boardList']},
        observe: sample => {
            const board = sample.$arrays.Board_boardList;
            if (board.length !== 9 || board[0] !== 1 || board[4] !== 2) {
                throw new Error('Sigil Grid did not place the player sun and the rival centre reply.');
            }
            return {moves: sample.moves, board};
        }
    },
    vector_seven: {
        name: 'pointer aim and serve launch',
        options: {buttonActions: {afterGlobals: {playing: 1, serve: 1}, steps: [
            click(120.5, 100.5, 60, {playerX: 120, serve: 0})
        ]}},
        observe: sample => {
            if (!(sample.ballVY > 0)) throw new Error('Vector Seven serve did not travel toward the rival.');
            return {paddle: sample.playerX, serve: sample.serve, ballVY: sample.ballVY};
        }
    },
    flux_vault: {
        name: 'keyboard solution for all three chambers',
        options: {buttonActions: {afterGlobals: {level: 1, active: 1}, steps: vaultSteps},
            waitForGlobals: {level: 4, active: 0, started: 0}},
        observe: sample => {
            if (!(sample.pushes >= 9)) throw new Error('Flux Vault completed without registering its core pushes.');
            return {level: sample.level, active: sample.active, pushes: sample.pushes};
        }
    },
    canal_command: {
        name: 'four legal lock cycles through on-screen buttons',
        options: {buttonActions: {afterGlobals: {started: 1, active: 1}, steps: lockSteps},
            waitForGlobals: {boats: 4, faults: 0, active: 0, started: 0}},
        observe: sample => ({boats: sample.boats, faults: sample.faults, active: sample.active})
    }
};
