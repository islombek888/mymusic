# ===============================
# Base image with Python 3.11+
# ===============================
FROM node:22-bookworm

# ===============================
# System dependencies
# ===============================
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-distutils-extra \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Install yt-dlp via pip (better compatibility)
# ===============================
RUN python3 -m pip install --upgrade pip --break-system-packages && \
    python3 -m pip install yt-dlp --break-system-packages

# Create symlink for compatibility
RUN ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp

# Ensure yt-dlp can write cache/config in restricted environments (Render)
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_CONFIG_HOME=/tmp/.config
RUN mkdir -p /tmp/.cache /tmp/.config
RUN yt-dlp --version

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