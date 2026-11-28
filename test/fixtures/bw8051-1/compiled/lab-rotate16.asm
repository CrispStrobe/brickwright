; Lab: rotate a 16-bit register pair
; Adapted from AshrithSagar/MicroController-Lab/Experiment-4/E4_X2.ASM
; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c
; SDAS8051 syntax; setup and a stable finish address added by Brickwright.
; Predict: How does carry connect the two 8-bit rotations?
; Observe: R1:R0 changes from 8180 to 0301 hex after one circular left rotation.
; Run to code address 0300 hex, or pause after the program finishes there.
;
; MIT License
; 
; Copyright (c) 2022 Ashrith Sagar
; 
; Permission is hereby granted, free of charge, to any person obtaining a copy
; of this software and associated documentation files (the "Software"), to deal
; in the Software without restriction, including without limitation the rights
; to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
; copies of the Software, and to permit persons to whom the Software is
; furnished to do so, subject to the following conditions:
; 
; The above copyright notice and this permission notice shall be included in all
; copies or substantial portions of the Software.
; 
; THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
; IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
; FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
; AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
; LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
; OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
; SOFTWARE.

; Assuming R1:R0 registers as an 16 bit register rotate the
; content of this register left such that bit-7 of R0 becomes
; bit 0 of R1 and bit-7 of R1 becomes bit-0 of R0.

    .area CODE (ABS)
    .org 0x0000; ORIGINATE
ajmp start				; JUMP TO THE LABEL START

start:
    ; Reproducible lesson setup: bank 0, interrupts off.
    mov 0xd0, #0x00
    mov 0xa8, #0x00
    mov r1, #0x81
    mov r0, #0x80

	clr c 				; CLEAR CARRY

	mov a, r1 			; GET HIGHER BYTE IN ACCUMULATOR

	; MASK AND GET THE FIRST BIT OF THE HIGHER BYTE, AND STORE IN ACCUMULATOR
	anl a, #0x80 		; (80H) IS (10000000B)

	; IF ACCUMULATOR IS ZERO => BIT-7 OF HIGHER BYTE IS 0
	; => ALLOW CARRY BIT TO BE 0;
	jz rotations

	; IF ACCUMULATOR IS NON-ZERO => BIT-7 OF HIGHER BYTE IS 1
	; => CHANGE CARRY BIT TO BE 1;
	setb c 				; SET THE CARRY BIT

rotations:
	mov a, r0 			; GET LOWER BYTE IN ACCUMULATOR
	rlc a 				; ROTATE LEFT ACCUMULATOR, WHICH HAS THE LOWER BYTE
	mov r0, a 			; STORE LOWER BYTE IN (R0)

	; THE CARRY BIT IS NOW THE BIT-7 OF THE LOWER BYTE

	mov a, r1 			; GET HIGHER BYTE IN THE ACCUMULATOR AGAIN
	rlc a 				; ROTATE LEFT ACCUMULATOR, WHICH HAS THE HIGHER BYTE
	mov r1, a 			; STORE HIGHER BYTE IN (R1)

	ljmp bw_done 			; END

here:
	ljmp bw_done			; LOGICAL END

    ; All observations are stable at this loop. No trainer ROM is needed.
    .org 0x0300
bw_done:
    sjmp bw_done
