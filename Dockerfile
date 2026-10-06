# Fase 1: compilar la SPA
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Entorno de la imagen: el compose de preprod pasa VITE_ENTORNO=preproduccion (letrero); producción no pasa nada.
ARG VITE_ENTORNO=
ENV VITE_ENTORNO=$VITE_ENTORNO
RUN npm run build

# Fase 2: servir con nginx (la conf se monta desde /opt/reparaciones/nginx en la VM)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
