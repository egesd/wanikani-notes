FROM node:20-slim

WORKDIR /app

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install all dependencies
RUN npm run install:all

# Copy source code
COPY shared/ shared/
COPY backend/ backend/
COPY frontend/ frontend/

# Build backend + frontend
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the port Fly assigns
EXPOSE 3001

CMD ["node", "backend/dist/backend/src/index.js"]
