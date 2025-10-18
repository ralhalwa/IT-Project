# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM golang:1.23.2-alpine AS builder
WORKDIR /app
RUN apk add --no-cache build-base ca-certificates sqlite-dev
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o server .

# ---- Runtime stage ----
FROM alpine:3.20
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata sqlite-libs

# App binary
COPY --from=builder /app/server /app/server

# Copy ONLY the migrations folder (so paths stay correct)
# Your code expects: file://database/migrations/sqlite
COPY --from=builder /app/database/migrations /app/migrations

# Seed /app/database (the mounted volume) with migrations if empty, then run the server
RUN printf '#!/bin/sh\nset -e\nif [ ! -d /app/database/migrations ]; then\n  mkdir -p /app/database\n  cp -r /app/migrations /app/database/\nfi\nexec "$@"\n' > /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/app/server"]