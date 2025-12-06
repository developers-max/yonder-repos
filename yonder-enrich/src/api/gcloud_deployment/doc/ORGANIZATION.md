# Deployment Files Organization

All Google Cloud Run deployment files have been organized under `src/api/gcloud_deployment/`.

## 📂 Directory Structure

```
yonder-enrich/
├── src/
│   └── api/
│       ├── gcloud_deployment/          # ← All deployment files here
│       │   ├── .dockerignore           # Docker build exclusions
│       │   ├── Dockerfile              # Container definition
│       │   ├── cloudbuild.yaml         # Cloud Build config
│       │   ├── deploy.sh               # Deployment script
│       │   ├── setup-secrets.sh        # Secret Manager setup
│       │   ├── test-docker-build.sh    # Local Docker testing
│       │   ├── README.md               # Quick reference
│       │   ├── DEPLOYMENT.md           # Complete deployment guide
│       │   └── DOCKER_CLOUD_RUN_SETUP.md # Comprehensive setup docs
│       ├── doc/                        # API documentation
│       ├── examples/                   # API test scripts
│       ├── helpers/                    # Helper modules
│       ├── location-enrichment.ts      # Main enrichment logic
│       └── server.ts                   # Express API server
└── README.md                           # Updated with new paths

```

## ✅ What Changed

### Files Moved
All deployment-related files moved from project root to `src/api/gcloud_deployment/`:
- ✅ `Dockerfile` → `src/api/gcloud_deployment/Dockerfile`
- ✅ `.dockerignore` → `src/api/gcloud_deployment/.dockerignore`
- ✅ `cloudbuild.yaml` → `src/api/gcloud_deployment/cloudbuild.yaml`
- ✅ `deploy.sh` → `src/api/gcloud_deployment/deploy.sh`
- ✅ `setup-secrets.sh` → `src/api/gcloud_deployment/setup-secrets.sh`
- ✅ `test-docker-build.sh` → `src/api/gcloud_deployment/test-docker-build.sh`
- ✅ `DEPLOYMENT.md` → `src/api/gcloud_deployment/DEPLOYMENT.md`
- ✅ `DOCKER_CLOUD_RUN_SETUP.md` → `src/api/gcloud_deployment/DOCKER_CLOUD_RUN_SETUP.md`

### Files Updated
All path references updated to reflect new location:
- ✅ `README.md` - Updated deployment commands
- ✅ `deploy.sh` - Updated script references and build command
- ✅ `setup-secrets.sh` - Updated deploy.sh reference
- ✅ `test-docker-build.sh` - Updated to build from project root
- ✅ `cloudbuild.yaml` - Updated Dockerfile path
- ✅ `DEPLOYMENT.md` - Updated all script paths
- ✅ `DOCKER_CLOUD_RUN_SETUP.md` - Updated all references

### New Files
- ✅ `src/api/gcloud_deployment/README.md` - Quick reference guide

## 🚀 Updated Commands

### From Project Root

```bash
# Setup secrets (first time)
./src/api/gcloud_deployment/setup-secrets.sh

# Deploy to Cloud Run
./src/api/gcloud_deployment/deploy.sh

# Test Docker locally
./src/api/gcloud_deployment/test-docker-build.sh
```

### From Deployment Directory

```bash
cd src/api/gcloud_deployment

# Setup secrets
./setup-secrets.sh

# Deploy
./deploy.sh

# Test
./test-docker-build.sh
```

## 📝 Path Resolution

The scripts handle paths correctly:

1. **`deploy.sh`** - Changes to project root before running `gcloud builds submit`
2. **`test-docker-build.sh`** - Changes to project root before building Docker image
3. **`cloudbuild.yaml`** - References Dockerfile from project root context
4. **`Dockerfile`** - Copies files relative to project root

## 🔗 References

All documentation has been updated with correct paths:
- README.md deployment section
- All script output messages
- GitHub Actions examples
- Manual command examples

## ✨ Benefits

This organization provides:

1. **Clear Separation** - API code separate from deployment config
2. **Easy Navigation** - All deployment files in one location
3. **Consistent Pattern** - Follows common project structure conventions
4. **Maintainability** - Easier to find and update deployment files
5. **Scalability** - Room for future deployment configs (staging, prod, etc.)

## 🎯 Next Steps

Deploy using the new paths:

```bash
# From project root
./src/api/gcloud_deployment/setup-secrets.sh  # First time only
./src/api/gcloud_deployment/deploy.sh
```

All functionality remains the same, just with organized paths! 🚀
