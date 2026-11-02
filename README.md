# Roomset

Try a specific sofa in your own room before buying it. Paste a listing, photograph a corner, confirm a few measurements, then drag and rotate a true-to-size sofa in an editable 3D plan.

Built for the Meta Global AI Developer Hackathon. Project plan: [issue #2](https://github.com/khanhtuongnakitomo/RoomSet/issues/2). What actually works today: [docs/STATUS.md](docs/STATUS.md).

## Run it locally

Needs Python 3.11, Node 22+, [uv](https://docs.astral.sh/uv/) and make.

```bash
cp .env.example .env     # Provider keys are optional
make setup
make dev                 # http://localhost:5173
```

Without keys, manual product entry, assisted rooms, the 3D editor and saved layouts all work. AI reading needs `BASETEN_API`. Style previews need `MUSE_API`.

## Commands

| Command | What it does |
|---|---|
| `make dev` | Backend on :8000 and frontend on :5173 |
| `make test` | Backend and frontend tests |
| `make lint` | Ruff and TypeScript checks |
| `make build` | Production frontend bundle |
| `make image` | Single-container Docker image |

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the system fits together and what every folder holds
- [docs/DEPLOY.md](docs/DEPLOY.md): a quick Vercel preview, and deploying end to end on free tiers
- [docs/STATUS.md](docs/STATUS.md): verified and unverified behavior, and the remaining work
