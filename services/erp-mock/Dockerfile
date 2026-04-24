FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/erp-mock/package.json ./services/erp-mock/package.json
RUN pnpm install --filter erp-mock... --frozen-lockfile=false

COPY services/erp-mock ./services/erp-mock
WORKDIR /app/services/erp-mock

EXPOSE 3001
CMD ["pnpm", "dev"]
