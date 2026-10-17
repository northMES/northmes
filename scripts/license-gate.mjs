// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The license gate of docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md, which
// Supply chain / license gate runs. It reads the CycloneDX SBOMs that
//
//   pnpm sbom --sbom-format cyclonedx --sbom-type application --prod --split --out <dir>/%s.cdx.json
//
// writes, one per workspace package, and judges every component under the class that its
// package's own license field selects: core for AGPL-3.0-or-later, mit for MIT. A component that
// only the SBOM of the full tree (the same command without --prod, passed with --all) holds is a
// dev dependency and is judged under the dev class. The gate also fails on a package from the
// never-install table, and on an installed package with an ee/ folder or an Enterprise license
// file, which SPDX fields miss.
//
// A non-SPDX license name, or a missing license, passes only when license-clarifications.json
// maps that exact name@version to an SPDX expression after a person read the license file.
// license-exceptions.json holds the reviewed exceptions, each for one class and the license the
// package declares, with a reason.
//
// Usage: node scripts/license-gate.mjs --prod <dir> [--all <dir>] [--modules <dir>]
//   [--summary <file>] [--clarifications <file>] [--exceptions <file>]
//
// The Markdown summary goes to the job log and to --summary, or else to the file that
// GITHUB_STEP_SUMMARY names. The exit code is 1 on a violation.

import { appendFileSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * @typedef {{ name: string, value: string }} Property
 * @typedef {{ license?: { id?: string, name?: string }, expression?: string }} LicenseChoice
 * @typedef {{ name: string, version?: string, group?: string, scope?: string,
 *   licenses?: LicenseChoice[], properties?: Property[], 'bom-ref'?: string }} Component
 * @typedef {{ metadata: { component: Component }, components?: Component[] }} Bom
 * @typedef {{ package: string, license: string, reason: string }} Clarification
 * @typedef {{ package: string, class: string, license: string, reason: string }} Exception
 * @typedef {{ name: string, in?: string, reason: string }} NeverInstalled
 * @typedef {{ selectedBy?: string, allowed: readonly string[],
 *   noted: Readonly<Record<string, string>> }} LicenseClass
 * @typedef {{ classes: Record<string, LicenseClass>, neverInstalled: readonly NeverInstalled[],
 *   clarifications: readonly Clarification[], exceptions: readonly Exception[],
 *   workspace: readonly string[] }} Policy
 * @typedef {{ package: string, component: string, class: string, license: string,
 *   rule: string, message: string }} Finding
 */

/**
 * The licenses that SPDX marks as OSI-approved, for the dev class: every id an npm package is
 * likely to declare, deprecated GPL-family ids included. A dev dependency under an OSI-approved
 * license that is missing here fails the gate until its id is added.
 */
export const osiApproved = [
  '0BSD',
  'AAL',
  'AFL-1.1',
  'AFL-1.2',
  'AFL-2.0',
  'AFL-2.1',
  'AFL-3.0',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'APL-1.0',
  'APSL-2.0',
  'Apache-1.1',
  'Apache-2.0',
  'Artistic-1.0',
  'Artistic-2.0',
  'BSD-1-Clause',
  'BSD-2-Clause',
  'BSD-2-Clause-Patent',
  'BSD-3-Clause',
  'BSL-1.0',
  'BlueOak-1.0.0',
  'CAL-1.0',
  'CDDL-1.0',
  'CECILL-2.1',
  'CNRI-Python',
  'CPAL-1.0',
  'CPL-1.0',
  'ECL-2.0',
  'EFL-2.0',
  'EPL-1.0',
  'EPL-2.0',
  'EUPL-1.1',
  'EUPL-1.2',
  'GPL-2.0',
  'GPL-2.0+',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0+',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'HPND',
  'ICU',
  'IPL-1.0',
  'ISC',
  'LGPL-2.0',
  'LGPL-2.0+',
  'LGPL-2.0-only',
  'LGPL-2.0-or-later',
  'LGPL-2.1',
  'LGPL-2.1+',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0+',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'LPL-1.02',
  'LPPL-1.3c',
  'MIT',
  'MIT-0',
  'MIT-Modern-Variant',
  'MPL-1.1',
  'MPL-2.0',
  'MPL-2.0-no-copyleft-exception',
  'MS-PL',
  'MS-RL',
  'MirOS',
  'MulanPSL-2.0',
  'NCSA',
  'NTP',
  'OFL-1.1',
  'OFL-1.1-RFN',
  'OFL-1.1-no-RFN',
  'OLDAP-2.8',
  'OSL-3.0',
  'PHP-3.01',
  'PostgreSQL',
  'Python-2.0',
  'QPL-1.0',
  'RPL-1.5',
  'SPL-1.0',
  'Sleepycat',
  'UPL-1.0',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'Unlicense',
  'W3C',
  'ZPL-2.0',
  'ZPL-2.1',
  'Zlib',
];

/**
 * The policy per package class of ADR 0040. Anything a class does not allow is denied. A package
 * whose own license field matches no selectedBy fails the gate.
 * @type {{ core: LicenseClass, mit: LicenseClass, dev: LicenseClass }}
 */
export const licenseClasses = {
  core: {
    selectedBy: 'AGPL-3.0-or-later',
    allowed: [
      'MIT',
      'MIT-0',
      'ISC',
      'BSD-2-Clause',
      'BSD-3-Clause',
      '0BSD',
      'Apache-2.0',
      'Zlib',
      'Unlicense',
      'CC0-1.0',
      'BlueOak-1.0.0',
      'Python-2.0',
    ],
    noted: {
      'MPL-2.0': 'MPL-2.0 is allowed in core for unmodified files',
      'CC-BY-4.0': 'CC-BY-4.0 is allowed in core for data',
    },
  },
  mit: {
    selectedBy: 'MIT',
    allowed: [
      'MIT',
      'MIT-0',
      'ISC',
      'BSD-2-Clause',
      'BSD-3-Clause',
      '0BSD',
      'Apache-2.0',
      'Zlib',
      'Unlicense',
      'CC0-1.0',
      'BlueOak-1.0.0',
    ],
    noted: {},
  },
  dev: { allowed: osiApproved, noted: {} },
};

/**
 * The never-install table of ADR 0040, as npm names. A name ending in /* covers the scope. An entry
 * with `in` applies to the production tree of that workspace package only.
 * @type {readonly NeverInstalled[]}
 */
export const neverInstalled = [
  { name: '@graphql-yoga/nestjs-federation', reason: 'pulls Elastic-2.0 Apollo packages' },
  { name: '@apollo/gateway', reason: 'Elastic-2.0' },
  { name: 'exceljs', reason: 'pulls a package with no license' },
  { name: 'xlsx', reason: 'the npm package is stale and vulnerable' },
  {
    name: '@sentry/node',
    in: '@northmes/backend',
    reason: 'puts the FSL-licensed Sentry CLI into production installs (ADR 0052)',
  },
  { name: 'mastra', reason: 'Mastra ships source-available ee/ code' },
  { name: '@mastra/*', reason: 'Mastra ships source-available ee/ code' },
  { name: '@better-auth/cli', reason: 'replaced by auth' },
  { name: '@base-ui-components/react', reason: 'replaced by @base-ui/react' },
];

/** The CycloneDX property that annotate() sets on a package with an ee/ folder or license. */
export const enterpriseProperty = 'northmes:license-gate:enterprise';

/** The policy without clarifications or exceptions; the CLI adds the files' entries. */
export const defaultPolicy = {
  classes: licenseClasses,
  neverInstalled,
  clarifications: [],
  exceptions: [],
  workspace: [],
};

/** @param {Component} component */
function fullName({ group, name }) {
  return group ? `${group}/${name}` : name;
}

/** @param {Component} component */
function key(component) {
  return `${fullName(component)}@${component.version ?? ''}`;
}

/**
 * The license a component declares, as one string: an SPDX expression, an id, or the non-SPDX
 * name that pnpm keeps, such as SEE LICENSE IN LICENSE. Several entries must all hold.
 * @param {Component} component
 * @returns {{ text: string, spdx: boolean }}
 */
function declared({ licenses = [] }) {
  const parts = licenses.map((choice) =>
    choice.expression !== undefined
      ? { text: choice.expression, spdx: true }
      : choice.license?.id !== undefined
        ? { text: choice.license.id, spdx: true }
        : { text: choice.license?.name ?? '', spdx: false },
  );
  if (parts.length === 1) {
    return parts[0] ?? { text: '', spdx: false };
  }
  return {
    text: parts.map(({ text }) => `(${text})`).join(' AND '),
    spdx: parts.length > 0 && parts.every(({ spdx }) => spdx),
  };
}

/**
 * Parses an SPDX expression into a tree of { or }, { and } and { id } nodes, or returns undefined
 * when the text is no expression.
 * @param {string} text
 */
export function parseExpression(text) {
  const tokens = text.replaceAll('(', ' ( ').replaceAll(')', ' ) ').trim().split(/\s+/);
  let at = 0;
  const peek = () => tokens[at];
  const operator = (word) => peek()?.toUpperCase() === word;

  function primary() {
    const token = tokens[at++];
    if (token === '(') {
      const inner = disjunction();
      if (tokens[at++] !== ')') {
        throw new Error('unbalanced');
      }
      return inner;
    }
    if (token === undefined || token === ')' || /^(?:AND|OR|WITH)$/i.test(token)) {
      throw new Error('unexpected');
    }
    if (operator('WITH')) {
      at++;
      const exception = tokens[at++];
      if (exception === undefined || exception === '(' || exception === ')') {
        throw new Error('unexpected');
      }
      return { id: token, exception };
    }
    return { id: token };
  }

  function conjunction() {
    const parts = [primary()];
    while (operator('AND')) {
      at++;
      parts.push(primary());
    }
    return parts.length === 1 ? parts[0] : { and: parts };
  }

  function disjunction() {
    const parts = [conjunction()];
    while (operator('OR')) {
      at++;
      parts.push(conjunction());
    }
    return parts.length === 1 ? parts[0] : { or: parts };
  }

  try {
    const tree = disjunction();
    return at === tokens.length ? tree : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Judges a parsed expression under a class: an OR passes when one branch passes, an AND when every
 * part passes. A license with an exception (WITH) passes in core and mit only when the class
 * names the whole term, and in dev when the license itself passes.
 * @param {any} node
 * @param {string} className
 * @param {LicenseClass} cls
 * @returns {{ ok: boolean, notes: string[] }}
 */
function judge(node, className, cls) {
  if (node.or) {
    const results = node.or.map((branch) => judge(branch, className, cls));
    const clean = results.find(({ ok, notes }) => ok && notes.length === 0);
    return clean ?? results.find(({ ok }) => ok) ?? { ok: false, notes: [] };
  }
  if (node.and) {
    const results = node.and.map((part) => judge(part, className, cls));
    return {
      ok: results.every(({ ok }) => ok),
      notes: results.flatMap(({ notes }) => notes),
    };
  }
  const term = node.exception ? `${node.id} WITH ${node.exception}` : node.id;
  if (
    cls.allowed.includes(term) ||
    (node.exception && className === 'dev' && cls.allowed.includes(node.id))
  ) {
    return { ok: true, notes: [] };
  }
  if (Object.hasOwn(cls.noted, term)) {
    return { ok: true, notes: [cls.noted[term] ?? term] };
  }
  return { ok: false, notes: [] };
}

/**
 * The class that a workspace package's own license field selects, or undefined.
 * @param {Policy} policy
 * @param {string} license
 */
function classOf(policy, license) {
  return Object.entries(policy.classes).find(([, cls]) => cls.selectedBy === license)?.[0];
}

/** @param {string} name @param {string} pattern */
function matches(name, pattern) {
  return pattern.endsWith('/*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

/**
 * Applies the policy to one CycloneDX SBOM or to the list of per-package SBOMs, and returns the
 * violations, the notes (passes that the summary records, such as MPL-2.0 under core or a reviewed
 * exception) and the clarifications and exceptions that no component used.
 * @param {Bom | Bom[]} sbom
 * @param {Policy} policy
 */
export function review(sbom, policy) {
  const boms = Array.isArray(sbom) ? sbom : [sbom];
  const workspace = new Set([
    ...policy.workspace,
    ...boms.map(({ metadata }) => fullName(metadata.component)),
  ]);
  /** @type {Finding[]} */
  const violations = [];
  /** @type {Finding[]} */
  const notes = [];
  const used = new Set();

  for (const { metadata, components = [] } of boms) {
    const root = metadata.component;
    const pkg = fullName(root);
    const rootLicense = declared(root).text;
    const rootClass = classOf(policy, rootLicense);
    if (rootClass === undefined) {
      violations.push({
        package: pkg,
        component: key(root),
        class: '',
        license: rootLicense,
        rule: 'class',
        message: `${pkg} declares the license "${rootLicense}", which selects no class of the license policy: set it to AGPL-3.0-or-later or MIT`,
      });
    }
    for (const component of components) {
      const name = fullName(component);
      const id = key(component);
      const className = component.scope === 'excluded' ? 'dev' : (rootClass ?? 'core');
      const cls = policy.classes[className];
      const { text, spdx } = declared(component);
      const finding = { package: pkg, component: id, class: className, license: text };

      for (const entry of policy.neverInstalled) {
        const applies =
          matches(name, entry.name) &&
          (entry.in === undefined || (entry.in === pkg && className !== 'dev'));
        if (applies) {
          violations.push({
            ...finding,
            rule: 'never-installed',
            message: `${id} is on the never-install list of ADR 0040 (${entry.reason})${entry.in ? ` for ${entry.in}` : ''}`,
          });
        }
      }

      const enterprise = (component.properties ?? []).filter(
        ({ name: property }) => property === enterpriseProperty,
      );
      if (enterprise.length > 0) {
        violations.push({
          ...finding,
          rule: 'enterprise',
          message: `${id} ships ${enterprise.map(({ value }) => value).join(', ')}, an ee/ folder or Enterprise license file that its SPDX field does not show`,
        });
      }

      const exception = policy.exceptions.find(
        (entry) =>
          (entry.package === id || entry.package === name) &&
          entry.class === className &&
          entry.license === text,
      );
      if (exception) {
        used.add(exception);
        notes.push({ ...finding, rule: 'exception', message: exception.reason });
        continue;
      }

      if (workspace.has(name)) {
        if (className === 'mit' && /^AGPL-/.test(text)) {
          violations.push({
            ...finding,
            rule: 'workspace',
            message: `${pkg} is an MIT package and depends on the AGPL workspace package ${id}`,
          });
          continue;
        }
        if (className === 'core' && text === policy.classes.core?.selectedBy) {
          continue;
        }
      }

      const clarification = policy.clarifications.find((entry) => entry.package === id);
      let expression = spdx ? text : undefined;
      if (clarification && (!spdx || text === '')) {
        used.add(clarification);
        expression = clarification.license;
      }
      if (expression === undefined || expression === '') {
        violations.push({
          ...finding,
          rule: 'license',
          message:
            text === ''
              ? `${id} declares no license; read its license file and map ${id} in license-clarifications.json`
              : `${id} declares "${text}", which is not an SPDX expression; read its license file and map ${id} in license-clarifications.json`,
        });
        continue;
      }
      const tree = parseExpression(expression);
      const result = tree ? judge(tree, className, cls) : { ok: false, notes: [] };
      const clarified = clarification !== undefined && expression !== text;
      const shown = clarified ? `${expression} (clarified)` : expression;
      if (!result.ok) {
        violations.push({
          ...finding,
          rule: 'license',
          message: `${id} is licensed ${shown}, which the ${className} class of ${pkg} does not allow`,
        });
        continue;
      }
      if (clarified) {
        notes.push({
          ...finding,
          rule: 'clarification',
          message: `clarified as ${expression}: ${clarification.reason}`,
        });
      }
      for (const note of result.notes) {
        notes.push({ ...finding, rule: 'note', message: note });
      }
    }
  }

  const unused = [...policy.clarifications, ...policy.exceptions].filter(
    (entry) => !used.has(entry),
  );
  return { violations, notes, unused };
}

/**
 * The violations of the policy in one SBOM or a list of per-package SBOMs.
 * @param {Bom | Bom[]} sbom
 * @param {Policy} policy
 * @returns {Finding[]}
 */
export function evaluate(sbom, policy) {
  return review(sbom, policy).violations;
}

const licenseFile = /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i;
const enterpriseTerms = /\benterprise\s+(?:edition|licen[cs]e)\b/i;

/**
 * The ee/ folders and Enterprise license files in an installed package, as paths relative to it,
 * folders with a trailing slash. Nested node_modules folders are left out.
 * @param {string} dir
 * @returns {string[]}
 */
export function scanPackage(dir) {
  /** @type {string[]} */
  const found = [];
  const pending = [''];
  for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
    for (const entry of readdirSync(join(dir, at), { withFileTypes: true })) {
      const path = at === '' ? entry.name : `${at}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === 'ee') {
          found.push(`${path}/`);
        } else if (entry.name !== 'node_modules') {
          pending.push(path);
        }
      } else if (
        entry.isFile() &&
        (licenseFile.test(entry.name) || /enterprise/i.test(entry.name))
      ) {
        const text = readFileSync(join(dir, path), 'utf8').slice(0, 65536);
        if (/enterprise/i.test(entry.name) || enterpriseTerms.test(text)) {
          found.push(path);
        }
      }
    }
  }
  return found.sort();
}

/**
 * Copies the SBOM and adds the enterprise property to every component whose installed folder has
 * an ee/ folder or an Enterprise license file. `dirOf` returns a component's folder, or undefined
 * when it is not installed.
 * @param {Bom | Bom[]} sbom
 * @param {(component: Component) => string | undefined} dirOf
 */
export function annotate(sbom, dirOf) {
  const cache = new Map();
  const one = (bom) => ({
    ...bom,
    components: (bom.components ?? []).map((component) => {
      const dir = dirOf(component);
      if (dir === undefined) {
        return component;
      }
      if (!cache.has(dir)) {
        cache.set(dir, scanPackage(dir));
      }
      const found = cache.get(dir);
      return found.length === 0
        ? component
        : {
            ...component,
            properties: [
              ...(component.properties ?? []),
              ...found.map((value) => ({ name: enterpriseProperty, value })),
            ],
          };
    }),
  });
  return Array.isArray(sbom) ? sbom.map(one) : one(sbom);
}

/**
 * The installed packages in pnpm's virtual store (node_modules/.pnpm), as name@version to folder.
 * Each store entry holds its package as a real folder and its dependencies as links.
 * @param {string} store
 * @returns {Map<string, string>}
 */
export function installedPackages(store) {
  const found = new Map();
  let entries = [];
  try {
    entries = readdirSync(store, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const modules = join(store, entry.name, 'node_modules');
    if (!entry.isDirectory() || entry.name === 'node_modules') {
      continue;
    }
    let names = [];
    try {
      names = readdirSync(modules);
    } catch {
      continue;
    }
    const dirs = names.flatMap((name) =>
      name.startsWith('@')
        ? readdirSync(join(modules, name)).map((inner) => join(modules, name, inner))
        : [join(modules, name)],
    );
    for (const dir of dirs) {
      if (lstatSync(dir).isSymbolicLink()) {
        continue;
      }
      try {
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        found.set(`${manifest.name}@${manifest.version}`, dir);
      } catch {
        // A folder without a readable package.json is no installed package.
      }
    }
  }
  return found;
}

/**
 * Marks each component of the full-tree SBOMs that the production SBOM of the same workspace
 * package lacks as a dev dependency (CycloneDX scope excluded), and every other one as required.
 * @param {Bom[]} prod
 * @param {Bom[]} all
 */
export function withDevScope(prod, all) {
  const byRoot = new Map(
    prod.map((bom) => [key(bom.metadata.component), new Set((bom.components ?? []).map(key))]),
  );
  return all.map((bom) => {
    const shipped = byRoot.get(key(bom.metadata.component)) ?? new Set();
    return {
      ...bom,
      components: (bom.components ?? []).map((component) => ({
        ...component,
        scope: shipped.has(key(component)) ? 'required' : 'excluded',
      })),
    };
  });
}

/** @param {string} text */
function cell(text) {
  return text.replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');
}

/**
 * A Markdown table of findings, one row per component, class and finding, with every workspace
 * package that has it.
 * @param {Finding[]} findings
 */
function table(findings) {
  /** @type {Map<string, { finding: Finding, packages: string[] }>} */
  const rows = new Map();
  for (const finding of findings) {
    const id = [finding.component, finding.class, finding.license, finding.message].join('\0');
    const row = rows.get(id) ?? { finding, packages: [] };
    row.packages.push(finding.package);
    rows.set(id, row);
  }
  return [
    '| Component | Class | License | Finding | Packages |',
    '|---|---|---|---|---|',
    ...[...rows.values()].map(
      ({ finding: f, packages }) =>
        `| ${cell(f.component)} | ${f.class} | ${cell(f.license || 'none')} | ${cell(f.message)} | ${cell(packages.join(', '))} |`,
    ),
  ];
}

/**
 * The Markdown summary of a review.
 * @param {ReturnType<typeof review>} result
 * @param {Bom[]} boms
 */
export function summarize({ violations, notes, unused }, boms) {
  const packages = boms.length;
  const components = new Set(boms.flatMap(({ components = [] }) => components.map(key))).size;
  const lines = ['## License gate', ''];
  lines.push(
    violations.length === 0
      ? `No violations in ${packages} workspace packages and ${components} components.`
      : `${violations.length} violations in ${packages} workspace packages and ${components} components.`,
  );
  if (violations.length > 0) {
    lines.push('', '### Violations', '', ...table(violations));
  }
  if (notes.length > 0) {
    lines.push('', '### Notes and reviewed exceptions', '', ...table(notes));
  }
  if (unused.length > 0) {
    lines.push(
      '',
      '### Unused entries',
      '',
      'No component matched these entries of license-clarifications.json or license-exceptions.json:',
      '',
      ...unused.map((entry) => `- ${entry.package} (${entry.license})`),
    );
  }
  return `${lines.join('\n')}\n`;
}

/** @param {string} dir @returns {Bom[]} */
function readBoms(dir) {
  let names = [];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  } catch {
    names = [];
  }
  return names.sort().map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')));
}

/** @param {string} path @param {string} field */
function readEntries(path, field) {
  return JSON.parse(readFileSync(path, 'utf8'))[field] ?? [];
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { values } = parseArgs({
    options: {
      prod: { type: 'string' },
      all: { type: 'string' },
      modules: { type: 'string', default: join(root, 'node_modules/.pnpm') },
      summary: { type: 'string' },
      clarifications: { type: 'string', default: join(root, 'license-clarifications.json') },
      exceptions: { type: 'string', default: join(root, 'license-exceptions.json') },
    },
  });
  if (values.prod === undefined) {
    process.stderr.write('license gate: --prod <dir> names the folder of the production SBOMs\n');
    return 2;
  }
  const prod = readBoms(resolve(values.prod));
  const all = values.all === undefined ? [] : readBoms(resolve(values.all));
  if (prod.length === 0 || (values.all !== undefined && all.length === 0)) {
    process.stderr.write(`license gate: no SBOM in ${values.all ?? values.prod}\n`);
    return 1;
  }
  const boms = values.all === undefined ? prod : withDevScope(prod, all);
  const installed = installedPackages(resolve(values.modules));
  const policy = {
    ...defaultPolicy,
    clarifications: readEntries(values.clarifications, 'clarifications'),
    exceptions: readEntries(values.exceptions, 'exceptions'),
  };
  const result = review(
    annotate(boms, (component) => installed.get(key(component))),
    policy,
  );
  const markdown = summarize(result, boms);
  const target = values.summary ?? process.env.GITHUB_STEP_SUMMARY;
  if (target) {
    appendFileSync(target, markdown);
  }
  process.stdout.write(markdown);
  return result.violations.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
