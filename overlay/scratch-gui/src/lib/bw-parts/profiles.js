/**
 * The part-profile registry (plan P1) — one entry per bw-board part, saying
 * whether a learner can program it from the Code tab and, if so, with which
 * dialect verbs. It is the P-lane's counterpart to bw-matrix/capabilities.js:
 * a reviewed data table that a conformance test
 * (test/bw-parts-conformance.test.mjs) keeps honest against the code.
 *
 * WHAT IS DERIVED VERSUS STORED. The per-verb host-family coverage
 * (VERB_FAMILIES) is the one thing MEASURED from the emitter rather than typed:
 * scripts/gen-part-profiles.mjs re-derives it from sb3-creator.js and the gate
 * asserts this table matches, so removing an emitter branch reddens a cell. The
 * six families here (avr, arm, 6502, z80, 8051, i8086) are the emitter's own
 * branch strings; the generated doc renders SEVEN columns from them — rp2040 is
 * derived as "≡ arm" (one emitter branch; Pico vs STM32 is a later flag, not a
 * branch) and is the only rendering-only column, never stored. i8086 IS stored:
 * it joined as a measured family when pin (through the 8255) got its first
 * branch, and refuses by name everywhere else (see gen-part-profiles.mjs's
 * header for the attribution rule).
 *
 * PART IDs are bw-board device-model `kind` strings (registeredKinds()), plus
 * the core BUILTIN_KINDS a learner most often places (led, button…), plus the
 * three i2c sensors i2c-sensors.js documents but does not register — recorded
 * as a finding, not hidden. Every id gets either a programmable profile or a
 * category refusal; the gate is red by name for any bw-board id missing here.
 *
 * @module
 */

export const SCHEMA_VERSION = 1;

/** How a part connects. Inferred from bw-board terminals; not a stored field there. */
export const BUS = Object.freeze({
    GPIO: 'gpio', I2C: 'i2c', SPI: 'spi', UART: 'uart',
    PARALLEL: 'parallel', ANALOG: 'analog', ONE_WIRE: 'one-wire'
});

/**
 * The emitter's host-CPU families — its own `this._core` branch strings.
 * 8051 is the base STC12 dialect (implemented for every emitting verb); the
 * others are specializations. i8086 joined as a measured family when its first
 * verb (pin, through the 8255) got an emitter branch — its cells are refuse
 * everywhere else. rp2040 is NOT here: it shares arm's branch and is rendered
 * `≡arm` in the doc, never stored.
 */
export const FAMILY = Object.freeze({
    STC8051: '8051', AVR: 'avr', W6502: '6502', Z80: 'z80', ARM: 'arm', I8086: 'i8086'
});

/** Sections a part id belongs to — how bw-board knows it. */
export const SECTION = Object.freeze({
    REGISTERED: 'registered',   // registeredKinds()
    BUILTIN: 'builtin',         // BUILTIN_KINDS (core kinds, no registry model)
    DOCUMENTED: 'documented'    // named in a device file's prose but not registered
});

/**
 * Why a part is not programmable from the Code tab. A closed vocabulary — the
 * schema test refuses any other. `passive`, `instrument`, `host`, `dip-surface`,
 * `analog-only`, `mechanical` are the categories from the P1 brief; `logic` and
 * `bus-peripheral` were added under measurement (see the module notes and the
 * P1 report): the ~50 74xx/4xxx logic ICs are active yet circuit-driven, not
 * one of the six, and i2c/spi/uart peripherals with no emitter verb are a
 * distinct "no Code-tab path yet" gap rather than any of the six.
 */
export const REASON = Object.freeze({
    PASSIVE: 'passive',              // R/C/L, diodes, connectors, sources, regulators, crystals
    INSTRUMENT: 'instrument',        // bench meter / probe — measured, not coded
    HOST: 'host',                    // the CPU/board the learner's program runs on
    DIP_SURFACE: 'dip-surface',      // machine-level DIP peripheral; behavior in the emulated machine
    ANALOG_ONLY: 'analog-only',      // active analog part driven by the circuit (op-amp, comparator, 555)
    MECHANICAL: 'mechanical',        // mechanical switch array; read at the pin, no dedicated verb
    LOGIC: 'logic',                  // digital logic IC (74xx/4xxx) — combinational/sequential, circuit-driven
    BUS_PERIPHERAL: 'bus-peripheral' // i2c/spi/uart part with no emitter verb yet (a next-lane gap)
});

