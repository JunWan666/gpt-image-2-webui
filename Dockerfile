# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_IMAGE_STORAGE_MODE=$NEXT_PUBLIC_IMAGE_STORAGE_MODE

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV GENERATED_IMAGE_CLEANUP_ENABLED=true
ENV GENERATED_IMAGE_RETENTION_DAYS=3
ENV GENERATED_IMAGE_CLEANUP_INTERVAL_HOURS=24
ENV GENERATED_IMAGE_CLEANUP_RUN_ON_START=true
ENV GENERATED_IMAGE_CLEANUP_LOG_FILE=/app/logs/cleanup-generated-images.log

RUN apk add --no-cache bash \
    && addgroup -S nextjs \
    && adduser -S nextjs -G nextjs \
    && mkdir -p /app/generated-images \
    && mkdir -p /app/logs \
    && chown -R nextjs:nextjs /app

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs --chmod=755 /app/scripts/cleanup-generated-images.sh ./scripts/cleanup-generated-images.sh
COPY --from=builder --chown=nextjs:nextjs --chmod=755 /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
