# Practice365 — VPS Deployment Guide

Step-by-step instructions for deploying on a self-managed VPS (Ubuntu 22.04+).

---

## 1. Server Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # should show v20.x
npm -v    # should show 10.x

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

## 2. Clone & Configure

```bash
# Create app directory
sudo mkdir -p /var/www/practice365
sudo chown $USER:$USER /var/www/practice365

# Clone your repo (or scp files)
cd /var/www/practice365
git clone <your-repo-url> .

# Create production .env from example
cp .env.production.example server/.env

# Edit with your real values
nano server/.env
```

**Required .env values:**
- `MONGO_URI` — your MongoDB Atlas connection string (or local MongoDB)
- `JWT_SECRET` — generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `APP_URL` — your domain, e.g. `https://practice365.yourdomain.com`
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` — from Stripe dashboard

## 3. Install Dependencies & Build

```bash
# Install server dependencies
cd /var/www/practice365/server
npm install --production

# Install client dependencies and build
cd /var/www/practice365/client
npm install
npm run build

# Create uploads directory
mkdir -p /var/www/practice365/server/uploads

# Create logs directory
mkdir -p /var/www/practice365/logs
```

## 4. Start with PM2

```bash
cd /var/www/practice365

# Start in production mode
pm2 start ecosystem.config.js --env production

# Save PM2 process list (survives reboot)
pm2 save

# Enable PM2 startup on boot
pm2 startup
# Run the command it outputs (sudo env PATH=...)

# Verify it's running
pm2 status
pm2 logs practice365
```

**PM2 commands:**
```bash
pm2 restart practice365    # restart
pm2 stop practice365       # stop
pm2 logs practice365       # view logs
pm2 monit                  # live monitoring
```

## 5. Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/practice365
```

Paste this config:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS (after certbot runs)
    # return 301 https://$server_name$request_uri;

    client_max_body_size 50M;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploaded files
    location /uploads/ {
        alias /var/www/practice365/server/uploads/;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # React frontend (served by Express in production)
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/practice365 /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically. Test with:
sudo certbot renew --dry-run
```

After certbot runs, it updates your Nginx config to handle HTTPS.

## 7. MongoDB

**Option A — MongoDB Atlas (recommended):**
- Create a free cluster at https://cloud.mongodb.com
- Whitelist your VPS IP (or use 0.0.0.0/0 with strong credentials)
- Copy the connection string to `MONGO_URI` in `.env`

**Option B — Self-hosted MongoDB:**
```bash
# Install MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Set MONGO_URI=mongodb://localhost:27017/practice365
```

## 8. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:5000/api/health

# Check PM2
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check logs for errors
pm2 logs practice365 --lines 50
```

Visit `https://yourdomain.com` — you should see the Practice365 login page.

## 9. Updates

```bash
cd /var/www/practice365
git pull origin main

# Rebuild frontend
cd client && npm install && npm run build

# Restart server
cd .. && pm2 restart practice365
```

---

## Local Development

```bash
# Terminal 1 — Server
cd server
npm run dev

# Terminal 2 — Client (with API proxy)
cd client
npm run dev
```

Server runs on `http://localhost:5000`, client on `http://localhost:3000`.
The Vite dev server proxies `/api/*` to the Express server automatically.
