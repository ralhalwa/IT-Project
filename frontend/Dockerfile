# syntax=docker/dockerfile:1

# 1) Install deps (cached)
FROM node:20-alpine3.20 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

# 2) Build Next.js
FROM node:20-alpine3.20 AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# If your repo is strict on lint/types and it fails CI, add a next.config.js that ignores during builds.
RUN npm run build

# 3) Runtime (production)
FROM node:20-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only what we need to run
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
CMD ["npm", "start"]