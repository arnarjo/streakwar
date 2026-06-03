/* StreakWar — design tokens (bold reimagining: deep navy + orange, athletic) */
window.C = {
  // surfaces
  bg:        '#0A0E14',   // app background (deep navy-black)
  bgGrad:    '#0E1620',   // top of subtle vertical wash
  surface:   '#131A23',   // cards
  surface2:  '#1A2330',   // inputs / elevated
  surface3:  '#222E3C',   // pressed / hover
  line:      'rgba(255,255,255,0.08)',
  line2:     'rgba(255,255,255,0.045)',

  // text  (contrast-fixed vs old #4A6070)
  text:      '#F3F7FA',
  text2:     '#AEBCC8',   // secondary  (~8:1 on bg — passes AA)
  text3:     '#7C8C9A',   // tertiary   (captions ≥12px/600 only)

  // brand
  primary:     '#F97316',
  primaryBri:  '#FB923C',
  primaryDeep: '#C2410C',
  amber:       '#F5B945',
  onPrimary:   '#1A0E04',

  // semantic
  green: '#34D399',
  red:   '#F87171',
  blue:  '#54B8F0',

  // medals / tiers
  gold:   '#F5B945',
  silver: '#C7D0D9',
  bronze: '#CB8A52',
  plat:   '#79C7F2',
  diamond:'#B79BF7',
};

window.F = {
  disp: "'Saira Condensed', 'Saira', system-ui, sans-serif", // big numbers, titles
  ui:   "'Saira', system-ui, sans-serif",                    // body / labels
};

// alpha helper: a('#F97316', 0.2)
window.a = function (hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// inject global stylesheet (fonts, base, scrollbars, keyframes)
(function injectGlobal() {
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=Saira:wght@300;400;500;600;700&family=Saira+Condensed:wght@500;600;700;800&family=Saira+SemiCondensed:wght@500;600;700;800&display=swap');

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  ::selection { background: ${a('#F97316', 0.3)}; }

  .sw-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; }
  .sw-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }

  .sw-tap { cursor: pointer; transition: transform .12s ease, background .15s ease, border-color .15s ease, opacity .15s ease; user-select: none; }
  .sw-tap:active { transform: scale(0.97); }
  .sw-press:active { transform: scale(0.985); }

  @keyframes sw-fade   { from { opacity: 0 } to { opacity: 1 } }
  @keyframes sw-rise   { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
  @keyframes sw-pop    { 0% { opacity:0; transform: scale(.82) } 60% { transform: scale(1.04) } 100% { opacity:1; transform: scale(1) } }
  @keyframes sw-slideL { from { opacity:0; transform: translateX(28px) } to { opacity:1; transform: none } }
  @keyframes sw-slideR { from { opacity:0; transform: translateX(-28px) } to { opacity:1; transform: none } }
  @keyframes sw-sheet  { from { transform: translateY(100%) } to { transform: translateY(0) } }
  @keyframes sw-shimmer{ 0% { background-position: -360px 0 } 100% { background-position: 360px 0 } }
  @keyframes sw-flame  { 0%,100% { transform: scale(1) rotate(-1deg) } 50% { transform: scale(1.07) rotate(1deg) } }
  @keyframes sw-spin   { to { transform: rotate(360deg) } }
  @keyframes sw-confetti { 0% { transform: translateY(0) rotate(0); opacity:1 } 100% { transform: translateY(420px) rotate(540deg); opacity:0 } }
  @keyframes sw-ring   { 0% { transform: scale(.6); opacity:.7 } 100% { transform: scale(2.2); opacity:0 } }
  @keyframes sw-bar    { from { transform: scaleX(0) } to { transform: scaleX(1) } }
  @keyframes sw-glow   { 0%,100% { opacity:.5 } 50% { opacity:.9 } }

  .sw-skel { background: linear-gradient(90deg, ${a('#FFFFFF',0.03)} 25%, ${a('#FFFFFF',0.07)} 37%, ${a('#FFFFFF',0.03)} 63%); background-size: 720px 100%; animation: sw-shimmer 1.4s linear infinite; }

  input, textarea { font-family: ${F.ui}; }
  input::placeholder, textarea::placeholder { color: ${C.text3}; opacity: 1; }
  input:focus, textarea:focus { outline: none; }
  `;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();
