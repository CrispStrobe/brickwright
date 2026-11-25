; Lab: AND two bytes on P2
; Adapted from AshrithSagar/MicroController-Lab/Experiment-2/E2_E5.ASM
; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c
; SDAS8051 syntax; setup and a stable finish address added by Brickwright.
; Predict: Which bits survive when both operands must contain a 1?
; Observe: A and P2 = 22 hex (AA AND 23).
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

; Perform the logical AND operation of two 8-bit data
; available in R0 and R1 and output the result to port2.

    .area CODE (ABS)
    .org 0x0000; ORIGINATE
ajmp start				; JUMP TO THE LABEL START

start:
    ; Reproducible lesson setup: bank 0, interrupts off.
    mov 0xd0, #0x00
    mov 0xa8, #0x00

	mov r1, #0x23
	mov r0, #0x0aa
	mov a, r0
	anl a, r1
	mov 0xa0, a

here:
	ljmp bw_done 			; LOGICAL END

    ; All observations are stable at this loop. No trainer ROM is needed.
    .org 0x0300
bw_done:
    sjmp bw_done
