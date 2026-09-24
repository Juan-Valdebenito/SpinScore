/* SpinScore — theme.js */

const THEME_KEY = 'spinscore_theme';
const THEMES = ['standard', 'dark', 'light'];

function themeGet() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return THEMES.includes(t) ? t : 'standard';
  } catch { return 'standard'; }
}

function themeSet(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch { /* sin almacenamiento */ }
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === t);
    el.setAttribute('aria-pressed', el.dataset.theme === t);
  });
}

function themeInit() {
  themeSet(themeGet());
}
