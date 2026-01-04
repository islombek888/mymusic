FROM node:22-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (latest version)
RUN pip3 install --no-cache-dir --upgrade yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for tsx in dev mode)
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript for production
RUN npm run build

# Create downloads directory
RUN mkdir -p downloads/youtube downloads/instagram downloads/extracted downloads/temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
# Use npm start for production (compiled JS)
# For dev mode, you can override with: docker run ... npm run dev
CMD ["npm", "start"]

