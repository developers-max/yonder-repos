# Bearer Token Auto-Refresh Configuration

This document explains how the Yonder Agent API client handles bearer token authentication with automatic refresh capabilities.

## Overview

The `yonder-agent-client.ts` supports two authentication modes:

1. **Google Cloud Auth Library (Recommended)** - Automatically refreshes tokens
2. **Manual Bearer Token** - Uses a static token from environment variables

## Authentication Modes

### Mode 1: Google Cloud Auth Library (Auto-Refresh)

**Best for: Production environments, Google Cloud deployments**

#### How it works:
- Uses `google-auth-library` to automatically obtain and refresh tokens
- Tokens are cached and refreshed before expiration
- No manual token management required
- Supports Application Default Credentials (ADC)

#### Configuration:

1. Set the environment variable:
```bash
USE_GCLOUD_AUTH=true
```

2. Configure Google Cloud credentials using one of these methods:

**Option A: Service Account JSON in Environment Variable (Recommended for Production)**
```bash
export GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
```
Best for: Deployment platforms, CI/CD, secret managers

**Option B: Service Account Key File**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```
Best for: Local development with file-based credentials

**Option C: Application Default Credentials (ADC)**
```bash
# Authenticate using gcloud CLI
gcloud auth application-default login
```
Best for: Local development with personal account

**Option D: Automatic (in Google Cloud)**
When running on Google Cloud (Cloud Run, GKE, etc.), credentials are automatically available.

#### Benefits:
- ✅ **Automatic refresh** - Tokens refresh before expiration
- ✅ **No expiration issues** - Continuous authentication
- ✅ **Secure** - No hardcoded tokens
- ✅ **Best practice** - Follows Google Cloud recommendations

---

### Mode 2: Manual Bearer Token

**Best for: Development, testing, or non-Google Cloud environments**

#### How it works:
- Uses a static bearer token from environment variables
- Token does not auto-refresh
- You must manually update the token when it expires

#### Configuration:

```bash
# Do NOT set USE_GCLOUD_AUTH, or set it to false
GCLOUD_TOKEN="your-bearer-token-here"
```

#### Limitations:
- ⚠️ **Manual refresh required** - Token will expire
- ⚠️ **Less secure** - Token stored in environment
- ⚠️ **Maintenance overhead** - Must update manually

---

## Token Refresh Best Practices

Based on industry research and Google Cloud documentation:

### 1. **Token Rotation Pattern**
- Access tokens are short-lived (typically 1 hour)
- The Google Auth Library automatically:
  - Caches tokens in memory
  - Monitors token expiration
  - Requests new tokens before expiration
  - Handles retry logic on failures

### 2. **Security Best Practices**
- ✅ Use service accounts for service-to-service authentication
- ✅ Grant minimum required scopes (principle of least privilege)
- ✅ Never commit credentials to version control
- ✅ Use secret management systems in production (e.g., Google Secret Manager)
- ❌ Avoid storing long-lived tokens in environment variables

### 3. **Error Handling**
The client implements a fallback strategy:
1. Try Google Auth Library (if enabled)
2. Fall back to manual token (if available)
3. Fail gracefully with clear error messages

### 4. **Monitoring**
Log authentication failures to detect:
- Expired credentials
- Permission issues
- Network problems
- Configuration errors

---

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `YONDER_AGENT_API_URL` | Yes | Yonder Agent API endpoint |
| `USE_GCLOUD_AUTH` | No | Set to `true` to enable auto-refresh |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Conditional | Service account JSON as string (Option A) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Conditional | Path to service account key file (Option B) |
| `GCLOUD_TOKEN` | Conditional | Manual bearer token (if using Mode 2) |

---

## Production Deployment Checklist

- [ ] Set `USE_GCLOUD_AUTH=true`
- [ ] Configure service account with appropriate scopes
- [ ] Test authentication in staging environment
- [ ] Set up monitoring for auth failures
- [ ] Remove any hardcoded tokens from environment
- [ ] Document service account permissions

---

## Troubleshooting

### "Failed to get Google Cloud access token"
- Check `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Verify service account has required permissions
- Ensure service account key file is valid JSON
- Try: `gcloud auth application-default login` for local development

### "Authentication failed" (401 Unauthorized)
- Token may be expired (for manual mode)
- Service account may lack required permissions
- Check API endpoint is correct
- Verify token scope includes required permissions

### Token not refreshing
- Confirm `USE_GCLOUD_AUTH=true` is set
- Check logs for error messages
- Verify `google-auth-library` package is installed
- Test with: `gcloud auth application-default print-access-token`

---

## Implementation Details

The automatic refresh is handled by:
```typescript
const client = await googleAuth.getClient();
const accessToken = await client.getAccessToken();
```

This call:
1. Checks if cached token is still valid
2. Returns cached token if valid
3. Requests new token if expired
4. Caches new token for future requests

All of this happens **automatically** - no manual intervention required.

---

## References

- [Google Auth Library for Node.js](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
- [Token Refresh Best Practices](https://authjs.dev/guides/refresh-token-rotation)
- [JWT Authentication Patterns](https://dev.to/wiljeder/secure-authentication-with-jwts-rotating-refresh-tokens-in-express-typescript-5ekh)
