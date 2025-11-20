# Server Configuration - VPS Setup
**Server IP**: 72.60.223.242
**User**: root
**Password**: EnfyraTest1105@


## Database & Service Credentials

### PostgreSQL Configuration
- **PostgreSQL Version**: 16
- **Databases**:
  - `enfyra_demo` - Demo application database
  - `enfyra_landing` - Landing page database (new)
- **Admin User**: `enfyra`
- **Admin Password**: `EnfyraApp@MySQL2025`
- **Port**: 5432
- **Note**: User `enfyra_app` has been replaced with `enfyra` with full admin privileges

### Redis Configuration
- **Password**: `EnfyraRedis2025Cache`
- **Port**: 6379

---

## Application Environment Variables (.env)
```bash
# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=enfyra_demo
DB_NAME=enfyra_demo
DB_USERNAME=enfyra
DB_PASSWORD=EnfyraApp@MySQL2025

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=EnfyraRedis2025Cache

# Application
NODE_ENV=production
PORT=3000
```

---

## Installation Commands Summary

### 1. PostgreSQL Setup
```bash
# Install PostgreSQL
apt update
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Switch to postgres user
sudo -u postgres psql
```

**SQL Commands**:
```sql
-- Create databases
CREATE DATABASE enfyra_demo;
CREATE DATABASE enfyra_landing;

-- Create admin user with full privileges
CREATE USER enfyra WITH PASSWORD 'EnfyraApp@MySQL2025';
ALTER USER enfyra CREATEDB;

-- Grant privileges on all databases
GRANT ALL PRIVILEGES ON DATABASE enfyra_demo TO enfyra;
GRANT ALL PRIVILEGES ON DATABASE enfyra_landing TO enfyra;

-- Set ownership
ALTER DATABASE enfyra_demo OWNER TO enfyra;
ALTER DATABASE enfyra_landing OWNER TO enfyra;
\q
```

### 2. Redis Setup
```bash
# Install Redis
apt install -y redis-server

# Configure Redis password
sed -i "s/^# requirepass .*/requirepass EnfyraRedis2025Cache/" /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server
```

### 3. Node.js & Tools Setup
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install PM2
npm install -g pm2

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

### 4. Git & Nginx Setup
```bash
# Install Git
apt install -y git

# Install Nginx
apt install -y nginx

# Configure Nginx (example reverse proxy)
# Edit: /etc/nginx/sites-available/enfyra
```

### 5. Application Directory Setup
```bash
# Create app directory
mkdir -p /apps/be
cd /apps/be

# Clone repository (replace with your git URL)
git clone <your-git-repo-url> .

# Create .env file with the credentials above
nano .env
# (paste the environment variables from above)

# Install dependencies
yarn install

# Build application
yarn build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

---

## Server Performance Benchmark

### Hardware Specs
- **CPU:** AMD EPYC 9354P 32-Core Processor (4 vCPU cores allocated)
- **RAM:** 15GB total (14GB available)
- **Disk:** 193GB SSD (184GB available)
- **Kernel:** 6.8.0-86-generic

### Benchmark Results (Sysbench)
- **CPU:** 10,185 events/sec (Prime calculation)
- **Memory:** 12,989 MiB/sec throughput
- **Disk Read:** 241 MiB/sec
- **Disk Write:** 160.67 MiB/sec
- **Fsync:** 32,909 ops/sec

### Overall Rating: 9.5/10
Server performance is excellent for production workload with Node.js, PostgreSQL, and Redis.

---

## Installed Services Status

All services verified and running:
- ✅ PostgreSQL 16 (active)
- ✅ Redis 7.0.15 (active, password protected)
- ✅ Node.js v22.21.0 (upgraded from v20.19.5)
- ✅ Yarn 1.22.22
- ✅ PM2 6.0.13 (auto-start enabled)
- ✅ Git 2.43.0
- ✅ Nginx 1.24.0 (active)
- ✅ Certbot (SSL auto-renewal enabled)

---

## Deployed Applications

### 1. Demo Server (Backend API)
- **Directory**: `/apps/demo-server`
- **Repository**: https://github.com/dothinh115/enfyra-page-server
- **Port**: 1106
- **PM2 Name**: `demo-server`
- **PM2 Instances**: 4 (cluster mode)
- **Domain**: https://demo-api.enfyra.io
- **SSL**: Valid until 2026-01-24
- **Deploy Script**: `./deploy.sh`

**Environment (.env)**:
```bash
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=enfyra
DB_PASSWORD=EnfyraApp@MySQL2025
DB_NAME=enfyra_demo
DB_DATABASE=enfyra_demo

REDIS_URI=redis://:EnfyraRedis2025Cache@localhost:6379

