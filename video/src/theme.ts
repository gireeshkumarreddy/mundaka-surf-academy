import { continueRender, delayRender, staticFile } from 'remotion';

export const YELLOW = '#FBDE04';
export const INK = '#141414';
export const WHITE = '#FFFFFF';
export const SANS = 'Archivo, "Segoe UI", sans-serif';
export const SERIF = 'Playfair, Georgia, serif';

// self-hosted fonts from the website (variable Archivo, Playfair italic); rendering waits until they are ready
const handle = delayRender('Loading fonts');
const faces = [
  new FontFace('Archivo', `url(${staticFile('fonts/archivo-normal-latin.woff2')}) format('woff2')`, { weight: '100 900', stretch: '62% 125%' }),
  new FontFace('Archivo', `url(${staticFile('fonts/archivo-normal-latin-ext.woff2')}) format('woff2')`, {
    weight: '100 900',
    stretch: '62% 125%',
    unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  }),
  new FontFace('Playfair', `url(${staticFile('fonts/playfair-display-italic-latin.woff2')}) format('woff2')`, { style: 'italic', weight: '400 900' }),
];
Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f))))
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error(err);
    continueRender(handle);
  });
