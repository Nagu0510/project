// Text contrast audit for BOTH themes. Run it inside a page:   const r = await page.evaluate(textContrastAudit);
//
// Every visible element that owns text is measured: its computed colour (with its alpha and the opacity of its ancestors) against what is
// really behind it (the ancestors' backgrounds composited on the page background). WCAG AA: 4.5:1 for normal text, 3:1 for large text
// (>= 24px, or >= 18.66px and bold). A text colour equal to its background is always a violation. Disabled controls are exempt (WCAG 1.4.3).
// Anything on a gradient or an image cannot be judged this way: it is counted in `skipped` (and reported as a warning), never silently passed.
// Self-contained on purpose: Playwright serialises it into the page.
export function textContrastAudit() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  const ratioOf = (fg, bg) => { const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
  const hex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  const pageBg = (() => {
    const html = rgba(getComputedStyle(document.documentElement).backgroundColor);
    const body = rgba(getComputedStyle(document.body).backgroundColor);
    return over(body, over(html, [255, 255, 255, 1]));
  })();

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const describe = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 36)}"`;

  const violations = [];
  const seen = new Set();
  let checked = 0;
  let skipped = 0;
  const skippedSamples = [];

  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'OPTION', 'OPTGROUP', 'SELECT', 'CANVAS', 'SVG', 'NOSCRIPT'].includes(el.tagName.toUpperCase())) continue;
    if (!el.childNodes.length) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (text.length < 2 || !visible(el)) continue;
    if (/^[\p{Extended_Pictographic}\s️‍·•→←✓✕✦★☆▲▼]+$/u.test(text)) continue; // glyph-only decoration
    if (el.closest('[aria-hidden="true"], [disabled], [aria-disabled="true"]') || el.matches(':disabled')) continue;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.opacity) < 0.05) continue;

    // chain from the root to the element: backgrounds composited, opacities multiplied
    const chain = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
    chain.reverse();
    let bg = pageBg;
    let opacity = 1;
    let unjudgeable = false;
    for (const n of chain) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none' && n !== document.body) unjudgeable = true; // a gradient or an image: restart from a clean slate below
      bg = over(rgba(s.backgroundColor), bg);
      opacity *= parseFloat(s.opacity);
      if (s.backgroundImage === 'none' && rgba(s.backgroundColor)[3] >= 0.99) unjudgeable = false; // an opaque colour on top hides whatever was below
    }
    if (opacity < 0.05) continue; // an ancestor is faded out (a reveal animation that has not played): nothing is visible to judge
    if (unjudgeable) { skipped += 1; if (skippedSamples.length < 6) skippedSamples.push(describe(el)); continue; }
    const fgRaw = rgba(cs.color);
    const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacity], bg);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    checked += 1;
    const same = [0, 1, 2].every((i) => Math.round(fg[i]) === Math.round(bg[i]));
    const r = same ? 1 : ratioOf(fg, bg);
    if (r < need) {
      const key = `${hex(fg)}|${hex(bg)}|${describe(el)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push(`${describe(el)} ${hex(fg)} on ${hex(bg)} = ${r.toFixed(2)}:1 (needs ${need}:1${same ? ', text colour equals background' : ''})`);
    }
  }

  return { checked, skipped, skippedSamples, violations };
}
