# Migration to Data Access Layer (DAL) Pattern

**Date:** November 20, 2025  
**Next.js Version:** 16.0.3  
**Reason:** Middleware deprecated in Next.js 16, replaced with recommended DAL pattern

---

## ✅ What Was Changed

### 1. **Deleted Middleware**
- ❌ Removed `/src/middleware.ts`
- Next.js 16 deprecates middleware in favor of proxy.ts or better patterns
- We chose the **Data Access Layer (DAL)** pattern (officially recommended)

### 2. **Created DAL Module**
- ✅ Added `/src/lib/dal.ts`
- Centralized authentication and authorization logic
- Functions:
  - `getSession()` - Get current session (cached per render)
  - `verifySession()` - Verify auth, throw if unauthorized
  - `getCurrentUser()` - Get user or null (optional auth)
  - `verifyPermission(permission)` - Check specific permissions

### 3. **Updated All API Routes**

All protected API routes now use `verifySession()`:

#### ✅ Updated Routes:
- `/api/smartlead/send/route.ts`
- `/api/smartlead/send-per-plot/route.ts`
- `/api/generate-report/route.ts`
- `/api/project-image/route.ts`
- `/api/plot-report-pdf/[plotId]/route.ts`

#### Pattern Used:
```typescript
import { verifySession } from '@/lib/dal';

export async function POST(req: Request) {
  try {
    // Verify authentication using DAL pattern
    await verifySession();
    
    // ... your route logic
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle auth errors
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

### 4. **Updated Auth Guard**
- Updated `/src/lib/auth-guard.ts` to use DAL functions
- Added deprecation notice recommending direct DAL usage
- Existing `requireAuth()` calls in layouts continue to work

---

## 📊 Before vs After

| Aspect | Middleware (Old) | DAL Pattern (New) |
|--------|------------------|-------------------|
| **File** | `/src/middleware.ts` | `/src/lib/dal.ts` |
| **Runs On** | Edge Runtime (limited) | Node.js Runtime (full access) |
| **Auth Check** | Centralized, runs before routes | Per-route, explicit |
| **Database Access** | ❌ Not available on Edge | ✅ Full access |
| **Flexibility** | Low - all or nothing | High - per-route control |
| **Next.js 16 Status** | ⚠️ Deprecated | ⭐ Recommended |
| **Performance** | Slightly faster (Edge) | Slightly slower (DB call) |
| **Maintainability** | Medium | High |
| **Type Safety** | Medium | High |

---

## 🎯 Why DAL Pattern?

### **Next.js 16 Recommendations:**
1. **Middleware/Proxy is discouraged** - should be last resort
2. **Better APIs exist** - Server Components, Server Actions, DAL
3. **More flexible** - auth per route, not global
4. **Better DX** - explicit, type-safe, testable

### **Our Benefits:**
- ✅ Full database access in auth checks
- ✅ Can access session data in routes
- ✅ Easy to add custom authorization logic
- ✅ Works with React cache for deduplication
- ✅ Type-safe with TypeScript
- ✅ Testable functions

---

## 📝 How to Use DAL in New Code

### **In API Routes:**
```typescript
import { verifySession } from '@/lib/dal';

export async function POST(req: Request) {
  const { userId, user } = await verifySession();
  // User is guaranteed to be authenticated here
}
```

### **In Server Components:**
```typescript
import { verifySession, getCurrentUser } from '@/lib/dal';

// Required auth
export default async function ProtectedPage() {
  const { user } = await verifySession();
  return <div>Hello {user.name}</div>;
}

// Optional auth
export default async function OptionalAuthPage() {
  const user = await getCurrentUser();
  if (user) {
    return <div>Hello {user.name}</div>;
  }
  return <div>Please log in</div>;
}
```

### **In Server Actions:**
```typescript
'use server';
import { verifySession } from '@/lib/dal';

export async function deleteProject(projectId: string) {
  const { userId } = await verifySession();
  // Delete project logic
}
```

---

## 🔍 Testing Auth

### **Test Authenticated Request:**
```bash
# Should work with valid session cookie
curl http://localhost:3000/api/smartlead/send \
  -X POST \
  -H "Cookie: better-auth.session_token=..." \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### **Test Unauthenticated Request:**
```bash
# Should return 401 Unauthorized
curl http://localhost:3000/api/smartlead/send \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## 🚀 Next Steps (Optional Enhancements)

### **1. Add Permission Checks:**
```typescript
// In dal.ts
export async function verifyAdmin() {
  const { user } = await verifySession();
  
  if (user.role !== 'admin') {
    throw new Error('Forbidden - Admin access required');
  }
  
  return { user };
}
```

### **2. Add Organization Access Control:**
```typescript
// In dal.ts
export async function verifyOrganizationAccess(orgId: string) {
  const { userId } = await verifySession();
  
  // Check if user is member of organization
  const membership = await db.query.membersTable.findFirst({
    where: (members, { eq, and }) => 
      and(
        eq(members.userId, userId),
        eq(members.organizationId, orgId)
      ),
  });
  
  if (!membership) {
    throw new Error('Forbidden - Not a member of this organization');
  }
  
  return { userId, membership };
}
```

### **3. Add Rate Limiting:**
```typescript
// In dal.ts
export async function verifyRateLimit(userId: string, action: string) {
  // Implement rate limiting logic
  // Throw error if rate limit exceeded
}
```

---

## 📚 References

- [Next.js 16 Authentication Guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Middleware to Proxy Migration](https://nextjs.org/docs/messages/middleware-to-proxy)
- [Better Auth Documentation](https://www.better-auth.com/docs/integrations/next)

---

## ✅ Summary

**Middleware removed ✓**  
**DAL pattern implemented ✓**  
**All API routes protected ✓**  
**Auth guard updated ✓**  
**Ready for Next.js 16 ✓**

The application now follows Next.js 16 best practices with explicit, type-safe authentication using the Data Access Layer pattern.
