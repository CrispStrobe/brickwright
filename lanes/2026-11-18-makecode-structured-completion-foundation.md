# MakeCode structured-completion foundation

Owner: sole user-assigned MakeCode parser owner.
Base: `3039ab7327f87819144d0d9a4a87b6ba420c8125`.
Status: detached foundation; eight pure-state controls passed, runtime bridge absent.

Scope: a new detached VM utility, original pure-state controls, original future
source fixtures and engineering contract. The user authorized this isolated
implementation without a claim-only PR. Existing product sources, parser
refusals, dependency pins and workflows remain unchanged.

Completion/target/frame/suspension identities are invocation-local; finalizer
normal completion preserves pending abrupt completion, abrupt completion
overrides it, and Stop invalidates old leases. No runtime or compiler consumes
this module. Qualification must distinguish pure-state controls from actual
VM exception delivery and future original/native/Code/SB3 behavior. No corpus
execution, numeric coverage gain or full try/catch/finally support is claimed.
