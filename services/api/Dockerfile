FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/api/package.json ./services/api/package.json
RUN pnpm install --filter api... --frozen-lockfile=false

COPY services/api ./services/api
WORKDIR /app/services/api

EXPOSE 3000
CMD ["pnpm", "dev"]
