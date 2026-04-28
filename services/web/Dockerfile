FROM node:20-alpine
WORKDIR /app

RUN corepack enable

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/web/package.json ./services/web/package.json
RUN pnpm install --filter web... --frozen-lockfile=false

COPY services/web ./services/web
WORKDIR /app/services/web

EXPOSE 5173
CMD ["pnpm", "dev"]
