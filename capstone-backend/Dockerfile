FROM golang:1.24.6 AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o server ./cmd/api
# uploading
RUN mkdir -p /app/uploads && chown -R 65532:65532 /app/uploads

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=builder /app/server /app/server
# uploading
COPY --from=builder /app/uploads /app/uploads
ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
