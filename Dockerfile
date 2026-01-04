# ===============================
# Base image (ESM + stable)
# ===============================
FROM node:20-bullseye

# ===============================
# System dependencies
# ===============================
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Install yt-dlp (official binary)
# ===============================
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# ===============================
# App directory
# ===============================
WORKDIR /app

# ===============================
# Install node dependencies
# ===============================
COPY package*.json ./
RUN npm ci

# ===============================
# Copy source code
# ===============================
COPY . .

# ===============================
# Build TypeScript
# ===============================
RUN npm run build

# ===============================
# Runtime folders
# ===============================
RUN mkdir -p \
    downloads/youtube \
    downloads/instagram \
    downloads/extracted \
    downloads/temp

# ===============================
# Render port
# ===============================
EXPOSE 3000

# ===============================
# Start app (IMPORTANT)
# ===============================
CMD ["node", "dist/index.js"]

RUN ls -R dist