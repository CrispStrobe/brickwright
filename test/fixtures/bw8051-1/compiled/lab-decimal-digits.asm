; Lab: hexadecimal to decimal digits
; Adapted from AshrithSagar/MicroController-Lab/Experiment-3/E3_E5.ASM
; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c
; SDAS8051 syntax; setup and a stable finish address added by Brickwright.
; Predict: Which register holds the quotient and which holds the remainder after DIV AB?
; Observe: R5:R6:R7 = 1, 7, 1: AB hex is 171 decimal.
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

; CONVERT 8-BIT HEXADECIMAL TO DECIMAL

    .area CODE (ABS)
    .org 0x0000; ORIGINATE
ajmp start				; JUMP TO THE LABEL START

start:
    ; Reproducible lesson setup: bank 0, interrupts off.
    mov 0xd0, #0x00
    mov 0xa8, #0x00

	mov a, #0x0ab		; INPUT DATA
	mov 0x0f0, #10		; DECIMAL 10 STORED IN B
	div ab				; DIV INPUT BY DECIMAL 10
	mov r7, 0x0f0		; REMINDER STORED IN (R7). THIS IS THE LOWER DECIMAL DIGIT
	mov 0xf0, #10			; DECIMAL 10 STORED IN B AGAIN
	div ab				; DIV [QUOTIENT] BY DECIMAL 10. (A) CONTAINED THE QUOTIENT FROM PREVIOUS STEP
	mov r6, 0x0f0		; REMINDER STORED IN (R6). THIS IS THE MIDDLE DIGIT
	mov r5, a			; QUOTIENT STORED IN (R5). THIS IS THE UPPER DIGIT

here:
	ljmp bw_done			; LOGICAL END

    ; All observations are stable at this loop. No trainer ROM is needed.
    .org 0x0300
bw_done:
    sjmp bw_done
