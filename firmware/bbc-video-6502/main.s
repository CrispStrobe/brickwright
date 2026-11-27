; SPDX-License-Identifier: BSD-3-Clause
.setcpu "65C02"

MODE_PORT = $8000
PALETTE   = $8001
KEY       = $9004

ptr       = $00
mode      = $02
glyph     = $03
raster    = $04
ink       = $05
charIndex = $06

.segment "CODE"
reset:
    sei
    cld
    ldx #$FF
    txs
    stz mode
    jsr draw
read_key:
    lda KEY
    sec
    sbc #'0'
    cmp #7
    bcs read_key
    cmp mode
    beq read_key
    sta mode
    jsr draw
    bra read_key

draw:
    lda #$FF
    sta MODE_PORT
    ldx mode
    lda startPages,x
    sta ptr+1
    stz ptr
    lda #0
    tay
clear_page:
    sta (ptr),y
    iny
    bne clear_page
    inc ptr+1
    bpl clear_page

    lda startPages,x
    sta ptr+1
    stz charIndex
title_loop:
    ldy charIndex
    lda titleGlyphs,y
    jsr draw_glyph
    inc charIndex
    lda charIndex
    cmp #5
    bne title_loop
    lda mode
    jsr draw_glyph

    ; A plus in the last cell exercises the last column and raster row.
    ldx mode
    lda endPages,x
    sta ptr+1
    lda finalCell,x
    sta ptr
    lda #15
    jsr draw_glyph

    ldx mode
    lda bandPages,x
    beq enable
    sta ptr+1
    stz ptr
    ldx #0
next_band:
    lda #16
    sta glyph
    lda bandColours,x
    sta ink
band_byte:
    ldy #0
fill_rasters:
    lda ink
    sta (ptr),y
    iny
    cpy #8
    bne fill_rasters
    jsr next_column
    dec glyph
    bne band_byte
    inx
    cpx #5
    bne next_band
enable:
    ldx #15
palette_loop:
    lda demoPalette,x
    sta PALETTE
    dex
    bpl palette_loop
    ldx mode
    lda highlightPalette,x
    sta PALETTE
    stx MODE_PORT
    rts

; A glyph is eight one-bit pixel rows. Repeat its bits across the selected
; number of planes, storing consecutive groups eight addresses apart.
draw_glyph:
    asl
    asl
    asl
    sta glyph
    stz raster
glyph_row:
    ldx glyph
    lda font,x
    sta ink
    ldx mode
    lda planeCount,x
    cmp #1
    bne packed_row
    lda ink
    ldy raster
    sta (ptr),y
    bra next_raster
packed_row:
    ldx mode
    lda planeCount,x
    cmp #2
    bne four_plane
    lda ink
    lsr
    lsr
    lsr
    lsr
    tax
    ldy raster
    lda doubleNibble,x
    sta (ptr),y
    tya
    clc
    adc #8
    tay
    lda ink
    and #$0F
    tax
    lda doubleNibble,x
    sta (ptr),y
    bra next_raster
four_plane:
    ldy raster
paired_pixels:
    lda ink
    lsr
    lsr
    lsr
    lsr
    lsr
    lsr
    tax
    lda repeatPair,x
    sta (ptr),y
    asl ink
    asl ink
    tya
    clc
    adc #8
    tay
    cpy #32
    bcc paired_pixels
next_raster:
    inc glyph
    inc raster
    lda raster
    cmp #8
    bne glyph_row
    ldx mode
    ldy planeCount,x
advance_glyph:
    jsr next_column
    dey
    bne advance_glyph
    rts

next_column:
    lda ptr
    clc
    adc #8
    sta ptr
    bcc :+
    inc ptr+1
:   rts

interrupt:
    rti

startPages:       .byte $30,$30,$30,$40,$58,$58,$60
endPages:         .byte $7F,$7F,$7F,$7E,$7F,$7F,$7F
finalCell:        .byte $F8,$F0,$E0,$78,$F8,$F0,$38
planeCount:       .byte 1,2,4,1,1,2,1
; The middle character row starts at $5800 for 80 byte scanlines,
; and $6C00 for 40 byte scanlines. Text layouts only draw glyphs.
bandPages:        .byte $58,$58,$58,0,$6C,$6C,0
; One complete scanline (80 bytes) or half-width board scanlines (40
; bytes, wrapping to a second raster band), visible across its width.
bandColours:      .byte $FF,$F0,$55,$0F,$CC
demoPalette:      .byte $00,$11,$22,$33,$44,$55,$66,$77,$87,$96,$A5,$B4,$C3,$D2,$E1,$F7
highlightPalette: .byte $17,$37,$F7,$17,$17,$37,$17
titleGlyphs:      .byte 7,8,9,10,11
doubleNibble:     .repeat 16, i
                    .byte i * $11
                  .endrepeat
repeatPair:       .byte $00,$55,$AA,$FF

font:
    .byte $3C,$66,$6E,$76,$66,$66,$3C,$00 ; 0
    .byte $18,$38,$18,$18,$18,$18,$7E,$00 ; 1
    .byte $3C,$66,$06,$0C,$30,$60,$7E,$00 ; 2
    .byte $3C,$66,$06,$1C,$06,$66,$3C,$00 ; 3
    .byte $0C,$1C,$3C,$6C,$7E,$0C,$0C,$00 ; 4
    .byte $7E,$60,$7C,$06,$06,$66,$3C,$00 ; 5
    .byte $1C,$30,$60,$7C,$66,$66,$3C,$00 ; 6
    .byte $C3,$E7,$FF,$DB,$C3,$C3,$C3,$00 ; M
    .byte $3C,$66,$C3,$C3,$C3,$66,$3C,$00 ; O
    .byte $F8,$CC,$C6,$C6,$C6,$CC,$F8,$00 ; D
    .byte $FE,$C0,$C0,$F8,$C0,$C0,$FE,$00 ; E
    .byte $00,$00,$00,$00,$00,$00,$00,$00 ; space
    .res 24, $00
    .byte $18,$18,$18,$FF,$FF,$18,$18,$18 ; +

.segment "VECTORS"
    .word interrupt, reset, interrupt
