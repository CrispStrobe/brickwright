; Lab: copy ten RAM bytes
; Adapted from AshrithSagar/MicroController-Lab/Experiment-3/E3_E3.ASM
; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c
; SDAS8051 syntax; setup and a stable finish address added by Brickwright.
; Predict: Why do R0 and R1 finish one byte beyond their arrays?
; Observe: IRAM 70-79 = 00 01 7F 80 FF 55 AA 10 20 42; the source is at 50-59.
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

; TRANSFER MEMORY CONTENTS STARTING FROM 50H TO 59H IN THE SAME SEQUENCE, TO LOCATION STARTING FROM 70H

    .area CODE (ABS)
    .org 0x0000; ORIGINATE
ajmp start					; JUMP TO THE LABEL START

start:
    ; Reproducible lesson setup: bank 0, interrupts off.
    mov 0xd0, #0x00
    mov 0xa8, #0x00
    mov 0x50, #0x00
    mov 0x51, #0x01
    mov 0x52, #0x7f
    mov 0x53, #0x80
    mov 0x54, #0xff
    mov 0x55, #0x55
    mov 0x56, #0xaa
    mov 0x57, #0x10
    mov 0x58, #0x20
    mov 0x59, #0x42

	mov r2, #0x0a			; LENGTH OF THE ARRAYS TO BE DUPLICATED. I.E. DECIMAL 10.
	mov r0, #0x50			; ADDRESS OF SOURCE
	mov r1, #0x70			; ADDRESS OF DESTINATION

up:
	mov a, @r0				; GET SOURCE CONTENT
	mov @r1, a				; MOVE TO DESTINATION
	; INCREMENT BOTH SOURCE AND DESTINATION DATA POINTERS
	inc r0					
	inc r1
	djnz r2, up				; REPEAT (R2) TIMES. I.E. TILL THE LENGTH OF THE ARRAY

here:
	ljmp bw_done				; LOGICAL END

    ; All observations are stable at this loop. No trainer ROM is needed.
    .org 0x0300
bw_done:
    sjmp bw_done
