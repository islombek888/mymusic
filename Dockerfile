# ===== BASE IMAGE (STABLE) =====
FROM node:20-bullseye

# ===== SYSTEM DEPENDENCIES =====
# python3  → yt-dlp uchun
# ffmpeg  → audio extract uchun
# yt-dlp  → instagram / youtube downloader
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# ===== APP DIRECTORY =====
WORKDIR /app

# ===== NODE DEPENDENCIES =====
COPY package*.json ./
RUN npm ci

# ===== SOURCE CODE =====
COPY . .

# ===== BUILD NESTJS =====
RUN npm run build

# ===== RUNTIME DIRECTORIES =====
RUN mkdir -p \
    downloads/youtube \
    downloads/instagram \
    downloads/extracted \
    downloads/temp

# ===== PORT =====
EXPOSE 3000

# ===== START APP =====
CMD ["node", "dist/main.js"]