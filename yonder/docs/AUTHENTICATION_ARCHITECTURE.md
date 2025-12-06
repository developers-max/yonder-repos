# Next.js Authentication Architecture

## Overview

This document explains the three-tier authentication architecture in our Next.js App Router application.

---

## 🏗️ Architecture Layers

### 1. `/src/app/api/*` - REST API Routes

**Purpose:** Traditional HTTP endpoints  
**Access:** Can be called by anyone (frontend, external services, webhooks)  
**Authentication:** Manual implementation required  

#### Characteristics:
- Standard REST endpoints (GET, POST, PUT, DELETE)
- Accept HTTP requests from any source
- Return JSON responses
- **Not protected by default** ⚠️

#### Security Implementation:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // 1. Check authentication
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  // 2. Process authenticated request
  const body = await req.json();
  // ... your logic
}
```

#### When to Use:
- ✅ Webhooks from external services
- ✅ Public APIs (with explicit public intent)
- ✅ Third-party integrations
- ✅ Mobile app backends

#### Current Status:
**✅ PROTECTED** - SmartLead API routes now require authentication

---

### 2. `/src/server/api/*` - tRPC Procedures

**Purpose:** Type-safe RPC layer  
**Access:** Frontend only (via tRPC client)  
**Authentication:** Built-in middleware  

#### Characteristics:
- Type-safe end-to-end (TypeScript)
- Automatic serialization/deserialization
- Can only be called from your frontend
- Two procedure types:
  - `publicProcedure` - No auth required
  - `protectedProcedure` - Auth required

#### Security Implementation:

```typescript
// /src/server/api/trpc.ts
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});
```

#### Usage Example:

```typescript
// /src/server/api/router/projects.ts
export const projectsRouter = router({
  // Public endpoint - anyone can call
  getPublicProjects: publicProcedure.query(async () => {
    return await db.projects.findMany({ where: { public: true } });
  }),

  // Protected endpoint - requires login
  getMyProjects: protectedProcedure.query(async ({ ctx }) => {
    // ctx.user is guaranteed to exist
    return await db.projects.findMany({ 
      where: { userId: ctx.user.id } 
    });
  }),
});
```

#### Frontend Usage:

```typescript
// Client component
import { trpc } from '@/lib/trpc';

function MyComponent() {
  const { data } = trpc.projects.getMyProjects.useQuery();
  // Automatically handles auth, type-safe
}
```

#### When to Use:
- ✅ **Primary choice** for internal frontend-backend communication
- ✅ Database queries
- ✅ Business logic
- ✅ User-specific operations
- ✅ Type-safe APIs

#### Current Status:
**✅ PROTECTED** - Uses `protectedProcedure` middleware

---

### 3. `/src/app/(protected)/*` - Protected Pages

**Purpose:** UI pages requiring authentication  
**Access:** Only logged-in users  
**Authentication:** Layout-level guard  

#### Characteristics:
- Next.js route groups for organization
- Server-side authentication before render
- Automatic redirect to login if unauthenticated
- Cannot be bypassed by client

#### Security Implementation:

```typescript
// /src/app/(protected)/layout.tsx
import { requireAuth } from '@/lib/auth-guard';

export default async function ProtectedLayout({ children }) {
  // This runs on the server before page renders
  await requireAuth(); // Redirects to /login if not authenticated
  
  return <div>{children}</div>;
}
```

```typescript
// /src/lib/auth-guard.ts
export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login"); // Server-side redirect
  }

  return session;
}
```

#### How It Works:

1. User navigates to `/chat` (protected page)
2. Server executes layout's `requireAuth()`
3. If no session → `redirect("/login")`
4. If session exists → render page + children
5. Client never sees the protected page without auth

#### Page Structure:

```
/src/app/
├── (protected)/          # Protected pages
│   ├── layout.tsx        # Auth guard applied here
│   ├── chat/
│   │   └── page.tsx      # Protected: requires login
│   ├── projects/
│   │   └── page.tsx      # Protected: requires login
│   └── admin/
│       └── page.tsx      # Protected: requires login
├── (public)/             # Public pages
│   ├── login/
│   │   └── page.tsx      # Public: no auth needed
│   └── signup/
│       └── page.tsx      # Public: no auth needed
```

#### When to Use:
- ✅ Dashboard pages
- ✅ User profile pages
- ✅ Admin panels
- ✅ Any UI requiring login

#### Current Status:
**✅ PROTECTED** - Uses `requireAuth()` in layout

---

## 📊 Comparison Matrix

| Feature | `/src/app/api` | `/src/server` (tRPC) | `/src/app/(protected)` |
|---------|----------------|----------------------|------------------------|
| **Type** | REST API | RPC | UI Pages |
| **Access** | Anyone | Frontend only | Logged-in users |
| **Auth** | Manual | Middleware | Layout guard |
| **Type-safe** | ❌ No | ✅ Yes | N/A |
| **Called by** | HTTP clients | tRPC client | Browser |
| **Use for** | External integrations | Internal APIs | Protected UI |
| **Protected** | ✅ Yes (now) | ✅ Yes | ✅ Yes |

---

## 🔒 Authentication Flow

### User Login Flow:

```
1. User visits /chat (protected page)
2. Layout runs requireAuth()
3. No session found
4. Redirect to /login
5. User enters credentials
6. Auth creates session (cookies)
7. Redirect back to /chat
8. Layout runs requireAuth()
9. Session found ✅
10. Page renders
```

### API Request Flow:

```
Frontend → tRPC Client → tRPC Server
                          ↓
                    protectedProcedure
                          ↓
                    Check session
                          ↓
                    ✅ Session valid
                          ↓
                    Execute query
                          ↓
                    Return data
```

### External API Flow:

```
External Service → POST /api/smartlead/send
                          ↓
                    Check auth header
                          ↓
                    ❌ No session
                          ↓
                    Return 401 Unauthorized
```

---

## 🛡️ Security Best Practices

### 1. Choose the Right Layer

| Scenario | Use |
|----------|-----|
| User dashboard | `/(protected)` pages |
| Fetch user data | tRPC `protectedProcedure` |
| Webhook from Stripe | `/api/*` route (validate webhook signature) |
| Public landing page | `/(public)` pages |

### 2. Never Trust Client Input

```typescript
// ❌ BAD - Trusting client-provided user ID
export const getUser = protectedProcedure
  .input(z.object({ userId: z.string() }))
  .query(async ({ input }) => {
    return db.users.findById(input.userId); // Could access any user!
  });

// ✅ GOOD - Using authenticated user from context
export const getUser = protectedProcedure
  .query(async ({ ctx }) => {
    return db.users.findById(ctx.user.id); // Only their own data
  });
```

### 3. Validate All Inputs

```typescript
// Use Zod for validation
const payloadSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});

export async function POST(req: Request) {
  const body = await req.json();
  const data = payloadSchema.parse(body); // Throws if invalid
  // ... safe to use data
}
```

### 4. Check Organization/Resource Access

```typescript
export const deleteProject = protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Check if user owns this project
    const project = await db.projects.findFirst({
      where: { 
        id: input.projectId,
        userId: ctx.user.id // Ensure they own it
      }
    });
    
    if (!project) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    
    await db.projects.delete({ where: { id: input.projectId } });
  });
```

---

## 🚀 Migration Guide

### If You Have Unprotected API Routes:

**Before:**
```typescript
export async function POST(req: Request) {
  const body = await req.json();
  // ... process request
}
```

**After:**
```typescript
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  // Add auth check
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  // ... process request
}
```

### Consider Moving to tRPC:

If your API route is only called by your frontend, consider moving it to tRPC:

**Before (API Route):**
```typescript
// /src/app/api/projects/route.ts
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response(null, { status: 401 });
  
  const projects = await db.projects.findMany({ 
    where: { userId: session.user.id } 
  });
  
  return Response.json(projects);
}
```

**After (tRPC):**
```typescript
// /src/server/api/router/projects.ts
export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.projects.findMany({ 
      where: { userId: ctx.user.id } 
    });
  }),
});
```

**Frontend usage is simpler:**
```typescript
// Before
const res = await fetch('/api/projects');
const projects = await res.json();

// After (type-safe!)
const { data: projects } = trpc.projects.list.useQuery();
```

---

## 📚 References

- [Next.js Authentication Guide](https://nextjs.org/docs/pages/guides/authentication)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [tRPC Documentation](https://trpc.io/docs)
- [Better Auth](https://www.better-auth.com/) (likely what we're using)

---

## ✅ Summary

- **`/src/app/api`** - REST endpoints, manually protected, for external access
- **`/src/server`** - tRPC procedures, middleware-protected, for internal use (recommended)
- **`/src/app/(protected)`** - UI pages, layout-protected, for logged-in users
- **All three layers are now secured** ✅
- **Prefer tRPC for internal APIs** - it's type-safe and has built-in auth
