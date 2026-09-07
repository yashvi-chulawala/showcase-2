FROM node:18-bullseye

# 1. Install system utilities and Linux krpanotools
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tar unzip zip && \
    mkdir -p /opt/krpano /root/.krpano && \
    (curl -fsSL "https://krpano.com/download/files/krpano-1.20.12-linux64.tar.gz" | tar -xz -C /opt/krpano --strip-components=1 || \
     curl -fsSL "https://krpano.com/download/12012/krpano-1.20.12-linux64.tar.gz" | tar -xz -C /opt/krpano --strip-components=1 || true) && \
    (chmod -R +x /opt/krpano || true) && \
    rm -rf /var/lib/apt/lists/*

# Register krpano license natively on Linux
ENV KRPANO_LICENSE_KEY="vR36fDXTMcEEdJ6j1G8G+xh72yjEJlyU2W4BpP3Ld6Ho0uFkAZPCTK6SdktN2+Pa50hWEa9kVfhTmMX7UqhxGFl1C9kFzYoRRSKBODWJtElJmBbe89Rs1hWP5AZN3amgpHJU48G+8UM4tJe+YV42PsFTZVSsp9nF3bCMDWsNqakos3nuqCqAH5odemYkp1pkGledN+XNNSRCBgURghtte7JnghQev2E0qk9oFkIBSFOj62+U6sL0QPBUSkJ8xABSUCW9MM2V1QZu5m6BDhBGwlR0qTR512DE15Zw5CnR9DSHrc/UEJKNcwSk0cVXF4nTcZPv0Bg4DlbW3mz04uS2xsHmT+tehwm6BfyBsA=="
RUN /opt/krpano/krpanotools register "$KRPANO_LICENSE_KEY" && \
    /opt/krpano/krpanotools register show

WORKDIR /app

# 2. Install dependencies
COPY package*.json ./
RUN npm install

# 3. Copy source files
COPY . .

# 4. Environment configuration
ENV PORT=5050
ENV KRPANOTOOLS_BIN=/opt/krpano/krpanotools
EXPOSE 5050

CMD ["node", "server.js"]
