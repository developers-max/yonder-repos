#!/bin/bash
# Fix Cloud Run IAM permissions for yonder-enrich service

# Replace this with your service account email
SERVICE_ACCOUNT_EMAIL="yonder-agent-client@yonder-477414.iam.gserviceaccount.com"

# Grant Cloud Run Invoker role
gcloud run services add-iam-policy-binding yonder-enrich \
  --region=us-central1 \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.invoker" \
  --project=yonder-477414

echo "✅ IAM binding added successfully!"
echo ""
echo "To verify:"
echo "gcloud run services get-iam-policy yonder-enrich --region=us-central1"
