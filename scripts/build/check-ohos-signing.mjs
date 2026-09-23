#!/usr/bin/env node
/**
 * Check: HarmonyOS signing config is internally consistent (when present).
 *
 * Not a hard fail when signing is absent — unsigned HAPs still build; that
 * state exits 0 with a tip. Once `signingConfigs` is non-empty, inconsistency
 * exits non-zero.
 *
 * hvigor's own errors here are actively misleading. A missing
 * `products[].signingConfig` surfaces as "no signature file"; a private key
 * that does not match the certificate surfaces as "Certificates error —
 * check whether the keyAlias is correct", which sends you off renaming an
 * alias that was never the problem. This script says which of the *four*
 * separate things is wrong, before hvigor gets a chance to guess.
 *
 * What it checks (no secrets needed — nothing here opens the .p12):
 *   1. `signingConfigs` is non-empty and `products[].signingConfig` names one
 *   2. every referenced file exists
 *   3. the certificate in `certpath` is the one embedded in the `profile`
 *   4. the profile's bundle-name matches AppScope/app.json5
 *   5. the profile is a debug profile with an unexpired validity window
 *   6. the profile lists at least one device UDID
 *
 * What it CANNOT check: whether the private key inside `storeFile` matches the
 * certificate. That needs the keystore password, and hvigor stores it
 * DevEco-encrypted. If this script passes and signing still fails, that match
 * is the thing left to verify — see the note in ohos/README.md.
 *
 * Exit codes: 0 = consistent OR signing simply not configured; 1 = broken.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OHOS = join(ROOT, 'ohos');
const PROFILE_JSON5 = join(OHOS, 'build-profile.json5');
const APP_JSON5 = join(OHOS, 'AppScope/app.json5');

/**
 * Strips `//` comments and trailing commas so the JSON5 config can go through
 * `JSON.parse`. Only line comments appear in these files; the quote-aware walk
 * keeps a `//` inside a string (e.g. in a path) from truncating the line.
 */
