# Verify release assets

Release `v2.2.1` distributes four assets: the npm package, the release-assurance archive, the SPDX component record and the archive checksum record. The [release manifest](evidence/release-v2.2.1-manifest.json) identifies the release, original source commit, exact filenames, byte lengths, download URLs and SHA-256 digests of all four assets.

The manual **Verify and attest existing release assets** workflow downloads these existing assets and checks every file against both that manifest and GitHub's current release metadata. It also checks that the release tag still identifies the original source commit. A changed digest, missing file, additional asset or changed release identity fails verification before signing.

After successful verification, GitHub OIDC and Sigstore sign a custom attestation covering all four asset digests and the manifest itself. The attestation is stored on GitHub; the workflow also retains its signature bundle as a CI artifact for 90 days. The signed statement has predicate type:

```text
https://github.com/samihalawa/email-smtp-imap-mcp/attestations/release-asset-verification/v1
```

This predicate records a verification of previously published release bytes. Its body is the release manifest, and its subjects include the four assets and the manifest. It does not claim that the assets were originally built during the verification workflow. The original npm package build provenance and SPDX attestation remain separate records from the release workflow at source commit `c2c1056d48f980f7dec943b3bda5c43e9218bf49`.

## Download and verify

Install the [GitHub CLI](https://cli.github.com/) and sign in with `gh auth login`. Obtain the manifest from this repository, then download the four assets into a new directory:

```sh
gh release download v2.2.1 --repo samihalawa/email-smtp-imap-mcp \
  --pattern checksums.json --pattern email-smtp-imap-mcp-2.2.1.tgz \
  --pattern release-assurance.tgz --pattern sbom.spdx.json \
  --dir verified-release-assets
```

From a checkout of this repository, verify the signed manifest and each asset:

```sh
RELEASE_PREDICATE='https://github.com/samihalawa/email-smtp-imap-mcp/attestations/release-asset-verification/v1'
RELEASE_SIGNER='samihalawa/email-smtp-imap-mcp/.github/workflows/attest-release-assets.yml'
gh attestation verify docs/evidence/release-v2.2.1-manifest.json \
  --repo samihalawa/email-smtp-imap-mcp --signer-workflow "$RELEASE_SIGNER" \
  --predicate-type "$RELEASE_PREDICATE"
for asset in checksums.json email-smtp-imap-mcp-2.2.1.tgz release-assurance.tgz sbom.spdx.json; do
  gh attestation verify "verified-release-assets/$asset" \
    --repo samihalawa/email-smtp-imap-mcp --signer-workflow "$RELEASE_SIGNER" \
    --predicate-type "$RELEASE_PREDICATE"
done
```

These commands check the cryptographic signature, repository, signing workflow, predicate type and subject digest. Add `--format json` to inspect the signed statement and certificate. For a specific issuance, also pass `--source-digest` with the verification workflow's commit recorded in that attestation; this is distinct from the original package source commit in the manifest. A downloaded file or an unsigned hash match alone does not establish the signing identity.

To compare each asset's size and hash directly with the manifest as well:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
manifest = json.loads(Path('docs/evidence/release-v2.2.1-manifest.json').read_text())
for asset in manifest['assets']:
    data = Path('verified-release-assets', asset['name']).read_bytes()
    assert len(data) == asset['bytes'], asset['name']
    assert hashlib.sha256(data).hexdigest() == asset['sha256'], asset['name']
    print(asset['name'] + ': verified')
PY
```

The npm package also carries [npm-hosted provenance](https://registry.npmjs.org/-/npm/v1/attestations/email-smtp-imap-mcp@2.2.1). Its SHA-512 subject digest and original source revision can be checked independently of the later release-asset verification.

Signing and hashes support [OpenSSF's release-asset integrity control](https://baseline.openssf.org/versions/2025-10-10#osps-br-06---produce-all-released-software-assets-with-signatures-and-hashes). They do not by themselves establish compliance with every OpenSSF control or an external ISO certificate.
