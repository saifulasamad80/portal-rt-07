#!/usr/bin/env bash
#
# Backend Supabase-kompatibel untuk pengembangan LOKAL (Cloud Agent environment).
#
# Menyediakan endpoint yang dibutuhkan aplikasi tanpa kredensial produksi:
#   - PostgreSQL (cluster milik user, di $HOME) berisi skema + seed demo
#   - PostgREST  (memetakan tabel ke REST ala Supabase)
#   - nginx      (gateway yang meneruskan /rest/v1/* -> PostgREST, meniru URL Supabase)
#
# Kunci anon/service_role adalah JWT yang ditandatangani secara lokal memakai
# SUPABASE_JWT_SECRET demo publik Supabase — BUKAN rahasia produksi. Aman ditulis
# ke .env.local (yang tetap di-gitignore).
#
# Perintah:
#   setup  : idempotent — pasang paket, initdb, seed, tulis .env.local
#   up     : jalankan postgres + postgrest + nginx, tunggu REST siap
#   down   : hentikan ketiganya
#   status : ringkas status proses & endpoint
#   psql   : buka psql ke database lokal
set -euo pipefail

ROOT_DIR="${PORTAL_RT_LOCAL_DIR:-$HOME/.local/share/portal-rt}"
PGDATA="$ROOT_DIR/pgdata"
LOG_DIR="$ROOT_DIR/logs"
RUN_DIR="$ROOT_DIR/run"
BIN_DIR="$HOME/.local/bin"
PGRST_BIN="$BIN_DIR/postgrest"
PGRST_CONF="$ROOT_DIR/postgrest.conf"
NGINX_CONF="$ROOT_DIR/nginx.conf"

PG_BIN="/usr/lib/postgresql/16/bin"
PG_PORT=5433
PGRST_PORT=3001
API_PORT=54321
DB_NAME="portal_rt"

SB_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
COOKIE_JWT_SECRET="local-dev-cookie-secret-minimal-32-characters-000"
TENANT="00000000-0000-0000-0000-000000000007"

PGRST_VERSION="v16.2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

log() { printf '\033[36m[local-supabase]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[local-supabase]\033[0m %s\n' "$*" >&2; }

mint_jwt() {
  # mint_jwt <role>  -> stdout JWT HS256 (iss=supabase-demo, exp jauh ke depan)
  local role="$1"
  SB_JWT_SECRET="$SB_JWT_SECRET" node -e '
    const crypto = require("crypto");
    const secret = process.env.SB_JWT_SECRET;
    const role = process.argv[1];
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { role, iss: "supabase-demo", iat: now, exp: now + 60 * 60 * 24 * 3650 };
    const data = b64(header) + "." + b64(payload);
    const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    process.stdout.write(data + "." + sig);
  ' "$role"
}

ensure_dirs() { mkdir -p "$ROOT_DIR" "$LOG_DIR" "$RUN_DIR" "$BIN_DIR"; }

ensure_packages() {
  local butuh=()
  [ -x "$PG_BIN/initdb" ] || butuh+=(postgresql postgresql-contrib)
  command -v /usr/sbin/nginx >/dev/null 2>&1 || butuh+=(nginx)
  if [ "${#butuh[@]}" -gt 0 ]; then
    log "Memasang paket via apt: ${butuh[*]}"
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "${butuh[@]}"
  fi
  if [ ! -x "$PGRST_BIN" ]; then
    log "Mengunduh PostgREST $PGRST_VERSION..."
    local url="https://github.com/PostgREST/postgrest/releases/download/${PGRST_VERSION}/postgrest-${PGRST_VERSION}-linux-static-x86-64.tar.xz"
    curl -fsSL -o "$RUN_DIR/postgrest.tar.xz" "$url"
    tar -xJf "$RUN_DIR/postgrest.tar.xz" -C "$BIN_DIR"
    rm -f "$RUN_DIR/postgrest.tar.xz"
  fi
}

