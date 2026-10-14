# LinkUP API image (NestJS + on-device MiniLM embeddings).
# Build context is the repo root. Run `pnpm models:fetch` once first (fills .cache/models).
#   podman build -f apps/api/Dockerfile --platform linux/amd64 -t linkup-api .
# Cloudflare Containers builds it automatically on `wrangler deploy` (deploy/cloudflare-api).

FROM docker.io/library/node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Install only what the API needs (layer cached until manifests change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/embeddings/package.json packages/embeddings/
COPY apps/api/package.json apps/api/
# Low concurrency keeps memory down when building amd64 under emulation on Apple Silicon.
# ONNXRUNTIME_NODE_INSTALL=skip: CPU binaries ship in the package; skip the optional CUDA download.
ENV NODE_OPTIONS=--max-old-space-size=768 \
    ONNXRUNTIME_NODE_INSTALL=skip
RUN pnpm install --frozen-lockfile --filter "@linkup/api..." --child-concurrency=1 --network-concurrency=1

COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter "@linkup/api..." build \
 && pnpm --filter @linkup/api deploy --prod --legacy /out

# Trim ~350 MB: onnxruntime binaries for other OSes, and onnxruntime-web
# (transformers.js bundles what it needs; the model check below proves it still loads)
RUN cd /out/node_modules/.pnpm \
 && rm -rf onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v*/darwin \
           onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v*/win32 \
           onnxruntime-web@*/node_modules/onnxruntime-web/dist

# Bake the embedding model into the image from the host cache (`pnpm models:fetch`),
# so neither the build nor a cold start needs to reach Hugging Face.
COPY .cache/models /out/models
ENV MODELS_CACHE_DIR=/out/models
RUN cd /out && MODELS_OFFLINE=1 node --input-type=module -e "import { LocalEmbeddingProvider } from '@linkup/embeddings'; const v = await new LocalEmbeddingProvider().embed(['warm-up']); console.log('model ready, dims', v[0].length)"

FROM docker.io/library/node:22-bookworm-slim
WORKDIR /app
ENV NODE_OPTIONS= \
    NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4100 \
    MODELS_CACHE_DIR=/app/models \
    MODELS_OFFLINE=1 \
    EMBEDDINGS_PROVIDER=local
COPY --from=build /out /app
EXPOSE 4100
USER node
CMD ["node", "--enable-source-maps", "dist/main.js"]
