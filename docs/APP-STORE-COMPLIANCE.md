# App Store submission evidence bundle

This is the reviewer/operator packet for Brickwright native releases. It records
what the submitted bytes do and where each claim is proved; it is not a promise
that a store will approve an app and it is not legal advice. Generate the
artifact-specific bundle with:

```sh
node scripts/package-store-compliance.mjs \
  --build packages/scratch-gui/build \
  --artifact path/to/Brickwright.ipa \
  --out artifacts/store-compliance
```

The result contains the exact build receipt, SHA-256 and size of every submitted
artifact, this review packet, notices, privacy/entitlement declarations and the
source commit. Do not submit a packet generated for a different binary.

## Review posture

Brickwright is an educational programming environment. Its central UI lets a
learner inspect and edit blocks, Brickwright Code, C/C++, assembly, Python and
JavaScript; run the resulting program in a bounded emulator or on selected
hardware; and step, break and inspect it. No login, purchase or external device
is needed for the review path.

Apple's current Guideline 2.5.2 contains a narrow exception for educational apps
that download code used to teach, develop or test executable code, when the
provided source is completely viewable and editable. The Developer Program
License Agreement adds operational conditions for programming environments,
including an in-app programming indicator, no code storefront, and a screen-area
limit. These are submission requirements to re-check against the exact release,
not a blanket exemption. Primary references:

- <https://developer.apple.com/app-store/review/guidelines/#software-requirements>
- <https://developer.apple.com/support/terms/apple-developer-program-license-agreement/>

The default artifact deliberately enables three independently compiled download
classes on all platforms. This is a product decision, not a platform inference:

| Receipt field | What may be fetched | Execution boundary |
| --- | --- | --- |
| `remoteExtensions` | reviewed/content-pinned gallery extensions and a user-entered extension URL | arbitrary URLs run in the restricted Scratch extension worker; pinned compatibility entries are enumerated in the security record |
| `executableToolchains` | optional compiler/toolchain WebAssembly | compiles learner source; it cannot replace the native app |
| `machineImages` | optional firmware, OS and lesson media | guest bytes execute in the selected emulator, not as a native host application |

The exact values are compiled into JavaScript literals and emitted as
`brickwright-build.json`; About shows the same three values. `allow` is the
default for web, macOS, Windows, Linux, iOS and Android. A submission channel
can instead compile any field as `deny`, or set `BW_REMOTE_CODE_POLICY=deny` for
all three. No runtime switch or Tauri detection can turn a denied class back on.
See `docs/EXTENSION-SECURITY.md` for the measured extension boundary and
`docs/FETCH-PINNING.md` for artifact identity rules.

Important reviewer disclosure: the allow profile includes precompiled
toolchains and guest machine media, and not every pinned compatibility extension
is editable as extension implementation source inside the app. Do not describe
those facts as if every downloaded byte satisfies the educational-source
exception. If App Review requires a strictly self-contained submission, produce
and submit the deny profile rather than changing the explanation of an allow
binary.

## Privacy and permissions

The app has no account, ads or analytics SDK. Projects and lesson progress are
stored on device. Some explicit actions use the network: hosted compilation
sends the source being compiled to the named compiler service; remote extensions,
toolchains and machine media fetch their selected resources; local sharing and
Scratch Link may connect to a user-selected device or service. The published
privacy policy and App Store privacy answers must describe the behavior of the
submitted version, including those user-initiated transfers. Apple requires the
privacy answers to include integrated third-party partners and to remain current:
<https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy>.

`PrivacyInfo.xcprivacy` declares no tracking and lists the required-reason APIs
used by the app/tooling. `Info.ios.plist` carries purpose strings for Bluetooth,
camera, microphone, speech recognition and local-network access. These permissions
are requested only by the corresponding feature. The macOS sandbox entitlements
cover network client/server, Bluetooth, USB/serial, camera/audio input and
user-selected files. They grant OS access; they do not select the download
policy above.

Before each submission, verify that the hosted privacy policy at
<https://crispstrobe.github.io/brickwright-privacy.html> matches these actual
transfers and that App Store Connect's privacy answers match the submitted
version. Apple requires a privacy-policy link both in metadata and in the app.

## Licensing and executable payloads

The application source is BSD-3-Clause and third-party terms are preserved in
`THIRD-PARTY-NOTICES.md` and the in-app offline license texts. LGPL and MPL
components, where used, retain their own notices and source obligations. This
packet does not turn an inventory into legal advice.

GPL compilers, Blinkenrocket firmware and Linux guest media are not bundled.
They remain external/user-supplied or user-initiated downloads. The release
build must pass `scripts/verify-no-gpl-in-build.mjs`, which inspects emitted
bytes and known payload signatures rather than trusting webpack configuration.

## Reviewer path

1. Launch without signing in. Choose an included starter or guided lesson.
2. Open Code and Circuit; edit a block or source line and observe the matching
   generated/read-only view labels.
3. Run, pause and single-step the simulator; inspect registers, memory, pins and
   instruments. No external hardware is necessary.
4. Open About and record the commit and all three distribution-policy values.
   They must match `brickwright-build.json` in this bundle.
5. Optional: connect a compatible LEGO BLE hub. The Bluetooth purpose prompt
   appears only when this feature is used.
6. For an allow-profile review, exercise one disclosed optional download and
   show its user-visible status. For a deny-profile review, confirm those choices
   are absent/refused before any network request.

Canonical App Store copy and the Beta App Review note are in
`docs/app-store-metadata.md`. Screenshots are captured from the shipping build,
not composited, by `.github/workflows/appstore-screenshots.yml`.

## Release preflight

- Build from the intended tag/commit and archive the generated compliance bundle.
- Confirm the bundle manifest says the same commit and policy as About.
- Run the native packaged download proof for an allow artifact, or the no-network
  refusal proof for a deny artifact.
- Run the GPL/output scan and notice gates against the final frontend embedded
  in the native package.
- Validate purpose strings, privacy manifest installation, signing profile,
  sandbox entitlements and export-compliance value from the archived app.
- Review the exact binary on a current physical device and keep screenshots or
  a short capture of the reviewer path with the bundle.
- Paste the Beta App Review note from `docs/app-store-metadata.md`; do not replace
  artifact facts with generic assurances.

