# Example surfaces

A gallery listing can provide editable code, a circuit, an executable image, controller widgets, or a combination. Opening an example should carry the assets it declares through the ordinary Code, Circuit, Debugger, and Widgets entry points. An existing pane from a different target should give way when the example switches machines.

## Current coverage

The pinned gallery at `sb3-creator` revision `df11b236c` has 734 entries. It declares 14 Controller layouts and five executable ROMs outside CP1. These are counts of published assets. The successful load of a file or the visibility of a pane requires a runtime check.

| Example family | Current route | Next evidence |
| --- | --- | --- |
| Kosmos CP1 | The 53 examples pair `.cp1` assembly with an authored circuit. Code edits the same listing as the Debugger. Widgets shows the keypad and six segment digits from the same machine. A compatible monitor is a separate import. | Add a built-in independent ROM preset and qualify the full gallery-to-run flow on a fresh installation. Cover a simple display, a switch circuit, and a CP2/CP3 example. |
| AVR and other pseudocode targets | The regular `.bw` loader supplies the Code editor and Scratch project. The Debugger depends on the chosen target, connected pins or part bindings, and a supported compile or firmware path. Selected examples supply Widgets. | Qualify one full path each for ATtiny88, AVR, RP2040, and Circuit Playground and check their behavior when switching targets. |
| 6502 and Z80 | The loader can boot a declared ROM and the Debugger uses the extracted bus. Aurora65 also supplies a controller layout. Editor source, loadable images, and Widgets vary by example. | Use Aurora65 as the full bench case. Verify the mapping from editable source to the booted image, then exercise a Z80 example with a declared ROM. |
| LEGO and calculator faceplates | Examples such as `a2-faceplate-calculator` and `mb05-faceplate-calc` provide a `.bw` program and a controller layout. The selected hub or faceplate can be the working surface for an example without a breadboard circuit. | Qualify the Code and controller flow, expected virtual or physical hub selection, and restoration of the saved project. |
| Circuit experiments | The authored circuit is the main asset. A `program.bw` comment can be a catalog placeholder. | Teach the expected physical interaction and check loading over a previously active machine or controller. |

Start with a small browser matrix of the examples named above. For each, record which of the four panes the example should populate, that the circuit and debugger use the same machine, that input produces the specified observable output, and what is restored when the project reopens. Then add missing assets where they serve the lesson.
