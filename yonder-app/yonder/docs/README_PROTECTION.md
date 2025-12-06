# API Routes Protection - Middleware Pattern

## ✅ Centralized Protection via Middleware

Similar to how Next.js `(protected)` route groups work for pages, we've implemented **centralized authentication for all API routes** using middleware.

## 🔒 How It Works

### Middleware Configuration
File: `/src/middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public API routes that don't require authentication
  const publicRoutes = [
    '/api/auth',  // Auth endpoints
    '/api/trpc',  // tRPC has its own auth
  ];

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For all other /api/* routes, check authentication
  if (pathname.startsWith('/api/')) {
    const session = await auth.api.getSession({ headers: request.headers });
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### Protected Routes (Automatic)

All routes under `/api/*` are **automatically protected** except those in `publicRoutes`:

✅ **Automatically Protected:**
- `/api/smartlead/send`
- `/api/smartlead/send-per-plot`
- `/api/generate-report`
- `/api/plot-report-pdf/[plotId]`
- `/api/project-image`
- Any future API routes

❌ **Public (Excluded):**
- `/api/auth/*` - Authentication endpoints
- `/api/trpc/*` - tRPC handles its own auth

## 📝 Writing Protected Routes

### Before (Manual Auth):
```typescript
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  // ❌ Manual auth check in every route
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... your logic
}
```

### After (Middleware Protected):
```typescript
// ✅ No auth import needed!
// Route is protected by middleware.ts - no manual auth check needed
export async function POST(req: Request) {
  // ... your logic
  // Middleware guarantees this only runs for authenticated users
}
```

## 🎯 Benefits

### 1. **Less Boilerplate**
- No need to import `auth` in every route
- No repetitive auth checks
- Cleaner, more focused route code

### 2. **Consistent Security**
- Can't forget to add auth to a new route
- Centralized security logic
- Easier to audit

### 3. **Easy to Customize**
- Add public routes in one place
- Apply different auth rules globally
- Log authentication attempts centrally

### 4. **Next.js Convention**
- Similar to `(protected)` page groups
- Familiar pattern for developers
- Framework-native approach

## 🔧 Adding a Public Route

If you need a new **public** API endpoint:

```typescript
// In /src/middleware.ts, add to publicRoutes array:
const publicRoutes = [
  '/api/auth',
  '/api/trpc',
  '/api/webhook',  // ← Add your public route
];
```

## 🔍 Debugging

### Check if Middleware is Running:
```typescript
// Add logging in middleware.ts
export async function middleware(request: NextRequest) {
  console.log('[Middleware] Request:', request.nextUrl.pathname);
  // ... rest of middleware
}
```

### Test Authentication:
```bash
# Should return 401 Unauthorized
curl http://localhost:3000/api/smartlead/send -X POST

# Should work with valid session cookie
curl http://localhost:3000/api/smartlead/send \
  -X POST \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"data":"..."}'
```

## 📊 Architecture

```
Browser Request
    ↓
Next.js Middleware (middleware.ts)
    ↓
├─ /api/auth/*  → Allow (public)
├─ /api/trpc/*  → Allow (tRPC handles auth)
└─ /api/*       → Check Session
    ├─ ✅ Has Session → Continue to Route Handler
    └─ ❌ No Session → Return 401 Unauthorized
```

## ⚖️ Comparison: Middleware vs Route-Level

| Feature | Middleware | Route-Level |
|---------|-----------|-------------|
| **Boilerplate** | ✅ Minimal | ❌ Repetitive |
| **Consistency** | ✅ Automatic | ⚠️ Manual |
| **Granular Control** | ⚠️ Less flexible | ✅ Very flexible |
| **Performance** | ✅ Single check | ⚠️ Multiple checks |
| **Audit** | ✅ One file | ❌ Many files |

## 🚀 Best Practices

### 1. Keep publicRoutes List Small
Only add truly public endpoints. Most routes should be protected.

### 2. Document Public Routes
Add comments explaining why a route is public:
```typescript
const publicRoutes = [
  '/api/auth',     // Auth endpoints - must be public
  '/api/webhook',  // Stripe webhook - verified by signature
];
```

### 3. Use Route-Level Auth for Special Cases
If you need to access the session for authorization logic:
```typescript
export async function GET(req: Request) {
  // Middleware already authenticated, now authorize
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session!.user.id; // Safe - middleware guarantees session exists
  
  // Check if user owns this resource
  const resource = await db.resource.findFirst({
    where: { id: params.id, userId }
  });
  
  if (!resource) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  // ... return resource
}
```

## ✅ Summary

- **All `/api/*` routes are protected by default** via middleware
- **No manual auth checks needed** in individual routes
- **Add exceptions to `publicRoutes`** array in middleware
- **Similar to `(protected)` page convention** but for APIs
- **Cleaner code**, **better security**, **less boilerplate**

---

**Created:** Nov 20, 2025  
**Pattern:** Next.js App Router Middleware Authentication
