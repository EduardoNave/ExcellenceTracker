# ──────────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Vite embeds these at build time — pass them from Coolify env vars
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_ADMIN_EMAIL
ARG VITE_BREVO_SENDER_EMAIL
ARG VITE_BREVO_SENDER_NAME

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL
ENV VITE_BREVO_SENDER_EMAIL=$VITE_BREVO_SENDER_EMAIL
ENV VITE_BREVO_SENDER_NAME=$VITE_BREVO_SENDER_NAME

RUN npm run build

# ──────────────────────────────────────────────
# Stage 2: Serve
# ──────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Replace default nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
