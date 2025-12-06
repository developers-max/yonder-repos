# Google Cloud Run Deployment

This directory contains all files needed to deploy the Yonder Enrichment API to Google Cloud Run.

## 📁 Contents

- **`Dockerfile`** - Container definition for Node.js application
- **`.dockerignore`** - Files to exclude from Docker build context
- **`cloudbuild.yaml`** - Google Cloud Build configuration
- **`deploy.sh`** - Automated deployment script
- **`setup-secrets.sh`** - Secret Manager configuration script
- **`test-docker-build.sh`** - Local Docker testing script
- **`DEPLOYMENT.md`** - Complete deployment guide
- **`DOCKER_CLOUD_RUN_SETUP.md`** - Comprehensive setup documentation

## 🚀 Quick Start

### 1. Setup Secrets (First Time Only)

```bash
./src/api/gcloud_deployment/setup-secrets.sh
```

You'll be prompted for:
- `DATABASE_URL` - PostgreSQL connection string (required)
- `GOOGLE_API_KEY` - Google Gemini API key (optional, for translation)

### 2. Deploy to Cloud Run

```bash
./src/api/gcloud_deployment/deploy.sh
```

This will:
- Build Docker image
- Push to Artifact Registry
- Deploy to Cloud Run
- Configure secrets and environment

### 3. Test Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe yonder-enrich --region=us-central1 --format="value(status.url)")

# Get auth token
TOKEN=$(gcloud auth print-identity-token)

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" $SERVICE_URL/health
```

## 🧪 Local Testing

Test the Docker container locally before deploying:

```bash
./src/api/gcloud_deployment/test-docker-build.sh
```

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Step-by-step deployment guide
- **[DOCKER_CLOUD_RUN_SETUP.md](./DOCKER_CLOUD_RUN_SETUP.md)** - Complete setup overview

## 🔐 Security

- Secrets stored in Google Secret Manager
- IAM authentication required (not publicly accessible)
- No hardcoded credentials
- HTTPS enforced by Cloud Run

## 📊 Configuration

### Resources
- Memory: 2Gi
- CPU: 2 vCPU
- Timeout: 300s (5 minutes)
- Auto-scaling: 0-10 instances

### Secrets (from Secret Manager)
- `yonder-enrich-database-url` (required)
- `yonder-enrich-google-api-key` (optional)

### Environment Variables
- `PORT=8080` (Cloud Run provides)
- `GEMINI_MODEL=gemini-1.5-pro`
- `DGT_OGC_BASE=https://ogcapi.dgterritorio.gov.pt`

## 🔄 Updates

To redeploy after code changes:

```bash
./src/api/gcloud_deployment/deploy.sh
```

To rotate secrets:

```bash
./src/api/gcloud_deployment/setup-secrets.sh
```

## 📖 More Info

See the complete guides in this directory for detailed instructions on:
- Prerequisites
- Testing
- Monitoring
- Troubleshooting
- CI/CD integration
- Cost optimization
