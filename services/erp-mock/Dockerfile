FROM node:20-alpine
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/erp-mock/package.json ./services/erp-mock/package.json
COPY services/erp-mock ./services/erp-mock
RUN pnpm install --frozen-lockfile=false

EXPOSE 3001
CMD ["pnpm", "--filter", "erp-mock", "dev"]
