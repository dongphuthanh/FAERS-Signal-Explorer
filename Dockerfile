# The web server only: the database lives in RDS, ingestion runs elsewhere.
# The MiniLM model is copied in from data/models, so the container never
# downloads anything at runtime.
FROM node:24-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# CA bundle for verifying the RDS certificate (see src/db.mjs)
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem rds-ca.pem

COPY src src
COPY sql sql
COPY drugs.json ./
COPY data/models data/models

ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 LOG_TO_STDOUT=1 PGSSLROOTCERT=/app/rds-ca.pem
USER node
EXPOSE 8080
CMD ["node", "src/server.mjs"]
