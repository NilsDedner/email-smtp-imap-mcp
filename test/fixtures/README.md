# Local TLS test identity

`localhost-cert.pem` and `localhost-key.pem` are a public, test-only self-signed identity for loopback protocol tests. The key is deliberately committed and must never be reused outside these tests. The certificate names localhost and 127.0.0.1, was generated on 31 October 2026 and expires ten years later. The MCP subprocess trusts this certificate only through its test-specific NODE_EXTRA_CA_CERTS setting; production certificate verification remains enabled.

These fixtures permit real successful implicit TLS and STARTTLS tests without an external mail provider. Separate negative tests use the SMTPServer default untrusted certificate and verify rejection before authentication. The npm package allowlist excludes test files.
