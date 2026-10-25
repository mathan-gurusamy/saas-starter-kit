# Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
RUN if [ -f package-lock.json ]; then npm ci -w apps/web; else npm install -w apps/web; fi
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
