FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --production=false
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.svelte-kit ./ .svelte-kit
COPY --from=builder /app/build ./build
EXPOSE ${PORT:-4173}
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "${PORT:-4173}"]
