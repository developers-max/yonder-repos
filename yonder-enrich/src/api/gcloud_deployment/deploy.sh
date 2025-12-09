#!/bin/bash

# Google Cloud Run Deployment Script for Yonder Enrichment API
# This script deploys the enrichment API to Google Cloud Run with authentication required
# Uses Secret Manager for sensitive data (best practice)

set -e

# Configuration
PROJECT_ID="yonder-477414"
REGION="us-central1"
SERVICE_NAME="yonder-enrich"
IMAGE_NAME="yonder-enrich"
REQUIRED_SECRETS=("yonder-enrich-database-url")
OPTIONAL_SECRETS=("yonder-enrich-google-api-key")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Google Cloud Run deployment for Yonder Enrichment API${NC}"
echo -e "${YELLOW}🔒 Service will require authentication for access${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first:${NC}"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
echo -e "${YELLOW}📋 Checking GCP authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}🔐 Please log in to Google Cloud:${NC}"
    gcloud auth login
fi

# Set the project
echo -e "${YELLOW}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}📋 Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Check if required secrets exist
echo -e "${YELLOW}🔐 Checking for required secrets in Secret Manager...${NC}"
MISSING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe $secret &>/dev/null; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required secrets:${NC}"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo -e "   - $secret"
    done
    echo ""
    echo -e "${YELLOW}⚠️  Please run './src/api/gcloud_deployment/setup-secrets.sh' first to configure secrets${NC}"
    echo -e "${YELLOW}   This is required for secure deployment (Google best practice)${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All required secrets found${NC}"
fi

# Check optional secrets
echo -e "${YELLOW}📋 Checking optional secrets...${NC}"
for secret in "${OPTIONAL_SECRETS[@]}"; do
    if gcloud secrets describe $secret &>/dev/null; then
        echo -e "${GREEN}   ✅ Found: $secret${NC}"
    else
        echo -e "${YELLOW}   ⏭️  Optional secret not found: $secret (translation feature will be disabled)${NC}"
    fi
done

# Create artifact registry repository if it doesn't exist
echo -e "${YELLOW}📋 Creating/Verifying Artifact Registry repository...${NC}"
gcloud artifacts repositories create $SERVICE_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for Yonder Enrichment API" 2>&1 | grep -v "ALREADY_EXISTS" || echo -e "${GREEN}✅ Repository ready${NC}"

# Deploy using Cloud Build
echo -e "${GREEN}🏗️  Building and deploying with Cloud Build...${NC}"
echo -e "${YELLOW}⏳ This may take several minutes...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the yonder-enrich root (3 levels up from src/api/gcloud_deployment)
YONDER_ENRICH_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
# Get the MONOREPO root (one more level up)
MONOREPO_ROOT="$( cd "$YONDER_ENRICH_ROOT/.." && pwd )"

echo -e "${YELLOW}📁 Building from monorepo root: $MONOREPO_ROOT${NC}"

# Change to monorepo root and run the build
cd "$MONOREPO_ROOT" && gcloud builds submit --config yonder-enrich/src/api/gcloud_deployment/cloudbuild.yaml --region $REGION

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}🔒 Security Configuration:${NC}"
echo -e "   ✅ Authentication required (not publicly accessible)"
echo -e "   ✅ Secrets stored in Secret Manager"
echo -e "   ✅ No hardcoded credentials"
echo ""
echo -e "${YELLOW}📋 To grant access to a user:${NC}"
echo -e "   gcloud run services add-iam-policy-binding $SERVICE_NAME \\"
echo -e "     --region=$REGION \\"
echo -e "     --member='user:EMAIL@DOMAIN.COM' \\"
echo -e "     --role='roles/run.invoker'"
echo ""
echo -e "${YELLOW}📋 To grant access to a service account (for API-to-API calls):${NC}"
echo -e "   gcloud run services add-iam-policy-binding $SERVICE_NAME \\"
echo -e "     --region=$REGION \\"
echo -e "     --member='serviceAccount:SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com' \\"
echo -e "     --role='roles/run.invoker'"
echo ""
echo -e "${YELLOW}📋 To test the service with authentication:${NC}"
echo -e "   # Get an identity token"
echo -e "   TOKEN=\$(gcloud auth print-identity-token)"
echo -e "   "
echo -e "   # Test health endpoint"
echo -e "   curl -H \"Authorization: Bearer \$TOKEN\" ${SERVICE_URL}/health"
echo -e "   "
echo -e "   # Test enrichment endpoint (Lisbon, Portugal)"
echo -e "   curl -X POST -H \"Authorization: Bearer \$TOKEN\" \\"
echo -e "     -H \"Content-Type: application/json\" \\"
echo -e "     -d '{\"latitude\":38.7223,\"longitude\":-9.1393,\"store_results\":false}' \\"
echo -e "     ${SERVICE_URL}/api/enrich/location"
echo ""
echo -e "${YELLOW}📊 View logs:${NC}"
echo -e "   gcloud run services logs read $SERVICE_NAME --region=$REGION --follow"
echo ""
echo -e "${YELLOW}🔐 Manage secrets:${NC}"
echo -e "   # List secrets"
echo -e "   gcloud secrets list | grep yonder-enrich"
echo -e "   "
echo -e "   # Rotate a secret"
echo -e "   ./src/api/gcloud_deployment/setup-secrets.sh"
echo ""
echo -e "${YELLOW}📖 API Documentation (requires authentication):${NC}"
echo -e "   GET  ${SERVICE_URL}/health"
echo -e "   GET  ${SERVICE_URL}/api/enrich/info"
echo -e "   POST ${SERVICE_URL}/api/enrich/location"
echo -e "   GET  ${SERVICE_URL}/api/layers?lat=38.7&lng=-9.1&country=PT"
echo -e "   POST ${SERVICE_URL}/api/layers"
echo ""
echo -e "${GREEN}🎉 Your Yonder Enrichment API is now live and secured on Google Cloud!${NC}"
