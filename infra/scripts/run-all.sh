#!/bin/bash
set -e

echo "=== EventHub Phase 2 run-all.sh ==="

# --- 1. Network ---
echo "Creating network..."
podman network create eventhub-net 2>/dev/null || echo "Network already exists, continuing."

# --- 2. Infrastructure containers ---
echo "Starting MySQL..."
podman volume create mysql-data >/dev/null 2>&1 || true
podman run -d --name mysql --network eventhub-net \
  -v mysql-data:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=password123 \
  -e MYSQL_DATABASE=eventhub_catalog \
  mysql:8.4 2>/dev/null || echo "MySQL container already exists, continuing."

echo "Starting PostgreSQL..."
podman volume create mysql-data >/dev/null 2>&1 || true
podman run -d --name postgres --network eventhub-net \
  -v postgres-data:/var/lib/postgresql/data \
  -e POSTGRES_USER=eventhub \
  -e POSTGRES_PASSWORD=eventhub \
  -e POSTGRES_DB=eventhub_auth \
  postgres:16 2>/dev/null || echo "Postgres container already exists, continuing."

echo "Starting MongoDB..."
podman volume create mysql-data >/dev/null 2>&1 || true
podman run -d --name mongo --network eventhub-net \
  -v mongo-data:/data/db \
  mongo:7 2>/dev/null || echo "Mongo container already exists, continuing."

echo "Starting Redis..."
podman volume create mysql-data >/dev/null 2>&1 || true
podman run -d --name redis --network eventhub-net \
  -v redis-data:/data \
  redis:7-alpine 2>/dev/null || echo "Redis container already exists, continuing."

echo "Starting RabbitMQ..."
podman volume create mysql-data >/dev/null 2>&1 || true
podman run -d --name rabbitmq --network eventhub-net \
  -v rabbitmq-data:/var/lib/rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3-management 2>/dev/null || echo "RabbitMQ container already exists, continuing."


# --- 3. Wait for infrastructure to be ready ---
wait_for_port() {
  local host=$1
  local port=$2
  local name=$3
  echo "Waiting for $name ($host:$port)..."
  for i in $(seq 1 30); do
    if podman run --rm --network eventhub-net alpine sh -c "nc -z $host $port" 2>/dev/null; then
      echo "$name is ready."
      return 0
    fi
    sleep 2
  done
  echo "ERROR: $name did not become ready in time."
  exit 1
}

wait_for_port mysql 3306 "MySQL"
wait_for_port postgres 5432 "PostgreSQL"
wait_for_port mongo 27017 "MongoDB"
wait_for_port redis 6379 "Redis"
wait_for_port rabbitmq 5672 "RabbitMQ"


# --- 4. Build service images ---
echo "Building images..."
podman build --network=host -t eventhub-catalog services/legacy-catalog-java
podman build --network=host -t eventhub-auth services/auth-service-node
podman build --network=host -t eventhub-booking services/booking-service-python
podman build --network=host -t eventhub-notification services/notification-worker-go
podman build --network=host -t eventhub-ai-insight services/ai-insight-service-python
podman build --network=host -t eventhub-analytics services/analytics-service-python
podman build --network=host -t eventhub-frontend frontend


# --- 5. Run services, waiting on their dependencies ---
echo "Starting catalog..."
podman run -d --name catalog --network eventhub-net -p 8081:8081 \
  -e SPRING_DATASOURCE_URL="jdbc:mysql://mysql:3306/eventhub_catalog" \
  -e SPRING_DATASOURCE_USERNAME=root \
  -e SPRING_DATASOURCE_PASSWORD=password123 \
  --health-cmd="curl -f http://localhost:8081/health || exit 1" \
  --health-interval=10s --health-timeout=5s --health-start-period=30s --health-retries=3 \
  eventhub-catalog 2>/dev/null || echo "Catalog already running, continuing."

echo "Starting auth..."
podman run -d --name auth --network eventhub-net -p 8082:8082 \
  -e PGHOST=postgres -e PGPORT=5432 -e PGUSER=eventhub -e PGPASSWORD=eventhub -e PGDATABASE=eventhub_auth \
  -e JWT_SECRET=change-me-in-every-environment \
  --health-cmd="wget -q -O - http://localhost:8082/health || exit 1" \
  --health-interval=10s --health-timeout=5s --health-start-period=15s --health-retries=3 \
  eventhub-auth 2>/dev/null || echo "Auth already running, continuing."

wait_for_port catalog 8081 "Catalog service"
wait_for_port auth 8082 "Auth service"

echo "Starting AI insight..."
podman run -d --name ai-insight --network eventhub-net -p 8084:8084 \
  eventhub-ai-insight 2>/dev/null || echo "AI insight already running, continuing."

wait_for_port ai-insight 8084 "AI insight service"

echo "Starting booking..."
podman run -d --name booking --network eventhub-net -p 8083:8083 \
  -e MONGO_URI="mongodb://mongo:27017" -e MONGO_DB=eventhub_bookings \
  -e RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672/" -e RABBITMQ_QUEUE=bookings \
  -e AI_INSIGHT_URL="http://ai-insight:8084" \
  eventhub-booking 2>/dev/null || echo "Booking already running, continuing."

wait_for_port booking 8083 "Booking service"

echo "Starting notification worker..."
podman run -d --name notification --network eventhub-net \
  -e RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672/" -e RABBITMQ_QUEUE=bookings \
  eventhub-notification 2>/dev/null || echo "Notification worker already running, continuing."

echo "Starting analytics API..."
podman run -d --name analytics --network eventhub-net -p 8085:8085 \
  -e REDIS_URL="redis://redis:6379/0" \
  -e BOOKING_SERVICE_URL="http://booking:8083" \
  -e CATALOG_SERVICE_URL="http://catalog:8081" \
  -e SNAPSHOT_KEY="analytics:snapshot" \
  eventhub-analytics 2>/dev/null || echo "Analytics already running, continuing."

wait_for_port analytics 8085 "Analytics service"

echo "Starting frontend..."
podman run -d --name frontend --network eventhub-net -p 3000:80 \
  eventhub-frontend 2>/dev/null || echo "Frontend already running, continuing."


# --- 6. Run the analytics job once ---
echo "Running analytics job..."
podman run --rm --network eventhub-net \
  -e REDIS_URL="redis://redis:6379/0" \
  -e BOOKING_SERVICE_URL="http://booking:8083" \
  -e CATALOG_SERVICE_URL="http://catalog:8081" \
  -e SNAPSHOT_KEY="analytics:snapshot" \
  eventhub-analytics python job.py

echo ""
echo "=== All services started ==="
echo "Frontend:   http://localhost:3000"
echo "Catalog:    http://localhost:8081/health"
echo "Auth:       http://localhost:8082/health"
echo "Booking:    http://localhost:8083/health"
echo "AI Insight: http://localhost:8084/health"
echo "Analytics:  http://localhost:8085/health"