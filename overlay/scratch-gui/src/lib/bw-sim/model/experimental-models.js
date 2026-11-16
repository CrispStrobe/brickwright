// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 CrispStrobe
// Checkpoint candidates are deliberately separate from the qualified registry.
export const EXPERIMENTAL_MODELS = Object.freeze([
    {
        "file": "bloom.ldr",
        "title": {
            "en": "Bloom — expanding scissor sphere",
            "de": "Bloom — expandierende Scherenkugel"
        },
        "example": "bloom.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Three rings of angulated scissors with a fixed 135° kink: one motor through a 72:1 drive opens the cage, and every pivot slides along a straight radial line.",
            "de": "Drei Ringe aus abgewinkelten Scheren mit festem 135°-Knick: Ein Motor öffnet den Käfig über eine 72:1-Untersetzung, und jedes Gelenk gleitet auf einer radialen Geraden."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 1296,
                "stepDeg": 144,
                "speedDps": 144
            }
        }
    },
    {
        "file": "vector-delta.ldr",
        "title": {
            "en": "Vector — parallel Delta robot",
            "de": "Vector — paralleler Delta-Roboter"
        },
        "example": "vector-delta.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "A Delta parallel robot: three base motors and parallelogram arms move a tool head that can only translate, and the program computes the inverse kinematics for every waypoint.",
            "de": "Ein paralleler Delta-Roboter: Drei Motoren an der Basis und Parallelogrammarme bewegen einen Werkzeugkopf, der nur verschoben werden kann; das Programm berechnet für jeden Wegpunkt die inverse Kinematik."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 24,
                "stepDeg": 3,
                "speedDps": 15
            },
            "B": {
                "minDeg": 0,
                "maxDeg": 24,
                "stepDeg": 3,
                "speedDps": 15
            },
            "C": {
                "minDeg": 0,
                "maxDeg": 24,
                "stepDeg": 3,
                "speedDps": 15
            }
        }
    },
    {
        "file": "equinox-differential.ldr",
        "title": {
            "en": "Equinox — differential lab",
            "de": "Equinox — Differenzial-Labor"
        },
        "example": "equinox-differential.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "An open bevel differential on a bench: motor A drives the carrier, while motors B and C only coast or brake the outputs, so you can test ω_L + ω_R = 2·ω_carrier stage by stage.",
            "de": "Ein offenes Kegelraddifferenzial auf dem Prüfstand: Motor A treibt den Träger, die Motoren B und C lassen die Abtriebe nur auslaufen oder bremsen sie – so lässt sich ω_L + ω_R = 2·ω_Träger Stufe für Stufe prüfen."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 2520,
                "stepDeg": 210,
                "speedDps": 105
            }
        }
    },
    {
        "file": "aster-governor.ldr",
        "title": {
            "en": "Aster — centrifugal governor",
            "de": "Aster — Fliehkraftregler"
        },
        "example": "aster-governor.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Passive flyweights on a hinged rhombus lift a sliding collar as motor A spins the spindle faster; it senses speed (ω²) but, with no throttle, does not regulate it.",
            "de": "Passive Fliehgewichte an einer Gelenkraute heben eine Gleitmuffe, wenn Motor A die Spindel schneller dreht; der Regler misst die Drehzahl (ω²), regelt sie aber mangels Drossel nicht."
        }
    },
    {
        "file": "solstice-pumpjack.ldr",
        "title": {
            "en": "Solstice — walking-beam pumpjack",
            "de": "Solstice — Schwingbalken-Pumpenantrieb"
        },
        "example": "solstice-pumpjack.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "A Grashof crank-rocker nods a walking beam, and a hanging rod drives a guided rack up and down as a pump plunger; no fluid is modelled.",
            "de": "Eine Kurbelschwinge nach Grashof lässt einen Schwengel nicken, und eine Hängestange bewegt eine geführte Zahnstange als Pumpenkolben auf und ab; Flüssigkeit wird nicht modelliert."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 360,
                "stepDeg": 30,
                "speedDps": 30
            }
        }
    },
    {
        "file": "inertia-loop.ldr",
        "title": {
            "en": "Inertia Loop — closed shape cycle",
            "de": "Inertia Loop — geschlossener Formzyklus"
        },
        "example": "inertia-loop.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "A flywheel and movable masses ride on a free-turning platform: spin, spread, spin back and retract, and the platform ends up facing a new direction although both motors return home. Experimental: the effect has not yet been independently measured.",
            "de": "Schwungrad und verschiebbare Massen sitzen auf einer frei drehbaren Plattform: Drehen, Spreizen, Zurückdrehen, Einziehen – und die Plattform zeigt in eine neue Richtung, obwohl beide Motoren zurückkehren. Experimentell: Der Effekt wurde noch nicht unabhängig gemessen."
        },
        "manualJog": {
            "A": {
                "minDeg": -5,
                "maxDeg": 10805,
                "stepDeg": 1080,
                "speedDps": 420
            },
            "B": {
                "minDeg": -315,
                "maxDeg": 9.5,
                "stepDeg": 76.4,
                "speedDps": 90
            }
        }
    },
    {
        "file": "pan-shift.ldr",
        "title": {
            "en": "Pan Shift — load-position experiment",
            "de": "Pan Shift — Versuch zur Lastposition"
        },
        "example": "pan-shift.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "A Roberval balance: moving a weight across the parallelogram-guided pan should not tip the beam, while moving a trim weight on the beam must. Experimental: not yet independently measured.",
            "de": "Eine Roberval-Waage: Ein Gewicht auf der parallel geführten Schale zu verschieben, sollte den Balken nicht kippen – ein Trimmgewicht auf dem Balken dagegen schon. Experimentell: noch nicht unabhängig gemessen."
        },
        "manualJog": {
            "A": {
                "minDeg": -1,
                "maxDeg": 181,
                "stepDeg": 15,
                "speedDps": 10
            },
            "B": {
                "minDeg": -61,
                "maxDeg": 61,
                "stepDeg": 5,
                "speedDps": 5
            }
        }
    },
    {
        "file": "vesper-quickreturn.ldr",
        "title": {
            "en": "Vesper — quick-return shaper",
            "de": "Vesper — Schnellrücklauf mit Kurbelschleife"
        },
        "example": "vesper-quickreturn.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "A crank and slotted lever turn steady motor rotation into a slow working stroke and a quick return, about 1.46 : 1, as in a metal shaping machine. Experimental: not yet independently measured.",
            "de": "Kurbel und schwingende Kurbelschleife machen aus gleichmäßiger Motordrehung einen langsamen Arbeitshub und einen schnellen Rücklauf, etwa 1,46 : 1, wie in einer Stoßmaschine. Experimentell: noch nicht unabhängig gemessen."
        },
        "manualJog": {
            "A": {
                "minDeg": -2,
                "maxDeg": 1082,
                "stepDeg": 15,
                "speedDps": 30
            }
        }
    },
    {
        "file": "poise-mass-control.ldr",
        "title": {
            "en": "Poise Mass Control — 1.5 g added to the left pan",
            "de": "Poise-Kontrolle — 1,5 g Zusatzmasse links"
        },
        "example": "poise.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Poise with one small beam and two pins added under the left pan: the same program now tilts the balance, which settles near −2.9° after about two minutes.",
            "de": "Poise mit einem kleinen Balken und zwei Pins unter der linken Schale: Dasselbe Programm neigt nun die Waage, die sich nach etwa zwei Minuten bei −2,9° einpendelt."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 180,
                "stepDeg": 45,
                "speedDps": 15
            },
            "B": {
                "minDeg": 0,
                "maxDeg": 180,
                "stepDeg": 45,
                "speedDps": 15
            }
        }
    },
    {
        "file": "equal-share-even-springs.ldr",
        "title": {
            "en": "Equal Share Even Springs — one spring per side",
            "de": "Equal-Share-Kontrolle — je eine Feder pro Seite"
        },
        "example": "equal-share.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Equal Share with the right-hand pair replaced by one matching spring: the same program now compresses both springs equally and the beam stays square.",
            "de": "Equal Share, bei dem eine gleiche Feder das rechte Paar ersetzt: Dasselbe Programm drückt nun beide Federn gleich weit zusammen, und der Balken bleibt gerade."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 35,
                "stepDeg": 5,
                "speedDps": 8
            }
        }
    },
    {
        "file": "spiral-scribe.ldr",
        "title": {
            "en": "Spiral Scribe — one-motor radial feed",
            "de": "Spiral Scribe — radialer Vorschub mit einem Motor"
        },
        "example": "spiral-scribe.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "One motor turns a carrier around a fixed sun and feeds a marker outward. The simulator predicts 37.7 mm per carrier turn; the drawn 18942 rack and 12-tooth pinion imply 38.4 mm. The model remains experimental; neither value is a measurement of real parts.",
            "de": "Ein Motor dreht einen Träger um ein festes Sonnenrad und schiebt eine Markierung nach außen. Der Simulator berechnet 37,7 mm Vorschub je Trägerumdrehung; gezeichnete Zahnstange 18942 und 12-Zahn-Ritzel ergeben 38,4 mm. Das Modell bleibt experimentell; keiner der Werte ist an echten Bauteilen gemessen."
        },
        "manualJog": {
            "A": {
                "minDeg": -1080,
                "maxDeg": 0,
                "stepDeg": 90,
                "speedDps": 60
            }
        }
    },
    {
        "file": "impulse-line.ldr",
        "title": {
            "en": "Impulse Line — contact transfer",
            "de": "Impulse Line — Impulsübertragung durch Kontakt"
        },
        "example": "impulse-line.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "A separate motor pusher launches the first of three free pendulums, then withdraws. Follow motion through actual bob contacts and compare a physical middle-pendulum-absent control.",
            "de": "Ein eigener motorisierter Anhebearm regt das erste von drei freien Pendeln an und zieht sich zurück. Beobachte die Bewegung durch echte Kontakte zwischen den Pendelkörpern und vergleiche mit dem physisch entfernten mittleren Pendel."
        },
        "manualJog": {
            "A": {
                "minDeg": -24,
                "maxDeg": 0,
                "stepDeg": 4,
                "speedDps": 15
            }
        }
    },
    {
        "file": "impulse-line-missing-middle.ldr",
        "title": {
            "en": "Impulse Line Control — middle pendulum removed",
            "de": "Impulse-Line-Kontrolle — ohne mittleres Pendel"
        },
        "example": "impulse-line.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Impulse Line with the middle pendulum removed and everything else unchanged. The same launch no longer reaches the last pendulum, which stays practically still.",
            "de": "Impulse Line ohne das mittlere Pendel, sonst unverändert. Derselbe Anstoß erreicht das letzte Pendel nicht mehr; es bleibt praktisch still."
        },
        "manualJog": {
            "A": {
                "minDeg": -24,
                "maxDeg": 0,
                "stepDeg": 4,
                "speedDps": 15
            }
        }
    },
    {
        "file": "travel-dial-wheel-raised.ldr",
        "title": {
            "en": "Travel Dial Control — wheel raised",
            "de": "Travel-Dial-Kontrolle — Rad angehoben"
        },
        "example": "travel-dial.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Travel Dial with the measuring wheel lifted clear of the sled. The sled makes the same strokes, but without contact the wheel barely turns.",
            "de": "Travel Dial mit vom Schlitten abgehobenem Messrad. Der Schlitten fährt dieselben Hübe, doch ohne Kontakt dreht sich das Rad kaum."
        },
        "manualJog": {
            "A": {
                "minDeg": -60,
                "maxDeg": 60,
                "stepDeg": 15,
                "speedDps": 15
            }
        }
    },
    {
        "file": "ghost-pivot-unequal-link.ldr",
        "title": {
            "en": "Ghost Pivot Control — one link lengthened",
            "de": "Ghost-Pivot-Kontrolle — ein Glied verlängert"
        },
        "example": "ghost-pivot.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Ghost Pivot with one loop link replaced by a longer beam. The same motor sweep now moves the empty end hole by about 21 mm: the remote centre depends on exact link lengths.",
            "de": "Ghost Pivot mit einem längeren Balken als Glied der Schleife. Derselbe Motorschwenk verschiebt das leere Endloch nun um etwa 21 mm: Der fernliegende Drehpunkt hängt von genauen Gliedlängen ab."
        },
        "manualJog": {
            "A": {
                "minDeg": -35,
                "maxDeg": 35,
                "stepDeg": 5,
                "speedDps": 10
            }
        }
    },
    {
        "file": "afterturn-fixed-masses.ldr",
        "title": {
            "en": "Afterturn Control — masses fixed",
            "de": "Afterturn-Kontrolle — Massen fest"
        },
        "example": "afterturn.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Afterturn with both radial masses fixed at their outer position. The same wheel cycle now leaves practically no net heading, because the platform inertia never changes.",
            "de": "Afterturn mit beiden radialen Massen fest in der äußeren Stellung. Derselbe Radzyklus hinterlässt nun praktisch keine Nettodrehung, weil sich das Trägheitsmoment der Plattform nie ändert."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 900,
                "stepDeg": 90,
                "speedDps": 90
            },
            "B": {
                "minDeg": 0,
                "maxDeg": 70,
                "stepDeg": 10,
                "speedDps": 10
            }
        }
    },
    {
        "file": "quiet-partner.ldr",
        "title": {
            "en": "Quiet Partner — a passive vibration absorber",
            "de": "Quiet Partner — ein passiver Schwingungstilger"
        },
        "example": "quiet-partner.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "One fixed motor excites a passive primary rotor through two bands. Two more bands connect an unpowered partner. Compare the primary response with the matching control while the input keeps rocking.",
            "de": "Ein fest montierter Motor regt einen passiven Hauptrotor über zwei Bänder an. Zwei weitere Bänder koppeln einen ebenfalls unmotorisierten Partner an. Vergleiche die Antwort des Hauptrotors mit dem Kontrollmodell, während der Eingang weiter schwingt."
        },
        "manualJog": {
            "A": {
                "minDeg": -2,
                "maxDeg": 2,
                "stepDeg": 1,
                "speedDps": 13
            }
        }
    },
    {
        "file": "quiet-partner-control.ldr",
        "title": {
            "en": "Quiet Partner Control — absorber bands removed",
            "de": "Quiet Partner Control — ohne Tilgerbänder"
        },
        "example": "quiet-partner.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same rigid assembly and program, with only the two bands joining primary and partner removed. Compare primary motion during continuing drive with Quiet Partner; reload the saved model before every run.",
            "de": "Derselbe starre Aufbau und dasselbe Programm; nur die beiden Bänder zwischen Hauptrotor und Partner fehlen. Vergleiche die Bewegung des Hauptrotors während fortgesetzter Anregung mit Quiet Partner. Lade vor jedem Lauf das gespeicherte Modell neu."
        },
        "manualJog": {
            "A": {
                "minDeg": -2,
                "maxDeg": 2,
                "stepDeg": 1,
                "speedDps": 13
            }
        }
    },
    {
        "file": "high-select-mirror.ldr",
        "title": {
            "en": "High Select — exchanged-input comparison",
            "de": "High Select — Vergleich mit vertauschten Eingaben"
        },
        "example": "high-select-mirror.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Exchange the A and B input-height sequences on the same saved mechanism. Compare the passive bridge height at corresponding settled stages: max(a,b) equals max(b,a), although the active supporting side changes.",
            "de": "Vertausche die Höhenfolgen für A und B am selben gespeicherten Mechanismus. Vergleiche die passive Brückenhöhe in entsprechenden eingeschwungenen Stufen: max(a,b) ist gleich max(b,a), obwohl die tragende Seite wechselt."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 152,
                "stepDeg": 19,
                "speedDps": 38
            },
            "B": {
                "minDeg": 0,
                "maxDeg": 152,
                "stepDeg": 19,
                "speedDps": 38
            }
        }
    },
    {
        "file": "obliquity-orrery-turned-axis.ldr",
        "title": {
            "en": "Obliquity Orrery — turned axis (control)",
            "de": "Obliquity Orrery — gedrehte Achse (Kontrolle)"
        },
        "example": "obliquity-orrery-turned-axis.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Control: the same orrery with the Earth's tilt turned 90° about its spindle. The tilt and the program are unchanged, but midsummer moves a quarter of an orbit along.",
            "de": "Kontrolle: dasselbe Orrery, die Neigung der Erde um 90° um ihre Spindel gedreht. Neigung und Programm sind gleich, aber der Hochsommer wandert um eine Viertelbahn."
        },
        "manualJog": {
            "A": {
                "minDeg": -90,
                "maxDeg": 0,
                "stepDeg": 5,
                "speedDps": 12
            }
        }
    },
    {
        "file": "pivot-exchange-wide.ldr",
        "title": {
            "en": "Pivot Exchange — 20° release comparison",
            "de": "Pivot Exchange — Vergleich mit 20° Anfangsauslenkung"
        },
        "example": "pivot-exchange.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Load the same three pendulum constructions with a saved 20° release. Compare actual cycle periods and amplitudes with the fresh 8° model, keeping each arm’s parts, ballast and suspension hole unchanged.",
            "de": "Lade dieselben drei Pendelkonstruktionen mit einer gespeicherten 20°-Auslenkung. Vergleiche tatsächliche Perioden und Amplituden mit dem frisch geladenen 8°-Modell. Teile, Zusatzmasse und Aufhängungsbohrung jedes Arms bleiben gleich."
        }
    },
    {
        "file": "air-budget-two-tanks.ldr",
        "title": {
            "en": "Air Budget — two-tank comparison",
            "de": "Air Budget — Vergleich mit zwei Lufttanks"
        },
        "example": "air-budget.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Add a second connected stock air tank and repeat the same forward-and-return program. Compare pressure gain per observed compression travel with the one-tank model.",
            "de": "Schließe einen zweiten Standard-Lufttank an und wiederhole dasselbe Vorwärts-und-zurück-Programm. Vergleiche den Druckanstieg je beobachtetem Verdichtungsweg mit dem Modell mit einem Tank."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 3240,
                "stepDeg": 180,
                "speedDps": 270
            }
        }
    },
    {
        "file": "foldback-open.ldr",
        "title": {
            "en": "Foldback — open parallelogram (comparison)",
            "de": "Foldback — offenes Parallelogramm (Vergleich)"
        },
        "example": "foldback.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same parts re-assembled as an open parallelogram. The same program now makes the output copy the input one-for-one, in the same direction.",
            "de": "Dieselben Teile als offenes Parallelogramm zusammengebaut. Dasselbe Programm lässt den Abtrieb dem Eingang jetzt eins zu eins und in derselben Richtung folgen."
        },
        "manualJog": {
            "A": {
                "minDeg": -20,
                "maxDeg": 70,
                "stepDeg": 5,
                "speedDps": 15
            }
        }
    },
    {
        "file": "thirdline-control.ldr",
        "title": {
            "en": "Thirdline — shorter mark (control)",
            "de": "Thirdline — kürzere Markierung (Kontrolle)"
        },
        "example": "thirdline.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Control: the ruler's marked joint is one hole inward (24 mm instead of 32 mm). The line still moves freely, but it follows a different law and no longer trisects the angle.",
            "de": "Kontrolle: Das markierte Gelenk des Lineals sitzt ein Loch weiter innen (24 mm statt 32 mm). Die Gerade bewegt sich weiter frei, folgt aber einem anderen Gesetz und drittelt den Winkel nicht mehr."
        },
        "manualJog": {
            "A": {
                "minDeg": -5,
                "maxDeg": 40,
                "stepDeg": 5,
                "speedDps": 8
            }
        }
    },
    {
        "file": "samebeat-conjugate.ldr",
        "title": {
            "en": "Samebeat — paired pivot",
            "de": "Samebeat — Partnerdrehpunkt"
        },
        "example": "samebeat.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same pendulum hung from its paired hole, 69% farther from its centre of mass. The period stays almost exactly the same.",
            "de": "Dasselbe Pendel am Partnerloch, 69 % weiter vom Schwerpunkt entfernt. Die Periode bleibt fast genau gleich."
        },
        "manualJog": {
            "A": {
                "minDeg": -8,
                "maxDeg": 8,
                "stepDeg": 4,
                "speedDps": 60
            }
        }
    },
    {
        "file": "samebeat-control.ldr",
        "title": {
            "en": "Samebeat — control pivot",
            "de": "Samebeat — Kontrolldrehpunkt"
        },
        "example": "samebeat.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same pendulum hung from a hole close to its centre of mass. It swings about 40% more slowly, as the formula predicts.",
            "de": "Dasselbe Pendel an einem Loch nahe am Schwerpunkt. Es schwingt etwa 40 % langsamer, wie die Formel vorhersagt."
        },
        "manualJog": {
            "A": {
                "minDeg": -8,
                "maxDeg": 8,
                "stepDeg": 4,
                "speedDps": 60
            }
        }
    },
    {
        "file": "carry-ratio-control.ldr",
        "title": {
            "en": "Carry Ratio — ball on the base (control)",
            "de": "Carry Ratio — Kugel auf dem Boden (Kontrolle)"
        },
        "example": "carry-ratio.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Control: the same ball lies on the fixed base instead of the moving deck. The deck moves exactly as before, but the ball is no longer carried.",
            "de": "Kontrolle: Dieselbe Kugel liegt auf der festen Grundplatte statt auf dem bewegten Tisch. Der Tisch fährt wie zuvor, aber die Kugel wird nicht mehr mitgenommen."
        },
        "manualJog": {
            "A": {
                "minDeg": -180,
                "maxDeg": 2880,
                "stepDeg": 90,
                "speedDps": 120
            }
        }
    },
    {
        "file": "sarrus-lift-single-chain.ldr",
        "title": {
            "en": "Sarrus Lift — single chain (control)",
            "de": "Sarrus Lift — nur eine Kette (Kontrolle)"
        },
        "example": "sarrus-lift-single-chain.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Control: Sarrus Lift with its perpendicular passive chain removed. With the motor held, the deck can no longer stay level: it sinks, tips and slides.",
            "de": "Kontrolle: Sarrus Lift ohne die senkrechte passive Kette. Bei gehaltenem Motor bleibt der Tisch nicht mehr waagerecht: Er sinkt, kippt und rutscht."
        }
    },
    {
        "file": "phasor-twin-control.ldr",
        "title": {
            "en": "Phasor Twin — in phase (control)",
            "de": "Phasor Twin — gleichphasig (Kontrolle)"
        },
        "example": "phasor-twin.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Control: both crank plates clocked to the same angle. The pistons keep their 32 mm strokes but move together, and the loop collapses to a line.",
            "de": "Kontrolle: Beide Kurbelscheiben stehen im selben Winkel. Die Kolben behalten ihren Hub von 32 mm, bewegen sich aber gemeinsam, und die Schleife fällt zu einer Geraden zusammen."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 720,
                "stepDeg": 45,
                "speedDps": 45
            }
        }
    },
    {
        "file": "rimrun-swapped.ldr",
        "title": {
            "en": "RimRun — ballast layouts exchanged (comparison)",
            "de": "RimRun — Ballast getauscht (Vergleich)"
        },
        "example": "rimrun.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same two rollers with their ballast layouts exchanged between the lanes: green now carries the outer ballast, orange the inner. If the inner-ballast roller still leads, the result follows the mass distribution, not the lane.",
            "de": "Dieselben zwei Rollkörper mit vertauschten Ballastanordnungen: Grün trägt jetzt den äußeren Ballast, Orange den inneren. Führt der Rollkörper mit innerem Ballast weiterhin, folgt das Ergebnis der Massenverteilung und nicht der Spur."
        }
    },
    {
        "id": "swayshift-in-phase",
        "file": "swayshift.ldr",
        "title": {
            "en": "SwayShift — full-period timing (comparison)",
            "de": "SwayShift — Timing über eine ganze Periode (Vergleich)"
        },
        "example": "swayshift-in-phase.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same trolley and the same two 22 mm moves, but the second move now starts one full swing period after the first instead of half a period. The two pushes add up and the pendulum keeps swinging after arrival.",
            "de": "Derselbe Schlitten mit denselben zwei 22-mm-Fahrten, aber die zweite Fahrt startet jetzt eine ganze statt einer halben Schwingungsperiode nach der ersten. Beide Anstöße addieren sich, und das Pendel schwingt nach der Ankunft weiter."
        }
    },
    {
        "file": "tipline-swapped.ldr",
        "title": {
            "en": "Tipline — ballast heights swapped (comparison)",
            "de": "Tipline — Ballasthöhen getauscht (Vergleich)"
        },
        "example": "tipline.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same machine with the ballast heights exchanged between the towers: green now has the high ballast, orange the low. The outcomes swap lanes too: the high-ballast tower still tips first, the low-ballast tower still slides.",
            "de": "Dieselbe Maschine mit vertauschten Ballasthöhen: Grün hat jetzt den hohen Ballast, Orange den tiefen. Auch die Ergebnisse wechseln die Spur: Der Turm mit hohem Ballast kippt weiterhin zuerst, der mit tiefem rutscht."
        }
    },
    {
        "file": "twistspan-inner.ldr",
        "title": {
            "en": "TwistSpan — inner ties (comparison)",
            "de": "TwistSpan — innere Befestigung (Vergleich)"
        },
        "example": "twistspan.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "The same two cords moved from the red outer collars to the green inner collars, halving the tie spacing from 64 mm to 32 mm. Every rigid part, the payload and the program stay the same; the passive twist now takes about twice as long.",
            "de": "Dieselben zwei Schnüre hängen jetzt an den grünen inneren statt an den roten äußeren Bundringen; der Befestigungsabstand halbiert sich von 64 mm auf 32 mm. Alle starren Teile, die Last und das Programm bleiben gleich; die passive Drehschwingung dauert jetzt etwa doppelt so lang."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 20,
                "stepDeg": 5,
                "speedDps": 10
            }
        }
    },
    {
        "file": "evenhand-control.ldr",
        "title": {
            "en": "Evenhand — weights moved inward (control)",
            "de": "Evenhand — Gewichte nach innen versetzt (Kontrolle)"
        },
        "example": "evenhand.bw",
        "mat": "plain",
        "experimental": true,
        "blocked": false,
        "intro": {
            "en": "Control: the same forearm counterweights sit 60 LDU instead of 100 LDU behind the elbow. The arm reaches the same nine poses, but now the motors must hold it against gravity, and the elbow torque changes with the forearm's angle.",
            "de": "Kontrolle: Dieselben Unterarm-Gegengewichte sitzen 60 statt 100 LDU hinter dem Ellbogen. Der Arm erreicht dieselben neun Stellungen, doch jetzt müssen die Motoren ihn gegen die Schwerkraft halten, und das Ellbogenmoment ändert sich mit dem Winkel des Unterarms."
        },
        "manualJog": {
            "A": {
                "minDeg": -20,
                "maxDeg": 20,
                "stepDeg": 5,
                "speedDps": 20
            },
            "B": {
                "minDeg": -30,
                "maxDeg": 30,
                "stepDeg": 5,
                "speedDps": 25
            }
        }
    }
]);
export const EXPERIMENTAL_MODEL_DETAILS = Object.freeze({
    "bloom.ldr": {
        "pieces": 781,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "Three rings of angulated scissors with a fixed 135° kink: one motor through a 72:1 drive opens the cage, and every pivot slides along a straight radial line.",
            "de": "Drei Ringe aus abgewinkelten Scheren mit festem 135°-Knick: Ein Motor öffnet den Käfig über eine 72:1-Untersetzung, und jedes Gelenk gleitet auf einer radialen Geraden."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "expanding scissor sphere",
            "de": "expandierende Scherenkugel"
        },
        "keywords": [
            "angulated scissors",
            "Hoberman",
            "expanding sphere",
            "deployable structure",
            "scissor linkage",
            "Scherengitter",
            "Hoberman-Kugel",
            "entfaltbares Tragwerk",
            "Scherenmechanismus",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "vector-delta.ldr": {
        "pieces": 353,
        "motors": 3,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "A Delta parallel robot: three base motors and parallelogram arms move a tool head that can only translate, and the program computes the inverse kinematics for every waypoint.",
            "de": "Ein paralleler Delta-Roboter: Drei Motoren an der Basis und Parallelogrammarme bewegen einen Werkzeugkopf, der nur verschoben werden kann; das Programm berechnet für jeden Wegpunkt die inverse Kinematik."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "parallel Delta robot",
            "de": "paralleler Delta-Roboter"
        },
        "keywords": [
            "Delta robot",
            "parallel robot",
            "Clavel",
            "inverse kinematics",
            "pick and place",
            "parallelogram",
            "Delta-Roboter",
            "Parallelkinematik",
            "inverse Kinematik",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "equinox-differential.ldr": {
        "pieces": 98,
        "motors": 3,
        "hubs": [
            "spike-prime"
        ],
        "topic": "gears",
        "description": {
            "en": "An open bevel differential on a bench: motor A drives the carrier, while motors B and C only coast or brake the outputs, so you can test ω_L + ω_R = 2·ω_carrier stage by stage.",
            "de": "Ein offenes Kegelraddifferenzial auf dem Prüfstand: Motor A treibt den Träger, die Motoren B und C lassen die Abtriebe nur auslaufen oder bremsen sie – so lässt sich ω_L + ω_R = 2·ω_Träger Stufe für Stufe prüfen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "differential lab",
            "de": "Differenzial-Labor"
        },
        "keywords": [
            "differential",
            "open differential",
            "bevel gears",
            "carrier",
            "planetary bevel",
            "Differenzial",
            "Ausgleichsgetriebe",
            "Kegelrad",
            "Achswellenrad",
            "angular velocity sum",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "aster-governor.ldr": {
        "pieces": 144,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "Passive flyweights on a hinged rhombus lift a sliding collar as motor A spins the spindle faster; it senses speed (ω²) but, with no throttle, does not regulate it.",
            "de": "Passive Fliehgewichte an einer Gelenkraute heben eine Gleitmuffe, wenn Motor A die Spindel schneller dreht; der Regler misst die Drehzahl (ω²), regelt sie aber mangels Drossel nicht."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "centrifugal governor",
            "de": "Fliehkraftregler"
        },
        "keywords": [
            "centrifugal governor",
            "flyball governor",
            "Porter governor",
            "Watt governor",
            "collar",
            "flyweights",
            "angular speed squared",
            "Fliehkraftregler",
            "Muffe",
            "Fliehgewichte",
            "Drehzahlregler",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "solstice-pumpjack.ldr": {
        "pieces": 93,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "A Grashof crank-rocker nods a walking beam, and a hanging rod drives a guided rack up and down as a pump plunger; no fluid is modelled.",
            "de": "Eine Kurbelschwinge nach Grashof lässt einen Schwengel nicken, und eine Hängestange bewegt eine geführte Zahnstange als Pumpenkolben auf und ab; Flüssigkeit wird nicht modelliert."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "walking-beam pumpjack",
            "de": "Schwingbalken-Pumpenantrieb"
        },
        "keywords": [
            "pumpjack",
            "beam pump",
            "nodding donkey",
            "walking beam",
            "crank-rocker",
            "Grashof",
            "Pferdekopfpumpe",
            "Tiefpumpe",
            "Schwengel",
            "Kurbelschwinge",
            "Balancier",
            "crank rocker",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "inertia-loop.ldr": {
        "pieces": 314,
        "motors": 2,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "A flywheel and movable masses ride on a free-turning platform: spin, spread, spin back and retract, and the platform ends up facing a new direction although both motors return home. Experimental: the effect has not yet been independently measured.",
            "de": "Schwungrad und verschiebbare Massen sitzen auf einer frei drehbaren Plattform: Drehen, Spreizen, Zurückdrehen, Einziehen – und die Plattform zeigt in eine neue Richtung, obwohl beide Motoren zurückkehren. Experimentell: Der Effekt wurde noch nicht unabhängig gemessen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "closed shape cycle",
            "de": "geschlossener Formzyklus"
        },
        "keywords": [
            "angular momentum",
            "conservation of angular momentum",
            "reaction wheel",
            "flywheel",
            "moment of inertia",
            "geometric phase",
            "falling cat",
            "zero angular momentum reorientation",
            "Drehimpulserhaltung",
            "Schwungrad",
            "Reaktionsrad",
            "Trägheitsmoment",
            "geometrische Phase",
            "Katzenreflex",
            "shape cycle",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "pan-shift.ldr": {
        "pieces": 197,
        "motors": 2,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "A Roberval balance: moving a weight across the parallelogram-guided pan should not tip the beam, while moving a trim weight on the beam must. Experimental: not yet independently measured.",
            "de": "Eine Roberval-Waage: Ein Gewicht auf der parallel geführten Schale zu verschieben, sollte den Balken nicht kippen – ein Trimmgewicht auf dem Balken dagegen schon. Experimentell: noch nicht unabhängig gemessen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "load-position experiment",
            "de": "Versuch zur Lastposition"
        },
        "keywords": [
            "Roberval balance",
            "Roberval paradox",
            "parallelogram balance",
            "scale",
            "corner-load error",
            "moment",
            "couple",
            "Roberval-Waage",
            "Robervalsches Paradoxon",
            "Parallelogrammwaage",
            "Ecklastfehler",
            "Kräftepaar",
            "balance",
            "load position",
            "parallelogram",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "vesper-quickreturn.ldr": {
        "pieces": 91,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "A crank and slotted lever turn steady motor rotation into a slow working stroke and a quick return, about 1.46 : 1, as in a metal shaping machine. Experimental: not yet independently measured.",
            "de": "Kurbel und schwingende Kurbelschleife machen aus gleichmäßiger Motordrehung einen langsamen Arbeitshub und einen schnellen Rücklauf, etwa 1,46 : 1, wie in einer Stoßmaschine. Experimentell: noch nicht unabhängig gemessen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "quick-return shaper",
            "de": "Schnellrücklauf-Hobel"
        },
        "keywords": [
            "quick return",
            "quick-return mechanism",
            "crank and slotted lever",
            "shaper",
            "shaping machine",
            "Whitworth",
            "time ratio",
            "Schnellrücklauf",
            "schwingende Kurbelschleife",
            "Kurbelschleife",
            "Stoßmaschine",
            "Shapingmaschine",
            "Zeitverhältnis",
            "stroke timing",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "poise-mass-control.ldr": {
        "pieces": 162,
        "motors": 2,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "Poise with one small beam and two pins added under the left pan: the same program now tilts the balance, which settles near −2.9° after about two minutes.",
            "de": "Poise mit einem kleinen Balken und zwei Pins unter der linken Schale: Dasselbe Programm neigt nun die Waage, die sich nach etwa zwei Minuten bei −2,9° einpendelt."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "1.5 g added to the left pan",
            "de": "1,5 g Zusatzmasse links"
        },
        "keywords": [
            "Roberval balance",
            "added mass",
            "control",
            "weighing",
            "Kontrollversuch",
            "Zusatzmasse",
            "Roberval-Waage",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "equal-share-even-springs.ldr": {
        "pieces": 142,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "Equal Share with the right-hand pair replaced by one matching spring: the same program now compresses both springs equally and the beam stays square.",
            "de": "Equal Share, bei dem eine gleiche Feder das rechte Paar ersetzt: Dasselbe Programm drückt nun beide Federn gleich weit zusammen, und der Balken bleibt gerade."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "one spring per side",
            "de": "je eine Feder pro Seite"
        },
        "keywords": [
            "whippletree",
            "control",
            "equal springs",
            "Ausgleichsbalken",
            "Kontrollversuch",
            "gleiche Federn",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "spiral-scribe.ldr": {
        "pieces": 183,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "gears",
        "description": {
            "en": "One motor turns a carrier around a fixed sun and feeds a marker outward. The simulator predicts 37.7 mm per carrier turn; the drawn 18942 rack and 12-tooth pinion imply 38.4 mm. The model remains experimental; neither value is a measurement of real parts.",
            "de": "Ein Motor dreht einen Träger um ein festes Sonnenrad und schiebt eine Markierung nach außen. Der Simulator berechnet 37,7 mm Vorschub je Trägerumdrehung; gezeichnete Zahnstange 18942 und 12-Zahn-Ritzel ergeben 38,4 mm. Das Modell bleibt experimentell; keiner der Werte ist an echten Bauteilen gemessen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "one-motor radial feed",
            "de": "radialer Vorschub mit einem Motor"
        },
        "keywords": [
            "Archimedean spiral",
            "polar coordinates",
            "radial feed",
            "fixed sun",
            "planet carrier",
            "rack and pinion",
            "polar tracer",
            "archimedische Spirale",
            "Polarkoordinaten",
            "radialer Vorschub",
            "Planetenträger",
            "Zahnstange",
            "experimental",
            "prototype",
            "experimentell",
            "unverified"
        ],
        "experimental": true
    },
    "paired-door-sync.ldr": {
        "pieces": 88,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "gears",
        "description": {
            "en": "One 16T pinion drives two 64781 racks placed on opposite sides, so the two door leaves travel with equal speed in opposite directions and their sum of positions stays constant. The measured rack markers show the declared equal-and-opposite law, and a control with the front chain removed shows that one rack alone cannot synchronize a pair.",
            "de": "Ein 16-Zahn-Ritzel treibt zwei gegenüberliegende 64781-Zahnstangen, sodass sich beide Türblätter gleich schnell und gegenläufig bewegen und ihre Positionssumme konstant bleibt. Die gemessenen Zahnstangenmarker zeigen das erklärte gegenläufige Gesetz; eine Kontrolle ohne vordere Antriebskette zeigt, dass eine einzelne Zahnstange ein Paar nicht synchronisieren kann."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "opposed rack and pinion",
            "de": "gegenläufige Zahnstangen mit Ritzel"
        },
        "keywords": [
            "rack and pinion",
            "opposed racks",
            "paired sliding doors",
            "synchronization",
            "equal and opposite motion",
            "constant sum constraint",
            "direction reversal",
            "backlash",
            "Zahnstange und Ritzel",
            "gegenläufige Zahnstangen",
            "Doppelschiebetür",
            "Synchronisierung",
            "gleich große, entgegengesetzte Bewegung",
            "konstante Summenbedingung",
            "Richtungsumkehr",
            "Umkehrspiel",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "impulse-line.ldr": {
        "pieces": 140,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "A separate motor pusher launches the first of three free pendulums, then withdraws. Follow motion through actual bob contacts and compare a physical middle-pendulum-absent control.",
            "de": "Ein eigener motorisierter Anhebearm regt das erste von drei freien Pendeln an und zieht sich zurück. Beobachte die Bewegung durch echte Kontakte zwischen den Pendelkörpern und vergleiche mit dem physisch entfernten mittleren Pendel."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Dissipative pendulum impact chain",
            "de": "Dissipative Stoßkette aus Pendeln"
        },
        "keywords": [
            "impulse",
            "impact chain",
            "pendulum collision",
            "contact transfer",
            "dissipation",
            "Newton cradle comparison",
            "Impuls",
            "Stoßkette",
            "Pendelstoß",
            "Kontaktübertragung",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "impulse-line-missing-middle.ldr": {
        "pieces": 128,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "Impulse Line with the middle pendulum removed and everything else unchanged. The same launch no longer reaches the last pendulum, which stays practically still.",
            "de": "Impulse Line ohne das mittlere Pendel, sonst unverändert. Derselbe Anstoß erreicht das letzte Pendel nicht mehr; es bleibt praktisch still."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Dissipative pendulum impact chain",
            "de": "Dissipative Stoßkette aus Pendeln"
        },
        "keywords": [
            "impulse",
            "impact chain",
            "pendulum collision",
            "contact transfer",
            "dissipation",
            "Newton cradle comparison",
            "Impuls",
            "Stoßkette",
            "Pendelstoß",
            "Kontaktübertragung",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "travel-dial-wheel-raised.ldr": {
        "pieces": 197,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "motion",
        "description": {
            "en": "Travel Dial with the measuring wheel lifted clear of the sled. The sled makes the same strokes, but without contact the wheel barely turns.",
            "de": "Travel Dial mit vom Schlitten abgehobenem Messrad. Der Schlitten fährt dieselben Hübe, doch ohne Kontakt dreht sich das Rad kaum."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Passive rolling odometer",
            "de": "Passive Wegmessung durch ein abrollendes Rad"
        },
        "keywords": [
            "measuring wheel",
            "odometer",
            "rolling contact",
            "linear measurement",
            "slip",
            "Messrad",
            "Wegmessung",
            "Abrollen",
            "Schlupf",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "ghost-pivot-unequal-link.ldr": {
        "pieces": 86,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "motion",
        "description": {
            "en": "Ghost Pivot with one loop link replaced by a longer beam. The same motor sweep now moves the empty end hole by about 21 mm: the remote centre depends on exact link lengths.",
            "de": "Ghost Pivot mit einem längeren Balken als Glied der Schleife. Derselbe Motorschwenk verschiebt das leere Endloch nun um etwa 21 mm: Der fernliegende Drehpunkt hängt von genauen Gliedlängen ab."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Double-parallelogram remote centre of motion",
            "de": "Doppelparallelogramm mit fernliegendem Drehpunkt"
        },
        "keywords": [
            "remote centre",
            "remote center",
            "RCM",
            "virtual pivot",
            "double parallelogram",
            "passive linkage",
            "Fernzentrum",
            "Drehpunkt",
            "Doppelparallelogramm",
            "Koppelgetriebe",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "afterturn-fixed-masses.ldr": {
        "pieces": 296,
        "motors": 2,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "Afterturn with both radial masses fixed at their outer position. The same wheel cycle now leaves practically no net heading, because the platform inertia never changes.",
            "de": "Afterturn mit beiden radialen Massen fest in der äußeren Stellung. Derselbe Radzyklus hinterlässt nun praktisch keine Nettodrehung, weil sich das Trägheitsmoment der Plattform nie ändert."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Geometric-phase reorientation through a closed internal shape cycle",
            "de": "Umorientierung durch einen geschlossenen inneren Formzyklus"
        },
        "keywords": [
            "geometric phase",
            "shape cycle",
            "reaction wheel",
            "variable inertia",
            "angular momentum",
            "free yaw",
            "geometrische Phase",
            "Formzyklus",
            "Reaktionsrad",
            "veränderliches Trägheitsmoment",
            "Drehimpuls",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "quiet-partner.ldr": {
        "pieces": 234,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "One fixed motor excites a passive primary rotor through two bands. Two more bands connect an unpowered partner. Compare the primary response with the matching control while the input keeps rocking.",
            "de": "Ein fest montierter Motor regt einen passiven Hauptrotor über zwei Bänder an. Zwei weitere Bänder koppeln einen ebenfalls unmotorisierten Partner an. Vergleiche die Antwort des Hauptrotors mit dem Kontrollmodell, während der Eingang weiter schwingt."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "passive tuned vibration absorber comparison",
            "de": "Vergleich eines passiven abgestimmten Schwingungstilgers"
        },
        "keywords": [
            "vibration absorber",
            "tuned mass damper",
            "passive rotor",
            "continued drive",
            "finite comparison",
            "antiresonance",
            "control",
            "passiver Schwingungstilger",
            "Schwingungstilger",
            "Tilger",
            "Schwingung",
            "Kontrollmodell",
            "Gummiband",
            "experimental",
            "experimentell",
            "prototype",
            "unverified"
        ],
        "experimental": true
    },
    "quiet-partner-control.ldr": {
        "pieces": 232,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "The same rigid assembly and program, with only the two bands joining primary and partner removed. Compare primary motion during continuing drive with Quiet Partner; reload the saved model before every run.",
            "de": "Derselbe starre Aufbau und dasselbe Programm; nur die beiden Bänder zwischen Hauptrotor und Partner fehlen. Vergleiche die Bewegung des Hauptrotors während fortgesetzter Anregung mit Quiet Partner. Lade vor jedem Lauf das gespeicherte Modell neu."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "passive tuned vibration absorber comparison",
            "de": "Vergleich eines passiven abgestimmten Schwingungstilgers"
        },
        "keywords": [
            "vibration absorber",
            "tuned mass damper",
            "passive rotor",
            "continued drive",
            "finite comparison",
            "antiresonance",
            "control",
            "passiver Schwingungstilger",
            "Schwingungstilger",
            "Tilger",
            "Schwingung",
            "Kontrollmodell",
            "Gummiband",
            "experimental",
            "experimentell",
            "prototype",
            "unverified"
        ],
        "experimental": true
    },
    "high-select-mirror.ldr": {
        "pieces": 288,
        "motors": 2,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "Exchange the A and B input-height sequences on the same saved mechanism. Compare the passive bridge height at corresponding settled stages: max(a,b) equals max(b,a), although the active supporting side changes.",
            "de": "Vertausche die Höhenfolgen für A und B am selben gespeicherten Mechanismus. Vergleiche die passive Brückenhöhe in entsprechenden eingeschwungenen Stufen: max(a,b) ist gleich max(b,a), obwohl die tragende Seite wechselt."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "gravity-loaded unilateral maximum selector",
            "de": "schwerkraftbelasteter Maximumwähler mit einseitigen Kontakten"
        },
        "keywords": [
            "mechanical maximum",
            "maximum selector",
            "MAX",
            "rack",
            "gravity",
            "contact",
            "handover",
            "commutativity",
            "mechanisches Maximum",
            "Maximumwähler",
            "Zahnstange",
            "Schwerkraft",
            "Kontaktwechsel",
            "Kommutativität",
            "experimental",
            "experimentell",
            "prototype",
            "unverified"
        ],
        "experimental": true
    },
    "obliquity-orrery-turned-axis.ldr": {
        "pieces": 50,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "Control: the same orrery with the Earth's tilt turned 90° about its spindle. The tilt and the program are unchanged, but midsummer moves a quarter of an orbit along.",
            "de": "Kontrolle: dasselbe Orrery, die Neigung der Erde um 90° um ihre Spindel gedreht. Neigung und Programm sind gleich, aber der Hochsommer wandert um eine Viertelbahn."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Parallel-crank orrery with a fixed tilted axis",
            "de": "Parallelkurbel-Orrery mit fest geneigter Achse"
        },
        "keywords": [
            "orrery",
            "obliquity",
            "axial tilt",
            "solar declination",
            "seasons",
            "solstice",
            "equinox",
            "parallelogram linkage",
            "Schiefe der Ekliptik",
            "Achsneigung",
            "Sonnendeklination",
            "Jahreszeiten",
            "Sonnenwende",
            "Parallelogramm",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "pivot-exchange.ldr": {
        "pieces": 159,
        "motors": 0,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "Three identical weighted arms hang from different holes. From an 8° saved release, compare two nearly conjugate suspensions with a slower central-hole control. One shared observation program lets gravity provide the motion.",
            "de": "Drei identische beschwerte Arme hängen an verschiedenen Bohrungen. Vergleiche aus einer gespeicherten 8°-Auslenkung zwei nahezu konjugierte Aufhängungen mit der langsameren Kontrolle an der mittleren Bohrung. Ein gemeinsames Beobachtungsprogramm lässt die Schwerkraft für die Bewegung sorgen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "compound pendulum with nearly conjugate suspension choices",
            "de": "physikalisches Pendel mit nahezu konjugierten Aufhängungen"
        },
        "keywords": [
            "compound pendulum",
            "reversible pendulum",
            "conjugate pivots",
            "parallel axis theorem",
            "radius of gyration",
            "period",
            "gravity",
            "amplitude",
            "rotational inertia",
            "physikalisches Pendel",
            "Reversionspendel",
            "konjugierte Aufhängungen",
            "Steinerscher Satz",
            "Trägheitsradius",
            "Schwingungsdauer",
            "Schwerkraft",
            "Auslenkung",
            "Trägheitsmoment",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "pivot-exchange-wide.ldr": {
        "pieces": 159,
        "motors": 0,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "Load the same three pendulum constructions with a saved 20° release. Compare actual cycle periods and amplitudes with the fresh 8° model, keeping each arm’s parts, ballast and suspension hole unchanged.",
            "de": "Lade dieselben drei Pendelkonstruktionen mit einer gespeicherten 20°-Auslenkung. Vergleiche tatsächliche Perioden und Amplituden mit dem frisch geladenen 8°-Modell. Teile, Zusatzmasse und Aufhängungsbohrung jedes Arms bleiben gleich."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "compound pendulum with nearly conjugate suspension choices",
            "de": "physikalisches Pendel mit nahezu konjugierten Aufhängungen"
        },
        "keywords": [
            "compound pendulum",
            "reversible pendulum",
            "conjugate pivots",
            "parallel axis theorem",
            "radius of gyration",
            "period",
            "gravity",
            "amplitude",
            "rotational inertia",
            "physikalisches Pendel",
            "Reversionspendel",
            "konjugierte Aufhängungen",
            "Steinerscher Satz",
            "Trägheitsradius",
            "Schwingungsdauer",
            "Schwerkraft",
            "Auslenkung",
            "Trägheitsmoment",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "air-budget-two-tanks.ldr": {
        "pieces": 168,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "fluids",
        "description": {
            "en": "Add a second connected stock air tank and repeat the same forward-and-return program. Compare pressure gain per observed compression travel with the one-tank model.",
            "de": "Schließe einen zweiten Standard-Lufttank an und wiederhole dasselbe Vorwärts-und-zurück-Programm. Vergleiche den Druckanstieg je beobachtetem Verdichtungsweg mit dem Modell mit einem Tank."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "crank-driven pneumatic pump with finite reservoir comparison",
            "de": "kurbelgetriebene Pneumatikpumpe mit Vergleich begrenzter Speichervolumina"
        },
        "keywords": [
            "pneumatics",
            "air pressure",
            "pump",
            "reservoir volume",
            "one-way pump",
            "stored air",
            "swept volume",
            "compression travel",
            "check valve",
            "Pneumatik",
            "Luftdruck",
            "Pumpe",
            "Speichervolumen",
            "Rückschlagventil",
            "Luftvorrat",
            "Hubvolumen",
            "Verdichtungsweg",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "foldback-open.ldr": {
        "pieces": 95,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "The same parts re-assembled as an open parallelogram. The same program now makes the output copy the input one-for-one, in the same direction.",
            "de": "Dieselben Teile als offenes Parallelogramm zusammengebaut. Dasselbe Programm lässt den Abtrieb dem Eingang jetzt eins zu eins und in derselben Richtung folgen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Antiparallelogram / crossed four-bar linkage",
            "de": "Antiparallelogramm / gekreuztes Viergelenk"
        },
        "keywords": [
            "antiparallelogram",
            "crossed parallelogram",
            "crossed four-bar",
            "assembly branch",
            "tangent half angle",
            "Antiparallelogramm",
            "gekreuztes Viergelenk",
            "Montagezweig",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "thirdline-control.ldr": {
        "pieces": 179,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "Control: the ruler's marked joint is one hole inward (24 mm instead of 32 mm). The line still moves freely, but it follows a different law and no longer trisects the angle.",
            "de": "Kontrolle: Das markierte Gelenk des Lineals sitzt ein Loch weiter innen (24 mm statt 32 mm). Die Gerade bewegt sich weiter frei, folgt aber einem anderen Gesetz und drittelt den Winkel nicht mehr."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Archimedes / neusis angle trisector",
            "de": "Archimedische Winkeldreiteilung / Neusis-Konstruktion"
        },
        "keywords": [
            "angle trisector",
            "angle trisection",
            "neusis",
            "marked ruler",
            "Archimedes",
            "gearless angle division",
            "Winkeldreiteilung",
            "Neusis",
            "markiertes Lineal",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "samebeat-conjugate.ldr": {
        "pieces": 92,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "The same pendulum hung from its paired hole, 69% farther from its centre of mass. The period stays almost exactly the same.",
            "de": "Dasselbe Pendel am Partnerloch, 69 % weiter vom Schwerpunkt entfernt. Die Periode bleibt fast genau gleich."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Reversible compound pendulum — Kater principle",
            "de": "Reversionspendel — Kater-Prinzip"
        },
        "keywords": [
            "reversible pendulum",
            "compound pendulum",
            "physical pendulum",
            "Kater pendulum",
            "conjugate pivots",
            "centre of oscillation",
            "Reversionspendel",
            "physikalisches Pendel",
            "konjugierte Aufhängepunkte",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "samebeat-control.ldr": {
        "pieces": 92,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "The same pendulum hung from a hole close to its centre of mass. It swings about 40% more slowly, as the formula predicts.",
            "de": "Dasselbe Pendel an einem Loch nahe am Schwerpunkt. Es schwingt etwa 40 % langsamer, wie die Formel vorhersagt."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Reversible compound pendulum — Kater principle",
            "de": "Reversionspendel — Kater-Prinzip"
        },
        "keywords": [
            "reversible pendulum",
            "compound pendulum",
            "physical pendulum",
            "Kater pendulum",
            "conjugate pivots",
            "centre of oscillation",
            "Reversionspendel",
            "physikalisches Pendel",
            "konjugierte Aufhängepunkte",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "carry-ratio-control.ldr": {
        "pieces": 64,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "motion",
        "description": {
            "en": "Control: the same ball lies on the fixed base instead of the moving deck. The deck moves exactly as before, but the ball is no longer carried.",
            "de": "Kontrolle: Dieselbe Kugel liegt auf der festen Grundplatte statt auf dem bewegten Tisch. Der Tisch fährt wie zuvor, aber die Kugel wird nicht mehr mitgenommen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Free ball rolling on a slider-crank tray",
            "de": "Freie Kugel rollt auf einem Kurbeltisch"
        },
        "keywords": [
            "rolling without slipping",
            "no-slip transport",
            "rolling contact",
            "inertia-limited transport",
            "moment of inertia ratio",
            "friction cone",
            "contact limit",
            "Coulomb friction",
            "ungrasped payload",
            "spool on a plank",
            "Rollkontakt",
            "Rollen ohne Gleiten",
            "Transportverhältnis",
            "Trägheitsverhältnis",
            "Haftreibung",
            "Kontaktgrenze",
            "ungriffige Förderung",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "sarrus-lift-single-chain.ldr": {
        "pieces": 135,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "linkages",
        "description": {
            "en": "Control: Sarrus Lift with its perpendicular passive chain removed. With the motor held, the deck can no longer stay level: it sinks, tips and slides.",
            "de": "Kontrolle: Sarrus Lift ohne die senkrechte passive Kette. Bei gehaltenem Motor bleibt der Tisch nicht mehr waagerecht: Er sinkt, kippt und rutscht."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Sarrus linkage with one hinge chain removed",
            "de": "Sarrus-Getriebe mit nur einer Gelenkkette"
        },
        "keywords": [
            "Sarrus linkage",
            "straight-line linkage",
            "degrees of freedom",
            "hinge chain",
            "control",
            "Sarrus-Getriebe",
            "Geradführung",
            "Freiheitsgrade",
            "Gelenkkette",
            "Kontrolle",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "phasor-twin.ldr": {
        "pieces": 63,
        "motors": 1,
        "hubs": [],
        "topic": "linkages",
        "description": {
            "en": "Two vertical crank-slider pistons, coupled by a 40-tooth idler and two 16-tooth gears, run 90 degrees out of phase. Plotting the two passive piston displacements against each other gives a closed loop of area pi r^2; clocking both throws together collapses it to a line.",
            "de": "Zwei senkrechte Kurbelschleifen-Kolben, über ein 40-Zahn-Zwischenrad und zwei 16-Zahn-Ritzel gekoppelt, laufen um 90 Grad versetzt. Trägt man die beiden passiven Kolbenwege gegeneinander auf, entsteht ein geschlossener Ring der Fläche pi r^2; bei gleichphasigen Kurbeln fällt er zu einer Geraden zusammen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Two crank-sliders clocked 90° apart (Stirling phase loop)",
            "de": "Zwei Schubkurbeln mit 90° Versatz (Stirling-Phasenschleife)"
        },
        "keywords": [
            "Stirling cycle",
            "Stirling engine",
            "alpha Stirling",
            "Schmidt analysis",
            "phase angle",
            "90 degree volume phase",
            "quadrature piston phasing",
            "kinematic Stirling analogy",
            "crank-slider",
            "Stirling-Zyklus",
            "Stirling-Motor",
            "Alpha-Stirling",
            "Schmidt-Analyse",
            "Phasenwinkel",
            "90-Grad-Volumenphase",
            "Phasenquadratur",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "phasor-twin-control.ldr": {
        "pieces": 63,
        "motors": 1,
        "hubs": [],
        "topic": "linkages",
        "description": {
            "en": "Control: both crank plates clocked to the same angle. The pistons keep their 32 mm strokes but move together, and the loop collapses to a line.",
            "de": "Kontrolle: Beide Kurbelscheiben stehen im selben Winkel. Die Kolben behalten ihren Hub von 32 mm, bewegen sich aber gemeinsam, und die Schleife fällt zu einer Geraden zusammen."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Two crank-sliders clocked 90° apart (Stirling phase loop)",
            "de": "Zwei Schubkurbeln mit 90° Versatz (Stirling-Phasenschleife)"
        },
        "keywords": [
            "Stirling cycle",
            "Stirling engine",
            "alpha Stirling",
            "Schmidt analysis",
            "phase angle",
            "90 degree volume phase",
            "quadrature piston phasing",
            "kinematic Stirling analogy",
            "crank-slider",
            "Stirling-Zyklus",
            "Stirling-Motor",
            "Alpha-Stirling",
            "Schmidt-Analyse",
            "Phasenwinkel",
            "90-Grad-Volumenphase",
            "Phasenquadratur",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "rimrun-swapped.ldr": {
        "pieces": 506,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "inertia",
        "description": {
            "en": "The same two rollers with their ballast layouts exchanged between the lanes: green now carries the outer ballast, orange the inner. If the inner-ballast roller still leads, the result follows the mass distribution, not the lane.",
            "de": "Dieselben zwei Rollkörper mit vertauschten Ballastanordnungen: Grün trägt jetzt den äußeren Ballast, Orange den inneren. Führt der Rollkörper mit innerem Ballast weiterhin, folgt das Ergebnis der Massenverteilung und nicht der Spur."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "gravity-driven rolling: matched mass and radius, different axial inertia, lane-swap control",
            "de": "schwerkraftgetriebenes Rollen: gleiche Masse und gleicher Radius, anderes Trägheitsmoment, Spurtausch als Kontrolle"
        },
        "keywords": [
            "RimRun",
            "rolling inertia",
            "moment of inertia",
            "radial ballast",
            "same mass",
            "rolling race",
            "inclined plane",
            "no-slip rolling",
            "energy partition",
            "lane swap",
            "shared release gate",
            "Trägheitsmoment",
            "Rollversuch",
            "schiefe Ebene",
            "Ballast",
            "gleiche Masse",
            "Spurtausch",
            "Startschranke",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "swayshift-in-phase": {
        "pieces": 204,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "The same trolley and the same two 22 mm moves, but the second move now starts one full swing period after the first instead of half a period. The two pushes add up and the pendulum keeps swinging after arrival.",
            "de": "Derselbe Schlitten mit denselben zwei 22-mm-Fahrten, aber die zweite Fahrt startet jetzt eine ganze statt einer halben Schwingungsperiode nach der ersten. Beide Anstöße addieren sich, und das Pendel schwingt nach der Ankunft weiter."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "3:1 gear-driven rack trolley and passive rigid pendulum: finite command shaping",
            "de": "Zahnstangenschlitten mit 3:1-Zahnradantrieb und passivem starrem Pendel: Formung endlicher Fahrbefehle"
        },
        "keywords": [
            "SwayShift",
            "input shaping",
            "command shaping",
            "anti-sway",
            "residual vibration",
            "passive pendulum",
            "rack trolley",
            "half period",
            "phase cancellation",
            "Eingangsformung",
            "Nachschwingen",
            "Pendel",
            "Zahnstangenschlitten",
            "halbe Periode",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "tipline-swapped.ldr": {
        "pieces": 174,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "The same machine with the ballast heights exchanged between the towers: green now has the high ballast, orange the low. The outcomes swap lanes too: the high-ballast tower still tips first, the low-ballast tower still slides.",
            "de": "Dieselbe Maschine mit vertauschten Ballasthöhen: Grün hat jetzt den hohen Ballast, Orange den tiefen. Auch die Ergebnisse wechseln die Spur: Der Turm mit hohem Ballast kippt weiterhin zuerst, der mit tiefem rutscht."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "matched-load incline: center of mass, friction and first instability",
            "de": "Neigungsversuch mit gleichen Lasten: Schwerpunkt, Reibung und erste Instabilität"
        },
        "keywords": [
            "Tipline",
            "inclined plane",
            "tilting deck",
            "sliding",
            "tipping",
            "center of mass",
            "ballast height",
            "same mass",
            "friction",
            "static stability",
            "lane swap",
            "schiefe Ebene",
            "Rutschen",
            "Kippen",
            "Schwerpunkt",
            "Ballasthöhe",
            "Reibung",
            "Standfestigkeit",
            "passive catch wall",
            "Auffangwand",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "twistspan-inner.ldr": {
        "pieces": 107,
        "motors": 1,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "description": {
            "en": "The same two cords moved from the red outer collars to the green inner collars, halving the tie spacing from 64 mm to 32 mm. Every rigid part, the payload and the program stay the same; the passive twist now takes about twice as long.",
            "de": "Dieselben zwei Schnüre hängen jetzt an den grünen inneren statt an den roten äußeren Bundringen; der Befestigungsabstand halbiert sich von 64 mm auf 32 mm. Alle starren Teile, die Last und das Programm bleiben gleich; die passive Drehschwingung dauert jetzt etwa doppelt so lang."
        },
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "bifilar torsional pendulum",
            "de": "bifilares Torsionspendel"
        },
        "keywords": [
            "bifilar",
            "two cords",
            "fixed-length suspension",
            "torsional pendulum",
            "gravity",
            "moment of inertia",
            "attachment spacing",
            "passive oscillation",
            "Zweifadenpendel",
            "Torsionspendel",
            "Schwerkraft",
            "Trägheitsmoment",
            "Fadenabstand",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "experimental": true
    },
    "evenhand-control.ldr": {
        "pieces": 97,
        "motors": 2,
        "hubs": [
            "spike-prime"
        ],
        "topic": "forces",
        "author": "CrispStrobe",
        "license": "BSD-3-Clause",
        "mechanism": {
            "en": "Counterbalanced two-joint arm: gravity torque about each joint",
            "de": "Ausgewogener Zweigelenkarm: Schweremoment um jedes Gelenk"
        },
        "keywords": [
            "counterweight",
            "counterbalance",
            "gravity torque",
            "two-joint arm",
            "serial arm",
            "holding torque",
            "lever arm",
            "Gegengewicht",
            "Gewichtsausgleich",
            "Schweremoment",
            "Zweigelenkarm",
            "Haltemoment",
            "Hebelarm",
            "experimental",
            "prototype",
            "unverified",
            "experimentell"
        ],
        "description": {
            "en": "Control: the same forearm counterweights sit 60 LDU instead of 100 LDU behind the elbow. The arm reaches the same nine poses, but now the motors must hold it against gravity, and the elbow torque changes with the forearm's angle.",
            "de": "Kontrolle: Dieselben Unterarm-Gegengewichte sitzen 60 statt 100 LDU hinter dem Ellbogen. Der Arm erreicht dieselben neun Stellungen, doch jetzt müssen die Motoren ihn gegen die Schwerkraft halten, und das Ellbogenmoment ändert sich mit dem Winkel des Unterarms."
        },
        "experimental": true
    }
});
