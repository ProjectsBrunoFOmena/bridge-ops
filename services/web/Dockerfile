FROM node:20-alpine
WORKDIR /app

RUN corepack enable

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY services/web/package.json ./services/web/package.json
COPY services/web ./services/web
RUN pnpm install --frozen-lockfile=false

EXPOSE 5173
CMD ["pnpm", "--filter", "web", "dev"]
