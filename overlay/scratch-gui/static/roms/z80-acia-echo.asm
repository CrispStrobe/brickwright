; SPDX-License-Identifier: BSD-3-Clause
; Brickwright Z80 ACIA echo lesson. Load at $0000.
        org $0000
        ld a,$03            ; Reset the MC6850.
        out ($80),a
        ld a,$16            ; 8 data bits, one stop bit, no receive interrupt.
        out ($80),a
ready:  in a,($80)
        and $01
        jr z,ready
        in a,($81)
        out ($81),a
        cp $0d
        jr nz,ready
        ld a,$0a            ; Complete the returned line after CR.
        out ($81),a
        jr ready
