FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=builder /app/build ./build
EXPOSE 4173
CMD ["serve", "-s", "build", "-l", "4173"]