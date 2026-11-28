// SPDX-License-Identifier: MIT
// Generated from the exact bw-board pin by scripts/sync-board-targets.mjs.
// Do not edit profile data here; change the owning upstream and regenerate.
export default {
  "schemaVersion": 1,
  "provenance": {
    "repository": "CrispStrobe/bw-board",
    "commit": "52ca68b6ccc9895300ec1d3a6bd9d6b4b79182e5",
    "path": "src/portable-gpio.js",
    "blobSha": "36ae842f33b5b9a7831b4d6b28a10da3f7c61943"
  },
  "profiles": [
    {
      "kind": "mcu",
      "label": "STC / 8051 logical ports",
      "nominalVoltage": null,
      "numbering": "8 * port + bit",
      "help": "P0.0–P7.7 use 8 × port + bit. Only terminals present in this circuit are available; voltage follows the bench.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "p0.0"
        },
        {
          "pin": 1,
          "terminal": "p0.1"
        },
        {
          "pin": 2,
          "terminal": "p0.2"
        },
        {
          "pin": 3,
          "terminal": "p0.3"
        },
        {
          "pin": 4,
          "terminal": "p0.4"
        },
        {
          "pin": 5,
          "terminal": "p0.5"
        },
        {
          "pin": 6,
          "terminal": "p0.6"
        },
        {
          "pin": 7,
          "terminal": "p0.7"
        },
        {
          "pin": 8,
          "terminal": "p1.0"
        },
        {
          "pin": 9,
          "terminal": "p1.1"
        },
        {
          "pin": 10,
          "terminal": "p1.2"
        },
        {
          "pin": 11,
          "terminal": "p1.3"
        },
        {
          "pin": 12,
          "terminal": "p1.4"
        },
        {
          "pin": 13,
          "terminal": "p1.5"
        },
        {
          "pin": 14,
          "terminal": "p1.6"
        },
        {
          "pin": 15,
          "terminal": "p1.7"
        },
        {
          "pin": 16,
          "terminal": "p2.0"
        },
        {
          "pin": 17,
          "terminal": "p2.1"
        },
        {
          "pin": 18,
          "terminal": "p2.2"
        },
        {
          "pin": 19,
          "terminal": "p2.3"
        },
        {
          "pin": 20,
          "terminal": "p2.4"
        },
        {
          "pin": 21,
          "terminal": "p2.5"
        },
        {
          "pin": 22,
          "terminal": "p2.6"
        },
        {
          "pin": 23,
          "terminal": "p2.7"
        },
        {
          "pin": 24,
          "terminal": "p3.0"
        },
        {
          "pin": 25,
          "terminal": "p3.1"
        },
        {
          "pin": 26,
          "terminal": "p3.2"
        },
        {
          "pin": 27,
          "terminal": "p3.3"
        },
        {
          "pin": 28,
          "terminal": "p3.4"
        },
        {
          "pin": 29,
          "terminal": "p3.5"
        },
        {
          "pin": 30,
          "terminal": "p3.6"
        },
        {
          "pin": 31,
          "terminal": "p3.7"
        },
        {
          "pin": 32,
          "terminal": "p4.0"
        },
        {
          "pin": 33,
          "terminal": "p4.1"
        },
        {
          "pin": 34,
          "terminal": "p4.2"
        },
        {
          "pin": 35,
          "terminal": "p4.3"
        },
        {
          "pin": 36,
          "terminal": "p4.4"
        },
        {
          "pin": 37,
          "terminal": "p4.5"
        },
        {
          "pin": 38,
          "terminal": "p4.6"
        },
        {
          "pin": 39,
          "terminal": "p4.7"
        },
        {
          "pin": 40,
          "terminal": "p5.0"
        },
        {
          "pin": 41,
          "terminal": "p5.1"
        },
        {
          "pin": 42,
          "terminal": "p5.2"
        },
        {
          "pin": 43,
          "terminal": "p5.3"
        },
        {
          "pin": 44,
          "terminal": "p5.4"
        },
        {
          "pin": 45,
          "terminal": "p5.5"
        },
        {
          "pin": 46,
          "terminal": "p5.6"
        },
        {
          "pin": 47,
          "terminal": "p5.7"
        },
        {
          "pin": 48,
          "terminal": "p6.0"
        },
        {
          "pin": 49,
          "terminal": "p6.1"
        },
        {
          "pin": 50,
          "terminal": "p6.2"
        },
        {
          "pin": 51,
          "terminal": "p6.3"
        },
        {
          "pin": 52,
          "terminal": "p6.4"
        },
        {
          "pin": 53,
          "terminal": "p6.5"
        },
        {
          "pin": 54,
          "terminal": "p6.6"
        },
        {
          "pin": 55,
          "terminal": "p6.7"
        },
        {
          "pin": 56,
          "terminal": "p7.0"
        },
        {
          "pin": 57,
          "terminal": "p7.1"
        },
        {
          "pin": 58,
          "terminal": "p7.2"
        },
        {
          "pin": 59,
          "terminal": "p7.3"
        },
        {
          "pin": 60,
          "terminal": "p7.4"
        },
        {
          "pin": 61,
          "terminal": "p7.5"
        },
        {
          "pin": 62,
          "terminal": "p7.6"
        },
        {
          "pin": 63,
          "terminal": "p7.7"
        }
      ]
    },
    {
      "kind": "stc15_mcu",
      "label": "STC15F2K60S2 DIP-40",
      "nominalVoltage": 5,
      "numbering": "8 * port + bit",
      "help": "P0–P3 use 0–31; P4.1/P4.2/P4.4/P4.5 use 33/34/36/37; P5.4/P5.5 use 44/45. Use one case spelling per circuit pad. Reset, crystal and fuse behavior are not emulated by this host.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "p0.0"
        },
        {
          "pin": 1,
          "terminal": "p0.1"
        },
        {
          "pin": 2,
          "terminal": "p0.2"
        },
        {
          "pin": 3,
          "terminal": "p0.3"
        },
        {
          "pin": 4,
          "terminal": "p0.4"
        },
        {
          "pin": 5,
          "terminal": "p0.5"
        },
        {
          "pin": 6,
          "terminal": "p0.6"
        },
        {
          "pin": 7,
          "terminal": "p0.7"
        },
        {
          "pin": 8,
          "terminal": "p1.0"
        },
        {
          "pin": 9,
          "terminal": "p1.1"
        },
        {
          "pin": 10,
          "terminal": "p1.2"
        },
        {
          "pin": 11,
          "terminal": "p1.3"
        },
        {
          "pin": 12,
          "terminal": "p1.4"
        },
        {
          "pin": 13,
          "terminal": "p1.5"
        },
        {
          "pin": 14,
          "terminal": "p1.6"
        },
        {
          "pin": 15,
          "terminal": "p1.7"
        },
        {
          "pin": 16,
          "terminal": "p2.0"
        },
        {
          "pin": 17,
          "terminal": "p2.1"
        },
        {
          "pin": 18,
          "terminal": "p2.2"
        },
        {
          "pin": 19,
          "terminal": "p2.3"
        },
        {
          "pin": 20,
          "terminal": "p2.4"
        },
        {
          "pin": 21,
          "terminal": "p2.5"
        },
        {
          "pin": 22,
          "terminal": "p2.6"
        },
        {
          "pin": 23,
          "terminal": "p2.7"
        },
        {
          "pin": 24,
          "terminal": "p3.0"
        },
        {
          "pin": 25,
          "terminal": "p3.1"
        },
        {
          "pin": 26,
          "terminal": "p3.2"
        },
        {
          "pin": 27,
          "terminal": "p3.3"
        },
        {
          "pin": 28,
          "terminal": "p3.4"
        },
        {
          "pin": 29,
          "terminal": "p3.5"
        },
        {
          "pin": 30,
          "terminal": "p3.6"
        },
        {
          "pin": 31,
          "terminal": "p3.7"
        },
        {
          "pin": 33,
          "terminal": "p4.1"
        },
        {
          "pin": 34,
          "terminal": "p4.2"
        },
        {
          "pin": 36,
          "terminal": "p4.4"
        },
        {
          "pin": 37,
          "terminal": "p4.5"
        },
        {
          "pin": 44,
          "terminal": "p5.4"
        },
        {
          "pin": 45,
          "terminal": "p5.5"
        }
      ]
    },
    {
      "kind": "arduino_uno",
      "label": "Arduino Uno",
      "nominalVoltage": 5,
      "numbering": "Dn = n; An = 14 + n",
      "help": "D0–D13 use 0–13; A0–A5 use 14–19 as digital pins.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "d0"
        },
        {
          "pin": 1,
          "terminal": "d1"
        },
        {
          "pin": 2,
          "terminal": "d2"
        },
        {
          "pin": 3,
          "terminal": "d3"
        },
        {
          "pin": 4,
          "terminal": "d4"
        },
        {
          "pin": 5,
          "terminal": "d5"
        },
        {
          "pin": 6,
          "terminal": "d6"
        },
        {
          "pin": 7,
          "terminal": "d7"
        },
        {
          "pin": 8,
          "terminal": "d8"
        },
        {
          "pin": 9,
          "terminal": "d9"
        },
        {
          "pin": 10,
          "terminal": "d10"
        },
        {
          "pin": 11,
          "terminal": "d11"
        },
        {
          "pin": 12,
          "terminal": "d12"
        },
        {
          "pin": 13,
          "terminal": "d13"
        },
        {
          "pin": 14,
          "terminal": "a0"
        },
        {
          "pin": 15,
          "terminal": "a1"
        },
        {
          "pin": 16,
          "terminal": "a2"
        },
        {
          "pin": 17,
          "terminal": "a3"
        },
        {
          "pin": 18,
          "terminal": "a4"
        },
        {
          "pin": 19,
          "terminal": "a5"
        }
      ]
    },
    {
      "kind": "arduino_nano",
      "label": "Arduino Nano",
      "nominalVoltage": 5,
      "numbering": "Dn = n; An = 14 + n",
      "help": "D0–D13 use 0–13; A0–A5 use 14–19. Analog-only A6/A7 are unavailable.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "d0"
        },
        {
          "pin": 1,
          "terminal": "d1"
        },
        {
          "pin": 2,
          "terminal": "d2"
        },
        {
          "pin": 3,
          "terminal": "d3"
        },
        {
          "pin": 4,
          "terminal": "d4"
        },
        {
          "pin": 5,
          "terminal": "d5"
        },
        {
          "pin": 6,
          "terminal": "d6"
        },
        {
          "pin": 7,
          "terminal": "d7"
        },
        {
          "pin": 8,
          "terminal": "d8"
        },
        {
          "pin": 9,
          "terminal": "d9"
        },
        {
          "pin": 10,
          "terminal": "d10"
        },
        {
          "pin": 11,
          "terminal": "d11"
        },
        {
          "pin": 12,
          "terminal": "d12"
        },
        {
          "pin": 13,
          "terminal": "d13"
        },
        {
          "pin": 14,
          "terminal": "a0"
        },
        {
          "pin": 15,
          "terminal": "a1"
        },
        {
          "pin": 16,
          "terminal": "a2"
        },
        {
          "pin": 17,
          "terminal": "a3"
        },
        {
          "pin": 18,
          "terminal": "a4"
        },
        {
          "pin": 19,
          "terminal": "a5"
        }
      ]
    },
    {
      "kind": "arduino_mega",
      "label": "Arduino Mega",
      "nominalVoltage": 5,
      "numbering": "Dn = n; An = 54 + n",
      "help": "D0–D53 use 0–53; A0–A15 use 54–69 as digital pins.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "d0"
        },
        {
          "pin": 1,
          "terminal": "d1"
        },
        {
          "pin": 2,
          "terminal": "d2"
        },
        {
          "pin": 3,
          "terminal": "d3"
        },
        {
          "pin": 4,
          "terminal": "d4"
        },
        {
          "pin": 5,
          "terminal": "d5"
        },
        {
          "pin": 6,
          "terminal": "d6"
        },
        {
          "pin": 7,
          "terminal": "d7"
        },
        {
          "pin": 8,
          "terminal": "d8"
        },
        {
          "pin": 9,
          "terminal": "d9"
        },
        {
          "pin": 10,
          "terminal": "d10"
        },
        {
          "pin": 11,
          "terminal": "d11"
        },
        {
          "pin": 12,
          "terminal": "d12"
        },
        {
          "pin": 13,
          "terminal": "d13"
        },
        {
          "pin": 14,
          "terminal": "d14"
        },
        {
          "pin": 15,
          "terminal": "d15"
        },
        {
          "pin": 16,
          "terminal": "d16"
        },
        {
          "pin": 17,
          "terminal": "d17"
        },
        {
          "pin": 18,
          "terminal": "d18"
        },
        {
          "pin": 19,
          "terminal": "d19"
        },
        {
          "pin": 20,
          "terminal": "d20"
        },
        {
          "pin": 21,
          "terminal": "d21"
        },
        {
          "pin": 22,
          "terminal": "d22"
        },
        {
          "pin": 23,
          "terminal": "d23"
        },
        {
          "pin": 24,
          "terminal": "d24"
        },
        {
          "pin": 25,
          "terminal": "d25"
        },
        {
          "pin": 26,
          "terminal": "d26"
        },
        {
          "pin": 27,
          "terminal": "d27"
        },
        {
          "pin": 28,
          "terminal": "d28"
        },
        {
          "pin": 29,
          "terminal": "d29"
        },
        {
          "pin": 30,
          "terminal": "d30"
        },
        {
          "pin": 31,
          "terminal": "d31"
        },
        {
          "pin": 32,
          "terminal": "d32"
        },
        {
          "pin": 33,
          "terminal": "d33"
        },
        {
          "pin": 34,
          "terminal": "d34"
        },
        {
          "pin": 35,
          "terminal": "d35"
        },
        {
          "pin": 36,
          "terminal": "d36"
        },
        {
          "pin": 37,
          "terminal": "d37"
        },
        {
          "pin": 38,
          "terminal": "d38"
        },
        {
          "pin": 39,
          "terminal": "d39"
        },
        {
          "pin": 40,
          "terminal": "d40"
        },
        {
          "pin": 41,
          "terminal": "d41"
        },
        {
          "pin": 42,
          "terminal": "d42"
        },
        {
          "pin": 43,
          "terminal": "d43"
        },
        {
          "pin": 44,
          "terminal": "d44"
        },
        {
          "pin": 45,
          "terminal": "d45"
        },
        {
          "pin": 46,
          "terminal": "d46"
        },
        {
          "pin": 47,
          "terminal": "d47"
        },
        {
          "pin": 48,
          "terminal": "d48"
        },
        {
          "pin": 49,
          "terminal": "d49"
        },
        {
          "pin": 50,
          "terminal": "d50"
        },
        {
          "pin": 51,
          "terminal": "d51"
        },
        {
          "pin": 52,
          "terminal": "d52"
        },
        {
          "pin": 53,
          "terminal": "d53"
        },
        {
          "pin": 54,
          "terminal": "a0"
        },
        {
          "pin": 55,
          "terminal": "a1"
        },
        {
          "pin": 56,
          "terminal": "a2"
        },
        {
          "pin": 57,
          "terminal": "a3"
        },
        {
          "pin": 58,
          "terminal": "a4"
        },
        {
          "pin": 59,
          "terminal": "a5"
        },
        {
          "pin": 60,
          "terminal": "a6"
        },
        {
          "pin": 61,
          "terminal": "a7"
        },
        {
          "pin": 62,
          "terminal": "a8"
        },
        {
          "pin": 63,
          "terminal": "a9"
        },
        {
          "pin": 64,
          "terminal": "a10"
        },
        {
          "pin": 65,
          "terminal": "a11"
        },
        {
          "pin": 66,
          "terminal": "a12"
        },
        {
          "pin": 67,
          "terminal": "a13"
        },
        {
          "pin": 68,
          "terminal": "a14"
        },
        {
          "pin": 69,
          "terminal": "a15"
        }
      ]
    },
    {
      "kind": "pi_pico",
      "label": "Raspberry Pi Pico",
      "nominalVoltage": 3.3,
      "numbering": "GPn = n",
      "help": "GP0–GP22, GP25 and GP26–GP28 use their GPIO numbers. GP23/24/29 are unavailable.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "gp0"
        },
        {
          "pin": 1,
          "terminal": "gp1"
        },
        {
          "pin": 2,
          "terminal": "gp2"
        },
        {
          "pin": 3,
          "terminal": "gp3"
        },
        {
          "pin": 4,
          "terminal": "gp4"
        },
        {
          "pin": 5,
          "terminal": "gp5"
        },
        {
          "pin": 6,
          "terminal": "gp6"
        },
        {
          "pin": 7,
          "terminal": "gp7"
        },
        {
          "pin": 8,
          "terminal": "gp8"
        },
        {
          "pin": 9,
          "terminal": "gp9"
        },
        {
          "pin": 10,
          "terminal": "gp10"
        },
        {
          "pin": 11,
          "terminal": "gp11"
        },
        {
          "pin": 12,
          "terminal": "gp12"
        },
        {
          "pin": 13,
          "terminal": "gp13"
        },
        {
          "pin": 14,
          "terminal": "gp14"
        },
        {
          "pin": 15,
          "terminal": "gp15"
        },
        {
          "pin": 16,
          "terminal": "gp16"
        },
        {
          "pin": 17,
          "terminal": "gp17"
        },
        {
          "pin": 18,
          "terminal": "gp18"
        },
        {
          "pin": 19,
          "terminal": "gp19"
        },
        {
          "pin": 20,
          "terminal": "gp20"
        },
        {
          "pin": 21,
          "terminal": "gp21"
        },
        {
          "pin": 22,
          "terminal": "gp22"
        },
        {
          "pin": 25,
          "terminal": "gp25"
        },
        {
          "pin": 26,
          "terminal": "gp26"
        },
        {
          "pin": 27,
          "terminal": "gp27"
        },
        {
          "pin": 28,
          "terminal": "gp28"
        }
      ]
    },
    {
      "kind": "microbit",
      "label": "BBC micro:bit",
      "nominalVoltage": 3.3,
      "numbering": "Pn = n",
      "help": "The large P0, P1 and P2 edge pads use 0, 1 and 2.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "p0"
        },
        {
          "pin": 1,
          "terminal": "p1"
        },
        {
          "pin": 2,
          "terminal": "p2"
        }
      ]
    },
    {
      "kind": "microbit_breakout",
      "label": "BBC micro:bit breakout",
      "nominalVoltage": 3.3,
      "numbering": "Pn = n",
      "help": "The model exposes P0, P1, P2, P8, P12 and P16 using their pad numbers.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "p0"
        },
        {
          "pin": 1,
          "terminal": "p1"
        },
        {
          "pin": 2,
          "terminal": "p2"
        },
        {
          "pin": 8,
          "terminal": "p8"
        },
        {
          "pin": 12,
          "terminal": "p12"
        },
        {
          "pin": 16,
          "terminal": "p16"
        }
      ]
    },
    {
      "kind": "calliopemini",
      "label": "Calliope mini",
      "nominalVoltage": 3.3,
      "numbering": "Pn = n",
      "help": "The four ring pads P0–P3 use 0–3. Header and Grove pins are outside this model.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "p0"
        },
        {
          "pin": 1,
          "terminal": "p1"
        },
        {
          "pin": 2,
          "terminal": "p2"
        },
        {
          "pin": 3,
          "terminal": "p3"
        }
      ]
    },
    {
      "kind": "circuit_playground_express",
      "label": "Circuit Playground Express",
      "nominalVoltage": 3.3,
      "numbering": "An = n",
      "help": "The eight A0–A7 pads use 0–7 as digital pins. Onboard sensors and NeoPixels are separate devices.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "a0"
        },
        {
          "pin": 1,
          "terminal": "a1"
        },
        {
          "pin": 2,
          "terminal": "a2"
        },
        {
          "pin": 3,
          "terminal": "a3"
        },
        {
          "pin": 4,
          "terminal": "a4"
        },
        {
          "pin": 5,
          "terminal": "a5"
        },
        {
          "pin": 6,
          "terminal": "a6"
        },
        {
          "pin": 7,
          "terminal": "a7"
        }
      ]
    },
    {
      "kind": "pybadge",
      "label": "Adafruit PyBadge independent GPIO pads",
      "nominalVoltage": 3.3,
      "numbering": "Arduino digital IDs; RX = 0, TX = 1, FREE = 7; An = 14 + n",
      "help": "RX/TX use 0/1; D2/D3/D5/D6/D9–D13 keep their numbers; FREE uses 7; A0–A5 use 14–19; MISO/MOSI/SCK use 26/27/28. SDA/SCL and STEMMA aliases are unavailable. Onboard peripherals are separate devices.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "rx"
        },
        {
          "pin": 1,
          "terminal": "tx"
        },
        {
          "pin": 2,
          "terminal": "d2"
        },
        {
          "pin": 3,
          "terminal": "d3"
        },
        {
          "pin": 5,
          "terminal": "d5"
        },
        {
          "pin": 6,
          "terminal": "d6"
        },
        {
          "pin": 9,
          "terminal": "d9"
        },
        {
          "pin": 10,
          "terminal": "d10"
        },
        {
          "pin": 11,
          "terminal": "d11"
        },
        {
          "pin": 12,
          "terminal": "d12"
        },
        {
          "pin": 13,
          "terminal": "d13"
        },
        {
          "pin": 7,
          "terminal": "free"
        },
        {
          "pin": 14,
          "terminal": "a0"
        },
        {
          "pin": 15,
          "terminal": "a1"
        },
        {
          "pin": 16,
          "terminal": "a2"
        },
        {
          "pin": 17,
          "terminal": "a3"
        },
        {
          "pin": 18,
          "terminal": "a4"
        },
        {
          "pin": 19,
          "terminal": "a5"
        },
        {
          "pin": 26,
          "terminal": "miso"
        },
        {
          "pin": 27,
          "terminal": "mosi"
        },
        {
          "pin": 28,
          "terminal": "sck"
        }
      ]
    },
    {
      "kind": "esp8266",
      "label": "ESP8266",
      "nominalVoltage": 3.3,
      "numbering": "GPIOn = n",
      "help": "GPIO0–GPIO5 and GPIO12–GPIO15 use their GPIO numbers; flash pins and GPIO16 are unavailable.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "gpio0"
        },
        {
          "pin": 1,
          "terminal": "gpio1"
        },
        {
          "pin": 2,
          "terminal": "gpio2"
        },
        {
          "pin": 3,
          "terminal": "gpio3"
        },
        {
          "pin": 4,
          "terminal": "gpio4"
        },
        {
          "pin": 5,
          "terminal": "gpio5"
        },
        {
          "pin": 12,
          "terminal": "gpio12"
        },
        {
          "pin": 13,
          "terminal": "gpio13"
        },
        {
          "pin": 14,
          "terminal": "gpio14"
        },
        {
          "pin": 15,
          "terminal": "gpio15"
        }
      ]
    },
    {
      "kind": "esp32_4848s040",
      "label": "ESP32-4848S040 H1 connector",
      "nominalVoltage": 3.3,
      "numbering": "GPIOn = n",
      "help": "Only H1 expansion GPIO1, GPIO2, GPIO40, GPIO43 and GPIO44 are available; display and memory pins are excluded.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 1,
          "terminal": "gpio1"
        },
        {
          "pin": 2,
          "terminal": "gpio2"
        },
        {
          "pin": 40,
          "terminal": "gpio40"
        },
        {
          "pin": 43,
          "terminal": "gpio43"
        },
        {
          "pin": 44,
          "terminal": "gpio44"
        }
      ]
    },
    {
      "kind": "attiny85",
      "label": "ATtiny85 DIP-8",
      "nominalVoltage": 5,
      "numbering": "8 * port index + bit (A = 0)",
      "help": "PB0–PB5 use 8–13. This is logical circuit GPIO; reset and fuse behavior are not emulated by this host.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 8,
          "terminal": "pb0"
        },
        {
          "pin": 9,
          "terminal": "pb1"
        },
        {
          "pin": 10,
          "terminal": "pb2"
        },
        {
          "pin": 11,
          "terminal": "pb3"
        },
        {
          "pin": 12,
          "terminal": "pb4"
        },
        {
          "pin": 13,
          "terminal": "pb5"
        }
      ]
    },
    {
      "kind": "attiny88",
      "label": "ATtiny88 DIP-28",
      "nominalVoltage": 5,
      "numbering": "8 * port index + bit (A = 0)",
      "help": "PB0–PB7 use 8–15, PC0–PC7 use 16–23 and PD0–PD7 use 24–31. This package has no PA pads.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 8,
          "terminal": "pb0"
        },
        {
          "pin": 9,
          "terminal": "pb1"
        },
        {
          "pin": 10,
          "terminal": "pb2"
        },
        {
          "pin": 11,
          "terminal": "pb3"
        },
        {
          "pin": 12,
          "terminal": "pb4"
        },
        {
          "pin": 13,
          "terminal": "pb5"
        },
        {
          "pin": 14,
          "terminal": "pb6"
        },
        {
          "pin": 15,
          "terminal": "pb7"
        },
        {
          "pin": 16,
          "terminal": "pc0"
        },
        {
          "pin": 17,
          "terminal": "pc1"
        },
        {
          "pin": 18,
          "terminal": "pc2"
        },
        {
          "pin": 19,
          "terminal": "pc3"
        },
        {
          "pin": 20,
          "terminal": "pc4"
        },
        {
          "pin": 21,
          "terminal": "pc5"
        },
        {
          "pin": 22,
          "terminal": "pc6"
        },
        {
          "pin": 23,
          "terminal": "pc7"
        },
        {
          "pin": 24,
          "terminal": "pd0"
        },
        {
          "pin": 25,
          "terminal": "pd1"
        },
        {
          "pin": 26,
          "terminal": "pd2"
        },
        {
          "pin": 27,
          "terminal": "pd3"
        },
        {
          "pin": 28,
          "terminal": "pd4"
        },
        {
          "pin": 29,
          "terminal": "pd5"
        },
        {
          "pin": 30,
          "terminal": "pd6"
        },
        {
          "pin": 31,
          "terminal": "pd7"
        }
      ]
    },
    {
      "kind": "attiny88_qfn32",
      "label": "ATtiny88 QFN-32",
      "nominalVoltage": 5,
      "numbering": "8 * port index + bit (A = 0)",
      "help": "PA0–PA3 use 0–3; PB0–PB7 use 8–15, PC0–PC7 use 16–23 and PD0–PD7 use 24–31.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "pa0"
        },
        {
          "pin": 1,
          "terminal": "pa1"
        },
        {
          "pin": 2,
          "terminal": "pa2"
        },
        {
          "pin": 3,
          "terminal": "pa3"
        },
        {
          "pin": 8,
          "terminal": "pb0"
        },
        {
          "pin": 9,
          "terminal": "pb1"
        },
        {
          "pin": 10,
          "terminal": "pb2"
        },
        {
          "pin": 11,
          "terminal": "pb3"
        },
        {
          "pin": 12,
          "terminal": "pb4"
        },
        {
          "pin": 13,
          "terminal": "pb5"
        },
        {
          "pin": 14,
          "terminal": "pb6"
        },
        {
          "pin": 15,
          "terminal": "pb7"
        },
        {
          "pin": 16,
          "terminal": "pc0"
        },
        {
          "pin": 17,
          "terminal": "pc1"
        },
        {
          "pin": 18,
          "terminal": "pc2"
        },
        {
          "pin": 19,
          "terminal": "pc3"
        },
        {
          "pin": 20,
          "terminal": "pc4"
        },
        {
          "pin": 21,
          "terminal": "pc5"
        },
        {
          "pin": 22,
          "terminal": "pc6"
        },
        {
          "pin": 23,
          "terminal": "pc7"
        },
        {
          "pin": 24,
          "terminal": "pd0"
        },
        {
          "pin": 25,
          "terminal": "pd1"
        },
        {
          "pin": 26,
          "terminal": "pd2"
        },
        {
          "pin": 27,
          "terminal": "pd3"
        },
        {
          "pin": 28,
          "terminal": "pd4"
        },
        {
          "pin": 29,
          "terminal": "pd5"
        },
        {
          "pin": 30,
          "terminal": "pd6"
        },
        {
          "pin": 31,
          "terminal": "pd7"
        }
      ]
    },
    {
      "kind": "stm32f030",
      "label": "STM32F030 TSSOP-20",
      "nominalVoltage": 3.3,
      "numbering": "16 * port index + bit (A = 0)",
      "help": "PA0–PA7, PA9 and PA10 keep their bit numbers; PB1 uses 17. Boot, reset, crystal and SWD pads are excluded.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "pa0"
        },
        {
          "pin": 1,
          "terminal": "pa1"
        },
        {
          "pin": 2,
          "terminal": "pa2"
        },
        {
          "pin": 3,
          "terminal": "pa3"
        },
        {
          "pin": 4,
          "terminal": "pa4"
        },
        {
          "pin": 5,
          "terminal": "pa5"
        },
        {
          "pin": 6,
          "terminal": "pa6"
        },
        {
          "pin": 7,
          "terminal": "pa7"
        },
        {
          "pin": 9,
          "terminal": "pa9"
        },
        {
          "pin": 10,
          "terminal": "pa10"
        },
        {
          "pin": 17,
          "terminal": "pb1"
        }
      ]
    },
    {
      "kind": "eater6502",
      "label": "Eater 6502 VIA",
      "nominalVoltage": 5,
      "numbering": "VIA1 PA = 0–7; PB = 8–15",
      "help": "VIA1.PA0–PA7 use 0–7 and VIA1.PB0–PB7 use 8–15. The host drives the circuit pads without running the 6502 CPU.",
      "execution": "host-driven-circuit",
      "hardware": false,
      "nativeInterpreter": false,
      "pins": [
        {
          "pin": 0,
          "terminal": "via1.pa0"
        },
        {
          "pin": 1,
          "terminal": "via1.pa1"
        },
        {
          "pin": 2,
          "terminal": "via1.pa2"
        },
        {
          "pin": 3,
          "terminal": "via1.pa3"
        },
        {
          "pin": 4,
          "terminal": "via1.pa4"
        },
        {
          "pin": 5,
          "terminal": "via1.pa5"
        },
        {
          "pin": 6,
          "terminal": "via1.pa6"
        },
        {
          "pin": 7,
          "terminal": "via1.pa7"
        },
        {
          "pin": 8,
          "terminal": "via1.pb0"
        },
        {
          "pin": 9,
          "terminal": "via1.pb1"
        },
        {
          "pin": 10,
          "terminal": "via1.pb2"
        },
        {
          "pin": 11,
          "terminal": "via1.pb3"
        },
        {
          "pin": 12,
          "terminal": "via1.pb4"
        },
        {
          "pin": 13,
          "terminal": "via1.pb5"
        },
        {
          "pin": 14,
          "terminal": "via1.pb6"
        },
        {
          "pin": 15,
          "terminal": "via1.pb7"
        }
      ]
    }
  ]
};
