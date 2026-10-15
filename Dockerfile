# ------------------------------------------------------------------
# Souq API production image
# ------------------------------------------------------------------
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Install dependencies first so the layer is cached when only source changes.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source
COPY . .

# Run as the non-root user that ships with the node image.
USER node

EXPOSE 4000

# Health check uses the liveness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Migrations run on start so the schema is ready; then boot the server.
CMD ["sh", "-c", "npm run migrate && npm start"]
