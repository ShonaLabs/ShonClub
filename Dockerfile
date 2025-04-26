FROM oven/bun:1 as builder

WORKDIR /app

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python packages in virtual environment
RUN pip install --no-cache-dir invoke

# Copy package files
COPY package.json .

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build mediasoup worker
RUN bun run worker:build

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Install Python and build dependencies for production
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python packages in virtual environment
RUN pip install --no-cache-dir invoke

# Copy built files and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json .

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "prod"] 