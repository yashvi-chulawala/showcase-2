FROM node:18-bullseye

# 1. Install system utilities and Linux krpanotools
RUN apt-get update && apt-get install -y wget tar && \
    mkdir -p /opt/krpano && \
    wget -qO- https://krpano.com/releases/1.20.12/krpano-1.20.12-linux64.tar.gz | tar -xz -C /opt/krpano --strip-components=1 && \
    chmod +x /opt/krpano/krpanotools && \
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
