# Stage 1: Build
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

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# ✅ public ถูก copy เข้า dist แล้ว ไม่ต้อง copy ออกนอก dist
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/package*.json ./
COPY .env ./

RUN npm install --only=production

EXPOSE 3000
CMD ["node", "dist/main.js"]
