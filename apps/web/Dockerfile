FROM node:22-alpine AS deps
WORKDIR /app
# Lockfile + `npm ci` → reproducible builds. `npm install` without the lockfile
# silently drifted dependency versions between the dev and the Docker image.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV DOCKER_BUILD=1
ENV FORGE_FONT_MODE=fallback
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DOCKER_BUILD=1
ENV FORGE_FONT_MODE=fallback
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
USER node
CMD ["node", "server.js"]
