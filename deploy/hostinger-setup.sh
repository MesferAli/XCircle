#!/bin/bash

#############################################
# Enterprise AI Layer - Hostinger VPS Setup
# الدومين: atlas.xcircle.sa
#############################################

set -e

echo "🚀 بدء إعداد Enterprise AI Layer على Hostinger VPS..."

# ============================================
# 1. تحديث النظام
# ============================================
echo "📦 تحديث النظام..."
sudo apt update && sudo apt upgrade -y

# ============================================
# 2. تثبيت Docker
# ============================================
echo "🐳 تثبيت Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "✅ Docker تم تثبيته"
else
    echo "✅ Docker موجود مسبقاً"
fi

# ============================================
# 3. تثبيت Docker Compose
# ============================================
echo "🔧 تثبيت Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo apt install docker-compose-plugin -y
    echo "✅ Docker Compose تم تثبيته"
else
    echo "✅ Docker Compose موجود مسبقاً"
fi

# ============================================
# 4. تثبيت أدوات إضافية
# ============================================
echo "🛠️ تثبيت أدوات إضافية..."
sudo apt install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    htop \
    git \
    curl \
    wget \
    unzip

# ============================================
# 5. إنشاء مجلد التطبيق
# ============================================
echo "📁 إنشاء مجلد التطبيق..."
sudo mkdir -p /opt/eal
sudo chown $USER:$USER /opt/eal

# ============================================
# 6. تكوين Firewall
# ============================================
echo "🔒 تكوين Firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# ============================================
# 7. تكوين Nginx
# ============================================
echo "🌐 تكوين Nginx..."
sudo tee /etc/nginx/sites-available/atlas.xcircle.sa > /dev/null <<EOF
server {
    listen 80;
    server_name atlas.xcircle.sa;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

sudo ln -sf /etc/nginx/sites-available/atlas.xcircle.sa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx تم تكوينه"

# ============================================
# 8. إنشاء ملف .env
# ============================================
echo "📝 إنشاء ملف .env..."
if [ ! -f /opt/eal/.env ]; then
    cat > /opt/eal/.env <<EOF
# Enterprise AI Layer - Production Environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://eal_user:CHANGE_THIS_PASSWORD@localhost:5432/eal_db

# Redis
REDIS_URL=redis://localhost:6379

# Sentry (اختياري)
SENTRY_DSN=

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# Salla Connector (اختياري)
SALLA_CLIENT_ID=
SALLA_CLIENT_SECRET=

# Zid Connector (اختياري)
ZID_ACCESS_TOKEN=
EOF
    echo "✅ ملف .env تم إنشاؤه - يرجى تحديث كلمات المرور!"
else
    echo "⚠️ ملف .env موجود مسبقاً"
fi

# ============================================
# 9. إنشاء systemd service
# ============================================
echo "⚙️ إنشاء systemd service..."
sudo tee /etc/systemd/system/eal.service > /dev/null <<EOF
[Unit]
Description=Enterprise AI Layer
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/eal
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable eal.service

echo "✅ systemd service تم إنشاؤه"

# ============================================
# النهاية
# ============================================
echo ""
echo "============================================"
echo "✅ تم إعداد Hostinger VPS بنجاح!"
echo "============================================"
echo ""
echo "الخطوات التالية:"
echo "1. انسخ ملفات المشروع إلى /opt/eal/"
echo "2. حدّث ملف /opt/eal/.env بكلمات المرور الصحيحة"
echo "3. شغّل: cd /opt/eal && docker compose up -d"
echo "4. حدّث DNS في Cloudflare بـ IP هذا السيرفر"
echo "5. شغّل: sudo certbot --nginx -d atlas.xcircle.sa"
echo ""
echo "IP السيرفر:"
curl -s ifconfig.me
echo ""
