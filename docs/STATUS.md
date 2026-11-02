# Status

Last updated 2 Nov 2026. Add a line here when a real provider call or job first succeeds. Do not claim an integration that is not listed as verified.

## Verified

| Behavior | How |
|---|---|
| Full manual flow on a phone viewport: sofa, photos, questions, build, touch drag, rotate, save, reload, delete | Chromium browser run against the production bundle |
| Same flow in the Docker image, with Postgres and S3 API, at 512 MB and 0.5 CPU | Local containers; S3 was the moto emulator |
| Sofa GLB outer size equals confirmed dimensions; node scale stays 1 | Automated tests on trimesh output |
| Blender builders match the same geometry contract | Run locally with `bpy` 4.2, not on Modal. They still output a box-style sofa; the default CPU builder uses the photoscanned model |
| Landing page at `/`, Try button to `/app`, curtain transition, live 3D demo with mouse drag | Chromium browser run against the production bundle |
| One session cannot read another's data; uploads strip metadata; bad files fail safely | Automated tests |
| Private addresses, redirects and DNS tricks are blocked by the URL guard | Automated tests with a mock network |

## Written but not verified against the real service

| Piece | Note |
|---|---|
| Muse Spark on Baseten | Request and parsing tested against a mock only. No key on the dev machine |
| Muse Image edits | Request shape follows Meta's docs read on 2 Nov 2026. Tested against a mock only |
| Real listing fetch over the internet | Only tested with a mock network. Shops may block it |
| `SCENE_BUILDER=modal` and `worker/modal_app.py` | Never run on Modal |
| Render and Supabase | Never deployed. Supabase's S3 endpoint is untested |
| Short-video capture | Code exists; not exercised in the browser run |
| Camera and real-phone behavior | Touch was simulated in Chromium |

## Not built

| Item | Owner per issues | Note |
|---|---|---|
| VGGT automatic reconstruction | Benedict, #4 | Today's rooms come from the user's measurements and photos do not shape the geometry. The app labels this as assisted |
| Geometric photo overlap evidence | Benedict, #4 | `overlap` reports `not_measured` |
| Meta SAM call | Benedict, #4 | The docs page read did not include the output format or point prompts |
| Reference-distance calibration | Benedict, #4 | Today: "did you measure with a tape?" sets calibrated or estimated |
| Original-photo camera view in the editor | Benedict, #4 | Needs camera poses from reconstruction |
| Second-corner accuracy measurement and real timing | Shared | Needs real rooms |
| Submission text and final video | Tường, #3 | |

## Known limits

- Photos are required and checked, but in the assisted path they do not change the geometry. Say so in the demo unless VGGT lands.
- One instance only. Build jobs and rate limits live in that process.
- The sofa is a photoscanned sample model stretched to the confirmed size. It is not the listed product, and the app says shape and materials may differ.
- The landing page demo and images use a sample photographed room. User rooms are still simple modelled geometry.
- `Agent.MD` is now gitignored locally and untracked on this branch, but it remains in git history and in the upstream public repo.
