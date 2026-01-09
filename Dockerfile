# ===============================
# Stage 1: Builder
# ===============================
FROM node:22-bookworm AS builder

WORKDIR /app

# Install dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ===============================
# Stage 2: Runner
# ===============================
FROM node:22-bookworm-slim

WORKDIR /app

# ===============================
# Install System Dependencies
# (ffmpeg, python3 for yt-dlp)
# ===============================
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Install yt-dlp
# ===============================
# Using the official binary release for stability and ease of update
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --update-to latest

# Configure yt-dlp cache directories for limited user environments (like Render)
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_CONFIG_HOME=/tmp/.config
RUN mkdir -p /tmp/.cache /tmp/.config

# ===============================
# Install Application Dependencies
# ===============================
COPY package*.json ./
# Only install production dependencies to keep image small
RUN npm ci --omit=dev

# ===============================
# Copy Built Application
# ===============================
COPY --from=builder /app/dist ./dist

# ===============================
# Setup Runtime Environment
# ===============================
# Create directories for downloads
RUN mkdir -p \
    downloads/youtube \
    downloads/instagram \
    downloads/extracted \
    downloads/temp

# Render sets PORT env var automatically, but we expose 3000 as default
ENV PORT=3000
EXPOSE 3000

# ===============================
# Start Verification & App
# ===============================
# Verify installations
RUN node --version && python3 --version && ffmpeg -version && yt-dlp --version

CMD ["node", "dist/index.js"]