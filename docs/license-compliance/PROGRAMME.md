# Open source licence compliance programme

Owner and public contact: **Sami Halawa**, [sami@samihalawa.com](mailto:sami@samihalawa.com). For licence questions, use the subject “email-smtp-imap-mcp licence compliance”. This policy takes effect on 31 October 2026.

## Scope and objectives

This programme covers the public email-smtp-imap-mcp project maintained by Sami, including its npm distribution and the source, dependency and build-input archives supplied through its GitHub releases. The current assessment covers version 2.2.2 and its separately supplied licence supplement. It does not cover other projects, client systems, SaaS providers or an entire legal entity. Sami reviews the scope before each release or material change and records the source revision and distribution channels.

The objectives are to identify every supplied open source component, understand its applicable terms, preserve required notices and source, deliver compliance materials to recipients, resolve enquiries and keep review records. This is licence governance alongside the project's separate security-assurance programme.

## Responsibility, competence and communication

Sami is the sole participant and accountable maintainer, licence reviewer, contribution approver, release approver and enquiry contact. Required competence includes reading package provenance and SPDX expressions, distinguishing alternative and cumulative licences, reviewing source and binary redistribution terms, preserving notices, identifying compatibility and modification issues, and knowing when to seek specialist advice. The [dated assessment](REVIEW-2026-10-31.md) records the representative assessment and its evidence; experience and observed practice can establish competence without a particular course.

The policy and contribution procedure are public in the repository. Before accepting a new participant's responsibility, Sami supplies these links and records an assessment of the participant's relevant competence and awareness: policy location, objectives, expected contribution and consequences of non-conformance. Material policy changes receive the same communication and assessment. The sole participant's current record uses owner-attested capacity and observed maintenance records; it does not assert personal course attendance or an unobserved reading event.

Sami allocates maintenance time and the existing repository, release storage and free tooling to this single-project programme. No paid platform or standing legal retainer is required by this operating model. Review workload, storage availability and expertise access at each release; postpone supply if resources are inadequate. Do not promise expenditure or treat a paid service as authorised by this policy.

## External expertise and enquiries

The designated external expertise route is the **Software Freedom Law Center (SFLC)**. Its [services page](https://softwarefreedom.org/services/) offers licensing assistance to FOSS developers other than its clients, and its [published advice contact](https://softwarefreedom.org/about/contact/) invites project requests at **help@softwarefreedom.org**. Sami can approach this actual public service with a specific licence, source, distribution and question. This identifies available expertise and a supported access route; it does not claim SFLC has reviewed this project, accepted a particular matter or entered a retainer. OpenChain's [helpdesk](https://openchainproject.org/resources/faq) supports programme interpretation; it is not substituted for a legal adviser.

Sami acknowledges external licence enquiries within five working days where practicable, records the affected version and claim in a repository issue or an access-controlled record when confidentiality requires, and provides an estimated response date. Avoid publishing personal information or private contracts. Verify the original terms and supply path; seek SFLC guidance for ambiguity, disputes, unusual combinations or rights questions. If the offered route cannot address a material question, obtain suitable expertise before approving the affected distribution; unresolved issues are not cleared by citing a directory or an automated model.

For confirmed non-compliance, stop further affected supply where practicable, preserve original evidence, identify recipients and versions, prepare corrected notices/source or another appropriate remedy, communicate with affected parties, and record the correction and closure. Never rewrite an already published package or tag to conceal the original state. A later supplement must identify exactly what it adds and when.

## Component and licence review

For each supplied release, bind the npm tarball, source revision, lockfile, SPDX inventory and archived inputs using the assurance checksums. Review **every** component and archive, including optional and build inputs actually supplied in an assurance bundle. Resolve missing texts from attributable upstream sources; preserve URLs, revisions, original bytes and hashes. A package's licence metadata is a starting point, not the completed review.

Record the declared and selected licence, rights, restrictions, obligations, source/binary use, modifications, notice files and approval for each component. OR expressions permit a recorded alternative choice; AND expressions require fulfilling all terms. Retain upstream legal files and embedded copyright/attribution notices. Additional licences embedded in a NOTICE file retain their own terms; the top-level package identifier does not replace them.

The current [component decisions](components-2.2.2.json) cover all 175 records and 171 distinct archives. The [notice collection](THIRD_PARTY_NOTICES.md) retains 114 distinct legal texts, including complete Apache notices with their third-party Unicode, W3C and Creative Commons material. MIT is selected for both mailsplit versions offering MIT OR EUPL; both supplied texts remain available. The ipv6-normalize supplement preserves its author's MIT declaration, the attributable URI.js MIT grant and the source's Rich Brown/Dartware credit and Intermapper link. No new copyright date or upstream permission is invented.

## Distribution and contribution cases

| Case | Required review and action |
| --- | --- |
| Source distribution | Preserve original licence, copyright and attribution files and relevant source headers. Include required notices and identify modifications. |
| Binary or compiled distribution | Provide licence texts and required attribution/NOTICE material with the distribution. Review corresponding-source or written-offer requirements before approval. Build-input binaries in the assurance archive are supplied components too. |
| Combinations and additional obligations | Inspect all applicable licence terms and actual interaction/linking. Do not assume a permissive root licence overrides third-party requirements. Fulfil resulting obligations or change the combination before supply. |
| Modified upstream code | Record original version, changes, modifier and date; preserve existing notices and add modification notices where required. The assessed dependency archives are byte-identical upstream inputs, with no upstream source modifications. |
| Incompatible or uncertain terms | Hold the affected component or distribution, seek specialist guidance and resolve by permission, an appropriate alternative licence, replacement or removal. Never infer compatibility from a vulnerability scan. |
| Attribution | Copy required notices in full, including binary-documentation notices and special link credits. Preserve licence disclaimers, no-endorsement restrictions and relevant patent/trademark conditions. |

Sami permits contributions to this project and upstream projects under the [contribution policy](../../CONTRIBUTING.md). Before sending a contribution, identify its origin, confirm authority to submit it under the destination's terms, retain third-party notices and disclose relevant licence conditions. Do not contribute employer/client confidential code, credentials or material without authority. Review the destination's contribution terms before submission; record the change and licence decision in the pull request. Participants receive this policy and the contribution procedure through the communication process above.

## Preparation, delivery and retention

Run `python3 scripts/license-compliance.py` to reproduce the 2.2.2 supplement from its immutable public archive; `--check` compares the committed records. The tool verifies the original bundle digest, every archive checksum, the npm package, all component archive digests and the supported licence decisions. New versions require their own reviewed input identities and decisions; this version-specific supplement must not be relabelled for another release.

The manual licence-supplement workflow creates a deterministic archive containing this policy, the dated assessment, component decisions, full notices, the project licence and contribution procedure. It signs the actual supplement with GitHub OIDC provenance and attaches it to the existing 2.2.2 release. The original npm package, tags and four release assets remain unchanged. Recipients should obtain the supplement alongside the original assurance archive; future distributed packages must include or accompany the applicable compliance materials before supply.

Retain compliance records, notices, source and build inputs for at least **six years after the last offer of the affected software**, or any longer period required by its licences or an applicable contract. Git history and public release assets are the current archive; expiring CI artifacts alone are insufficient. Before moving or retiring storage, verify a replacement archive and preserve access for required source offers. Review policy, licence decisions, scope, resources and corrective actions at each release and at least annually; revalidate a conformance affirmation within 18 months and after material changes.
