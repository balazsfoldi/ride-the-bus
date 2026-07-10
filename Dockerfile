FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine

ARG APP_VERSION=
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV APP_VERSION=${APP_VERSION}

COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY package*.json ./

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/api/health >/dev/null || exit 1

CMD ["node", "server-dist/onlineServer.mjs"]
