# TaxBridge Deployment Guide

**Version:** 1.0.0  
**Last Updated:** February 10, 2026

---

## Prerequisites

- Node.js 20+ (LTS)
- PostgreSQL 15+
- Redis 7+
- Git
- Expo CLI (for mobile)
- EAS CLI (for mobile builds)

---

## Backend Deployment (Render)

### Initial Setup

1. **Create Render Account**
   - Sign up at https://render.com
   - Connect your GitHub repository

2. **Create Web Service**
   - Service Name: `taxbridge-api`
   - Environment: `Node`
   - Build Command: `cd contracts && yarn build && cd ../backend && yarn build`
   - Start Command: `cd backend && node dist/index.js`
   - Instance Type: `Starter` (minimum)

3. **Configure Environment Variables**

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Redis
REDIS_URL=rediss://default:password@host:port

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRATION=24h

# Encryption
TAX_ID_ENCRYPTION_KEY=64-char-hex-string

# Paystack
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_live_xxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxx

# Remita
REMITA_MERCHANT_ID=your-merchant-id
REMITA_API_KEY=your-api-key
REMITA_SERVICE_TYPE_ID=your-service-type

# Digitax (NRS)
DIGITAX_API_KEY=your-api-key
DIGITAX_BASE_URL=https://api.digitax.ng

# FIRS
FIRS_API_KEY=your-api-key
FIRS_TIN=your-tin
FIRS_BASE_URL=https://api.firs.gov.ng

# Youverify
YOUVERIFY_API_KEY=your-api-key
YOUVERIFY_BASE_URL=https://api.youverify.co
YOUVERIFY_SANDBOX=false

# Flutterwave
FLW_PUBLIC_KEY=FLWPUBK-xxx
FLW_SECRET_KEY=FLWSECK-xxx
FLW_SECRET_HASH=your-secret-hash
FLW_ENCRYPTION_KEY=your-encryption-key

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. **Deploy**
   - Push to `master` branch
   - Render auto-deploys on push
   - Monitor build logs in Render dashboard

5. **Verify Deployment**

```bash
# Health check
curl https://taxbridge-api.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-10T...",
  "uptime": 123.45,
  "database": "connected",
  "redis": "connected"
}
```

### Database Migrations

```bash
# SSH into Render shell (or run locally with production DB)
cd backend
npx prisma migrate deploy
```

### Rollback Procedure

1. Go to Render dashboard
2. Navigate to `taxbridge-api` service
3. Click "Deployments" tab
4. Select previous successful deployment
5. Click "Redeploy"

---

## Admin Dashboard Deployment (Vercel)

### Initial Setup

1. **Create Vercel Account**
   - Sign up at https://vercel.com
   - Connect your GitHub repository

2. **Import Project**
   - Select `taxbridge` repository
   - Root Directory: `admin-dashboard`
   - Framework Preset: `Next.js`
   - Build Command: `yarn build`
   - Output Directory: `.next`

3. **Configure Environment Variables**

```bash
# API
NEXT_PUBLIC_API_URL=https://taxbridge-api.onrender.com

# Database (for admin queries)
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true

# NextAuth
NEXTAUTH_URL=https://taxbridge.vercel.app
NEXTAUTH_SECRET=your-secret-key-min-32-chars

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

4. **Deploy**
   - Push to `master` branch
   - Vercel auto-deploys on push
   - Monitor build logs in Vercel dashboard

5. **Verify Deployment**
   - Visit https://taxbridge.vercel.app
   - Check dashboard loads correctly
   - Verify API connectivity

### Custom Domain (Optional)

1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add custom domain (e.g., `admin.taxbridge.ng`)
4. Configure DNS records as instructed
5. Wait for SSL certificate provisioning

### Rollback Procedure

1. Go to Vercel dashboard
2. Navigate to project deployments
3. Select previous successful deployment
4. Click "Promote to Production"

---

## Mobile App Build (EAS)

### Initial Setup

1. **Install EAS CLI**

```bash
npm install -g eas-cli
```

2. **Login to Expo**

```bash
eas login
```

3. **Configure Project**

```bash
cd mobile
eas build:configure
```

### Android Build

1. **Production Build**

```bash
eas build --platform android --profile production
```

2. **Monitor Build**
   - Visit https://expo.dev/accounts/scartony357/projects/taxbridge/builds
   - Wait for build completion (~15-30 minutes)

3. **Download APK/AAB**
   - Download from EAS dashboard
   - Test on physical device before submission

4. **Submit to Play Store**

```bash
eas submit --platform android --profile production
```

### iOS Build

1. **Production Build**

```bash
eas build --platform ios --profile production
```

2. **Monitor Build**
   - Visit EAS dashboard
   - Wait for build completion (~20-40 minutes)

3. **Download IPA**
   - Download from EAS dashboard
   - Test on physical device via TestFlight

4. **Submit to App Store**

```bash
eas submit --platform ios --profile production
```

### Update Over-the-Air (OTA)

```bash
# Publish update to production channel
eas update --branch production --message "Bug fixes and improvements"
```

### Rollback Mobile App

```bash
# Revert to previous version
eas channel:edit production --branch rollback-v0.9.9
```

---

## Environment-Specific Configurations

### Development

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with development credentials
yarn dev

# Admin Dashboard
cd admin-dashboard
cp .env.local.example .env.local
# Edit .env.local with development credentials
yarn dev

# Mobile
cd mobile
cp .env.example .env
# Edit .env with development API URL
yarn start
```

