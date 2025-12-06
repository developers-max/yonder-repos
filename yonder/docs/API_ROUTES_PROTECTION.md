# API Routes Protection & Architecture Decision

## Decision: Keep Routes in `/src/app/api`, Add Authentication

After analysis, we've decided **NOT to move these routes to `/src/server` (tRPC)** because they handle non-JSON responses and long-running operations that are better suited for Next.js API Route Handlers.

---

## ✅ Protected Routes Status

| Route | Status | Method | Returns | Use Case |
|-------|--------|--------|---------|----------|
| `/api/generate-report` | ✅ Protected | POST | HTML/PDF | Report generation with Puppeteer |
| `/api/plot-report-pdf/[plotId]` | ✅ Protected | GET | PDF Stream | Serve PDFs from GCS |
| `/api/project-image` | ✅ Protected | POST | Image URL | Find images with Gemini AI |
| `/api/smartlead/send` | ✅ Protected | POST | JSON | Send individual emails |
| `/api/smartlead/send-per-plot` | ✅ Protected | POST | JSON | Send campaign emails per plot |

**All API routes are now protected!** 🔒

---

## 📋 Why NOT Move to tRPC?

### Routes Analyzed:

#### 1. `/api/generate-report`
**What it does:** Generates HTML or PDF reports from markdown using Puppeteer

**Why NOT tRPC:**
- ❌ Returns HTML or PDF files (binary), not JSON
- ❌ Uses Puppeteer for PDF generation (long-running, CPU-intensive)
- ❌ Streams large responses

**Best as:** Next.js API Route Handler

#### 2. `/api/plot-report-pdf/[plotId]`
**What it does:** Streams PDF files from Google Cloud Storage

**Why NOT tRPC:**
- ❌ Returns PDF binary stream
- ❌ Needs streaming for large files
- ❌ Uses dynamic route parameters `[plotId]`

**Best as:** Next.js API Route Handler (already protected)

#### 3. `/api/project-image`
**What it does:** Uses Gemini AI + Google Search to find project images

**Why NOT tRPC:**
- ❌ Makes external API calls (Gemini)
- ❌ Fetches and validates remote images
- ❌ Long-running operation (up to 4s timeout)

**Best as:** Next.js API Route Handler

#### 4. `/api/smartlead/*`
**What it does:** Creates SmartLead campaigns and sends emails

**Could be tRPC?** ⚠️ Maybe, but:
- These routes return JSON
- Called only from frontend
- **However:** Complex workflow with external API
- **Decision:** Keep as API routes for now, easier to debug and monitor

---

## 🏗️ Architecture Best Practices

### When to Use API Routes (`/src/app/api`)

✅ **Use API Routes for:**
1. **File operations**
   - Generating PDFs (Puppeteer)
   - Streaming files from storage
   - Image processing

2. **Long-running operations**
   - AI/ML model inference (Gemini, ChatGPT)
   - Large data processing
   - External API integrations

3. **Non-JSON responses**
   - PDFs, images, CSV files
   - HTML content
   - Binary data

4. **External access**
   - Webhooks (Stripe, Twilio)
   - Third-party integrations
   - Public APIs

### When to Use tRPC (`/src/server`)

✅ **Use tRPC for:**
1. **CRUD operations**
   - Database queries
   - User data management
   - Settings updates

2. **Type-safe internal APIs**
   - Frontend-backend communication
   - Complex data fetching
   - Business logic

3. **JSON-only responses**
   - Structured data
   - No file operations
   - Fast responses

---

## 🔒 Protection Implementation

### Authentication Pattern Used:

```typescript
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  // 1. Check authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  // 2. Process authenticated request
  const body = await request.json();
  // ... your logic
}
```

### What This Protects Against:

- ✅ Unauthorized access to report generation
- ✅ Unauthenticated PDF access
- ✅ Gemini API abuse
- ✅ SmartLead campaign creation by non-users

### How It Works:

1. User makes request from frontend
2. Browser includes session cookie
3. `auth.api.getSession()` validates session
4. If valid → proceed with request
5. If invalid → return 401 Unauthorized

---

## 🔄 Alternative: Middleware Protection (Optional)

If you want centralized protection for all API routes, you can create a middleware:

### Create `/src/middleware.ts`:

```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Protect all /api routes except auth
  if (request.nextUrl.pathname.startsWith('/api/') && 
      !request.nextUrl.pathname.startsWith('/api/auth/')) {
    
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
```

### Pros:
- ✅ Centralized authentication
- ✅ Less boilerplate in routes
- ✅ Harder to forget protection

### Cons:
- ❌ Less granular control
- ❌ Harder to create public endpoints
- ❌ May conflict with Next.js auth middleware

**Current approach (route-level auth) is more flexible and explicit.**

---

## 📊 Comparison: Current vs tRPC

### Current Implementation (API Routes):

```typescript
// /src/app/api/generate-report/route.ts
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const input = await request.json();
  const pdf = await generatePDF(input);
  
  return new NextResponse(pdf, {
    headers: { 'Content-Type': 'application/pdf' }
  });
}
```

### If We Moved to tRPC (NOT RECOMMENDED):

```typescript
// /src/server/api/router/reports.ts
export const reportsRouter = router({
  generate: protectedProcedure
    .input(z.object({ /* ... */ }))
    .mutation(async ({ input }) => {
      const pdf = await generatePDF(input);
      // ❌ Problem: How to return binary PDF?
      // ❌ tRPC expects JSON
      // ❌ Would need base64 encoding (inefficient)
      return { pdfBase64: pdf.toString('base64') }; // Bad!
    }),
});
```

**Result:** Inefficient, complex, against tRPC design.

---

## 🎯 Summary

### ✅ What We Did:

1. **Analyzed all routes** - Identified protection status
2. **Added authentication** - Protected unprotected routes
3. **Kept as API routes** - Better suited for their use cases
4. **Documented architecture** - Clear guidelines for future

### ✅ All Routes Now Protected:

- `/api/generate-report` ✅
- `/api/plot-report-pdf/[plotId]` ✅ (already was)
- `/api/project-image` ✅
- `/api/smartlead/send` ✅
- `/api/smartlead/send-per-plot` ✅

### 🚀 Best Practices Applied:

1. **Route-level authentication** - Explicit and flexible
2. **Proper use of API routes** - For file operations & external APIs
3. **tRPC for CRUD** - Use it for database operations
4. **Clear separation** - Different tools for different jobs

---

## 📚 References

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [tRPC Best Practices](https://trpc.io/docs/concepts)
- [When NOT to use tRPC](https://trpc.io/docs/faq#when-should-i-not-use-trpc)

---

## ✅ Conclusion

**Decision: Keep routes in `/src/app/api` with authentication added.**

These routes handle file operations, external APIs, and non-JSON responses - exactly what Next.js API Route Handlers are designed for. Moving them to tRPC would be fighting the framework and create unnecessary complexity.

**All routes are now secure!** 🔒
