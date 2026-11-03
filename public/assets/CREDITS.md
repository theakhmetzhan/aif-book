# Asset credits

All downloaded assets come from [Poly Haven](https://polyhaven.com) and are **CC0 1.0** (public domain, https://creativecommons.org/publicdomain/zero/1.0/). Files were fetched via `https://api.polyhaven.com/files/<id>`, then downsized and re-encoded to WebP. glTF image URIs were rewritten to point at the `.webp` copies.

| Path | Asset | Authors | Source | Licence | Changes |
|---|---|---|---|---|---|
| `textures/wood_table_001/` | Wood Table 001 | Dimitrios Savva, Rico Cilliers | https://polyhaven.com/a/wood_table_001 | CC0 | 2k diffuse, normal amplified ×3 before encoding (compensated in code), 1k roughness |
| `textures/leather_red_03/` | Leather Red 03 | Rob Tuytel | https://polyhaven.com/a/leather_red_03 | CC0 | diffuse re-hued to green and oxblood variants, normal amplified ×5, 1k |
| `textures/decrepit_wallpaper/` | Decrepit Wallpaper | Rob Tuytel | https://polyhaven.com/a/decrepit_wallpaper | CC0 | 1k |
| `models/alarm_clock_01/` | Alarm Clock 01 | Yann Kervran, James Ray Cock | https://polyhaven.com/a/alarm_clock_01 | CC0 | diffuse/ARM recoloured to brass, dial lightened to cream, 1k |
| `models/round_spectacles/` | Round Spectacles | Sean Buckley | https://polyhaven.com/a/round_spectacles | CC0 | 1k |
| `models/pocket_watch/` | Pocket Watch | PierreB3D | https://polyhaven.com/a/pocket_watch | CC0 | 1k |

## Procedural (no external files)

These are generated at runtime in `src/props.js` and `src/assets.js`:

- Props: banker's lamp, cup and saucer with coffee, magnifier, pencils, index cards, legal pad, thread spool, push-pin tin, fountain pen, envelope with wax seal.
- Maps: cork board, varnish wear, wood pores and paper fibre.

Fonts are loaded from Google Fonts (OFL): Caveat, Special Elite, Playfair Display.