/**
 * The dialect verbs the emitter can generate hardware code for. Names are the
 * emitter's own `this._cUses.*` flags (plus the synthetic `pin` for the digital
 * primitives cSetPin/cPinRead). The gate asserts this set equals the emitter's.
 */
export const VERBS = Object.freeze([
    'pin', 'adc', 'pwm', 'tone', 'shiftOut', 'servo', 'motor', 'relay',
    'neopixel', 'lcd', 'oled', 'tft', 'matrix', 'matrixKeypad', 'keypad',
    'cube', 'sevenseg', 'ledbank', 'button', 'sensor', 'ultrasonic'
]);

/**
 * verb → the five-family set it is implemented for, MEASURED from the emitter
 * (see gen-part-profiles.mjs). 8051 is always present (base dialect). This is
 * the stored truth the gate re-derives and checks; edit the emitter, run
 * `npm run gen:part-profiles`, and this moves with it — never hand-edit to make
 * the gate pass.
 */
export const VERB_FAMILIES = Object.freeze({
    pin: ['8051', 'avr', '6502', 'z80', 'arm', 'i8086'],
    adc: ['8051', 'avr', 'arm'],
    pwm: ['8051', 'avr', 'arm'],
    tone: ['8051', 'avr', 'arm'],
    shiftOut: ['8051', 'avr', '6502', 'arm', 'i8086'],
    servo: ['8051', 'avr', 'arm'],
    motor: ['8051', 'avr', 'arm'],
    relay: ['8051'],
    neopixel: ['8051'],
    lcd: ['8051', 'avr', '6502', 'z80', 'arm'],
    oled: ['8051', 'avr', '6502', 'z80', 'arm'],
    tft: ['8051'],
    matrix: ['8051'],
    matrixKeypad: ['8051'],
    keypad: ['8051'],
    cube: ['8051'],
    sevenseg: ['8051'],
    ledbank: ['8051'],
    button: ['8051'],
    sensor: ['8051'],
    ultrasonic: ['8051']
});

/**
 * chipRefusals() (i8086-machine.js) keeps a per-feature ledger for a few PC
 * host chips. Only i8237 and ym3812 expose clean identifier-shaped `feature`
 * literals that a registry can join on; sb-dsp/upd765/i8255/i8259 embed hex
 * opcodes or whole sentences, so the join is declared PARTIAL rather than forced.
 * These parts are all dip-surface (programmable:false); the join is recorded so
 * the P-matrix and the refusal ledger can be cross-read where it is clean.
 */
export const LEDGER_JOIN = Object.freeze({
    clean: ['i8237', 'ym3812'],
    templated: ['sb-dsp', 'upd765', 'i8255', 'i8259']
});

/**
 * Programmable parts: a learner writes a program that drives them. `verbs` are
 * the dialect verbs that reach the part; families per verb come from
 * VERB_FAMILIES. `bus` is how it connects. Ids are bw-board kinds unless marked
 * builtin in SECTIONS below.
 */
