# Mock Order Processing API
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src

ENV PORT=3000 \
    MAX_CONCURRENCY=10 \
    POST_DELAY_MIN_MS=80 \
    POST_DELAY_MAX_MS=120 \
    MAX_QUEUE=0

EXPOSE 3000

USER node

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
