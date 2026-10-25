# Build from the repo root:  docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
RUN if [ -f package-lock.json ]; then npm ci -w apps/api; else npm install -w apps/api; fi

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# The Prisma CLI is needed at start-up for `migrate deploy`, so node_modules is copied whole.
# To slim the image, move `prisma` to dependencies and run `npm prune --omit=dev`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
