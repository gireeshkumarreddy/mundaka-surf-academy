# Image credits

## Academy photos and videos

Every photo and clip of Xabier Gondra León, Mundaka and the academy comes from the academy's own Google Drive folder
(MIKEL / ROBERTO / UR / XABI). Where the photographer is known, the gallery caption credits them.

## Stock photos (illustrative)

These HD photos come from [Unsplash](https://unsplash.com) and are used under the
[Unsplash licence](https://unsplash.com/license): free for commercial use, no permission needed. Attribution is not
required, but it is good practice and is kept here.

They **illustrate** the lesson types until the academy has its own photos of each one. They do not show the academy,
its students or Xabier. Replace each with a real academy photo when one exists: put the JPG in `_source/stock/hd/`
under the same name (or add a new role) and run `python -I _tools/build_stock.py`.

| Role (source file) | Output images | Used on | Unsplash page |
|---|---|---|---|
| `private` | `stock-private-*` | Home stories, lessons, plans (private) | https://unsplash.com/photos/zKzwvEezgaY |
| `group` | `stock-group-*` | Home stories, lessons, plans (group) | https://unsplash.com/photos/a_qlZPLEB24 |
| `kids` | `stock-kids-*` | Home stories, lessons, plans (kids) | https://unsplash.com/photos/C8xt62FRjIE |
| `courses` | `stock-courses-*` | Home stories, lessons, plans (camps and courses) | https://unsplash.com/photos/upzbkK3lntY |
| `adaptive` | `stock-adaptive-*` | Home stories, lessons, plans (adaptive surfing) | https://unsplash.com/photos/ZwHkhBbhRDA |
| `adaptive-framed` | `stock-adaptive-wide-*` | Lessons (adaptive section) | https://unsplash.com/photos/wqo8rwUefCs |
| `lessons-hero` | `stock-lessons-hero-*` | Lessons hero | https://unsplash.com/photos/mVnhIhc0m00 |
| `plans-bg` | `stock-plans-bg-*` | Plans hero background | https://unsplash.com/photos/iftBhUFfecE |
| `catch-bg` | `stock-catch-bg-*` | Home "Catch your wave" background | https://unsplash.com/photos/zam3m6W2npM |
| `hermitage` | `stock-hermitage-*` | Home instructor section, location | https://unsplash.com/photos/Nv2oS9zs6e4 |
| `wave-tunnel` | `stock-wave-tunnel-*` | Conditions cards, 404 page | https://unsplash.com/photos/uanoYn1AmPs |
| `group-women` | `stock-group-women-*` | Lessons (framed band) | https://unsplash.com/photos/ZjXu4oCLMaU |
| `gaztelugatxe` | `stock-gaztelugatxe-*` | Location (nearby places) | https://unsplash.com/photos/w2D_69Jol_o |

## The academy film

`public/assets/video/mundaka-promo-*.mp4` is a 30-second motion-graphics film made for the site (source in `video/`,
built with Remotion). It uses the academy's Drive photos plus the stock photos above for the lesson cards.
See `video/README.md`.
