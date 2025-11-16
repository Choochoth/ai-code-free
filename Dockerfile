# ============================
# Stage 1: Build
# ============================
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY ./src ./src
COPY ./data ./data
COPY ./clear.js ./
COPY ./source.js ./
COPY ./copy-static.js ./

RUN npm run build


# ============================
# Stage 2: Production
# ============================
FROM node:20-alpine
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data

COPY package*.json ./

# 🟢 ใช้แบบนี้แทน npm ci เพราะไม่มี package-lock.json
RUN npm install --omit=dev

EXPOSE 5400

CMD ["sh", "-c", "node dist/main.js --port ${PORT:-5400}"]
