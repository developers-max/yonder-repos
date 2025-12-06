# Google Cloud Run Deployment Guide

This guide covers deploying the Yonder Enrichment API to Google Cloud Run with Docker containerization and Secret Manager integration.

## 🏗️ Architecture

- **Container Platform**: Google Cloud Run (fully managed serverless)
- **Container Registry**: Google Artifact Registry
- **Secrets Management**: Google Secret Manager
- **Build System**: Google Cloud Build
- **Authentication**: IAM-based (not publicly accessible)

## 📋 Prerequisites

1. **Google Cloud CLI** installed and configured
   ```bash
   # Install gcloud CLI
   # https://cloud.google.com/sdk/docs/install
   
   # Login
   gcloud auth login
   
   # Set project
   gcloud config set project yonder-477414
   ```

2. **Docker** installed (for local testing)
   ```bash
   docker --version
   ```

3. **Environment Variables** ready:
   - `DATABASE_URL` - PostgreSQL connection string (required)
   - `GOOGLE_API_KEY` - Gemini API key (optional, for translation)

## 🚀 Deployment Steps

### Step 1: Setup Secrets

Run the setup script to configure secrets in Google Secret Manager:

```bash
./src/api/gcloud_deployment/setup-secrets.sh
```

This will prompt you for:
- **DATABASE_URL** (required) - PostgreSQL connection string
- **GOOGLE_API_KEY** (optional) - Gemini API key for translation

Secrets are stored securely in Google Secret Manager and never hardcoded.

### Step 2: Deploy to Cloud Run

Run the deployment script:

```bash
./src/api/gcloud_deployment/deploy.sh
```

This script will:
1. ✅ Verify gcloud authentication
2. ✅ Enable required Google Cloud APIs
3. ✅ Check that secrets exist
4. ✅ Create Artifact Registry repository
5. ✅ Build Docker image with Cloud Build
6. ✅ Deploy to Cloud Run with authentication required
7. ✅ Configure environment variables and secrets

**Deployment takes ~5-10 minutes.**

### Step 3: Grant Access

The service requires authentication by default. Grant access to users or service accounts:

```bash
# Grant access to a user
gcloud run services add-iam-policy-binding yonder-enrich \
  --region=us-central1 \
  --member='user:email@example.com' \
  --role='roles/run.invoker'

# Grant access to a service account (for API-to-API calls)
gcloud run services add-iam-policy-binding yonder-enrich \
  --region=us-central1 \
  --member='serviceAccount:service@project.iam.gserviceaccount.com' \
  --role='roles/run.invoker'
```

## 🧪 Testing

### Local Docker Testing

Test the Docker image locally before deploying:

```bash
# Make sure you have a .env file with your secrets
cp .env.example .env
# Edit .env with your actual values

# Run the test script
./src/api/gcloud_deployment/test-docker-build.sh
```

This will:
- Build the Docker image
- Start a container locally
- Test all API endpoints
- Show logs

The API will be available at `http://localhost:3000`

### Testing Deployed Service

After deployment, test with authentication:

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe yonder-enrich --region=us-central1 --format="value(status.url)")

# Get an identity token
TOKEN=$(gcloud auth print-identity-token)

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" $SERVICE_URL/health

# Test enrichment endpoint (Lisbon, Portugal)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 38.7223,
    "longitude": -9.1393,
    "store_results": false,
    "translate": false
  }' \
  $SERVICE_URL/api/enrich/location | jq '.'
```

## 📊 Monitoring & Logs

### View Logs

```bash
# Stream logs in real-time
gcloud run services logs read yonder-enrich --region=us-central1 --follow

# View recent logs
gcloud run services logs read yonder-enrich --region=us-central1 --limit=50
```

### Check Service Status

```bash
# Get service details
gcloud run services describe yonder-enrich --region=us-central1

# Get service URL
gcloud run services describe yonder-enrich --region=us-central1 --format="value(status.url)"

# List all Cloud Run services
gcloud run services list --region=us-central1
```

### View Metrics

```bash
# Open Cloud Run console
gcloud run services describe yonder-enrich --region=us-central1 --format="value(status.url)" | sed 's|https://||' | xargs -I {} open "https://console.cloud.google.com/run/detail/us-central1/yonder-enrich"
```

## 🔐 Security Best Practices

### ✅ Implemented Security Features

1. **Secret Manager**: All sensitive data stored in Secret Manager
2. **IAM Authentication**: Service requires authentication (not public)
3. **No Hardcoded Secrets**: No credentials in code or Dockerfile
4. **Least Privilege**: Service account has minimal permissions
5. **HTTPS Only**: Cloud Run enforces HTTPS

### Managing Secrets

```bash
# List secrets
gcloud secrets list | grep yonder-enrich

# View secret versions (not values)
gcloud secrets versions list yonder-enrich-database-url

# Add new secret version (rotate)
echo -n "NEW_VALUE" | gcloud secrets versions add yonder-enrich-database-url --data-file=-

# Delete old secret version
gcloud secrets versions destroy VERSION_ID --secret=yonder-enrich-database-url
```

## 🔧 Configuration

### Environment Variables

Configured in `cloudbuild.yaml`:

**Secrets (from Secret Manager):**
- `DATABASE_URL` - PostgreSQL connection (required)
- `GOOGLE_API_KEY` - Gemini API key (optional)

**Public Variables:**
- `API_PORT` - Server port (8080)
- `GEMINI_MODEL` - LLM model (gemini-1.5-pro)
- `DGT_OGC_BASE` - Portugal DGT API base URL

### Resource Configuration

In `cloudbuild.yaml`:
- **Memory**: 2Gi
- **CPU**: 2 vCPU
- **Timeout**: 300s (5 minutes)
- **Min Instances**: 0 (scales to zero)
- **Max Instances**: 10
- **Concurrency**: 80 requests per instance

### Updating Configuration

Edit `cloudbuild.yaml` and redeploy:

```bash
# Edit configuration
nano src/api/gcloud_deployment/cloudbuild.yaml

