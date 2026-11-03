// Two moods of the same scene. Pick with ?mood=noir|modern (default noir).
const NOIR = {
  name: 'noir', label: 'Noir',
  // paper + ink
  paper: '#ede1c6', paperGrain: 0.55, ink: '#241c14', ink2: '#5d4d3a', accent: '#a3271d', accent2: '#2c3956', ochre: '#c9973f', kraft: '#b88f5c', cream: '#efe3c8', white: '#f6eedc', grey: '#c6bba5', rule: 'rgba(36,28,20,.35)', zebra: 'rgba(163,39,29,.07)',
  // type
  body: '"Courier Prime", "Courier New", monospace', bold: 700, display: '"Special Elite", "Courier Prime", monospace', title: '"Playfair Display", Georgia, serif', hand: '"Caveat", cursive', mono: '"Courier Prime", monospace',
  bodySize: 0.325, lead: 0.5, justify: false,
  // binding
  cloth: '#5b1e1a', clothSide: '#3e1512', foil: true, endpaper: ['#6f5233', 'rgba(239,227,200,.22)', 'rgba(239,227,200,.38)'],
  // room
  bg: '#0b0a09', wall: '#24261f', wood: ['#3a2416', '#2b190e', '#4a2e1b'], board: 'cork', frame: '#2a1a10',
  string: '#b3241b', twine: '#a88a5e',
};
const MODERN = {
  name: 'modern', label: 'Modern',
  paper: '#f7f6f2', paperGrain: 0.22, ink: '#15171a', ink2: '#5d636c', accent: '#ff4a1c', accent2: '#2457ff', ochre: '#ffb000', kraft: '#d8d2c4', cream: '#efede6', white: '#ffffff', grey: '#cfd2d6', rule: 'rgba(21,23,26,.25)', zebra: 'rgba(36,87,255,.06)',
  body: '"Inter", system-ui, sans-serif', bold: 600, display: '"Space Grotesk", "Inter", sans-serif', title: '"Space Grotesk", "Inter", sans-serif', hand: '"Caveat", cursive', mono: '"JetBrains Mono", monospace',
  bodySize: 0.32, lead: 0.5, justify: false,
  cloth: '#1d2024', clothSide: '#141619', foil: false, endpaper: ['#1d2024', 'rgba(255,255,255,.10)', 'rgba(255,74,28,.55)'],
  bg: '#c9c6c0', wall: '#d6d3cd', wood: ['#c9a57a', '#b48f63', '#d8b88e'], board: 'white', frame: '#9aa0a6',
  string: '#e0261b', twine: '#9a9a9a',
};
export const MOODS = { noir: NOIR, modern: MODERN };
const want = new URLSearchParams(location.search).get('mood');
export const T = MOODS[want] || NOIR;
