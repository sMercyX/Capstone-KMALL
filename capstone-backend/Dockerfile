# ===== Stage 1: Build =====
FROM golang:1.24-alpine AS builder

# ตั้ง working directory
WORKDIR /app

# ติดตั้ง git เพื่อดึง dependency
RUN apk add --no-cache git

# คัดลอก go.mod และ go.sum ก่อน เพื่อใช้ cache
COPY go.mod go.sum ./
RUN go mod download

# คัดลอก source ทั้งหมด
COPY . .

# ✅ build จาก cmd/api ที่มี main.go
RUN go build -o server ./cmd/api

# ===== Stage 2: Run =====
FROM alpine:latest
WORKDIR /app

# ติดตั้ง CA certificates สำหรับ HTTPS call
RUN apk --no-cache add ca-certificates

# คัดลอก binary จาก stage build
COPY --from=builder /app/server .

# คัดลอก .env (optional, ถ้าใช้ env_file ใน compose แล้วไม่จำเป็น)
COPY .env .env

# เปิด port 8080
EXPOSE 8080

# คำสั่งเริ่มต้น
CMD ["./server"]
