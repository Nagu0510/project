// Contrast audit for native <select> controls. Run it inside a page:   const r = await page.evaluate(selectContrastAudit);
//
// For every <select> it checks the closed control (text vs the effective background behind it) and EVERY option and optgroup
// (computed color vs computed background-color, falling back through the ancestors). It also checks every CSS rule that styles
// an option (:checked, :hover, :focus, :disabled) because those states cannot be hovered in a script. A violation is a pair
// under 4.5:1 (WCAG AA for normal text) or a text colour equal to its background. The function is self-contained on purpose:
// Playwright serialises it into the page.
export function selectContrastAudit() {
  const MIN = 4.5;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // any CSS colour syntax -> [r, g, b, a], by letting the browser paint it
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
  const lum = ([r, g, b]) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (fg, bg) => {
    const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const hex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  // what is really behind an element: its own and its ancestors' backgrounds composited, on a white page
  const effectiveBg = (el) => {
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    return chain.reverse().reduce((under, n) => over(rgba(getComputedStyle(n).backgroundColor), under), [255, 255, 255, 1]);
  };

  const violations = [];
  const rows = [];
  let optionCount = 0;
  const label = (select) => select.getAttribute('data-testid') || select.getAttribute('aria-label') || select.name || select.id || `select(${[...select.options].slice(0, 2).map((o) => o.text.trim()).join('/')}...)`;

  const check = (where, name, fg, bg) => {
    const same = [0, 1, 2].every((i) => Math.round(fg[i]) === Math.round(bg[i]));
    const r = same ? 1 : ratio(fg, bg);
    rows.push({ where, name, color: hex(fg), background: hex(bg), ratio: Number(r.toFixed(2)) });
    if (same) violations.push(`${where}: "${name}" text colour ${hex(fg)} equals its background`);
    else if (r < MIN) violations.push(`${where}: "${name}" ${hex(fg)} on ${hex(bg)} is ${r.toFixed(2)}:1 (needs ${MIN}:1)`);
  };

  const selects = [...document.querySelectorAll('select')];
  for (const select of selects) {
    const where = label(select);
    check(`${where} (closed)`, select.options[select.selectedIndex]?.text.trim() || '(empty)', rgba(getComputedStyle(select).color), effectiveBg(select));
    for (const item of select.querySelectorAll('option, optgroup')) {
      optionCount += 1;
      const cs = getComputedStyle(item);
      const own = rgba(cs.backgroundColor);
      // an option with no background of its own is drawn on the select's background, else on white
      const bg = own[3] > 0 ? over(own, [255, 255, 255, 1]) : over(rgba(getComputedStyle(select).backgroundColor), [255, 255, 255, 1]);
      check(`${where} option${item.disabled ? ' (disabled)' : ''}${item.selected ? ' (selected)' : ''}`, item.text || item.label || '', rgba(cs.color), bg);
    }
  }

  // option state rules (:checked, :hover, :focus, :disabled) that a script cannot trigger
  const probe = document.createElement('div');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolve = (value, prop) => { probe.style[prop] = ''; probe.style[prop] = value; return rgba(getComputedStyle(probe)[prop]); };
  let ruleCount = 0;
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue; }
      if (!rule.selectorText || !/\b(option|optgroup)\b/.test(rule.selectorText)) continue;
      const fg = rule.style.getPropertyValue('color');
      const bg = rule.style.getPropertyValue('background-color');
      if (!fg || !bg) continue;
      ruleCount += 1;
      const dark = rule.selectorText.includes('.dark-panel');
      check(`css rule ${rule.selectorText}${dark ? ' [dark panel]' : ''}`, 'rule', resolve(fg, 'color'), resolve(bg, 'backgroundColor'));
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { /* cross-origin stylesheet (fonts): not ours */ }
  }
  probe.remove();

  return { selects: selects.length, options: optionCount, rules: ruleCount, minRatio: rows.length ? Math.min(...rows.map((r) => r.ratio)) : null, violations, rows };
}
