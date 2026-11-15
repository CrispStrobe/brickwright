# Apple signing on this Mac

- Use `~/Library/Keychains/brickwright-build.keychain-db` for all Apple signing.
  Do not use `login.keychain-db` or silently fall back to it.
- Pass the Brickwright keychain explicitly to `codesign` and `productbuild`
  using `--keychain`.
- For Xcode/Tauri operations that select identities automatically, ensure the
  identity is selected from the Brickwright keychain before signing or exporting.
- An identity name or certificate fingerprint alone does not establish which
  keychain supplied its private key.
