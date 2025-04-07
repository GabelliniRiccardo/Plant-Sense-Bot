# -----------------------------
# 1. Build stage con tutte le deps
# -----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ----------------------------
# 2. Final stage senza dev deps
# ----------------------------
FROM node:20-alpine AS final

WORKDIR /app

# Copia solo il dist e node_modules puliti
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Rimuove le devDependencies dalla node_modules
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["node", "dist/index.js"]
