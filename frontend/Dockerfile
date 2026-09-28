# ---- Etapa 1: Build (con Node) ----
    FROM node:22-alpine AS build
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    # En el build del contenedor, configuramos la URL relativa para que vaya por Nginx
    ENV VITE_API_URL=/api/v1
    RUN npm run build

    # ---- Etapa 2: tests (parte de build: ya tiene Node y las dependencias de desarrollo) ----
    # El umbral vive en vite.config.js (coverage.thresholds): si no se llega, vitest sale con error.
    FROM build AS test
    ENTRYPOINT ["npm", "run", "test:ci"]

    # ---- Etapa 3: Runtime (Nginx liviano) — queda ÚLTIMA: es la imagen que se despliega ----
    FROM nginx:alpine
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    COPY --from=build /app/dist /usr/share/nginx/html
    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