# Redeploy
./src/api/gcloud_deployment/deploy.sh
```

## 🔄 CI/CD Integration

### Manual Deployment

```bash
./src/api/gcloud_deployment/deploy.sh
```

### Automated Deployment (GitHub Actions Example)

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
          gcloud builds submit --config src/api/gcloud_deployment/cloudbuild.yaml --region us-central1
```

## 📈 Scaling & Performance

### Auto-Scaling

Cloud Run automatically scales based on:
- **Request load**: Adds instances when traffic increases
- **CPU/Memory**: Provisions resources per request
- **Cold start**: ~2-5 seconds for first request

### Optimizations

1. **Min Instances**: Set to 1 to avoid cold starts (costs more)
   ```bash
   gcloud run services update yonder-enrich \
     --region=us-central1 \
     --min-instances=1
   ```

2. **Concurrency**: Increase for more requests per instance
   ```bash
   gcloud run services update yonder-enrich \
     --region=us-central1 \
     --concurrency=100
   ```

3. **Timeout**: Increase for long-running enrichments
   ```bash
   gcloud run services update yonder-enrich \
     --region=us-central1 \
     --timeout=600
   ```

## 💰 Cost Optimization

### Estimated Costs (us-central1)

Based on:
- 2 vCPU, 2Gi memory
- 5 minute timeout
- 100 requests/day
- 30 second average duration

**Monthly Cost**: ~$5-15 USD

### Cost Reduction Tips

1. **Scale to zero**: Keep `min-instances=0` (default)
2. **Reduce memory**: Use 1Gi if sufficient
3. **Reduce timeout**: Set to actual need (default 300s)
4. **Regional choice**: Use cheaper regions if latency allows

```bash
# View cost details
gcloud run services describe yonder-enrich --region=us-central1 --format="value(metadata.labels)"
```

## 🚨 Troubleshooting

### Build Fails

```bash
# Check Cloud Build logs
gcloud builds list --region=us-central1 --limit=5

# View specific build
gcloud builds log BUILD_ID
```

### Deployment Fails

```bash
# Check service status
gcloud run services describe yonder-enrich --region=us-central1

# Check IAM permissions
gcloud projects get-iam-policy yonder-477414
```

### Secret Access Issues

```bash
# Verify secret exists
gcloud secrets describe yonder-enrich-database-url

# Check service account permissions
PROJECT_NUMBER=$(gcloud projects describe yonder-477414 --format="value(projectNumber)")
gcloud secrets get-iam-policy yonder-enrich-database-url
```

### Container Crashes

```bash
# View recent logs
gcloud run services logs read yonder-enrich --region=us-central1 --limit=100

# Check for errors
gcloud run services logs read yonder-enrich --region=us-central1 | grep ERROR
```

### Database Connection Issues

```bash
# Test database connection locally
docker run --rm -e DATABASE_URL="your_url" yonder-enrich-test node -e "const {Pool}=require('pg');new Pool({connectionString:process.env.DATABASE_URL}).query('SELECT NOW()').then(()=>console.log('✅ Connected')).catch(e=>console.error('❌',e))"
```

## 🔗 Useful Links

- **Cloud Run Console**: https://console.cloud.google.com/run?project=yonder-477414
- **Artifact Registry**: https://console.cloud.google.com/artifacts?project=yonder-477414
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager?project=yonder-477414
- **Cloud Build History**: https://console.cloud.google.com/cloud-build/builds?project=yonder-477414
- **Cloud Run Docs**: https://cloud.google.com/run/docs

## 📝 Additional Notes

### Differences from yonder-agent

1. **Language**: Node.js/TypeScript vs Python
2. **Framework**: Express vs FastAPI
3. **Dependencies**: npm vs Poetry
4. **Secrets**: Different naming convention (yonder-enrich-* prefix)
5. **Port**: Same (8080) for Cloud Run compatibility

### Service Integration

To call this API from `yonder-agent`:

```python
import google.auth.transport.requests
import google.oauth2.id_token

# Get identity token
auth_req = google.auth.transport.requests.Request()
target_audience = "https://yonder-enrich-XXXXX-uc.a.run.app"
token = google.oauth2.id_token.fetch_id_token(auth_req, target_audience)

# Call enrichment API
response = requests.post(
    f"{target_audience}/api/enrich/location",
    headers={"Authorization": f"Bearer {token}"},
    json={"latitude": 38.7223, "longitude": -9.1393}
)
```

## ✅ Deployment Checklist

- [ ] gcloud CLI installed and authenticated
- [ ] Secrets configured via `./setup-secrets.sh`
- [ ] Docker image tested locally via `./test-docker-build.sh`
- [ ] Deployed to Cloud Run via `./deploy.sh`
- [ ] IAM permissions granted to users/services
- [ ] Tested authenticated endpoints
- [ ] Monitoring and logging verified
- [ ] Documentation updated

---

**Project**: Yonder Enrichment API  
**Platform**: Google Cloud Run  
**Region**: us-central1  
**Project ID**: yonder-477414