export const PROGRAMMABLE = Object.freeze([
    // — digital pin primitives (built-ins a learner places constantly) —
    {id: 'led', bus: 'gpio', verbs: ['pin']},
    {id: 'rgb_led', bus: 'gpio', verbs: ['pin', 'pwm']},
    {id: 'button', bus: 'gpio', verbs: ['button', 'pin']},
    {id: 'switch', bus: 'gpio', verbs: ['button', 'pin']},
    {id: 'buzzer', bus: 'gpio', verbs: ['tone', 'pin']},
    {id: 'piezo', bus: 'gpio', verbs: ['tone', 'pin']},
    // The voice-coil transducers (bw-board round 3/4): a pin's square wave
    // sounds through them exactly as through a buzzer — board.js routes
    // speaker and earphone to the same transducer tone path.
    {id: 'speaker', bus: 'gpio', verbs: ['tone', 'pin']},
    {id: 'earphone', bus: 'gpio', verbs: ['tone', 'pin']},
    // Solved as an LED of the same id (optical-parts.js), and switched by a
    // pin the same way; its light feeds an optical link.
    {id: 'laser_diode', bus: 'gpio', verbs: ['pin']},
    // — named peripheral parts, each with a dedicated verb —
    {id: 'shift_register', bus: 'gpio', verbs: ['shiftOut']},
    {id: '74hc595', bus: 'gpio', verbs: ['shiftOut']},
    {id: 'seven_segment', bus: 'gpio', verbs: ['sevenseg']},
    {id: 'sevenseg8', bus: 'gpio', verbs: ['sevenseg']},
    {id: 'led_matrix', bus: 'gpio', verbs: ['matrix']},
    {id: 'matrix8x8', bus: 'gpio', verbs: ['matrix']},
    {id: 'matrix16x8', bus: 'gpio', verbs: ['matrix']},
    {id: 'matrix9x9', bus: 'gpio', verbs: ['matrix']},
    {id: 'led_cube', bus: 'gpio', verbs: ['cube']},
    {id: 'ledbank8', bus: 'gpio', verbs: ['ledbank']},
    {id: 'bargraph', bus: 'gpio', verbs: ['ledbank']},
    {id: 'keypad_4x4', bus: 'gpio', verbs: ['keypad', 'matrixKeypad']},
    {id: 'hd44780', bus: 'parallel', verbs: ['lcd']},
    {id: 'char_lcd', bus: 'parallel', verbs: ['lcd']},
    {id: 'char_lcd_i2c', bus: 'i2c', verbs: ['lcd']},
    {id: 'st7920', bus: 'spi', verbs: ['lcd']},
    {id: 'ssd1306', bus: 'i2c', verbs: ['oled']},
    {id: 'ili9341', bus: 'spi', verbs: ['tft']},
    {id: 'ili9341_par', bus: 'parallel', verbs: ['tft']},
    {id: 'max7219', bus: 'spi', verbs: ['matrix', 'sevenseg']},
    {id: 'neopixel', bus: 'gpio', verbs: ['neopixel']},
    {id: 'led_7color', bus: 'gpio', verbs: ['neopixel', 'pin']},
    // — actuators —
    {id: 'servo', bus: 'gpio', verbs: ['servo']},
    {id: 'dc_motor', bus: 'gpio', verbs: ['motor']},
    {id: 'h_bridge', bus: 'gpio', verbs: ['motor']},
    {id: 'stepper', bus: 'gpio', verbs: ['motor']},
    {id: 'gearmotor', bus: 'gpio', verbs: ['motor']},
    {id: 'dc_motor_encoder', bus: 'gpio', verbs: ['motor', 'pin']},
    {id: 'vibration_motor', bus: 'gpio', verbs: ['motor', 'pin']},
    {id: 'solenoid', bus: 'gpio', verbs: ['relay', 'pin']},
    {id: 'relay', bus: 'gpio', verbs: ['relay']},
    {id: 'relay_dpdt', bus: 'gpio', verbs: ['relay']},
    // — sensors read in code —
    {id: 'ultrasonic', bus: 'gpio', verbs: ['ultrasonic']},
    {id: 'pir', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'dht11', bus: 'one-wire', verbs: ['sensor']},
    {id: 'dht22', bus: 'one-wire', verbs: ['sensor']},
    {id: 'ds18b20', bus: 'one-wire', verbs: ['sensor']},
    {id: 'tilt_sensor', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'hall_digital', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'flame_sensor', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'ir_reflect', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'sound_module', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'touch_ttp223', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'photo_interrupter', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'ky040', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'ir_remote', bus: 'gpio', verbs: ['sensor', 'pin']},
    {id: 'ir_transmitter', bus: 'gpio', verbs: ['pin']},
    {id: 'memsic2125', bus: 'gpio', verbs: ['sensor']},
    // — analog sensors read through the ADC —
    {id: 'photodiode', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'phototransistor', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'tmp36', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'force_sensor', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'flex_sensor', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'soil_moisture', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'gas_sensor', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'ambient_light', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'hall_analog', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'heartbeat', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'adxl335', bus: 'analog', verbs: ['adc', 'sensor']},
    {id: 'joystick', bus: 'analog', verbs: ['adc', 'sensor']}
]);

/**
 * Not programmable from the Code tab: reason → ids. Every id is a bw-board
 * device kind (or a builtin/documented — see SECTIONS). Grouped by the closed
 * REASON vocabulary rather than prose.
 */
