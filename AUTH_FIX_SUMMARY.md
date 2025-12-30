# Foreign Key Constraint Fix

## Problem Diagnosis

### Error
```
insert or update on table "projects" violates foreign key constraint "projects_owner_id_fkey"
```

### Root Cause
The `projects.owner_id` column has a foreign key constraint referencing `user_profiles(id)`:
```sql
owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE
```

**The Issue:**
1. When users sign up via Supabase Auth, a record is created in `auth.users` ✅
2. But NO corresponding record is created in `user_profiles` ❌
3. When creating a project, the API uses `user.id` from `auth.users`
4. The foreign key constraint fails because that ID doesn't exist in `user_profiles`

## Solutions Implemented

### Solution 1: API Route Fix (Immediate)
**File:** `/app/api/projects/route.ts`

Added user profile auto-creation in the POST handler:

```typescript
// Ensure user profile exists (fix for foreign key constraint)
const { data: existingProfile } = await supabase
  .from('user_profiles')
  .select('id')
  .eq('id', user.id)
  .single();

if (!existingProfile) {
  console.log('[Projects API] User profile missing, creating for:', user.id);

  // Create user profile if it doesn't exist
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      email: user.email || '',
      role: 'user',
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    });

  if (profileError) {
    console.error('[Projects API] Error creating user profile:', profileError);
    return NextResponse.json(
      { error: 'Error al crear perfil de usuario' },
      { status: 500 }
    );
  }
}
```

**Benefits:**
- ✅ Fixes the immediate issue
- ✅ Works for existing users without profiles
- ✅ Includes detailed logging for debugging

### Solution 2: Database Trigger (Long-term)
**File:** `/supabase/migrations/create_user_profile_trigger.sql`

Created a trigger to automatically create user profiles:

```sql
-- Function to create user_profiles automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.user_profiles (id, email, role, full_name)
SELECT ...
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL;
```

**Benefits:**
- ✅ Automatically creates profiles for all new signups
- ✅ Backfills existing users
- ✅ Prevents the issue from occurring again

## Enhanced Logging

Added comprehensive logging to track the auth flow:

```typescript
// Auth verification
console.log('[Projects API] Authenticated user:', user.id, user.email);

// Profile check
console.log('[Projects API] User profile missing, creating for:', user.id);

// Project creation
console.log('[Projects API] Creating project with owner_id:', user.id);

// Detailed error logging
console.error('[Projects API] Error creating project:', {
  error: projectError,
  code: projectError.code,
  message: projectError.message,
  details: projectError.details,
  hint: projectError.hint,
  owner_id: user.id,
});

// Success
console.log('[Projects API] Project created successfully:', project.id);
```

This will appear in Vercel Function Logs for debugging.

## Deployment Steps

### 1. Deploy Code Changes
```bash
git add app/api/projects/route.ts
git add supabase/migrations/create_user_profile_trigger.sql
git commit -m "Fix: Auto-create user profiles to prevent foreign key constraint errors"
git push
```

### 2. Apply Database Migration
In Supabase SQL Editor, run:
```sql
-- Copy and paste contents of:
-- supabase/migrations/create_user_profile_trigger.sql
```

This will:
- Create the trigger function
- Attach it to auth.users
- Backfill existing users

### 3. Verify Fix

**Test 1: Check existing users have profiles**
```sql
SELECT
  au.id,
  au.email,
  CASE WHEN up.id IS NOT NULL THEN 'Has Profile' ELSE 'Missing Profile' END as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id;
```

Expected: All users should show "Has Profile"

**Test 2: Create a test project**
```bash
# In production, try creating a new project
# Should succeed without foreign key error
```

**Test 3: Check Vercel logs**
```
Look for:
✅ [Projects API] Authenticated user: <uuid> <email>
✅ [Projects API] Creating project with owner_id: <uuid>
✅ [Projects API] Project created successfully: <project-uuid>
```

## Why This Happened

The database schema has:
```sql
CREATE TABLE projects (
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE
);
```

But there was no automatic mechanism to create `user_profiles` records when users signed up in `auth.users`.

## Why It Works Now

### Immediate Fix (API Route)
- Before creating a project, check if user profile exists
- If not, create it automatically
- Then proceed with project creation

### Permanent Fix (Database Trigger)
- When user signs up → trigger fires
- User profile created automatically
- Foreign key constraint satisfied

## Testing Checklist

- [ ] Code changes committed and pushed
- [ ] Vercel deployment completed
- [ ] Database migration applied in Supabase
- [ ] Trigger function exists (`SELECT * FROM pg_proc WHERE proname = 'handle_new_user';`)
- [ ] Trigger attached (`SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`)
- [ ] All existing users have profiles (run SQL query above)
- [ ] New project creation works in production
- [ ] Vercel logs show successful project creation
- [ ] No foreign key errors in logs

## Rollback Plan

If issues occur:

**Remove trigger:**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

**Revert code:**
```bash
git revert HEAD
git push
```

The API route fix will continue to work even without the trigger.
