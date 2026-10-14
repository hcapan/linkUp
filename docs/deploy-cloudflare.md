# Deploying the LinkUP demo to Cloudflare

The hosted demo runs entirely on Cloudflare, with the database on Neon.
It is meant for **fictional sample data only**. The Webex bot is not deployed.

```
Browser ──► Cloudflare Access (login) ──► linkup-web   Worker  (Next.js via OpenNext)
                                              │ service binding "API" (no public URL)
                                              ▼
                                          linkup-api   Worker ──► Container (NestJS + MiniLM model)
                                                                      │
                                                                      ▼
                                                                  Neon Postgres (pgvector)
```

- `apps/web/wrangler.jsonc`: the Next.js app, built with `@opennextjs/cloudflare`.
- `deploy/cloudflare-api/`: a small Worker that forwards to the API container. The
  container image is `apps/api/Dockerfile`, with the embedding model baked in.
  This Worker has `workers_dev: false`, so the API has **no public URL**. Only
  `linkup-web` can call it.
- On first boot against an empty database, the container runs the migrations and
  loads the demo data on its own (`DB_AUTO_SETUP=1`). No database access from your
  laptop is needed.

## Cost

You need the **Workers Paid** plan ($5/month). Containers require it, and the
Next.js server bundle needs its CPU limits. Neon's free tier and Cloudflare
Access (up to 50 users) are free. At demo traffic the container usage stays
around the included quota (expect ≈ $5–7/month in total).

## One-time setup

1. **Cloudflare**: create an account and switch to *Workers Paid*
   (Dashboard → Workers & Pages → Plans).
2. **Neon**: create a project at https://neon.tech (any region close to EMEAR,
   e.g. Frankfurt). Copy the **direct** (non-pooled) connection string. It looks
   like `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   pgvector is available on Neon; the container enables it.
3. **Podman** must be running (`podman machine start`). Wrangler builds the
   container image locally; `scripts/podman-docker.sh` lets it use Podman
   instead of Docker.
4. Log in to Cloudflare from this repo (this opens a browser):

   ```bash
   pnpm cf:login
   ```

## Deploy

```bash
pnpm cf:deploy:api     # builds the amd64 image (~2–3 min), creates the linkup-api Worker + container
pnpm cf:secret:db      # paste the Neon connection string when prompted
pnpm cf:deploy:web     # builds Next.js with OpenNext, deploys linkup-web
```

Deploy the API first: the web Worker's service binding points at `linkup-api`.
`pnpm cf:deploy` runs both deploy steps.

Wrangler prints the web URL, e.g. `https://linkup-web.<your-subdomain>.workers.dev`.

**First request:** the container starts (a few seconds), creates the schema and
generates the 300 demo SEs in the background (well under a minute on
Cloudflare). Refresh after that; the persona switcher then lists the suggested
personas. Later cold starts (after 30 min idle) take a few seconds, with no re-seed.

## Protect it with Cloudflare Access (strongly recommended)

The demo has no login and anyone with the URL can act as any persona. Put
Cloudflare Access in front of it:

1. Dashboard → Workers & Pages → `linkup-web` → Settings → Domains & Routes:
   enable **Cloudflare Access** for the `workers.dev` route. Alternatively, in Zero Trust →
   Access → Applications, add a *self-hosted* application for that hostname.
2. Edit the application's policy: *Include → Emails* (list the colleagues), or
   *Emails ending in* your domain. Login is by one-time PIN by default; an
   identity provider (Okta, Entra ID, …) can be added later.
Preview URLs are already disabled in `apps/web/wrangler.jsonc`, so no
unprotected per-version URLs exist.

## Updating

- Code change in the API or packages: `pnpm cf:deploy:api`.
- Web change: `pnpm cf:deploy:web`.
- **Reset the demo data:** in Neon, *Branches → main → Reset* (or drop and
  recreate the database). The next container start re-seeds it. Alternatively, if
  your network allows outbound Postgres (port 5432):
  `DATABASE_URL='<neon url>' pnpm db:seed --fresh`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Docker build exited` / `unknown flag` | Use `pnpm cf:deploy:api` (it sets `WRANGLER_DOCKER_BIN` to the Podman shim) and make sure `podman machine` is running. |
| Image build killed (exit 137) | The Podman VM ran out of memory. Stop other containers or raise its memory: `podman machine stop && podman machine set --memory 6144 && podman machine start`. |
| Push to the Cloudflare registry fails | Wrangler authenticates to the registry itself. If the push still fails with Podman, use Docker Desktop or Colima and run `pnpm --filter @linkup/cloudflare-api run cf:deploy` without the shim. |
| Pages show "Pick a demo persona" right after deploy | The first boot is still seeding. Wait ~30 s and refresh. |
| API errors in the web Worker | `pnpm --filter @linkup/cloudflare-api exec wrangler tail` streams the container's logs. |
| Model download / TLS errors on the corporate network | The image never downloads at build or run time. `pnpm models:fetch` fills `.cache/models` on your machine (it uses the system CA store) and the Dockerfile copies it. |

## Local checks before deploying

```bash
podman build -f apps/api/Dockerfile --platform linux/amd64 -t linkup-api:local .
podman run --rm -p 4200:4100 -e DATABASE_URL=postgres://linkup:linkup@host.containers.internal:5434/linkup linkup-api:local
pnpm --filter @linkup/web cf:build    # OpenNext bundle (~1.4 MB gzip)
```

Note: `wrangler dev` cannot start Cloudflare containers through Podman (its
local container sidecar needs Docker). Test the API image with `podman run` as above.
