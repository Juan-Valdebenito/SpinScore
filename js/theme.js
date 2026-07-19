/* SpinScore v1.9 — theme.js */

const THEME_KEY = 'spinscore_theme';
const THEMES = ['standard', 'dark', 'light'];

function themeGet() {
  return localStorage.getItem(THEME_KEY) || 'standard';
}

function themeSet(t) {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.setAttribute('data-theme', t);
  // Update pickers wherever they are
  document.querySelectorAll('.theme-option').forEach(el =>
    el.classList.toggle('active', el.dataset.theme === t));
}

function themeInit() {
  themeSet(themeGet());
}
