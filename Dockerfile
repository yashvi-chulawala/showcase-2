FROM node:18-bullseye

# 1. Install system utilities, SSL certificates, unzip, zip and Linux krpanotools
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tar unzip zip && \
    mkdir -p /opt/krpano && \
    (curl -fsSL "https://krpano.com/download/files/krpano-1.20.12-linux64.tar.gz" | tar -xz -C /opt/krpano --strip-components=1 || \
     curl -fsSL "https://krpano.com/download/12012/krpano-1.20.12-linux64.tar.gz" | tar -xz -C /opt/krpano --strip-components=1 || true) && \
    (chmod -R +x /opt/krpano || true) && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Install dependencies
COPY Showcase360_editor-main/package*.json ./
RUN npm install

# 3. Copy application files
COPY Showcase360_editor-main/ .

# 4. Environment configuration
ENV PORT=5050
ENV KRPANOTOOLS_BIN=/opt/krpano/krpanotools
EXPOSE 5050

CMD ["node", "server.js"]