function parseJson5Like(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += text[i + 1] ?? '';
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const problems = [];

if (!existsSync(PROFILE_JSON5)) {
  console.error(`check-ohos-signing: ${PROFILE_JSON5} not found`);
  process.exit(1);
}

const config = parseJson5Like(readFileSync(PROFILE_JSON5, 'utf8'));
const app = config.app ?? {};
const signingConfigs = app.signingConfigs ?? [];
const products = app.products ?? [];

if (signingConfigs.length === 0) {
  console.log('check-ohos-signing: signing not configured — HAPs build unsigned and cannot be installed.');
  console.log('  Sign once in DevEco Studio (see ohos/README.md) to enable --deploy / --run.');
  process.exit(0);
}

// (1) The linkage that is easiest to leave out, and whose absence reads as
// "no signature file" rather than as a missing reference.
for (const product of products) {
  const bound = product.signingConfig;
  if (!bound) {
    problems.push(
      `product '${product.name}' has no "signingConfig" — the configs below are declared but never applied. ` +
        'Add "signingConfig": "<name>".',
    );
  } else if (!signingConfigs.some((c) => c.name === bound)) {
    problems.push(`product '${product.name}' references signingConfig '${bound}', which does not exist.`);
  }
}

const appBundleName = existsSync(APP_JSON5)
  ? parseJson5Like(readFileSync(APP_JSON5, 'utf8')).app?.bundleName
  : undefined;

/** Material paths are absolute here; resolve relative ones against ohos/. */
const resolvePath = (p) => (isAbsolute(p) ? p : resolve(OHOS, p));

for (const entry of signingConfigs) {
  const label = `signingConfig '${entry.name}'`;
  const material = entry.material ?? {};
  const { storeFile, profile, certpath, keyAlias } = material;

  if (!keyAlias) problems.push(`${label}: no "keyAlias"`);

  for (const [field, value] of [['storeFile', storeFile], ['profile', profile], ['certpath', certpath]]) {
    if (!value) {
      problems.push(`${label}: no "${field}"`);
    } else if (!existsSync(resolvePath(value))) {
      problems.push(`${label}: ${field} does not exist: ${value}`);
    }
  }

  if (!material.storePassword || material.storePassword.length < 32) {
    problems.push(
      `${label}: storePassword must be DevEco's encrypted value (hvigor rejects anything shorter than 32 chars). ` +
        'Let DevEco Studio write this field rather than typing it.',
    );
  }

  // (3)(4)(5)(6) need the profile, which is a CMS blob we can only reach via openssl.
  if (!profile || !existsSync(resolvePath(profile))) continue;
  const profilePath = resolvePath(profile);

  let profileJson;
  try {
    profileJson = JSON.parse(
      execFileSync('openssl', ['smime', '-inform', 'DER', '-verify', '-in', profilePath, '-noverify'], {
        encoding: 'utf8',
        // openssl prints "Verification successful" to stderr; only stdout is the payload.
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 8 * 1024 * 1024,
      }),
    );
  } catch {
    problems.push(`${label}: could not read the provisioning profile ${profile} (needs openssl + a valid .p7b)`);
    continue;
  }

  const info = profileJson['bundle-info'] ?? {};
  if (appBundleName && info['bundle-name'] !== appBundleName) {
    problems.push(
      `${label}: profile is for bundle '${info['bundle-name']}' but AppScope/app.json5 declares '${appBundleName}'. ` +
        'A profile only signs the bundle it was issued for.',
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const validity = profileJson.validity ?? {};
  if (validity['not-before'] && now < validity['not-before']) {
    problems.push(`${label}: profile is not valid yet (starts ${new Date(validity['not-before'] * 1000).toISOString()})`);
  }
  if (validity['not-after'] && now > validity['not-after']) {
    problems.push(`${label}: profile expired ${new Date(validity['not-after'] * 1000).toISOString()}`);
  }

  const deviceIds = profileJson['debug-info']?.['device-ids'] ?? [];
  if (profileJson.type === 'debug' && deviceIds.length === 0) {
    problems.push(`${label}: debug profile lists no device UDIDs — it will not install on any device.`);
  }

  // (3) The certificate must be the one the profile vouches for, otherwise the
  // signature is made with a cert the device was never told to trust.
  if (certpath && existsSync(resolvePath(certpath))) {
    // A HarmonyOS `.cer` is usually a PEM *chain* (root → intermediate → leaf),
    // and the development certificate is the LAST one. `openssl x509 -in` reads
    // only the first, which is the root CA — comparing that finds a mismatch
    // that is not real.
    const blocks =
      readFileSync(resolvePath(certpath), 'utf8').match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
      ) ?? [];
    if (blocks.length === 0) {
      problems.push(`${label}: no PEM certificate found in ${certpath}`);
    } else {
      const leaf = blocks[blocks.length - 1];
      const leafKey = execFileSync('openssl', ['x509', '-noout', '-pubkey'], {
        input: leaf,
        encoding: 'utf8',
      });
      const profileKey = execFileSync('openssl', ['x509', '-noout', '-pubkey'], {
        input: info['development-certificate'] ?? '',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (leafKey.trim() !== profileKey.trim()) {
        problems.push(
          `${label}: the certificate in certpath is NOT the one embedded in the profile. ` +
            'They must be the same certificate.',
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error('check-ohos-signing: FAILED');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  console.error('  The p12 private key matching the certificate cannot be checked here (it');
  console.error('  needs the keystore password). If the above is clean and signing still');
  console.error('  fails, the key is the remaining suspect — see ohos/README.md.');
  process.exit(1);
}

console.log(`check-ohos-signing: ok — ${signingConfigs.length} config(s), cert/profile/bundle agree.`);
console.log('  (not verified: that the p12 private key matches the certificate — needs the password)');
