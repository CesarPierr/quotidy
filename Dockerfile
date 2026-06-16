FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# Run as a non-root user. HOME + npm cache point at /tmp so the process still
# works when the container is started with a read-only root filesystem (the
# compose file mounts a tmpfs at /tmp and /app/.next/cache).
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs \
 && chown -R nextjs:nodejs /app
ENV HOME=/tmp
ENV NPM_CONFIG_CACHE=/tmp/.npm
USER nextjs

EXPOSE 3000
CMD ["npm", "run", "start"]
