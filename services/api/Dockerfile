FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/api/package.json ./services/api/package.json
COPY services/api ./services/api
RUN pnpm install --frozen-lockfile=false

EXPOSE 3000
CMD ["pnpm", "--filter", "api", "dev"]