NODE_NAME=enfyra_demo
PORT=1106
SECRET_KEY=enfyra_production_secret_2025
```

### 2. Demo App (Frontend)
- **Directory**: `/apps/demo-app`
- **Repository**: https://github.com/dothinh115/enfyra-page-app
- **Port**: 3000
- **PM2 Name**: `demo-app`
- **PM2 Instances**: 1 (cluster mode)
- **Domains**: https://demo.enfyra.io, https://www.demo.enfyra.io
- **SSL**: Valid until 2026-01-24
- **Deploy Script**: Located in app repo (`./deploy.sh`)

**Environment (.env)**:
```bash
API_URL=http://localhost:1106
DB_TYPE=postgres
PORT=3000
NUXT_PUBLIC_BASE_URL=https://demo.enfyra.io
NUXT_FONTS_PROVIDERS=google
```

**Note:**
- `API_URL=http://localhost:1106` để avoid Cloudflare proxy loop
- `NUXT_FONTS_PROVIDERS=google` để skip fontshare (VPS block external API)

---

## Nginx Configurations

### demo-api.enfyra.io
- **Config**: `/etc/nginx/sites-available/demo-api.enfyra.io`
- **Proxy**: localhost:1106
- **SSL**: Let's Encrypt

### demo.enfyra.io
- **Config**: `/etc/nginx/sites-available/demo.enfyra.io`
- **Proxy**: localhost:3000
- **SSL**: Let's Encrypt

---

## Cloudflare Optimization

### Current Status
- ✅ DNS: Cloudflare proxy enabled (172.66.x.x IPs)
- ✅ SSL: Full (strict) mode
- ✅ HTTP/2: Enabled
- ✅ HTTP/3 (QUIC): Available (alt-svc header present)
- ⚠️ Cache Status: DYNAMIC (not cached)

### Recommended Optimizations

#### 1. Speed → Optimization
- **Auto Minify**: Enable JS, CSS, HTML
- **Brotli**: Enable
- **Early Hints**: Enable (if available)

#### 2. Network → HTTP/3 (QUIC)
- **HTTP/3 (with QUIC)**: Enable
- **0-RTT Connection Resumption**: Enable

#### 3. Caching → Configuration
- **Caching Level**: Standard
- **Browser Cache TTL**: Respect Existing Headers

#### 4. Page Rules (Create these rules)

**Rule 1 - Cache Static Assets (demo.enfyra.io)**:
```
URL Pattern: demo.enfyra.io/*.js OR demo.enfyra.io/*.css OR demo.enfyra.io/*.jpg OR demo.enfyra.io/*.png OR demo.enfyra.io/*.woff*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
```

**Rule 2 - Bypass API Cache (api.enfyra.io)**:
```
URL Pattern: api.enfyra.io/*
Settings:
  - Cache Level: Bypass
```

**Rule 3 - Cache Images (demo.enfyra.io)**:
```
URL Pattern: demo.enfyra.io/_nuxt/* OR demo.enfyra.io/*.svg OR demo.enfyra.io/*.webp
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
```

#### 5. SSL/TLS Settings
- **SSL/TLS encryption mode**: Full (strict)
- **Minimum TLS Version**: TLS 1.2
- **Opportunistic Encryption**: On
- **TLS 1.3**: On

#### 6. Advanced Features (Paid Plans)
- **Argo Smart Routing**: Reduces latency by 10-30% (requires Business plan)
- **Workers**: Process requests at edge to reduce server load

### Expected Improvements
- **Static Assets**: 50-80% faster load time (cached at edge)
- **Latency**: 10-30% reduction with Argo (if enabled)
- **Bandwidth**: 30-50% reduction (compression + caching)
- **TTFB**: 20-40% improvement (edge caching)

### Current Performance Metrics
- **API Response Time**: ~330ms
- **Frontend Response Time**: ~232ms
- **Latency to Server**: ~105ms (VN → US)

---

## Notes
- **Created**: 2025-10-26
- **Last Updated**: 2025-11-20
- **Purpose**: VPS deployment configuration for Enfyra applications
- **Security**: Keep this file LOCAL only, never commit to git
- **Deployment**:
  - Server: Run `./deploy.sh` from enfyra-page-server repo
  - App: Run `./deploy.sh` from enfyra-page-app repo

## Recent Changes (2025-11-20)
- **Database Migration**:
  - Renamed `enfyra_production` → `enfyra_demo`
  - Created new `enfyra_landing` database for landing page
  - Replaced user `enfyra_app` → `enfyra` with full admin privileges
- **Application Updates**:
  - Directory rename: `/apps/server` → `/apps/demo-server`
  - Directory rename: `/apps/app` → `/apps/demo-app`
  - PM2 process rename: `enfyra-server` → `demo-server`
  - PM2 process rename: `enfyra-app` → `demo-app`
  - Port update: `1105` → `1106` for demo-server
  - Domain update: `api.enfyra.io` → `demo-api.enfyra.io`
