# Build context is the repo root (Railway's dockerfilePath setting).
FROM node:22-alpine
WORKDIR /app
COPY bridge/package.json ./
RUN npm install --omit=dev
COPY bridge/server.mjs ./
EXPOSE 2525
CMD ["node", "server.mjs"]
