# Academy film (Remotion)

The 30-second Spanish motion-graphics film shown in the home page's instructor section.
Muted, 1920×1080, 30 fps, 7 scenes: intro · Mundaka · Xabier · his surf · lessons · trust · book.

```
npm install
npm run studio     # preview and edit in the browser
npm run render     # → out/mundaka-promo.mp4 (master, ~27 MB)
```

Scenes live in `src/Promo.tsx` (durations in `D`), shared animations in `src/parts.tsx`, colours and fonts in
`src/theme.ts`. Images and fonts are in `public/` (copies of the website's assets).

## Web versions

After rendering, make the two files the website loads and copy them into the site:

```
npx remotion ffmpeg -y -i out/mundaka-promo.mp4 -vf "scale=1920:1080:in_color_matrix=bt601:out_color_matrix=bt709:in_range=pc:out_range=tv" -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an ../public/assets/video/mundaka-promo-1080.mp4
npx remotion ffmpeg -y -i out/mundaka-promo.mp4 -vf "scale=1280:720:in_color_matrix=bt601:out_color_matrix=bt709:in_range=pc:out_range=tv" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an ../public/assets/video/mundaka-promo-720.mp4
```

The poster (`public/assets/video/mundaka-promo.webp`) is frame 300:
`npx remotion still src/index.ts Promo out/poster.png --frame=300`, then save it as a 1280×720 WebP.

If the chapter timings change, update the `data-film-seek` times in `src/pages/index.html` (scene start = sum of the
previous scene durations minus 15 frames per transition, divided by 30).

Everything on screen comes from the questionnaire or the website; add claims only once the academy confirms them.
