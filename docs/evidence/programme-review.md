# Programme conformance review — 31 October 2026

This review covers Sami Halawa's maintenance and release of email-smtp-imap-mcp from version 2.2.1 onward, as defined in the [programme policy](../security-assurance.md). Sami is the programme owner, package author, repository maintainer, security contact and release approver. Historical releases are not represented as retrospectively archived under this programme.

The supplied release is [2.2.1](https://github.com/samihalawa/email-smtp-imap-mcp/releases/tag/v2.2.1), built from commit [`c2c1056d48f980f7dec943b3bda5c43e9218bf49`](https://github.com/samihalawa/email-smtp-imap-mcp/tree/c2c1056d48f980f7dec943b3bda5c43e9218bf49). This document is the post-release programme assessment; it supplements the immutable build evidence without changing the published package or tag.

## Assessment authority and method

An authorised organisational representative has performed this documentary assessment on behalf of the programme owner. The assessment relies on the maintainer's attested capacity for the assigned roles, his recorded project contributions, the documented programme responsibilities and the observed operation of the release controls. It records the representative's assessment of competence and awareness; it does not assert that Sami personally read a particular document, attended a course, completed an examination or gave a separate personal acknowledgement during this review. No independent assessor, interview or training certificate is claimed.

The technical competence basis includes Sami's multi-account implementation (`6b9610d`), release preparation (`35d2e07`), TypeScript compiler support (`f5e731e`) and repository maintenance (`da25a6e`). The role requires Node/TypeScript, SMTP/IMAP and TLS, dependency/advisory interpretation, regression testing, package releases and vulnerability communication. The current controls exercise these requirements through real mail-protocol tests, advisory remediation, static analysis and offline recovery. The representative assesses the documented competence as adequate for this single-maintainer scope. Additional participants or materially changed technical requirements trigger reassessment.

## Assessed programme awareness

The representative reviewed all four elements of ISO/IEC 18974 clause 4.1.3 against the role-capacity attestation, maintained project practices and release evidence:

| Awareness element | Documentary assessment and conclusion |
| --- | --- |
| Security assurance policy | The programme owner is assigned responsibility for the policy, its communication and review. The policy identifies the software scope, reporting route, review cycle and release gates. These responsibilities and the operated controls provide the basis for assessing awareness of the applicable policy as adequate. |
| Relevant programme objectives | The objectives are to identify and resolve known vulnerabilities, protect mailbox credentials, preserve recoverable release inputs and communicate security information accurately. The release implements mandatory validated TLS, dependency remediation, repeatable analysis and recoverable archives in support of these objectives. Awareness of the objectives is assessed as adequate for the assigned role. |
| Contribution to effectiveness | Sami's assigned contribution is maintenance, triage, dependency review and release approval. Recorded source contributions and the completed release controls substantiate those responsibilities. Awareness of the contribution expected from the sole participant is assessed as adequate. |
| Implications of non-conformance | The policy explains that bypassing controls can expose credentials, distribute vulnerable components, prevent recovery or produce inaccurate assurance statements. It requires release-blocking treatment of unassessed findings and critical/high exposure. Negative transport tests and failing-on-finding analysis implement these consequences. Awareness of the implications is assessed as adequate. |

This is an assessed-awareness record, rather than a personal training or reading-attendance record. The policy and review remain available in the repository as the programme's communication mechanism. New participants must be assessed before taking responsibility for security-sensitive contributions or releases.

## Resources and practice review

The programme uses public GitHub infrastructure, dependency alerts, npm, Node and Semgrep Community Edition. The completed build, test, audit, archive and recovery operations demonstrate resources sufficient for this bounded scope. Sami remains accountable for triage and release decisions, including the time required to complete review and remediation. If incident volume or scope makes the seven-day reporting acknowledgement target impractical, the resource allocation must be revised.

This review reconciled responsibilities and current practices for TLS, vulnerability detection and remediation, attribution of reused fixes, component recording, release verification and archive retention. Policy, role, competence, awareness and resource reviews recur at each release, after serious incidents or material scope changes, and at least annually. The documented practices and assignments are current for the scope reviewed on 31 October 2026.

## Supplied-release evidence

The [release build record](https://github.com/samihalawa/email-smtp-imap-mcp/actions/runs/41231099941) binds the evidence to `c2c1056d48f980f7dec943b3bda5c43e9218bf49`. Its evidence-generation step recorded source tree SHA-256 `6aa5f83d2e8be4709db2a23b5183ede466623d0ac5976491d103964d204ab56c`, 48 source files, 175 component records, zero known audit vulnerabilities, zero static-analysis findings and successful offline recovery. The reviewed source was clean at release validation. All 21 tests passed; Semgrep covered the eight application TypeScript files and the release-evidence script.

The supplied [release assurance archive](https://github.com/samihalawa/email-smtp-imap-mcp/releases/download/v2.2.1/release-assurance.tgz) retains source, component origins and dependency relationships, package bytes, test/scan/audit results and recovery records. Its [checksum manifest](https://github.com/samihalawa/email-smtp-imap-mcp/releases/download/v2.2.1/checksums.json) contains 182 entries, including 171 unique dependency tarballs. Archive bytes were checked against lockfile integrity; recovery restored source hashes, seeded an initially empty npm cache from the archived tarballs, installed offline and reran the test suite. The [SPDX record](https://github.com/samihalawa/email-smtp-imap-mcp/releases/download/v2.2.1/sbom.spdx.json) and full lockfile component record preserve author, timestamp, identifiers, relationships and origins. Unverified upstream supplier identities are explicitly recorded as `NOASSERTION`, separately from author and registry metadata.

The [published npm package](https://www.npmjs.com/package/email-smtp-imap-mcp/v/2.2.1) has integrity `sha512-zge1KsXDe95aGVj5iq0THPcb53gvmbba6/LYZxxdARtXR9Pkk7Bluudvdpe4LL8XKvhai0ofGvxRXaHJVu0XqQ==`. The [npm provenance record](https://registry.npmjs.org/-/npm/v1/attestations/email-smtp-imap-mcp@2.2.1) identifies the same source commit and GitHub-hosted release workflow. GitHub also retains the [package provenance attestation](https://github.com/samihalawa/email-smtp-imap-mcp/attestations/62170902) and [SBOM attestation](https://github.com/samihalawa/email-smtp-imap-mcp/attestations/62170910).

The release run completed evidence generation, attestations and npm publication, then failed at its registry read-back step. Subsequent direct registry integrity verification and GitHub asset read-back confirmed the published result and retention of the four release assets. The overall workflow is therefore not described as a successful run. These separately verified outcomes are the basis for this post-release assessment.

Programme measurements for this review are: one of one supplied releases within scope has retained component/archive evidence; no unassessed findings remain in the reviewed release; all 14 baseline affected dependency packages were remediated; the policy, competence and awareness reviews are current as of 31 October 2026. No vulnerability-report response-time performance is claimed where the reporting channel has no recorded report.

The base lockfile had 14 affected packages. [The baseline audit](base-audit.json) and [per-component review](vulnerability-review.json) record the findings, severities, affected paths, updated versions and remediation decisions. All reported package findings were remediated; no customer exception or non-exploitability waiver was needed. A zero audit result applies to known advisory coverage at the review time, rather than proving absence of vulnerabilities.

GitHub reporting configuration and access were checked: the repository is public, owned by `samihalawa`, and has private vulnerability reporting enabled. The repository security-advisory list contained zero entries. The response and disclosure procedure remains in force; no historical vulnerability-response performance is inferred from an empty list.

## Completeness review: all 35 checklist questions

The representative reconciled the [official 35-question checklist](https://github.com/OpenChain-Project/Reference-Material/blob/53c2d2122f3cede7668917e65ff194db77c26a0c/OpenChain-Standards-Self-Certification/Checklist/ISO-IEC-18974/en/iso-18974-2023-Self-Certification-Checklist.md) against the programme policy, this assessment and the supplied-release evidence:

| Clause | Questions | Assessment and evidence |
| --- | ---: | --- |
| 4.1.1 | 2 | Met: written policy and repository communication/review procedure. |
| 4.1.2 | 6 | Met: named participant and roles, required competencies, documentary competence assessment, review/change process, current assignments and practice review. |
| 4.1.3 | 4 | Met: the four awareness elements are expressly assessed above using the stated representative-review method. |
| 4.1.4 | 3 | Met: explicit single-project/version scope, programme targets and observed metrics, retained review/change evidence. |
| 4.1.5 | 8 | Met: threat identification, known-vulnerability detection and follow-up, communication, post-release monitoring, repeated testing, release risk gates and information-export procedures are documented and operated. |
| 4.2.1 | 2 | Met: public private-reporting route and internal response/disclosure procedure; native reporting access verified. |
| 4.2.2 | 4 | Met: accountable participant, demonstrated resources, assessed expertise and documented responsibility/review arrangements. |
| 4.3.1 | 2 | Met: component/archive procedure plus actual source-bound records, retained source/dependency archives and successful recovery. |
| 4.3.2 | 2 | Met: component assurance procedure and component-level finding/severity/remediation records, including current no-known-advisory decisions. |
| 4.4.1 | 1 | Met: the scoped completeness affirmation below follows reconciliation of all requirements. |
| 4.4.2 | 1 | Met: this conformance assessment and affirmation are dated 31 October 2026. |
| **Total** | **35** | **All requirements reconciled for the stated scope.** |

## Scoped affirmation and renewal

On 31 October 2026, the authorised organisational representative affirms, on behalf of the programme owner and using the evidence and assessment method above, that this programme satisfies the requirements of ISO/IEC 18974:2023 for the defined maintenance and release scope beginning with email-smtp-imap-mcp 2.2.1.

This is the programme's documented self-conformance affirmation. It is not an independent assessment, an external ISO certificate, a claim of personal course attendance, or evidence that OpenChain has already registered or listed the programme. Programme listing and any issuer acknowledgement are separate subsequent records. This assessment does not extend to other projects, an entire legal entity or historical archive coverage outside the stated scope.

Review the policy and programme at each release and at least annually; reassess material scope or participant changes. Revalidate conformance no later than 30 April 2028, within 18 months of this assessment, and preserve the resulting dated record.