export const REFUSED = Object.freeze({
    host: [
        'arduino_mega', 'arduino_nano', 'arduino_uno', 'attiny85', 'attiny88', 'attiny88_qfn32',
        'eater6502', 'pi_pico', 'stc15_mcu', 'stm32f030', 'w65c02', 'z80',
        'i8086', 'i8088', 'mcu',
        // Learner instructions run from its Circuits panel; it has no
        // Code-tab compiler target or emitted peripheral verb.
        'busch-microtronic',
        // The ESP8266 board (bw-board #580): its own DEVICE ESP8266 program runs on it.
        'esp8266',
        // The ESP32-4848S040 board (bw-board #722): its own firmware runs on it.
        'esp32_4848s040',
        // Whole-system teaching computers: their own instruction listings run
        // in the Microtronic/CP1 panels; neither is a Code-tab peripheral verb.
        // Microtronic classification carried from the reviewed #1846 candidate.
        'busch-microtronic', 'kosmos-cp1',
        // The MakeCode boards (bw-board #44): a MakeCode program drives them
        // from the MakeCode pane's runtime bridge, not from the Code tab.
        'calliopemini', 'circuit_playground_express', 'pybadge',
        // The micro:bit, bare and in a breakout (bw-board, task A1): the same
        // board-model registration the Calliope got, driven the same way.
        'microbit', 'microbit_breakout'
    ],
    'dip-surface': [
        'i8251', 'i8253', 'i8254', 'i8255', 'i8259', 'i8284', 'm6532', 'mc6850',
        'ns16c550', 'w65c22', 'w65c51', 'ay8912', 'tms9918', 'simplevga_card',
        'ps2', 'ps2mouse', 'um245r', 'um66t', 'kd9561', 'isd1820'
    ],
    passive: [
        'battery', 'battery_9v', 'battery_aa', 'battery_coin', 'solar_cell',
        'fuse', 'header', 'usb_a', 'crystal', 'osc_can', 'light_bulb',
        'polarized_cap', 'rnet_sip', 'level_shifter4', 'vreg', 'adp151', 'adp7118', 'lt1763', 'lm7805',
        'lm7809', 'lm7812', 'ld1117v33', 'ams1117_33', 'ams1117_50',
        'vcc', 'gnd', 'resistor', 'capacitor', 'inductor', 'transformer',
        'diode', 'zener', 'potentiometer', 'ntc', 'ldr', 'vsource', 'isource',
        // The three-pin photoresistor module (bw-board #659): the same LDR
        // model as `ldr` plus a fixed load resistor, a passive divider driven
        // by its own 0..1 light control — profiled exactly as `ldr` is.
        'light_sensor',
        // Round 3/4 radio front end (bw-board #740, #743): antenna, earth and
        // the tank/coil parts are passives a circuit tunes, not a program.
        'antenna', 'earth', 'tuning_cap', 'varicap', 'ferrite_coil', 'vhf_coil', 'air_coil',
        // Radio and sensing passives: resistive transducers, coupled windings,
        // an antenna/filter and a breakdown gap. Their electrical behaviour is
        // set by the circuit, like ntc/ldr/inductor/diode above.
        'ptc_sensor', 'humidity_comb', 'induction_loop', 'coil_pendulum',
        'dipole', 'ceramic_filter', 'spark_gap',
        // Sources a learner builds rather than codes: fruit cells, a
        // thermocouple's EMF, an electrolysis cell (profiled as solar_cell /
        // ntc are — read at a pin or the ADC through the generic path).
        'lemon_battery', 'potato_battery', 'thermocouple', 'electrolysis_cell',
        // Solver-only expansion kinds (hidden parts the board adds for a
        // placed one; registered, so catalogued): a speaker's voice coil, the
        // room-field couplings, reverse breakdown, an LED's photocurrent, an
        // optical receiver's photocurrent and the RF envelope detector.
        '__voice_coil', 'field_contact', 'field_coupler', 'field_emf', 'field_inject',
        'junction_breakdown', 'led_photocurrent', 'optical_rx', 'rf_detect'
    ],
    instrument: ['voltmeter', 'ammeter', 'analog_meter', 'logic_probe',
        // Bench instruments: a field probe reads a room field, the generator
        // and the scope are the measurement lessons' own tools.
        'field_probe', 'function_gen', 'oscilloscope'],
    'analog-only': [
        'lm358', 'lm324', 'lm741', 'lm741_rail_return', 'ltspice_universal_opamp2', 'lt1001', 'lt1006', 'lt1007', 'lt1007_channel',
        'lt1678', 'lt1678_channel',
        'lt1014', 'lt1014_channel', 'adtl082', 'adtl082_channel', 'ad711', 'ad711_channel', 'op07', 'op27',
        'op747', 'op747_channel', 'ad8541', 'ad8541_channel', 'ad8602', 'ad8602_channel',
        'ada4522_1', 'ada4522_1_channel', 'lm393', 'lm339', 'lm3915', 'tip120', 'timer_555', 'timer_556',
        '555', '556', 'optocoupler', 'darlington_driver', 'tcs3200', 'msgeq7',
        'spectrum_display', 'clock_display', 'opamp', 'npn', 'pnp', 'nmos', 'pmos',
        // The LM386 audio amplifier and the solver-only stages behind it and
        // the LM358/LM324 macromodel (ground-sensing-opamp.js, lm386.js).
        'lm386', 'lm386_stage', 'ground_sensing_opamp_stage',
        // Circuit-driven analog stages: Hall displacement readout, PLL/VCO,
        // mixer, FM limiting/detection and a dual-gate transistor. No dedicated
        // emitter peripheral path is claimed by their simulation models.
        'bending_ruler', 'cd4046', 'sa612', 'fm_if', 'dual_gate_mosfet'
    ],
    mechanical: [
        'dip_switch', 'dip_switch_dpst', 'dip_switch_spst', 'slide_switch',
        'reed_switch'
    ],
    logic: [
        'gate_and', 'gate_or', 'gate_not', 'gate_nand', 'gate_nor', 'gate_xor',
        '74hc00', '74hc02', '74hc04', '74hc08', '74hc10', '74hc11', '74hc14',
        '74hc20', '74hc21', '74hc27', '74hc32', '74hc86', '74hc132', 'cd4093',
        '74hc73', '74hc74', '74hc75', '74hc93', '74hc95', '74hc125',
        '74hc138', '74hc165', '74hc244', '74hc245', '74hc283', '74hc34',
        '74hc373', '74hc374', '74hc4050', '74hc688', 'cd4511',
        '74hct00', '74hct04', '74hct08', '74hct14', '74hct32', '74hct138', '74hct245',
        '74ls04', '74ls32', '74ls107', '74ls157', '74ls161', '74ls173', '74ls189',
        '74ls193', '74ls373', '74c922', 'decade_counter', 'dff', 'jkff',
        'cd74hc4067', '62256', '28c256'
    ],
    'bus-peripheral': [
        'at24c02', 'at24c64', 'pcf8574', 'mcp3008', 'mcp4725', 'xpt2046',
        'hx711', 'nrf24l01', 'hc05', 'dfplayer_mini', 'ze08_ch2o', 'max232',
        'rf433_tx', 'rf433_rx', 'ds1302', 'ds3231', 'bmp280', 'tcs34725',
        'bh1750', 'ina219', 'vl53l0x', 'sgp30', 'veml7700', 'as5600',
        'mpu6050', 'eeprom'
    ]
});

/** Section per id (default REGISTERED). Builtins and the documented trio are named. */
export const SECTIONS = Object.freeze({
    builtin: [
        'vcc', 'gnd', 'resistor', 'capacitor', 'inductor', 'transformer',
        'diode', 'led', 'zener', 'potentiometer', 'button', 'switch', 'buzzer',
        'ldr', 'ntc', 'npn', 'pnp', 'nmos', 'pmos', 'opamp', 'vsource',
        'isource', 'mcu', 'seven_segment', 'rgb_led', 'led_matrix', 'led_cube',
        'shift_register', 'ir_receiver', 'temp_sensor', 'eeprom'
    ],
    documented: ['ads1115', 'pcf8591', 'apds9960']
});

/**
 * The two BUILTIN_KINDS with no home above, refused so every id is covered:
 * ir_receiver and temp_sensor are read via the generic sensor path but have no
 * dedicated verb or model — they are documented placement kinds. The three
 * SECTIONS.documented ids get the same reason.
 */
export const REFUSED_DOCUMENTED = Object.freeze({
    'bus-peripheral': ['ir_receiver', 'temp_sensor', 'ads1115', 'pcf8591', 'apds9960']
});
