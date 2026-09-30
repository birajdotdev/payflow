FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global vite-plus@1.0.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN vp install --frozen-lockfile
COPY . .
RUN vp build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