### Staging

```bash
# Backend (Render)
# Create separate service: taxbridge-api-staging
# Use staging database and Redis instance

# Admin (Vercel)
# Create preview deployment
# Configure staging environment variables

# Mobile (EAS)
eas build --platform all --profile preview
```

### Production

- Follow deployment procedures above
- Use production credentials
- Enable monitoring and alerts
- Configure auto-scaling if needed

---

## Post-Deployment Checklist

### Backend

- [ ] Health check endpoint responding
- [ ] Database migrations applied
- [ ] Redis connection verified
- [ ] All integrations tested (Paystack, Remita, etc.)
- [ ] Sentry error tracking active
- [ ] Rate limiting functional
- [ ] CORS configured correctly
- [ ] SSL/TLS certificate valid

### Admin Dashboard

- [ ] Site loads without errors
- [ ] API connectivity verified
- [ ] Authentication working
- [ ] Dashboard metrics displaying
- [ ] Charts rendering correctly
- [ ] Responsive design verified
- [ ] Lighthouse score >90

### Mobile App

- [ ] App installs successfully
- [ ] API connectivity verified
- [ ] Offline mode functional
- [ ] Sync working correctly
- [ ] OCR scanner operational
- [ ] Payment flows tested
- [ ] Push notifications working (if enabled)
- [ ] No crashes on startup

---

## Monitoring & Alerts

### Sentry Setup

1. **Create Sentry Project**
   - Sign up at https://sentry.io
   - Create projects for: backend, admin, mobile

2. **Configure DSN**
   - Add SENTRY_DSN to environment variables
   - Verify error reporting works

3. **Set Up Alerts**
   - Configure email/Slack notifications
   - Set thresholds for error rates
   - Enable performance monitoring

### Uptime Monitoring

1. **Render Health Checks**
   - Configure health check path: `/health`
   - Set check interval: 60 seconds
   - Enable auto-restart on failure

2. **External Monitoring (Optional)**
   - UptimeRobot: https://uptimerobot.com
   - Pingdom: https://pingdom.com
   - Configure alerts for downtime

---

## Troubleshooting

### Backend Issues

**Build Fails**
```bash
# Check Node version
node --version  # Should be 20+

# Clear cache and rebuild
cd backend
rm -rf node_modules dist
yarn install
yarn build
```

**Database Connection Fails**
```bash
# Test connection
psql $DATABASE_URL

# Check Prisma client
cd backend
npx prisma generate
npx prisma db push
```

**Redis Connection Fails**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
# Expected: PONG
```

### Admin Dashboard Issues

**Build Fails**
```bash
# Check Next.js version
cd admin-dashboard
yarn list next

# Clear cache
rm -rf .next node_modules
yarn install
yarn build
```

**API Connection Fails**
- Verify NEXT_PUBLIC_API_URL is correct
- Check CORS configuration in backend
- Verify API is accessible from Vercel

### Mobile App Issues

**EAS Build Fails**
```bash
# Check eas.json configuration
cat eas.json

# Clear Expo cache
expo start -c

# Rebuild
eas build --platform android --profile production --clear-cache
```

**App Crashes on Startup**
- Check Sentry for error logs
- Verify API_URL is correct
- Test on physical device, not just emulator
- Check for missing native dependencies

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate API keys** - Quarterly or after incidents
3. **Enable 2FA** - On all deployment platforms
4. **Monitor access logs** - Review regularly
5. **Keep dependencies updated** - Run `yarn upgrade` monthly
6. **Use HTTPS everywhere** - No HTTP endpoints
7. **Implement rate limiting** - Prevent abuse
8. **Regular security audits** - Quarterly reviews

---

## Support

### Deployment Issues
- **Engineering:** engineering@taxbridge.ng
- **DevOps:** devops@taxbridge.ng

### Platform Support
- **Render:** https://render.com/support
- **Vercel:** https://vercel.com/support
- **Expo:** https://expo.dev/support

---

**Deployment Guide Version:** 1.0.0  
**Last Updated:** February 10, 2026
