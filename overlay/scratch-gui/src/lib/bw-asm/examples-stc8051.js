/**
 * Six reviewed 8051 exercises, adapted to the existing SDAS8051 route.
 * Original source files and the MIT notice are retained under
 * test/fixtures/bw8051-1/upstream/microcontroller-lab/.
 * The setup and explicit 0300h stop make every expected state reproducible.
 * No external trainer ROM or additional emulator is required.
 */
export const ASHRITH_SAGAR = Object.freeze({
    author: 'Ashrith Sagar',
    repo: 'https://github.com/AshrithSagar/MicroController-Lab',
    licence: 'MIT'
});

export const STC8051_TEACHING_EXAMPLES = [
    {
        "id": "lab-add16",
        "label": "Lab: add two 16-bit numbers",
        "labelDe": "Labor: zwei 16-Bit-Zahlen addieren",
        "file": "Experiment-2/E2_E2.ASM",
        "expect": {
            "registers": {
                "r6": 19,
                "r7": 210
            },
            "iram": [],
            "sfr": []
        },
        "observe": "R7:R6 = D213 hex (2E5F + A3B4).",
        "prediction": "Where does the carry from the low-byte addition go?",
        "source": "; Lab: add two 16-bit numbers\n; Adapted from AshrithSagar/MicroController-Lab/Experiment-2/E2_E2.ASM\n; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c\n; SDAS8051 syntax; setup and a stable finish address added by Brickwright.\n; Predict: Where does the carry from the low-byte addition go?\n; Observe: R7:R6 = D213 hex (2E5F + A3B4).\n; Run to code address 0300 hex, or pause after the program finishes there.\n;\n; MIT License\n; \n; Copyright (c) 2022 Ashrith Sagar\n; \n; Permission is hereby granted, free of charge, to any person obtaining a copy\n; of this software and associated documentation files (the \"Software\"), to deal\n; in the Software without restriction, including without limitation the rights\n; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n; copies of the Software, and to permit persons to whom the Software is\n; furnished to do so, subject to the following conditions:\n; \n; The above copyright notice and this permission notice shall be included in all\n; copies or substantial portions of the Software.\n; \n; THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n; SOFTWARE.\n\n; Write program to add two 16-bit numbers 2E5Fh and A3B4h.\n; Store the sum in R7 and R6.\n\n    .area CODE (ABS)\n    .org 0x0000; ORIGINATE\najmp start\t\t\t\t; JUMP TO THE LABEL START\n\nstart:\n    ; Reproducible lesson setup: bank 0, interrupts off.\n    mov 0xd0, #0x00\n    mov 0xa8, #0x00\n\n\tclr c\t\t\t\t; CLEAR CARRY\n\tmov a, #0x5f\t\t\t; MOVE DATA TO THE ACCUMULATOR\n\tadd a, #0x0b4\t\t; ADD THE LOW BYTES IN ACCUMULATOR\n\tmov r6, a\t\t\t; STORE THE SUM IN R6\n\tmov a, #0x2e\t\t\t; MOVE DATA TO THE ACCUMULATOR\n\taddc a, #0x0a3\t\t; ADD THE HIGH BYTES IN ACCUMULATOR\n\tmov r7, a\t\t\t; STORE THE SUM IN R7\n\nhere:\n\tljmp bw_done \t\t\t; LOGICAL END\n\n    ; All observations are stable at this loop. No trainer ROM is needed.\n    .org 0x0300\nbw_done:\n    sjmp bw_done\n",
        "stop": {
            "address": 768,
            "maxTicks": 100000
        },
        "upstream": {
            "repo": "https://github.com/AshrithSagar/MicroController-Lab",
            "ref": "11d6f887feaffb763b937693d440d79fda31a65c",
            "path": "Experiment-2/E2_E2.ASM",
            "blob": "c27a6c3f361f8705780368f98557c8e5a37aad74"
        }
    },
    {
        "id": "lab-and-port",
        "label": "Lab: AND two bytes on P2",
        "labelDe": "Labor: zwei Bytes mit UND auf P2",
        "file": "Experiment-2/E2_E5.ASM",
        "expect": {
            "registers": {
                "a": 34
            },
            "iram": [],
            "sfr": [
                {
                    "address": 160,
                    "bytes": [
                        34
                    ]
                }
            ]
        },
        "observe": "A and P2 = 22 hex (AA AND 23).",
        "prediction": "Which bits survive when both operands must contain a 1?",
        "source": "; Lab: AND two bytes on P2\n; Adapted from AshrithSagar/MicroController-Lab/Experiment-2/E2_E5.ASM\n; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c\n; SDAS8051 syntax; setup and a stable finish address added by Brickwright.\n; Predict: Which bits survive when both operands must contain a 1?\n; Observe: A and P2 = 22 hex (AA AND 23).\n; Run to code address 0300 hex, or pause after the program finishes there.\n;\n; MIT License\n; \n; Copyright (c) 2022 Ashrith Sagar\n; \n; Permission is hereby granted, free of charge, to any person obtaining a copy\n; of this software and associated documentation files (the \"Software\"), to deal\n; in the Software without restriction, including without limitation the rights\n; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n; copies of the Software, and to permit persons to whom the Software is\n; furnished to do so, subject to the following conditions:\n; \n; The above copyright notice and this permission notice shall be included in all\n; copies or substantial portions of the Software.\n; \n; THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n; SOFTWARE.\n\n; Perform the logical AND operation of two 8-bit data\n; available in R0 and R1 and output the result to port2.\n\n    .area CODE (ABS)\n    .org 0x0000; ORIGINATE\najmp start\t\t\t\t; JUMP TO THE LABEL START\n\nstart:\n    ; Reproducible lesson setup: bank 0, interrupts off.\n    mov 0xd0, #0x00\n    mov 0xa8, #0x00\n\n\tmov r1, #0x23\n\tmov r0, #0x0aa\n\tmov a, r0\n\tanl a, r1\n\tmov 0xa0, a\n\nhere:\n\tljmp bw_done \t\t\t; LOGICAL END\n\n    ; All observations are stable at this loop. No trainer ROM is needed.\n    .org 0x0300\nbw_done:\n    sjmp bw_done\n",
        "stop": {
            "address": 768,
            "maxTicks": 100000
        },
        "upstream": {
            "repo": "https://github.com/AshrithSagar/MicroController-Lab",
            "ref": "11d6f887feaffb763b937693d440d79fda31a65c",
            "path": "Experiment-2/E2_E5.ASM",
            "blob": "b3e499775307472ea5b2582847c7aab338cdcd0f"
        }
    },
    {
        "id": "lab-copy-array",
        "label": "Lab: copy ten RAM bytes",
        "labelDe": "Labor: zehn RAM-Bytes kopieren",
        "file": "Experiment-3/E3_E3.ASM",
        "expect": {
            "registers": {
                "r0": 90,
                "r1": 122,
                "r2": 0
            },
            "iram": [
                {
                    "address": 112,
                    "bytes": [
                        0,
                        1,
                        127,
                        128,
                        255,
                        85,
                        170,
                        16,
                        32,
                        66
                    ]
                }
            ],
            "sfr": []
        },
        "observe": "IRAM 70-79 = 00 01 7F 80 FF 55 AA 10 20 42; the source is at 50-59.",
        "prediction": "Why do R0 and R1 finish one byte beyond their arrays?",
        "source": "; Lab: copy ten RAM bytes\n; Adapted from AshrithSagar/MicroController-Lab/Experiment-3/E3_E3.ASM\n; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c\n; SDAS8051 syntax; setup and a stable finish address added by Brickwright.\n; Predict: Why do R0 and R1 finish one byte beyond their arrays?\n; Observe: IRAM 70-79 = 00 01 7F 80 FF 55 AA 10 20 42; the source is at 50-59.\n; Run to code address 0300 hex, or pause after the program finishes there.\n;\n; MIT License\n; \n; Copyright (c) 2022 Ashrith Sagar\n; \n; Permission is hereby granted, free of charge, to any person obtaining a copy\n; of this software and associated documentation files (the \"Software\"), to deal\n; in the Software without restriction, including without limitation the rights\n; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n; copies of the Software, and to permit persons to whom the Software is\n; furnished to do so, subject to the following conditions:\n; \n; The above copyright notice and this permission notice shall be included in all\n; copies or substantial portions of the Software.\n; \n; THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n; SOFTWARE.\n\n; TRANSFER MEMORY CONTENTS STARTING FROM 50H TO 59H IN THE SAME SEQUENCE, TO LOCATION STARTING FROM 70H\n\n    .area CODE (ABS)\n    .org 0x0000; ORIGINATE\najmp start\t\t\t\t\t; JUMP TO THE LABEL START\n\nstart:\n    ; Reproducible lesson setup: bank 0, interrupts off.\n    mov 0xd0, #0x00\n    mov 0xa8, #0x00\n    mov 0x50, #0x00\n    mov 0x51, #0x01\n    mov 0x52, #0x7f\n    mov 0x53, #0x80\n    mov 0x54, #0xff\n    mov 0x55, #0x55\n    mov 0x56, #0xaa\n    mov 0x57, #0x10\n    mov 0x58, #0x20\n    mov 0x59, #0x42\n\n\tmov r2, #0x0a\t\t\t; LENGTH OF THE ARRAYS TO BE DUPLICATED. I.E. DECIMAL 10.\n\tmov r0, #0x50\t\t\t; ADDRESS OF SOURCE\n\tmov r1, #0x70\t\t\t; ADDRESS OF DESTINATION\n\nup:\n\tmov a, @r0\t\t\t\t; GET SOURCE CONTENT\n\tmov @r1, a\t\t\t\t; MOVE TO DESTINATION\n\t; INCREMENT BOTH SOURCE AND DESTINATION DATA POINTERS\n\tinc r0\t\t\t\t\t\n\tinc r1\n\tdjnz r2, up\t\t\t\t; REPEAT (R2) TIMES. I.E. TILL THE LENGTH OF THE ARRAY\n\nhere:\n\tljmp bw_done\t\t\t\t; LOGICAL END\n\n    ; All observations are stable at this loop. No trainer ROM is needed.\n    .org 0x0300\nbw_done:\n    sjmp bw_done\n",
        "stop": {
            "address": 768,
            "maxTicks": 100000
        },
        "upstream": {
            "repo": "https://github.com/AshrithSagar/MicroController-Lab",
            "ref": "11d6f887feaffb763b937693d440d79fda31a65c",
            "path": "Experiment-3/E3_E3.ASM",
            "blob": "c78aa2675df06f9d798233a7e01f24e366c36b00"
        }
    },
    {
        "id": "lab-sort-array",
        "label": "Lab: sort twelve RAM bytes",
        "labelDe": "Labor: zwölf RAM-Bytes sortieren",
        "file": "Experiment-3/E3_E4.ASM",
        "expect": {
            "registers": {
                "r6": 0
            },
            "iram": [
                {
                    "address": 80,
                    "bytes": [
                        0,
                        1,
                        2,
                        3,
                        9,
                        18,
                        18,
                        32,
                        64,
                        127,
                        128,
                        255
                    ]
                }
            ],
            "sfr": []
        },
        "observe": "IRAM 50-5B = 00 01 02 03 09 12 12 20 40 7F 80 FF.",
        "prediction": "After one pass, where is the largest unsigned byte?",
        "source": "; Lab: sort twelve RAM bytes\n; Adapted from AshrithSagar/MicroController-Lab/Experiment-3/E3_E4.ASM\n; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c\n; SDAS8051 syntax; setup and a stable finish address added by Brickwright.\n; Predict: After one pass, where is the largest unsigned byte?\n; Observe: IRAM 50-5B = 00 01 02 03 09 12 12 20 40 7F 80 FF.\n; Run to code address 0300 hex, or pause after the program finishes there.\n;\n; MIT License\n; \n; Copyright (c) 2022 Ashrith Sagar\n; \n; Permission is hereby granted, free of charge, to any person obtaining a copy\n; of this software and associated documentation files (the \"Software\"), to deal\n; in the Software without restriction, including without limitation the rights\n; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n; copies of the Software, and to permit persons to whom the Software is\n; furnished to do so, subject to the following conditions:\n; \n; The above copyright notice and this permission notice shall be included in all\n; copies or substantial portions of the Software.\n; \n; THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n; SOFTWARE.\n\n; ARRANGE ELEMENTS OF MEMORY ARRAY IN ASCENDING ORDER\n; [BUBBLE SORT]\n\n    .area CODE (ABS)\n    .org 0x0000; ORIGINATE\najmp start\t\t\t\t\t; JUMP TO THE LABEL START\n\nstart:\n    ; Reproducible lesson setup: bank 0, interrupts off.\n    mov 0xd0, #0x00\n    mov 0xa8, #0x00\n    mov 0x50, #0x80\n    mov 0x51, #0x03\n    mov 0x52, #0xff\n    mov 0x53, #0x00\n    mov 0x54, #0x12\n    mov 0x55, #0x12\n    mov 0x56, #0x09\n    mov 0x57, #0x7f\n    mov 0x58, #0x01\n    mov 0x59, #0x40\n    mov 0x5a, #0x02\n    mov 0x5b, #0x20\n\n\tmov a, #12\t\t\t\t; LENGTH OF ARRAY. CAN ENTER IN DECIMAL AS WELL.\n\tdec a\t\t\t\t\t; [N-1] PASSES IN BUBBLE SORT\n\tmov 0x30, a\t\t\t\t; COPY LENGTH AT ADDRESS (30H). TO BE USED AS A FIXED DATA.\n\t\nnxt_pss:\n\t; RELOAD (R7) AND (R6) WITH THE LENGTH OF THE ARRAY\n\tmov r7, 0x30\t\t\t\t; NOT REQUIRED?\n\tmov r6, 0x30\n\t\n\tmov r0, #0x50\t\t\t; STARTING LOCATION OF THE ARRAY IN (R0). BUBBLING FROM LOWEST [FIXED] TO HIGHEST INDEX [VARYING].\n\nnxt_cmp:\n\tmov a, @r0\t\t\t\t; GET DATA FROM THE ARRAY\n\tmov r3, a\t\t\t\t; DUPLICATE THE DATA TO (R3)\n\tinc r0\t\t\t\t\t; INCREMENT TO THE NEXT LOCATION IN THE ARRAY\n\tmov 0x0f0, @r0\t\t\t; DUPLICATE NEXT CONTENTS TO REG. B\n\tclr c\t\t\t\t\t; CLEAR THE CARRY. SO THAT A ISN'T DECREMENTED WITH THE BORROW.\n\tsubb a, 0xf0\t\t\t\t; COMPARE A AND B\n\t\n\t; CARRY => B IS GREATER THAN A. NO SWAP REQUIRED.\n\tjc down\n\t\n\t; NO CARRY => A IS GREATER THAN B. SWAP REQUIRED.\n\tmov a, r3\t\t\t\t; (R3) HAD THE COPY OF THE ORIGINAL DATA BACKED UP, AT (R0)\n\tmov @r0, a\t\t\t\t; BUBBLE IT UP. (R0) POINTS TO THE NEXT INDEX.\n\tdec r0\t\t\t\t\t; DECREMENT POINTER TO TEMPORARILY USE FOR THE SWAP\n\tmov @r0, 0x0f0\t\t\t; THE ORIGINAL CONTENTS OF THE LOWER NUMBER WERE IN (B)\n\tinc r0\t\t\t\t\t; INCREMENT FOR NEXT PASS\n\t\ndown:\n\tdjnz r6, nxt_cmp\t\t; DO (R6) COMPARISIONS IN EACH PASS\n\tdjnz 0x30, nxt_pss\t\t; (@30H) CONTAINS THE PASS COUNTER\n\t\nhere:\n\tljmp bw_done\t\t\t\t; LOGICAL END\n\n    ; All observations are stable at this loop. No trainer ROM is needed.\n    .org 0x0300\nbw_done:\n    sjmp bw_done\n",
        "stop": {
            "address": 768,
            "maxTicks": 100000
        },
        "upstream": {
            "repo": "https://github.com/AshrithSagar/MicroController-Lab",
            "ref": "11d6f887feaffb763b937693d440d79fda31a65c",
            "path": "Experiment-3/E3_E4.ASM",
            "blob": "5001b8e8984a8af2c391f8f61d23a60c1afcd93f"
        }
    },
    {
        "id": "lab-decimal-digits",
        "label": "Lab: hexadecimal to decimal digits",
        "labelDe": "Labor: Hexzahl in Dezimalziffern zerlegen",
        "file": "Experiment-3/E3_E5.ASM",
        "expect": {
            "registers": {
                "r5": 1,
                "r6": 7,
                "r7": 1
            },
            "iram": [],
            "sfr": []
        },
        "observe": "R5:R6:R7 = 1, 7, 1: AB hex is 171 decimal.",
        "prediction": "Which register holds the quotient and which holds the remainder after DIV AB?",
        "source": "; Lab: hexadecimal to decimal digits\n; Adapted from AshrithSagar/MicroController-Lab/Experiment-3/E3_E5.ASM\n; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c\n; SDAS8051 syntax; setup and a stable finish address added by Brickwright.\n; Predict: Which register holds the quotient and which holds the remainder after DIV AB?\n; Observe: R5:R6:R7 = 1, 7, 1: AB hex is 171 decimal.\n; Run to code address 0300 hex, or pause after the program finishes there.\n;\n; MIT License\n; \n; Copyright (c) 2022 Ashrith Sagar\n; \n; Permission is hereby granted, free of charge, to any person obtaining a copy\n; of this software and associated documentation files (the \"Software\"), to deal\n; in the Software without restriction, including without limitation the rights\n; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n; copies of the Software, and to permit persons to whom the Software is\n; furnished to do so, subject to the following conditions:\n; \n; The above copyright notice and this permission notice shall be included in all\n; copies or substantial portions of the Software.\n; \n; THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n; SOFTWARE.\n\n; CONVERT 8-BIT HEXADECIMAL TO DECIMAL\n\n    .area CODE (ABS)\n    .org 0x0000; ORIGINATE\najmp start\t\t\t\t; JUMP TO THE LABEL START\n\nstart:\n    ; Reproducible lesson setup: bank 0, interrupts off.\n    mov 0xd0, #0x00\n    mov 0xa8, #0x00\n\n\tmov a, #0x0ab\t\t; INPUT DATA\n\tmov 0x0f0, #10\t\t; DECIMAL 10 STORED IN B\n\tdiv ab\t\t\t\t; DIV INPUT BY DECIMAL 10\n\tmov r7, 0x0f0\t\t; REMINDER STORED IN (R7). THIS IS THE LOWER DECIMAL DIGIT\n\tmov 0xf0, #10\t\t\t; DECIMAL 10 STORED IN B AGAIN\n\tdiv ab\t\t\t\t; DIV [QUOTIENT] BY DECIMAL 10. (A) CONTAINED THE QUOTIENT FROM PREVIOUS STEP\n\tmov r6, 0x0f0\t\t; REMINDER STORED IN (R6). THIS IS THE MIDDLE DIGIT\n\tmov r5, a\t\t\t; QUOTIENT STORED IN (R5). THIS IS THE UPPER DIGIT\n\nhere:\n\tljmp bw_done\t\t\t; LOGICAL END\n\n    ; All observations are stable at this loop. No trainer ROM is needed.\n    .org 0x0300\nbw_done:\n    sjmp bw_done\n",
        "stop": {
            "address": 768,
            "maxTicks": 100000
        },
        "upstream": {
            "repo": "https://github.com/AshrithSagar/MicroController-Lab",
            "ref": "11d6f887feaffb763b937693d440d79fda31a65c",
            "path": "Experiment-3/E3_E5.ASM",
            "blob": "46e96d48cf24aa3142ac030e8d573535e0245dd2"
        }
    },
    {
        "id": "lab-rotate16",
        "label": "Lab: rotate a 16-bit register pair",
        "labelDe": "Labor: ein 16-Bit-Registerpaar rotieren",
        "file": "Experiment-4/E4_X2.ASM",
        "expect": {
            "registers": {
                "r0": 1,
                "r1": 3
            },
            "iram": [],
            "sfr": []
        },
        "observe": "R1:R0 changes from 8180 to 0301 hex after one circular left rotation.",
        "prediction": "How does carry connect the two 8-bit rotations?",
        "source": "; Lab: rotate a 16-bit register pair\n; Adapted from AshrithSagar/MicroController-Lab/Experiment-4/E4_X2.ASM\n; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c\n; SDAS8051 syntax; setup and a stable finish address added by Brickwright.\n; Predict: How does carry connect the two 8-bit rotations?\n; Observe: R1:R0 changes from 8180 to 0301 hex after one circular left rotation.\n; Run to code address 0300 hex, or pause after the program finishes there.\n;\n; MIT License\n; \n; Copyright (c) 2022 Ashrith Sagar\n; \n; Permission is hereby granted, free of charge, to any person obtaining a copy\n; of this software and associated documentation files (the \"Software\"), to deal\n; in the Software without restriction, including without limitation the rights\n; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n; copies of the Software, and to permit persons to whom the Software is\n; furnished to do so, subject to the following conditions:\n; \n; The above copyright notice and this permission notice shall be included in all\n; copies or substantial portions of the Software.\n; \n; THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n; SOFTWARE.\n\n; Assuming R1:R0 registers as an 16 bit register rotate the\n; content of this register left such that bit-7 of R0 becomes\n; bit 0 of R1 and bit-7 of R1 becomes bit-0 of R0.\n\n    .area CODE (ABS)\n    .org 0x0000; ORIGINATE\najmp start\t\t\t\t; JUMP TO THE LABEL START\n\nstart:\n    ; Reproducible lesson setup: bank 0, interrupts off.\n    mov 0xd0, #0x00\n    mov 0xa8, #0x00\n    mov r1, #0x81\n    mov r0, #0x80\n\n\tclr c \t\t\t\t; CLEAR CARRY\n\n\tmov a, r1 \t\t\t; GET HIGHER BYTE IN ACCUMULATOR\n\n\t; MASK AND GET THE FIRST BIT OF THE HIGHER BYTE, AND STORE IN ACCUMULATOR\n\tanl a, #0x80 \t\t; (80H) IS (10000000B)\n\n\t; IF ACCUMULATOR IS ZERO => BIT-7 OF HIGHER BYTE IS 0\n\t; => ALLOW CARRY BIT TO BE 0;\n\tjz rotations\n\n\t; IF ACCUMULATOR IS NON-ZERO => BIT-7 OF HIGHER BYTE IS 1\n\t; => CHANGE CARRY BIT TO BE 1;\n\tsetb c \t\t\t\t; SET THE CARRY BIT\n\nrotations:\n\tmov a, r0 \t\t\t; GET LOWER BYTE IN ACCUMULATOR\n\trlc a \t\t\t\t; ROTATE LEFT ACCUMULATOR, WHICH HAS THE LOWER BYTE\n\tmov r0, a \t\t\t; STORE LOWER BYTE IN (R0)\n\n\t; THE CARRY BIT IS NOW THE BIT-7 OF THE LOWER BYTE\n\n\tmov a, r1 \t\t\t; GET HIGHER BYTE IN THE ACCUMULATOR AGAIN\n\trlc a \t\t\t\t; ROTATE LEFT ACCUMULATOR, WHICH HAS THE HIGHER BYTE\n\tmov r1, a \t\t\t; STORE HIGHER BYTE IN (R1)\n\n\tljmp bw_done \t\t\t; END\n\nhere:\n\tljmp bw_done\t\t\t; LOGICAL END\n\n    ; All observations are stable at this loop. No trainer ROM is needed.\n    .org 0x0300\nbw_done:\n    sjmp bw_done\n",
        "stop": {
            "address": 768,
            "maxTicks": 100000
        },
        "upstream": {
            "repo": "https://github.com/AshrithSagar/MicroController-Lab",
            "ref": "11d6f887feaffb763b937693d440d79fda31a65c",
            "path": "Experiment-4/E4_X2.ASM",
            "blob": "c9d7e09e159f1a6918034fdb91e338e4614b77a6"
        }
    }
].map(example => ({...example, attribution: ASHRITH_SAGAR}));

export default STC8051_TEACHING_EXAMPLES;
