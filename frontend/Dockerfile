FROM ghcr.io/voidzero-dev/vite-plus:1.0.0 AS build
WORKDIR /app
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
RUN vp install --frozen-lockfile
COPY --chown=vp:vp . .
RUN vp build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
