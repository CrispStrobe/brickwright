; Lab: sort twelve RAM bytes
; Adapted from AshrithSagar/MicroController-Lab/Experiment-3/E3_E4.ASM
; Upstream commit: 11d6f887feaffb763b937693d440d79fda31a65c
; SDAS8051 syntax; setup and a stable finish address added by Brickwright.
; Predict: After one pass, where is the largest unsigned byte?
; Observe: IRAM 50-5B = 00 01 02 03 09 12 12 20 40 7F 80 FF.
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

; ARRANGE ELEMENTS OF MEMORY ARRAY IN ASCENDING ORDER
; [BUBBLE SORT]

    .area CODE (ABS)
    .org 0x0000; ORIGINATE
ajmp start					; JUMP TO THE LABEL START

start:
    ; Reproducible lesson setup: bank 0, interrupts off.
    mov 0xd0, #0x00
    mov 0xa8, #0x00
    mov 0x50, #0x80
    mov 0x51, #0x03
    mov 0x52, #0xff
    mov 0x53, #0x00
    mov 0x54, #0x12
    mov 0x55, #0x12
    mov 0x56, #0x09
    mov 0x57, #0x7f
    mov 0x58, #0x01
    mov 0x59, #0x40
    mov 0x5a, #0x02
    mov 0x5b, #0x20

	mov a, #12				; LENGTH OF ARRAY. CAN ENTER IN DECIMAL AS WELL.
	dec a					; [N-1] PASSES IN BUBBLE SORT
	mov 0x30, a				; COPY LENGTH AT ADDRESS (30H). TO BE USED AS A FIXED DATA.
	
nxt_pss:
	; RELOAD (R7) AND (R6) WITH THE LENGTH OF THE ARRAY
	mov r7, 0x30				; NOT REQUIRED?
	mov r6, 0x30
	
	mov r0, #0x50			; STARTING LOCATION OF THE ARRAY IN (R0). BUBBLING FROM LOWEST [FIXED] TO HIGHEST INDEX [VARYING].

nxt_cmp:
	mov a, @r0				; GET DATA FROM THE ARRAY
	mov r3, a				; DUPLICATE THE DATA TO (R3)
	inc r0					; INCREMENT TO THE NEXT LOCATION IN THE ARRAY
	mov 0x0f0, @r0			; DUPLICATE NEXT CONTENTS TO REG. B
	clr c					; CLEAR THE CARRY. SO THAT A ISN'T DECREMENTED WITH THE BORROW.
	subb a, 0xf0				; COMPARE A AND B
	
	; CARRY => B IS GREATER THAN A. NO SWAP REQUIRED.
	jc down
	
	; NO CARRY => A IS GREATER THAN B. SWAP REQUIRED.
	mov a, r3				; (R3) HAD THE COPY OF THE ORIGINAL DATA BACKED UP, AT (R0)
	mov @r0, a				; BUBBLE IT UP. (R0) POINTS TO THE NEXT INDEX.
	dec r0					; DECREMENT POINTER TO TEMPORARILY USE FOR THE SWAP
	mov @r0, 0x0f0			; THE ORIGINAL CONTENTS OF THE LOWER NUMBER WERE IN (B)
	inc r0					; INCREMENT FOR NEXT PASS
	
down:
	djnz r6, nxt_cmp		; DO (R6) COMPARISIONS IN EACH PASS
	djnz 0x30, nxt_pss		; (@30H) CONTAINS THE PASS COUNTER
	
here:
	ljmp bw_done				; LOGICAL END

    ; All observations are stable at this loop. No trainer ROM is needed.
    .org 0x0300
bw_done:
    sjmp bw_done
