# ============================================================================
# Dockerfile — Node Monitor Agent (Go)
# ----------------------------------------------------------------------------
# Multi-stage build: compile Go agent di stage builder, lalu copy binary
# ke image minimal yang sangat kecil.
# ============================================================================

# --- Stage 1: Builder -------------------------------------------------------
FROM golang:1.22-slim AS builder

WORKDIR /build

# Copy go.mod dulu untuk caching dependency layer.
COPY go.mod ./

# Download dependencies.
RUN go mod download || true

# Copy source code.
COPY . .

# Download ulang + build binary statis.
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /node-monitor-agent .

# --- Stage 2: Runtime -------------------------------------------------------
FROM debian:bookworm-slim

# Install ca-certificates untuk HTTPS requests ke dashboard.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy binary dari stage builder.
COPY --from=builder /node-monitor-agent /usr/local/bin/node-monitor-agent

# Environment defaults (bisa di-override saat docker run).
ENV DASHBOARD_URL=http://monitor:3000
ENV TOKEN=changeme
ENV INTERVAL_SEC=10
ENV TIMEOUT_SEC=5

# Entry point.
ENTRYPOINT ["node-monitor-agent"]
