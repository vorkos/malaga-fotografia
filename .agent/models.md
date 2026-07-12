# Models roster — reference for Journal posts

> Reuse this when writing a new post for a model already shot. R2 photos live at
> `gallery/<folder>/`. Machine-readable file→model map: `.agent/photos-by-model.json`.
> Keep this updated as new shoots/models are added. Last updated: 2026-07-12.

| Folder(s) | Display name | Instagram / link | Notes |
|-----------|--------------|------------------|-------|
| `barbara` | **Barbara Cia** | [@cia_model_official](https://instagram.com/cia_model_official) | Model & actress. Performing since age 8 (opera, theatre), studied applied-art jewellery, modelled in London (Toni&Guy hair model, Wella Pro, fashion commercials). Based in Málaga; traveller, sailor, nature lover, coffee addict. Professional, easy, fun. Both shoots now in one folder `gallery/barbara/` (merged 2026-07-12; the old `barbara-cia` folder was deleted). Posts: `blog/barbara/` (13-06 session), `blog/barbara-cia-light-and-water-in-malaga/` (25-06 session — URL slug kept). |
| `mariia` | Mariia | — | — |
| `iryna` | Iryna | — | — |
| `iryna-r` | Iryna R | — | Distinct from Iryna. |
| `nataliia` | Nataliia | — | — |
| `vika` | Vika | — | **Co-model:** Anastasiia appears with Vika in some two-person frames (`Z52_2554/…` era, 25-06 set) — those need BOTH models' consent before publishing; filed under `vika`. |
| `lilly` | Lilly | — | — |
| `ksu` | Ksu | — | — |
| `lisa` | Lisa | — | — |
| `kostiantyn` | Kostiantyn (self) | — | Kostya himself (photo Z52_2867 / #52). |

## How the Journal maps to models
- Every gallery photo is under `gallery/<folder>/<file>`; the local picker
  (`npm run pick -- "<shoot-folder>" --model "<Name>"`) uploads new picks to
  `gallery/<slugified-name>/`. **Use a consistent name** per model so folders
  don't fragment (e.g. always "Barbara", not sometimes "Barbara Cia").
- Reference field in the picker: paste the model's bio/IG so the AI rewrite can
  weave in verified background.

## Consent / publishing rules (carry-over)
- Only publish a person under their own name; never mislabel one model as another.
- Two-person frames need consent from **both** people before going public.
- 18+ confirmed; publish stage/first names unless the model opts into more.
