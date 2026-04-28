FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/worker/package.json ./services/worker/package.json
COPY services/worker ./services/worker
RUN pnpm install --frozen-lockfile=false

CMD ["pnpm", "--filter", "worker", "dev"]
