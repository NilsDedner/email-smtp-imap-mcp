/** Build local release evidence and prove recovery from archived, integrity-checked inputs.
 * No publishing, credentials, third-party messaging or scheduled work.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'release-artifacts');
const dependencies = path.join(output, 'dependencies');
await rm(output, { recursive: true, force: true });
await mkdir(dependencies, { recursive: true });
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options
});
const json = async (filename, value) => writeFile(path.join(output, filename), JSON.stringify(value, null, 2) + '\n');
const pkg = JSON.parse(await readFile('package.json'));
const lock = JSON.parse(await readFile('package-lock.json'));
const sourceCommit = run('git', ['rev-parse', 'HEAD']).trim();
const sourceFiles = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  .split('\0').filter(Boolean).filter(file => !file.startsWith('release-artifacts/'));
if (sourceFiles.some(file => file.includes('\n') || file.startsWith('-'))) throw new Error('Unsupported archive filename');
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.sort().map(async file => [file, hash(await readFile(file))])));
const treeHash = hash(JSON.stringify(sourceHashes));
await json('source-manifest.json', { sourceCommit, treeHash, dirty: !!run('git', ['status', '--porcelain']).trim(), files: sourceHashes });
run('tar', ['-czf', path.join(output, 'source.tgz'), '-T', '-'], { input: sourceFiles.join('\n') + '\n' });

const tests = run('npm', ['test']);
await writeFile(path.join(output, 'tests.txt'), tests);
let audit;
try { audit = JSON.parse(run('npm', ['audit', '--json'])); }
catch (error) {
  if (!error.stdout) throw error;
  audit = JSON.parse(error.stdout);
}
await json('audit.json', audit);
if (audit.metadata.vulnerabilities.total !== 0) throw new Error('Unresolved dependency advisories; see audit.json');

let semgrep;
const scanArgs = ['scan', '--config', 'p/javascript', '--config', 'p/nodejs', '--config', 'p/security-audit', '--config', '.semgrep/transport-security.yml', '--metrics', 'off', '--error', '--strict', '--json', '--no-git-ignore', 'src', 'scripts'];
try { semgrep = run('semgrep', scanArgs); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  semgrep = run('uvx', ['--from', 'semgrep==1.183.0', 'semgrep', ...scanArgs]);
}
await writeFile(path.join(output, 'semgrep.json'), semgrep);
const scan = JSON.parse(semgrep);
if (scan.results.length || scan.errors.length || scan.paths.scanned.length !== sourceFiles.filter(file => (file.startsWith('src/') && file.endsWith('.ts')) || (file.startsWith('scripts/') && file.endsWith('.mjs'))).length) throw new Error('Static analysis incomplete or has findings');

const sbom = JSON.parse(run('npm', ['sbom', '--sbom-format=spdx']));
sbom.creationInfo.creators.push('Person: Sami Halawa', 'Tool: email-smtp-imap-mcp/scripts/release-assurance.mjs');
for (const component of sbom.packages) {
  component.supplier = component.name === pkg.name ? 'Person: Sami Halawa' : 'NOASSERTION';
  component.comment = component.name === pkg.name
    ? `Maintainer/distributor is package author; source tree SHA256 ${treeHash}`
    : 'Supplier identity is not asserted. Registry URL, integrity and upstream author/repository are separate evidence, not a supplier claim.';
}
await json('sbom.spdx.json', sbom);

const resolveDependency = (location, name) => {
  let prefix = location;
  while (true) {
    const candidate = `${prefix ? prefix + '/' : ''}node_modules/${name}`;
    if (lock.packages[candidate]) return candidate;
    if (!prefix) return null;
    const separator = prefix.lastIndexOf('/node_modules/');
    prefix = separator < 0 ? '' : prefix.slice(0, separator);
  }
};
const dependencyEdges = (location, component) => Object.entries({ ...component.dependencies, ...component.optionalDependencies, ...component.peerDependencies })
  .map(([name, requested]) => ({ name, requested, resolvedPath: resolveDependency(location, name), optional: name in (component.optionalDependencies || {}) || !!component.peerDependenciesMeta?.[name]?.optional, peer: name in (component.peerDependencies || {}) }));
const records = [];
const pending = Object.entries(lock.packages).filter(([location]) => location);
async function archiveWorker() {
  while (pending.length) {
    const [location, component] = pending.shift();
    if (!component.resolved?.startsWith('https://registry.npmjs.org/') || !component.integrity) throw new Error(`Unarchivable input ${location}`);
    const response = await fetch(component.resolved);
    if (!response.ok) throw new Error(`Archive download failed: ${component.resolved} ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const integrity = component.integrity.split(' ').find(value => value.startsWith('sha512-')) || component.integrity.split(' ')[0];
    const separator = integrity.indexOf('-');
    const algorithm = integrity.slice(0, separator);
    if (hash(bytes, algorithm, 'base64') !== integrity.slice(separator + 1)) throw new Error(`Integrity mismatch ${location}`);
    const sha256 = hash(bytes);
    const filename = `${sha256}.tgz`;
    await writeFile(path.join(dependencies, filename), bytes);
    // Archive is inspected, not executed. The package metadata is provenance, not proof of supplier identity.
    const entries = run('tar', ['-tzf', path.join(dependencies, filename)]).split('\n');
    const metadataPath = entries.find(entry => /^[^/]+\/package\.json$/.test(entry));
    if (!metadataPath) throw new Error(`Missing root package metadata: ${location}`);
    const metadata = JSON.parse(run('tar', ['-xOf', path.join(dependencies, filename), metadataPath]));
    records.push({ name: metadata.name, version: component.version, location, dev: !!component.dev, optional: !!component.optional,
      supplier: 'NOASSERTION', author: metadata.author ?? null, repository: metadata.repository ?? null,
      identifier: `pkg:npm/${metadata.name.replace('@', '%40')}@${component.version}`, dependencies: dependencyEdges(location, component),
      license: metadata.license ?? component.license ?? 'NOASSERTION', registry: component.resolved, integrity,
      archive: `dependencies/${filename}`, sha256, bytes: bytes.length, vulnerabilityDecision: 'No known advisory reported by npm audit for the exact final lockfile at review time; not a guarantee of absence.' });
  }
}
await Promise.all(Array.from({ length: 4 }, archiveWorker));
records.sort((a, b) => a.location.localeCompare(b.location));
await json('components.json', { author: 'Sami Halawa', generated: new Date().toISOString(), sourceCommit, treeHash,
  project: { name: pkg.name, version: pkg.version, supplier: 'Person: Sami Halawa', dependencies: dependencyEdges('', lock.packages['']) },
  supplierMethod: 'Explicit NOASSERTION for upstream suppliers; author and repository copied from integrity-verified distributed package metadata.', components: records });

const packed = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', output]));
const pack = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
if (pack.files.some(file => /(^|\/)(test|node_modules|release-artifacts)\//.test(file.path))) throw new Error('Unexpected files in distributable');
await json('package-files.json', pack);

// Restore every archived source byte and dependency using an empty npm cache, offline.
const recovery = path.join(output, 'recovery');
await rm(recovery, { recursive: true, force: true });
const recoveredRoot = path.join(recovery, 'project');
const cache = path.join(recovery, 'cache');
await mkdir(recoveredRoot, { recursive: true });
run('tar', ['-xzf', path.join(output, 'source.tgz'), '-C', recoveredRoot]);
for (const [file, expected] of Object.entries(sourceHashes)) {
  if (hash(await readFile(path.join(recoveredRoot, file))) !== expected) throw new Error(`Source recovery mismatch: ${file}`);
}
const archives = [...new Set(records.map(record => path.join(output, record.archive)))];
for (const archive of archives) run('npm', ['cache', 'add', archive, '--cache', cache, '--ignore-scripts']);
const install = run('npm', ['ci', '--offline', '--ignore-scripts', '--cache', cache], { cwd: recoveredRoot });
const recoveryTests = run('npm', ['test', '--cache', cache, '--offline'], { cwd: recoveredRoot });
await writeFile(path.join(output, 'recovery-tests.txt'), install + '\n' + recoveryTests);
await json('recovery.json', { generated: new Date().toISOString(), sourceFiles: sourceFiles.length, sourceVerified: true,
  componentRecords: records.length, uniqueArchives: archives.length, emptyCache: true, npmCiOffline: true, testsPassed: true });
await rm(recovery, { recursive: true, force: true });

const manifest = {};
async function hashes(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await hashes(filename);
    else if (entry.name !== 'checksums.json') manifest[path.relative(output, filename)] = { sha256: hash(await readFile(filename)), bytes: (await stat(filename)).size };
  }
}
await hashes(output);
await json('checksums.json', manifest);
console.log(JSON.stringify({ version: pkg.version, sourceCommit, treeHash, sources: sourceFiles.length, components: records.length,
  auditVulnerabilities: 0, semgrepFindings: 0, offlineRecovery: true, output }, null, 2));
