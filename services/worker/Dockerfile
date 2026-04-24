FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/worker/package.json ./services/worker/package.json
RUN pnpm install --filter worker... --frozen-lockfile=false

COPY services/worker ./services/worker
WORKDIR /app/services/worker

CMD ["pnpm", "dev"]
