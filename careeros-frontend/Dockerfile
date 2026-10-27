# Sprint 8 production image for the Next.js frontend.
# Uses the self-contained "standalone" build (see next.config.mjs).
# Browsers call this site's own /api/* (same origin — no mixed-content/CORS
# issues); the Next server proxies to API_PROXY_URL server-side.
# Pass both with --build-arg or via Compose (see docker-compose.prod.yml).
# NEXT_PUBLIC_API_URL is only needed to bypass the proxy (public, not secret).

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG API_PROXY_URL=http://localhost:8080
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ARG NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=""
ARG NEXT_PUBLIC_LEGAL_WEBSITE=""
ARG APP_VERSION=""
ENV API_PROXY_URL=$API_PROXY_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=$NEXT_PUBLIC_LEGAL_CONTACT_EMAIL
ENV NEXT_PUBLIC_LEGAL_WEBSITE=$NEXT_PUBLIC_LEGAL_WEBSITE
ENV APP_VERSION=$APP_VERSION
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ARG APP_VERSION=""
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_VERSION=$APP_VERSION
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
