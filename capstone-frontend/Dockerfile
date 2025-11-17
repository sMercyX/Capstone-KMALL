# Step 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Production stage (serve)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# expose port
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
