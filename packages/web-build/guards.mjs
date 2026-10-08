// SPDX-License-Identifier: MIT
// Vite plugins that fail a remote's build when it breaks a rule of ADR 0003 or ADR 0019.
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { singletons } from './shared.mjs';

/**
 * The package a share key or a path inside node_modules belongs to: @apollo/client/react belongs
 * to @apollo/client.
 *
 * @param {string} key
 */
function packageOfKey(key) {
  const segments = key.split('/');
  return key.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/**
 * The installed package a module id lies in, with the file's path from node_modules, or
 * undefined for a file outside node_modules.
 *
 * @param {string} moduleId
 */
function installedPackageOf(moduleId) {
  const path = moduleId.replaceAll('\\', '/');
  const index = path.lastIndexOf('/node_modules/');
  if (index === -1) {
    return undefined;
  }
  const inPackage = path.slice(index + '/node_modules/'.length);
  return { name: packageOfKey(inPackage), file: inPackage };
}

/**
 * Fails the build when a chunk holds code from a package the shell shares as a singleton, for
 * example through a subpath outside the share keys, such as @apollo/client/cache. That code would
 * run as a second copy beside the shell's, with its own React context or Apollo cache. graphql
 * has no share key, because a remote reaches it only through Apollo Client, so code from graphql
 * in a chunk is a second copy too.
 *
 * @returns {import('vite').Plugin}
 */
export function noBundledSingletons() {
  const forbidden = new Set([...singletons().map(packageOfKey), 'graphql']);
  return {
    name: 'northmes:no-bundled-singletons',
    apply: 'build',
    generateBundle(_options, bundle) {
      /** @type {Map<string, string>} */
      const offenders = new Map();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') {
          continue;
        }
        for (const moduleId of chunk.moduleIds) {
          const installed = installedPackageOf(moduleId);
          if (installed && forbidden.has(installed.name) && !offenders.has(installed.name)) {
            offenders.set(installed.name, `${installed.file} in ${chunk.fileName}`);
          }
        }
      }
      if (offenders.size > 0) {
        const names = [...offenders.keys()];
        const details = [...offenders].map(([name, where]) => `  ${name}: ${where}`);
        this.error(
          [
            `this remote bundles ${names.join(', ')}. The shell provides the singleton packages ` +
              'and graphql once (ADR 0019), and a remote reaches them only through the share ' +
              'keys in shared.mjs of @northmes/web-build:',
            ...details,
          ].join('\n'),
        );
      }
    },
  };
}

/**
 * Fails the build when the remote emits CSS. A remote under modules/<id>/web imports no
 * stylesheet: the shell builds one Tailwind sheet that covers the remote's classes, and a remote's
 * own sheet loaded after it could override the shell's rules (ADR 0019). An empty stylesheet still
 * emits a file, so any CSS file fails.
 *
 * @returns {import('vite').Plugin}
 */
export function noRemoteCss() {
  return {
    name: 'northmes:no-remote-css',
    apply: 'build',
    generateBundle(_options, bundle) {
      const sheets = Object.values(bundle)
        .filter((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
        .map((file) => file.fileName);
      if (sheets.length > 0) {
        this.error(
          `this remote emits CSS (${sheets.join(', ')}). A remote under modules/*/web imports no ` +
            "stylesheet, because the shell's one stylesheet covers its classes (ADR 0019).",
        );
      }
    },
  };
}

/**
 * Every node of an ESTree AST, depth first.
 *
 * @param {unknown} node
 * @returns {Generator<Record<string, any>>}
 */
function* nodesOf(node) {
  if (Array.isArray(node)) {
    for (const item of node) {
      yield* nodesOf(item);
    }
  } else if (typeof node === 'object' && node !== null) {
    if ('type' in node) {
      yield node;
    }
    for (const value of Object.values(node)) {
      yield* nodesOf(value);
    }
  }
}

/**
 * The version that a defineWebModule call in a program passes as a string literal.
 *
 * @param {unknown} program
 * @returns {string | undefined}
 */
function declaredVersion(program) {
  for (const node of nodesOf(program)) {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'defineWebModule' &&
      node.arguments[0]?.type === 'ObjectExpression'
    ) {
      const property = node.arguments[0].properties.find(
        (/** @type {Record<string, any>} */ candidate) =>
          candidate.type === 'Property' &&
          candidate.key.type === 'Identifier' &&
          candidate.key.name === 'version',
      );
      return typeof property?.value.value === 'string' ? property.value.value : undefined;
    }
  }
  return undefined;
}

/** @type {Record<string, 'js' | 'jsx' | 'ts' | 'tsx'>} */
const languages = { '.jsx': 'jsx', '.ts': 'ts', '.tsx': 'tsx' };

/**
 * Fails the build when the version that the remote's entry passes to defineWebModule differs
 * from the version of the module's manifest. Both repeat the same value, and the server serves
 * the remote under the manifest's version (ADR 0003).
 *
 * @param {{ entry: string, version: string }} options
 * @returns {import('vite').Plugin}
 */
export function webModuleVersion({ entry, version }) {
  let entryFile = '';
  return {
    name: 'northmes:web-module-version',
    apply: 'build',
    configResolved(config) {
      entryFile = resolve(config.root, entry);
    },
    // The check reads the entry itself before the build starts: an error raised in transform
    // leaves @module-federation/vite waiting for its module parse timeout of 10 s.
    buildStart() {
      const program = this.parse(readFileSync(entryFile, 'utf8'), {
        lang: languages[extname(entryFile)] ?? 'js',
      });
      const declared = declaredVersion(program);
      if (declared === undefined) {
        this.error(
          `the build reads the version as a string literal from defineWebModule in ${entry}, and ` +
            'finds none, so it cannot compare it with the module manifest (ADR 0003).',
        );
      }
      if (declared !== version) {
        this.error(
          `defineWebModule in ${entry} declares version ${declared}, but the module manifest ` +
            `declares version ${version} (ADR 0003).`,
        );
      }
    },
  };
}
