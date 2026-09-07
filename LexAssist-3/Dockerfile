# LexAssist-3 production image: Express API + Vite SPA
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json tsconfig.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY shared ./shared
COPY scripts ./scripts
COPY attached_assets ./attached_assets

ENV CI=true
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production
ENV BASE_PATH=/
ENV PORT=3000

RUN pnpm --filter @workspace/lexassist run build \
 && pnpm --filter @workspace/api-server run build \
 && mkdir -p artifacts/api-server/dist/public \
 && cp -R artifacts/lexassist/dist/public/. artifacts/api-server/dist/public/ \
 && mkdir -p /app/uploads/documents /app/uploads/knowledge

ENV PORT=10000
EXPOSE 10000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
