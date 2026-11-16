# MakeCode arrow return annotations

Owner: user-assigned MakeCode translation implementation owner.
Status: local candidate, measured project comparison pending.
Base: `335262a933f65cb0b2653c24dc6e0bdef1149d93`.

Scope: the shared MakeCode TypeScript reader's parenthesized arrow branch and
original minimal regression tests. Read the return annotation before the arrow,
retain the annotation and parameter/default metadata, and preserve expression
and block bodies. Ordinary declarations and named function types retain their
existing scanner. Bare grouped/callable arrow return types remain refused;
this change does not infer missing project dependencies or erase diagnostics.

Qualification: exact private real-project subject/hash comparisons through the
existing audit runner, parser metadata and malformed-input controls, actual
raw Creator integration. Research sources are never redistributed. Keep the
frozen tutorial and genuine-project fixtures separate from research projects.
