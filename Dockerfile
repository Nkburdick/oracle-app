FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

# Copy built output
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Install only production deps via npm (lighter than bun in runtime).
# Do NOT swallow errors — a failed install must fail the build so we don't
# ship a broken production container.
RUN npm install --omit=dev --ignore-scripts

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "build/index.js"]
