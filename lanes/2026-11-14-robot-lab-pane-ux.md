# Robot Lab pane UX

Scope: prevent page text selection throughout the Robot Lab pane while preserving
native text editing, and provide accessible, localized dismissal of unchanged
blocker/model notices. Own the pane component, its scoped selection styles and
notice component, plus focused React/Chromium verification. No physics, model,
program, solver, dependency pin or workflow changes.

Qualification: focused React/jsdom tests and a local component browser build
using the actual warning render methods, mouse text selection and native keyboard
buttons in compact/wide English/German layouts. This does not qualify full
physics execution or a complete GUI release build.
