# Node Monitor Dashboard
FROM node:22-slim

WORKDIR /app

# Copy package files first for layer caching.
COPY package.json package-lock.json* ./

RUN npm ci --omit=dev || npm install --omit=dev

COPY index.js ./
COPY src/ ./src/

RUN mkdir -p /app/data

EXPOSE 3000

ENV PORT=3000
ENV TOKEN=changeme
ENV DB_PATH=/app/data/monitor.db

# Health check — hit /api/health every 30s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-sqlite", "index.js"]
