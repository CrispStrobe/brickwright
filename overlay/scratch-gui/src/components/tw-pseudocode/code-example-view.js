const stageOpcodes = /^(?:motion_|looks_|pen_|videoSensing_|event_when(?:keypressed|thisspriteclicked|stageclicked|backdropswitchesto)$|sensing_(?:askandwait|touchingobject|touchingcolor|coloristouchingcolor|mouse[xy]|mousedown|keypressed)$|data_(?:show|hide)(?:variable|list)$)/;

/** Detect Stage behavior from compiled Scratch blocks, including nested reporters. */
export const usesScratchStage = project =>
    Boolean(project?.monitors?.some(monitor => monitor.visible) ||
        project?.targets?.some(target => Object.values(target.blocks || {}).some(block => stageOpcodes.test(block.opcode))));
