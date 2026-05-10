FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm install -g tsx

# Install dev deps for build only
RUN npm install --save-dev typescript tsx @types/node @types/express --no-audit --no-fund
RUN npx tsc -p tsconfig.json

# ─── runtime image ───────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# ffmpeg for alass audio extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# alass binary (Phase 6 audio sync — Desktop only)
RUN ALASS_VER=0.6.1 && \
    wget -qO /app/bin/alass-linux-x86_64 \
    "https://github.com/kaegi/alass/releases/download/v${ALASS_VER}/alass-linux-x86_64" && \
    chmod +x /app/bin/alass-linux-x86_64 && \
    echo "alass installed"

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN mkdir -p bin

ENV NODE_ENV=production
ENV PORT=7777
EXPOSE 7777

CMD ["node", "dist/index.js"]
