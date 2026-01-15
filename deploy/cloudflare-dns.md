# ☁️ تكوين Cloudflare DNS

## للدومين: atlas.xcircle.sa

---

## 📋 الخطوات

### 1. تسجيل الدخول إلى Cloudflare

اذهب إلى: https://dash.cloudflare.com

### 2. اختيار الدومين

اختر: `xcircle.sa`

### 3. إضافة DNS Record

اذهب إلى: **DNS** → **Records** → **Add record**

#### إعدادات A Record:

| الحقل | القيمة |
|-------|--------|
| **Type** | A |
| **Name** | atlas |
| **IPv4 address** | `YOUR_HOSTINGER_VPS_IP` |
| **Proxy status** | ✅ Proxied (برتقالي) |
| **TTL** | Auto |

### 4. تكوين SSL/TLS

اذهب إلى: **SSL/TLS** → **Overview**

| الإعداد | القيمة |
|---------|--------|
| **Encryption mode** | Full (strict) |

### 5. تكوين Security

اذهب إلى: **Security** → **Settings**

| الإعداد | القيمة |
|---------|--------|
| **Security Level** | Medium |
| **Bot Fight Mode** | ✅ On |
| **Browser Integrity Check** | ✅ On |

### 6. تكوين Page Rules (اختياري)

اذهب إلى: **Rules** → **Page Rules**

#### قاعدة HTTPS:
- **URL**: `http://atlas.xcircle.sa/*`
- **Setting**: Always Use HTTPS

---

## 🔧 التحقق من الإعدادات

### اختبار DNS:
```bash
dig atlas.xcircle.sa
```

### اختبار SSL:
```bash
curl -I https://atlas.xcircle.sa
```

### اختبار الموقع:
```bash
curl https://atlas.xcircle.sa/api/health
```

---

## ⚠️ ملاحظات مهمة

1. **Proxy Status (Proxied):**
   - يخفي IP السيرفر الحقيقي
   - يوفر حماية DDoS
   - يوفر CDN مجاني

2. **SSL Mode (Full Strict):**
   - يتطلب شهادة SSL صالحة على السيرفر
   - استخدم Let's Encrypt على Hostinger

3. **انتظر انتشار DNS:**
   - قد يستغرق 5-30 دقيقة
   - استخدم: https://dnschecker.org

---

## 🔐 إعدادات أمان إضافية

### WAF Rules (اختياري):

1. **Block Bad Bots:**
   - Expression: `(cf.client.bot)`
   - Action: Block

2. **Rate Limiting:**
   - Path: `/api/*`
   - Requests: 100 per minute
   - Action: Block

3. **Country Block (اختياري):**
   - Block countries not needed

---

*آخر تحديث: يناير 2026*
