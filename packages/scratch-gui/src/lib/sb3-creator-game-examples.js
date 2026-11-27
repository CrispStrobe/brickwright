// Original, playable game examples for the pseudocode gallery. Kept in a separate
// module so the language examples remain readable. Every game uses only commands
// accepted by SB3Creator and is compiled to ordinary Scratch blocks.
const rawGameExamples = {
    g2048: `# Nova Grid — a complete slide-and-fuse strategy game.
# GOAL: forge the 2048 Nova tile before the four-by-four reactor locks.
# CONTROLS: Arrow keys slide every tile. Equal neighbours fuse once per move.
# Consecutive fusions in one move build a chain multiplier. Space starts/restarts.
GLOBAL score
GLOBAL chain
GLOBAL started
GLOBAL moved
GLOBAL p
GLOBAL v
GLOBAL old
GLOBAL i
GLOBAL idx
GLOBAL empties
GLOBAL nv
GLOBAL won
GLOBAL possible
GLOBAL r
GLOBAL c
GLOBAL touchX
GLOBAL touchY
GLOBAL touchLock

STAGE:
  BACKDROP intro art nova-grid/intro
  BACKDROP reactor art nova-grid/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable chain
    wait 0.6 seconds
    IF started = 0 THEN:
      set started to 1
      switch backdrop to reactor
      broadcast "ignite nova grid"
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to reactor
      broadcast "ignite nova grid"
  WHEN I receive "touch start nova":
    IF started = 0 THEN:
      set started to 1
      switch backdrop to reactor
      broadcast "ignite nova grid"

SPRITE Board:
  LIST grid
  LIST linebuf
  COSTUME blank tile "" #17233f
  COSTUME t2 tile "2" #d9f7ff #18314f
  COSTUME t4 tile "4" #8ce8f5 #123653
  COSTUME t8 tile "8" #64c9ff #092747
  COSTUME t16 tile "16" #7e9cff #ffffff
  COSTUME t32 tile "32" #9c77ed #ffffff
  COSTUME t64 tile "64" #d85ee8 #ffffff
  COSTUME t128 tile "128" #f15ba7 #ffffff
  COSTUME t256 tile "256" #ff6a68 #ffffff
  COSTUME t512 tile "512" #ff984f #ffffff
  COSTUME t1024 tile "1024" #ffd95a #271b45
  COSTUME t2048 tile "2048" #fff6b0 #32184f
  SOUND fuse 720
  SOUND chain 1040

  DEFINE FAST reset reactor:
    delete all of grid
    REPEAT 16:
      add 0 to grid
    set score to 0
    set chain to 0
    set won to 0
    set possible to 1
    spawn tile
    spawn tile

  DEFINE addcell (a):
    set v to item a of grid
    IF not v = 0 THEN:
      add v to linebuf

  DEFINE writeback (a) (slot):
    set old to item a of grid
    IF slot > length of linebuf THEN:
      replace item a of grid with 0
    ELSE:
      replace item a of grid with item slot of linebuf
    IF not old = item a of grid THEN:
      set moved to 1

  DEFINE slide (a) (b) (c) (d):
    delete all of linebuf
    addcell a
    addcell b
    addcell c
    addcell d
    set p to 1
    REPEAT UNTIL p > (length of linebuf) - 1:
      IF item p of linebuf = item (p + 1) of linebuf THEN:
        replace item p of linebuf with (item p of linebuf) * 2
        change chain by 1
        change score by (item p of linebuf) * chain
        delete (p + 1) of linebuf
        IF chain > 1 THEN:
          play sound "chain"
        ELSE:
          play sound "fuse"
      change p by 1
    writeback a 1
    writeback b 2
    writeback c 3
    writeback d 4

  DEFINE spawn tile:
    set empties to 0
    set i to 1
    REPEAT 16:
      IF item i of grid = 0 THEN:
        change empties by 1
      change i by 1
    IF empties > 0 THEN:
      set nv to 2
      IF pick random 1 to 10 = 1 THEN:
        set nv to 4
      set possible to 0
      REPEAT UNTIL possible = 1:
        set idx to pick random 1 to 16
        IF item idx of grid = 0 THEN:
          replace item idx of grid with nv
          set possible to 1

  DEFINE FAST render reactor:
    clear
    set i to 0
    REPEAT 16:
      set v to item (i + 1) of grid
      set r to floor of (i / 4)
      set c to i mod 4
      IF v = 0 THEN:
        switch costume to blank
      ELSE:
        switch costume to ("t" join v)
      go to x: (-120) + (c * 80) y: (120) - (r * 80)
      stamp
      change i by 1

  DEFINE evaluate reactor:
    set empties to 0
    set possible to 0
    set won to 0
    set i to 1
    REPEAT 16:
      set v to item i of grid
      IF v = 2048 THEN:
        set won to 1
      IF v = 0 THEN:
        change empties by 1
      set c to (i - 1) mod 4
      set r to floor of ((i - 1) / 4)
      IF c < 3 and v = item (i + 1) of grid THEN:
        set possible to 1
      IF r < 3 and v = item (i + 4) of grid THEN:
        set possible to 1
      change i by 1
    IF won = 1 THEN:
      set started to 0
      broadcast "nova forged"
    ELSE:
      IF empties = 0 and possible = 0 THEN:
        set started to 0
        broadcast "reactor locked"

  DEFINE finish move:
    IF moved = 1 THEN:
      spawn tile
    render reactor
    evaluate reactor

  DEFINE move left:
    set moved to 0
    set chain to 0
    slide 1 2 3 4
    slide 5 6 7 8
    slide 9 10 11 12
    slide 13 14 15 16
    finish move

  DEFINE move right:
    set moved to 0
    set chain to 0
    slide 4 3 2 1
    slide 8 7 6 5
    slide 12 11 10 9
    slide 16 15 14 13
    finish move

  DEFINE move up:
    set moved to 0
    set chain to 0
    slide 1 5 9 13
    slide 2 6 10 14
    slide 3 7 11 15
    slide 4 8 12 16
    finish move

  DEFINE move down:
    set moved to 0
    set chain to 0
    slide 13 9 5 1
    slide 14 10 6 2
    slide 15 11 7 3
    slide 16 12 8 4
    finish move

  WHEN flag clicked:
    hide
    clear
  WHEN I receive "ignite nova grid":
    reset reactor
    show variable score
    show variable chain
    render reactor
  WHEN left arrow key pressed:
    IF started = 1 THEN:
      move left
  WHEN right arrow key pressed:
    IF started = 1 THEN:
      move right
  WHEN up arrow key pressed:
    IF started = 1 THEN:
      move up
  WHEN down arrow key pressed:
    IF started = 1 THEN:
      move down
  WHEN I receive "move nova left":
    IF started = 1 THEN:
      move left
  WHEN I receive "move nova right":
    IF started = 1 THEN:
      move right
  WHEN I receive "move nova up":
    IF started = 1 THEN:
      move up
  WHEN I receive "move nova down":
    IF started = 1 THEN:
      move down

SPRITE ReactorCore:
  SHAPE art nova-grid/core
  SOUND nova 1280
  SOUND lock 180
  WHEN flag clicked:
    go to x: 205 y: 138
    hide
  WHEN I receive "ignite nova grid":
    go to x: 205 y: 138
    show
  WHEN I receive "nova forged":
    play sound "nova"
    say ("NOVA FORGED — SCORE " join score) for 4 seconds
    say "TAP OR SPACE RESTARTS THE REACTOR" for 2 seconds
  WHEN I receive "reactor locked":
    play sound "lock"
    say ("GRID LOCKED — SCORE " join score) for 4 seconds
    say "TAP OR SPACE RESTARTS THE REACTOR" for 2 seconds

SPRITE TouchGrid:
  SHAPE circle 8 #70e3ef
  WHEN flag clicked:
    hide
    set touchLock to 0
    FOREVER:
      IF started = 0 and mouse down? THEN:
        broadcast "touch start nova"
        wait until not mouse down?
      IF started = 1 and mouse down? and touchLock = 0 THEN:
        set touchX to mouse x
        set touchY to mouse y
        set touchLock to 1
      IF touchLock = 1 and not mouse down? THEN:
        IF abs of (mouse x - touchX) > 24 or abs of (mouse y - touchY) > 24 THEN:
          IF abs of (mouse x - touchX) > abs of (mouse y - touchY) THEN:
            IF mouse x > touchX THEN:
              broadcast "move nova right"
            ELSE:
              broadcast "move nova left"
          ELSE:
            IF mouse y > touchY THEN:
              broadcast "move nova up"
            ELSE:
              broadcast "move nova down"
        set touchLock to 0
      wait 0.02 seconds
`,

    sigil_grid: `# Sigil Grid — a neon strategy duel with solo and two-player modes.
# GOAL: claim three aligned sigils before your rival. After every round, tap SOLO
# or DUO on the stage to play again without reloading the project.
# CONTROLS: tap an empty cell. SOLO faces a rival that wins, blocks, then takes centre.
GLOBAL started
GLOBAL active
GLOBAL mode
GLOBAL turn
GLOBAL winner
GLOBAL moves
GLOBAL row
GLOBAL col
GLOBAL i
GLOBAL v
GLOBAL va
GLOBAL vb
GLOBAL vc
GLOBAL cand
GLOBAL k
GLOBAL result

STAGE:
  BACKDROP intro art sigil-grid/intro
  BACKDROP arena art sigil-grid/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    set mode to 1
    switch backdrop to intro
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set mode to 1
      switch backdrop to arena
      broadcast "begin sigil duel"

SPRITE Board:
  LIST board
  SHAPE art sigil-grid/blank
  COSTUME blank art sigil-grid/blank
  COSTUME sun art sigil-grid/sun
  COSTUME moon art sigil-grid/moon
  SOUND mark 620
  SOUND victory 980

  DEFINE FAST reset board:
    delete all of board
    REPEAT 9:
      add 0 to board
    set turn to 1
    set winner to 0
    set moves to 0
    set result to 0

  DEFINE check line (a) (b) (c):
    set va to item a of board
    set vb to item b of board
    set vc to item c of board
    IF va > 0 and va = vb and vb = vc THEN:
      set winner to va

  DEFINE check winner:
    set winner to 0
    check line 1 2 3
    check line 4 5 6
    check line 7 8 9
    check line 1 4 7
    check line 2 5 8
    check line 3 6 9
    check line 1 5 9
    check line 3 5 7

  DEFINE FAST paint board:
    clear
    set i to 0
    REPEAT 9:
      set v to item (i + 1) of board
      IF v = 0 THEN:
        switch costume to blank
      IF v = 1 THEN:
        switch costume to sun
      IF v = 2 THEN:
        switch costume to moon
      go to x: (-86 + ((i mod 3) * 86)) y: (91 - ((floor of (i / 3)) * 86))
      stamp
      change i by 1

  DEFINE finish round (outcome):
    set result to outcome
    set active to 0
    set started to 0
    play sound "victory"
    broadcast "sigil duel finished"

  DEFINE find tactic for (mark):
    set cand to 0
    set k to 1
    REPEAT 9:
      IF cand = 0 and item k of board = 0 THEN:
        replace item k of board with mark
        check winner
        IF winner = mark THEN:
          set cand to k
        replace item k of board with 0
        set winner to 0
      change k by 1

  DEFINE rival move:
    find tactic for 2
    IF cand = 0 THEN:
      find tactic for 1
    IF cand = 0 and item 5 of board = 0 THEN:
      set cand to 5
    IF cand = 0 THEN:
      set cand to pick random 1 to 9
      REPEAT UNTIL item cand of board = 0:
        set cand to pick random 1 to 9
    replace item cand of board with 2
    change moves by 1
    play sound "mark"
    check winner
    paint board
    IF winner = 2 THEN:
      finish round 2
    ELSE:
      IF moves = 9 THEN:
        finish round 3
      ELSE:
        set turn to 1
        say "YOUR SUN SIGIL" for 0.7 seconds

  DEFINE place at (r) (c):
    set i to (r * 3) + c + 1
    IF active = 1 and item i of board = 0 THEN:
      replace item i of board with turn
      change moves by 1
      play sound "mark"
      check winner
      paint board
      IF winner > 0 THEN:
        finish round winner
      ELSE:
        IF moves = 9 THEN:
          finish round 3
        ELSE:
          IF mode = 1 THEN:
            set turn to 2
            say "RIVAL READING THE GRID…" for 0.35 seconds
            rival move
          ELSE:
            IF turn = 1 THEN:
              set turn to 2
              say "MOON PLAYER" for 0.7 seconds
            ELSE:
              set turn to 1
              say "SUN PLAYER" for 0.7 seconds

  WHEN flag clicked:
    hide
    clear
    FOREVER:
      IF active = 1 and mouse down? THEN:
        set col to floor of ((mouse x + 129) / 86)
        set row to floor of ((134 - mouse y) / 86)
        IF col > -1 and col < 3 and row > -1 and row < 3 THEN:
          place at row col
        wait until not mouse down?
      wait 0.02 seconds
  WHEN I receive "begin sigil duel":
    reset board
    paint board
    set active to 1
    say "YOUR SUN SIGIL" for 0.8 seconds

SPRITE Solo:
  COSTUME solo art sigil-grid/solo
  WHEN flag clicked:
    go to x: -72 y: -145
    show
  WHEN sprite clicked:
    IF active = 0 THEN:
      set mode to 1
      set started to 1
      switch backdrop to arena
      broadcast "begin sigil duel"
  WHEN I receive "begin sigil duel":
    hide
  WHEN I receive "sigil duel finished":
    wait 1.4 seconds
    show

SPRITE Duo:
  COSTUME duo art sigil-grid/duo
  WHEN flag clicked:
    go to x: 72 y: -145
    show
  WHEN sprite clicked:
    IF active = 0 THEN:
      set mode to 2
      set started to 1
      switch backdrop to arena
      broadcast "begin sigil duel"
  WHEN I receive "begin sigil duel":
    hide
  WHEN I receive "sigil duel finished":
    wait 1.4 seconds
    show

SPRITE Result:
  COSTUME sunwin label "SUN CLAIMS THE GRID • CHOOSE A REMATCH" #ffe36c
  COSTUME moonwin label "MOON CLAIMS THE GRID • CHOOSE A REMATCH" #8fe8ff
  COSTUME draw label "GRID LOCKED • CHOOSE A REMATCH" #ffffff
  WHEN flag clicked:
    hide
    go to x: 0 y: 151
  WHEN I receive "begin sigil duel":
    hide
  WHEN I receive "sigil duel finished":
    IF result = 1 THEN:
      switch costume to sunwin
    IF result = 2 THEN:
      switch costume to moonwin
    IF result = 3 THEN:
      switch costume to draw
    show
`,

    vector_seven: `# Vector Seven — a finite neon paddle match with an adaptive rival.
# GOAL: score 7 points before the rival. Every fourth return becomes a charged
# return: it leaves a bright trail, accelerates the ball, and is worth 2 points.
# CONTROLS: drag or tap across the stage to move and serve; Left/Right also move;
# Space serves on desktop. Strike with different parts of the paddle to aim.
GLOBAL started
GLOBAL playing
GLOBAL serve
GLOBAL playerScore
GLOBAL rivalScore
GLOBAL playerX
GLOBAL rivalX
GLOBAL ballX
GLOBAL ballY
GLOBAL ballVX
GLOBAL ballVY
GLOBAL rally
GLOBAL charged
GLOBAL hitOffset
GLOBAL winner

STAGE:
  BACKDROP intro art vector-seven/intro
  BACKDROP court art vector-seven/play
  WHEN flag clicked:
    set started to 0
    set playing to 0
    set serve to 0
    switch backdrop to intro
    hide variable playerScore
    hide variable rivalScore
    hide variable rally
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to court
      broadcast "begin vector match"
    ELSE:
      IF serve = 1 THEN:
        broadcast "launch vector"

SPRITE Player:
  SHAPE art vector-seven/player
  WHEN flag clicked:
    set playerX to 0
    go to x: playerX y: -143
    hide
    FOREVER:
      IF playing = 1 THEN:
        IF key left arrow pressed? THEN:
          change playerX by -9
        IF key right arrow pressed? THEN:
          change playerX by 9
        IF mouse down? THEN:
          set playerX to mouse x
          IF serve = 1 THEN:
            broadcast "launch vector"
        IF playerX < -184 THEN:
          set playerX to -184
        IF playerX > 184 THEN:
          set playerX to 184
        go to x: playerX y: -143
      wait 0.02 seconds
  WHEN I receive "begin vector match":
    set playerScore to 0
    set rivalScore to 0
    set playerX to 0
    set winner to 0
    set playing to 1
    show variable playerScore
    show variable rivalScore
    show variable rally
    show
    broadcast "prepare vector serve"
  WHEN I receive "vector match over":
    hide

SPRITE Rival:
  SHAPE art vector-seven/rival
  WHEN flag clicked:
    set rivalX to 0
    go to x: rivalX y: 143
    hide
    FOREVER:
      IF playing = 1 THEN:
        IF ballY > -20 and serve = 0 THEN:
          IF ballX > rivalX + 10 THEN:
            change rivalX by 3 + (playerScore / 2)
          IF ballX < rivalX - 10 THEN:
            change rivalX by -3 - (playerScore / 2)
        ELSE:
          IF rivalX > 4 THEN:
            change rivalX by -2
          IF rivalX < -4 THEN:
            change rivalX by 2
        IF rivalX < -184 THEN:
          set rivalX to -184
        IF rivalX > 184 THEN:
          set rivalX to 184
        go to x: rivalX y: 143
      wait 0.02 seconds
  WHEN I receive "begin vector match":
    show
  WHEN I receive "vector match over":
    hide

SPRITE Pulse:
  SHAPE art vector-seven/pulse
  COSTUME charged art vector-seven/charged
  SOUND strike 720
  SOUND charge 1080
  SOUND point 480

  DEFINE FAST draw pulse:
    go to x: ballX y: ballY

  DEFINE prepare next serve:
    set serve to 1
    set rally to 0
    set charged to 0
    switch costume to costume1
    set ballX to playerX
    set ballY to -121
    set ballVX to 0
    set ballVY to 0
    draw pulse
    say "TAP TO SERVE" for 0.6 seconds

  DEFINE award point to (side):
    IF side = 1 THEN:
      IF charged = 1 THEN:
        change playerScore by 2
      ELSE:
        change playerScore by 1
      IF playerScore > 7 THEN:
        set playerScore to 7
    ELSE:
      change rivalScore by 1
    play sound "point"
    IF playerScore = 7 THEN:
      set winner to 1
      set playing to 0
      set started to 0
      broadcast "vector match over"
    ELSE:
      IF rivalScore = 7 THEN:
        set winner to 2
        set playing to 0
        set started to 0
        broadcast "vector match over"
      ELSE:
        prepare next serve

  WHEN flag clicked:
    hide
    FOREVER:
      IF playing = 1 THEN:
        IF serve = 1 THEN:
          set ballX to playerX
          set ballY to -121
          draw pulse
        ELSE:
          change ballX by ballVX
          change ballY by ballVY
          IF ballX > 228 THEN:
            set ballX to 228
            set ballVX to 0 - (abs of ballVX)
          IF ballX < -228 THEN:
            set ballX to -228
            set ballVX to abs of ballVX
          IF ballVY < 0 and ballY < -125 and ballY > -157 and abs of (ballX - playerX) < 57 THEN:
            set ballY to -124
            set hitOffset to (ballX - playerX) / 11
            set ballVX to hitOffset
            set ballVY to (abs of ballVY) + 0.18
            change rally by 1
            play sound "strike"
            IF (rally mod 4) = 0 THEN:
              set charged to 1
              switch costume to charged
              set ballVY to ballVY * 1.25
              play sound "charge"
            ELSE:
              set charged to 0
              switch costume to costume1
          IF ballVY > 0 and ballY > 125 and ballY < 157 and abs of (ballX - rivalX) < 52 THEN:
            set ballY to 124
            set ballVX to ((ballX - rivalX) / 13) + (pick random -1 to 1)
            set ballVY to 0 - ((abs of ballVY) + 0.12)
            play sound "strike"
          IF ballY > 178 THEN:
            award point to 1
          IF ballY < -178 THEN:
            award point to 2
          draw pulse
      wait 0.02 seconds
  WHEN I receive "begin vector match":
    show
  WHEN I receive "prepare vector serve":
    prepare next serve
  WHEN I receive "launch vector":
    IF playing = 1 and serve = 1 THEN:
      set serve to 0
      set ballVX to pick random -4 to 4
      IF abs of ballVX < 2 THEN:
        set ballVX to 2
      set ballVY to 5.5
  WHEN I receive "vector match over":
    hide

SPRITE Result:
  COSTUME win label "YOU REACHED SEVEN • TAP GREEN FLAG FOR A REMATCH" #8fffea
  COSTUME lose label "RIVAL REACHED SEVEN • TAP GREEN FLAG FOR A REMATCH" #ff8ea6
  WHEN flag clicked:
    hide
    go to x: 0 y: 0
  WHEN I receive "begin vector match":
    hide
  WHEN I receive "vector match over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show
`,

    reactor_ricochet: `# Reactor Ricochet — a finite brick field with real power-cell drops.
# GOAL: break all 20 reactor cells before three pulses escape below the paddle.
# Armoured hex cells take two hits. Cyan capacitors drop a wide-paddle and split-pulse power-up.
# CONTROLS: drag the paddle or use Left/Right. Tap the stage (or use the desktop serve key) to launch.
GLOBAL started
GLOBAL active
GLOBAL serve
GLOBAL lives
GLOBAL cells
GLOBAL score
GLOBAL paddleX
GLOBAL paddleWidth
GLOBAL wideTime
GLOBAL ballX
GLOBAL ballY
GLOBAL ballVX
GLOBAL ballVY
GLOBAL hitOffset
GLOBAL gridX
GLOBAL gridY
GLOBAL gridRow
GLOBAL gridCol
GLOBAL dropX
GLOBAL dropY
GLOBAL winner

STAGE:
  BACKDROP intro art reactor-ricochet/intro
  BACKDROP chamber art reactor-ricochet/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    switch backdrop to intro
    hide variable lives
    hide variable cells
    hide variable score
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to chamber
      broadcast "ignite ricochet"
    ELSE:
      IF serve = 1 THEN:
        broadcast "launch reactor pulse"

SPRITE Paddle:
  SHAPE art reactor-ricochet/paddle
  COSTUME wide art reactor-ricochet/paddle-wide
  WHEN flag clicked:
    set paddleX to 0
    set paddleWidth to 55
    set wideTime to 0
    go to x: paddleX y: -151
    hide
    FOREVER:
      IF active = 1 THEN:
        IF key left arrow pressed? THEN:
          change paddleX by -10
        IF key right arrow pressed? THEN:
          change paddleX by 10
        IF mouse down? THEN:
          set paddleX to mouse x
          IF serve = 1 THEN:
            broadcast "launch reactor pulse"
        IF paddleX < -180 THEN:
          set paddleX to -180
        IF paddleX > 180 THEN:
          set paddleX to 180
        IF wideTime > 0 THEN:
          change wideTime by -0.02
          set paddleWidth to 82
          switch costume to wide
        ELSE:
          set paddleWidth to 55
          switch costume to costume1
        go to x: paddleX y: -151
      wait 0.02 seconds
  WHEN I receive "ignite ricochet":
    show
  WHEN I receive "ricochet over":
    hide

SPRITE Pulse:
  LOCAL splitX
  LOCAL splitY
  LOCAL splitVX
  LOCAL splitVY
  SHAPE art reactor-ricochet/pulse
  COSTUME split art reactor-ricochet/pulse-split
  SOUND rebound 760
  SOUND lost 130

  DEFINE prepare reactor serve:
    set serve to 1
    set ballX to paddleX
    set ballY to -129
    set ballVX to 0
    set ballVY to 0
    go to x: ballX y: ballY
    say "TAP TO LAUNCH" for 0.55 seconds

  DEFINE lose pulse:
    change lives by -1
    play sound "lost"
    IF lives = 0 THEN:
      set winner to 0
      set active to 0
      set started to 0
      broadcast "ricochet over"
    ELSE:
      prepare reactor serve

  WHEN flag clicked:
    hide
    FOREVER:
      IF active = 1 THEN:
        IF serve = 1 THEN:
          set ballX to paddleX
          set ballY to -129
        ELSE:
          change ballX by ballVX
          change ballY by ballVY
          IF ballX > 229 THEN:
            set ballX to 229
            set ballVX to 0 - (abs of ballVX)
          IF ballX < -229 THEN:
            set ballX to -229
            set ballVX to abs of ballVX
          IF ballY > 170 THEN:
            set ballY to 170
            set ballVY to 0 - (abs of ballVY)
          IF ballVY < 0 and ballY < -134 and ballY > -167 and abs of (ballX - paddleX) < paddleWidth THEN:
            set ballY to -133
            set hitOffset to (ballX - paddleX) / 10
            set ballVX to hitOffset
            set ballVY to (abs of ballVY) + 0.15
            play sound "rebound"
          IF touching Cell THEN:
            set ballVY to ballVY * -1
            wait 0.05 seconds
          IF ballY < -181 THEN:
            lose pulse
        go to x: ballX y: ballY
      wait 0.015 seconds
  WHEN I receive "ignite ricochet":
    set lives to 3
    set cells to 20
    set score to 0
    set winner to 0
    set active to 1
    show variable lives
    show variable cells
    show variable score
    show
    prepare reactor serve
  WHEN I receive "launch reactor pulse":
    IF active = 1 and serve = 1 THEN:
      set serve to 0
      set ballVX to pick random -4 to 4
      IF abs of ballVX < 2 THEN:
        set ballVX to 2
      set ballVY to 5.5
  WHEN I receive "split reactor pulse":
    set splitX to ballX
    set splitY to ballY
    set splitVX to 0 - ballVX
    set splitVY to ballVY
    create clone of myself
  WHEN I start as a clone:
    switch costume to split
    go to x: splitX y: splitY
    show
    REPEAT UNTIL splitY < -182 or active = 0:
      change splitX by splitVX
      change splitY by splitVY
      IF splitX > 229 THEN:
        set splitX to 229
        set splitVX to 0 - (abs of splitVX)
      IF splitX < -229 THEN:
        set splitX to -229
        set splitVX to abs of splitVX
      IF splitY > 170 THEN:
        set splitY to 170
        set splitVY to 0 - (abs of splitVY)
      IF splitVY < 0 and splitY < -134 and splitY > -167 and abs of (splitX - paddleX) < paddleWidth THEN:
        set splitY to -133
        set splitVX to (splitX - paddleX) / 10
        set splitVY to abs of splitVY
      IF touching Cell THEN:
        set splitVY to splitVY * -1
        wait 0.05 seconds
      go to x: splitX y: splitY
      wait 0.015 seconds
    delete this clone
  WHEN I receive "ricochet over":
    hide

SPRITE Cell:
  LOCAL armour
  LOCAL kind
  SHAPE art reactor-ricochet/cell
  COSTUME armour art reactor-ricochet/cell-armour
  COSTUME capacitor art reactor-ricochet/capacitor
  SOUND crack 1040
  WHEN flag clicked:
    hide
  WHEN I receive "ignite ricochet":
    set gridRow to 0
    REPEAT 4:
      set gridCol to 0
      REPEAT 5:
        set gridX to -176 + (gridCol * 88)
        set gridY to 122 - (gridRow * 43)
        set kind to ((gridRow * 5) + gridCol) mod 7
        go to x: gridX y: gridY
        create clone of myself
        change gridCol by 1
      change gridRow by 1
  WHEN I start as a clone:
    set armour to 1
    IF kind = 0 THEN:
      set armour to 2
      switch costume to armour
    ELSE:
      IF kind = 6 THEN:
        switch costume to capacitor
      ELSE:
        switch costume to costume1
    show
    REPEAT UNTIL active = 0:
      IF touching Pulse THEN:
        IF armour = 2 THEN:
          set armour to 1
          switch costume to costume1
          play sound "crack"
          wait until not touching Pulse
        ELSE:
          change cells by -1
          change score by 10
          play sound "crack"
          IF kind = 6 THEN:
            set dropX to x position
            set dropY to y position
            broadcast "drop capacitor"
          IF cells = 0 THEN:
            set winner to 1
            set active to 0
            set started to 0
            broadcast "ricochet over"
          delete this clone
      wait 0.015 seconds
    delete this clone

SPRITE Capacitor:
  LOCAL fallX
  LOCAL fallY
  SHAPE art reactor-ricochet/power
  SOUND power 1180
  WHEN flag clicked:
    hide
  WHEN I receive "drop capacitor":
    set fallX to dropX
    set fallY to dropY
    create clone of myself
  WHEN I start as a clone:
    go to x: fallX y: fallY
    show
    REPEAT UNTIL touching Paddle or fallY < -180 or active = 0:
      change fallY by -4
      turn right 12 degrees
      go to x: fallX y: fallY
      wait 0.025 seconds
    IF touching Paddle THEN:
      set wideTime to 8
      play sound "power"
      broadcast "split reactor pulse"
    delete this clone

SPRITE Result:
  COSTUME win label "REACTOR CLEARED • GREEN FLAG REBUILDS THE FIELD" #8fffea
  COSTUME lose label "THREE PULSES LOST • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    hide
    go to x: 0 y: -20
  WHEN I receive "ignite ricochet":
    hide
  WHEN I receive "ricochet over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show
`,

    flux_vault: `# Flux Vault — a three-chamber push puzzle with exact grid rules.
# GOAL: push all three cyan cores onto gold docks in each chamber; clear all 3 chambers.
# A core can be pushed but never pulled. If one is trapped, press Space or RESET to retry.
# CONTROLS: Arrow keys move one tile. Space resets the current chamber.
GLOBAL started
GLOBAL active
GLOBAL level
GLOBAL pushes
GLOBAL playerCell
GLOBAL targetCell
GLOBAL beyondCell
GLOBAL delta
GLOBAL crateAt
GLOBAL occupied
GLOBAL docked
GLOBAL i
GLOBAL j
GLOBAL row
GLOBAL col
GLOBAL tile

STAGE:
  BACKDROP intro art flux-vault/intro
  BACKDROP vault art flux-vault/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    switch backdrop to intro
    hide variable level
    hide variable pushes
    hide variable docked
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set level to 1
      set pushes to 0
      switch backdrop to vault
      broadcast "open flux chamber"
    ELSE:
      IF active = 1 THEN:
        broadcast "reset flux chamber"

SPRITE Vault:
  LIST terrain
  LIST crates
  SHAPE art flux-vault/floor
  COSTUME wall art flux-vault/wall
  COSTUME dock art flux-vault/dock
  COSTUME core art flux-vault/core
  COSTUME charged art flux-vault/core-docked
  COSTUME keeper art flux-vault/keeper
  SOUND push 520
  SOUND lock 920

  DEFINE FAST set terrain tile (cell) (kind):
    replace item cell of terrain with kind

  DEFINE FAST build chamber:
    delete all of terrain
    delete all of crates
    REPEAT 48:
      add 0 to terrain
    set i to 1
    REPEAT 48:
      set row to floor of ((i - 1) / 8)
      set col to (i - 1) mod 8
      IF row = 0 or row = 5 or col = 0 or col = 7 THEN:
        set terrain tile i 1
      change i by 1
    IF level = 1 THEN:
      set playerCell to 34
      add 12 to crates
      add 20 to crates
      add 28 to crates
      set terrain tile 14 2
      set terrain tile 22 2
      set terrain tile 30 2
    IF level = 2 THEN:
      set playerCell to 34
      add 19 to crates
      add 21 to crates
      add 23 to crates
      set terrain tile 11 2
      set terrain tile 13 2
      set terrain tile 15 2
      set terrain tile 26 1
      set terrain tile 30 1
    IF level = 3 THEN:
      set playerCell to 10
      add 19 to crates
      add 29 to crates
      add 28 to crates
      set terrain tile 22 2
      set terrain tile 26 2
      set terrain tile 36 2
      set terrain tile 12 1
      set terrain tile 31 1
    set docked to 0

  DEFINE FAST place tile at (cell):
    set row to floor of ((cell - 1) / 8)
    set col to (cell - 1) mod 8
    go to x: (-196 + (col * 56)) y: (140 - (row * 56))

  DEFINE FAST paint chamber:
    clear
    set i to 1
    REPEAT 48:
      set tile to item i of terrain
      IF tile = 0 THEN:
        switch costume to costume1
      IF tile = 1 THEN:
        switch costume to wall
      IF tile = 2 THEN:
        switch costume to dock
      place tile at i
      stamp
      change i by 1
    set i to 1
    REPEAT length of crates:
      set tile to item i of crates
      IF item tile of terrain = 2 THEN:
        switch costume to charged
      ELSE:
        switch costume to core
      place tile at tile
      stamp
      change i by 1
    switch costume to keeper
    place tile at playerCell
    stamp

  DEFINE FAST count docked cores:
    set docked to 0
    set i to 1
    REPEAT length of crates:
      set tile to item i of crates
      IF item tile of terrain = 2 THEN:
        change docked by 1
      change i by 1

  DEFINE FAST try move (step):
    set targetCell to playerCell + step
    IF item targetCell of terrain = 0 or item targetCell of terrain = 2 THEN:
      set crateAt to 0
      set i to 1
      REPEAT length of crates:
        IF item i of crates = targetCell THEN:
          set crateAt to i
        change i by 1
      IF crateAt = 0 THEN:
        set playerCell to targetCell
      ELSE:
        set beyondCell to targetCell + step
        set occupied to 0
        set j to 1
        REPEAT length of crates:
          IF item j of crates = beyondCell THEN:
            set occupied to 1
          change j by 1
        IF (item beyondCell of terrain = 0 or item beyondCell of terrain = 2) and occupied = 0 THEN:
          replace item crateAt of crates with beyondCell
          set playerCell to targetCell
          change pushes by 1
          play sound "push"
      count docked cores
      paint chamber
      IF docked = 3 THEN:
        set active to 0
        play sound "lock"
        wait 0.7 seconds
        change level by 1
        IF level = 4 THEN:
          set started to 0
          broadcast "flux vault solved"
        ELSE:
          broadcast "open flux chamber"

  WHEN flag clicked:
    hide
    clear
  WHEN I receive "open flux chamber":
    build chamber
    paint chamber
    set active to 1
    show variable level
    show variable pushes
    show variable docked
  WHEN I receive "reset flux chamber":
    build chamber
    paint chamber
  WHEN up arrow key pressed:
    IF active = 1 THEN:
      try move -8
  WHEN down arrow key pressed:
    IF active = 1 THEN:
      try move 8
  WHEN left arrow key pressed:
    IF active = 1 THEN:
      try move -1
  WHEN right arrow key pressed:
    IF active = 1 THEN:
      try move 1
  WHEN I receive "flux vault solved":
    clear

SPRITE Reset:
  COSTUME reset art flux-vault/reset
  WHEN flag clicked:
    go to x: 171 y: -157
    hide
  WHEN I receive "open flux chamber":
    show
  WHEN sprite clicked:
    IF active = 1 THEN:
      broadcast "reset flux chamber"
  WHEN I receive "flux vault solved":
    hide

SPRITE Result:
  COSTUME solved label "ALL 3 CHAMBERS LOCKED • GREEN FLAG TO REPLAY" #8fffea
  WHEN flag clicked:
    hide
    go to x: 0 y: 0
  WHEN I receive "open flux chamber":
    hide
  WHEN I receive "flux vault solved":
    show
`,

    neon_circuit: `# Neon Circuit — three finite light-flipping logic boards.
# GOAL: extinguish all 25 nodes on each of 3 boards. A tap flips that node and
# its orthogonal neighbours, so every move changes the surrounding circuit.
# CONTROLS: tap a node. Tap RESET if you want the current board back.
# Desktop players can also press Space to reset.
GLOBAL started
GLOBAL active
GLOBAL level
GLOBAL presses
GLOBAL lit
GLOBAL cell
GLOBAL row
GLOBAL col
GLOBAL i

STAGE:
  BACKDROP intro art neon-circuit/intro
  BACKDROP board art neon-circuit/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    switch backdrop to intro
    hide variable level
    hide variable presses
    hide variable lit
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set level to 1
      set presses to 0
      switch backdrop to board
      broadcast "load neon circuit"
    ELSE:
      IF active = 1 THEN:
        broadcast "reset neon circuit"

SPRITE Grid:
  LIST nodes
  SHAPE art neon-circuit/off
  COSTUME on art neon-circuit/on
  SOUND flip 640
  SOUND clear 1060

  DEFINE FAST flip one (index):
    replace item index of nodes with 1 - (item index of nodes)

  DEFINE FAST flip cross (index):
    set row to floor of ((index - 1) / 5)
    set col to (index - 1) mod 5
    flip one index
    IF row > 0 THEN:
      flip one (index - 5)
    IF row < 4 THEN:
      flip one (index + 5)
    IF col > 0 THEN:
      flip one (index - 1)
    IF col < 4 THEN:
      flip one (index + 1)

  DEFINE FAST build circuit:
    delete all of nodes
    REPEAT 25:
      add 0 to nodes
    IF level = 1 THEN:
      flip cross 7
      flip cross 9
      flip cross 13
      flip cross 17
      flip cross 19
    IF level = 2 THEN:
      flip cross 1
      flip cross 5
      flip cross 7
      flip cross 9
      flip cross 13
      flip cross 17
      flip cross 19
      flip cross 21
      flip cross 25
    IF level = 3 THEN:
      flip cross 2
      flip cross 4
      flip cross 6
      flip cross 8
      flip cross 12
      flip cross 14
      flip cross 18
      flip cross 20
      flip cross 22
      flip cross 24

  DEFINE FAST paint circuit:
    clear
    set lit to 0
    set i to 1
    REPEAT 25:
      set row to floor of ((i - 1) / 5)
      set col to (i - 1) mod 5
      IF item i of nodes = 1 THEN:
        switch costume to on
        change lit by 1
      ELSE:
        switch costume to costume1
      go to x: (-124 + (col * 62)) y: (124 - (row * 62))
      stamp
      change i by 1

  DEFINE press node (index):
    IF active = 1 THEN:
      flip cross index
      change presses by 1
      play sound "flip"
      paint circuit
      IF lit = 0 THEN:
        set active to 0
        play sound "clear"
        wait 0.6 seconds
        change level by 1
        IF level = 4 THEN:
          set started to 0
          broadcast "neon circuit solved"
        ELSE:
          broadcast "load neon circuit"

  WHEN flag clicked:
    hide
    clear
    FOREVER:
      IF active = 1 and mouse down? THEN:
        set col to floor of ((mouse x + 155) / 62)
        set row to floor of ((155 - mouse y) / 62)
        IF col > -1 and col < 5 and row > -1 and row < 5 THEN:
          set cell to (row * 5) + col + 1
          press node cell
        wait until not mouse down?
      wait 0.02 seconds
  WHEN I receive "load neon circuit":
    build circuit
    paint circuit
    set active to 1
    show variable level
    show variable presses
    show variable lit
  WHEN I receive "reset neon circuit":
    build circuit
    paint circuit
  WHEN I receive "neon circuit solved":
    clear

SPRITE Reset:
  COSTUME reset art neon-circuit/reset
  WHEN flag clicked:
    go to x: 180 y: -160
    hide
  WHEN I receive "load neon circuit":
    show
  WHEN sprite clicked:
    IF active = 1 THEN:
      broadcast "reset neon circuit"
  WHEN I receive "neon circuit solved":
    hide

SPRITE Result:
  COSTUME solved label "ALL 3 CIRCUITS DARK • GREEN FLAG TO REPLAY" #8fffea
  WHEN flag clicked:
    hide
    go to x: 0 y: 0
  WHEN I receive "load neon circuit":
    hide
  WHEN I receive "neon circuit solved":
    show
`,

    canal_command: `# Canal Command — operate a real three-control lock sequence.
# GOAL: lift 4 boats from the low canal to the high canal before 3 unsafe commands.
# CONTROLS: tap LOWER GATE, PUMP, and UPPER GATE. Gates only open at matching water level.
GLOBAL started
GLOBAL active
GLOBAL water
GLOBAL lowerGate
GLOBAL upperGate
GLOBAL boatZone
GLOBAL boats
GLOBAL faults
GLOBAL status

STAGE:
  BACKDROP intro art canal-command/intro
  BACKDROP lock art canal-command/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    switch backdrop to intro
    hide variable boats
    hide variable faults
    hide variable status
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to lock
      broadcast "start canal command"

SPRITE Controller:
  SHAPE art canal-command/marker
  SOUND ok 820
  SOUND alarm 140
  DEFINE unsafe (message):
    change faults by 1
    set status to message
    play sound "alarm"
    IF faults = 3 THEN:
      set active to 0
      set started to 0
      broadcast "canal command lost"
  WHEN flag clicked:
    hide
  WHEN I receive "start canal command":
    set water to 0
    set lowerGate to 0
    set upperGate to 0
    set boatZone to 0
    set boats to 0
    set faults to 0
    set status to "OPEN LOWER GATE"
    set active to 1
    show variable boats
    show variable faults
    show variable status
  WHEN I receive "lower gate command":
    IF active = 1 THEN:
      IF water = 0 and upperGate = 0 and boatZone = 0 THEN:
        set lowerGate to 1
        set status to "BOAT ENTERING"
        play sound "ok"
        wait 0.6 seconds
        set boatZone to 1
        set lowerGate to 0
        set status to "PUMP WATER UP"
      ELSE:
        unsafe "LOWER GATE INTERLOCK"
  WHEN I receive "pump command":
    IF active = 1 THEN:
      IF lowerGate = 0 and upperGate = 0 THEN:
        IF water = 0 THEN:
          set water to 1
          IF boatZone = 1 THEN:
            set status to "OPEN UPPER GATE"
          ELSE:
            set status to "WATER HIGH — PUMP DOWN"
        ELSE:
          set water to 0
          set status to "OPEN LOWER GATE"
        play sound "ok"
      ELSE:
        unsafe "CLOSE BOTH GATES BEFORE PUMPING"
  WHEN I receive "upper gate command":
    IF active = 1 THEN:
      IF water = 1 and lowerGate = 0 and boatZone = 1 THEN:
        set upperGate to 1
        set status to "BOAT LEAVING"
        play sound "ok"
        wait 0.6 seconds
        set boatZone to 2
        change boats by 1
        wait 0.5 seconds
        set upperGate to 0
        IF boats = 4 THEN:
          set active to 0
          set started to 0
          broadcast "canal command won"
        ELSE:
          set boatZone to 0
          set status to "PUMP DOWN FOR NEXT BOAT"
      ELSE:
        unsafe "UPPER GATE INTERLOCK"

SPRITE Boat:
  SHAPE art canal-command/boat
  WHEN flag clicked:
    hide
    FOREVER:
      IF active = 1 THEN:
        IF boatZone = 0 THEN:
          go to x: -174 y: -68
        IF boatZone = 1 THEN:
          IF water = 0 THEN:
            go to x: 0 y: -68
          ELSE:
            go to x: 0 y: 42
        IF boatZone = 2 THEN:
          go to x: 174 y: 42
        show
      ELSE:
        hide
      wait 0.03 seconds

SPRITE LowerGate:
  SHAPE art canal-command/gate-closed
  COSTUME open art canal-command/gate-open
  WHEN flag clicked:
    go to x: -91 y: -12
    FOREVER:
      IF lowerGate = 1 THEN:
        switch costume to open
      ELSE:
        switch costume to costume1
      wait 0.03 seconds

SPRITE UpperGate:
  SHAPE art canal-command/gate-closed
  COSTUME open art canal-command/gate-open
  WHEN flag clicked:
    go to x: 91 y: 43
    FOREVER:
      IF upperGate = 1 THEN:
        switch costume to open
      ELSE:
        switch costume to costume1
      wait 0.03 seconds

SPRITE LowerButton:
  COSTUME lower art canal-command/lower-button
  WHEN flag clicked:
    go to x: -142 y: -153
    show
  WHEN sprite clicked:
    broadcast "lower gate command"
SPRITE PumpButton:
  COSTUME pump art canal-command/pump-button
  WHEN flag clicked:
    go to x: 0 y: -153
    show
  WHEN sprite clicked:
    broadcast "pump command"
SPRITE UpperButton:
  COSTUME upper art canal-command/upper-button
  WHEN flag clicked:
    go to x: 142 y: -153
    show
  WHEN sprite clicked:
    broadcast "upper gate command"

SPRITE Result:
  COSTUME win label "4 BOATS LIFTED • GREEN FLAG TO REPLAY" #8fffea
  COSTUME lose label "LOCK SHUT DOWN AFTER 3 UNSAFE COMMANDS" #ff91a8
  WHEN flag clicked:
    hide
    go to x: 0 y: 0
  WHEN I receive "start canal command":
    hide
  WHEN I receive "canal command won":
    switch costume to win
    show
  WHEN I receive "canal command lost":
    switch costume to lose
    show
`,

    sky_skim: `# Skyline Swoop — an authored Scratch arcade game, not a shape demo.
# GOAL: complete twelve clean hill launches before three crashes. Diving into a
# green crest converts speed into height; consecutive launches grow the score combo.
# CONTROLS: Down dives; release it as you touch a hill to launch; Up flaps.
GLOBAL score
GLOBAL lives
GLOBAL speed
GLOBAL birdy
GLOBAL vy
GLOBAL diving
GLOBAL hillx
GLOBAL hilly
GLOBAL combo
GLOBAL launches
GLOBAL alive
GLOBAL started
GLOBAL winner

STAGE:
  BACKDROP intro art skyline-swoop/intro
  BACKDROP flight art skyline-swoop/play
  WHEN flag clicked:
    set started to 0
    set winner to 0
    switch backdrop to intro
    hide variable score
    hide variable lives
    hide variable launches
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to flight
      broadcast "take off"

SPRITE Skimmer:
  SHAPE art skyline-swoop/bird
  COSTUME charged art skyline-swoop/bird-charged
  SOUND boost 760
  SOUND crash 130
  WHEN flag clicked:
    set score to 0
    set lives to 3
    set speed to 4
    set birdy to 40
    set vy to 0
    set combo to 1
    set launches to 0
    set alive to 1
    set winner to 0
    set rotation style all around
    go to x: -120 y: birdy
    hide
  WHEN I receive "take off":
    show variable score
    show variable lives
    show variable launches
    show
    REPEAT UNTIL alive = 0:
      set diving to 0
      IF key down arrow pressed? THEN:
        set diving to 1
        change vy by -0.8
      ELSE:
        change vy by -0.28
      IF key up arrow pressed? THEN:
        change vy by 0.45
      change birdy by vy
      IF birdy > 165 THEN:
        set birdy to 165
        set vy to -2
      IF birdy < -155 THEN:
        set birdy to -155
      point in direction (90 - (vy * 5))
      go to x: -120 y: birdy
      IF birdy < -105 and vy < 0 THEN:
        switch costume to charged
      ELSE:
        switch costume to costume1
      IF touching Hill THEN:
        IF diving = 1 and vy < -1 THEN:
          set vy to (abs of vy) + 5
          broadcast "clean skyline launch"
          wait 0.18 seconds
        ELSE:
          change lives by -1
          set combo to 1
          set birdy to 20
          set vy to 4
          play sound "crash"
          wait 0.7 seconds
          IF lives < 1 THEN:
            set winner to 0
            set alive to 0
            broadcast "skyline over"
      IF score > 9 THEN:
        set speed to 5
      IF score > 29 THEN:
        set speed to 6
      wait 0.02 seconds
    hide
  WHEN I receive "clean skyline launch":
    change launches by 1
    change combo by 1
    change score by combo * 5
    play sound "boost"
    IF launches > 11 THEN:
      set winner to 1
      set alive to 0
      broadcast "skyline over"

SPRITE Hill:
  SHAPE art skyline-swoop/hill
  WHEN flag clicked:
    hide
  WHEN I receive "take off":
    set hillx to -180
    REPEAT 4:
      set hilly to pick random -194 to -170
      go to x: hillx y: hilly
      create clone of myself
      change hillx by 170
  WHEN I start as a clone:
    show
    REPEAT UNTIL alive = 0:
      change x by (0 - speed)
      IF x position < -330 THEN:
        change x by 680
        set y to pick random -194 to -170
        change score by 1
      wait 0.02 seconds
    delete this clone

SPRITE SkylineResult:
  COSTUME win label "TWELVE CLEAN LAUNCHES • GREEN FLAG TO FLY AGAIN" #ffe66d
  COSTUME lose label "THREE CRASHES • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "take off":
    hide
  WHEN I receive "skyline over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    chroma_code: `# Prism Lock — a clickable four-gem deduction game.
# GOAL: discover the secret sequence within eight attempts.
# CONTROLS: click four gems. Exact means right gem and slot; Near means right gem, wrong slot.
GLOBAL turn
GLOBAL exact
GLOBAL near
GLOBAL i
GLOBAL j
GLOBAL v
GLOBAL found
GLOBAL won
GLOBAL vaultStarted
GLOBAL accepting
GLOBAL LIST secret
GLOBAL LIST guess
GLOBAL LIST usedSecret
GLOBAL LIST usedGuess

STAGE:
  BACKDROP sealed art prism-lock/intro
  BACKDROP board art prism-lock/play
  WHEN flag clicked:
    set vaultStarted to 0
    switch backdrop to sealed
    hide variable turn
    hide variable exact
    hide variable near
  WHEN space key pressed:
    IF vaultStarted = 0 THEN:
      set vaultStarted to 1
      switch backdrop to board
      broadcast "open prism lock"

SPRITE Vault:
  COSTUME gem1 art prism-lock/gem1
  COSTUME gem2 art prism-lock/gem2
  COSTUME gem3 art prism-lock/gem3
  COSTUME gem4 art prism-lock/gem4
  COSTUME gem5 art prism-lock/gem5
  COSTUME gem6 art prism-lock/gem6

  DEFINE FAST make code:
    delete all of secret
    REPEAT 4:
      set v to pick random 1 to 6
      add v to secret

  DEFINE FAST score guess:
    delete all of usedSecret
    delete all of usedGuess
    REPEAT 4:
      add 0 to usedSecret
      add 0 to usedGuess
    set exact to 0
    set near to 0
    set i to 1
    REPEAT 4:
      IF item i of guess = item i of secret THEN:
        change exact by 1
        replace item i of usedSecret with 1
        replace item i of usedGuess with 1
      change i by 1
    set i to 1
    REPEAT 4:
      IF item i of usedGuess = 0 THEN:
        set found to 0
        set j to 1
        REPEAT 4:
          IF found = 0 and item j of usedSecret = 0 and item i of guess = item j of secret THEN:
            set found to 1
            replace item j of usedSecret with 1
            change near by 1
          change j by 1
      change i by 1

  DEFINE paint row:
    set i to 1
    REPEAT 4:
      set v to item i of guess
      IF v = 1 THEN:
        switch costume to gem1
      IF v = 2 THEN:
        switch costume to gem2
      IF v = 3 THEN:
        switch costume to gem3
      IF v = 4 THEN:
        switch costume to gem4
      IF v = 5 THEN:
        switch costume to gem5
      IF v = 6 THEN:
        switch costume to gem6
      go to x: (-95 + (i * 55)) y: (143 - (turn * 28))
      stamp
      change i by 1

  WHEN flag clicked:
    hide
    clear
    set accepting to 0
  WHEN I receive "open prism lock":
    make code
    delete all of guess
    set turn to 1
    set exact to 0
    set near to 0
    set won to 0
    set accepting to 1
    show variable turn
    show variable exact
    show variable near
    say "Click any four gems below." for 1.5 seconds
  WHEN I receive "gem chosen":
    IF accepting = 1 and length of guess = 4 THEN:
      set accepting to 0
      score guess
      paint row
      IF exact = 4 THEN:
        set won to 1
        broadcast "prism lock over"
      ELSE:
        say ((("EXACT " join exact) join "   NEAR ") join near) for 1.8 seconds
        change turn by 1
        IF turn > 8 THEN:
          set won to 0
          broadcast "prism lock over"
        ELSE:
          delete all of guess
          set accepting to 1

SPRITE GemButton:
  LOCAL gemValue
  SHAPE art prism-lock/gem1
  COSTUME gem1 art prism-lock/gem1
  COSTUME gem2 art prism-lock/gem2
  COSTUME gem3 art prism-lock/gem3
  COSTUME gem4 art prism-lock/gem4
  COSTUME gem5 art prism-lock/gem5
  COSTUME gem6 art prism-lock/gem6
  SOUND choose 520
  WHEN flag clicked:
    hide
  WHEN I receive "open prism lock":
    set gemValue to 1
    REPEAT 6:
      switch costume to ("gem" join gemValue)
      go to x: (-210 + (gemValue * 60)) y: -150
      create clone of myself
      change gemValue by 1
  WHEN I start as a clone:
    show
  WHEN sprite clicked:
    IF accepting = 1 and length of guess < 4 THEN:
      add gemValue to guess
      play sound "choose"
      set size to 116
      broadcast "gem chosen"
      wait 0.08 seconds
      set size to 100
  WHEN I receive "prism lock over":
    hide

SPRITE PrismResult:
  COSTUME win label "PRISM UNSEALED • GREEN FLAG FOR A NEW CODE" #ffe66d
  COSTUME lose label "EIGHT ATTEMPTS USED • GREEN FLAG TO TRY A NEW CODE" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "open prism lock":
    hide
  WHEN I receive "prism lock over":
    IF won = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    fusion_foundry: `# Core Cascade — a tactical drop-and-merge puzzle.
# GOAL: fuse identical cores vertically until you create the white Nova core.
# CONTROLS: Left and Right choose a shaft. Space drops the core shown in NEXT.
GLOBAL score
GLOBAL column
GLOBAL level
GLOBAL row
GLOBAL chain
GLOBAL over
GLOBAL i
GLOBAL r
GLOBAL c
GLOBAL v
GLOBAL nextLevel
GLOBAL started
GLOBAL winner
GLOBAL openShafts

STAGE:
  BACKDROP intro art core-cascade/intro
  BACKDROP reactor art core-cascade/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to reactor
      broadcast "ignite cascade"
    ELSE:
      broadcast "drop core"

SPRITE Foundry:
  LIST grid
  SHAPE art core-cascade/core1
  COSTUME core1 art core-cascade/core1
  COSTUME core2 art core-cascade/core2
  COSTUME core3 art core-cascade/core3
  COSTUME core4 art core-cascade/core4
  COSTUME core5 art core-cascade/core5
  COSTUME cursor art core-cascade/cursor
  SOUND fuse 680
  SOUND nova 960

  DEFINE FAST reset:
    delete all of grid
    REPEAT 42:
      add 0 to grid
    set score to 0
    set column to 3
    set over to 0
    set winner to 0
    set openShafts to 6
    set nextLevel to pick random 1 to 2

  DEFINE FAST render:
    clear
    set i to 0
    REPEAT 42:
      set r to floor of (i / 6)
      set c to i mod 6
      set v to item (i + 1) of grid
      IF v > 0 THEN:
        switch costume to ("core" join v)
        go to x: (-137 + (c * 55)) y: (128 - (r * 43))
        stamp
      change i by 1
    switch costume to cursor
    go to x: (-137 + (column * 55)) y: 162
    stamp
    switch costume to ("core" join nextLevel)
    go to x: 183 y: 63
    stamp

  DEFINE drop core:
    IF over = 0 THEN:
      set row to 6
      REPEAT UNTIL row < 0 or item ((row * 6) + column) + 1 of grid = 0:
        change row by -1
      IF row < 0 THEN:
        set openShafts to 0
        set c to 0
        REPEAT 6:
          IF item (c + 1) of grid = 0 THEN:
            change openShafts by 1
          change c by 1
        IF openShafts = 0 THEN:
          set winner to 0
          set over to 1
          broadcast "core cascade over"
        ELSE:
          say "THAT SHAFT IS FULL — CHOOSE ANOTHER" for 1 seconds
      ELSE:
        set level to nextLevel
        set nextLevel to 1
        IF pick random 1 to 5 = 1 THEN:
          set nextLevel to 2
        replace item ((row * 6) + column) + 1 of grid with level
        set chain to 1
        render
        REPEAT UNTIL row = 6 or level > 4 or item (((row + 1) * 6) + column) + 1 of grid = 0 or not item (((row + 1) * 6) + column) + 1 of grid = level:
          replace item ((row * 6) + column) + 1 of grid with 0
          change row by 1
          change level by 1
          replace item ((row * 6) + column) + 1 of grid with level
          change score by level * chain * 10
          change chain by 1
          play sound "fuse"
          render
          wait 0.12 seconds
        render
        IF level = 5 THEN:
          play sound "nova"
          change score by 500
          set winner to 1
          set over to 1
          broadcast "core cascade over"

  WHEN flag clicked:
    hide
    clear
  WHEN I receive "ignite cascade":
    reset
    show variable score
    render
  WHEN left arrow key pressed:
    IF started = 1 and over = 0 and column > 0 THEN:
      change column by -1
      render
  WHEN right arrow key pressed:
    IF started = 1 and over = 0 and column < 5 THEN:
      change column by 1
      render
  WHEN I receive "drop core":
    drop core

SPRITE CoreCascadeResult:
  COSTUME win label "WHITE NOVA FORGED • GREEN FLAG FOR A NEW REACTOR" #ffe66d
  COSTUME lose label "ALL SIX SHAFTS SEALED • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "ignite cascade":
    hide
  WHEN I receive "core cascade over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    missile_ballet: `# Contrail Panic — a mouse-steering survival game.
# GOAL: force the homing missiles across each other's paths and destroy twenty-four
# of them before your emergency shield is exhausted.
# CONTROLS: move the mouse to steer. Collect a gold beacon to restore your shield.
GLOBAL score
GLOBAL shield
GLOBAL tempo
GLOBAL spawnx
GLOBAL spawny
GLOBAL alive
GLOBAL scrambleStarted
GLOBAL missiles

STAGE:
  BACKDROP intro art contrail-panic/intro
  BACKDROP scramble art contrail-panic/play
  WHEN flag clicked:
    set scrambleStarted to 0
    switch backdrop to intro
    hide variable score
    hide variable shield
    hide variable missiles
  WHEN space key pressed:
    IF scrambleStarted = 0 THEN:
      set scrambleStarted to 1
      switch backdrop to scramble
      broadcast "scramble"
  WHEN I receive "missile destroyed":
    change missiles by 1
    change score by 5
    IF missiles > 23 THEN:
      set alive to 0
      say ("AIRSPACE CLEARED — SCORE " join score) for 4 seconds
      stop all

SPRITE Jet:
  SHAPE art contrail-panic/jet
  SOUND hit 120
  WHEN flag clicked:
    set score to 0
    set shield to 1
    set tempo to 1.5
    set alive to 1
    set missiles to 0
    go to x: 0 y: 0
    hide
  WHEN I receive "scramble":
    show variable score
    show variable shield
    show variable missiles
    show
    FOREVER:
      IF alive = 1 THEN:
        point towards mouse-pointer
        go to x: mouse x y: mouse y
        IF touching Rocket THEN:
          change shield by -1
          play sound "hit"
          wait 0.6 seconds
          IF shield < 0 THEN:
            set alive to 0
            say ("SHIELD LOST — SCORE " join score) for 3 seconds
            stop all
      wait 0.02 seconds

SPRITE Rocket:
  SHAPE art contrail-panic/missile
  SOUND boom 70
  WHEN flag clicked:
    hide
  WHEN I receive "scramble":
    FOREVER:
      set spawnx to pick random -220 to 220
      set spawny to 175
      go to x: spawnx y: spawny
      create clone of myself
      wait tempo seconds
      IF tempo > 0.45 THEN:
        change tempo by -0.025
  WHEN I start as a clone:
    show
    point towards Jet
    REPEAT UNTIL touching edge or alive = 0:
      point towards Jet
      turn right pick random -5 to 5 degrees
      move 4 steps
      IF touching Rocket THEN:
        broadcast "missile destroyed"
        play sound "boom"
        delete this clone
      wait 0.025 seconds
    delete this clone

SPRITE Pulse:
  SHAPE art contrail-panic/pulse
  WHEN flag clicked:
    hide
  WHEN I receive "scramble":
    FOREVER:
      wait 8 seconds
      go to x: pick random -180 to 180 y: pick random -120 to 120
      show
      REPEAT UNTIL touching Jet:
        change color effect by 8
        wait 0.04 seconds
      set shield to 1
      change score by 5
      hide`,

    orbit_ward: `# Aegis Arc — a circular defense game.
# GOAL: rebound the spark through all eight inner locks without letting it escape.
# CONTROLS: Left and Right rotate the cyan shield around the outer orbit.
GLOBAL angle
GLOBAL ballx
GLOBAL bally
GLOBAL vx
GLOBAL vy
GLOBAL score
GLOBAL lives
GLOBAL sealangle
GLOBAL aegisStarted

STAGE:
  BACKDROP briefing art aegis-arc/intro
  BACKDROP reactor art aegis-arc/play
  WHEN flag clicked:
    set aegisStarted to 0
    switch backdrop to briefing
    hide variable score
    hide variable lives
  WHEN space key pressed:
    IF aegisStarted = 0 THEN:
      set aegisStarted to 1
      switch backdrop to reactor
      broadcast "arm aegis"

SPRITE Shield:
  SHAPE art aegis-arc/shield
  WHEN flag clicked:
    set angle to 0
    hide
  WHEN I receive "arm aegis":
    show
    FOREVER:
      IF key left arrow pressed? THEN:
        change angle by -14
      IF key right arrow pressed? THEN:
        change angle by 14
      go to x: ((sin of angle) * 145) y: ((cos of angle) * 145)
      point in direction (angle + 90)
      wait 0.02 seconds

SPRITE Spark:
  SHAPE art aegis-arc/spark
  SOUND ping 880
  WHEN flag clicked:
    set score to 0
    set lives to 3
    set ballx to 0
    set bally to 0
    set vx to 4
    set vy to 6
    hide
  WHEN I receive "arm aegis":
    show variable score
    show variable lives
    show
    FOREVER:
      change ballx by vx
      change bally by vy
      go to x: ballx y: bally
      IF touching Shield THEN:
        set vx to (0 - ((sin of angle) * (7 + (score / 3))))
        set vy to (0 - ((cos of angle) * (7 + (score / 3))))
        play sound "ping"
        wait 0.08 seconds
      IF touching Seal THEN:
        set vx to vx * -1
        set vy to vy * -1
      IF (ballx * ballx) + (bally * bally) > 28500 THEN:
        change lives by -1
        set ballx to 0
        set bally to 0
        set vx to pick random 4 to 7
        set vy to pick random -6 to 6
        IF lives < 1 THEN:
          say "The reactor escaped!" for 3 seconds
          stop all
      IF score > 7 THEN:
        say "Orbit secured!" for 3 seconds
        stop all
      wait 0.02 seconds

SPRITE Seal:
  SHAPE art aegis-arc/lock
  WHEN flag clicked:
    hide
  WHEN I receive "arm aegis":
    set sealangle to 0
    REPEAT 8:
      go to x: ((sin of sealangle) * 82) y: ((cos of sealangle) * 82)
      create clone of myself
      change sealangle by 45
  WHEN I start as a clone:
    show
    FOREVER:
      IF touching Spark THEN:
        change score by 1
        delete this clone
      wait 0.02 seconds`,

    rooftop_relay: `# Neon Relay — a readable two-action rooftop runner.
# GOAL: clear thirty rooftop hazards to deliver the relay cell. Red vents require
# a jump, orange drones a slide, and one collision ends the run.
# CONTROLS: Up jumps, Down slides. Batteries grant a short obstacle-smashing boost.
GLOBAL score
GLOBAL speed
GLOBAL runy
GLOBAL vy
GLOBAL grounded
GLOBAL sliding
GLOBAL spawnKind
GLOBAL overdrive
GLOBAL hurtLock
GLOBAL started
GLOBAL rooftops
GLOBAL delivered

STAGE:
  BACKDROP intro art neon-relay/intro
  BACKDROP skyline art neon-relay/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable overdrive
    hide variable rooftops
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to skyline
      broadcast "start neon relay"
  WHEN I receive "rooftop cleared":
    change rooftops by 1
    change score by 1
    IF rooftops = 30 THEN:
      set delivered to 1
      say ("RELAY DELIVERED — SCORE " join score) for 4 seconds
      stop all

SPRITE Runner:
  SHAPE art neon-relay/run
  COSTUME run art neon-relay/run
  COSTUME slide art neon-relay/slide
  SOUND jump 620
  SOUND boost 880
  WHEN flag clicked:
    set score to 0
    set speed to 6
    set runy to -125
    set vy to 0
    set grounded to 1
    set sliding to 0
    set overdrive to 0
    set hurtLock to 0
    set rooftops to 0
    set delivered to 0
    go to x: -120 y: runy
    hide
  WHEN I receive "start neon relay":
    show variable score
    show variable overdrive
    show variable rooftops
    show
  WHEN up arrow key pressed:
    IF started = 1 and grounded = 1 THEN:
      set vy to 12
      set grounded to 0
      play sound "jump"
  WHEN I receive "start neon relay":
    FOREVER:
      set sliding to 0
      IF key down arrow pressed? and grounded = 1 THEN:
        set sliding to 1
        switch costume to slide
      ELSE:
        switch costume to run
      change vy by -0.75
      change runy by vy
      IF runy < -125 THEN:
        set runy to -125
        set vy to 0
        set grounded to 1
      go to x: -120 y: runy
      IF hurtLock > 0 THEN:
        change hurtLock by -1
      IF touching Hazard and hurtLock = 0 THEN:
        IF overdrive > 0 THEN:
          change score by 10
          set overdrive to 0
          set hurtLock to 45
          play sound "boost"
          say "BOOST SMASH +10" for 0.5 seconds
        ELSE:
          say (("RELAY DROPPED AT ROOFTOP " join rooftops) join " OF 30") for 3 seconds
          stop all
      IF overdrive > 0 THEN:
        change overdrive by -1
        change color effect by 10
      ELSE:
        clear graphic effects
      IF score > 14 THEN:
        set speed to 7
      IF score > 39 THEN:
        set speed to 8
      wait 0.02 seconds
  WHEN I receive "battery collected":
    set overdrive to 120
    change score by 5
    play sound "boost"

SPRITE Hazard:
  SHAPE art neon-relay/vent
  COSTUME vent art neon-relay/vent
  COSTUME drone art neon-relay/drone
  WHEN flag clicked:
    hide
  WHEN I receive "start neon relay":
    FOREVER:
      set spawnKind to pick random 1 to 2
      IF spawnKind = 1 THEN:
        switch costume to vent
        go to x: 250 y: -120
      ELSE:
        switch costume to drone
        go to x: 250 y: -96
      create clone of myself
      wait pick random 1.2 to 2.1 seconds
  WHEN I start as a clone:
    show
    REPEAT UNTIL x position < -250:
      change x by (0 - speed)
      wait 0.02 seconds
    broadcast "rooftop cleared"
    delete this clone

SPRITE Battery:
  SHAPE art neon-relay/battery
  WHEN flag clicked:
    hide
  WHEN I receive "start neon relay":
    FOREVER:
      wait pick random 3 to 6 seconds
      go to x: 250 y: pick random -105 to 40
      create clone of myself
  WHEN I start as a clone:
    show
    REPEAT UNTIL x position < -250 or touching Runner:
      turn right 12 degrees
      change x by (0 - speed)
      wait 0.02 seconds
    IF touching Runner THEN:
      broadcast "battery collected"
    delete this clone`,

    twinwall: `# Rift Rally — a two-paddle crystal clear.
# GOAL: break all 24 drifting crystals before the comet escapes three times.
# CONTROLS: W/S move the cyan left paddle; Up/Down move the gold right paddle.
GLOBAL score
GLOBAL bricks
GLOBAL rally
GLOBAL lives
GLOBAL bx
GLOBAL by
GLOBAL vx
GLOBAL vy
GLOBAL ly
GLOBAL ry
GLOBAL gx
GLOBAL gy
GLOBAL started

STAGE:
  BACKDROP intro art rift-rally/intro
  BACKDROP arena art rift-rally/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable lives
    hide variable bricks
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to arena
      broadcast "serve rift"

SPRITE LeftWall:
  SHAPE art rift-rally/left
  WHEN flag clicked:
    set ly to 0
    hide
  WHEN I receive "serve rift":
    show
    FOREVER:
      IF key w pressed? THEN:
        change ly by 9
      IF key s pressed? THEN:
        change ly by -9
      IF ly > 135 THEN:
        set ly to 135
      IF ly < -135 THEN:
        set ly to -135
      go to x: -220 y: ly

SPRITE RightWall:
  SHAPE art rift-rally/right
  WHEN flag clicked:
    set ry to 0
    hide
  WHEN I receive "serve rift":
    show
    FOREVER:
      IF key up arrow pressed? THEN:
        change ry by 9
      IF key down arrow pressed? THEN:
        change ry by -9
      IF ry > 135 THEN:
        set ry to 135
      IF ry < -135 THEN:
        set ry to -135
      go to x: 220 y: ry

SPRITE Comet:
  SHAPE art rift-rally/comet
  SOUND hit 840
  SOUND escape 160
  WHEN flag clicked:
    set score to 0
    set lives to 3
    set bricks to 24
    set rally to 1
    set bx to 0
    set by to -120
    set vx to 7
    set vy to 5
    go to x: bx y: by
    hide
  WHEN I receive "serve rift":
    show variable score
    show variable lives
    show variable bricks
    show
    FOREVER:
      change bx by vx
      change by by vy
      go to x: bx y: by
      IF by > 165 or by < -165 THEN:
        set vy to vy * -1
      IF touching LeftWall THEN:
        set vx to abs of vx
        change rally by 1
        play sound "hit"
      IF touching RightWall THEN:
        set vx to 0 - (abs of vx)
        change rally by 1
        play sound "hit"
      IF bx < -238 or bx > 238 THEN:
        change lives by -1
        play sound "escape"
        set bx to 0
        set by to 0
        set rally to 1
        set vx to vx * -1
        wait 0.4 seconds
        IF lives < 1 THEN:
          say ("RIFTS LOST — SCORE " join score) for 3 seconds
          stop all
      IF bricks < 1 THEN:
        say ("RIFT CLEARED! SCORE " join score) for 4 seconds
        stop all
      wait 0.015 seconds

SPRITE Shifter:
  LOCAL drift
  SHAPE art rift-rally/crystal
  SOUND break 1040
  WHEN flag clicked:
    hide
  WHEN I receive "serve rift":
    set gy to -90
    REPEAT 6:
      set gx to -60
      REPEAT 4:
        go to x: gx y: gy
        create clone of myself
        change gx by 40
      change gy by 36
  WHEN I start as a clone:
    show
    set drift to pick random -1 to 1
    FOREVER:
      change x by drift
      IF x position > 95 or x position < -95 THEN:
        set drift to drift * -1
      IF touching Comet THEN:
        change score by rally
        change bricks by -1
        set vx to vx * -1
        play sound "break"
        delete this clone
      wait 0.03 seconds`,

    turbo_chicane: `# Slipstream Circuit — a lane-based checkpoint sprint.
# GOAL: drive through three green checkpoint gates before your energy reaches zero.
# CONTROLS: Left/Right steer. Up spends boost collected from cyan rival slipstreams.
GLOBAL score
GLOBAL roadSpeed
GLOBAL fuel
GLOBAL boost
GLOBAL lane
GLOBAL checkpoints
GLOBAL started
GLOBAL spawnLane
GLOBAL draftLock
GLOBAL crashLock
GLOBAL gateActive
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art slipstream/intro
  BACKDROP circuit art slipstream/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable fuel
    hide variable boost
    hide variable checkpoints
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set fuel to 100
      set boost to 0
      set checkpoints to 0
      set roadSpeed to 6
      set lane to 0
      set draftLock to 0
      set crashLock to 0
      set gateActive to 0
      set winner to 0
      set active to 1
      switch backdrop to circuit
      broadcast "start slipstream"

SPRITE Racer:
  SHAPE art slipstream/racer
  SOUND draft 920
  SOUND crash 120
  WHEN flag clicked:
    set score to 0
    set fuel to 100
    set boost to 0
    set checkpoints to 0
    set roadSpeed to 6
    set lane to 0
    set draftLock to 0
    set crashLock to 0
    set active to 0
    set winner to 0
    go to x: 0 y: -125
    hide
  WHEN I receive "start slipstream":
    show variable score
    show variable fuel
    show variable boost
    show variable checkpoints
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change lane by -8
      IF key right arrow pressed? THEN:
        change lane by 8
      IF lane < -145 THEN:
        set lane to -145
      IF lane > 145 THEN:
        set lane to 145
      IF key up arrow pressed? and boost > 0 THEN:
        set roadSpeed to 11 + checkpoints
        change boost by -1
      ELSE:
        set roadSpeed to 6 + checkpoints + (score / 30)
      go to x: lane y: -125
      change fuel by -0.05
      IF draftLock > 0 THEN:
        change draftLock by -1
      IF crashLock > 0 THEN:
        change crashLock by -1
      IF touching Draft and draftLock = 0 THEN:
        change boost by 25
        change score by 3
        set draftLock to 40
        play sound "draft"
        IF boost > 100 THEN:
          set boost to 100
      IF touching Rival and crashLock = 0 THEN:
        change fuel by -15
        set crashLock to 50
        play sound "crash"
      IF touching Oil and crashLock = 0 THEN:
        change fuel by -12
        set roadSpeed to 2
        set crashLock to 50
        play sound "crash"
      IF touching Gate and gateActive = 1 THEN:
        set gateActive to 0
        broadcast "circuit checkpoint"
      IF fuel < 1 THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "slipstream over"
      wait 0.02 seconds
    hide
  WHEN I receive "circuit checkpoint":
    IF active = 1 THEN:
      change checkpoints by 1
      change score by 15
      change fuel by 22
      IF checkpoints = 3 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "slipstream over"

SPRITE Rival:
  SHAPE art slipstream/rival
  WHEN flag clicked:
    hide
  WHEN I receive "start slipstream":
    REPEAT UNTIL active = 0:
      set spawnLane to pick random -125 to 125
      go to x: spawnLane y: 190
      create clone of myself
      broadcast "spawn draft"
      wait pick random 1 to 2 seconds
  WHEN I start as a clone:
    show
    REPEAT UNTIL y position < -190 or active = 0:
      change y by (0 - roadSpeed)
      wait 0.02 seconds
    IF active = 1 THEN:
      change score by 2
    delete this clone

SPRITE Draft:
  SHAPE art slipstream/draft
  WHEN flag clicked:
    hide
  WHEN I receive "spawn draft":
    go to x: spawnLane y: 128
    create clone of myself
  WHEN I start as a clone:
    show
    REPEAT UNTIL y position < -220 or active = 0:
      change y by (0 - roadSpeed)
      wait 0.02 seconds
    delete this clone

SPRITE Oil:
  SHAPE art slipstream/oil
  WHEN flag clicked:
    hide
  WHEN I receive "start slipstream":
    REPEAT UNTIL active = 0:
      wait pick random 2 to 4 seconds
      IF active = 1 THEN:
        go to x: pick random -140 to 140 y: 190
        create clone of myself
  WHEN I start as a clone:
    show
    REPEAT UNTIL y position < -190 or active = 0:
      change y by (0 - roadSpeed)
      wait 0.02 seconds
    delete this clone

SPRITE Gate:
  SHAPE art slipstream/gate
  WHEN flag clicked:
    hide
    set gateActive to 0
  WHEN I receive "start slipstream":
    REPEAT UNTIL active = 0:
      wait 6 seconds
      IF active = 1 THEN:
        set gateActive to 1
        go to x: pick random -120 to 120 y: 190
        show
        REPEAT UNTIL y position < -190 or gateActive = 0 or active = 0:
          change y by (0 - roadSpeed)
          wait 0.02 seconds
        IF gateActive = 1 and active = 1 THEN:
          change fuel by -18
          set gateActive to 0
        hide

SPRITE CircuitResult:
  COSTUME win label "THREE CHECKPOINTS • PRESS SPACE OR TAP START TO RACE AGAIN" #8fffea
  COSTUME lose label "ENERGY EMPTY • PRESS SPACE OR TAP START TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start slipstream":
    hide
  WHEN I receive "slipstream over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    abyss_rescue: `# Abyss Lift — a buoyancy-driven rescue run.
# GOAL: rescue six gold divers before mines or cave walls consume three hull points.
# CONTROLS: hold Space to rise and release it to dive; the current continually shifts.
GLOBAL score
GLOBAL hull
GLOBAL rescued
GLOBAL suby
GLOBAL vy
GLOBAL current
GLOBAL scroll
GLOBAL invulnerable
GLOBAL started
GLOBAL active
GLOBAL winner
GLOBAL diveRun

STAGE:
  BACKDROP intro art abyss-lift/intro
  BACKDROP trench art abyss-lift/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable hull
    hide variable rescued
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set hull to 3
      set rescued to 0
      set suby to 20
      set vy to 0
      set scroll to 4
      set invulnerable to 0
      set winner to 0
      set active to 1
      change diveRun by 1
      switch backdrop to trench
      broadcast "start abyss lift"

SPRITE Sub:
  SHAPE art abyss-lift/sub
  SOUND sonar 540
  SOUND hullHit 110
  WHEN flag clicked:
    set score to 0
    set hull to 3
    set rescued to 0
    set suby to 20
    set vy to 0
    set scroll to 4
    set invulnerable to 0
    set active to 0
    set winner to 0
    go to x: -130 y: suby
    hide
  WHEN I receive "start abyss lift":
    show variable score
    show variable hull
    show variable rescued
    show
    REPEAT UNTIL active = 0:
      IF key space pressed? THEN:
        change vy by 0.65
      change vy by -0.28
      set current to (sin of timer * 90) * 0.08
      change suby by vy + current
      go to x: -130 y: suby
      IF invulnerable > 0 THEN:
        change invulnerable by -1
      IF invulnerable = 0 and (suby > 145 or suby < -145 or touching Mine) THEN:
        change hull by -1
        set invulnerable to 35
        set suby to 20
        set vy to 0
        play sound "hullHit"
        IF hull < 1 THEN:
          set winner to 0
          set active to 0
          broadcast "abyss lift over"
      IF rescued > 3 THEN:
        set scroll to 5
      wait 0.02 seconds
    hide
  WHEN I receive "diver rescued":
    IF active = 1 THEN:
      change rescued by 1
      change score by 10
      play sound "sonar"
      IF rescued = 6 THEN:
        set winner to 1
        set active to 0
        broadcast "abyss lift over"

SPRITE Mine:
  LOCAL mineRun
  SHAPE art abyss-lift/mine
  WHEN flag clicked:
    hide
    FOREVER:
      IF active = 1 THEN:
        set mineRun to diveRun
        go to x: 250 y: pick random -145 to 145
        create clone of myself
        wait pick random 1 to 3 seconds
      ELSE:
        wait 0.1 seconds
  WHEN I start as a clone:
    show
    REPEAT UNTIL x position < -250 or active = 0 or mineRun != diveRun:
      turn right 4 degrees
      change x by (0 - scroll)
      wait 0.02 seconds
    IF active = 1 THEN:
      change score by 1
    delete this clone

SPRITE Diver:
  LOCAL diverRun
  SHAPE art abyss-lift/diver
  WHEN flag clicked:
    hide
    FOREVER:
      IF active = 1 THEN:
        wait pick random 2 to 4 seconds
      IF active = 1 THEN:
        set diverRun to diveRun
        go to x: 250 y: pick random -120 to 120
        create clone of myself
      ELSE:
        wait 0.1 seconds
  WHEN I start as a clone:
    show
    REPEAT UNTIL x position < -250 or touching Sub or active = 0 or diverRun != diveRun:
      set ghost effect to pick random 0 to 12
      change x by (0 - scroll)
      wait 0.02 seconds
    IF touching Sub and active = 1 THEN:
      broadcast "diver rescued"
    delete this clone

SPRITE AbyssResult:
  COSTUME win label "ALL SIX DIVERS SAFE • GREEN FLAG FOR ANOTHER DIVE" #ffe66d
  COSTUME lose label "HULL LOST • GREEN FLAG TO RETRY" #ff8ca8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start abyss lift":
    hide
  WHEN I receive "abyss lift over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    specter_sweep: `# Wardlight — a ricochet defense game.
# GOAL: banish twelve specters before three of them reach the central ward.
# CONTROLS: aim with the mouse and click to cast an orb; shots bounce off room edges.
GLOBAL score
GLOBAL ward
GLOBAL edgeSide
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art wardlight/intro
  BACKDROP manor art wardlight/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable ward
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to manor
      broadcast "light the ward"

SPRITE Hunter:
  SHAPE art wardlight/hunter
  WHEN flag clicked:
    set score to 0
    set ward to 3
    set active to 0
    set winner to 0
    go to x: 0 y: 0
    hide
  WHEN I receive "light the ward":
    set score to 0
    set ward to 3
    set winner to 0
    set active to 1
    show variable score
    show variable ward
    show
    REPEAT UNTIL active = 0:
      point towards mouse-pointer
      IF score > 11 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "wardlight over"
      IF ward < 1 THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "wardlight over"
      wait 0.02 seconds
    hide
  WHEN I receive "light the ward":
    REPEAT UNTIL active = 0:
      IF mouse down? THEN:
        broadcast "cast"
        wait until not mouse down?
      wait 0.02 seconds
  WHEN I receive "specter banished":
    IF active = 1 THEN:
      change score by 1
  WHEN I receive "ward struck":
    IF active = 1 THEN:
      change ward by -1

SPRITE Orb:
  SHAPE art wardlight/orb
  SOUND zap 930
  WHEN flag clicked:
    hide
  WHEN I receive "cast":
    IF active = 1 THEN:
      go to x: 0 y: 0
      point towards mouse-pointer
      create clone of myself
  WHEN I start as a clone:
    show
    set life to 180
    REPEAT UNTIL life < 1 or active = 0:
      move 10 steps
      if on edge bounce
      change life by -1
      wait 0.02 seconds
    delete this clone

SPRITE Ghost:
  SHAPE art wardlight/ghost
  SOUND zap 930
  WHEN flag clicked:
    hide
  WHEN I receive "light the ward":
    REPEAT UNTIL active = 0:
      set edgeSide to pick random 1 to 4
      IF edgeSide = 1 THEN:
        go to x: -220 y: pick random -150 to 150
      IF edgeSide = 2 THEN:
        go to x: 220 y: pick random -150 to 150
      IF edgeSide = 3 THEN:
        go to x: pick random -210 to 210 y: 160
      IF edgeSide = 4 THEN:
        go to x: pick random -210 to 210 y: -160
      create clone of myself
      wait 1.3 seconds
  WHEN I start as a clone:
    show
    REPEAT UNTIL active = 0 or touching Hunter or touching Orb:
      point towards Hunter
      move 1.8 steps
      set ghost effect to pick random 0 to 25
      wait 0.03 seconds
    IF active = 1 and touching Orb THEN:
      broadcast "specter banished"
      play sound "zap"
    ELSE:
      IF active = 1 THEN:
        broadcast "ward struck"
    delete this clone

SPRITE WardResult:
  COSTUME win label "TWELVE SPECTERS BANISHED • GREEN FLAG TO RELIGHT" #8fffea
  COSTUME lose label "THE CENTRAL WARD FELL • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "light the ward":
    hide
  WHEN I receive "wardlight over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    moonlight_heist: `# Pantry Prowl — a compact stealth chase.
# GOAL: steal five cheeses and return to the blue hideout without being caught.
# CONTROLS: Arrow keys move. Motion in the open raises alert; the hideout clears it.
GLOBAL score
GLOBAL alert
GLOBAL px
GLOBAL py
GLOBAL moving
GLOBAL started
GLOBAL active
GLOBAL winner
GLOBAL cheeseReady

STAGE:
  BACKDROP intro art pantry-prowl/intro
  BACKDROP pantry art pantry-prowl/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable alert
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to pantry
      broadcast "start pantry prowl"

SPRITE Mouse:
  SHAPE art pantry-prowl/mouse
  WHEN flag clicked:
    set score to 0
    set alert to 0
    set px to -180
    set py to -120
    set active to 0
    set winner to 0
    go to x: px y: py
    hide
  WHEN I receive "start pantry prowl":
    set score to 0
    set alert to 0
    set px to -180
    set py to -120
    set winner to 0
    set active to 1
    go to x: px y: py
    show variable score
    show variable alert
    show
    REPEAT UNTIL active = 0:
      set moving to 0
      IF key left arrow pressed? THEN:
        change px by -5
        set moving to 1
      IF key right arrow pressed? THEN:
        change px by 5
        set moving to 1
      IF key up arrow pressed? THEN:
        change py by 5
        set moving to 1
      IF key down arrow pressed? THEN:
        change py by -5
        set moving to 1
      IF px < -225 THEN:
        set px to -225
      IF px > 225 THEN:
        set px to 225
      IF py < -165 THEN:
        set py to -165
      IF py > 165 THEN:
        set py to 165
      go to x: px y: py
      IF touching Tunnel THEN:
        set alert to 0
      ELSE:
        IF moving = 1 THEN:
          change alert by 0.04
        ELSE:
          IF alert > 0 THEN:
            change alert by -0.02
      IF alert > 5 THEN:
        set alert to 5
      IF touching Cat THEN:
        broadcast "pantry caught"
      IF cheeseReady = 1 and touching Cheese THEN:
        set cheeseReady to 0
        change score by 1
        broadcast "new cheese"
      IF score > 4 and touching Tunnel THEN:
        broadcast "pantry won"
      wait 0.02 seconds
    hide
  WHEN I receive "pantry caught":
    IF active = 1 THEN:
      set winner to 0
      set active to 0
      set started to 0
      broadcast "pantry over"
  WHEN I receive "pantry won":
    IF active = 1 THEN:
      set winner to 1
      set active to 0
      set started to 0
      broadcast "pantry over"

SPRITE Cat:
  SHAPE art pantry-prowl/cat
  WHEN flag clicked:
    go to x: 170 y: 110
    hide
  WHEN I receive "start pantry prowl":
    go to x: 170 y: 110
    show
    REPEAT UNTIL active = 0:
      IF alert > 0.75 THEN:
        point towards Mouse
        move 1 + (score * 0.12) steps
      ELSE:
        IF x position < 168 THEN:
          change x by 2
        IF x position > 172 THEN:
          change x by -2
        IF y position < 108 THEN:
          change y by 2
        IF y position > 112 THEN:
          change y by -2
        turn right 1 degrees
      wait 0.03 seconds
    hide

SPRITE Cheese:
  SHAPE art pantry-prowl/cheese
  WHEN flag clicked:
    go to x: 0 y: 0
    set cheeseReady to 0
    hide
  WHEN I receive "start pantry prowl":
    show
    broadcast "new cheese"
  WHEN I receive "new cheese":
    set cheeseReady to 0
    REPEAT UNTIL distance to Tunnel > 80 and distance to Cat > 70:
      go to x: pick random -200 to 200 y: pick random -140 to 140
    set cheeseReady to 1
  WHEN I receive "pantry over":
    hide

SPRITE Tunnel:
  SHAPE art pantry-prowl/tunnel
  WHEN flag clicked:
    go to x: -40 y: 100
    hide
  WHEN I receive "start pantry prowl":
    show
  WHEN I receive "pantry over":
    hide

SPRITE PantryResult:
  COSTUME win label "FIVE CHEESES SAFE • GREEN FLAG FOR ANOTHER HEIST" #8fffea
  COSTUME lose label "THE CAT CAUGHT YOU • GREEN FLAG TO SNEAK AGAIN" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start pantry prowl":
    hide
  WHEN I receive "pantry over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    cloud_court: `# Nimbus Volley — a one-player cloud-court match.
# GOAL: land the ball on the rival cloud; the first side to seven points wins.
# CONTROLS: A/D move, W jumps, and S while airborne turns contact into a fast spike.
GLOBAL playerScore
GLOBAL cpuScore
GLOBAL rally
GLOBAL bx
GLOBAL by
GLOBAL vx
GLOBAL vy
GLOBAL px
GLOBAL py
GLOBAL pvy
GLOBAL cy
GLOBAL cvy
GLOBAL target
GLOBAL spiking
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art nimbus-volley/intro
  BACKDROP court art nimbus-volley/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable playerScore
    hide variable cpuScore
    hide variable rally
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to court
      broadcast "start nimbus volley"

SPRITE Player:
  SHAPE art nimbus-volley/player
  WHEN flag clicked:
    set px to -150
    set py to -125
    set pvy to 0
    set spiking to 0
    go to x: px y: py
    hide
  WHEN I receive "start nimbus volley":
    set px to -150
    set py to -125
    set pvy to 0
    set spiking to 0
    set active to 1
    show
    REPEAT UNTIL active = 0:
      set spiking to 0
      IF key a pressed? THEN:
        change px by -7
      IF key d pressed? THEN:
        change px by 7
      IF key w pressed? and py = -125 THEN:
        set pvy to 11
      IF key s pressed? and py > -115 THEN:
        set spiking to 1
      change pvy by -0.7
      change py by pvy
      IF py < -125 THEN:
        set py to -125
        set pvy to 0
      IF px < -220 THEN:
        set px to -220
      IF px > -35 THEN:
        set px to -35
      go to x: px y: py
      wait 0.02 seconds
    hide

SPRITE CloudBot:
  SHAPE art nimbus-volley/bot
  WHEN flag clicked:
    set cy to -125
    set cvy to 0
    go to x: 150 y: cy
    hide
  WHEN I receive "start nimbus volley":
    set cy to -125
    set cvy to 0
    go to x: 150 y: cy
    show
    REPEAT UNTIL active = 0:
      set target to x position of Ball
      IF target > x position + 5 THEN:
        change x by 5
      IF target < x position - 5 THEN:
        change x by -5
      IF x position < 35 THEN:
        set x to 35
      IF x position > 220 THEN:
        set x to 220
      IF x position of Ball > 20 and y position of Ball > -45 and cy = -125 THEN:
        set cvy to 9
      change cvy by -0.7
      change cy by cvy
      IF cy < -125 THEN:
        set cy to -125
        set cvy to 0
      set y to cy
      wait 0.02 seconds
    hide

SPRITE Ball:
  SHAPE art nimbus-volley/ball
  SOUND bump 760
  WHEN flag clicked:
    set playerScore to 0
    set cpuScore to 0
    set rally to 1
    set bx to 0
    set by to 80
    set vx to -4
    set vy to 4
    set active to 0
    set winner to 0
    go to x: bx y: by
    hide
  WHEN I receive "start nimbus volley":
    set playerScore to 0
    set cpuScore to 0
    set rally to 1
    set bx to 0
    set by to 100
    set vx to -4
    set vy to 4
    set winner to 0
    set active to 1
    show variable playerScore
    show variable cpuScore
    show variable rally
    show
    REPEAT UNTIL active = 0:
      change vy by -0.32
      change bx by vx
      change by by vy
      IF bx > 226 THEN:
        set bx to 226
        set vx to 0 - (abs of vx)
      IF bx < -226 THEN:
        set bx to -226
        set vx to abs of vx
      IF by > 166 THEN:
        set by to 166
        set vy to 0 - (abs of vy)
      go to x: bx y: by
      IF touching Player THEN:
        IF spiking = 1 and py > -110 THEN:
          set vx to 5 + (abs of (bx - px) / 14)
          set vy to -6
        ELSE:
          set vx to 3.8 + (abs of (bx - px) / 16)
          set vy to 7 + (pvy * 0.35)
        change rally by 1
        play sound "bump"
        wait 0.06 seconds
      IF touching CloudBot THEN:
        set vx to 0 - (3.8 + (abs of (bx - x position of CloudBot) / 16))
        set vy to 7 + (cvy * 0.3)
        change rally by 1
        play sound "bump"
        wait 0.06 seconds
      IF touching Net THEN:
        set vx to vx * -1
        wait 0.06 seconds
      IF by < -165 THEN:
        IF bx > 0 THEN:
          change playerScore by 1
          set vx to -4
        ELSE:
          change cpuScore by 1
          set vx to 4
        set rally to 1
        set bx to 0
        set by to 100
        set vy to 3
        wait 0.55 seconds
      IF playerScore = 7 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "nimbus match over"
      IF cpuScore = 7 THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "nimbus match over"
      wait 0.02 seconds
    hide

SPRITE Net:
  SHAPE art nimbus-volley/net
  WHEN flag clicked:
    go to x: 0 y: -115
    hide
  WHEN I receive "start nimbus volley":
    show
  WHEN I receive "nimbus match over":
    hide

SPRITE NimbusResult:
  COSTUME win label "STORM COURT WON • GREEN FLAG FOR A REMATCH" #7ff6ff
  COSTUME lose label "NIMBUS WINS • GREEN FLAG FOR A REMATCH" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start nimbus volley":
    hide
  WHEN I receive "nimbus match over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    ember_dojo: `# Ember Parry — a compact timing duel against a sky dragon.
# GOAL: reflect eight fireballs into the dragon before three embers strike the ronin.
# CONTROLS: Left/Right line up with each shot. Space opens a brief moon-blade parry.
GLOBAL hearts
GLOBAL dragonHP
GLOBAL heroX
GLOBAL parrying
GLOBAL fireSpeed
GLOBAL streak
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art ember-parry/intro
  BACKDROP dojo art ember-parry/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable hearts
    hide variable dragonHP
    hide variable streak
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set hearts to 3
      set dragonHP to 8
      set streak to 0
      set heroX to -120
      set parrying to 0
      set fireSpeed to 5
      set winner to 0
      set active to 1
      switch backdrop to dojo
      broadcast "start ember parry"

SPRITE Ronin:
  SHAPE art ember-parry/ronin
  WHEN flag clicked:
    set hearts to 3
    set dragonHP to 8
    set streak to 0
    set heroX to -120
    set parrying to 0
    set fireSpeed to 5
    set active to 0
    set winner to 0
    go to x: heroX y: -125
    hide
  WHEN I receive "start ember parry":
    show variable hearts
    show variable dragonHP
    show variable streak
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change heroX by -7
      IF key right arrow pressed? THEN:
        change heroX by 7
      IF heroX < -215 THEN:
        set heroX to -215
      IF heroX > 215 THEN:
        set heroX to 215
      go to x: heroX y: -125
      IF dragonHP < 5 THEN:
        set fireSpeed to 7
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and parrying = 0 THEN:
      set parrying to 1
      broadcast "moon parry"
      wait 0.18 seconds
      set parrying to 0
  WHEN I receive "ember reflected":
    IF active = 1 THEN:
      change dragonHP by -1
      change streak by 1
      IF dragonHP < 1 THEN:
        set winner to 1
        set active to 0
        broadcast "ember duel over"
  WHEN I receive "ember struck":
    IF active = 1 THEN:
      change hearts by -1
      set streak to 0
      IF hearts < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "ember duel over"

SPRITE Blade:
  SHAPE art ember-parry/blade
  WHEN flag clicked:
    hide
  WHEN I receive "moon parry":
    go to x: heroX y: -91
    show
    wait 0.18 seconds
    hide
  WHEN I receive "ember duel over":
    hide

SPRITE Dragon:
  SHAPE art ember-parry/dragon
  WHEN flag clicked:
    go to x: 145 y: 92
    hide
  WHEN I receive "start ember parry":
    show
    REPEAT UNTIL active = 0:
      glide 0.7 secs to x: pick random -175 to 175 y: pick random 65 to 125
      IF active = 1 THEN:
        broadcast "dragon fire"
        IF dragonHP < 5 THEN:
          wait 0.45 seconds
        ELSE:
          wait 0.8 seconds
    hide

SPRITE Fireball:
  SHAPE art ember-parry/fireball
  SOUND clash 820
  SOUND hit 160
  WHEN flag clicked:
    hide
  WHEN I receive "dragon fire":
    IF active = 1 THEN:
      go to Dragon
      point towards Ronin
      create clone of myself
  WHEN I start as a clone:
    show
    REPEAT UNTIL touching Ronin or touching edge or active = 0:
      move fireSpeed steps
      wait 0.02 seconds
    IF touching Ronin and active = 1 THEN:
      IF parrying = 1 THEN:
        broadcast "ember reflected"
        play sound "clash"
        say "REFLECT!" for 0.25 seconds
      ELSE:
        broadcast "ember struck"
        play sound "hit"
    delete this clone

SPRITE EmberResult:
  COSTUME win label "EIGHT PERFECT RETURNS • GREEN FLAG FOR A REMATCH" #ffe66d
  COSTUME lose label "THREE EMBERS LANDED • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start ember parry":
    hide
  WHEN I receive "ember duel over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    lockstep_lagoon: `# Tidegate Rush — a finite three-lane hydrofoil sprint.
# GOAL: clear eight blue gates before the 35-second tide closes; three buoy hits sink you.
# CONTROLS: Left/Right change lanes. Hold Up to spend charge and accelerate.
# Violet surge locks make the next three blue gates worth triple points.
GLOBAL score
GLOBAL gates
GLOBAL hull
GLOBAL timeLeft
GLOBAL lane
GLOBAL speed
GLOBAL surge
GLOBAL charge
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art tidegate-rush/intro
  BACKDROP course art tidegate-rush/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable gates
    hide variable hull
    hide variable timeLeft
    hide variable charge
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set gates to 0
      set hull to 3
      set timeLeft to 35
      set lane to 0
      set speed to 5
      set surge to 0
      set charge to 100
      set winner to 0
      set active to 1
      switch backdrop to course
      broadcast "start tidegate rush"

SPRITE Foil:
  SHAPE art tidegate-rush/foil
  COSTUME boost art tidegate-rush/boost
  WHEN flag clicked:
    set score to 0
    set gates to 0
    set hull to 3
    set timeLeft to 35
    set lane to 0
    set speed to 5
    set surge to 0
    set charge to 100
    set active to 0
    set winner to 0
    point in direction 0
    go to x: 0 y: -125
    hide
  WHEN I receive "start tidegate rush":
    show variable score
    show variable gates
    show variable hull
    show variable timeLeft
    show variable charge
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change lane by -1
        wait 0.12 seconds
      IF key right arrow pressed? THEN:
        change lane by 1
        wait 0.12 seconds
      IF lane < -1 THEN:
        set lane to -1
      IF lane > 1 THEN:
        set lane to 1
      glide 0.08 secs to x: lane * 110 y: -125
      IF key up arrow pressed? and charge > 0 THEN:
        set speed to 9
        switch costume to boost
        change charge by -1
      ELSE:
        set speed to 5
        switch costume to costume1
        IF charge < 100 THEN:
          change charge by 0.25
      wait 0.02 seconds
    hide
  WHEN I receive "start tidegate rush":
    REPEAT UNTIL active = 0:
      wait 1 seconds
      IF active = 1 THEN:
        change timeLeft by -1
        IF timeLeft < 1 THEN:
          set winner to 0
          set active to 0
          broadcast "tidegate over"
  WHEN I receive "blue gate cleared":
    IF active = 1 THEN:
      change gates by 1
      IF surge > 0 THEN:
        change score by 15
        change surge by -1
      ELSE:
        change score by 5
      change timeLeft by 1
      IF gates = 8 THEN:
        set winner to 1
        set active to 0
        broadcast "tidegate over"
  WHEN I receive "buoy struck":
    IF active = 1 THEN:
      change hull by -1
      IF hull < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "tidegate over"

SPRITE LockGate:
  SHAPE art tidegate-rush/gate
  COSTUME buoy art tidegate-rush/buoy
  SOUND lock 720
  SOUND splash 260
  WHEN flag clicked:
    hide
  WHEN I receive "start tidegate rush":
    REPEAT UNTIL active = 0:
      go to x: (pick random -1 to 1) * 110 y: 210
      IF pick random 1 to 4 = 1 THEN:
        switch costume to buoy
      ELSE:
        switch costume to costume1
      show
      REPEAT UNTIL y position < -190 or active = 0:
        change y by 0 - speed
        IF touching Foil THEN:
          IF costume name = buoy THEN:
            broadcast "buoy struck"
            play sound "splash"
          ELSE:
            broadcast "blue gate cleared"
            play sound "lock"
          hide
          set y to -220
        wait 0.02 seconds
      hide
      wait 0.25 seconds

SPRITE SurgeLock:
  SHAPE art tidegate-rush/surge
  WHEN flag clicked:
    hide
  WHEN I receive "start tidegate rush":
    REPEAT UNTIL active = 0:
      wait pick random 4 to 7 seconds
      IF active = 1 THEN:
        go to x: (pick random -1 to 1) * 110 y: 210
        show
        REPEAT UNTIL y position < -190 or active = 0:
          change y by 0 - speed
          IF touching Foil THEN:
            set surge to 3
            change charge by 25
            IF charge > 100 THEN:
              set charge to 100
            hide
            set y to -220
          wait 0.02 seconds
        hide

SPRITE TidegateResult:
  COSTUME win label "EIGHT GATES CLEARED • GREEN FLAG FOR ANOTHER RUN" #70efff
  COSTUME lose label "TIDE CLOSED OR HULL LOST • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start tidegate rush":
    hide
  WHEN I receive "tidegate over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    rink_riot: `# Blue-Line Breaker — momentum hockey built around deliberate bank shots.
# GOAL: score five goals before the 40-second horn.
# CONTROLS: Arrows skate with inertia. Touch the puck and tap Space to shoot;
# your vertical skating speed bends the shot, so moving bank shots beat the keeper.
GLOBAL goals
GLOBAL clock
GLOBAL skaterX
GLOBAL skaterY
GLOBAL vx
GLOBAL vy
GLOBAL puckLive
GLOBAL keeperY
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art blue-line-breaker/intro
  BACKDROP rink art blue-line-breaker/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable goals
    hide variable clock
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to rink
      broadcast "start blue line"

SPRITE Skater:
  SHAPE art blue-line-breaker/skater
  WHEN flag clicked:
    set goals to 0
    set clock to 40
    set skaterX to -150
    set skaterY to 0
    set vx to 0
    set vy to 0
    set active to 0
    set winner to 0
    go to x: skaterX y: skaterY
    hide
  WHEN I receive "start blue line":
    set goals to 0
    set clock to 40
    set skaterX to -150
    set skaterY to 0
    set vx to 0
    set vy to 0
    set winner to 0
    set active to 1
    go to x: skaterX y: skaterY
    show variable goals
    show variable clock
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change vx by -0.7
      IF key right arrow pressed? THEN:
        change vx by 0.7
      IF key up arrow pressed? THEN:
        change vy by 0.7
      IF key down arrow pressed? THEN:
        change vy by -0.7
      set vx to vx * 0.94
      set vy to vy * 0.94
      change skaterX by vx
      change skaterY by vy
      IF skaterX < -220 THEN:
        set skaterX to -220
      IF skaterX > 180 THEN:
        set skaterX to 180
      IF skaterY < -150 THEN:
        set skaterY to -150
      IF skaterY > 150 THEN:
        set skaterY to 150
      go to x: skaterX y: skaterY
      IF goals = 5 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "blue line over"
      IF clock < 1 THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "blue line over"
      wait 0.02 seconds
    hide
  WHEN I receive "start blue line":
    REPEAT UNTIL active = 0:
      wait 1 seconds
      change clock by -1

SPRITE Puck:
  SHAPE art blue-line-breaker/puck
  SOUND goal 880
  WHEN flag clicked:
    set puckLive to 0
    go to x: -30 y: 0
    hide
  WHEN I receive "start blue line":
    set puckLive to 0
    go to x: -30 y: 0
    show
    REPEAT UNTIL active = 0:
      IF puckLive = 0 and touching Skater and key space pressed? THEN:
        set puckLive to 1
        point in direction 90 - vy * 5
      IF puckLive = 1 THEN:
        move 11 steps
        IF y position > 165 or y position < -165 THEN:
          if on edge bounce
        IF touching Keeper THEN:
          point in direction 180 - direction
          move 14 steps
        IF touching Goal THEN:
          broadcast "blue line goal"
          set puckLive to 0
          go to x: -30 y: pick random -80 to 80
        IF x position < -235 or x position > 235 THEN:
          broadcast "blue line miss"
      wait 0.02 seconds
    hide
  WHEN I receive "blue line miss":
    IF active = 1 THEN:
      set puckLive to 0
      go to x: -30 y: 0
  WHEN I receive "blue line goal":
    IF active = 1 THEN:
      change goals by 1
      change clock by 2
      play sound "goal"

SPRITE Keeper:
  SHAPE art blue-line-breaker/keeper
  WHEN flag clicked:
    set keeperY to 0
    go to x: 185 y: keeperY
    hide
  WHEN I receive "start blue line":
    set keeperY to 0
    show
    REPEAT UNTIL active = 0:
      IF puckLive = 1 THEN:
        IF y position of Puck > keeperY THEN:
          change keeperY by 5
        IF y position of Puck < keeperY THEN:
          change keeperY by -5
      ELSE:
        change keeperY by pick random -5 to 5
      IF keeperY > 115 THEN:
        set keeperY to 115
      IF keeperY < -115 THEN:
        set keeperY to -115
      go to x: 185 y: keeperY
      wait 0.03 seconds
    hide

SPRITE Goal:
  SHAPE art blue-line-breaker/goal
  WHEN flag clicked:
    go to x: 220 y: 0
    hide
  WHEN I receive "start blue line":
    show
  WHEN I receive "blue line over":
    hide

SPRITE RinkResult:
  COSTUME win label "FIVE GOALS • GREEN FLAG FOR ANOTHER SHIFT" #8fffea
  COSTUME lose label "HORN SOUNDED • GREEN FLAG TO TRY AGAIN" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start blue line":
    hide
  WHEN I receive "blue line over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    rim_reactor: `# Orbit Hoops — a moving-basket charge-shot challenge.
# GOAL: reach fifteen points before the 45-second reactor cycle ends.
# CONTROLS: Hold Space to charge and release to launch. Left/Right adds air control.
# Clean shots through the cyan net grow the multiplier; touching the red rim resets it.
GLOBAL score
GLOBAL streak
GLOBAL charge
GLOBAL timeLeft
GLOBAL ballX
GLOBAL ballY
GLOBAL ballVX
GLOBAL ballVY
GLOBAL flying
GLOBAL hoopX
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art orbit-hoops/intro
  BACKDROP court art orbit-hoops/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable streak
    hide variable charge
    hide variable timeLeft
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to court
      broadcast "start orbit hoops"

SPRITE Ball:
  SHAPE art orbit-hoops/ball
  SOUND swish 900
  SOUND clang 190
  WHEN flag clicked:
    set score to 0
    set streak to 1
    set charge to 0
    set timeLeft to 45
    set flying to 0
    set ballX to -150
    set ballY to -125
    set active to 0
    set winner to 0
    go to x: ballX y: ballY
    hide
  WHEN I receive "start orbit hoops":
    set score to 0
    set streak to 1
    set charge to 0
    set timeLeft to 45
    set flying to 0
    set ballX to -150
    set ballY to -125
    set winner to 0
    set active to 1
    go to x: ballX y: ballY
    show variable score
    show variable streak
    show variable charge
    show variable timeLeft
    show
    wait 0.25 seconds
    REPEAT UNTIL active = 0:
      IF flying = 0 THEN:
        IF key space pressed? THEN:
          change charge by 0.7
          IF charge > 18 THEN:
            set charge to 18
        ELSE:
          IF charge > 2 THEN:
            set flying to 1
            set ballVX to charge * 0.55
            set ballVY to charge
            set charge to 0
      ELSE:
        IF key left arrow pressed? THEN:
          change ballVX by -0.08
        IF key right arrow pressed? THEN:
          change ballVX by 0.08
        change ballVY by -0.55
        change ballX by ballVX
        change ballY by ballVY
        go to x: ballX y: ballY
        turn right 12 degrees
        IF touching Net and ballVY < 0 THEN:
          broadcast "orbit swish"
          set flying to 0
          set ballX to -150
          set ballY to -125
          go to x: ballX y: ballY
        ELSE:
          IF touching Rim THEN:
            set streak to 1
            set ballVX to 0 - ballVX
            set ballVY to abs of ballVY * 0.65
            play sound "clang"
        IF ballY < -170 or ballX > 245 THEN:
          set streak to 1
          set flying to 0
          set ballX to -150
          set ballY to -125
          go to x: ballX y: ballY
      IF score > 14 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "orbit hoops over"
      IF timeLeft < 1 THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "orbit hoops over"
      wait 0.02 seconds
    hide
  WHEN I receive "start orbit hoops":
    REPEAT UNTIL active = 0:
      wait 1 seconds
      change timeLeft by -1
  WHEN I receive "orbit swish":
    IF active = 1 THEN:
      change score by 2 * streak
      change streak by 1
      play sound "swish"

SPRITE Rim:
  SHAPE art orbit-hoops/rim
  WHEN flag clicked:
    set hoopX to 110
    go to x: hoopX y: 55
    hide
  WHEN I receive "start orbit hoops":
    set hoopX to 110
    show
    REPEAT UNTIL active = 0:
      change hoopX by 3 + score / 8
      IF hoopX > 190 THEN:
        set hoopX to 40
      go to x: hoopX y: 55
      wait 0.03 seconds
    hide

SPRITE Net:
  SHAPE art orbit-hoops/net
  WHEN flag clicked:
    go to x: hoopX y: 38
    hide
  WHEN I receive "start orbit hoops":
    show
    REPEAT UNTIL active = 0:
      go to x: hoopX y: 38
      wait 0.03 seconds
    hide

SPRITE ChargeMeter:
  SHAPE art orbit-hoops/meter
  WHEN flag clicked:
    go to x: -220 y: -80
    hide
  WHEN I receive "start orbit hoops":
    show
    REPEAT UNTIL active = 0:
      set size to 20 + charge * 4
      wait 0.03 seconds
    hide

SPRITE HoopsResult:
  COSTUME win label "REACTOR ONLINE • GREEN FLAG TO SHOOT AGAIN" #8fffea
  COSTUME lose label "CYCLE ENDED • GREEN FLAG FOR ANOTHER RUN" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start orbit hoops":
    hide
  WHEN I receive "orbit hoops over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    comet_cup: `# Comet Strikers — curve-shot football with a roaming keeper.
# GOAL: score four goals before the 45-second match clock ends.
# CONTROLS: Arrows run. Touch the ball and tap Space to shoot; vertical movement curves it.
# Quick goals grow the crowd multiplier and bonus score, but every goal still counts once.
GLOBAL goals
GLOBAL score
GLOBAL matchTime
GLOBAL strikerX
GLOBAL strikerY
GLOBAL runX
GLOBAL runY
GLOBAL ballSpeed
GLOBAL crowd
GLOBAL keeperY
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art comet-strikers/intro
  BACKDROP pitch art comet-strikers/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable goals
    hide variable score
    hide variable matchTime
    hide variable crowd
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to pitch
      broadcast "start comet match"

SPRITE Striker:
  SHAPE art comet-strikers/striker
  WHEN flag clicked:
    set goals to 0
    set score to 0
    set matchTime to 45
    set crowd to 1
    set strikerX to -150
    set strikerY to 0
    set runX to 0
    set runY to 0
    set active to 0
    set winner to 0
    go to x: strikerX y: strikerY
    hide
  WHEN I receive "start comet match":
    set goals to 0
    set score to 0
    set matchTime to 45
    set crowd to 1
    set strikerX to -150
    set strikerY to 0
    set winner to 0
    set active to 1
    go to x: strikerX y: strikerY
    show variable goals
    show variable score
    show variable matchTime
    show variable crowd
    show
    REPEAT UNTIL active = 0:
      set runX to 0
      set runY to 0
      IF key left arrow pressed? THEN:
        set runX to -4
      IF key right arrow pressed? THEN:
        set runX to 4
      IF key up arrow pressed? THEN:
        set runY to 4
      IF key down arrow pressed? THEN:
        set runY to -4
      change strikerX by runX
      change strikerY by runY
      IF strikerX < -220 THEN:
        set strikerX to -220
      IF strikerX > 175 THEN:
        set strikerX to 175
      IF strikerY < -155 THEN:
        set strikerY to -155
      IF strikerY > 155 THEN:
        set strikerY to 155
      go to x: strikerX y: strikerY
      IF goals = 4 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "comet match over"
      IF matchTime < 1 THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "comet match over"
      wait 0.02 seconds
    hide
  WHEN I receive "start comet match":
    REPEAT UNTIL active = 0:
      wait 1 seconds
      change matchTime by -1

SPRITE Ball:
  SHAPE art comet-strikers/ball
  SOUND kick 520
  SOUND goal 920
  WHEN flag clicked:
    set ballSpeed to 0
    go to x: -50 y: 0
    point in direction 90
    hide
  WHEN I receive "start comet match":
    set ballSpeed to 0
    go to x: -50 y: 0
    point in direction 90
    show
    REPEAT UNTIL active = 0:
      IF touching Striker and key space pressed? and ballSpeed < 2 THEN:
        point towards CometGoal
        turn right runY * -3 degrees
        set ballSpeed to 14
        play sound "kick"
      IF ballSpeed > 0.2 THEN:
        move ballSpeed steps
        set ballSpeed to ballSpeed * 0.97
      ELSE:
        set ballSpeed to 0
      IF y position > 165 or y position < -165 THEN:
        if on edge bounce
      IF touching Keeper THEN:
        point in direction 180 - direction
        set ballSpeed to 9
        set crowd to 1
      IF touching CometGoal THEN:
        broadcast "comet goal"
        set ballSpeed to 0
        go to x: -50 y: pick random -80 to 80
      IF x position < -235 or x position > 235 THEN:
        broadcast "comet miss"
      wait 0.02 seconds
    hide
  WHEN I receive "comet miss":
    IF active = 1 THEN:
      set ballSpeed to 0
      set crowd to 1
      go to x: -50 y: 0
  WHEN I receive "comet goal":
    IF active = 1 THEN:
      change goals by 1
      change score by crowd * 10
      change crowd by 1
      change matchTime by 2
      play sound "goal"

SPRITE Keeper:
  SHAPE art comet-strikers/keeper
  WHEN flag clicked:
    set keeperY to 0
    go to x: 182 y: keeperY
    hide
  WHEN I receive "start comet match":
    set keeperY to 0
    show
    REPEAT UNTIL active = 0:
      IF Ball y position > keeperY THEN:
        change keeperY by 3 + goals / 3
      ELSE:
        change keeperY by 0 - 3 - goals / 3
      IF keeperY > 118 THEN:
        set keeperY to 118
      IF keeperY < -118 THEN:
        set keeperY to -118
      go to x: 182 y: keeperY
      wait 0.03 seconds
    hide

SPRITE CometGoal:
  SHAPE art comet-strikers/goal
  WHEN flag clicked:
    go to x: 220 y: 0
    hide
  WHEN I receive "start comet match":
    show
  WHEN I receive "comet match over":
    hide

SPRITE CometResult:
  COSTUME win label "FOUR GOALS • GREEN FLAG FOR ANOTHER MATCH" #8fffea
  COSTUME lose label "FULL TIME • GREEN FLAG FOR A REMATCH" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start comet match":
    hide
  WHEN I receive "comet match over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    trench_signal: `# Echo Trench — a submarine salvage run with a sonar-defense rhythm.
# GOAL: recover three cyan signal pearls before oxygen, hull, or the hunter mine wins.
# CONTROLS: Up adds buoyancy, Down dives, Left/Right steer. Space emits a sonar shove.
# Sonar needs 1.2 seconds to recharge; each pearl restores oxygen but speeds up the mine.
GLOBAL pearls
GLOBAL hull
GLOBAL oxygen
GLOBAL subX
GLOBAL subY
GLOBAL rise
GLOBAL current
GLOBAL mineSpeed
GLOBAL pulseOn
GLOBAL pulseReady
GLOBAL started
GLOBAL active
GLOBAL mineStun
GLOBAL winner

STAGE:
  BACKDROP intro art echo-trench/intro
  BACKDROP trench art echo-trench/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable pearls
    hide variable hull
    hide variable oxygen
    hide variable pulseReady
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      switch backdrop to trench
      broadcast "start echo trench"

SPRITE Sub:
  SHAPE art echo-trench/sub
  COSTUME dive art echo-trench/sub-dive
  SOUND sonar 680
  WHEN flag clicked:
    set pearls to 0
    set hull to 3
    set oxygen to 40
    set subX to -150
    set subY to 60
    set rise to 0
    set current to 0
    set mineSpeed to 2
    set pulseOn to 0
    set pulseReady to 0
    set mineStun to 0
    set winner to 0
    set active to 0
    go to x: subX y: subY
    hide
  WHEN I receive "start echo trench":
    set pearls to 0
    set hull to 3
    set oxygen to 40
    set subX to -150
    set subY to 60
    set rise to 0
    set mineSpeed to 2
    set mineStun to 0
    set winner to 0
    set active to 1
    show variable pearls
    show variable hull
    show variable oxygen
    show variable pulseReady
    show
    wait 0.25 seconds
    set pulseReady to 1
    REPEAT UNTIL active = 0:
      change rise by 0.08
      IF key up arrow pressed? THEN:
        change rise by 0.35
      IF key down arrow pressed? THEN:
        change rise by -0.48
        switch costume to dive
      ELSE:
        switch costume to costume1
      set rise to rise * 0.94
      IF key left arrow pressed? THEN:
        change subX by -4
      IF key right arrow pressed? THEN:
        change subX by 4
      set current to sin of oxygen * 1.2
      change subX by current
      change subY by rise
      IF subX < -220 THEN:
        set subX to -220
      IF subX > 220 THEN:
        set subX to 220
      IF subY > 155 THEN:
        set subY to 155
        set rise to -1
      IF subY < -155 THEN:
        set subY to -155
        set rise to 2
        change hull by -1
      go to x: subX y: subY
      IF active = 1 and pearls > 2 THEN:
        set winner to 1
        set active to 0
        set started to 0
        broadcast "echo trench over"
      IF active = 1 and (hull < 1 or oxygen < 1) THEN:
        set winner to 0
        set active to 0
        set started to 0
        broadcast "echo trench over"
      wait 0.02 seconds
    hide
  WHEN I receive "start echo trench":
    REPEAT UNTIL active = 0:
      wait 1 seconds
      change oxygen by -1
  WHEN space key pressed:
    IF started = 1 and pulseReady = 1 THEN:
      set pulseReady to 0
      set pulseOn to 1
      play sound "sonar"
      broadcast "sonar pulse"
      wait 0.35 seconds
      set pulseOn to 0
      wait 0.85 seconds
      set pulseReady to 1

SPRITE SignalPearl:
  SHAPE art echo-trench/pearl
  SOUND found 980
  WHEN flag clicked:
    go to x: pick random -170 to 190 y: pick random -125 to 125
    hide
  WHEN I receive "start echo trench":
    show
    REPEAT UNTIL active = 0:
      change y by sin of oxygen * 0.4
      IF touching Sub THEN:
        broadcast "signal pearl recovered"
        wait until not touching Sub
      wait 0.03 seconds
    hide
  WHEN I receive "signal pearl recovered":
    IF active = 1 THEN:
      change pearls by 1
      change oxygen by 7
      change mineSpeed by 0.7
      play sound "found"
      go to x: pick random -190 to 190 y: pick random -130 to 130

SPRITE HunterMine:
  SHAPE art echo-trench/mine
  WHEN flag clicked:
    go to x: 190 y: -110
    hide
  WHEN I receive "start echo trench":
    set mineStun to 0
    go to x: 190 y: -110
    show
    REPEAT UNTIL active = 0:
      IF mineStun > 0 THEN:
        change mineStun by -0.03
        turn right 12 degrees
      ELSE:
        point towards Sub
        move mineSpeed steps
      IF touching Sub THEN:
        change hull by -1
        go to x: pick random 130 to 210 y: pick random -130 to 130
        wait 0.8 seconds
      wait 0.03 seconds
    hide
  WHEN I receive "sonar pulse":
    IF active = 1 and distance to Sub < 150 THEN:
      point towards Sub
      turn right 180 degrees
      move 90 steps
      set mineStun to 0.7

SPRITE SonarRing:
  SHAPE art echo-trench/ring
  WHEN flag clicked:
    hide
  WHEN I receive "sonar pulse":
    go to Sub
    set size to 20
    show
    REPEAT 8:
      change size by 22
      change ghost effect by 10
      wait 0.03 seconds
    clear graphic effects
    hide

SPRITE TrenchResult:
  COSTUME win label "3 SIGNAL PEARLS RECOVERED • GREEN FLAG TO DIVE AGAIN" #7ff6ff
  COSTUME lose label "OXYGEN OR HULL FAILED • GREEN FLAG TO RETRY" #ff8fa5
  WHEN flag clicked:
    go to x: 0 y: -20
    hide
  WHEN I receive "start echo trench":
    hide
  WHEN I receive "echo trench over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    whisker_switch: `# Whisker Relay — a risky pantry courier run, distinct from Pantry Prowl.
# GOAL: bank six moon-cheeses by carrying them to the highlighted opposite mouse hole.
# CONTROLS: Arrows move. Space spends one carried cheese on a fast horizontal dash.
# Cheese creates scent, safe holes clear it, and each delivery swaps the destination.
GLOBAL cargo
GLOBAL banked
GLOBAL lives
GLOBAL scent
GLOBAL mouseX
GLOBAL mouseY
GLOBAL catSpeed
GLOBAL hidden
GLOBAL targetHole
GLOBAL dashX
GLOBAL dashY
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art whisker-relay/intro
  BACKDROP pantry art whisker-relay/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable cargo
    hide variable banked
    hide variable lives
    hide variable scent
    hide variable targetHole
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set cargo to 0
      set banked to 0
      set lives to 3
      set scent to 0
      set catSpeed to 2
      set hidden to 0
      set targetHole to 1
      set dashX to 1
      set dashY to 0
      set mouseX to -160
      set mouseY to -100
      set winner to 0
      set active to 1
      switch backdrop to pantry
      broadcast "start whisker relay"

SPRITE Pip:
  SHAPE art whisker-relay/mouse
  COSTUME dash art whisker-relay/dash
  SOUND squeak 760
  WHEN flag clicked:
    set cargo to 0
    set banked to 0
    set lives to 3
    set scent to 0
    set catSpeed to 2
    set hidden to 0
    set targetHole to 1
    set dashX to 1
    set dashY to 0
    set mouseX to -160
    set mouseY to -100
    set active to 0
    set winner to 0
    go to x: mouseX y: mouseY
    hide
  WHEN I receive "start whisker relay":
    show variable cargo
    show variable banked
    show variable lives
    show variable scent
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change mouseX by -4
        set dashX to -1
        set dashY to 0
        change scent by 0.12
      IF key right arrow pressed? THEN:
        change mouseX by 4
        set dashX to 1
        set dashY to 0
        change scent by 0.12
      IF key up arrow pressed? THEN:
        change mouseY by 4
        set dashX to 0
        set dashY to 1
        change scent by 0.12
      IF key down arrow pressed? THEN:
        change mouseY by -4
        set dashX to 0
        set dashY to -1
        change scent by 0.12
      IF mouseX < -220 THEN:
        set mouseX to -220
      IF mouseX > 220 THEN:
        set mouseX to 220
      IF mouseY < -155 THEN:
        set mouseY to -155
      IF mouseY > 155 THEN:
        set mouseY to 155
      go to x: mouseX y: mouseY
      set hidden to 0
      IF touching LeftHole or touching RightHole THEN:
        set hidden to 1
        set scent to 0
      IF touching RightHole and targetHole = 1 and cargo > 0 THEN:
        broadcast "relay delivery"
      IF touching LeftHole and targetHole = -1 and cargo > 0 THEN:
        broadcast "relay delivery"
      IF scent > 0 THEN:
        change scent by -0.03
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and cargo > 0 THEN:
      change mouseX by dashX * 55
      change mouseY by dashY * 55
      change cargo by -1
      set scent to 0
      switch costume to dash
      wait 0.15 seconds
      switch costume to costume1
  WHEN I receive "relay delivery":
    IF active = 1 THEN:
      change banked by cargo
      set cargo to 0
      IF targetHole = 1 THEN:
        set targetHole to -1
      ELSE:
        set targetHole to 1
      IF banked > 5 THEN:
        set winner to 1
        set active to 0
        broadcast "whisker relay over"
  WHEN I receive "relay caught":
    IF active = 1 THEN:
      change lives by -1
      set cargo to 0
      set scent to 0
      set mouseX to -160
      set mouseY to -100
      IF lives < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "whisker relay over"

SPRITE CheeseMoon:
  SHAPE art whisker-relay/cheese
  SOUND crumb 1040
  WHEN flag clicked:
    go to x: pick random -180 to 180 y: pick random -130 to 130
    hide
  WHEN I receive "start whisker relay":
    show
    REPEAT UNTIL active = 0:
      turn right 4 degrees
      IF touching Pip THEN:
        change cargo by 1
        change scent by 3
        change catSpeed by 0.18
        play sound "crumb"
        go to x: pick random -190 to 190 y: pick random -135 to 135
      wait 0.03 seconds
    hide

SPRITE Marmalade:
  SHAPE art whisker-relay/cat
  SOUND pounce 180
  WHEN flag clicked:
    go to x: 170 y: 110
    hide
  WHEN I receive "start whisker relay":
    show
    REPEAT UNTIL active = 0:
      IF hidden = 0 and scent > 0.8 THEN:
        point towards Pip
        move catSpeed + scent / 5 steps
      ELSE:
        turn right pick random -20 to 20 degrees
        move 1.5 steps
        if on edge bounce
      IF touching Pip and hidden = 0 THEN:
        broadcast "relay caught"
        go to x: 170 y: 110
        play sound "pounce"
        wait 1 seconds
      wait 0.03 seconds
    hide

SPRITE LeftHole:
  SHAPE art whisker-relay/hole-left
  COSTUME active art whisker-relay/hole-active
  WHEN flag clicked:
    go to x: -205 y: 125
    hide
  WHEN I receive "start whisker relay":
    show
    REPEAT UNTIL active = 0:
      IF targetHole = -1 THEN:
        switch costume to active
      ELSE:
        switch costume to costume1
      wait 0.05 seconds
    hide

SPRITE RightHole:
  SHAPE art whisker-relay/hole-right
  COSTUME active art whisker-relay/hole-active
  WHEN flag clicked:
    go to x: 205 y: -125
    hide
  WHEN I receive "start whisker relay":
    show
    REPEAT UNTIL active = 0:
      IF targetHole = 1 THEN:
        switch costume to active
      ELSE:
        switch costume to costume1
      wait 0.05 seconds
    hide

SPRITE WhiskerResult:
  COSTUME win label "SIX CHEESES BANKED • GREEN FLAG FOR ANOTHER RELAY" #ffe66d
  COSTUME lose label "MARMALADE CAUGHT PIP THREE TIMES • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start whisker relay":
    hide
  WHEN I receive "whisker relay over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    spiral_circuit: `# Helix Rush — a finite five-lane tube sprint with phase-boost decisions.
# GOAL: survive thirty sectors with at least one life remaining.
# CONTROLS: Left/Right wraps around five lanes. Space spends charge to phase-boost.
# Yellow cells charge boost; magenta gates pay a jackpot only while boosting.
GLOBAL score
GLOBAL sectors
GLOBAL lives
GLOBAL lane
GLOBAL speed
GLOBAL charge
GLOBAL boosting
GLOBAL obstacleLane
GLOBAL obstacleY
GLOBAL obstacleKind
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art helix-rush/intro
  BACKDROP tube art helix-rush/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable sectors
    hide variable lives
    hide variable charge
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set sectors to 0
      set lives to 3
      set lane to 0
      set speed to 5
      set charge to 0
      set boosting to 0
      set winner to 0
      set active to 1
      switch backdrop to tube
      broadcast "start helix rush"

SPRITE Runner:
  SHAPE art helix-rush/runner
  COSTUME phase art helix-rush/phase
  SOUND boost 760
  WHEN flag clicked:
    set score to 0
    set sectors to 0
    set lives to 3
    set lane to 0
    set speed to 5
    set charge to 0
    set boosting to 0
    set active to 0
    set winner to 0
    go to x: 0 y: -125
    hide
  WHEN I receive "start helix rush":
    show variable score
    show variable sectors
    show variable lives
    show variable charge
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change lane by -1
        wait 0.1 seconds
      IF key right arrow pressed? THEN:
        change lane by 1
        wait 0.1 seconds
      IF lane < -2 THEN:
        set lane to 2
      IF lane > 2 THEN:
        set lane to -2
      glide 0.07 secs to x: lane * 82 y: -125
      IF boosting = 1 THEN:
        switch costume to phase
        set speed to 9
        change charge by -0.22
        change score by 0.2
        IF charge < 1 THEN:
          set boosting to 0
      ELSE:
        switch costume to costume1
        set speed to 5
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and charge > 4 and boosting = 0 THEN:
      set boosting to 1
      play sound "boost"
  WHEN I receive "helix hit":
    IF active = 1 THEN:
      change lives by -1
      IF lives < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "helix rush over"
  WHEN I receive "helix sector cleared":
    IF active = 1 THEN:
      change sectors by 1
      change score by 1
      IF sectors = 30 THEN:
        set winner to 1
        set active to 0
        broadcast "helix rush over"

SPRITE TubeHazard:
  SHAPE art helix-rush/hazard
  COSTUME cell art helix-rush/cell
  COSTUME gate art helix-rush/gate
  SOUND hit 170
  SOUND jackpot 1020
  WHEN flag clicked:
    hide
  WHEN I receive "start helix rush":
    REPEAT UNTIL active = 0:
      set obstacleLane to pick random -2 to 2
      set obstacleY to 190
      set obstacleKind to pick random 1 to 7
      IF obstacleKind < 5 THEN:
        switch costume to costume1
      ELSE:
        IF obstacleKind < 7 THEN:
          switch costume to cell
        ELSE:
          switch costume to gate
      go to x: obstacleLane * 82 y: obstacleY
      show
      REPEAT UNTIL y position < -190 or active = 0:
        change y by 0 - speed
        turn right 5 degrees
        IF touching Runner THEN:
          IF obstacleKind < 5 THEN:
            IF boosting = 0 THEN:
              broadcast "helix hit"
              play sound "hit"
            ELSE:
              change score by 3
          ELSE:
            IF obstacleKind < 7 THEN:
              change charge by 4
              change score by 2
            ELSE:
              IF boosting = 1 THEN:
                change score by 25
                change charge by 3
                play sound "jackpot"
              ELSE:
                change score by 5
          hide
          set y to -220
        wait 0.02 seconds
      hide
      IF active = 1 THEN:
        broadcast "helix sector cleared"
        wait 0.15 seconds

SPRITE TubeCore:
  SHAPE art helix-rush/core
  WHEN flag clicked:
    go to x: 0 y: 0
    set ghost effect to 70
    hide
  WHEN I receive "start helix rush":
    show
    REPEAT UNTIL active = 0:
      turn right speed degrees
      wait 0.03 seconds
    hide

SPRITE HelixResult:
  COSTUME win label "THIRTY SECTORS CLEARED • GREEN FLAG FOR ANOTHER RUN" #ffe66d
  COSTUME lose label "TUBE FAILURE • GREEN FLAG TO RESTART" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start helix rush":
    hide
  WHEN I receive "helix rush over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    lilyway_rescue: `# Moonbank Hop — a finite road-and-river crossing challenge.
# GOAL: reach the moon bank three times before three crashes or splashes.
# CONTROLS: Arrow keys hop one square. Cars hurt; river squares require a lily beneath you.
# Each successful crossing makes traffic faster, then returns the frog to the start.
GLOBAL crossings
GLOBAL hearts
GLOBAL frogX
GLOBAL frogY
GLOBAL traffic
GLOBAL riding
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art moonbank-hop/intro
  BACKDROP route art moonbank-hop/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable crossings
    hide variable hearts
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set crossings to 0
      set hearts to 3
      set traffic to 4
      set frogX to 0
      set frogY to -150
      set riding to 0
      set winner to 0
      set active to 1
      switch backdrop to route
      broadcast "start moonbank hop"

SPRITE Juniper:
  SHAPE art moonbank-hop/frog
  SOUND hop 620
  SOUND splash 190
  WHEN flag clicked:
    set crossings to 0
    set hearts to 3
    set traffic to 4
    set frogX to 0
    set frogY to -150
    set riding to 0
    set active to 0
    set winner to 0
    go to x: frogX y: frogY
    hide
  WHEN I receive "start moonbank hop":
    show variable crossings
    show variable hearts
    show
  WHEN left arrow key pressed:
    IF active = 1 THEN:
      change frogX by -45
      play sound "hop"
  WHEN right arrow key pressed:
    IF active = 1 THEN:
      change frogX by 45
      play sound "hop"
  WHEN up arrow key pressed:
    IF active = 1 THEN:
      change frogY by 45
      play sound "hop"
  WHEN down arrow key pressed:
    IF active = 1 THEN:
      change frogY by -45
      play sound "hop"
  WHEN I receive "start moonbank hop":
    REPEAT UNTIL active = 0:
      IF frogX < -215 THEN:
        set frogX to -215
      IF frogX > 215 THEN:
        set frogX to 215
      IF frogY < -150 THEN:
        set frogY to -150
      go to x: frogX y: frogY
      IF frogY > -70 and frogY < 45 THEN:
        IF touching CarA or touching CarB THEN:
          broadcast "frog hurt"
      IF frogY > 45 and frogY < 140 THEN:
        set riding to 0
        IF touching LilyA or touching LilyB THEN:
          set riding to 1
        IF riding = 0 THEN:
          play sound "splash"
          broadcast "frog hurt"
      IF frogY > 145 THEN:
        broadcast "moonbank crossed"
      wait 0.03 seconds
    hide
  WHEN I receive "moonbank crossed":
    IF active = 1 THEN:
      change crossings by 1
      change traffic by 0.7
      IF crossings = 3 THEN:
        set winner to 1
        set active to 0
        broadcast "moonbank over"
      ELSE:
        broadcast "frog reset"
  WHEN I receive "frog hurt":
    IF active = 1 THEN:
      change hearts by -1
      IF hearts < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "moonbank over"
      ELSE:
        broadcast "frog reset"
  WHEN I receive "frog reset":
    set frogX to 0
    set frogY to -150
    go to x: frogX y: frogY
    wait 0.45 seconds

SPRITE CarA:
  SHAPE art moonbank-hop/car-red
  WHEN flag clicked:
    go to x: -230 y: -25
    hide
  WHEN I receive "start moonbank hop":
    show
    REPEAT UNTIL active = 0:
      change x by traffic
      IF x position > 240 THEN:
        set x to -240
      wait 0.02 seconds
    hide

SPRITE CarB:
  SHAPE art moonbank-hop/car-gold
  WHEN flag clicked:
    go to x: 230 y: -65
    hide
  WHEN I receive "start moonbank hop":
    show
    REPEAT UNTIL active = 0:
      change x by 0 - traffic - 1
      IF x position < -240 THEN:
        set x to 240
      wait 0.02 seconds
    hide

SPRITE LilyA:
  SHAPE art moonbank-hop/lily-a
  WHEN flag clicked:
    go to x: -180 y: 75
    hide
  WHEN I receive "start moonbank hop":
    show
    REPEAT UNTIL active = 0:
      change x by 2.4
      IF touching Juniper THEN:
        change frogX by 2.4
      IF x position > 240 THEN:
        set x to -240
      wait 0.02 seconds
    hide

SPRITE LilyB:
  SHAPE art moonbank-hop/lily-b
  WHEN flag clicked:
    go to x: 180 y: 120
    hide
  WHEN I receive "start moonbank hop":
    show
    REPEAT UNTIL active = 0:
      change x by -2
      IF touching Juniper THEN:
        change frogX by -2
      IF x position < -240 THEN:
        set x to 240
      wait 0.02 seconds
    hide

SPRITE MoonbankResult:
  COSTUME win label "THREE MOONBANK RUNS • GREEN FLAG TO CROSS AGAIN" #b8ff79
  COSTUME lose label "THREE CRASHES OR SPLASHES • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start moonbank hop":
    hide
  WHEN I receive "moonbank over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    rotor_rogue: `# Crosswind Courier — balance a rotor-bike across forty cloud-road kilometres.
# GOAL: reach distance forty before three crashes.
# CONTROLS: Up spends fuel to accelerate, Down brakes, Left/Right counter-steer, Space jumps.
# Level landings add stunt score and refill fuel; wind strengthens with speed.
GLOBAL score
GLOBAL distance
GLOBAL lives
GLOBAL speed
GLOBAL tilt
GLOBAL wind
GLOBAL bikeY
GLOBAL lift
GLOBAL airborne
GLOBAL fuel
GLOBAL jumpReady
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art crosswind-courier/intro
  BACKDROP skyroad art crosswind-courier/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable distance
    hide variable lives
    hide variable speed
    hide variable fuel
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set distance to 0
      set lives to 3
      set speed to 4
      set tilt to 0
      set wind to 0
      set bikeY to -120
      set lift to 0
      set airborne to 0
      set fuel to 12
      set jumpReady to 0
      set winner to 0
      set active to 1
      switch backdrop to skyroad
      broadcast "start crosswind courier"

SPRITE GyroBike:
  SHAPE art crosswind-courier/bike
  COSTUME jump art crosswind-courier/jump
  SOUND rev 440
  SOUND crash 150
  WHEN flag clicked:
    set score to 0
    set distance to 0
    set lives to 3
    set speed to 4
    set tilt to 0
    set wind to 0
    set bikeY to -120
    set lift to 0
    set airborne to 0
    set fuel to 12
    set jumpReady to 0
    set active to 0
    set winner to 0
    go to x: 0 y: bikeY
    hide
  WHEN I receive "start crosswind courier":
    show variable score
    show variable distance
    show variable lives
    show variable speed
    show variable fuel
    show
    wait 0.2 seconds
    set jumpReady to 1
    REPEAT UNTIL active = 0:
      IF key up arrow pressed? and fuel > 0 THEN:
        change speed by 0.08
        change fuel by -0.025
      IF key down arrow pressed? THEN:
        change speed by -0.12
      IF speed < 3 THEN:
        set speed to 3
      IF speed > 11 THEN:
        set speed to 11
      set wind to sin of distance * speed / 8
      change tilt by wind
      IF key left arrow pressed? THEN:
        change tilt by -1.8
      IF key right arrow pressed? THEN:
        change tilt by 1.8
      set tilt to tilt * 0.96
      point in direction 90 + tilt
      IF airborne = 1 THEN:
        switch costume to jump
        change lift by -0.7
        change bikeY by lift
        change score by 0.12
        IF bikeY < -120 THEN:
          set bikeY to -120
          set airborne to 0
          set lift to 0
          IF abs of tilt < 14 THEN:
            change score by 8
            change fuel by 3
          ELSE:
            change lives by -1
            set tilt to 0
      ELSE:
        switch costume to costume1
      go to x: 0 y: bikeY
      IF abs of tilt > 48 THEN:
        change lives by -1
        set tilt to 0
        set speed to 4
        play sound "crash"
        wait 0.7 seconds
      change distance by speed / 180
      IF distance > 39 THEN:
        broadcast "crosswind delivered"
      IF lives < 1 THEN:
        broadcast "crosswind failed"
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and jumpReady = 1 and airborne = 0 THEN:
      set airborne to 1
      set lift to 11
      play sound "rev"
  WHEN I receive "crosswind delivered":
    IF active = 1 THEN:
      set winner to 1
      set active to 0
      broadcast "crosswind over"
  WHEN I receive "crosswind failed":
    IF active = 1 THEN:
      set winner to 0
      set active to 0
      broadcast "crosswind over"

SPRITE Barrier:
  SHAPE art crosswind-courier/barrier
  WHEN flag clicked:
    hide
  WHEN I receive "start crosswind courier":
    REPEAT UNTIL active = 0:
      go to x: 220 y: -120
      show
      REPEAT UNTIL x position < -240 or active = 0:
        change x by 0 - speed
        IF touching GyroBike and airborne = 0 THEN:
          change lives by -1
          set tilt to 24
          hide
          set x to -250
        wait 0.02 seconds
      hide
      wait pick random 1 to 3 seconds

SPRITE SkyRoad:
  SHAPE art crosswind-courier/road
  WHEN flag clicked:
    go to x: 0 y: -145
    hide
  WHEN I receive "start crosswind courier":
    show
    REPEAT UNTIL active = 0:
      change color effect by speed
      wait 0.04 seconds
    hide

SPRITE CrosswindResult:
  COSTUME win label "FORTY KILOMETRES DELIVERED • GREEN FLAG TO RIDE AGAIN" #ffe66d
  COSTUME lose label "THREE CRASHES • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start crosswind courier":
    hide
  WHEN I receive "crosswind over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    prism_spire: `# Lumen Stack — a twelve-floor precision tower challenge.
# GOAL: build twelve floors before three complete misses.
# CONTROLS: Tap Space to drop the sweeping floor. Only its overlap survives.
# Near-centre drops build a perfect combo; off-centre drops permanently narrow the tower.
GLOBAL score
GLOBAL misses
GLOBAL level
GLOBAL blockX
GLOBAL towerX
GLOBAL blockWidth
GLOBAL sweep
GLOBAL sweepDir
GLOBAL perfect
GLOBAL landingY
GLOBAL dropReady
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art lumen-stack/intro
  BACKDROP skyline art lumen-stack/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable misses
    hide variable level
    hide variable perfect
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set misses to 0
      set level to 0
      set blockX to -170
      set towerX to 0
      set blockWidth to 100
      set sweep to 4
      set sweepDir to 1
      set perfect to 0
      set landingY to -135
      set dropReady to 0
      set winner to 0
      set active to 1
      switch backdrop to skyline
      broadcast "start lumen stack"

SPRITE CraneBlock:
  SHAPE art lumen-stack/block
  COSTUME hot art lumen-stack/hot
  SOUND land 620
  SOUND miss 150
  WHEN flag clicked:
    set score to 0
    set misses to 0
    set level to 0
    set blockX to -170
    set towerX to 0
    set blockWidth to 100
    set sweep to 4
    set sweepDir to 1
    set perfect to 0
    set landingY to -135
    set dropReady to 0
    set active to 0
    set winner to 0
    go to x: blockX y: 120
    hide
  WHEN I receive "start lumen stack":
    show variable score
    show variable misses
    show variable level
    show variable perfect
    show
    wait 0.2 seconds
    set dropReady to 1
    REPEAT UNTIL active = 0:
      change blockX by sweep * sweepDir
      IF blockX > 190 THEN:
        set sweepDir to -1
      IF blockX < -190 THEN:
        set sweepDir to 1
      go to x: blockX y: 120
      set size to blockWidth
      IF perfect > 2 THEN:
        switch costume to hot
      ELSE:
        switch costume to costume1
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and dropReady = 1 THEN:
      broadcast "drop floor" and wait
  WHEN I receive "drop floor":
    IF active = 1 and (abs of (blockX - towerX)) < blockWidth THEN:
      IF (abs of (blockX - towerX)) < 8 THEN:
        change perfect by 1
        change score by 5 * perfect
      ELSE:
        set perfect to 0
      change blockWidth by 0 - (abs of (blockX - towerX))
      IF blockWidth < 22 THEN:
        set blockWidth to 22
      set towerX to (towerX + blockX) / 2
      change level by 1
      change score by level
      set landingY to -135 + level * 20
      broadcast "freeze floor"
      play sound "land"
      change sweep by 0.25
      IF level = 12 THEN:
        set winner to 1
        set active to 0
        broadcast "lumen stack over"
    ELSE:
      change misses by 1
      set perfect to 0
      play sound "miss"
      IF misses > 2 THEN:
        set winner to 0
        set active to 0
        broadcast "lumen stack over"
    set blockX to -190

SPRITE FrozenFloor:
  SHAPE art lumen-stack/floor
  WHEN flag clicked:
    hide
  WHEN I receive "freeze floor":
    go to x: towerX y: landingY
    set size to blockWidth
    create clone of myself
  WHEN I start as a clone:
    change color effect by level * 13
    show

SPRITE Foundation:
  SHAPE art lumen-stack/foundation
  WHEN flag clicked:
    go to x: 0 y: -145
    hide
  WHEN I receive "start lumen stack":
    show
  WHEN I receive "lumen stack over":
    hide

SPRITE LumenResult:
  COSTUME win label "TWELVE FLOORS COMPLETE • GREEN FLAG TO BUILD AGAIN" #ffe66d
  COSTUME lose label "THREE MISSES • GREEN FLAG TO REBUILD" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start lumen stack":
    hide
  WHEN I receive "lumen stack over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    shard_sheriff: `# Plasma Posse — a four-wave split-orb arena.
# GOAL: clear four plasma waves before three collisions.
# CONTROLS: Left/Right move. Space fires one vertical lance.
# Each large orb must be reduced, then both the core and its fast gold shard must be popped.
GLOBAL score
GLOBAL hearts
GLOBAL waves
GLOBAL sheriffX
GLOBAL orbX
GLOBAL orbY
GLOBAL orbVX
GLOBAL orbVY
GLOBAL orbTier
GLOBAL shardOn
GLOBAL shardX
GLOBAL shardY
GLOBAL shardVX
GLOBAL shardVY
GLOBAL lanceOn
GLOBAL orbActive
GLOBAL fireReady
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art plasma-posse/intro
  BACKDROP arena art plasma-posse/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable hearts
    hide variable waves
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set hearts to 3
      set waves to 0
      set sheriffX to 0
      set shardOn to 0
      set lanceOn to 0
      set fireReady to 0
      set orbX to 120
      set orbY to 80
      set orbVX to -3
      set orbVY to 4
      set orbTier to 3
      set orbActive to 1
      set winner to 0
      set active to 1
      switch backdrop to arena
      broadcast "start plasma posse"

SPRITE Sheriff:
  SHAPE art plasma-posse/sheriff
  WHEN flag clicked:
    set score to 0
    set hearts to 3
    set waves to 0
    set sheriffX to 0
    set shardOn to 0
    set lanceOn to 0
    set fireReady to 0
    set active to 0
    set winner to 0
    go to x: sheriffX y: -135
    hide
  WHEN I receive "start plasma posse":
    show variable score
    show variable hearts
    show variable waves
    show
    wait 0.2 seconds
    set fireReady to 1
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change sheriffX by -5
      IF key right arrow pressed? THEN:
        change sheriffX by 5
      IF sheriffX < -215 THEN:
        set sheriffX to -215
      IF sheriffX > 215 THEN:
        set sheriffX to 215
      go to x: sheriffX y: -135
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and fireReady = 1 and lanceOn = 0 THEN:
      set lanceOn to 1
      broadcast "fire lance"
  WHEN I receive "posse hit":
    IF active = 1 THEN:
      change hearts by -1
      IF hearts < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "plasma posse over"
  WHEN I receive "plasma wave cleared":
    IF active = 1 THEN:
      change waves by 1
      IF waves = 4 THEN:
        set winner to 1
        set active to 0
        broadcast "plasma posse over"
      ELSE:
        set orbTier to 3
        set orbX to pick random -170 to 170
        set orbY to 140
        set orbVX to pick random 3 to 5
        set orbVY to 5
        set orbActive to 1

SPRITE PlasmaOrb:
  SHAPE art plasma-posse/orb
  SOUND split 780
  SOUND pop 1040
  WHEN flag clicked:
    set orbX to 120
    set orbY to 80
    set orbVX to -3
    set orbVY to 4
    set orbTier to 3
    set orbActive to 1
    go to x: orbX y: orbY
    hide
  WHEN I receive "start plasma posse":
    show
    REPEAT UNTIL active = 0:
      IF orbActive = 1 THEN:
        show
        change orbVY by -0.38
        change orbX by orbVX
        change orbY by orbVY
        IF orbX > 220 or orbX < -220 THEN:
          set orbVX to 0 - orbVX
        IF orbY < -105 THEN:
          set orbY to -105
          set orbVY to 8 + orbTier
        go to x: orbX y: orbY
        set size to 35 + orbTier * 18
        IF touching Lance and lanceOn = 1 THEN:
          change score by 5
          change orbTier by -1
          IF orbTier = 2 THEN:
            set shardOn to 1
            set shardX to orbX
            set shardY to orbY
            set shardVX to 5
            set shardVY to 7
            play sound "split"
          IF orbTier < 1 THEN:
            change score by 15
            set orbActive to 0
            hide
            play sound "pop"
          set lanceOn to 0
        IF touching Sheriff THEN:
          broadcast "posse hit"
          set orbX to 150
          set orbY to 100
          set orbVY to 5
          wait 0.7 seconds
      ELSE:
        hide
        IF shardOn = 0 and waves < 4 THEN:
          set orbActive to -1
          broadcast "plasma wave cleared"
      wait 0.02 seconds
    hide

SPRITE Shard:
  SHAPE art plasma-posse/shard
  WHEN flag clicked:
    hide
  WHEN I receive "start plasma posse":
    REPEAT UNTIL active = 0:
      IF shardOn = 1 THEN:
        show
        change shardVY by -0.5
        change shardX by shardVX
        change shardY by shardVY
        IF shardX > 225 or shardX < -225 THEN:
          set shardVX to 0 - shardVX
        IF shardY < -112 THEN:
          set shardY to -112
          set shardVY to 9
        go to x: shardX y: shardY
        IF touching Lance and lanceOn = 1 THEN:
          set shardOn to 0
          set lanceOn to 0
          change score by 12
          hide
        IF touching Sheriff THEN:
          broadcast "posse hit"
          set shardOn to 0
          hide
      ELSE:
        hide
      wait 0.02 seconds
    hide

SPRITE Lance:
  SHAPE art plasma-posse/lance
  WHEN flag clicked:
    hide
  WHEN I receive "fire lance":
    go to x: sheriffX y: -105
    show
    REPEAT UNTIL y position > 180 or lanceOn = 0 or active = 0:
      change y by 14
      wait 0.02 seconds
    hide
    set lanceOn to 0

SPRITE PlasmaResult:
  COSTUME win label "FOUR SPLIT-ORB WAVES CLEARED • GREEN FLAG FOR ANOTHER POSSE" #ffe66d
  COSTUME lose label "THREE COLLISIONS • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start plasma posse":
    hide
  WHEN I receive "plasma posse over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    halo_foundry: `# Halo Lockdown — circular paddle defense fused with a three-ring lock break.
# GOAL: clear all four inner locks across three increasingly fast rings before three escapes.
# CONTROLS: Left/Right rotate the cyan shield around the halo.
# Rebound the gold core inward; letting it reach the outer edge costs one life.
GLOBAL score
GLOBAL lives
GLOBAL round
GLOBAL shieldAngle
GLOBAL shieldX
GLOBAL shieldY
GLOBAL coreSpeed
GLOBAL locks
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art halo-lockdown/intro
  BACKDROP reactor art halo-lockdown/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable score
    hide variable lives
    hide variable round
    hide variable locks
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set score to 0
      set lives to 3
      set round to 1
      set locks to 4
      set shieldAngle to 0
      set coreSpeed to 5
      set winner to 0
      set active to 1
      switch backdrop to reactor
      broadcast "start halo lockdown"

SPRITE HaloShield:
  SHAPE art halo-lockdown/shield
  WHEN flag clicked:
    set score to 0
    set lives to 3
    set round to 1
    set locks to 4
    set shieldAngle to 0
    set coreSpeed to 5
    set active to 0
    set winner to 0
    hide
  WHEN I receive "start halo lockdown":
    show variable score
    show variable lives
    show variable round
    show variable locks
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change shieldAngle by -4
      IF key right arrow pressed? THEN:
        change shieldAngle by 4
      set shieldX to sin of shieldAngle * 205
      set shieldY to cos of shieldAngle * 150
      go to x: shieldX y: shieldY
      point in direction shieldAngle
      wait 0.02 seconds
    hide
  WHEN I receive "halo lock broken":
    IF active = 1 THEN:
      change locks by -1
      change score by round * 4
      IF locks < 1 THEN:
        IF round = 3 THEN:
          set winner to 1
          set active to 0
          broadcast "halo lockdown over"
        ELSE:
          change round by 1
          change coreSpeed by 0.8
          set locks to 4
          broadcast "restore locks"
  WHEN I receive "halo escape":
    IF active = 1 THEN:
      change lives by -1
      IF lives < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "halo lockdown over"

SPRITE Core:
  SHAPE art halo-lockdown/core
  SOUND rebound 640
  SOUND escape 120
  WHEN flag clicked:
    go to x: 0 y: 0
    point in direction 37
    hide
  WHEN I receive "start halo lockdown":
    show
    REPEAT UNTIL active = 0:
      move coreSpeed steps
      IF touching HaloShield THEN:
        point towards Reactor
        turn right pick random -20 to 20 degrees
        move 12 steps
        play sound "rebound"
      IF touching edge THEN:
        broadcast "halo escape"
        play sound "escape"
        go to x: 0 y: 0
        point in direction pick random 20 to 160
        wait 0.6 seconds
      wait 0.02 seconds
    hide

SPRITE LockNorth:
  SHAPE art halo-lockdown/lock-north
  WHEN flag clicked:
    go to x: 0 y: 75
    hide
  WHEN I receive "start halo lockdown":
    show
    REPEAT UNTIL active = 0:
      IF touching Core THEN:
        hide
        broadcast "halo lock broken"
        REPEAT UNTIL locks = 4 or active = 0:
          wait 0.03 seconds
        IF active = 1 THEN:
          show
      wait 0.03 seconds
    hide
  WHEN I receive "restore locks":
    show

SPRITE LockSouth:
  SHAPE art halo-lockdown/lock-south
  WHEN flag clicked:
    go to x: 0 y: -75
    hide
  WHEN I receive "start halo lockdown":
    show
    REPEAT UNTIL active = 0:
      IF touching Core THEN:
        hide
        broadcast "halo lock broken"
        REPEAT UNTIL locks = 4 or active = 0:
          wait 0.03 seconds
        IF active = 1 THEN:
          show
      wait 0.03 seconds
    hide
  WHEN I receive "restore locks":
    show

SPRITE LockEast:
  SHAPE art halo-lockdown/lock-east
  WHEN flag clicked:
    go to x: 95 y: 0
    hide
  WHEN I receive "start halo lockdown":
    show
    REPEAT UNTIL active = 0:
      IF touching Core THEN:
        hide
        broadcast "halo lock broken"
        REPEAT UNTIL locks = 4 or active = 0:
          wait 0.03 seconds
        IF active = 1 THEN:
          show
      wait 0.03 seconds
    hide
  WHEN I receive "restore locks":
    show

SPRITE LockWest:
  SHAPE art halo-lockdown/lock-west
  WHEN flag clicked:
    go to x: -95 y: 0
    hide
  WHEN I receive "start halo lockdown":
    show
    REPEAT UNTIL active = 0:
      IF touching Core THEN:
        hide
        broadcast "halo lock broken"
        REPEAT UNTIL locks = 4 or active = 0:
          wait 0.03 seconds
        IF active = 1 THEN:
          show
      wait 0.03 seconds
    hide
  WHEN I receive "restore locks":
    show

SPRITE Reactor:
  SHAPE art halo-lockdown/reactor
  WHEN flag clicked:
    go to x: 0 y: 0
    hide
  WHEN I receive "start halo lockdown":
    show
  WHEN I receive "halo lockdown over":
    hide

SPRITE HaloResult:
  COSTUME win label "THREE REACTOR RINGS CLEARED • GREEN FLAG TO DEFEND AGAIN" #ffe66d
  COSTUME lose label "THREE CORE ESCAPES • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start halo lockdown":
    hide
  WHEN I receive "halo lockdown over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    corridor_kestrel: `# Carrier Kestrel — an inertial drone run through fifteen moving apertures.
# GOAL: clear fifteen carrier gates before three hull breaches.
# CONTROLS: Arrows add drift in both axes. Space spends battery on a short shield.
# Thread the moving gap and skim its yellow cell to restore battery and earn bonus distance.
GLOBAL distance
GLOBAL gates
GLOBAL hull
GLOBAL battery
GLOBAL droneX
GLOBAL droneY
GLOBAL driftX
GLOBAL driftY
GLOBAL gateX
GLOBAL gapY
GLOBAL gateSpeed
GLOBAL shield
GLOBAL shieldReady
GLOBAL started
GLOBAL active
GLOBAL winner
GLOBAL breachLock

STAGE:
  BACKDROP intro art carrier-kestrel/intro
  BACKDROP corridor art carrier-kestrel/play
  WHEN flag clicked:
    set started to 0
    switch backdrop to intro
    hide variable distance
    hide variable gates
    hide variable hull
    hide variable battery
    set active to 0
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set distance to 0
      set gates to 0
      set hull to 3
      set battery to 12
      set droneX to -150
      set droneY to 0
      set driftX to 0
      set driftY to 0
      set gateX to 240
      set gapY to 0
      set gateSpeed to 5
      set shield to 0
      set shieldReady to 0
      set breachLock to 0
      set winner to 0
      set active to 1
      switch backdrop to corridor
      broadcast "start carrier kestrel"

SPRITE Kestrel:
  SHAPE art carrier-kestrel/drone
  COSTUME shield art carrier-kestrel/shield
  SOUND scrape 160
  SOUND pulse 820
  WHEN flag clicked:
    set distance to 0
    set gates to 0
    set hull to 3
    set battery to 12
    set droneX to -150
    set droneY to 0
    set driftX to 0
    set driftY to 0
    set gateSpeed to 5
    set shield to 0
    set shieldReady to 0
    set breachLock to 0
    set active to 0
    set winner to 0
    go to x: droneX y: droneY
    hide
  WHEN I receive "start carrier kestrel":
    show variable distance
    show variable gates
    show variable hull
    show variable battery
    show
    wait 0.2 seconds
    set shieldReady to 1
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change driftX by -0.35
      IF key right arrow pressed? THEN:
        change driftX by 0.35
      IF key up arrow pressed? THEN:
        change driftY by 0.35
      IF key down arrow pressed? THEN:
        change driftY by -0.35
      set driftX to driftX * 0.92
      set driftY to driftY * 0.92
      change droneX by driftX
      change droneY by driftY
      IF droneX < -220 THEN:
        set droneX to -220
      IF droneX > 180 THEN:
        set droneX to 180
      IF droneY < -155 THEN:
        set droneY to -155
      IF droneY > 155 THEN:
        set droneY to 155
      go to x: droneX y: droneY
      IF shield = 1 THEN:
        switch costume to shield
        change battery by -0.12
        IF battery < 1 THEN:
          set shield to 0
      ELSE:
        switch costume to costume1
      IF (touching UpperGate or touching LowerGate) and breachLock = 0 THEN:
        set breachLock to 1
        IF shield = 0 THEN:
          broadcast "kestrel breach"
        ELSE:
          change distance by 3
          wait 0.25 seconds
          set breachLock to 0
      wait 0.02 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and shieldReady = 1 and battery > 3 and shield = 0 THEN:
      set shield to 1
      play sound "pulse"
      wait 0.8 seconds
      set shield to 0
  WHEN I receive "kestrel breach":
    IF active = 1 THEN:
      change hull by -1
      set droneX to -150
      set droneY to 0
      set driftX to 0
      set driftY to 0
      play sound "scrape"
      IF hull < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "carrier kestrel over"
      ELSE:
        wait 0.6 seconds
        set breachLock to 0
  WHEN I receive "carrier gate cleared":
    IF active = 1 THEN:
      change gates by 1
      change distance by 1
      change gateSpeed by 0.12
      IF gates = 15 THEN:
        set winner to 1
        set active to 0
        broadcast "carrier kestrel over"

SPRITE GateClock:
  SHAPE art carrier-kestrel/clock
  WHEN flag clicked:
    hide
    set gateX to 240
    set gapY to 0
  WHEN I receive "start carrier kestrel":
    REPEAT UNTIL active = 0:
      change gateX by 0 - gateSpeed
      IF gateX < -250 THEN:
        set gateX to 250
        set gapY to pick random -75 to 75
        broadcast "carrier gate cleared"
      wait 0.02 seconds

SPRITE UpperGate:
  SHAPE art carrier-kestrel/gate-upper
  WHEN flag clicked:
    hide
  WHEN I receive "start carrier kestrel":
    show
    REPEAT UNTIL active = 0:
      go to x: gateX y: gapY + 135
      wait 0.02 seconds
    hide

SPRITE LowerGate:
  SHAPE art carrier-kestrel/gate-lower
  WHEN flag clicked:
    hide
  WHEN I receive "start carrier kestrel":
    show
    REPEAT UNTIL active = 0:
      go to x: gateX y: gapY - 135
      wait 0.02 seconds
    hide

SPRITE EnergyCell:
  SHAPE art carrier-kestrel/cell
  SOUND charge 980
  WHEN flag clicked:
    hide
  WHEN I receive "start carrier kestrel":
    show
    REPEAT UNTIL active = 0:
      go to x: gateX y: gapY
      IF touching Kestrel THEN:
        change battery by 4
        change distance by 4
        set x to -260
        play sound "charge"
        wait 0.5 seconds
      wait 0.02 seconds
    hide

SPRITE KestrelResult:
  COSTUME win label "FIFTEEN APERTURES CLEARED • GREEN FLAG TO FLY AGAIN" #ffe66d
  COSTUME lose label "THREE HULL BREACHES • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start carrier kestrel":
    hide
  WHEN I receive "carrier kestrel over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    thunder_volley: `# Skycourt Surge — an aerial volleyball duel against a storm rival.
# GOAL: score seven points before Nimbus does; the ball accelerates through long rallies.
# CONTROLS: Left/Right move, Up jumps, Space spikes when the ball is within reach.
GLOBAL playerPoints
GLOBAL rivalPoints
GLOBAL rally
GLOBAL playerX
GLOBAL playerY
GLOBAL playerVY
GLOBAL rivalX
GLOBAL rivalY
GLOBAL rivalVY
GLOBAL ballX
GLOBAL ballY
GLOBAL ballVX
GLOBAL ballVY
GLOBAL started
GLOBAL active
GLOBAL winner

STAGE:
  BACKDROP intro art skycourt-surge/intro
  BACKDROP court art skycourt-surge/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    set winner to 0
    switch backdrop to intro
    hide variable playerPoints
    hide variable rivalPoints
    hide variable rally
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set playerPoints to 0
      set rivalPoints to 0
      set rally to 0
      set playerX to -130
      set playerY to -125
      set playerVY to 0
      set rivalX to 135
      set rivalY to -125
      set rivalVY to 0
      set ballX to -80
      set ballY to 70
      set ballVX to 5
      set ballVY to 5
      set winner to 0
      set active to 1
      switch backdrop to court
      broadcast "serve skycourt"

SPRITE Volt:
  SHAPE art skycourt-surge/volt
  SOUND spike 720
  WHEN flag clicked:
    set playerPoints to 0
    set rivalPoints to 0
    set rally to 0
    set playerX to -130
    set playerY to -125
    set playerVY to 0
    go to x: playerX y: playerY
    hide
  WHEN I receive "serve skycourt":
    show variable playerPoints
    show variable rivalPoints
    show variable rally
    show
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change playerX by -5
      IF key right arrow pressed? THEN:
        change playerX by 5
      IF playerX < -220 THEN:
        set playerX to -220
      IF playerX > -25 THEN:
        set playerX to -25
      change playerVY by -0.75
      change playerY by playerVY
      IF playerY < -125 THEN:
        set playerY to -125
        set playerVY to 0
      go to x: playerX y: playerY
      wait 0.02 seconds
    hide
  WHEN up arrow key pressed:
    IF active = 1 and playerY = -125 THEN:
      set playerVY to 12
  WHEN space key pressed:
    IF active = 1 and touching StormBall THEN:
      set ballVX to 8 + rally / 3
      set ballVY to -3
      change rally by 1
      play sound "spike"
  WHEN I receive "skycourt player point":
    IF active = 1 THEN:
      change playerPoints by 1
      IF playerPoints > 6 THEN:
        set winner to 1
        set active to 0
        broadcast "skycourt over"
  WHEN I receive "skycourt rival point":
    IF active = 1 THEN:
      change rivalPoints by 1
      IF rivalPoints > 6 THEN:
        set winner to 0
        set active to 0
        broadcast "skycourt over"

SPRITE Nimbus:
  SHAPE art skycourt-surge/nimbus
  WHEN flag clicked:
    set rivalX to 135
    set rivalY to -125
    set rivalVY to 0
    go to x: rivalX y: rivalY
    hide
  WHEN I receive "serve skycourt":
    show
    REPEAT UNTIL active = 0:
      IF ballX > 15 THEN:
        IF ballX > rivalX THEN:
          change rivalX by 3.5
        ELSE:
          change rivalX by -3.5
      IF ballY > 10 and ballX > 20 and rivalY = -125 THEN:
        set rivalVY to 11
      change rivalVY by -0.72
      change rivalY by rivalVY
      IF rivalY < -125 THEN:
        set rivalY to -125
        set rivalVY to 0
      IF rivalX < 25 THEN:
        set rivalX to 25
      IF rivalX > 220 THEN:
        set rivalX to 220
      go to x: rivalX y: rivalY
      wait 0.02 seconds
    hide

SPRITE StormBall:
  SHAPE art skycourt-surge/ball
  SOUND point 960
  WHEN flag clicked:
    set ballX to -80
    set ballY to 70
    set ballVX to 5
    set ballVY to 5
    go to x: ballX y: ballY
    hide
  WHEN I receive "serve skycourt":
    show
    REPEAT UNTIL active = 0:
      change ballVY by -0.38
      change ballX by ballVX
      change ballY by ballVY
      IF touching Volt and ballVX < 0 THEN:
        set ballVX to abs of ballVX + 0.4
        set ballVY to 7
        change rally by 1
      IF touching Nimbus and ballVX > 0 THEN:
        set ballVX to 0 - abs of ballVX - 0.4
        set ballVY to 7 + rally / 8
        change rally by 1
      IF touching ThunderNet THEN:
        set ballVX to 0 - ballVX
        set ballVY to 4
      IF ballX > 230 or ballX < -230 THEN:
        set ballVX to 0 - ballVX
      IF ballY < -145 THEN:
        IF ballX < 0 THEN:
          broadcast "skycourt rival point"
        ELSE:
          broadcast "skycourt player point"
        play sound "point"
        IF active = 1 THEN:
          set rally to 0
          set ballX to 0
          set ballY to 100
          set ballVX to pick random -5 to 5
          set ballVY to 5
          wait 0.8 seconds
      go to x: ballX y: ballY
      wait 0.02 seconds
    hide

SPRITE ThunderNet:
  SHAPE art skycourt-surge/net
  WHEN flag clicked:
    go to x: 0 y: -90
    hide
  WHEN I receive "serve skycourt":
    show
  WHEN I receive "skycourt over":
    hide

SPRITE SkycourtResult:
  COSTUME win label "SEVEN STORM POINTS • GREEN FLAG FOR A REMATCH" #ffe66d
  COSTUME lose label "NIMBUS REACHED SEVEN • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "serve skycourt":
    hide
  WHEN I receive "skycourt over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    cascade_pair: `# Chromafall Reactor — a visible four-column color fusion puzzle.
# GOAL: ignite six four-color fusions before any reactor column reaches ten cells.
# CONTROLS: Left/Right choose a column, Up swaps the pair, Space locks both cells.
# Match four equal colors at a column's top; consecutive fusions multiply the score.
GLOBAL score
GLOBAL combo
GLOBAL clears
GLOBAL column
GLOBAL colorA
GLOBAL colorB
GLOBAL overflow
GLOBAL falls
GLOBAL started
GLOBAL dropReady
GLOBAL clearedDrop
GLOBAL active
GLOBAL winner
GLOBAL i
GLOBAL topA
GLOBAL topB
GLOBAL topC
GLOBAL topD
GLOBAL runA
GLOBAL runB
GLOBAL runC
GLOBAL runD
LIST colA
LIST colB
LIST colC
LIST colD

STAGE:
  BACKDROP intro art chromafall-reactor/intro
  BACKDROP board art chromafall-reactor/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    set winner to 0
    switch backdrop to intro
    hide variable score
    hide variable combo
    hide variable clears
    hide variable column
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set active to 1
      switch backdrop to board
      broadcast "ignite chromafall"

SPRITE PairPilot:
  SHAPE art chromafall-reactor/selector
  SOUND clear 980
  SOUND drop 420
  WHEN flag clicked:
    set score to 0
    set combo to 1
    set clears to 0
    set column to 2
    set colorA to pick random 1 to 4
    set colorB to pick random 1 to 4
    set overflow to 0
    set falls to 0
    set dropReady to 0
    set clearedDrop to 0
    set active to 0
    set winner to 0
    set topA to 0
    set topB to 0
    set topC to 0
    set topD to 0
    set runA to 0
    set runB to 0
    set runC to 0
    set runD to 0
    delete all of colA
    delete all of colB
    delete all of colC
    delete all of colD
    go to x: -180 + column * 72 y: 130
    hide
  WHEN I receive "ignite chromafall":
    set active to 1
    show variable score
    show variable combo
    show variable clears
    show variable column
    show
    set dropReady to 1
    REPEAT UNTIL active = 0:
      IF key left arrow pressed? THEN:
        change column by -1
        wait 0.12 seconds
      IF key right arrow pressed? THEN:
        change column by 1
        wait 0.12 seconds
      IF column < 1 THEN:
        set column to 1
      IF column > 4 THEN:
        set column to 4
      go to x: -180 + column * 72 y: 130
      wait 0.02 seconds
    hide
  WHEN up arrow key pressed:
    IF active = 1 THEN:
      set falls to colorA
      set colorA to colorB
      set colorB to falls
  WHEN space key pressed:
    IF active = 1 and dropReady = 1 THEN:
      set dropReady to 0
      broadcast "drop pair" and wait
      IF active = 1 THEN:
        set colorA to pick random 1 to 4
        set colorB to pick random 1 to 4
        set dropReady to 1

SPRITE PreviewA:
  SHAPE art chromafall-reactor/block1
  COSTUME block1 art chromafall-reactor/block1
  COSTUME block2 art chromafall-reactor/block2
  COSTUME block3 art chromafall-reactor/block3
  COSTUME block4 art chromafall-reactor/block4
  WHEN flag clicked:
    hide
  WHEN I receive "ignite chromafall":
    show
    REPEAT UNTIL active = 0:
      switch costume to ("block" join colorA)
      go to x: -180 + column * 72 y: 105
      wait 0.03 seconds
    hide

SPRITE PreviewB:
  SHAPE art chromafall-reactor/block1
  COSTUME block1 art chromafall-reactor/block1
  COSTUME block2 art chromafall-reactor/block2
  COSTUME block3 art chromafall-reactor/block3
  COSTUME block4 art chromafall-reactor/block4
  WHEN flag clicked:
    hide
  WHEN I receive "ignite chromafall":
    show
    REPEAT UNTIL active = 0:
      switch costume to ("block" join colorB)
      go to x: -180 + column * 72 y: 75
      wait 0.03 seconds
    hide

SPRITE ReactorLogic:
  SHAPE art chromafall-reactor/block1
  COSTUME block1 art chromafall-reactor/block1
  COSTUME block2 art chromafall-reactor/block2
  COSTUME block3 art chromafall-reactor/block3
  COSTUME block4 art chromafall-reactor/block4
  SOUND clear 980
  SOUND drop 420

  DEFINE FAST render reactor:
    clear
    set i to 1
    REPEAT length of colA:
      switch costume to ("block" join item i of colA)
      go to x: -108 y: -140 + i * 25
      stamp
      change i by 1
    set i to 1
    REPEAT length of colB:
      switch costume to ("block" join item i of colB)
      go to x: -36 y: -140 + i * 25
      stamp
      change i by 1
    set i to 1
    REPEAT length of colC:
      switch costume to ("block" join item i of colC)
      go to x: 36 y: -140 + i * 25
      stamp
      change i by 1
    set i to 1
    REPEAT length of colD:
      switch costume to ("block" join item i of colD)
      go to x: 108 y: -140 + i * 25
      stamp
      change i by 1

  WHEN flag clicked:
    hide
    clear
  WHEN I receive "drop pair":
    set clearedDrop to 0
    IF column = 1 THEN:
      add colorA to colA
      IF colorA = topA THEN:
        change runA by 1
      ELSE:
        set topA to colorA
        set runA to 1
      add colorB to colA
      IF colorB = topA THEN:
        change runA by 1
      ELSE:
        set topA to colorB
        set runA to 1
      IF runA > 3 THEN:
        set falls to length of colA
        REPEAT 4:
          delete falls of colA
          change falls by -1
        set topA to 0
        set runA to 0
        set clearedDrop to 1
        broadcast "pair clear"
      IF length of colA > 9 THEN:
        set overflow to 1
    IF column = 2 THEN:
      add colorA to colB
      IF colorA = topB THEN:
        change runB by 1
      ELSE:
        set topB to colorA
        set runB to 1
      add colorB to colB
      IF colorB = topB THEN:
        change runB by 1
      ELSE:
        set topB to colorB
        set runB to 1
      IF runB > 3 THEN:
        set falls to length of colB
        REPEAT 4:
          delete falls of colB
          change falls by -1
        set topB to 0
        set runB to 0
        set clearedDrop to 1
        broadcast "pair clear"
      IF length of colB > 9 THEN:
        set overflow to 1
    IF column = 3 THEN:
      add colorA to colC
      IF colorA = topC THEN:
        change runC by 1
      ELSE:
        set topC to colorA
        set runC to 1
      add colorB to colC
      IF colorB = topC THEN:
        change runC by 1
      ELSE:
        set topC to colorB
        set runC to 1
      IF runC > 3 THEN:
        set falls to length of colC
        REPEAT 4:
          delete falls of colC
          change falls by -1
        set topC to 0
        set runC to 0
        set clearedDrop to 1
        broadcast "pair clear"
      IF length of colC > 9 THEN:
        set overflow to 1
    IF column = 4 THEN:
      add colorA to colD
      IF colorA = topD THEN:
        change runD by 1
      ELSE:
        set topD to colorA
        set runD to 1
      add colorB to colD
      IF colorB = topD THEN:
        change runD by 1
      ELSE:
        set topD to colorB
        set runD to 1
      IF runD > 3 THEN:
        set falls to length of colD
        REPEAT 4:
          delete falls of colD
          change falls by -1
        set topD to 0
        set runD to 0
        set clearedDrop to 1
        broadcast "pair clear"
      IF length of colD > 9 THEN:
        set overflow to 1
    play sound "drop"
    render reactor
    IF clearedDrop = 0 THEN:
      set combo to 1
    IF overflow = 1 THEN:
      set winner to 0
      set active to 0
      broadcast "chromafall over"
  WHEN I receive "pair clear":
    change score by 40 * combo
    change combo by 1
    change clears by 1
    play sound "clear"
    IF clears > 5 THEN:
      set winner to 1
      set active to 0
      broadcast "chromafall over"

SPRITE ChromafallResult:
  COSTUME win label "SIX FUSIONS STABLE • GREEN FLAG TO REIGNITE" #ffe66d
  COSTUME lose label "REACTOR OVERLOAD • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "ignite chromafall":
    hide
  WHEN I receive "chromafall over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    mooncoil_odyssey: `# Cratercoil — a lunar grid snake with oxygen-powered dashes.
# GOAL: collect twelve moonblooms before three crashes into your trail or the rover bomb.
# CONTROLS: Arrow keys steer. Space spends one oxygen to dash an extra grid cell.
GLOBAL score
GLOBAL lives
GLOBAL blooms
GLOBAL headX
GLOBAL headY
GLOBAL dirX
GLOBAL dirY
GLOBAL snakeLength
GLOBAL foodX
GLOBAL foodY
GLOBAL bombX
GLOBAL bombY
GLOBAL oxygen
GLOBAL i
GLOBAL hitTail
GLOBAL started
GLOBAL active
GLOBAL winner
GLOBAL crashLock
LIST trailX
LIST trailY

STAGE:
  BACKDROP intro art cratercoil/intro
  BACKDROP moon art cratercoil/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    set winner to 0
    switch backdrop to intro
    hide variable score
    hide variable lives
    hide variable blooms
    hide variable oxygen
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set active to 1
      switch backdrop to moon
      broadcast "start cratercoil"

SPRITE Mooncoil:
  SHAPE art cratercoil/head
  COSTUME dash art cratercoil/dash
  COSTUME tail art cratercoil/tail
  SOUND fruit 960
  SOUND boom 120

  DEFINE FAST wrap coil:
    IF headX > 9 THEN:
      set headX to -9
    IF headX < -9 THEN:
      set headX to 9
    IF headY > 6 THEN:
      set headY to -6
    IF headY < -6 THEN:
      set headY to 6

  DEFINE inspect coil cell:
    set hitTail to 0
    set i to 1
    REPEAT UNTIL i > length of trailX:
      IF headX = item i of trailX and headY = item i of trailY THEN:
        set hitTail to 1
      change i by 1
    IF hitTail = 1 and crashLock = 0 THEN:
      broadcast "coil crash" and wait
    IF active = 1 and headX = foodX and headY = foodY THEN:
      change score by snakeLength
      change snakeLength by 1
      change blooms by 1
      change oxygen by 1
      play sound "fruit"
      broadcast "new moonfruit"
      IF blooms > 11 THEN:
        set winner to 1
        set active to 0
        broadcast "cratercoil over"
    IF active = 1 and headX = bombX and headY = bombY and crashLock = 0 THEN:
      broadcast "coil crash" and wait

  WHEN flag clicked:
    set score to 0
    set lives to 3
    set blooms to 0
    set oxygen to 5
    set headX to 0
    set headY to 0
    set dirX to 1
    set dirY to 0
    set snakeLength to 5
    set hitTail to 0
    set active to 0
    set winner to 0
    set crashLock to 0
    delete all of trailX
    delete all of trailY
    go to x: headX * 24 y: headY * 24
    hide
    clear
  WHEN I receive "start cratercoil":
    set active to 1
    show variable score
    show variable lives
    show variable blooms
    show variable oxygen
    switch costume to costume1
    show
  WHEN left arrow key pressed:
    IF active = 1 and dirX = 0 THEN:
      set dirX to -1
      set dirY to 0
  WHEN right arrow key pressed:
    IF active = 1 and dirX = 0 THEN:
      set dirX to 1
      set dirY to 0
  WHEN up arrow key pressed:
    IF active = 1 and dirY = 0 THEN:
      set dirX to 0
      set dirY to 1
  WHEN down arrow key pressed:
    IF active = 1 and dirY = 0 THEN:
      set dirX to 0
      set dirY to -1
  WHEN I receive "start cratercoil":
    REPEAT UNTIL active = 0:
      add headX to trailX
      add headY to trailY
      IF length of trailX > snakeLength THEN:
        delete 1 of trailX
        delete 1 of trailY
      change headX by dirX
      change headY by dirY
      wrap coil
      inspect coil cell
      clear
      switch costume to tail
      set i to 1
      REPEAT length of trailX:
        go to x: item i of trailX * 24 y: item i of trailY * 24
        stamp
        change i by 1
      switch costume to costume1
      go to x: headX * 24 y: headY * 24
      wait 0.16 seconds
    hide
  WHEN space key pressed:
    IF active = 1 and oxygen > 0 THEN:
      switch costume to dash
      change headX by dirX
      change headY by dirY
      change oxygen by -1
      wrap coil
      inspect coil cell
      wait 0.12 seconds
      switch costume to costume1
  WHEN I receive "coil crash":
    IF active = 1 and crashLock = 0 THEN:
      set crashLock to 1
      change lives by -1
      play sound "boom"
      IF lives < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "cratercoil over"
      ELSE:
        broadcast "coil reset" and wait
        set crashLock to 0
  WHEN I receive "coil reset":
    set headX to 0
    set headY to 0
    set dirX to 1
    set dirY to 0
    set snakeLength to 5
    delete all of trailX
    delete all of trailY
    wait 0.5 seconds

SPRITE Moonfruit:
  SHAPE art cratercoil/bloom
  WHEN flag clicked:
    broadcast "new moonfruit"
    hide
  WHEN I receive "start cratercoil":
    show
  WHEN I receive "cratercoil over":
    hide
  WHEN I receive "new moonfruit":
    set foodX to pick random -8 to 8
    set foodY to pick random -5 to 5
    go to x: foodX * 24 y: foodY * 24

SPRITE RoverBomb:
  SHAPE art cratercoil/bomb
  WHEN flag clicked:
    set bombX to 6
    set bombY to -4
    go to x: bombX * 24 y: bombY * 24
    hide
  WHEN I receive "start cratercoil":
    show
    REPEAT UNTIL active = 0:
      wait 1.2 seconds
      change bombX by pick random -1 to 1
      change bombY by pick random -1 to 1
      IF bombX > 8 THEN:
        set bombX to 8
      IF bombX < -8 THEN:
        set bombX to -8
      IF bombY > 5 THEN:
        set bombY to 5
      IF bombY < -5 THEN:
        set bombY to -5
      go to x: bombX * 24 y: bombY * 24
    hide

SPRITE CratercoilResult:
  COSTUME win label "TWELVE MOONBLOOMS SECURED • GREEN FLAG TO COIL AGAIN" #ffe66d
  COSTUME lose label "ROVER HAZARDS WON • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "start cratercoil":
    hide
  WHEN I receive "cratercoil over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show
`,

    cinder_thrust: `# Magma Lift — a ten-ring rocket-boot run through a moving volcanic cave.
# GOAL: fly through ten ember rings before three crashes or falls.
# CONTROLS: Hold Up to thrust; Left/Right steer. Cyan ledges recharge fuel.
GLOBAL score
GLOBAL hearts
GLOBAL rings
GLOBAL fuel
GLOBAL flyerX
GLOBAL flyerY
GLOBAL flyerVX
GLOBAL flyerVY
GLOBAL caveSpeed
GLOBAL grounded
GLOBAL invulnerable
GLOBAL started
GLOBAL active
GLOBAL winner
GLOBAL chargeLock

STAGE:
  BACKDROP intro art magma-lift/intro
  BACKDROP cave art magma-lift/play
  WHEN flag clicked:
    set started to 0
    set active to 0
    set winner to 0
    switch backdrop to intro
    hide variable score
    hide variable hearts
    hide variable rings
    hide variable fuel
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set active to 1
      switch backdrop to cave
      broadcast "launch magma lift"

SPRITE Cinder:
  SHAPE art magma-lift/cinder
  COSTUME thrust art magma-lift/thrust
  SOUND jet 540
  SOUND hit 140
  SOUND ring 1080
  WHEN flag clicked:
    set score to 0
    set hearts to 3
    set rings to 0
    set fuel to 18
    set flyerX to -150
    set flyerY to 20
    set flyerVX to 0
    set flyerVY to 0
    set caveSpeed to 5
    set grounded to 0
    set invulnerable to 0
    set active to 0
    set winner to 0
    set chargeLock to 0
    go to x: flyerX y: flyerY
    hide
  WHEN I receive "launch magma lift":
    set active to 1
    show variable score
    show variable hearts
    show variable rings
    show variable fuel
    show
    REPEAT UNTIL active = 0:
      change flyerVY by -0.42
      IF key up arrow pressed? and fuel > 0 THEN:
        change flyerVY by 0.9
        change fuel by -0.08
        switch costume to thrust
      ELSE:
        switch costume to costume1
      IF key left arrow pressed? THEN:
        change flyerVX by -0.22
      IF key right arrow pressed? THEN:
        change flyerVX by 0.22
      set flyerVX to flyerVX * 0.94
      set flyerVY to flyerVY * 0.98
      change flyerX by flyerVX
      change flyerY by flyerVY
      IF flyerX < -220 THEN:
        set flyerX to -220
      IF flyerX > 180 THEN:
        set flyerX to 180
      IF flyerY > 155 THEN:
        set flyerY to 155
        set flyerVY to -2
      IF flyerY < -155 and invulnerable = 0 THEN:
        broadcast "cinder crash" and wait
      go to x: flyerX y: flyerY
      set grounded to 0
      IF touching ChargeLedge and flyerVY < 1 THEN:
        set grounded to 1
        set flyerVY to 0
        change fuel by 0.3
        IF fuel > 20 THEN:
          set fuel to 20
      IF touching BasaltTooth and invulnerable = 0 THEN:
        broadcast "cinder crash" and wait
      change score by caveSpeed / 220
      wait 0.02 seconds
    hide
  WHEN I receive "cinder crash":
    IF active = 1 and invulnerable = 0 THEN:
      set invulnerable to 1
      change hearts by -1
      play sound "hit"
      IF hearts < 1 THEN:
        set winner to 0
        set active to 0
        broadcast "magma lift over"
      ELSE:
        set flyerX to -150
        set flyerY to 20
        set flyerVX to 0
        set flyerVY to 0
        wait 0.6 seconds
        set invulnerable to 0
  WHEN I receive "ember ring collected":
    IF active = 1 THEN:
      change rings by 1
      change score by 12
      change fuel by 2
      IF fuel > 20 THEN:
        set fuel to 20
      change caveSpeed by 0.1
      play sound "ring"
      IF rings > 9 THEN:
        set winner to 1
        set active to 0
        broadcast "magma lift over"

SPRITE BasaltTooth:
  SHAPE art magma-lift/tooth
  WHEN flag clicked:
    go to x: 230 y: pick random -90 to 120
    hide
  WHEN I receive "launch magma lift":
    show
    REPEAT UNTIL active = 0:
      change x by 0 - caveSpeed
      turn right 2 degrees
      IF x position < -250 THEN:
        set x to 250
        set y to pick random -110 to 125
        change caveSpeed by 0.12
      wait 0.02 seconds
    hide

SPRITE ChargeLedge:
  SHAPE art magma-lift/ledge
  SOUND charge 900
  WHEN flag clicked:
    go to x: 120 y: -115
    hide
  WHEN I receive "launch magma lift":
    show
    REPEAT UNTIL active = 0:
      change x by 0 - caveSpeed * 0.6
      IF x position < -250 THEN:
        set x to 250
        set y to pick random -125 to 10
      IF touching Cinder THEN:
        IF chargeLock = 0 THEN:
          play sound "charge"
          set chargeLock to 1
      ELSE:
        set chargeLock to 0
      wait 0.03 seconds
    hide

SPRITE EmberRing:
  SHAPE art magma-lift/ring
  SOUND ring 1080
  WHEN flag clicked:
    go to x: 200 y: 80
    hide
  WHEN I receive "launch magma lift":
    show
    REPEAT UNTIL active = 0:
      change x by 0 - caveSpeed
      IF x position < -250 THEN:
        set x to 250
        set y to pick random -80 to 130
      IF touching Cinder THEN:
        set x to 260
        broadcast "ember ring collected" and wait
      wait 0.02 seconds
    hide

SPRITE MagmaLiftResult:
  COSTUME win label "TEN EMBER RINGS CLEARED • GREEN FLAG TO FLY AGAIN" #ffe66d
  COSTUME lose label "THE MAGMA CLAIMED THE RUN • GREEN FLAG TO RETRY" #ff91a8
  WHEN flag clicked:
    go to x: 0 y: -15
    hide
  WHEN I receive "launch magma lift":
    hide
  WHEN I receive "magma lift over":
    IF winner = 1 THEN:
      switch costume to win
    ELSE:
      switch costume to lose
    show`,

    triple_bingo: `# Triple Bingo — three players, one keyboard, one screen.
# GOAL: be first to daub a full row, column or diagonal on YOUR card.
# CONTROLS: Space starts. Q daubs for player 1, B for player 2, M for player 3.
# A number is called every few seconds. Daub it before the next call or lose it.
# The cards live in ONE 2D array (15 rows x 5 cols, five rows per player) and the
# daubs in another, so every read is an "item row R col C of array" lookup.
GLOBAL started
GLOBAL called
GLOBAL winner
GLOBAL calls
GLOBAL p
GLOBAL r
GLOBAL c
GLOBAL v
GLOBAL i
GLOBAL lo
GLOBAL dup
GLOBAL cand
GLOBAL base
GLOBAL hit
GLOBAL run
GLOBAL cx
GLOBAL s1
GLOBAL s2
GLOBAL s3

STAGE:
  BACKDROP hall "#0a1626"
  WHEN flag clicked:
    set started to 0
    set winner to 0
    switch backdrop to hall
  WHEN space key pressed:
    IF started = 0 THEN:
      set started to 1
      set winner to 0
      broadcast "deal bingo"

SPRITE Caller:
  COSTUME blank tile "" none
  COSTUME cell tile "" #12314f #ffffff
  COSTUME daub tile "" #27d17c #04371f
  COSTUME free tile "FREE" #f2c14e #241a00
  COSTUME n1 tile "1" none #f2f7ff
  COSTUME n2 tile "2" none #f2f7ff
  COSTUME n3 tile "3" none #f2f7ff
  COSTUME n4 tile "4" none #f2f7ff
  COSTUME n5 tile "5" none #f2f7ff
  COSTUME n6 tile "6" none #f2f7ff
  COSTUME n7 tile "7" none #f2f7ff
  COSTUME n8 tile "8" none #f2f7ff
  COSTUME n9 tile "9" none #f2f7ff
  COSTUME n10 tile "10" none #f2f7ff
  COSTUME n11 tile "11" none #f2f7ff
  COSTUME n12 tile "12" none #f2f7ff
  COSTUME n13 tile "13" none #f2f7ff
  COSTUME n14 tile "14" none #f2f7ff
  COSTUME n15 tile "15" none #f2f7ff
  COSTUME n16 tile "16" none #f2f7ff
  COSTUME n17 tile "17" none #f2f7ff
  COSTUME n18 tile "18" none #f2f7ff
  COSTUME n19 tile "19" none #f2f7ff
  COSTUME n20 tile "20" none #f2f7ff
  COSTUME n21 tile "21" none #f2f7ff
  COSTUME n22 tile "22" none #f2f7ff
  COSTUME n23 tile "23" none #f2f7ff
  COSTUME n24 tile "24" none #f2f7ff
  COSTUME n25 tile "25" none #f2f7ff
  COSTUME n26 tile "26" none #f2f7ff
  COSTUME n27 tile "27" none #f2f7ff
  COSTUME n28 tile "28" none #f2f7ff
  COSTUME n29 tile "29" none #f2f7ff
  COSTUME n30 tile "30" none #f2f7ff
  COSTUME n31 tile "31" none #f2f7ff
  COSTUME n32 tile "32" none #f2f7ff
  COSTUME n33 tile "33" none #f2f7ff
  COSTUME n34 tile "34" none #f2f7ff
  COSTUME n35 tile "35" none #f2f7ff
  COSTUME n36 tile "36" none #f2f7ff
  COSTUME n37 tile "37" none #f2f7ff
  COSTUME n38 tile "38" none #f2f7ff
  COSTUME n39 tile "39" none #f2f7ff
  COSTUME n40 tile "40" none #f2f7ff
  COSTUME n41 tile "41" none #f2f7ff
  COSTUME n42 tile "42" none #f2f7ff
  COSTUME n43 tile "43" none #f2f7ff
  COSTUME n44 tile "44" none #f2f7ff
  COSTUME n45 tile "45" none #f2f7ff
  COSTUME n46 tile "46" none #f2f7ff
  COSTUME n47 tile "47" none #f2f7ff
  COSTUME n48 tile "48" none #f2f7ff
  COSTUME n49 tile "49" none #f2f7ff
  COSTUME n50 tile "50" none #f2f7ff
  COSTUME n51 tile "51" none #f2f7ff
  COSTUME n52 tile "52" none #f2f7ff
  COSTUME n53 tile "53" none #f2f7ff
  COSTUME n54 tile "54" none #f2f7ff
  COSTUME n55 tile "55" none #f2f7ff
  COSTUME n56 tile "56" none #f2f7ff
  COSTUME n57 tile "57" none #f2f7ff
  COSTUME n58 tile "58" none #f2f7ff
  COSTUME n59 tile "59" none #f2f7ff
  COSTUME n60 tile "60" none #f2f7ff
  COSTUME n61 tile "61" none #f2f7ff
  COSTUME n62 tile "62" none #f2f7ff
  COSTUME n63 tile "63" none #f2f7ff
  COSTUME n64 tile "64" none #f2f7ff
  COSTUME n65 tile "65" none #f2f7ff
  COSTUME n66 tile "66" none #f2f7ff
  COSTUME n67 tile "67" none #f2f7ff
  COSTUME n68 tile "68" none #f2f7ff
  COSTUME n69 tile "69" none #f2f7ff
  COSTUME n70 tile "70" none #f2f7ff
  COSTUME n71 tile "71" none #f2f7ff
  COSTUME n72 tile "72" none #f2f7ff
  COSTUME n73 tile "73" none #f2f7ff
  COSTUME n74 tile "74" none #f2f7ff
  COSTUME n75 tile "75" none #f2f7ff
  SOUND call 660
  SOUND bingo 990

  WHEN I receive "deal bingo":
    set calls to 0
    set called to 0
    new array "pool" = range 1 to 75
    deal cards
    render tables
    say "Space called! Q B M to daub" for 2 seconds
    call numbers

  DEFINE FAST deal cards:
    new 2D array "cards" = [[0,0,0,0,0]]
    new 2D array "daubs" = [[0,0,0,0,0]]
    set r to 1
    REPEAT 15:
      set c to 1
      REPEAT 5:
        set item row r col c of array "cards" to 0
        set item row r col c of array "daubs" to 0
        change c by 1
      change r by 1
    set p to 0
    REPEAT 3:
      set c to 1
      REPEAT 5:
        set lo to ((c - 1) * 15)
        set i to 1
        REPEAT 5:
          set dup to 1
          REPEAT UNTIL dup = 0:
            set cand to (lo + (pick random 1 to 15))
            set dup to 0
            set base to 1
            REPEAT 5:
              IF item row ((p * 5) + base) col c of array "cards" = cand THEN:
                set dup to 1
              change base by 1
          set item row ((p * 5) + i) col c of array "cards" to cand
          change i by 1
        change c by 1
      set item row ((p * 5) + 3) col 3 of array "daubs" to 1
      change p by 1

  DEFINE FAST render tables:
    clear
    set p to 0
    REPEAT 3:
      set cx to (-150 + (p * 150))
      set r to 1
      REPEAT 5:
        set c to 1
        REPEAT 5:
          go to x: (cx + ((c - 3) * 27)) y: (58 - ((r - 1) * 27))
          set size to 33
          IF item row ((p * 5) + r) col c of array "daubs" = 1 THEN:
            switch costume to daub
          ELSE:
            switch costume to cell
          stamp
          IF r = 3 and c = 3 THEN:
            switch costume to free
          ELSE:
            switch costume to ("n" join (item row ((p * 5) + r) col c of array "cards"))
          stamp
          change c by 1
        change r by 1
      change p by 1
    IF called > 0 THEN:
      go to x: 0 y: 140
      set size to 90
      switch costume to ("n" join called)
      stamp
    go to x: 0 y: 200
    switch costume to blank
    set size to 100

  DEFINE call numbers:
    REPEAT UNTIL started = 0:
      wait 3 seconds
      IF started = 1 THEN:
        IF length of array "pool" > 0 THEN:
          set i to pick random 1 to (length of array "pool")
          set called to (item i of array "pool")
          remove item i of array "pool"
          change calls by 1
          play sound "call"
          render tables
        ELSE:
          set started to 0
          say "The pool is empty — nobody bingoed." for 3 seconds

  DEFINE daub for (who):
    IF started = 1 and called > 0 THEN:
      set hit to 0
      set r to 1
      REPEAT 5:
        set c to 1
        REPEAT 5:
          IF item row ((who * 5) + r) col c of array "cards" = called THEN:
            IF item row ((who * 5) + r) col c of array "daubs" = 0 THEN:
              set item row ((who * 5) + r) col c of array "daubs" to 1
              set hit to 1
          change c by 1
        change r by 1
      IF hit = 1 THEN:
        render tables
        check bingo for (who)

  DEFINE check bingo for (who):
    set run to 0
    set r to 1
    REPEAT 5:
      set base to 0
      set c to 1
      REPEAT 5:
        change base by (item row ((who * 5) + r) col c of array "daubs")
        change c by 1
      IF base = 5 THEN:
        set run to 1
      change r by 1
    set c to 1
    REPEAT 5:
      set base to 0
      set r to 1
      REPEAT 5:
        change base by (item row ((who * 5) + r) col c of array "daubs")
        change r by 1
      IF base = 5 THEN:
        set run to 1
      change c by 1
    set base to 0
    set i to 1
    REPEAT 5:
      change base by (item row ((who * 5) + i) col i of array "daubs")
      change i by 1
    IF base = 5 THEN:
      set run to 1
    set base to 0
    set i to 1
    REPEAT 5:
      change base by (item row ((who * 5) + i) col (6 - i) of array "daubs")
      change i by 1
    IF base = 5 THEN:
      set run to 1
    IF run = 1 THEN:
      set started to 0
      set winner to (who + 1)
      play sound "bingo"
      say (join "BINGO! Player " (join winner (join " wins after " (join calls " calls")))) for 4 seconds

  WHEN q key pressed:
    daub for (0)
  WHEN b key pressed:
    daub for (1)
  WHEN m key pressed:
    daub for (2)`

};

// A keyboard-only title gate makes a project appear broken in the editor's
// normal right-hand stage on tablets: the green flag resets the game, but an
// on-screen keyboard never appears to deliver the second, Space-key event.
// Keep each authored Space handler for desktop play and clone only its first
// (title/start) script behind a delayed green-flag broadcast. This is done in
// the exported pseudocode rather than in the GUI or VM, so downloaded projects
// remain self-contained and behave the same outside BrickWright.
const addRightPaneGreenFlagStart = source => {
    if (source.includes('__brickwright_start_from_flag') || !source.includes('  WHEN space key pressed:')) {
        return source;
    }

    const lines = source.split('\n');
    const spaceHat = lines.findIndex(line => line === '  WHEN space key pressed:');
    if (spaceHat < 0) return source;

    let endOfHandler = spaceHat + 1;
    while (endOfHandler < lines.length &&
        (lines[endOfHandler].trim() === '' || lines[endOfHandler].startsWith('    '))) {
        endOfHandler++;
    }
    const startBody = lines.slice(spaceHat + 1, endOfHandler);
    if (startBody.length === 0) return source;
    const actionElse = startBody.findIndex(line => line === '    ELSE:');
    const greenFlagStartBody = actionElse < 0 ? startBody : startBody.slice(0, actionElse);

    // A real Space start must cancel the delayed tablet fallback permanently
    // for this green-flag run. Several finite games intentionally reset their
    // public `started` variable when they finish; using that variable alone
    // lets the stale 0.6 s timer start a fresh round over the result screen.
    lines.splice(spaceHat + 2, 0, '      set brickwrightFlagPending to 0');
    endOfHandler++;
    lines.splice(endOfHandler, 0,
        '  WHEN I receive "__brickwright_start_from_flag":',
        ...greenFlagStartBody
    );

    const firstSprite = lines.findIndex(line => line.startsWith('SPRITE '));
    if (firstSprite < 0) return source;
    lines.splice(firstSprite, 0,
        '  WHEN flag clicked:',
        '    set brickwrightFlagPending to 1',
        '    wait 0.6 seconds',
        '    IF brickwrightFlagPending = 1 THEN:',
        '      set brickwrightFlagPending to 0',
        '      broadcast "__brickwright_start_from_flag"',
        ''
    );
    const stage = lines.findIndex(line => line === 'STAGE:');
    if (stage < 0) return source;
    lines.splice(stage, 0, 'GLOBAL brickwrightFlagPending', '');
    return lines.join('\n');
};

const gameExamples = Object.fromEntries(Object.entries(rawGameExamples).map(([name, source]) => [
    name,
    name === 'g2048' ? source : addRightPaneGreenFlagStart(source)
]));

export default gameExamples;
