#!/usr/bin/env python3
"""Reproduce the licence supplement from the immutable 2.2.2 assurance archive."""
import argparse
import collections
import hashlib
import gzip
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "c1c11ba9bc2088c2089cea4bb1a2bd5d2e5c879d"
URL = "https://github.com/samihalawa/email-smtp-imap-mcp/releases/download/v2.2.2/release-assurance.tgz"
BUNDLE_HASH = "d4bce1cffbb44045721f748fd2480f28ba99ccbaba0c9537b69047ae2bf44e9d"
OBLIGATIONS = {
    "MIT": "Retain copyright, permission and warranty disclaimer with copies or substantial portions.",
    "MIT-0": "No attribution condition; retain supplied text as a courtesy and provenance record.",
    "Apache-2.0": "Supply the license and applicable NOTICE/attribution material; retain relevant source notices; identify modifications if made. Patent grant and termination apply; trademarks are not granted.",
    "BSD-2-Clause": "Retain copyright, conditions and disclaimer in source; reproduce them in documentation/materials accompanying binaries.",
    "BSD-3-Clause": "Retain copyright, conditions and disclaimer in source and binary documentation; no endorsement using contributor names without permission.",
    "ISC": "Retain copyright and permission notice in all copies; warranty disclaimer applies.",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def download(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def unpack(data):
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        return {m.name.removeprefix("./"): archive.extractfile(m).read()
                for m in archive.getmembers() if m.isfile()}


def generate():
    raw = download(URL)
    assert digest(raw) == BUNDLE_HASH, "Release archive digest changed"
    files = unpack(raw)
    checksums = json.loads(files["checksums.json"])
    # The release's checksum record is an object keyed by relative artifact path.
    entries = checksums.get("files", checksums)
    if isinstance(entries, list):
        entries = {r["path"]: r["sha256"] for r in entries}
    for name, expected in entries.items():
        expected = expected.get("sha256") if isinstance(expected, dict) else expected
        assert digest(files[name]) == expected, name
    inventory = json.loads(files["components.json"])
    assert inventory["sourceCommit"] == SOURCE
    assert inventory["project"]["version"] == "2.2.2"
    package_bytes = files["email-smtp-imap-mcp-2.2.2.tgz"]
    assert digest(package_bytes) == "13362ffe01b2ed617955d26cb142e2c4ab1a00eef680ac956504b1273e18b2be"
    package_files = unpack(package_bytes)
    assert "package/LICENSE" in package_files
    assert not any("/node_modules/" in name for name in package_files)
    package_metadata = json.loads(package_files["package/package.json"])
    assert package_metadata["license"] == "MIT"
    records = inventory["components"]
    assert len(records) == 175 and len({r["archive"] for r in records}) == 171
    texts, decisions = {}, []
    for record in records:
        archive = files[record["archive"]]
        assert digest(archive) == record["sha256"]
        members = unpack(archive)
        legal, embedded = [], []
        for name, data in members.items():
            base = PurePosixPath(name).name.lower()
            if any(word in base for word in ("license", "licence", "copying", "notice", "copyright")):
                text = data.decode("utf-8")
                key = digest(data)
                texts[key] = text
                legal.append({"path": name, "sha256": key, "bytes": len(data)})
            elif len(data) < 2_000_000 and b"\x00" not in data:
                text = data.decode("utf-8", errors="replace")
                # Retain copyright and explicit licence/attribution lines found outside legal files.
                lines = text.splitlines()
                hits = {i for i, line in enumerate(lines) if re.search(r"copyright|SPDX-License-Identifier|please feel free to use this code|intermapper\.com|Dartware", line, re.I)}
                if hits:
                    selected = sorted({j for i in hits for j in range(max(0, i - 1), min(len(lines), i + 4))})
                    notice = "\n".join(f"{i + 1}: {lines[i]}" for i in selected)
                    embedded.append({"path": name, "sourceSha256": digest(data), "notice": notice})
        declared = record["license"]
        selected = "MIT" if declared == "(MIT OR EUPL-1.1+)" else declared
        assert selected in OBLIGATIONS, f"Unreviewed license: {declared}"
        if not legal:
            assert record["name"] == "ipv6-normalize", record["name"]
            assert b"The MIT License (MIT)" in members["package/README.md"]
            assert b"http://www.intermapper.com" in members["package/index.js"]
        decisions.append({k: record[k] for k in ("name", "version", "location", "identifier", "dev", "optional", "archive", "sha256", "integrity")} | {
            "declaredLicense": declared, "selectedLicense": selected,
            "obligations": OBLIGATIONS[selected], "legalFiles": sorted(legal, key=lambda r: r["path"]),
            "embeddedNotices": embedded,
            "decision": "MIT alternative selected; both original licence texts retained." if declared != selected else "Retain original legal texts and embedded notices; no upstream source modifications.",
            "distribution": "Build/recovery input, retained unchanged in the public assurance archive." if record["dev"] else "Separate npm dependency, installed by npm; also retained unchanged in the public assurance archive.",
        })
    # ipv6-normalize's README names its author's MIT grant but does not include its full text.
    # Recover the named author's identity from the actual mit-license service repository;
    # retain the upstream URI.js grant and the additional source attribution without inventing dates.
    upstream = "https://raw.githubusercontent.com/medialize/URI.js/28976cde5bb32a433ab78c4a32ef58f39d2cabf6/LICENSE.txt"
    uri_license = download(upstream).decode()
    assert "Copyright (c) 2011 Rodney Rehm" in uri_license
    text_id = digest(uri_license.encode())
    texts[text_id] = uri_license
    ipv6 = next(r for r in decisions if r["name"] == "ipv6-normalize")
    ipv6["supplement"] = {
        "upstreamLicenseURL": upstream, "upstreamLicenseSha256": text_id,
        "author": "Po-Ying Chen", "authorLicenseDeclaration": "MIT (package metadata and README)",
        "authorIdentityURL": "https://github.com/remy/mit-license/blob/73ebb8ca1e2280883e92498e18fcdb1c633c226c/users/poying.json",
        "attribution": "IPv6 normalization is based on code by Rich Brown, Dartware, LLC (8 February 2010). http://www.intermapper.com",
        "decision": "Supplement the omitted URI.js MIT license and preserve the author's MIT declaration plus the source's additional link attribution. No relicensing or invented copyright year.",
    }
    report = {"schemaVersion": 1, "reviewDate": "2026-10-31", "project": "email-smtp-imap-mcp", "version": "2.2.2",
              "sourceCommit": SOURCE, "archiveURL": URL, "archiveSha256": BUNDLE_HASH,
              "scope": "All 175 inventory records and all 171 distinct distributed dependency archives, including build and optional platform inputs.",
              "componentCount": len(decisions), "uniqueArchives": 171, "distinctLegalTexts": len(texts),
              "npmPackageSha256": digest(package_bytes), "bundledNodeModules": False,
              "method": "Read every archive member; preserve legal files verbatim, scan other text members for embedded copyright and licence notices, select licence alternatives, and retain immutable original archives.",
              "distributionReview": "The npm package supplies project build output under MIT and declares separate npm dependencies; it does not bundle node_modules. The GitHub assurance archive additionally supplies all dependency archives, including TypeScript platform binaries. This supplement accompanies that distribution and leaves all original bytes unchanged.",
              "components": decisions}
    header = "# Third-party notices — email-smtp-imap-mcp 2.2.2\n\nThis supplement accompanies the immutable 2.2.2 npm and GitHub distributions. The component index records each source archive, original notice path and applicable licence decision. Original legal texts below are reproduced verbatim; their terms govern their respective materials.\n\n"
    header += "## Additional IPv6 attribution\n\n" + ipv6["supplement"]["attribution"] + "\n\nThe package author declares MIT. The inherited URI.js MIT grant appears below. No copyright year is inferred for Po-Ying Chen.\n\n"
    body = header + "\n\n".join("## SHA-256 " + key + "\n\n```text\n" + value.rstrip("\n") + "\n```" for key, value in sorted(texts.items())) + "\n"
    return {"docs/license-compliance/components-2.2.2.json": json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            "docs/license-compliance/THIRD_PARTY_NOTICES.md": body}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify committed supplement instead of writing it")
    parser.add_argument("--package", action="store_true", help="Create the deterministic release supplement after verification")
    args = parser.parse_args()
    for name, content in generate().items():
        destination = ROOT / name
        if args.check:
            assert destination.read_bytes() == content.encode(), f"Stale supplement: {name}"
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content)
        print(name, digest(content.encode()), len(content.encode()))
    if args.package:
        names = ["LICENSE", "CONTRIBUTING.md", "scripts/license-compliance.py",
                 "docs/license-compliance/PROGRAMME.md", "docs/license-compliance/REVIEW-2026-10-31.md",
                 "docs/license-compliance/components-2.2.2.json", "docs/license-compliance/THIRD_PARTY_NOTICES.md"]
        payload = {name: (ROOT / name).read_bytes() for name in names}
        payload["manifest.json"] = (json.dumps({"version": "2.2.2", "originalSourceCommit": SOURCE,
            "supplementSourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "files": {name: {"sha256": digest(data), "bytes": len(data)} for name, data in sorted(payload.items())}}, indent=2) + "\n").encode()
        output = ROOT / "release-artifacts/license-supplement-2.2.2.tgz"
        output.parent.mkdir(exist_ok=True)
        with output.open("wb") as target, gzip.GzipFile(filename="", fileobj=target, mode="wb", mtime=0) as compressed, tarfile.open(fileobj=compressed, mode="w") as archive:
            for name, data in sorted(payload.items()):
                info = tarfile.TarInfo(name)
                info.size, info.mode, info.mtime = len(data), 0o644, 0
                archive.addfile(info, io.BytesIO(data))
        print(output.name, digest(output.read_bytes()), output.stat().st_size)
