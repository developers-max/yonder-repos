# Docker & Google Cloud Run Setup - Complete

This document summarizes the Docker containerization and Google Cloud Run deployment setup for the Yonder Enrichment API, following the same pattern as `yonder-agent`.

## ✅ What Was Created

### 1. **Dockerfile** 
Node.js-based container optimized for Cloud Run:
- Base: `node:18-slim`
- Production dependencies only
- Multi-stage for smaller image
- Health check included
- PORT env var support (Cloud Run compatibility)
- Size: ~300-400MB

### 2. **.dockerignore**
Excludes unnecessary files from Docker context:
- `node_modules/`, `dist/`, `.git/`
- Test files and documentation
- Local environment files
- Reduces build time and image size

### 3. **cloudbuild.yaml**
Google Cloud Build configuration:
- Builds Docker image
- Pushes to Artifact Registry
- Deploys to Cloud Run
- Configures secrets from Secret Manager
- Sets resource limits (2Gi RAM, 2 vCPU)
- Timeout: 300s for long enrichments

### 4. **setup-secrets.sh**
Secret Manager configuration script:
- Creates/updates secrets in Secret Manager
- Prompts for: `DATABASE_URL`, `GOOGLE_API_KEY`
- Grants service account access
- Secure: secrets never in code or logs

### 5. **deploy.sh**
Automated deployment script:
- Checks gcloud authentication
- Enables required APIs
- Validates secrets exist
- Creates Artifact Registry repo
- Builds and deploys via Cloud Build
- Provides testing instructions

### 6. **test-docker-build.sh**
Local Docker testing script:
- Builds image locally
- Starts container with .env
- Tests all endpoints
- Shows logs
- Useful before deploying

### 7. **DEPLOYMENT.md**
Comprehensive deployment guide:
- Prerequisites
- Step-by-step instructions
- Testing procedures
- Monitoring & troubleshooting
- Cost optimization
- Security best practices

### 8. **Updated Files**

#### `src/api/server.ts`
- Added PORT env var support for Cloud Run
- Enhanced health endpoint with version info
- Compatible with both local and cloud environments

#### `README.md`
- Added Cloud Deployment section
- Quick deploy instructions
- Links to deployment docs

#### `tsconfig.json`
- Fixed compiler options for proper builds
- Added `allowSyntheticDefaultImports`, `downlevelIteration`

## 📋 Deployment Workflow

### First Time Setup

```bash
# 1. Configure secrets (one-time)
./src/api/gcloud_deployment/setup-secrets.sh
# Enter DATABASE_URL and GOOGLE_API_KEY when prompted

# 2. Deploy to Cloud Run
./src/api/gcloud_deployment/deploy.sh
# Takes ~5-10 minutes
```

### Grant Access

```bash
# Grant access to a user
gcloud run services add-iam-policy-binding yonder-enrich \
  --region=us-central1 \
  --member='user:email@example.com' \
  --role='roles/run.invoker'

# Grant access to service account (for API-to-API)
gcloud run services add-iam-policy-binding yonder-enrich \
  --region=us-central1 \
  --member='serviceAccount:service@project.iam.gserviceaccount.com' \
  --role='roles/run.invoker'
```

### Test Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe yonder-enrich \
  --region=us-central1 --format="value(status.url)")

# Get auth token
TOKEN=$(gcloud auth print-identity-token)

# Test health
curl -H "Authorization: Bearer $TOKEN" $SERVICE_URL/health

# Test enrichment (Lisbon)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":38.7223,"longitude":-9.1393,"store_results":false}' \
  $SERVICE_URL/api/enrich/location | jq '.'
```

### Subsequent Deployments

```bash
# Just run deploy after code changes
./deploy.sh
```

## 🔐 Secrets Management

### Secrets Created

1. **`yonder-enrich-database-url`** (required)
   - PostgreSQL connection string
   - Format: `postgresql://user:pass@host:5432/db`

2. **`yonder-enrich-google-api-key`** (optional)
   - Google Gemini API key
   - For zoning label translation
   - Can be skipped if translation not needed

### Rotating Secrets

```bash
# Re-run setup script
./src/api/gcloud_deployment/setup-secrets.sh

# Or manually
echo -n "NEW_VALUE" | gcloud secrets versions add \
  yonder-enrich-database-url --data-file=-

# Redeploy to use new secrets
./src/api/gcloud_deployment/deploy.sh
```

### Viewing Secrets

```bash
# List all secrets
gcloud secrets list | grep yonder-enrich

# View versions (not values)
gcloud secrets versions list yonder-enrich-database-url
```

## 🐳 Local Docker Testing

### Build and Test Locally

```bash
# 1. Create .env file with secrets
cp .env.example .env
# Edit .env with your actual values

# 2. Run test script
./src/api/gcloud_deployment/test-docker-build.sh
```

This will:
- Build the Docker image
- Start a container on port 3000
- Test all endpoints
- Show logs
- Keep container running for manual testing

### Manual Docker Commands

```bash
# Build image
docker build -t yonder-enrich -f src/api/gcloud_deployment/Dockerfile .

# Run container
docker run -p 3000:8080 \
  -e PORT=8080 \
  --env-file .env \
  yonder-enrich

# View logs
docker logs -f <container_id>

# Stop
docker stop <container_id>
```

## 📊 Cloud Run Configuration

### Resources
- **Memory**: 2Gi (enrichments can be memory-intensive)
- **CPU**: 2 vCPU (parallel enrichments)
- **Timeout**: 300s (5 min for slow external APIs)
- **Min Instances**: 0 (scales to zero when idle)
- **Max Instances**: 10 (auto-scales with load)
- **Concurrency**: 80 requests per instance

