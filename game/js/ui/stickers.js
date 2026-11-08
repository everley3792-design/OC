/* OC Shimeji 10.0 — sticker icons (OC.UI.sticker). Original, hand-built 48-grid illustrations:
 * a filled base shape, a darker shade on the lower/right side, and a small white glint — the "moulded toy" look
 * of the design system. Used for places, tools, navigation and big list icons; the thin line icons (OC.UI.icon)
 * stay for small inline glyphs. Colours are part of the illustration (the same in light and dark themes; the
 * dark theme only lowers their brightness slightly in CSS).
 */
(function () {
  'use strict';
  const glint = (x, y, r = 2.2) => `<ellipse cx="${x}" cy="${y}" rx="${r * 1.4}" ry="${r * 0.8}" transform="rotate(-35 ${x} ${y})" fill="#fff" opacity=".75"/>`;
  function gear(cx, cy, R, r, n) {
    let d = ''; const step = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a = i * step, pts = [[a - step * 0.28, r], [a - step * 0.17, R], [a + step * 0.17, R], [a + step * 0.28, r], [a + step * 0.5, r]];
      for (const [t, rr] of pts) d += (d ? 'L' : 'M') + (cx + Math.cos(t) * rr).toFixed(2) + ' ' + (cy + Math.sin(t) * rr).toFixed(2);
    }
    return d + 'Z';
  }
  const S = {
    island: `<ellipse cx="24" cy="41" rx="19" ry="3.6" fill="#A9DE8C"/>
      <circle cx="35" cy="17" r="8.5" fill="#86D163"/><circle cx="37.5" cy="20" r="5.5" fill="#62B347"/><rect x="33.6" y="22" width="3" height="10" rx="1.5" fill="#B9804F"/>
      <rect x="9" y="21" width="24" height="18.5" rx="3.5" fill="#FFF4E1"/><rect x="9" y="33" width="24" height="6.5" rx="3" fill="#F3DFBF"/>
      <path d="M5.8 23.2 19.6 10.6a2.2 2.2 0 0 1 3 0l13.8 12.6c.9.8.3 2.3-.9 2.3H6.7c-1.2 0-1.8-1.5-.9-2.3z" fill="#5BC0A0"/>
      <path d="M21.1 10.1a2.2 2.2 0 0 1 1.5.5l13.8 12.6c.9.8.3 2.3-.9 2.3H21.1z" fill="#45A688"/>
      <rect x="16.8" y="28" width="8" height="11.5" rx="4" fill="#D48F5D"/><circle cx="23" cy="34" r=".9" fill="#FFD45C"/>
      <rect x="27" y="27.5" width="4.2" height="4.2" rx="1.2" fill="#FFD45C"/>${glint(12.5, 21)}`,
    person: `<circle cx="24" cy="26" r="14.5" fill="#FFEBDD"/><path d="M38 28a14.5 14.5 0 0 1-27.6 6.2A14.5 14.5 0 0 0 38 28z" fill="#F8D6C6"/>
      <path d="M8.8 22.5C8.8 11 39.6 9.3 39.6 21.3c-6.2-4.6-24.3-4.6-30.8 1.2z" fill="#8F88F2"/><path d="M39.6 21.3c-3-2.2-9-3.6-15.6-3.7 6.7-1.6 15.4-.3 15.6 3.7z" fill="#6E66D8"/>
      <circle cx="24.6" cy="9.6" r="2.4" fill="#8F88F2"/>
      <ellipse cx="18.6" cy="27.4" rx="2" ry="2.6" fill="#3F3B5E"/><ellipse cx="29.6" cy="27.4" rx="2" ry="2.6" fill="#3F3B5E"/>
      <circle cx="19.2" cy="26.5" r=".7" fill="#fff"/><circle cx="30.2" cy="26.5" r=".7" fill="#fff"/>
      <ellipse cx="14.8" cy="31.6" rx="2.6" ry="1.6" fill="#FFB2C2"/><ellipse cx="33.4" cy="31.6" rx="2.6" ry="1.6" fill="#FFB2C2"/>
      <path d="M22 32.3c1.2 1.2 2.9 1.2 4.1 0" stroke="#3F3B5E" stroke-width="1.6" fill="none" stroke-linecap="round"/>${glint(14, 16)}`,
    brush: `<path d="M24 7.5c10.4 0 17.6 6.3 17.6 14.4 0 5.4-4 6.6-7.2 5.6-3.1-1-5.2 1-4.3 4.3 1.2 4.3-2.2 8.6-8.3 8.6C12.9 40.4 6.4 33 6.4 23.9S13.4 7.5 24 7.5z" fill="#F7CB8C"/>
      <path d="M41.6 21.9c0 5.4-4 6.6-7.2 5.6-3.1-1-5.2 1-4.3 4.3 1.2 4.3-2.2 8.6-8.3 8.6 9.3-1.8 6.6-8.1 7.3-11.4.9-3.6 5-3.4 7.7-2.9 2.7.4 4.6-.8 4.8-4.2z" fill="#E7AF68"/>
      <circle cx="15.6" cy="20.4" r="3.6" fill="#FF6E6E"/><circle cx="23.4" cy="14.6" r="3.6" fill="#FFC53D"/><circle cx="31.8" cy="17.6" r="3.6" fill="#5CBDF0"/><circle cx="14.8" cy="29.4" r="3.6" fill="#74C95A"/>
      <path d="M27.5 41.5 41.4 24.2" stroke="#8F88F2" stroke-width="4.4" stroke-linecap="round"/><path d="M41.4 24.2l2.6-3.3" stroke="#5A4316" stroke-width="4.4" stroke-linecap="round"/>${glint(12.5, 14)}`,
    compass: `<path d="M6 14.2 16.6 9.8a2 2 0 0 1 1.4 0l12.5 4.4a2 2 0 0 0 1.4 0l9.2-3.8a1.4 1.4 0 0 1 2 1.3v22.8a2 2 0 0 1-1.2 1.8L31.3 39a2 2 0 0 1-1.4 0l-12.5-4.4a2 2 0 0 0-1.4 0L6.8 38.4a1.4 1.4 0 0 1-2-1.3V16a2 2 0 0 1 1.2-1.8z" fill="#93D673"/>
      <path d="M17.3 9.7l12.6 4.6v25L17.3 34.8z" fill="#74BE57"/><path d="M8 30c3-1 5 .5 7.6-.8V36L8 38.6z" fill="#7CCDF4"/>
      <path d="M9 20.5c4 2 7 0 10 2.4s6 1.6 9 0" stroke="#fff" stroke-width="1.8" stroke-dasharray="2.6 2.6" fill="none" stroke-linecap="round"/>
      <path d="M34 5.6c-4.6 0-8.3 3.5-8.3 8.1 0 6 8.3 13.6 8.3 13.6s8.3-7.6 8.3-13.6c0-4.6-3.7-8.1-8.3-8.1z" fill="#FF6464"/><path d="M34 5.6c4.6 0 8.3 3.5 8.3 8.1 0 6-8.3 13.6-8.3 13.6z" fill="#E84D53"/><circle cx="34" cy="13.6" r="3.2" fill="#fff"/>`,
    flag: `<rect x="9.5" y="8" width="29" height="35" rx="6.5" fill="#EDB36D"/><rect x="9.5" y="34" width="29" height="9" rx="6" fill="#D99A52"/>
      <rect x="13.5" y="13" width="21" height="25.5" rx="3.5" fill="#fff"/>
      <rect x="17.5" y="4.6" width="13" height="7.6" rx="3.4" fill="#A3A0CC"/><rect x="17.5" y="9" width="13" height="3.2" rx="1.6" fill="#8682B8"/>
      <path d="M17.6 25.6l4.1 4.1 8.5-9" stroke="#3CC7A9" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="17.5" y="32.6" width="9" height="2.4" rx="1.2" fill="#E5E2F3"/>${glint(14, 12, 1.8)}`,
    bag: `<path d="M17 17v-3.2a7 7 0 0 1 14 0V17" stroke="#A86E3C" stroke-width="3.6" fill="none"/>
      <rect x="7.5" y="16" width="33" height="25" rx="8.5" fill="#DCA169"/><rect x="7.5" y="33" width="33" height="8" rx="6" fill="#C98A50"/>
      <path d="M7.5 22.5h33V26a5.5 5.5 0 0 1-5.5 5.5H13A5.5 5.5 0 0 1 7.5 26z" fill="#C3864F"/>
      <rect x="20.6" y="26" width="6.8" height="7" rx="2.2" fill="#FFC53D"/><rect x="22.6" y="28.2" width="2.8" height="2.6" rx="1" fill="#C3864F"/>${glint(12.5, 20)}`,
    shop: `<rect x="9" y="19" width="30" height="21" rx="3.5" fill="#FFF4E1"/><rect x="9" y="34" width="30" height="6" rx="3" fill="#F3DFBF"/>
      <rect x="19.8" y="26.5" width="8.4" height="13.5" rx="3.6" fill="#8F88F2"/><rect x="30.6" y="25.5" width="6" height="6" rx="1.6" fill="#A5DCFF"/>
      <path d="M8.5 9.5h31a2 2 0 0 1 2 2V20H6.5v-8.5a2 2 0 0 1 2-2z" fill="#FFEFE6"/>
      <path d="M6.5 11.5a2 2 0 0 1 2-2h5.8V20H6.5zM20.3 9.5h7.4V20h-7.4zM33.7 9.5h5.8a2 2 0 0 1 2 2V20h-7.8z" fill="#FF8A72"/>
      <circle cx="10.4" cy="20" r="3.9" fill="#FF8A72"/><circle cx="17.3" cy="20" r="3.4" fill="#FFEFE6"/><circle cx="24" cy="20" r="3.9" fill="#FF8A72"/><circle cx="30.7" cy="20" r="3.4" fill="#FFEFE6"/><circle cx="37.6" cy="20" r="3.9" fill="#FF8A72"/>
      <path d="M17.3 23.4a3.4 3.4 0 0 1-3.2-2.3M30.7 23.4a3.4 3.4 0 0 1-3.2-2.3" stroke="#F0D5C6" stroke-width="1" fill="none"/>`,
    bell: `<circle cx="24" cy="8.5" r="2.8" fill="#E9A825"/><path d="M24 9.6c-7.2 0-12.2 5.2-12.2 12.4v7.6l-3.2 5.1c-.6 1 .1 2.3 1.3 2.3h28.2c1.2 0 1.9-1.3 1.3-2.3l-3.2-5.1V22c0-7.2-5-12.4-12.2-12.4z" fill="#FFC53D"/>
      <path d="M24 9.6c7.2 0 12.2 5.2 12.2 12.4v7.6l3.2 5.1c.6 1-.1 2.3-1.3 2.3H28c4.6-1 4-8.2 4-14.2 0-6.6-3.5-11.7-8-13.2z" fill="#F0AE25"/>
      <path d="M19.6 40.5a4.4 4.4 0 0 0 8.8 0z" fill="#E9A825"/>${glint(16.5, 17)}`,
    gear: `<path d="${gear(24, 24, 18, 14, 9)}" fill="#A9A6D2"/><circle cx="24" cy="24" r="11.6" fill="#B9B6DD"/><circle cx="24" cy="24" r="5.8" fill="#F2F0FA"/>${glint(17, 16)}`,
    camera: `<rect x="16" y="9.5" width="15" height="8" rx="3.4" fill="#7A72E6"/><rect x="5.5" y="14.5" width="37" height="25.5" rx="7.5" fill="#8F88F2"/>
      <rect x="5.5" y="32" width="37" height="8" rx="6" fill="#7A72E6"/><circle cx="24" cy="27" r="9.2" fill="#fff"/><circle cx="24" cy="27" r="6" fill="#3F3B5E"/>
      <circle cx="26" cy="25" r="1.8" fill="#fff"/><rect x="33.5" y="18.5" width="5.5" height="3.4" rx="1.7" fill="#FFC53D"/>${glint(10.5, 19)}`,
    sofa: `<rect x="10.5" y="12.5" width="27" height="15" rx="6.5" fill="#FFA58F"/><rect x="13" y="15" width="10" height="9" rx="4" fill="#FFBBA8"/><rect x="25" y="15" width="10" height="9" rx="4" fill="#FFBBA8"/>
      <rect x="9" y="24" width="30" height="10.5" rx="5" fill="#FF8A72"/><rect x="9" y="30" width="30" height="4.5" rx="2.25" fill="#E9735D"/>
      <rect x="5" y="20.5" width="8" height="15" rx="4" fill="#FF8A72"/><rect x="35" y="20.5" width="8" height="15" rx="4" fill="#E9735D"/>
      <rect x="10" y="35" width="3.4" height="5" rx="1.4" fill="#B9804F"/><rect x="34.6" y="35" width="3.4" height="5" rx="1.4" fill="#B9804F"/>${glint(14, 16, 1.8)}`,
    coin: `<circle cx="24" cy="24" r="17" fill="#F0AE25"/><circle cx="24" cy="22.6" r="16" fill="#FFC53D"/><circle cx="24" cy="22.6" r="11.6" fill="#FFD666"/>
      <path d="m24 14.6 2.4 5 5.4.7-3.9 3.7 1 5.3-4.9-2.6-4.9 2.6 1-5.3-3.9-3.7 5.4-.7z" fill="#F0AE25" stroke="#F0AE25" stroke-width="1.6" stroke-linejoin="round"/>${glint(15.5, 13.5)}`,
    heart: `<path d="M24 41C8 31 4.5 21.6 8.2 14.6c3.4-6.4 11.6-6.8 15.8-.9 4.2-5.9 12.4-5.5 15.8.9C43.5 21.6 40 31 24 41z" fill="#FF7A9A"/>
      <path d="M39.8 14.6C43.5 21.6 40 31 24 41c11-8.6 14.8-16.6 13.4-23.2-.3-1.4-.9-2.6-1.6-3.6 1.8.1 3 .4 4 .4z" fill="#F25F84"/>${glint(14, 16, 2.6)}`,
    star: `<path d="m24 6.5 5.1 10.6 11.6 1.5-8.5 8 2.1 11.5L24 32.6l-10.3 5.5 2.1-11.5-8.5-8 11.6-1.5z" fill="#FFC53D" stroke="#FFC53D" stroke-width="3.6" stroke-linejoin="round"/>
      <path d="m24 6.5 5.1 10.6 11.6 1.5-8.5 8 2.1 11.5L24 32.6z" fill="#F4B026" stroke="#F4B026" stroke-width="3.6" stroke-linejoin="round"/>${glint(18.5, 16.5)}`,
    sun: `<g stroke="#FFB21E" stroke-width="3.8" stroke-linecap="round"><path d="M24 4.5v4.6M24 38.9v4.6M4.5 24h4.6M38.9 24h4.6M10.2 10.2l3.3 3.3M34.5 34.5l3.3 3.3M10.2 37.8l3.3-3.3M34.5 13.5l3.3-3.3"/></g>
      <circle cx="24" cy="24" r="10.6" fill="#FFC53D"/><path d="M34.6 24a10.6 10.6 0 0 1-18.9 6.6A10.6 10.6 0 0 0 34.6 24z" fill="#F4AE22"/>${glint(19.6, 19.4, 2.4)}`,
    cloud: `<path d="M14.5 37h20.8a8.4 8.4 0 0 0 1-16.7 11.6 11.6 0 0 0-22.3 2.9A6.9 6.9 0 0 0 14.5 37z" fill="#FFFFFF" stroke="#C8D2EE" stroke-width="2"/>
      <path d="M12 33.6c2 2.3 6 2.7 9.8 2.2h13.5c2.6 0 4.8-1.3 6-3.3-1 2.5-3.4 4.5-6 4.5H14.5c-1 0-1.8-.4-2.5-1.1z" fill="#DCE3F5"/>`,
    rain: `<path d="M14.5 30h20.8a8.4 8.4 0 0 0 1-16.7 11.6 11.6 0 0 0-22.3 2.9A6.9 6.9 0 0 0 14.5 30z" fill="#C9D4EF"/><path d="M12 26.6c2 2.3 6 2.7 9.8 2.2h13.5c2.6 0 4.8-1.3 6-3.3-1 2.5-3.4 4.5-6 4.5H14.5c-1 0-1.8-.4-2.5-1.1z" fill="#AFBDE3"/>
      <g fill="#5CBDF0"><path d="M16 34.5c0 0-2.4 3.4-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.4-2.4-4.8-2.4-4.8zM25 35.5c0 0-2.4 3.4-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.4-2.4-4.8-2.4-4.8zM34 34.5c0 0-2.4 3.4-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.4-2.4-4.8-2.4-4.8z"/></g>`,
    fog: `<path d="M14.5 27h20.8a8.4 8.4 0 0 0 1-16.7 11.6 11.6 0 0 0-22.3 2.9A6.9 6.9 0 0 0 14.5 27z" fill="#E1E6F5"/>
      <g stroke="#B9C3E2" stroke-width="3.4" stroke-linecap="round"><path d="M8 33h32M13 39.5h22"/></g>`,
    moon: `<path d="M35.6 30.8A15.4 15.4 0 1 1 19.2 9.4a12.4 12.4 0 0 0 16.4 21.4z" fill="#FFD666"/><path d="M35.6 30.8A15.4 15.4 0 0 1 13 37.6c9.6 1 17.4-2.4 22.6-6.8z" fill="#F4B940"/>
      <path d="m36 8.5 1.2 2.6 2.6 1.2-2.6 1.2L36 16l-1.2-2.5-2.6-1.2 2.6-1.2z" fill="#FFE59A"/>${glint(14.5, 20, 2)}`,
    trophy: `<path d="M14.5 9.5h19v10.6a9.5 9.5 0 0 1-19 0z" fill="#FFC53D"/><path d="M27.8 9.5h5.7v10.6a9.5 9.5 0 0 1-7.4 9.3c3-2.6 2-14.9 1.7-19.9z" fill="#F0AE25"/>
      <path d="M14.5 12.5H9.6a5 5 0 0 0 5.6 7.6M33.5 12.5h4.9a5 5 0 0 1-5.6 7.6" stroke="#F0AE25" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <rect x="21.6" y="28.5" width="4.8" height="6" fill="#E9A825"/><rect x="14.5" y="34" width="19" height="7.5" rx="3" fill="#8F88F2"/><rect x="14.5" y="38" width="19" height="3.5" rx="1.75" fill="#7A72E6"/>${glint(18.5, 13.5)}`,
    book: `<path d="M8 11.5a3.5 3.5 0 0 1 3.5-3.5H38v30H11.5A3.5 3.5 0 0 0 8 41.5z" fill="#5CBDF0"/><path d="M8 38.5A3.5 3.5 0 0 1 11.5 35H38v6.5H11.5A3.5 3.5 0 0 1 8 38.5z" fill="#fff" stroke="#3DA4DC" stroke-width="1.4"/>
      <path d="M31.5 8h4.5v12l-2.25-1.8-2.25 1.8z" fill="#FF7A9A"/><path d="M15 15.5h10" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M38 8v27H35V8z" fill="#3DA4DC"/>${glint(13, 14)}`,
    gift: `<rect x="8" y="20" width="32" height="20.5" rx="4" fill="#FF8FB8"/><rect x="8" y="34" width="32" height="6.5" rx="3.2" fill="#F273A2"/><rect x="6" y="15" width="36" height="8" rx="3" fill="#FFA6C6"/>
      <rect x="21" y="15" width="6" height="25.5" fill="#FFC53D"/><path d="M24 15c-3.4-7-11.6-5.6-9 0zM24 15c3.4-7 11.6-5.6 9 0z" fill="none" stroke="#FFC53D" stroke-width="3.4" stroke-linejoin="round"/>${glint(12, 18.5, 1.8)}`,
    chat: `<path d="M11 8.5h26a6.5 6.5 0 0 1 6.5 6.5v12a6.5 6.5 0 0 1-6.5 6.5H22l-8.2 6.4c-.8.6-1.9 0-1.8-1l.6-5.4H11A6.5 6.5 0 0 1 4.5 27V15A6.5 6.5 0 0 1 11 8.5z" fill="#8F88F2"/>
      <circle cx="15.5" cy="21" r="2.6" fill="#fff"/><circle cx="24" cy="21" r="2.6" fill="#fff"/><circle cx="32.5" cy="21" r="2.6" fill="#fff"/>${glint(10.5, 13)}`,
    paw: `<ellipse cx="24" cy="31.5" rx="9.6" ry="8.2" fill="#FF9F45"/><path d="M33.6 31.5c0 4.5-4.3 8.2-9.6 8.2 6-1.4 7.6-5 6.6-9.7z" fill="#EE8730"/>
      <ellipse cx="11.6" cy="21.6" rx="3.6" ry="4.4" fill="#FF9F45"/><ellipse cx="18.6" cy="13.6" rx="3.6" ry="4.6" fill="#FF9F45"/><ellipse cx="29.4" cy="13.6" rx="3.6" ry="4.6" fill="#FF9F45"/><ellipse cx="36.4" cy="21.6" rx="3.6" ry="4.4" fill="#FF9F45"/>${glint(19.5, 28, 2)}`,
    clock: `<circle cx="13" cy="10.5" r="4.6" fill="#FF8A72"/><circle cx="35" cy="10.5" r="4.6" fill="#FF8A72"/><circle cx="24" cy="26" r="16" fill="#5CBDF0"/><circle cx="24" cy="26" r="12" fill="#fff"/>
      <path d="M24 18.5V26l5 3" stroke="#3F3B5E" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M14 41l2.6-3.4M34 41l-2.6-3.4" stroke="#3DA4DC" stroke-width="3.2" stroke-linecap="round"/>`,
    sparkle: `<path d="M22 6c1.1 8.4 4.4 11.7 12.8 12.8-8.4 1.1-11.7 4.4-12.8 12.8-1.1-8.4-4.4-11.7-12.8-12.8C17.6 17.7 20.9 14.4 22 6z" fill="#FFC53D"/>
      <path d="M36 28c.6 4.2 2.2 5.8 6.4 6.4-4.2.6-5.8 2.2-6.4 6.4-.6-4.2-2.2-5.8-6.4-6.4 4.2-.6 5.8-2.2 6.4-6.4z" fill="#FF8FB8"/><circle cx="10" cy="36" r="2.6" fill="#8F88F2"/>`,
    leaf: `<path d="M8 40C6.4 21.6 18.4 8.8 40.5 8.5 40.8 30 28 41.6 8 40z" fill="#86D163"/><path d="M40.5 8.5C40.8 30 28 41.6 8 40 27.3 36.4 36.5 26 40.5 8.5z" fill="#62B347"/>
      <path d="M8 40 30.5 18.5" stroke="#E7F7DA" stroke-width="2.6" stroke-linecap="round"/>${glint(18, 20)}`,
    music: `<path d="M18 35V12.6a2 2 0 0 1 1.6-2l17-3.3a2 2 0 0 1 2.4 2V31" stroke="#9C82F0" stroke-width="3.8" fill="none" stroke-linejoin="round"/><path d="M18 15.6l21-4" stroke="#9C82F0" stroke-width="5"/>
      <ellipse cx="13" cy="35.5" rx="6" ry="4.8" fill="#9C82F0"/><ellipse cx="34" cy="31.5" rx="6" ry="4.8" fill="#8668E0"/>${glint(11, 33.5, 1.6)}`,
    phone: `<rect x="11.5" y="5" width="25" height="38" rx="6.5" fill="#5C5A84"/><rect x="14.5" y="10" width="19" height="27" rx="3" fill="#CFE9FF"/>
      <path d="M17.5 37v-6.5l2.5-3.5 2.6 3h2.8l2.6-3 2.5 3.5V37z" fill="#fff"/><circle cx="21.6" cy="32.5" r="1" fill="#3F3B5E"/><circle cx="26.4" cy="32.5" r="1" fill="#3F3B5E"/>
      <rect x="20.5" y="6.8" width="7" height="1.6" rx=".8" fill="#3F3B5E"/>`,
    more: `<rect x="7" y="7" width="15" height="15" rx="5" fill="#FF8A72"/><rect x="26" y="7" width="15" height="15" rx="5" fill="#FFC53D"/><rect x="7" y="26" width="15" height="15" rx="5" fill="#3CC7A9"/><rect x="26" y="26" width="15" height="15" rx="5" fill="#8F88F2"/>
      ${glint(11.5, 11.5, 1.6)}${glint(30.5, 11.5, 1.6)}${glint(11.5, 30.5, 1.6)}${glint(30.5, 30.5, 1.6)}`,
    mail: `<rect x="6" y="12" width="36" height="25" rx="5" fill="#fff" stroke="#C8D2EE" stroke-width="2"/><path d="M7.5 14.5 24 27l16.5-12.5" stroke="#FF8A72" stroke-width="3" fill="none" stroke-linejoin="round"/><circle cx="37" cy="13" r="5" fill="#FF5E62"/>`,
    fish: `<path d="M8 24c5-8 15-11 23-6l6-6c1-1 2.6-.3 2.4 1.1L38 24l1.4 10.9c.2 1.4-1.4 2.1-2.4 1.1l-6-6c-8 5-18 2-23-6z" fill="#5CBDF0"/><path d="M8 24c5 8 15 11 23 6-8 1.6-15.6.6-23-6z" fill="#3DA4DC"/>
      <circle cx="15" cy="22.5" r="2" fill="#3F3B5E"/>${glint(19, 19.5, 1.8)}`,
    flower: `<g fill="#FF8FB8"><circle cx="24" cy="13" r="6"/><circle cx="34" cy="20.4" r="6"/><circle cx="30.2" cy="32" r="6"/><circle cx="17.8" cy="32" r="6"/><circle cx="14" cy="20.4" r="6"/></g>
      <circle cx="24" cy="23.5" r="5.6" fill="#FFC53D"/>${glint(21.5, 11, 1.6)}`,
    lantern: `<path d="M24 4.5v4" stroke="#8B6A4A" stroke-width="2.6" stroke-linecap="round"/><path d="M15 12.5h18l-2 4H17z" fill="#8B6A4A"/><rect x="15.5" y="16.5" width="17" height="19" rx="5" fill="#FFE08A"/>
      <rect x="15.5" y="16.5" width="17" height="19" rx="5" fill="none" stroke="#8B6A4A" stroke-width="2.4"/><path d="M24 16.5v19" stroke="#8B6A4A" stroke-width="2"/><path d="M16 35.5h16l2 4H14z" fill="#8B6A4A"/><circle cx="24" cy="26" r="4" fill="#FFC53D" opacity=".8"/>`,
    users: `<circle cx="31" cy="17.5" r="7" fill="#FFD9C4"/><path d="M19.5 38c0-7 5.2-11.6 11.5-11.6S42.5 31 42.5 38z" fill="#5CBDF0"/>
      <circle cx="17" cy="17" r="8" fill="#FFEBDD"/><path d="M4 39.5c0-8 5.8-13 13-13s13 5 13 13z" fill="#8F88F2"/>${glint(13, 13.5, 1.8)}`,
    eye: `<path d="M3.5 24S11 11.5 24 11.5 44.5 24 44.5 24 37 36.5 24 36.5 3.5 24 3.5 24z" fill="#fff" stroke="#C8D2EE" stroke-width="2"/><circle cx="24" cy="24" r="8.4" fill="#8F88F2"/><circle cx="24" cy="24" r="4.4" fill="#3F3B5E"/><circle cx="26.4" cy="21.6" r="1.8" fill="#fff"/>`,
    lock: `<path d="M16 21v-4.5a8 8 0 0 1 16 0V21" stroke="#A9A6D2" stroke-width="4" fill="none"/><rect x="10" y="20" width="28" height="21" rx="6" fill="#FFC53D"/><rect x="10" y="34" width="28" height="7" rx="5" fill="#F0AE25"/><circle cx="24" cy="29" r="3" fill="#8B6A4A"/>`,
    hand: `<path d="M16.5 25V11.5a2.8 2.8 0 0 1 5.6 0V22M22.1 21V8.8a2.8 2.8 0 0 1 5.6 0V21M27.7 21.5V11.6a2.8 2.8 0 0 1 5.6 0V28c0 8-5 13-12 13-5 0-8-2.4-11-7.2l-3.6-5.7a2.7 2.7 0 0 1 4.5-3L16.5 28" fill="#FFD9C4" stroke="#E9B596" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`,
    apple: `<path d="M24 14.5c-8-4.6-17 .6-15.4 10.6 1.3 8.4 7.6 15.6 15.4 12.6 7.8 3 14.1-4.2 15.4-12.6C41 15.1 32 9.9 24 14.5z" fill="#FF6464"/><path d="M39.4 25.1c-1.3 8.4-7.6 15.6-15.4 12.6 9.6-.4 14-8.6 13.2-17.8 1.6 1.2 2.6 2.9 2.2 5.2z" fill="#E84D53"/>
      <path d="M24 14.5c0-3.6 1.4-6.4 4-8" stroke="#8B6A4A" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M26 11c3.4-3.6 8-3.6 10.4-1.6-2.6 3-7 3.6-10.4 1.6z" fill="#74C95A"/>${glint(15, 20, 2.4)}`,
    dice: `<rect x="7" y="7" width="34" height="34" rx="10" fill="#fff" stroke="#C8D2EE" stroke-width="2"/><rect x="7" y="31" width="34" height="10" rx="8" fill="#E9ECF8"/>
      <g fill="#8F88F2"><circle cx="16" cy="16" r="3.2"/><circle cx="32" cy="16" r="3.2"/><circle cx="24" cy="24" r="3.2"/><circle cx="16" cy="32" r="3.2"/><circle cx="32" cy="32" r="3.2"/></g>`,
    walk: `<path d="M13 22c-3.6-.4-5.6-4.6-4.4-9.4C9.8 7.6 13 5 15.6 6.2c2.8 1.2 3 5.8 1.6 10.2C16.2 19.8 15.2 22.2 13 22z" fill="#FF9F45"/><ellipse cx="14.6" cy="27.4" rx="3.6" ry="3" fill="#FF9F45"/>
      <path d="M33 33c3.6-.4 5.6-4.6 4.4-9.4-1.2-5-4.4-7.6-7-6.4-2.8 1.2-3 5.8-1.6 10.2 1 3.4 2 5.8 4.2 5.6z" fill="#8F88F2"/><ellipse cx="31.4" cy="38.4" rx="3.6" ry="3" fill="#8F88F2"/>`,
    move: `<circle cx="24" cy="24" r="17" fill="#E7E8FF"/><path d="M24 9v30M9 24h30" stroke="#7378F0" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M24 7.5l-5 5.5h10zM24 40.5l-5-5.5h10zM7.5 24l5.5-5v10zM40.5 24 35 19v10z" fill="#7378F0" stroke="#7378F0" stroke-width="1.5" stroke-linejoin="round"/>`,
    info: `<circle cx="24" cy="24" r="17" fill="#5CBDF0"/><path d="M41 24a17 17 0 0 1-30.4 10.4A17 17 0 0 0 41 24z" fill="#3DA4DC"/><circle cx="24" cy="15.5" r="2.8" fill="#fff"/><rect x="21.4" y="21" width="5.2" height="14" rx="2.6" fill="#fff"/>${glint(15, 14, 2)}`,
  };
  S.map = S.compass; S.daily = S.flag; S.workshop = S.brush; S.home = S.island; S.achievements = S.trophy; S.collection = S.book; S.decor = S.sofa;

  /** a sticker icon: <span class="stk [cls]"><svg …></span>; size via CSS (.stk default 28px; .s 20px; .l 40px; .xl 56px) */
  function sticker(name, cls = '') {
    const sp = document.createElement('span'); sp.className = 'stk' + (cls ? ' ' + cls : ''); sp.setAttribute('aria-hidden', 'true');
    sp.innerHTML = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">${S[name] || S.sparkle}</svg>`;
    return sp;
  }
  OC.UI.sticker = sticker; OC.UI.STICKERS = S;
})();
