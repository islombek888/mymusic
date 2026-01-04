# ===== BASE IMAGE =====
FROM node:20-bullseye

# ===== SYSTEM DEPS =====
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ===== INSTALL yt-dlp (OFFICIAL BINARY) =====
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# ===== WORKDIR =====
WORKDIR /app

# ===== NODE DEPS =====
COPY package*.json ./
RUN npm ci

# ===== SOURCE =====
COPY . .

# ===== BUILD =====
RUN npm run build

# ===== RUNTIME DIRS =====
RUN mkdir -p \
    downloads/youtube \
    downloads/instagram \
    downloads/extracted \
    downloads/temp

# ===== PORT =====
EXPOSE 3000

# ===== START =====
CMD ["node", "dist/main.js"]