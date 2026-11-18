(function () {
  var colors = { light: '#F4F0E7', dark: '#0D1411' };
  var pref = 'system';
  try {
    var saved = window.localStorage.getItem('skillsense-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved;
  } catch (e) {}
  var systemDark = false;
  try { systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  var theme = pref === 'dark' || (pref === 'system' && systemDark) ? 'dark' : 'light';
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  root.style.backgroundColor = colors[theme];
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', colors[theme]);
})();
