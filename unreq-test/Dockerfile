FROM oven/bun:1.0-debian

WORKDIR /app

# Install pnpm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://get.pnpm.io/install.sh | bash - && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add pnpm to PATH
ENV PATH="/root/.local/share/pnpm:$PATH"

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install

# Copy application code
COPY . .

# Expose ports for all services
EXPOSE 3001-3009

# Default command runs tests
CMD ["pnpm", "test:all"]