### Environment Variables

**From Secret Manager** (sensitive):
- `DATABASE_URL` - PostgreSQL connection
- `GOOGLE_API_KEY` - Gemini API key

**Public** (non-sensitive):
- `PORT` - 8080 (Cloud Run provides)
- `API_PORT` - 8080 (fallback)
- `GEMINI_MODEL` - gemini-1.5-pro
- `DGT_OGC_BASE` - https://ogcapi.dgterritorio.gov.pt

### Networking
- **HTTPS Only**: Enforced by Cloud Run
- **Authentication**: IAM-based (not public)
- **Region**: us-central1
- **URL**: Auto-generated by Cloud Run

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - uses: google-github-actions/setup-gcloud@v1
      
      - name: Deploy
        run: |
          gcloud builds submit \
            --config src/api/gcloud_deployment/cloudbuild.yaml \
            --region us-central1
```

### Automated Deployment

Set up Cloud Build trigger:
1. Go to Cloud Build > Triggers
2. Connect to GitHub repository
3. Create trigger on push to `main` branch
4. Use `cloudbuild.yaml` configuration

## 🆚 Comparison with yonder-agent

| Aspect | yonder-agent | yonder-enrich |
|--------|--------------|---------------|
| **Language** | Python 3.14 | Node.js 18 |
| **Framework** | FastAPI | Express |
| **Package Manager** | Poetry | npm |
| **Base Image** | python:3.14-slim | node:18-slim |
| **Port** | 8080 | 8080 |
| **Secrets** | database-url, openai-api-key | yonder-enrich-database-url, yonder-enrich-google-api-key |
| **Memory** | 2Gi | 2Gi |
| **CPU** | 2 | 2 |
| **Timeout** | 300s | 300s |
| **Authentication** | IAM | IAM |

**Key Similarities:**
- ✅ Same deployment pattern
- ✅ Secret Manager integration
- ✅ Cloud Build for CI/CD
- ✅ IAM authentication (not public)
- ✅ Auto-scaling, scale-to-zero
- ✅ Artifact Registry for images

## 📈 Monitoring

### View Logs

```bash
# Real-time logs
gcloud run services logs read yonder-enrich \
  --region=us-central1 --follow

# Recent logs
gcloud run services logs read yonder-enrich \
  --region=us-central1 --limit=100

# Filter errors
gcloud run services logs read yonder-enrich \
  --region=us-central1 | grep ERROR
```

### Metrics & Dashboard

```bash
# Open Cloud Run console
open "https://console.cloud.google.com/run/detail/us-central1/yonder-enrich?project=yonder-477414"
```

View:
- Request count
- Request latency
- Error rate
- Instance count
- CPU/Memory usage

## 💰 Cost Estimate

Based on:
- 2 vCPU, 2Gi memory
- 100 requests/day
- 30 second average duration
- us-central1 region

**Monthly Cost**: ~$5-15 USD

### Cost Optimization

1. **Scale to zero** when idle (default)
2. **Reduce memory** to 1Gi if sufficient
3. **Reduce CPU** to 1 vCPU if not CPU-bound
4. **Lower timeout** if enrichments are faster
5. **Increase concurrency** to use fewer instances

## 🚨 Troubleshooting

### Build Fails

```bash
# View recent builds
gcloud builds list --region=us-central1 --limit=5

# View build logs
gcloud builds log <BUILD_ID>
```

### Container Won't Start

```bash
# Check service status
gcloud run services describe yonder-enrich --region=us-central1

# View startup logs
gcloud run services logs read yonder-enrich \
  --region=us-central1 --limit=50
```

### Secret Access Issues

```bash
# Verify secret exists
gcloud secrets describe yonder-enrich-database-url

# Check service account has access
gcloud secrets get-iam-policy yonder-enrich-database-url
```

### Database Connection Fails

```bash
# Test from Cloud Shell
gcloud run services update yonder-enrich \
  --region=us-central1 \
  --command="/bin/sh" \
  --args="-c,echo 'Testing connection...'"
```

## ✅ Checklist

- [x] Dockerfile created
- [x] .dockerignore created
- [x] cloudbuild.yaml configured
- [x] setup-secrets.sh script created
- [x] deploy.sh script created
- [x] test-docker-build.sh script created
- [x] DEPLOYMENT.md guide written
- [x] README.md updated with deployment info
- [x] Server updated for Cloud Run PORT env var
- [x] Health endpoint enhanced
- [x] Scripts made executable
- [x] TypeScript config fixed
- [ ] Test local Docker build
- [ ] Setup secrets in GCP
- [ ] Deploy to Cloud Run
- [ ] Test deployed service
- [ ] Grant access to users/services
- [ ] Configure monitoring alerts

## 🎯 Next Steps

1. **Test Locally**
   ```bash
   ./src/api/gcloud_deployment/test-docker-build.sh
   ```

2. **Setup Secrets** (first time only)
   ```bash
   ./src/api/gcloud_deployment/setup-secrets.sh
   ```

3. **Deploy**
   ```bash
   ./src/api/gcloud_deployment/deploy.sh
   ```

4. **Grant Access**
   ```bash
   # Add users or service accounts
   ```

5. **Monitor**
   ```bash
   # Check logs and metrics
   ```

## 📚 Resources

- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **Secret Manager**: https://cloud.google.com/secret-manager/docs
- **Cloud Build**: https://cloud.google.com/build/docs
- **Artifact Registry**: https://cloud.google.com/artifact-registry/docs

---

**Ready to deploy!** Start with `./src/api/gcloud_deployment/setup-secrets.sh` then `./src/api/gcloud_deployment/deploy.sh` 🚀
