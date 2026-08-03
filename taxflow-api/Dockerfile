# TaxFlow API — production container image
# Build from monorepo root: docker build -f taxflow-api/Dockerfile .

FROM node:20-alpine AS builder

WORKDIR /app

# Build box-wrapper-service first (API dependency)
COPY box-wrapper-service/package*.json ./box-wrapper-service/
RUN cd box-wrapper-service && npm ci
COPY box-wrapper-service/ ./box-wrapper-service/
RUN cd box-wrapper-service && npm run build

# Install API dependencies
COPY taxflow-api/package*.json ./taxflow-api/
RUN cd taxflow-api && npm ci --omit=dev

COPY taxflow-api/ ./taxflow-api/

# ─── Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app/taxflow-api

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/box-wrapper-service /app/box-wrapper-service
COPY --from=builder /app/taxflow-api /app/taxflow-api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
