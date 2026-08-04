# ============================================================================
# Dockerfile — Node Monitor Dashboard
# ----------------------------------------------------------------------------
# Image Node.js ringan untuk menjalankan dashboard monitoring.
# ============================================================================

FROM node:22-slim

# Set working directory.
WORKDIR /app

# Copy package files dulu untuk caching layer.
COPY package.json package-lock.json* ./

# Install dependencies (production only).
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code.
COPY index.js ./
COPY src/ ./src/

# Buat direktori untuk SQLite database.
RUN mkdir -p /app/data

# Expose port dashboard.
EXPOSE 3000

# Environment defaults (bisa di-override saat docker run).
ENV PORT=3000
ENV TOKEN=changeme
ENV DB_PATH=/app/data/monitor.db

# Health check — hit /api/health setiap 30 detik.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start dashboard.
CMD ["node", "--experimental-sqlite", "index.js"]
