FROM node:22-alpine AS build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./

ARG VITE_API_MODE=backend
ARG VITE_SMARTQ_API_URL=/api
ENV VITE_API_MODE=$VITE_API_MODE
ENV VITE_SMARTQ_API_URL=$VITE_SMARTQ_API_URL

RUN npm run build

FROM nginx:1.27-alpine AS runtime
ENV BACKEND_UPSTREAM=backend:3000
COPY docker/nginx/frontend.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
