# Programme review — 31 October 2026

This review covers Sami Halawa's maintenance and release of email-smtp-imap-mcp, beginning with release candidate 2.2.1. Sami is the programme owner, package author, repository maintainer, security contact and release approver. The review covers programme procedures and technical evidence; it does not constitute independent certification.

## Roles, competence and awareness

The competence assessment for this single-maintainer programme is based on Sami's repository contributions: multi-account implementation (`6b9610d`), release preparation (`35d2e07`), TypeScript compiler support (`f5e731e`) and repository maintenance (`da25a6e`). These provide a concrete basis for his development, build and release responsibilities. The programme requires Node/TypeScript, SMTP/IMAP and TLS, dependency/advisory interpretation, regression testing, package releases and vulnerability communication.

The current release procedures exercise those technical requirements through real mail-protocol tests, static analysis, advisory remediation and offline source/dependency recovery. Additional participants or materially changed technical requirements trigger a new competence assessment. The programme does not depend on a particular course, examination or external qualification.

The programme's objectives are to identify and address known vulnerabilities, protect mailbox credentials, maintain recoverable release inputs and communicate security information accurately. Sami is accountable for these objectives and the release gates. Bypassing the controls can expose credentials, distribute vulnerable components or produce inaccurate assurance claims; a release with unresolved required checks must stop. The policy and this review communicate the objectives, responsibilities and consequences in the repository. Each release review records participant acknowledgement; new participants must demonstrate awareness before taking release responsibilities.

## Resources and practice review

The programme uses existing public GitHub infrastructure, dependency alerts, npm, Node and Semgrep Community Edition. The completed test, scan, audit, component archive and recovery operations demonstrate that these resources support the current project scope. Release work includes the time required to complete review, remediation and archive/recovery checks. If incident volume or project scope makes the seven-day reporting acknowledgement target impractical, the programme owner must revise the allocation before continuing that commitment.

This review assessed the project's TLS policy, vulnerability detection and remediation, attribution of reused dependency fixes, component records and release retention. Existing push/PR CI and dependency alerts provide ongoing inputs. Policy, role and resource reviews recur at each release, after serious incidents or material scope changes, and at least annually. Conformance revalidation is required within 18 months after an eventual validation date.

## Operational evidence and measurements

The `release-artifacts/` bundle records the source manifest and tree digest, dependency lock, audit, tests, Semgrep results, component origins and dependency relationships, package bytes and offline recovery. It is a local release candidate bundle. Durable GitHub release retention and hosted attestations are recorded only after the release workflow runs successfully.

Observed measurements: 20 tests passed; all eight application TypeScript files and the release-evidence script scanned; zero final static findings; zero known dependency vulnerabilities in the reviewed final lockfile. The base lockfile had 14 affected packages. Each baseline finding, severity, affected path, updated version and remediation decision is retained in [base-audit.json](base-audit.json) and [vulnerability-review.json](vulnerability-review.json). Every reported package finding was remediated, so no risk exception or customer acceptance was required. A zero audit result is limited to advisory coverage at the recorded review time.

GitHub configuration and access checks on 31 October 2026 confirmed that the repository is public, not archived, owned by `samihalawa`, with issues and private vulnerability reporting enabled. The authenticated repository security-advisory list contained zero entries. This verifies the reporting configuration and access to its records; it does not establish historical response performance against the seven-day target.

The source and dependency tarballs are integrity checked, restored with an initially empty npm cache, installed offline and tested. Exact counts and recovery results are retained in the bundle. Upstream author and repository metadata comes from each archived package. Where supplier identity cannot be established, SPDX `NOASSERTION` explicitly records that uncertainty; authorship and registry hosting are retained as separate provenance fields.

## Review outcome

The scoped policy, roles, competence basis, vulnerability handling, component generation, archives and recovery procedures are implemented. Final release review must bind the committed and tagged source, participant acknowledgement and actual hosted release results. This review does not assert a completeness affirmation, external ISO certificate, OpenSSF passing result, conformance registration or npm publication. Historical releases are outside this programme's retrospective archive coverage.
