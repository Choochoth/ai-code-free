# ============================
# Stage 1: Build
# ============================
FROM node:20-alpine AS build
WORKDIR /app

# ติดตั้ง dependencies ก่อน
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# คัดลอก source โค้ด
COPY ./src ./src
COPY ./data ./data
COPY ./clear.js ./
COPY ./source.js ./
COPY ./copy-static.js ./

# Build
RUN npm run build


# ============================
# Stage 2: Production
# ============================
FROM node:20-alpine
WORKDIR /app

# Copy output ของ build
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data

# เพื่อให้ runtime มี package.json กับ lockfile
COPY package*.json ./

# ติดตั้งเฉพาะ production modules
RUN npm ci --only=production

EXPOSE 3000

CMD ["sh", "-c", "node dist/main.js --port ${PORT:-3000}"]
