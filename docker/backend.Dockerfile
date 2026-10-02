FROM node:22-alpine AS deps
WORKDIR /app/backend

RUN apk add --no-cache cups-client ffmpeg openssl samba-client

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app/backend

RUN apk add --no-cache cups-client ffmpeg openssl samba-client

COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend ./

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app/backend

RUN apk add --no-cache cups-client ffmpeg openssl samba-client

ENV NODE_ENV=production

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
