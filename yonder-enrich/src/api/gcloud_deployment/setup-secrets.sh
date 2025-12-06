#!/bin/bash

# Setup Google Cloud Secrets for Yonder Enrichment API
# This script creates secrets in Secret Manager for secure deployment

set -e

# Configuration
PROJECT_ID="yonder-477414"
REGION="us-central1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Setting up Google Cloud Secrets for Yonder Enrichment API${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first:${NC}"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the project
echo -e "${YELLOW}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable Secret Manager API
echo -e "${YELLOW}📋 Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    echo -e "${YELLOW}🔐 Creating/updating secret: $secret_name${NC}"
    
    # Check if secret exists
    if gcloud secrets describe $secret_name &>/dev/null; then
        echo -e "${YELLOW}   Secret exists, adding new version...${NC}"
        echo -n "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    else
        echo -e "${YELLOW}   Creating new secret...${NC}"
        echo -n "$secret_value" | gcloud secrets create $secret_name \
            --data-file=- \
            --replication-policy="automatic" \
            --labels="app=yonder-enrich,env=production"
    fi
    
    echo -e "${GREEN}   ✅ Secret $secret_name ready${NC}"
}

# Prompt for secrets (so they're not in bash history or scripts)
echo ""
echo -e "${YELLOW}📝 Please enter your secrets (they will not be displayed):${NC}"
echo ""

# Database URL
echo -e "${YELLOW}Database URL (PostgreSQL connection string):${NC}"
echo -e "${YELLOW}  Example: postgresql://user:password@host:5432/database${NC}"
read -sp "Enter DATABASE_URL: " DATABASE_URL
echo ""

# Google API Key (for Gemini LLM translation)
echo ""
echo -e "${YELLOW}Google API Key (for Gemini - optional for translation feature):${NC}"
echo -e "${YELLOW}  Leave empty to skip if translation not needed${NC}"
read -sp "Enter GOOGLE_API_KEY (or press Enter to skip): " GOOGLE_API_KEY
echo ""

echo ""
echo -e "${YELLOW}🔐 Creating secrets in Secret Manager...${NC}"

# Create required secrets
create_or_update_secret "yonder-enrich-database-url" "$DATABASE_URL" "PostgreSQL database connection string for plot enrichment"

# Create optional secret if provided
if [ -n "$GOOGLE_API_KEY" ]; then
    create_or_update_secret "yonder-enrich-google-api-key" "$GOOGLE_API_KEY" "Google Gemini API key for zoning label translation"
else
    echo -e "${YELLOW}⏭️  Skipping Google API key (translation feature will be disabled)${NC}"
fi

# Grant Cloud Run service account access to secrets
echo ""
echo -e "${YELLOW}🔑 Granting Cloud Run access to secrets...${NC}"

# Get the project number for the Compute Engine default service account
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
COMPUTE_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo -e "${YELLOW}   Granting access to: $COMPUTE_SERVICE_ACCOUNT${NC}"

# Grant access to database URL (required)
gcloud secrets add-iam-policy-binding "yonder-enrich-database-url" \
    --member="serviceAccount:$COMPUTE_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || echo -e "${GREEN}   ✅ Permission already exists${NC}"

# Grant access to Google API key if it was created
if [ -n "$GOOGLE_API_KEY" ]; then
    gcloud secrets add-iam-policy-binding "yonder-enrich-google-api-key" \
        --member="serviceAccount:$COMPUTE_SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet 2>/dev/null || echo -e "${GREEN}   ✅ Permission already exists${NC}"
fi

echo ""
echo -e "${GREEN}✅ All secrets configured successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Created secrets:${NC}"
echo "   - yonder-enrich-database-url (required)"
if [ -n "$GOOGLE_API_KEY" ]; then
    echo "   - yonder-enrich-google-api-key (optional - for translation)"
fi
echo ""
echo -e "${YELLOW}🔍 To view secret names (not values):${NC}"
echo "   gcloud secrets list | grep yonder-enrich"
echo ""
echo -e "${YELLOW}🔍 To view secret versions:${NC}"
echo "   gcloud secrets versions list yonder-enrich-database-url"
echo ""
echo -e "${YELLOW}⚠️  To rotate a secret:${NC}"
echo "   echo -n 'NEW_VALUE' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
echo -e "${YELLOW}📝 Note: If you skipped the Google API key, translation feature will be disabled.${NC}"
echo -e "${YELLOW}   You can add it later by running this script again.${NC}"
echo ""
echo -e "${GREEN}🎉 You can now deploy with: ./src/api/gcloud_deployment/deploy.sh${NC}"
