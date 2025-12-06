# Google Cloud Authentication Setup

Quick guide to configure automatic bearer token refresh for Yonder Agent API.

## 🚀 Quick Start (Recommended)

You already have `key.json` at the root! Use this helper script:

```bash
cd /Users/antonis/Documents/github/yonder-repos/yonder-app
./scripts/set-service-account-json.sh
```

This will display the environment variable to add to your `.env` file.

## 📝 Manual Setup

### Step 1: Add to `.env` file

Open `/Users/antonis/Documents/github/yonder-repos/yonder-app/yonder/.env` and add:

```bash
USE_GCLOUD_AUTH=true
GOOGLE_SERVICE_ACCOUNT_JSON='<paste the JSON content from key.json here as a single line>'
```

**Example:**
```bash
USE_GCLOUD_AUTH=true
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"yonder-477414","private_key_id":"4a7097a209a1d4ae9cc825fe715bf383de9a7aaf","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"yonder-agent-client@yonder-477414.iam.gserviceaccount.com",...}'
```

### Step 2: Grant Permissions (if needed)

Your service account needs proper permissions to authenticate:

```bash
# Grant necessary role to the service account
gcloud projects add-iam-policy-binding yonder-477414 \
  --member="serviceAccount:yonder-agent-client@yonder-477414.iam.gserviceaccount.com" \
  --role="roles/YOUR_REQUIRED_ROLE"
```

Common roles:
- `roles/viewer` - Read-only access
- `roles/editor` - Read/write access
- Custom role with specific permissions

### Step 3: Test It

Restart your dev server:

```bash
cd yonder
npm run dev
```

You should see in the logs:
```
[yonder-agent-client] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON
```

## ✅ What You Get

- **Automatic token refresh** - No more expired tokens
- **Secure** - JSON in environment variable, not committed to git
- **Production-ready** - Works with secret managers

## 🔒 Security

- ✅ `key.json` is in `.gitignore` (already added)
- ✅ Never commit credentials to version control
- ✅ Use secret managers in production (AWS Secrets Manager, GCP Secret Manager, etc.)
- ✅ Rotate keys periodically

## 🐛 Troubleshooting

### "Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON"
- Ensure the JSON is valid (no syntax errors)
- Make sure the entire JSON is wrapped in single quotes
- Check that newlines in private key are escaped as `\n`

### "Failed to get Google Cloud access token"
- Verify service account has required permissions
- Check that project ID matches in the JSON
- Ensure the service account is enabled

### Still using manual token?
- Confirm `USE_GCLOUD_AUTH=true` is set
- Check logs for initialization message
- Verify no parsing errors in console

## 📚 More Info

See detailed documentation: `yonder/docs/BEARER_TOKEN_REFRESH.md`
