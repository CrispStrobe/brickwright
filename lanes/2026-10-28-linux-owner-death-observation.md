# Linux direct-child owner-death observation — 2026-10-28

Owner: Codex SAMD dependency continuation. Status: CLAIMED.
Base: `b660420d8fd1db838b788647c8fa69009d90e6ba`. Branch: `lane/samd-release-adoption-20261028`.

Existing [Tauri40765450230](https://github.com/CrispStrobe/brickwright/actions/runs/40765450230)
failed the unchanged Linux owner-crash test:269 passed,1 failed,11 ignored.
The original is retained and remains unattributed. The test does not bind its
shell-published PID to the expected parent/start identity, distinguish every
terminal state, or retain the failure observations. Historical G02 completion
and the completed macOS scope do not establish a current Linux writer; old
worktrees and existing production ownership remain untouched.

Claim only the Linux `#[cfg(test)]` owner-death fixture, observation helpers and
controls in `apps/tauri/src-tauri/src/renode_supervisor.rs`, this claim,
`docs/SPIKE-LINUX-DESKTOP.md` and the SAMD adoption handoff/claim. No production
launch, parent-death guard, worker lifetime, deadline, native producer/default,
package, firmware, model or runtime change is authorized by this scope.

Bind the original direct child before owner termination using kernel process
identity and strict parent/publication checks. Retain bounded identity/state
observations; ambiguous reads must refuse. Keep the three-second termination
bound and the original failure assertion. Cleanup must target the held owned
child identity, never an unbound numeric process group. The direct-child promise
does not become descendant-tree coverage.

Require positive live-owner and abrupt-owner controls, normal teardown
preservation, a disabled-death-guard negative control, refused counterfeit or
incomplete PID publication, and non-vacuous observation controls. The old
failure's cause cannot be inferred from new passes. Preserve it and explicitly
scope any remaining uncertainty. Keep production bytes outside the test module
identical; all enabled final-head checks and affected actual SAMD browser plus
installed qualification still precede the normal matched adoption merge.

Candidate: strict complete PID publication, parent/group admission and held pidfd
termination/cleanup; the three-second positive assertion is unchanged. Three
new regular Linux controls cover malformed publication, counterfeit parent/live
and reaped identities, and deliberately clearing the actual registered guard.
The negative Python fixture uses isolated mode and explicit non-optimizable
checks. No production bytes before the test module changed. Independent review
found no scoped blocker; bounded extracted-method controls and three cuts pass.
Those private controls retain their synthetic boundary; full Rust/source CI and
affected actual consumer qualification remain pending. Keep this claim active.

Final timing review preserves the original immediate-crash trigger after identity
admission. A fresh100 ms live-owner control is a separate case, never a delay of
the original trigger. Both retain their own unchanged three-second post-crash
bound; failure diagnostics label the case. Final extracted methods pass and the
disabled held guard is detected specifically in the zero-delay case. Full Rust
and affected consumer qualification remain required.
