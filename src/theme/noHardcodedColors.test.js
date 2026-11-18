import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Guard: colours come from the theme tokens (var(--...)) so both themes stay in sync. A new hex / rgb() / hsl() literal in src/ fails this test
// unless the file is on the allowlist below, and every allowlist entry says why a literal is unavoidable there.
const ALLOWLIST = {
  'index.css': 'the token file: the only place palette values are defined',
  'theme/themeCore.js': '<meta name="theme-color"> values must be literal colours',
  'theme/theme-init.js': 'runs before CSS loads; sets the same <meta name="theme-color"> and the first-paint background',
  'theme/palette.js': 'colours drawn on a canvas (confetti) cannot read CSS variables',
  'components/three/roadmap/ribbonLayout.js': 'WebGL materials cannot read CSS variables: one palette per theme, swapped in place',
  'components/three/landing/coreBuilder.js': 'WebGL materials cannot read CSS variables: one palette per theme, swapped in place',
  'components/shared/CareerPathIcon.jsx': 'self-contained brand artwork (each icon draws its own dark tile)',
  'components/common/GoogleAuth.jsx': "Google's own brand blue for the G of the fallback button",
  'data/mockCompanies.js': 'not imported by any page (dead data)',
  'data/mockCareerPaths.js': 'not imported by any page (dead data)',
  'components/three/SkillNetwork3D.jsx': 'not mounted by any page (R3F, must be ported before use)',
  'components/three/ResumeScan3D.jsx': 'not mounted by any page (R3F, must be ported before use)',
  'components/three/QuestionNetwork3D.jsx': 'not mounted by any page (R3F, must be ported before use)',
  'components/three/CareerReadiness3D.jsx': 'not mounted by any page (R3F, must be ported before use)',
};

const SRC = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/%20/g, ' ');
const LITERAL = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|\brgba?\(\s*\d|\bhsla?\(\s*\d/g;

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return walk(full);
  return /\.(jsx?|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
});

describe('no hard-coded colours outside the token file and the documented allowlist', () => {
  const files = walk(SRC);

  it('scans a realistic number of files', () => {
    expect(files.length).toBeGreaterThan(80);
  });

  it('finds no literal colour in a file that is not allowlisted', () => {
    const offenders = [];
    files.forEach((file) => {
      const rel = relative(SRC, file).split(sep).join('/');
      if (ALLOWLIST[rel]) return;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // '&#183;' style HTML entities and url(#id) references are not colours
        const cleaned = line.replace(/&#\d+;/g, '').replace(/url\(#[\w-]+\)/g, '').replace(/href="#[\w-]*"/g, '');
        if (LITERAL.test(cleaned)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
        LITERAL.lastIndex = 0;
      });
    });
    expect(offenders, `Use var(--token) instead:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every allowlist entry still exists (no stale exceptions)', () => {
    const rels = new Set(files.map((f) => relative(SRC, f).split(sep).join('/')));
    Object.keys(ALLOWLIST).forEach((rel) => expect(rels.has(rel), rel).toBe(true));
  });
});
