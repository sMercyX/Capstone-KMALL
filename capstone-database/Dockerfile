FROM postgres:18

RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential ca-certificates postgresql-server-dev-18 \
  && rm -rf /var/lib/apt/lists/*

# Install pgvector (choose version you used before)
RUN git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && cd /tmp/pgvector \
  && make \
  && make install \
  && rm -rf /tmp/pgvector
