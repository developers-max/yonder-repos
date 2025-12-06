#!/bin/bash
# Helper script to convert key.json to GOOGLE_SERVICE_ACCOUNT_JSON environment variable

# Check if key.json exists
if [ ! -f "key.json" ]; then
    echo "❌ Error: key.json not found in current directory"
    echo "Please ensure key.json is in the same directory as this script"
    exit 1
fi

# Read and minify the JSON (remove newlines and spaces)
SERVICE_ACCOUNT_JSON=$(cat key.json | tr -d '\n' | tr -s ' ')

# Display the environment variable command
echo "✅ Service account JSON loaded from key.json"
echo ""
echo "Add this to your .env file:"
echo "================================================"
echo "USE_GCLOUD_AUTH=true"
echo "GOOGLE_SERVICE_ACCOUNT_JSON='$SERVICE_ACCOUNT_JSON'"
echo "================================================"
echo ""
echo "Or export it in your current shell:"
echo "================================================"
echo "export USE_GCLOUD_AUTH=true"
echo "export GOOGLE_SERVICE_ACCOUNT_JSON='$SERVICE_ACCOUNT_JSON'"
echo "================================================"
echo ""
echo "⚠️  Security reminder:"
echo "- Never commit key.json to version control"
echo "- Store GOOGLE_SERVICE_ACCOUNT_JSON in a secret manager for production"
echo "- key.json is already in .gitignore"