pg_running() { "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; }

init_db() {
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    log "Inisialisasi cluster PostgreSQL di $PGDATA..."
    "$PG_BIN/initdb" -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 >/dev/null
    {
      echo "listen_addresses = '127.0.0.1'"
      echo "port = $PG_PORT"
      echo "unix_socket_directories = '$RUN_DIR'"
    } >> "$PGDATA/postgresql.conf"
  fi
}

start_db() {
  if ! pg_running; then
    log "Menjalankan PostgreSQL (port $PG_PORT)..."
    "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$LOG_DIR/postgres.log" -w start >/dev/null
  fi
}

psql_local() { "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres "$@"; }

seed_db() {
  log "Menerapkan skema + seed demo..."
  if ! psql_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    "$PG_BIN/createdb" -h 127.0.0.1 -p "$PG_PORT" -U postgres "$DB_NAME"
  fi
  psql_local -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/schema.sql" >/dev/null
  # Role koneksi PostgREST: authenticator dapat berpindah ke anon/authenticated/service_role.
  psql_local -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -c "
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticator') THEN
        CREATE ROLE authenticator LOGIN PASSWORD 'postgres' NOINHERIT;
      END IF;
    END \$\$;
    GRANT anon, authenticated, service_role TO authenticator;
  " >/dev/null
  log "Seed selesai (tenant RT 07 = $TENANT)."
}

write_pgrst_conf() {
  cat > "$PGRST_CONF" <<EOF
db-uri = "postgres://authenticator:postgres@127.0.0.1:${PG_PORT}/${DB_NAME}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${SB_JWT_SECRET}"
server-host = "127.0.0.1"
server-port = ${PGRST_PORT}
db-pool = 6
EOF
}

write_nginx_conf() {
  cat > "$NGINX_CONF" <<EOF
worker_processes 1;
error_log ${LOG_DIR}/nginx-error.log warn;
pid ${RUN_DIR}/nginx.pid;
events { worker_connections 256; }
http {
  access_log ${LOG_DIR}/nginx-access.log;
  client_body_temp_path ${RUN_DIR}/nginx-body;
  proxy_temp_path ${RUN_DIR}/nginx-proxy;
  fastcgi_temp_path ${RUN_DIR}/nginx-fastcgi;
  uwsgi_temp_path ${RUN_DIR}/nginx-uwsgi;
  scgi_temp_path ${RUN_DIR}/nginx-scgi;
  server {
    listen 127.0.0.1:${API_PORT};
    location = /health { return 200 'ok'; add_header Content-Type text/plain; }
    location /rest/v1/ {
      rewrite ^/rest/v1/(.*)\$ /\$1 break;
      proxy_pass http://127.0.0.1:${PGRST_PORT};
      proxy_set_header Host \$host;
      proxy_set_header Connection "";
      proxy_http_version 1.1;
    }
    location / { return 404; }
  }
}
EOF
}

write_env() {
  local anon service env_file="$REPO_ROOT/.env.local"
  anon="$(mint_jwt anon)"
  service="$(mint_jwt service_role)"
  cat > "$env_file" <<EOF
# Dihasilkan otomatis oleh scripts/dev/local-supabase.sh — HANYA untuk dev lokal.
# Nilai di bawah menunjuk ke backend Supabase-kompatibel lokal, bukan produksi.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${API_PORT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service}
SUPABASE_JWT_SECRET=${SB_JWT_SECRET}
JWT_SECRET=${COOKIE_JWT_SECRET}
PUBLIC_RT_ID=${TENANT}
REGISTRATION_RT_ID=${TENANT}
EOF
  log "Menulis $env_file"
}

start_pgrst() {
  if pgrep -f "$PGRST_BIN $PGRST_CONF" >/dev/null 2>&1; then return; fi
  write_pgrst_conf
  log "Menjalankan PostgREST (port $PGRST_PORT)..."
  nohup "$PGRST_BIN" "$PGRST_CONF" >"$LOG_DIR/postgrest.log" 2>&1 &
}

start_nginx() {
  write_nginx_conf
  if [ -f "$RUN_DIR/nginx.pid" ] && kill -0 "$(cat "$RUN_DIR/nginx.pid" 2>/dev/null)" 2>/dev/null; then
    /usr/sbin/nginx -c "$NGINX_CONF" -p "$RUN_DIR" -s reload 2>/dev/null || true
    return
  fi
  log "Menjalankan nginx gateway (port $API_PORT)..."
  /usr/sbin/nginx -c "$NGINX_CONF" -p "$RUN_DIR"
}

wait_ready() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  for i in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${API_PORT}/rest/v1/master_rt?select=nama_rt&limit=1" \
        -H "Authorization: Bearer $(mint_jwt service_role)" >/dev/null 2>&1; then
      log "REST siap di http://127.0.0.1:${API_PORT}/rest/v1"
      return 0
    fi
    sleep 1
  done
  err "REST tidak siap; cek $LOG_DIR/postgrest.log dan $LOG_DIR/nginx-error.log"
  return 1
}

stop_db() { pg_running && "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true; }

cmd_setup() {
  ensure_dirs
  ensure_packages
  init_db
  start_db
  seed_db
  write_env
  # Matikan Postgres agar snapshot build bersih (tanpa postmaster.pid basi).
  # Layanan dijalankan lagi oleh perintah `up` saat agent boot.
  stop_db
  log "setup selesai."
}

cmd_up() {
  ensure_dirs
  start_db
  start_pgrst
  start_nginx
  wait_ready
  cmd_status
}

cmd_down() {
  [ -f "$RUN_DIR/nginx.pid" ] && /usr/sbin/nginx -c "$NGINX_CONF" -p "$RUN_DIR" -s stop 2>/dev/null || true
  pkill -f "$PGRST_BIN $PGRST_CONF" 2>/dev/null || true
  stop_db
  log "Semua layanan lokal dihentikan."
}

cmd_status() {
  pg_running && log "postgres: UP (127.0.0.1:$PG_PORT)" || err "postgres: DOWN"
  pgrep -f "$PGRST_BIN $PGRST_CONF" >/dev/null 2>&1 && log "postgrest: UP (127.0.0.1:$PGRST_PORT)" || err "postgrest: DOWN"
  { [ -f "$RUN_DIR/nginx.pid" ] && kill -0 "$(cat "$RUN_DIR/nginx.pid")" 2>/dev/null; } && log "nginx: UP (127.0.0.1:$API_PORT)" || err "nginx: DOWN"
}

case "${1:-}" in
  setup) cmd_setup ;;
  up)    cmd_up ;;
  down)  cmd_down ;;
  status) cmd_status ;;
  psql)  shift; start_db; psql_local -d "$DB_NAME" "$@" ;;
  *) echo "Usage: $0 {setup|up|down|status|psql}"; exit 1 ;;
esac
