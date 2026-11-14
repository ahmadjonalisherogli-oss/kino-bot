#!/bin/sh
set -e

if [ -n "$POSTGRES_HOST" ]; then
  echo "Waiting for PostgreSQL at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  until python -c "import socket; s = socket.create_connection(('$POSTGRES_HOST', int('${POSTGRES_PORT:-5432}')), timeout=2); s.close()" 2>/dev/null; do
    sleep 1
  done
fi

exec "$@"
