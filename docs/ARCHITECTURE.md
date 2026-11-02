# Architecture

## The product in one flow

```
Listing link / screenshot / manual entry → person confirms sofa size
3–6 photos or a short video              → quality checks, retake prompts
Questions (room size, tape?, obstacles)  → validated answers
Background build job                     → Scene v1 + room.glb + sofa.glb
Browser editor                           → drag, rotate, top view, overlap and clearance feedback
Save layout                              → position and yaw only, no model call, no rebuild
Optional: "warm Japandi"                 → Muse Image restyles the current view
```

Size and fit come only from geometry. The style preview is decoration and is labelled so.

## Runtime shape

```
Phone browser
   │ HTTPS, bearer token per session
   ▼
One container: FastAPI + built React app
   ├── Postgres              session state, photo records
   ├── S3-compatible bucket  photos, GLBs, renders (private, read through the API)
   ├── Baseten               Muse Spark Open: listing and photo interpretation
   ├── Meta Model API        Muse Image: optional style preview
   └── Modal (optional)      Blender and later VGGT jobs
```

Run exactly one instance. Build jobs run on a thread pool inside it, and rate limits are in memory. A restart marks in-flight builds as failed and retryable, so nobody waits on a job that no longer exists.

## Folder map

```
contracts/fixtures/scene.fixture.json   One Scene v1 example, tested by backend and frontend

backend/
  pyproject.toml, requirements.lock     Dependency ranges, and exact versions for the image
  alembic.ini                           Migration config
  app/
    main.py                             Middleware, routes, startup recovery, serves the frontend
    core/
      config.py                         All environment settings
      errors.py                         Errors safe to show people
      logging.py                        JSON logs with request ids
      security.py                       Session token creation and hashing
      rate_limit.py                     Per-client request limits
    domain/                             Pydantic contracts
      product.py                        Dimensions with source and confidence
      capture.py                        Photo quality flags, coverage report
      clarification.py                  Questions and validated room answers
      scene.py                          Scene v1, including the geometry conventions
      session.py                        Session states and API views
    db/
      engine.py, models.py              Connection, and the sessions and photos tables
      migrations/                       Alembic history
    storage/
      base.py, local.py, s3.py          One interface: disk locally, a private bucket in production
    providers/
      baseten.py                        Spark calls with schema-validated replies
      muse_image.py                     Muse Image edits
    services/
      url_guard.py                      SSRF-safe page fetch
      product_intake.py                 Listing and screenshot into a draft
      images.py                         Decode, fix orientation, strip EXIF, re-encode
      photo_checks.py                   Blur, darkness, duplicates
      clarifications.py                 Which questions to ask, plus the optional Spark review
      pipeline.py                       The build job, sample scene, restart recovery
      scene_builders.py                 Local CPU builder or Blender on Modal
      renders.py                        Style preview prompt
      retention.py                      Deletes old sessions and their files
    geometry/
      meshes.py, sofa.py, room.py       Deterministic GLB generation
    api/
      deps.py                           Session ownership and upload limits
      presenters.py                     Rows into API views
      routes/                           health, sessions, product, photos, build, assets, renders
  tests/                                API flow, security, geometry, provider request shapes

frontend/
  src/
    main.tsx                            Entry point, loads brand tokens
    app/App.tsx                         Picks the screen from server state
    app/sessionStore.ts                 Remembers the session across reloads
    api/contracts.ts, client.ts         Types, contract check, typed calls
    editor/
      SceneEditor.tsx                   Public interface: scene and asset URLs in, placement out
      engine.ts                         Three.js scene, touch and mouse dragging, views, snapshot
      geometry.ts                       Overlap, clearance and captured-area checks
    features/
      landing/, product/, clarify/      One folder per step
      capture/                          Photos, plus video-to-frames in the browser
      progress/                         Polling and retry
      result/                           Editor screen and style panel
    styles/app.css                      Layout on top of brand/theme

worker/
  blender_build.py                      Trusted Blender builders with the same geometry contract
  modal_app.py                          Modal functions, including the VGGT slot for issue #4

Dockerfile, render.yaml                 Single-container image and free Render blueprint
.github/workflows/ci.yml                Tests, lint and image build
brand/, proposal/                       Existing brand kit and proposal
```

## Dependencies and why

| Dependency | Purpose |
|---|---|
| FastAPI, Uvicorn, Pydantic | API and contract validation |
| SQLAlchemy, Alembic, psycopg | Database and migrations; SQLite locally, Postgres in production |
| httpx, BeautifulSoup | Provider calls and guarded page reading |
| Pillow, NumPy | Image cleaning and photo checks |
| trimesh | Free CPU GLB generation, which needs no Blender or GPU |
| boto3 | Works with Supabase Storage or Cloudflare R2 |
| modal (optional) | Blender and GPU jobs |
| React, Vite, TypeScript | App |
| three | Editor |

## API

All routes sit under `/api/sessions/{id}` and need `Authorization: Bearer <token>`, except creating a session.

| Route | Purpose |
|---|---|
| `POST /api/sessions`, `POST /api/sessions/sample` | New session, or a labelled sample |
| `GET`, `DELETE /{id}` | Read and poll state, or delete everything |
| `POST /{id}/product/fetch`, `/product/screenshot` | Produce a draft |
| `PUT /{id}/product` | Store confirmed dimensions |
| `POST /{id}/photos`, `GET`, `DELETE /{id}/photos/{photo}` | Manage photos |
| `POST /{id}/check` | Review the capture and produce questions |
| `PUT /{id}/answers` | Store validated answers |
| `POST /{id}/build` | Start or retry, 202 immediately, 409 if already running |
| `PUT /{id}/layout` | Save position and yaw |
| `POST /{id}/renders` | Style preview, capped per session |
| `GET /{id}/assets/{name}` | Protected GLB or render |

Also `/healthz`, `/readyz`, `/api/capabilities` and `/api/docs`.

States: `collecting → checking → needs_input → reconstructing → building → ready`, or `failed` with a retry.

## Where the remaining work plugs in

- **VGGT (issue #4):** implement `reconstruct_corner` in `worker/modal_app.py`, then branch in `pipeline._layout`. Return the same floor, walls and obstacles. Set `provenance.method` to `automatic` only when it produced them, and add the model name to `reconstruction_model`.
- **Geometric overlap evidence:** set `CoverageReport.overlap` from image matching or reconstruction output.
- **SAM:** add `providers/sam.py` after reading the output format in Meta's docs, then record the real call in `docs/STATUS.md`.
- **Exact product geometry (SAM 3D Objects):** implement another `SceneBuilder`. Keep the sofa's outer size equal to the confirmed dimensions.
