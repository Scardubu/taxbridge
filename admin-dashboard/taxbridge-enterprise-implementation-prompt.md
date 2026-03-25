# TaxBridge Enterprise Control Center
## Master Implementation Prompt — v2.2


You are a senior full-stack engineer with full read/write access to the TaxBridge
codebase. Upgrade it into the Enterprise Control Center by following these exact steps.

RULES — read before starting:
  • Complete each step fully before moving to the next.
  • After writing each file, echo its absolute path as confirmation.
  • Where a step says "capture and store", write the value in a comment at the
    top of your working notes so you can reference it later.
  • Never guess a file path — verify with the shell command given.
  • All new source files live under the directory tree defined in Phase 4.
    No new file is created outside that tree except the two config merges and
    the store file.

════════════════════════════════════════════════════════════════════════════════
PHASE 0 — CODEBASE ARCHAEOLOGY & COMPATIBILITY VERIFICATION
Read the repo completely before writing a single byte. Every value stored
here is referenced by name in later phases. Do not skip any sub-step.
════════════════════════════════════════════════════════════════════════════════

── Step 0.1  Full dependency snapshot ─────────────────────────────────────────

  # Print every relevant version in one pass:
  node -e "
    const p = require('./package.json');
    const d = { ...p.dependencies, ...p.devDependencies };
    const keys = [
      'next','react','react-dom','typescript',
      'tailwindcss','framer-motion','zustand',
      '@tanstack/react-query','recharts','cmdk','sonner',
      'clsx','tailwind-merge','class-variance-authority',
      'lucide-react','date-fns','react-error-boundary',
      'next-auth','@clerk/nextjs','@supabase/supabase-js',
      'prisma','drizzle-orm','@radix-ui/react-dialog',
      'class-variance-authority','@next/bundle-analyzer'
    ];
    keys.forEach(k => console.log(k.padEnd(36), d[k] || '—'));
    console.log('');
    console.log('node:', process.version);
    console.log('engines:', JSON.stringify(p.engines ?? {}));
  "

  # Store the following values for use in later steps:
  #   REACT_VERSION   = <e.g. ^18.3.0 or ^19.0.0>
  #   NEXT_VERSION    = <e.g. ^14.2.0 or ^15.1.0>
  #   NODE_VERSION    = <e.g. v20.11.0>
  #   HAS_NEXT_AUTH   = true | false  (next-auth present in deps)
  #   HAS_CLERK       = true | false  (@clerk/nextjs present)
  #   HAS_SUPABASE    = true | false
  #   HAS_PRISMA      = true | false
  #   HAS_ZUSTAND     = true | false  (and version if present)
  #   HAS_TQ          = true | false  (@tanstack/react-query, and major version)

── Step 0.2  React version gate ───────────────────────────────────────────────

  # ALL packages in this prompt require React 18+.
  # framer-motion@11, sonner@1, and zustand@4 do not support React 17.
  node -e "
    const v = require('./node_modules/react/package.json').version;
    const major = parseInt(v.split('.')[0]);
    if (major < 18) {
      console.error('FATAL: React ' + v + ' detected. This prompt requires React ≥ 18.');
      console.error('Upgrade React before continuing: npm install react@18 react-dom@18');
      process.exit(1);
    } else {
      console.log('✓ React ' + v + ' — compatible');
    }
  "
  # If this exits with code 1: STOP. Upgrade React first, then restart from Phase 0.

── Step 0.3  Next.js router type detection ────────────────────────────────────

  ls src/app 2>/dev/null && echo "ROUTER=app" || echo "ROUTER=pages"
  ls src/pages 2>/dev/null && echo "pages/ dir exists" || echo "no pages/ dir"

  # Store as: ROUTER_TYPE = "app" | "pages"
  #
  # ⚠ App Router (src/app/) confirmed by the presence of layout.tsx files.
  # ⚠ If ROUTER_TYPE is "pages": the prompt works but requires these substitutions:
  #     - Replace `import { redirect } from 'next/navigation'`
  #       with `import Router from 'next/router';`
  #       and `Router.replace(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? '/admin');`
  #     - ADMIN_BASE_PATH is derived in Step 0.9 — its value is used throughout
  #     - Replace `export const metadata` page exports with <Head> tags
  #     - next/dynamic works identically — no change needed there

── Step 0.4  Next.js version compatibility matrix ─────────────────────────────

  node -e "
    const v = require('./node_modules/next/package.json').version;
    const [major, minor] = v.split('.').map(Number);
    console.log('Next.js version:', v);
    if (major === 13 && minor < 4) {
      console.warn('⚠ Next.js 13.0–13.3: App Router is experimental. Upgrade to 13.4+.');
    } else if (major === 13) {
      console.log('✓ Next.js 13.4+ — App Router stable');
    } else if (major === 14) {
      console.log('✓ Next.js 14 — fully compatible');
    } else if (major === 15) {
      console.log('✓ Next.js 15 — compatible; transpilePackages may be required (Step 4.3)');
      console.log('  Note: Next.js 15 uses React 19 by default. Confirm React version above.');
    } else {
      console.warn('Unknown Next.js version ' + v + '. Proceed with caution.');
    }
  "

── Step 0.5  Zustand compatibility check ──────────────────────────────────────

  # The store uses `useShallow` from 'zustand/react/shallow'.
  # This import path is only available in zustand >= 4.4.0.
  # If zustand < 4.4 is detected, we install zustand@4 (latest patch) below.
  node -e "
    try {
      const v = require('./node_modules/zustand/package.json').version;
      const [major, minor] = v.split('.').map(Number);
      console.log('zustand version:', v);
      if (major < 4 || (major === 4 && minor < 4)) {
        console.warn('⚠ zustand ' + v + ': useShallow not available at zustand/react/shallow.');
        console.warn('  Will be upgraded to zustand@4 (latest) in Phase 2.');
        console.warn('  Fallback: replace useShallow with a custom shallow-equal selector.');
      } else {
        console.log('✓ zustand ' + v + ' — useShallow compatible');
      }
    } catch { console.log('zustand: NOT INSTALLED — will be installed in Phase 2'); }
  "

  # If zustand IS installed at 4.0–4.3, note the ZUSTAND_FALLBACK flag:
  #   ZUSTAND_FALLBACK = true
  # In this case, replace `import { useShallow } from 'zustand/react/shallow'`
  # with this inline shallow comparator in enterpriseStore.ts:
  #   import { shallow } from 'zustand/shallow';
  #   // Then: useEnterpriseStore(shallow, (s) => ({ ... }))
  # Note: zustand@4 npm install will upgrade to latest 4.x automatically.

── Step 0.6  react-error-boundary version check ───────────────────────────────

  # v3 uses: FallbackComponent prop
  # v4 uses: fallbackRender prop (FallbackComponent still works but deprecated)
  # Our prompt uses FallbackComponent — safe for both v3 and v4.
  node -e "
    try {
      const v = require('./node_modules/react-error-boundary/package.json').version;
      console.log('react-error-boundary:', v, '✓ compatible');
    } catch { console.log('react-error-boundary: NOT INSTALLED — will be installed'); }
  "

── Step 0.7  Existing state management audit ──────────────────────────────────

  # Check for Redux, MobX, Jotai, or Recoil that might conflict with Zustand:
  node -e "
    const p = require('./package.json');
    const d = { ...p.dependencies, ...p.devDependencies };
    const sm = ['redux','@reduxjs/toolkit','react-redux','mobx','jotai','recoil','valtio'];
    const found = sm.filter(k => d[k]);
    if (found.length) {
      console.log('Existing state managers found:', found.join(', '));
      console.log('ACTION REQUIRED: Zustand store name tb-enterprise-v2 is isolated.');
      console.log('No conflict expected — but verify no global Redux DevTools conflict.');
    } else {
      console.log('✓ No conflicting state managers detected');
    }
  "

── Step 0.8  Existing auth provider detection ─────────────────────────────────

  # Detect auth provider so we know what to preserve in ADMIN_ENTRY wrapper:
  node -e "
    const p = require('./package.json');
    const d = { ...p.dependencies, ...p.devDependencies };
    const auth = {
      'next-auth':           'NextAuth.js — SessionProvider wraps pages',
      '@clerk/nextjs':       'Clerk — ClerkProvider or middleware-based',
      '@supabase/supabase-js':'Supabase — client-side or server-side auth',
      '@auth0/nextjs-auth0': 'Auth0 — UserProvider wrapper',
      'firebase':            'Firebase Auth — FirebaseApp + AuthProvider',
    };
    let found = false;
    Object.entries(auth).forEach(([k, desc]) => {
      if (d[k]) { console.log('✓ Auth:', desc); found = true; }
    });
    if (!found) console.log('Auth: Custom or no third-party auth detected.');
    console.log('ACTION: Preserve whichever provider wraps ADMIN_ENTRY — do not remove it.');
  "

  # Store as: AUTH_PROVIDER = <detected name, e.g. "next-auth" or "clerk">

── Step 0.9  Map the full admin directory tree ────────────────────────────────

  find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) \
    | grep -Ev "node_modules|\.next|dist|\.test\.|\.spec\.|\.stories\." \
    | grep -iE "(admin|dashboard)" \
    | sort

  # From this output, identify and store:
  #
  #   ADMIN_DIR    = the parent directory, e.g.:
  #                    src/app/(admin)
  #                    src/app/admin
  #                    src/pages/admin
  #
  #   ADMIN_ENTRY  = the file rendering the top-level admin shell, e.g.:
  #                    src/app/(admin)/dashboard/page.tsx
  #                    src/app/admin/page.tsx
  #                    src/pages/admin/index.tsx
  #
  #   ADMIN_LAYOUT = the layout/wrapper file, e.g.:
  #                    src/app/(admin)/layout.tsx
  #                    src/app/(admin)/dashboard/layout.tsx
  #
  #   ADMIN_LOADING  = loading.tsx if it exists  (do NOT touch this file)
  #   ADMIN_ERROR    = error.tsx if it exists    (do NOT touch this file)
  #   ADMIN_NOT_FOUND= not-found.tsx if present  (do NOT touch this file)
  #
  #   NESTED_ROUTE_FILES = all other page.tsx files under ADMIN_DIR
  #                        (will be redirected in Step 10.3, not deleted)
  #
  # ⚠ The new EnterpriseApp handles ALL sub-navigation internally via Zustand.
  #   Zero new URL routes are created. Users navigating to /admin/sync directly
  #   will be silently redirected to /admin.

  # Derive the canonical admin base path for use in Steps 11.4, 14.3, and Lighthouse:
  # Strips src/app, route group parentheses, and the /page.tsx suffix.
  # Examples:
  #   src/app/(admin)/dashboard/page.tsx  →  /admin/dashboard
  #   src/app/admin/page.tsx              →  /admin
  #   src/pages/admin/index.tsx           →  /admin
  ADMIN_BASE_PATH=$(echo "$ADMIN_ENTRY" \
    | sed 's|src/app||; s|src/pages||' \
    | sed 's|/([^)]*)||g' \
    | sed 's|/page\.tsx$||; s|/index\.tsx$||' \
    | sed 's|//|/|g; s|/$||')
  [ -z "$ADMIN_BASE_PATH" ] && ADMIN_BASE_PATH="/admin"
  echo "ADMIN_BASE_PATH: $ADMIN_BASE_PATH"
  # Store as: ADMIN_BASE_PATH = <value printed above, e.g. /admin or /admin/dashboard>

── Step 0.10  Full component import audit ─────────────────────────────────────

  # Find all old admin components that will be superseded:
  grep -rn "^import" src/components \
    --include="*.tsx" --include="*.ts" \
    | grep -v "admin-dashboard" \
    | grep -iE "(Sidebar|Navbar|Header|Dashboard|AdminLayout|AdminShell|Overview|DashboardNav)" \
    | awk -F: '{print $1}' \
    | sort -u

  # Also check for any store files that might conflict:
  find src/store src/stores src/state src/context \
    -name "*.ts" -o -name "*.tsx" 2>/dev/null | sort
  # If any of these contain: adminStore, dashboardStore, uiStore —
  # verify their persisted key names don't clash with 'tb-enterprise-v2'

  # Store: OLD_COMPONENT_FILES = <list from above>

── Step 0.11  Locate config files ─────────────────────────────────────────────

  # Tailwind config (could be .ts, .js, or .cjs):
  ls tailwind.config.ts tailwind.config.js tailwind.config.cjs 2>/dev/null
  # Store as: TAILWIND_CONFIG = <exact filename>

  # Check Tailwind version — v3 vs v4 have different config syntax:
  node -e "const v=require('./node_modules/tailwindcss/package.json').version; console.log('tailwindcss:', v); if(parseInt(v)>=4) console.warn('⚠ Tailwind v4 detected: config syntax is different. See Step 2.3 note.');"

  # Global CSS entry point:
  find src -name "globals.css" -o -name "index.css" 2>/dev/null \
    | grep -v node_modules | head -3
  # Store as: CSS_ENTRY = <exact path, e.g. src/app/globals.css>

  # TypeScript path alias:
  node -e "const t=require('./tsconfig.json'); const paths=t.compilerOptions?.paths||{}; console.log('paths:', JSON.stringify(paths,null,2));"
  # Store as: PATH_ALIAS = the alias prefix, e.g. "@" or "~"
  # All imports in this prompt use "@/..." — substitute globally if yours differs.

  # Check next.config location and existing configuration:
  ls next.config.js next.config.ts next.config.mjs 2>/dev/null
  cat next.config.js 2>/dev/null || cat next.config.ts 2>/dev/null || cat next.config.mjs 2>/dev/null
  # Store: NEXT_CONFIG_FILE = <exact filename>
  # Note if it already uses: withBundleAnalyzer, transpilePackages, or experimental flags

── Step 0.12  CSS custom property collision check ─────────────────────────────

  grep -n "^  --" "$CSS_ENTRY" 2>/dev/null \
    | grep -v "^.*--tb-" \
    | sort
  # If CSS_ENTRY is unset above, run:
  #   grep -n "^  --" src/app/globals.css 2>/dev/null || grep -n "^  --" src/index.css 2>/dev/null

  # If ANY line contains --tb- in your existing CSS, rename it before proceeding:
  #   sed -i 's/var(--tb-/var(--tb-legacy-/g; s/--tb-/--tb-legacy-/g' "$CSS_ENTRY"
  #   Verify: grep -n "\-\-tb-" "$CSS_ENTRY"  — should show zero results.

── Step 0.13  Verify git state ────────────────────────────────────────────────

  git status --short
  git branch --show-current

  # Required before proceeding:
  #   [ ] Working tree is clean OR changes are stashed
  #   [ ] You are on your integration branch (main / master / develop)
  #
  # If dirty: git stash push -m "pre-enterprise-upgrade $(date +%Y%m%d-%H%M)"
  # Store: BASE_BRANCH = <current branch name, e.g. master>
  # Store: STASHED = true | false  (to know whether to pop stash after Phase 16)

── Step 0.14  Verify Vercel project linkage ───────────────────────────────────

  # Install Vercel CLI if missing:
  vercel --version 2>/dev/null || npm install -g vercel@latest

  vercel whoami                                        # Must show your username
  cat .vercel/project.json 2>/dev/null || echo "NOT LINKED"

  # If NOT LINKED: vercel link --yes
  # After linking, confirm .vercel/project.json contains orgId and projectId.

  # Match production branch:
  #   Vercel dashboard → Project → Settings → Git → Production Branch
  # Store: VERCEL_PROD_BRANCH = <e.g. master>
  # ⚠ BASE_BRANCH must equal VERCEL_PROD_BRANCH for auto-deploy on merge.
  #   If they differ, contact the project owner to align them before continuing.

── Step 0.15  Verify GitHub CLI ───────────────────────────────────────────────

  gh --version 2>/dev/null || (brew install gh 2>/dev/null || apt install gh -y 2>/dev/null)
  gh auth status    # Must show: "✓ Logged in to github.com as <username>"
  gh repo view --json nameWithOwner -q .nameWithOwner
  # Store: REPO_SLUG = <e.g. Scardubu/taxbridge>

  # Confirm you have write access:
  gh repo view --json viewerPermission -q .viewerPermission
  # Must show: ADMIN or WRITE  (not READ — PRs require write access)

════════════════════════════════════════════════════════════════════════════════
PHASE 1 — BRANCH CREATION
Create the feature branch before writing any code.
════════════════════════════════════════════════════════════════════════════════

── Step 1.1  Create and push feature branch ───────────────────────────────────

  git checkout -b feature/enterprise-control-center
  git push --set-upstream origin feature/enterprise-control-center

  # All subsequent work happens on this branch.
  # Verify: git branch --show-current → should print "feature/enterprise-control-center"

════════════════════════════════════════════════════════════════════════════════
PHASE 2 — FOUNDATION: PACKAGES, FONTS, TOKENS, UTILITIES
════════════════════════════════════════════════════════════════════════════════

── Step 2.1  Version-guarded package installation ─────────────────────────────

  # ── A: Print what's already installed ──────────────────────────────────────
  node -e "
    const p = require('./package.json');
    const d = { ...p.dependencies, ...p.devDependencies };
    const targets = {
      'framer-motion':            '11',
      '@tanstack/react-query':    '5',
      'zustand':                  '4',
      'recharts':                 '2',
      'cmdk':                     '1',
      'sonner':                   '1',
      'clsx':                     '*',
      'tailwind-merge':           '*',
      'class-variance-authority': '*',
      'lucide-react':             '*',
      'date-fns':                 '3',
      'react-error-boundary':     '*',
      '@next/bundle-analyzer':    '*',
    };
    Object.entries(targets).forEach(([k, want]) => {
      const have = d[k];
      const status = !have ? 'MISSING — will install'
        : want === '*'     ? '✓ present: ' + have
        : parseInt(have?.replace(/[^0-9]/,'')) === parseInt(want)
          ? '✓ correct major: ' + have
          : '⚠ WRONG MAJOR — have ' + have + ', want ^' + want;
      console.log(k.padEnd(32), status);
    });
  "

  # ── B: Install / upgrade packages ──────────────────────────────────────────
  # Run this command as-is. npm will skip packages already at the correct version.
  npm install \
    framer-motion@11 \
    @tanstack/react-query@5 \
    zustand@4 \
    recharts@2 \
    cmdk@1 \
    sonner@1 \
    clsx \
    tailwind-merge \
    class-variance-authority \
    lucide-react \
    date-fns@3 \
    react-error-boundary \
    @radix-ui/react-scroll-area \
    @radix-ui/react-progress

  npm install --save-dev @next/bundle-analyzer

  # ── C: Verify zero peer-dependency errors ──────────────────────────────────
  npm ls --depth=0 2>&1 | grep -E "UNMET|ERR|peer" | head -20
  # If any UNMET PEER errors appear involving React version, run:
  #   npm install --legacy-peer-deps
  # This is safe — it only relaxes peer dep resolution, doesn't change behavior.

  # ── D: Tailwind v4 special handling ────────────────────────────────────────
  # If TAILWIND_CONFIG is a v4 project (tailwindcss >= 4.0), the config format
  # is CSS-first, not JS-first. The Step 2.3 token merge instructions apply to
  # tailwind.config.ts (v3). For v4 projects:
  #   - Skip Step 2.3 entirely
  #   - Instead, add the new tokens as @theme rules in CSS_ENTRY:
  #     @theme {
  #       --color-brand-500: #3b82f6;
  #       --color-success: #10b981;
  #       ... (translate all color tokens to CSS @theme syntax)
  #     }
  #   - Replace all Tailwind class references in this prompt that use
  #     custom colors (brand-500, success, danger, etc.) with the
  #     equivalent CSS variable: bg-[var(--color-brand-500)]
  node -e "
    const v = require('./node_modules/tailwindcss/package.json').version;
    if (parseInt(v) >= 4) {
      console.warn('⚠ Tailwind v4 detected (' + v + ')');
      console.warn('  SKIP Step 2.3. Follow the v4 @theme instructions in Step 2.3 instead.');
    } else {
      console.log('✓ Tailwind v3 (' + v + ') — Step 2.3 applies as written');
    }
  "

  # ── E: @tanstack/react-query v5 migration note ─────────────────────────────
  # If your existing codebase uses react-query v4, it may have:
  #   useQuery({ onSuccess, onError }) callbacks — removed in v5
  #   useInfiniteQuery with different return shape
  # The EnterpriseApp does NOT call useQuery in its initial implementation
  # (all data is mocked). This means v5 ONLY breaks your existing hooks,
  # not our new code. Check BEFORE installing:
  node -e "
    const p = require('./package.json');
    const d = { ...p.dependencies, ...p.devDependencies };
    const tq = d['@tanstack/react-query'] || d['react-query'];
    if (tq && parseInt(tq.replace(/[^0-9]/,'')) < 5) {
      console.warn('⚠ Existing TanStack Query ' + tq + ' will be upgraded to v5.');
      console.warn('  AUDIT your existing useQuery calls for onSuccess/onError callbacks.');
      console.warn('  Run: grep -rn \"onSuccess\\|onError\" src/ --include=\"*.tsx\" --include=\"*.ts\"');
      console.warn('  Replace each: https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5');
    } else if (!tq) {
      console.log('✓ No existing TanStack Query — fresh install, no migration needed');
    } else {
      console.log('✓ TanStack Query v5 already installed');
    }
  "
  # ⚠ CRITICAL: If you have existing onSuccess/onError callbacks in useQuery,
  #   migrate them BEFORE running npm install in this step.
  #   The upgrade is safe to defer — install with --legacy-peer-deps if needed.

── Step 2.2  Add Inter font via next/font (SSR-safe, zero layout shift) ────────

  # Open: src/app/layout.tsx  (App Router)
  # OR:   src/pages/_app.tsx  (Pages Router)
  #
  # ⚠ Exact export name from next/font/google must be verified:
  #   JetBrains Mono → exported as JetBrains_Mono (underscore, not space)
  #   This is the documented name. If your TypeScript shows a type error,
  #   run: node -e "console.log(Object.keys(require('next/font/google')))" | grep -i jet
  #   to confirm the exact identifier.
  #
  # ADD these imports at the top of the imports section:
  #   import { Inter, JetBrains_Mono } from 'next/font/google';
  #
  # ADD these constants AFTER imports, BEFORE the component:
  #   const inter = Inter({
  #     subsets: ['latin'],
  #     variable: '--font-inter',
  #     display: 'swap',
  #     preload: true,
  #   });
  #   const jetbrainsMono = JetBrains_Mono({
  #     subsets: ['latin'],
  #     variable: '--font-mono',
  #     weight: ['400', '500'],
  #     display: 'swap',
  #     preload: false,   // mono font — only load when needed
  #   });
  #
  # ADD the variables to the <html> or <body> className:
  #   className={`${inter.variable} ${jetbrainsMono.variable} <existing classes>`}
  #
  # IMPORTANT: Only modify the className prop. Preserve all existing providers,
  # metadata exports, and children rendering exactly as-is.

── Step 2.3  Merge Tailwind config tokens ─────────────────────────────────────

  # ── Tailwind v3 (tailwind.config.ts or .js) ────────────────────────────────
  # Open TAILWIND_CONFIG. MERGE theme.extend (do not replace existing keys).
  # Add `darkMode: 'class'` at root level if not already present.
  #
  # ── Tailwind v4 note ───────────────────────────────────────────────────────
  # IF Tailwind v4 was detected in Step 2.1D: SKIP the JS config below.
  # Instead, open CSS_ENTRY and add this @theme block AFTER the :root block
  # you will add in Step 2.4 (the two blocks live side-by-side):
  #
  #   @theme {
  #     --color-brand-50:   #eff6ff;
  #     --color-brand-100:  #dbeafe;
  #     --color-brand-500:  #3b82f6;
  #     --color-brand-600:  #2563eb;
  #     --color-brand-700:  #1d4ed8;
  #     --color-brand-950:  #172554;
  #     --color-success:    #10b981;
  #     --color-warning:    #f59e0b;
  #     --color-danger:     #ef4444;
  #     --color-info:       #06b6d4;
  #     --shadow-card:      0 1px 3px 0 rgb(0 0 0/0.08), 0 1px 2px -1px rgb(0 0 0/0.06);
  #     --shadow-card-lg:   0 4px 12px 0 rgb(0 0 0/0.10), 0 2px 4px -2px rgb(0 0 0/0.08);
  #     --shadow-popover:   0 10px 38px -10px rgb(0 0 0/0.22), 0 10px 20px -15px rgb(0 0 0/0.16);
  #   }
  #
  # Then in all component files, replace e.g. `bg-brand-500` with `bg-[--color-brand-500]`
  # and `text-success` with `text-[--color-success]`.
  # ──────────────────────────────────────────────────────────────────────────
  #
  # Tailwind v3 — merge into theme.extend:

  fontFamily: {
    sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
    mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
  },
  colors: {
    brand: {
      50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
    },
    success: { DEFAULT: '#10b981', light: '#d1fae5', dark: '#065f46' },
    warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#92400e' },
    danger:  { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#991b1b' },
    info:    { DEFAULT: '#06b6d4', light: '#cffafe', dark: '#164e63' },
  },
  boxShadow: {
    'card':         '0 1px 3px 0 rgb(0 0 0/0.08), 0 1px 2px -1px rgb(0 0 0/0.06)',
    'card-lg':      '0 4px 12px 0 rgb(0 0 0/0.10), 0 2px 4px -2px rgb(0 0 0/0.08)',
    'popover':      '0 10px 38px -10px rgb(0 0 0/0.22), 0 10px 20px -15px rgb(0 0 0/0.16)',
    'glow-brand':   '0 0 0 3px rgb(59 130 246 / 0.35)',
    'glow-success': '0 0 0 3px rgb(16 185 129 / 0.30)',
  },
  animation: {
    'fade-in':   'tbFadeIn 0.2s ease-out both',
    'slide-up':  'tbSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
    'pulse-dot': 'tbPulseDot 2s cubic-bezier(0.4,0,0.6,1) infinite',
    'shimmer':   'tbShimmer 2s linear infinite',
  },
  keyframes: {
    tbFadeIn:   { from:{ opacity:'0' },                              to:{ opacity:'1' }},
    tbSlideUp:  { from:{ opacity:'0', transform:'translateY(8px)' }, to:{ opacity:'1', transform:'translateY(0)' }},
    tbPulseDot: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'0.4' }},
    tbShimmer:  { from:{ backgroundPosition:'-200% 0' },            to:{ backgroundPosition:'200% 0' }},
  },

── Step 2.4  Prepend CSS design tokens ────────────────────────────────────────

  # PREPEND the following to CSS_ENTRY — before any existing rules.
  # Do NOT remove anything already in the file.
  # Note: No @import for fonts — that is handled by next/font in Step 2.2.

  /* ═══════════════════════════════════════════════════
     TaxBridge Enterprise — Design System Tokens v2.0
     Prefixed --tb- to avoid collisions with existing vars
     ═══════════════════════════════════════════════════ */

  :root {
    /* Surfaces */
    --tb-surface-0:  #ffffff;   /* cards, modals, popovers         */
    --tb-surface-1:  #f8fafc;   /* page background                  */
    --tb-surface-2:  #f1f5f9;   /* input backgrounds, hover states  */
    --tb-surface-3:  #e2e8f0;   /* pressed states, dividers         */
    --tb-border:     #e2e8f0;   /* all borders                      */

    /* Text hierarchy */
    --tb-text-1:     #0f172a;   /* headings, primary content        */
    --tb-text-2:     #475569;   /* body text, secondary             */
    --tb-text-3:     #64748b;   /* labels, placeholders, muted      */

    /* Layout dimensions */
    --tb-sidebar-w:            240px;
    --tb-sidebar-collapsed-w:  60px;
    --tb-topbar-h:             60px;
  }

  .dark {
    --tb-surface-0:  #0a0e1a;
    --tb-surface-1:  #0f1629;
    --tb-surface-2:  #162032;
    --tb-surface-3:  #1e2d42;
    --tb-border:     #1e2d42;
    --tb-text-1:     #f1f5f9;
    --tb-text-2:     #94a3b8;
    --tb-text-3:     #64748b;
  }

  /* Smooth theme transitions — only color/border, never layout */
  *, *::before, *::after {
    transition: background-color 0.15s ease, border-color 0.15s ease,
                color 0.1s ease;
  }
  /* Disable transitions during programmatic class toggling */
  html.tb-theme-switching,
  html.tb-theme-switching * {
    transition: none !important;
  }

── Step 2.5  Create or merge src/lib/utils.ts ─────────────────────────────────

  # If this file already exists: MERGE the new exports — never overwrite.
  # If it does not exist: create it.

  import { type ClassValue, clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  /** Tailwind class merge utility */
  export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
  }

  /** Format a number as USD currency, with optional compact notation */
  export function formatCurrency(n: number, compact = false): string {
    if (compact && n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (compact && n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);
  }

  /** Format a number with thousand separators */
  export function formatNumber(n: number): string {
    return new Intl.NumberFormat('en-US').format(n);
  }

  /** Relative time string — "2 min ago", "3 hours ago" */
  export function timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - date.getTime()) / 1_000);
    if (secs < 60)    return 'just now';
    if (secs < 3_600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86_400)return `${Math.floor(secs / 3_600)}h ago`;
    return `${Math.floor(secs / 86_400)}d ago`;
  }

  /** Clamp a number between min and max */
  export function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
  }

════════════════════════════════════════════════════════════════════════════════
PHASE 3 — GLOBAL STATE STORE
One file. Additive only — never modifies existing store files.
════════════════════════════════════════════════════════════════════════════════

── Step 3.1  Create src/store/enterpriseStore.ts ──────────────────────────────

  # This is a brand-new file. If a file called enterpriseStore.ts already exists,
  # rename the existing one to enterpriseStore.legacy.ts first:
  #   mv src/store/enterpriseStore.ts src/store/enterpriseStore.legacy.ts
  #
  # ⚠ Important: Do NOT add 'use client' to this file.
  #   Zustand stores are plain TypeScript modules, not React components.
  #   Adding 'use client' to a .ts file causes Next.js build warnings
  #   and prevents the store from being imported in Server Components.
  #   Client components that import from this store get the 'use client'
  #   boundary from their own file directive.

import { create } from 'zustand';
import { persist, devtools, subscribeWithSelector } from 'zustand/middleware';

/* ── Tab identifiers ─────────────────────────────────────────────────────── */
export type TabId =
  | 'overview'
  | 'systems'
  | 'sync'
  | 'team'
  | 'compliance'
  | 'billing'
  | 'intelligence';

export type Theme = 'light' | 'dark' | 'system';

/* ── Onboarding state ────────────────────────────────────────────────────── */
export interface OnboardingState {
  isFirstVisit:   boolean;
  currentStep:    0 | 1 | 2 | 3; // 3 = complete
  completedSteps: number[];
  skippedToLive:  boolean;
  startedAt:      number | null;  // unix ms, for analytics
}

/* ── In-app notification ─────────────────────────────────────────────────── */
export interface AppNotification {
  id:    string;
  type:  'info' | 'success' | 'warning' | 'error';
  title: string;
  body:  string;
  ts:    number;
  read:  boolean;
}

/* ── Full store interface ────────────────────────────────────────────────── */
interface EnterpriseStore {
  // Theme
  theme:            Theme;
  resolvedTheme:    'light' | 'dark';
  setTheme:         (t: Theme) => void;
  setResolvedTheme: (t: 'light' | 'dark') => void;

  // Sidebar
  sidebarCollapsed:    boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar:       () => void;

  // Navigation
  activeTab:    TabId;
  previousTab:  TabId | null;
  setActiveTab: (tab: TabId) => void;

  // Command bar
  commandBarOpen:    boolean;
  setCommandBarOpen: (v: boolean) => void;

  // Onboarding
  onboarding:        OnboardingState;
  advanceOnboarding: () => void;
  skipOnboarding:    () => void;
  resetOnboarding:   () => void;

  // Notifications
  notifications:    AppNotification[];
  unreadCount:      number;
  addNotification:  (n: Omit<AppNotification, 'id' | 'ts' | 'read'>) => void;
  markAllRead:      () => void;

  // Widget layout customisation
  widgetOrder:    string[];
  setWidgetOrder: (order: string[]) => void;

  // Feature flag: demo mode (shows mock data without real API calls)
  isDemoMode:    boolean;
  setDemoMode:   (v: boolean) => void;
}

/* ── Store implementation ────────────────────────────────────────────────── */
// NOTE: devtools middleware is always bundled but only active when enabled:true.
// For a zero-overhead production build, replace the devtools() wrapper with
// a direct subscribeWithSelector(persist(...)) call and remove the import.
export const useEnterpriseStore = create<EnterpriseStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          /* ── Theme ────────────────────────────────────────────────────── */
          theme:            'system',
          resolvedTheme:    'light',
          setTheme:         (theme) => set({ theme }, false, 'setTheme'),
          setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }, false, 'setResolvedTheme'),

          /* ── Sidebar ──────────────────────────────────────────────────── */
          sidebarCollapsed:    false,
          setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }, false, 'setSidebarCollapsed'),
          toggleSidebar:       () =>
            set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }), false, 'toggleSidebar'),

          /* ── Navigation ───────────────────────────────────────────────── */
          activeTab:   'overview',
          previousTab: null,
          setActiveTab: (tab) =>
            set((s) => ({ activeTab: tab, previousTab: s.activeTab }), false, 'setActiveTab'),

          /* ── Command bar ──────────────────────────────────────────────── */
          commandBarOpen:    false,
          setCommandBarOpen: (v) => set({ commandBarOpen: v }, false, 'setCommandBarOpen'),

          /* ── Onboarding ───────────────────────────────────────────────── */
          onboarding: {
            isFirstVisit:   true,
            currentStep:    0,
            completedSteps: [],
            skippedToLive:  false,
            startedAt:      null,
          },
          advanceOnboarding: () => {
            const { onboarding } = get();
            const next = Math.min(onboarding.currentStep + 1, 3) as 0 | 1 | 2 | 3;
            set({
              onboarding: {
                ...onboarding,
                currentStep:    next,
                completedSteps: [...onboarding.completedSteps, onboarding.currentStep],
                isFirstVisit:   next < 3,
                startedAt:      onboarding.startedAt ?? Date.now(),
              },
            }, false, 'advanceOnboarding');
          },
          skipOnboarding: () =>
            set({
              onboarding: {
                isFirstVisit:   false,
                currentStep:    3,
                completedSteps: [0, 1, 2],
                skippedToLive:  true,
                startedAt:      get().onboarding.startedAt ?? Date.now(),
              },
            }, false, 'skipOnboarding'),
          resetOnboarding: () =>
            set({
              onboarding: {
                isFirstVisit:   true,
                currentStep:    0,
                completedSteps: [],
                skippedToLive:  false,
                startedAt:      null,
              },
            }, false, 'resetOnboarding'),

          /* ── Notifications ────────────────────────────────────────────── */
          notifications: [
            {
              id: 'n1', type: 'warning', read: false, ts: Date.now() - 600_000,
              title: '3 devices need attention',
              body:  'Devices dev_4412, dev_0831, dev_1102 have not synced in 72 hours.',
            },
            {
              id: 'n2', type: 'success', read: false, ts: Date.now() - 3_600_000,
              title: 'Compliance rate — new record',
              body:  'Platform compliance rate reached 97.8%, the highest in 12 months.',
            },
            {
              id: 'n3', type: 'info', read: false, ts: Date.now() - 7_200_000,
              title: 'IRS Rev. Proc. 2025-14 detected',
              body:  'New regulation requires filing template updates before April 1.',
            },
          ],
          unreadCount: 3,
          addNotification: (n) => {
            const notif: AppNotification = {
              ...n,
              id:   crypto.randomUUID(),
              ts:   Date.now(),
              read: false,
            };
            set(
              (s) => ({
                notifications: [notif, ...s.notifications].slice(0, 50),
                unreadCount:   s.unreadCount + 1,
              }),
              false,
              'addNotification',
            );
          },
          markAllRead: () =>
            set(
              (s) => ({
                notifications: s.notifications.map((n) => ({ ...n, read: true })),
                unreadCount:   0,
              }),
              false,
              'markAllRead',
            ),

          /* ── Widget order ─────────────────────────────────────────────── */
          widgetOrder:    ['kpi-hero', 'ai-insights', 'revenue-chart', 'sync-health', 'activity'],
          setWidgetOrder: (order) => set({ widgetOrder: order }, false, 'setWidgetOrder'),

          /* ── Demo mode ────────────────────────────────────────────────── */
          isDemoMode:  false,
          setDemoMode: (v) => set({ isDemoMode: v }, false, 'setDemoMode'),
        }),
        {
          name:        'tb-enterprise-v2',
          version:     2,
          // Only persist UI preferences — never persist sensitive data
          partialize:  (s) => ({
            theme:            s.theme,
            sidebarCollapsed: s.sidebarCollapsed,
            onboarding:       s.onboarding,
            widgetOrder:      s.widgetOrder,
          }),
          // Migrate old persisted state when the store version number increments.
          // Return type must be Partial<EnterpriseStore> — Zustand merges the result.
          migrate: (persisted: unknown, fromVersion: number): Partial<EnterpriseStore> => {
            const p = persisted as Partial<EnterpriseStore>;
            if (fromVersion === 1) {
              // v1 stored onboarding without startedAt — reset to fresh state
              // so upgraded users see the new 3-step tour.
              return {
                ...p,
                onboarding: {
                  isFirstVisit:   true,
                  currentStep:    0,
                  completedSteps: [],
                  skippedToLive:  false,
                  startedAt:      null,
                },
              };
            }
            return p;
          },
        },
      ),
    ),
    { name: 'TaxBridgeEnterprise', enabled: process.env.NODE_ENV !== 'production' },
  ),
);

/* ── Granular selector hooks (prevent unnecessary re-renders) ────────────── */
// IMPORTANT: Selectors that return objects create a new reference on every call,
// causing components to re-render even when values haven't changed.
// Use atomic (primitive-returning) selectors for booleans and functions,
// or import { useShallow } from 'zustand/react/shallow' for object selectors.
export const useActiveTab      = () => useEnterpriseStore((s) => s.activeTab);
export const useSetActiveTab   = () => useEnterpriseStore((s) => s.setActiveTab);
export const useSidebarCollapsed   = () => useEnterpriseStore((s) => s.sidebarCollapsed);
export const useToggleSidebar      = () => useEnterpriseStore((s) => s.toggleSidebar);
export const useSetSidebarCollapsed = () => useEnterpriseStore((s) => s.setSidebarCollapsed);
// Convenience hook — safe because useShallow does a shallow-equal comparison:
import { useShallow } from 'zustand/react/shallow';
export const useSidebarState = () =>
  useEnterpriseStore(
    useShallow((s) => ({
      collapsed:    s.sidebarCollapsed,
      toggle:       s.toggleSidebar,
      setCollapsed: s.setSidebarCollapsed,
    })),
  );
export const useThemeState = () =>
  useEnterpriseStore(
    useShallow((s) => ({
      theme:         s.theme,
      resolvedTheme: s.resolvedTheme,
      setTheme:      s.setTheme,
    })),
  );
export const useOnboardingState = () => useEnterpriseStore((s) => s.onboarding);
export const useCommandBarState = () => useEnterpriseStore((s) => ({
  open:    s.commandBarOpen,
  setOpen: s.setCommandBarOpen,
}));
export const useNotificationState = () => useEnterpriseStore((s) => ({
  notifications:   s.notifications,
  unreadCount:     s.unreadCount,
  addNotification: s.addNotification,
  markAllRead:     s.markAllRead,
}));

════════════════════════════════════════════════════════════════════════════════
PHASE 4 — DIRECTORY SCAFFOLD
Create the complete directory tree before writing any component files.
════════════════════════════════════════════════════════════════════════════════

── Step 4.1  Create all directories ───────────────────────────────────────────

  mkdir -p src/components/admin-dashboard/ui
  mkdir -p src/components/admin-dashboard/shell
  mkdir -p src/components/admin-dashboard/tabs
  mkdir -p src/components/admin-dashboard/onboarding

  # Verify — expected output is exactly these 5 lines:
  find src/components/admin-dashboard -type d | sort
  # src/components/admin-dashboard
  # src/components/admin-dashboard/onboarding
  # src/components/admin-dashboard/shell
  # src/components/admin-dashboard/tabs
  # src/components/admin-dashboard/ui
  # If you see any extra directories, remove them:
  #   rm -rf src/components/admin-dashboard/<unexpected-dir>

── Step 4.2  Protect .bak snapshot files from accidental commits ──────────────

  # Append .bak pattern to .gitignore (if not already present):
  grep -q "\.pre-enterprise\.bak" .gitignore 2>/dev/null \
    || echo "# TaxBridge Enterprise upgrade safety backups" >> .gitignore \
    && echo "*.pre-enterprise.bak" >> .gitignore

  # Verify the line was added:
  grep "pre-enterprise" .gitignore
  # Expected: *.pre-enterprise.bak

── Step 4.3  Check next.config.js for transpilePackages ───────────────────────

  # Some Next.js + recharts + framer-motion combinations require explicit
  # transpilation. Check if your next.config already has transpilePackages:
  grep -n "transpilePackages" next.config.js next.config.ts next.config.mjs 2>/dev/null \
    || echo "transpilePackages not found"

  # If NOT found AND you are on Next.js 13+ App Router, add to next.config:
  #   transpilePackages: ['recharts', 'framer-motion'],
  # inside the nextConfig object. Skip if it already exists.
  # This prevents "Module not found: Can't resolve 'canvas'" errors on some
  # Linux-based Vercel build environments.

  # NOTE: All internal imports use this path: @/components/admin-dashboard/...

════════════════════════════════════════════════════════════════════════════════
PHASE 5 — DESIGN SYSTEM PRIMITIVES
src/components/admin-dashboard/ui/
════════════════════════════════════════════════════════════════════════════════

── Step 5.1  Create src/components/admin-dashboard/ui/Card.tsx ────────────────

'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-xl border transition-shadow duration-200',
  {
    variants: {
      variant: {
        default:     'bg-[var(--tb-surface-0)] border-[var(--tb-border)] shadow-card',
        elevated:    'bg-[var(--tb-surface-0)] border-[var(--tb-border)] shadow-card-lg',
        ghost:       'bg-transparent border-dashed border-[var(--tb-border)]',
        interactive: [
          'bg-[var(--tb-surface-0)] border-[var(--tb-border)] shadow-card cursor-pointer',
          'hover:shadow-card-lg hover:border-brand-300 dark:hover:border-brand-700',
        ].join(' '),
        flush:       'bg-[var(--tb-surface-0)] border-[var(--tb-border)] shadow-card overflow-hidden',
        inset:       'bg-[var(--tb-surface-1)] border-[var(--tb-border)]',
      },
      padding: {
        none: '',
        xs:   'p-3',
        sm:   'p-4',
        md:   'p-5',
        lg:   'p-6',
      },
    },
    defaultVariants: { variant: 'default', padding: 'sm' },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Animate in on mount using Framer Motion. Defaults to true. */
  animated?: boolean;
  /** Stagger delay in seconds when rendered in a list. Defaults to 0. */
  delay?: number;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, animated = true, delay = 0, children, ...props }, ref) => {
    if (!animated) {
      return (
        <div
          ref={ref}
          className={cn(cardVariants({ variant, padding }), className)}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <motion.div
        ref={ref}
        className={cn(cardVariants({ variant, padding }), className)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        {...(props as React.ComponentProps<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  },
);
Card.displayName = 'Card';

── Step 5.2  Create src/components/admin-dashboard/ui/Badge.tsx ───────────────

'use client';

import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium border select-none',
  {
    variants: {
      variant: {
        default:  'bg-[var(--tb-surface-2)] text-[var(--tb-text-2)] border-[var(--tb-border)]',
        success:  'bg-success/10  text-success-dark  dark:text-success  border-success/25',
        warning:  'bg-warning/10  text-warning-dark  dark:text-warning  border-warning/25',
        danger:   'bg-danger/10   text-danger-dark   dark:text-danger   border-danger/25',
        info:     'bg-info/10     text-info-dark     dark:text-info     border-info/25',
        brand:    'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border-brand-200 dark:border-brand-800',
        live:     'bg-success/10 text-success border-success/25',
        outline:  'bg-transparent text-[var(--tb-text-2)] border-[var(--tb-border)]',
      },
      size: {
        xs: 'px-1.5 py-px   text-[10px]',
        sm: 'px-2   py-0.5  text-xs',
        md: 'px-2.5 py-0.5  text-xs',
        lg: 'px-3   py-1    text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a coloured dot before the label */
  dot?: boolean;
  /** Animate the dot with pulse (use for live/real-time indicators) */
  pulse?: boolean;
}

export function Badge({
  className, variant, size, dot, pulse, children, ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full bg-current flex-shrink-0',
            pulse && 'animate-pulse-dot',
          )}
        />
      )}
      {children}
    </span>
  );
}

── Step 5.3  Create src/components/admin-dashboard/ui/Sparkline.tsx ───────────

'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import { cn } from '@/lib/utils';

interface SparklineProps {
  /** Array of numeric data points, oldest first */
  data: number[];
  /** Override line colour. Defaults to trend-based colour. */
  color?: string;
  /** Chart height in pixels. Defaults to 48. */
  height?: number;
  /** Show tooltip on hover. Defaults to true. */
  showTooltip?: boolean;
  /** Trend direction controls default colour: up=green, down=red, flat=blue */
  trend?: 'up' | 'down' | 'flat';
  className?: string;
  /** Custom value formatter for tooltip */
  formatter?: (v: number) => string;
}

const TREND_COLORS = {
  up:   '#10b981',
  down: '#ef4444',
  flat: '#3b82f6',
} as const;

export function Sparkline({
  data,
  color,
  height = 48,
  showTooltip = true,
  trend = 'flat',
  className,
  formatter,
}: SparklineProps) {
  const stroke = color ?? TREND_COLORS[trend];
  const chartData = data.map((value, i) => ({ i, value }));

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          {showTooltip && (
            <Tooltip
              cursor={false}
              content={({ active, payload }: TooltipProps<number, string>) =>
                active && payload?.[0]?.value != null ? (
                  <div
                    className="rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface-0)] px-2 py-1 text-xs font-semibold shadow-popover"
                    style={{ color: stroke }}
                  >
                    {formatter
                      ? formatter(payload[0].value)
                      : payload[0].value.toLocaleString()}
                  </div>
                ) : null
              }
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, fill: stroke, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

── Step 5.4  Create src/components/admin-dashboard/ui/StatusDot.tsx ───────────

'use client';
// StatusDot is always rendered inside 'use client' components (SystemsTab,
// SyncTab). The directive here ensures no accidental Server Component inclusion.

import { cn } from '@/lib/utils';

export type ServiceStatus =
  | 'online'
  | 'degraded'
  | 'offline'
  | 'maintenance'
  | 'unknown';

const STATUS_CONFIG: Record<
  ServiceStatus,
  { dotClass: string; label: string; textClass: string }
> = {
  online:      { dotClass: 'bg-success',                    label: 'Operational', textClass: 'text-success'  },
  degraded:    { dotClass: 'bg-warning',                    label: 'Degraded',    textClass: 'text-warning'  },
  offline:     { dotClass: 'bg-danger',                     label: 'Offline',     textClass: 'text-danger'   },
  maintenance: { dotClass: 'bg-info',                       label: 'Maintenance', textClass: 'text-info'     },
  unknown:     { dotClass: 'bg-[var(--tb-text-3)]',         label: 'Unknown',     textClass: 'text-[var(--tb-text-3)]' },
};

interface StatusDotProps {
  status:       ServiceStatus;
  showLabel?:   boolean;
  size?:        'sm' | 'md' | 'lg';
  className?:   string;
}

export function StatusDot({
  status, showLabel = false, size = 'md', className,
}: StatusDotProps) {
  const { dotClass, label, textClass } = STATUS_CONFIG[status];
  const sizeMap = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' };

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          sizeMap[size],
          dotClass,
          status !== 'offline' && 'animate-pulse-dot',
        )}
      />
      {showLabel && (
        <span className={cn('text-xs font-medium', textClass)}>{label}</span>
      )}
    </span>
  );
}

── Step 5.5  Create src/components/admin-dashboard/ui/Skeleton.tsx ────────────

import { cn } from '@/lib/utils';

/** Base shimmer skeleton block */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-gradient-to-r',
        'from-[var(--tb-surface-2)] via-[var(--tb-surface-3)] to-[var(--tb-surface-2)]',
        'bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

/** Skeleton for a single KPI card */
export function KPICardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="mb-2 h-11 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/** Full-tab loading skeleton */
export function TabSkeleton() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

── Step 5.6  Create src/components/admin-dashboard/ui/index.ts ────────────────

  export { Card,       type CardProps     } from './Card';
  export { Badge,      type BadgeProps    } from './Badge';
  export { Sparkline                      } from './Sparkline';
  export { StatusDot,  type ServiceStatus } from './StatusDot';
  export { Skeleton, KPICardSkeleton, TabSkeleton } from './Skeleton';

════════════════════════════════════════════════════════════════════════════════
PHASE 6 — LAYOUT SHELL
src/components/admin-dashboard/shell/
════════════════════════════════════════════════════════════════════════════════

── Step 6.1  Create src/components/admin-dashboard/shell/ThemeProvider.tsx ────

'use client';

import { useEffect, useCallback } from 'react';
import { useThemeState } from '@/store/enterpriseStore';

/**
 * Applies the theme class to <html> and keeps it in sync with the store.
 * Must be rendered inside the EnterpriseLayout — not at root layout level,
 * so it doesn't interfere with non-admin pages.
 */
export function EnterpriseThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, setResolvedTheme } = useThemeState();

  const applyTheme = useCallback(
    (dark: boolean) => {
      const html = document.documentElement;
      // Briefly disable transitions to prevent flash
      html.classList.add('tb-theme-switching');
      dark ? html.classList.add('dark') : html.classList.remove('dark');
      setResolvedTheme(dark ? 'dark' : 'light');
      // Re-enable transitions on next paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => html.classList.remove('tb-theme-switching'));
      });
    },
    [setResolvedTheme],
  );

  useEffect(() => {
    if (theme === 'dark')  { applyTheme(true);  return; }
    if (theme === 'light') { applyTheme(false); return; }

    // System: follow OS preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mq.matches);
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  return <>{children}</>;
}

── Step 6.2  Create src/components/admin-dashboard/shell/Sidebar.tsx ──────────

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Activity, Smartphone, Users, Shield,
  CreditCard, Brain, ChevronLeft, ChevronRight,
  Settings, HelpCircle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useActiveTab,
  useSetActiveTab,
  useSidebarState,
  type TabId,
} from '@/store/enterpriseStore';
import { Badge } from '../ui';

interface NavItem {
  id:            TabId | 'settings' | 'help';
  label:         string;
  icon:          React.ComponentType<{ className?: string }>;
  badge?:        { text: string; variant: 'live' | 'brand' | 'warning' };
  dividerBefore?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
  { id: 'systems',      label: 'Systems',      icon: Activity,   badge: { text: 'LIVE', variant: 'live'  } },
  { id: 'sync',         label: 'Android Sync', icon: Smartphone },
  { id: 'team',         label: 'Team & RBAC',  icon: Users,      dividerBefore: true },
  { id: 'compliance',   label: 'Compliance',   icon: Shield  },
  { id: 'billing',      label: 'Billing',      icon: CreditCard },
  { id: 'intelligence', label: 'Intelligence', icon: Brain,      badge: { text: 'AI', variant: 'brand'  } },
];

const BOTTOM_NAV: NavItem[] = [
  { id: 'settings', label: 'Settings',    icon: Settings   },
  { id: 'help',     label: 'Help & Docs', icon: HelpCircle },
];

const TAB_IDS = new Set<string>([
  'overview','systems','sync','team','compliance','billing','intelligence',
]);

function NavButton({
  item,
  collapsed,
}: {
  item:      NavItem;
  collapsed: boolean;
}) {
  const activeTab = useActiveTab();
  const setTab    = useSetActiveTab();
  const isActive  = activeTab === item.id;
  const Icon      = item.icon;
  const isTab     = TAB_IDS.has(item.id);

  return (
    <button
      type="button"
      onClick={() => isTab && setTab(item.id as TabId)}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center rounded-lg text-sm font-medium',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        collapsed
          ? 'mx-auto h-9 w-[44px] justify-center'
          : 'h-9 w-full gap-2.5 px-3',
        isActive
          ? 'bg-brand-500 text-white shadow-sm'
          : 'text-[var(--tb-text-2)] hover:bg-[var(--tb-surface-2)] hover:text-[var(--tb-text-1)]',
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden text-left truncate"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {!collapsed && item.badge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Badge
              variant={item.badge.variant}
              size="xs"
              dot={item.badge.variant === 'live'}
              pulse
            >
              {item.badge.text}
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip — only visible when sidebar is collapsed */}
      {collapsed && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-full z-50 ml-3',
            'whitespace-nowrap rounded-lg border border-[var(--tb-border)]',
            'bg-[var(--tb-surface-0)] px-2.5 py-1.5 text-xs font-medium',
            'text-[var(--tb-text-1)] shadow-popover',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
          )}
        >
          {item.label}
          {item.badge && (
            <span className="ml-1.5 text-brand-500">{item.badge.text}</span>
          )}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebarState();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 240 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col overflow-hidden',
        'border-r border-[var(--tb-border)] bg-[var(--tb-surface-0)]',
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Logo ────────────────────────────────────────────────── */}
      <div className="flex h-[60px] flex-shrink-0 items-center border-b border-[var(--tb-border)] px-3 overflow-hidden">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
          <Zap className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="ml-2.5 overflow-hidden"
            >
              <p className="text-[13px] font-bold leading-none text-[var(--tb-text-1)]">
                TaxBridge
              </p>
              <p className="mt-[3px] text-[10px] font-semibold uppercase tracking-widest text-[var(--tb-text-3)]">
                Enterprise
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Primary navigation ──────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-2 space-y-0.5">
        {PRIMARY_NAV.map((item) => (
          <div key={item.id}>
            {item.dividerBefore && (
              <div className="mx-1 my-1.5 border-t border-[var(--tb-border)]" />
            )}
            <NavButton item={item} collapsed={collapsed} />
          </div>
        ))}
      </nav>

      {/* ── Bottom section ───────────────────────────────────────── */}
      <div className="flex-shrink-0 space-y-0.5 border-t border-[var(--tb-border)] px-1.5 pb-2 pt-2">
        {BOTTOM_NAV.map((item) => (
          <NavButton key={item.id} item={item} collapsed={collapsed} />
        ))}

        {/* Uptime trust badge */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-0.5 mt-1.5 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2"
            >
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success flex-shrink-0" />
              <span className="text-[11px] font-semibold text-success">
                99.99% Uptime SLA
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 w-full items-center justify-center gap-2 rounded-lg text-xs',
            'text-[var(--tb-text-3)] transition-colors',
            'hover:bg-[var(--tb-surface-2)] hover:text-[var(--tb-text-1)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          {collapsed
            ? <ChevronRight className="h-3.5 w-3.5" />
            : <><ChevronLeft className="h-3.5 w-3.5" /><span>Collapse</span></>
          }
        </button>
      </div>
    </motion.aside>
  );
}

── Step 6.3  Create src/components/admin-dashboard/shell/TopBar.tsx ───────────

'use client';

import { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, Moon, Monitor, Search, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useActiveTab,
  useCommandBarState,
  useNotificationState,
  useThemeState,
  type Theme,
} from '@/store/enterpriseStore';
import { Badge } from '../ui';

const TAB_LABELS: Record<string, string> = {
  overview:     'Overview',
  systems:      'Systems Health',
  sync:         'Android Sync',
  team:         'Team & RBAC',
  compliance:   'Compliance & Audit',
  billing:      'Usage & Billing',
  intelligence: 'AI Intelligence',
};

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function TopBar() {
  const activeTab                       = useActiveTab();
  const { theme, setTheme }             = useThemeState();
  const { setOpen: setCommandBarOpen }  = useCommandBarState();
  const { unreadCount, notifications, markAllRead } = useNotificationState();
  const [notifOpen, setNotifOpen]       = useState(false);
  const notifRef                        = useRef<HTMLDivElement>(null);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % 3];
    setTheme(next);
  };
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header
      className={cn(
        'z-20 flex h-[60px] flex-shrink-0 items-center justify-between',
        'border-b border-[var(--tb-border)] bg-[var(--tb-surface-0)]',
        'px-4 lg:px-6',
      )}
    >
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden text-xs font-medium text-[var(--tb-text-3)] sm:block">
          TaxBridge
        </span>
        <span className="hidden text-xs text-[var(--tb-text-3)] sm:block">/</span>
        <span className="truncate text-sm font-semibold text-[var(--tb-text-1)]">
          {TAB_LABELS[activeTab] ?? activeTab}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Command bar pill */}
        <button
          type="button"
          onClick={() => setCommandBarOpen(true)}
          aria-label="Open command bar — keyboard shortcut Command K or Control K"
          className={cn(
            'hidden h-8 items-center gap-2 rounded-lg border px-3 md:flex',
            'border-[var(--tb-border)] bg-[var(--tb-surface-1)]',
            'text-xs text-[var(--tb-text-3)]',
            'hover:border-brand-300 hover:text-[var(--tb-text-1)] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="max-w-[160px] truncate">Search or run command...</span>
          <kbd className="ml-1 rounded border border-[var(--tb-border)] bg-[var(--tb-surface-2)] px-1.5 py-px font-mono text-[10px] text-[var(--tb-text-3)]">
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Switch theme — current: ${theme}`}
          title={`Theme: ${theme}`}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            'text-[var(--tb-text-3)] transition-colors',
            'hover:bg-[var(--tb-surface-2)] hover:text-[var(--tb-text-1)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              if (!notifOpen && unreadCount > 0) markAllRead();
            }}
            aria-label={`Notifications — ${unreadCount} unread`}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-lg',
              'text-[var(--tb-text-3)] transition-colors',
              'hover:bg-[var(--tb-surface-2)] hover:text-[var(--tb-text-1)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            )}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 h-[7px] w-[7px] rounded-full border-2 border-[var(--tb-surface-0)] bg-danger" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                role="dialog"
                aria-label="Notifications panel"
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute right-0 top-10 z-50 w-[340px] overflow-hidden',
                  'rounded-xl border border-[var(--tb-border)]',
                  'bg-[var(--tb-surface-0)] shadow-popover',
                )}
              >
                <div className="flex items-center justify-between border-b border-[var(--tb-border)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--tb-text-1)]">
                    Notifications
                  </span>
                  <Badge variant="default" size="xs">
                    {notifications.length}
                  </Badge>
                </div>
                <div className="max-h-[300px] divide-y divide-[var(--tb-border)] overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 transition-colors hover:bg-[var(--tb-surface-1)]"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                            n.type === 'error'   ? 'bg-danger'  :
                            n.type === 'warning' ? 'bg-warning' :
                            n.type === 'success' ? 'bg-success' : 'bg-info',
                          )}
                        />
                        <div>
                          <p className="text-xs font-semibold text-[var(--tb-text-1)]">
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--tb-text-3)]">
                            {n.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar / Account */}
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            'flex h-8 items-center gap-2 rounded-lg pl-2 pr-2.5 transition-colors',
            'hover:bg-[var(--tb-surface-2)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600">
            <span className="select-none text-[10px] font-bold text-white">A</span>
          </div>
          <span className="hidden text-xs font-medium text-[var(--tb-text-1)] sm:block">
            Admin
          </span>
          <ChevronDown className="hidden h-3 w-3 text-[var(--tb-text-3)] sm:block" />
        </button>
      </div>
    </header>
  );
}

── Step 6.4  Create src/components/admin-dashboard/shell/CommandBar.tsx ───────

'use client';

import { Command } from 'cmdk';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Brain, CreditCard, HelpCircle, LayoutDashboard,
  RefreshCw, Search, Settings, Shield, Smartphone, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCommandBarState, useSetActiveTab, type TabId } from '@/store/enterpriseStore';

interface CommandItem {
  id:       string;
  label:    string;
  icon:     React.ComponentType<{ className?: string }>;
  keywords?: string;
  onSelect: () => void;
}

export function CommandBar() {
  const { open, setOpen } = useCommandBarState();
  const setTab            = useSetActiveTab();

  const nav = (tab: TabId) => () => {
    setTab(tab);
    setOpen(false);
  };

  const GROUPS: { group: string; items: CommandItem[] }[] = [
    {
      group: 'Navigate',
      items: [
        { id: 'nav-ov', label: 'Overview',        icon: LayoutDashboard, onSelect: nav('overview'),                            },
        { id: 'nav-sy', label: 'Systems Health',  icon: Activity,        onSelect: nav('systems'),     keywords: 'api logs health'  },
        { id: 'nav-sn', label: 'Android Sync',    icon: Smartphone,      onSelect: nav('sync'),        keywords: 'devices mobile'   },
        { id: 'nav-tm', label: 'Team & RBAC',     icon: Users,           onSelect: nav('team'),        keywords: 'roles permissions'},
        { id: 'nav-co', label: 'Compliance',      icon: Shield,          onSelect: nav('compliance'),  keywords: 'audit soc gdpr'   },
        { id: 'nav-bi', label: 'Billing',         icon: CreditCard,      onSelect: nav('billing'),     keywords: 'usage invoice mrr'},
        { id: 'nav-ai', label: 'AI Intelligence', icon: Brain,           onSelect: nav('intelligence'),keywords: 'insights predict' },
      ],
    },
    {
      group: 'Actions',
      items: [
        {
          id: 'act-sync', label: 'Trigger Sync — All Devices', icon: RefreshCw,
          onSelect: () => { toast.success('Global sync triggered for all devices'); setOpen(false); },
        },
        {
          id: 'act-settings', label: 'Open Settings', icon: Settings,
          onSelect: () => { toast.info('Opening settings...'); setOpen(false); },
        },
        {
          id: 'act-help', label: 'Help & Documentation', icon: HelpCircle,
          onSelect: () => { toast.info('Opening documentation...'); setOpen(false); },
        },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cb-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <motion.div
            key="cb-panel"
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[18vh] z-[61] w-full max-w-[560px] -translate-x-1/2 px-4 sm:px-0"
          >
            <Command
              className="overflow-hidden rounded-2xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] shadow-popover"
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-[var(--tb-border)] px-4 py-3">
                <Search className="h-4 w-4 flex-shrink-0 text-[var(--tb-text-3)]" />
                <Command.Input
                  placeholder="Search tabs, run actions..."
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-[var(--tb-text-1)] placeholder:text-[var(--tb-text-3)] outline-none"
                />
                <kbd className="rounded border border-[var(--tb-border)] bg-[var(--tb-surface-2)] px-1.5 py-px font-mono text-[10px] text-[var(--tb-text-3)]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[340px] overflow-y-auto py-1.5">
                <Command.Empty className="py-10 text-center text-sm text-[var(--tb-text-3)]">
                  No matching commands found.
                </Command.Empty>
                {GROUPS.map(({ group, items }) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className={[
                      '[&>[cmdk-group-heading]]:px-4',
                      '[&>[cmdk-group-heading]]:py-1.5',
                      '[&>[cmdk-group-heading]]:text-[10px]',
                      '[&>[cmdk-group-heading]]:font-bold',
                      '[&>[cmdk-group-heading]]:uppercase',
                      '[&>[cmdk-group-heading]]:tracking-wider',
                      '[&>[cmdk-group-heading]]:text-[var(--tb-text-3)]',
                    ].join(' ')}
                  >
                    {items.map(({ id, label, icon: Icon, keywords, onSelect }) => (
                      <Command.Item
                        key={id}
                        value={`${label} ${keywords ?? ''}`}
                        onSelect={onSelect}
                        className={[
                          'mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                          'text-[var(--tb-text-2)] transition-colors',
                          'data-[selected=true]:bg-[var(--tb-surface-2)] data-[selected=true]:text-[var(--tb-text-1)]',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0 text-[var(--tb-text-3)]" />
                        <span>{label}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Keyboard hints */}
              <div className="flex items-center gap-4 border-t border-[var(--tb-border)] px-4 py-2.5 text-[10px] text-[var(--tb-text-3)]">
                {[
                  { key: '↑↓', hint: 'Navigate' },
                  { key: '↵',  hint: 'Select'   },
                  { key: 'ESC',hint: 'Close'     },
                ].map(({ key, hint }) => (
                  <span key={key}>
                    <kbd className="mr-1 rounded border border-[var(--tb-border)] bg-[var(--tb-surface-2)] px-1.5 py-px font-mono">
                      {key}
                    </kbd>
                    {hint}
                  </span>
                ))}
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

── Step 6.5  Create src/components/admin-dashboard/shell/Layout.tsx ───────────

'use client';

import { useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useActiveTab, useEnterpriseStore } from '@/store/enterpriseStore';
import { Sidebar }                from './Sidebar';
import { TopBar }                 from './TopBar';
import { CommandBar }             from './CommandBar';
import { EnterpriseThemeProvider } from './ThemeProvider';
import { TabSkeleton }            from '../ui';

// SSR-safe dynamic import for onboarding — avoids hydration mismatch
// from localStorage-persisted state
const OnboardingOrchestrator = dynamic(
  () =>
    import('../onboarding/OnboardingOrchestrator').then(
      (m) => m.OnboardingOrchestrator,
    ),
  { ssr: false },
);

export function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarCollapsed  = useEnterpriseStore((s) => s.sidebarCollapsed);
  const setCommandBarOpen = useEnterpriseStore((s) => s.setCommandBarOpen);
  const activeTab         = useActiveTab();

  // Global ⌘K / Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandBarOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandBarOpen]);

  return (
    <EnterpriseThemeProvider>
      {/* Skip-to-content link — WCAG 2.4.1 */}
      <a
        href="#tb-main-content"
        className={cn(
          'sr-only focus:not-sr-only',
          'focus:fixed focus:left-4 focus:top-4 focus:z-[100]',
          'focus:rounded-xl focus:bg-brand-500 focus:px-4 focus:py-2',
          'focus:text-sm focus:font-semibold focus:text-white focus:shadow-card-lg',
        )}
      >
        Skip to main content
      </a>

      <div className="flex h-screen w-full overflow-hidden bg-[var(--tb-surface-1)] text-[var(--tb-text-1)]">
        <Sidebar />

        {/* Main area — shifts right when sidebar expands */}
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            'transition-[margin-left] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]',
          )}
        >
          <TopBar />

          <main
            id="tb-main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto focus:outline-none"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="mx-auto max-w-[1600px] p-4 lg:p-6"
              >
                <Suspense fallback={<TabSkeleton />}>
                  {children}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <CommandBar />
      <OnboardingOrchestrator />
      <Toaster richColors position="bottom-right" closeButton />
    </EnterpriseThemeProvider>
  );
}

── Step 6.6  Create src/components/admin-dashboard/shell/index.ts ─────────────

  export { EnterpriseLayout }        from './Layout';
  export { Sidebar }                 from './Sidebar';
  export { TopBar }                  from './TopBar';
  export { CommandBar }              from './CommandBar';
  export { EnterpriseThemeProvider } from './ThemeProvider';

════════════════════════════════════════════════════════════════════════════════
PHASE 7 — TAB IMPLEMENTATIONS (COMPLETE, SELF-CONTAINED)
src/components/admin-dashboard/tabs/
All 7 tabs are fully specified below. No external cross-references.
════════════════════════════════════════════════════════════════════════════════

── Step 7.1  Create src/components/admin-dashboard/tabs/OverviewTab.tsx ───────

'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle, Brain, CheckCircle2, ChevronRight,
  DollarSign, Download, FileText, Lightbulb,
  Minus, Plus, RefreshCw, Smartphone,
  TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { Card, Badge, Sparkline } from '../ui';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';

/* ── Mock data (replace with useQuery hooks after UI is verified) ──────────── */

const KPI_CARDS = [
  {
    id:    'mrr',
    label: 'Monthly Revenue',
    value: '$284,920',
    numeric: 284_920,
    delta:  '+12.4%',
    dir:    'up'  as const,
    good:   true,
    sub:    'vs. last 30 days',
    Icon:   DollarSign,
    spark:  [210, 218, 225, 232, 228, 241, 255, 262, 270, 285],
    color:  '#10b981',
    fmt:    formatCurrency,
  },
  {
    id:    'orgs',
    label: 'Active Organizations',
    value: '1,847',
    numeric: 1_847,
    delta:  '+8.2%',
    dir:    'up'  as const,
    good:   true,
    sub:    '↑ 140 new this month',
    Icon:   Users,
    spark:  [1600, 1640, 1660, 1700, 1720, 1745, 1770, 1800, 1820, 1847],
    color:  '#3b82f6',
    fmt:    formatNumber,
  },
  {
    id:    'filings',
    label: 'Filings Processed',
    value: '98,341',
    numeric: 98_341,
    delta:  '+23.1%',
    dir:    'up'  as const,
    good:   true,
    sub:    '4,200 pending review',
    Icon:   CheckCircle2,
    spark:  [72000, 76000, 79000, 81000, 84000, 87000, 90000, 93000, 96000, 98341],
    color:  '#8b5cf6',
    fmt:    formatNumber,
  },
  {
    id:    'sync',
    label: 'Sync Health',
    value: '99.2%',
    numeric: 99.2,
    delta:  '-0.3%',
    dir:    'down' as const,
    good:   false,
    sub:    '12 devices need attention',
    Icon:   Smartphone,
    spark:  [99.8, 99.7, 99.5, 99.6, 99.4, 99.3, 99.5, 99.4, 99.3, 99.2],
    color:  '#f59e0b',
    fmt:    (n: number) => `${n}%`,
  },
] as const;

const REVENUE_CHART_DATA = [
  { date: 'Feb 14', revenue: 215_000 },
  { date: 'Feb 18', revenue: 222_000 },
  { date: 'Feb 22', revenue: 238_000 },
  { date: 'Feb 26', revenue: 250_000 },
  { date: 'Mar 02', revenue: 262_000 },
  { date: 'Mar 06', revenue: 275_000 },
  { date: 'Mar 10', revenue: 278_000 },
  { date: 'Mar 14', revenue: 284_920 },
];

const AI_INSIGHTS = [
  {
    type:  'opportunity',
    Icon:  TrendingUp,
    color: '#10b981',
    text:  'Q1 filing surge predicted — pre-scale sync workers by Thursday to handle +34% volume.',
  },
  {
    type:  'warning',
    Icon:  AlertTriangle,
    color: '#f59e0b',
    text:  '3 organizations have not synced in 72 hours. Auto-retry is scheduled; manual review recommended.',
  },
  {
    type:  'info',
    Icon:  Lightbulb,
    color: '#3b82f6',
    text:  'Compliance rate improved to 97.8% — the highest recorded. New validation rules are working.',
  },
] as const;

const QUICK_ACTIONS = [
  { label: 'Sync All',   Icon: RefreshCw, fn: () => toast.success('Global sync triggered for all devices') },
  { label: 'New Filing', Icon: Plus,      fn: () => toast.info('Opening new filing wizard...')             },
  { label: 'Export',     Icon: Download,  fn: () => toast.info('Generating report...')                     },
  { label: 'Audit Log',  Icon: FileText,  fn: () => toast.info('Opening audit log...')                     },
] as const;

const SYNC_SEGMENTS = [
  { label: 'Synced',  count: 1_823, color: '#10b981' },
  { label: 'Syncing', count: 12,    color: '#06b6d4' },
  { label: 'Failed',  count: 6,     color: '#ef4444' },
  { label: 'Stale',   count: 6,     color: '#f59e0b' },
] as const;

const TOTAL_DEVICES = 1_847;

/* ── KPI Card ────────────────────────────────────────────────────────────── */

type KpiCard = typeof KPI_CARDS[number];

function KPICard({ kpi, index }: { kpi: KpiCard; index: number }) {
  const isGood      = (kpi.dir === 'up' && kpi.good) || (kpi.dir === 'down' && !kpi.good);
  const deltaColor  = kpi.dir === 'flat' ? 'var(--tb-text-3)' : isGood ? '#10b981' : '#ef4444';
  const DeltaIcon   = kpi.dir === 'up' ? TrendingUp : kpi.dir === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] p-4 shadow-card transition-shadow hover:shadow-card-lg"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--tb-text-3)]">
            {kpi.label}
          </p>
          <p className="text-2xl font-bold leading-none tracking-tight text-[var(--tb-text-1)]">
            {kpi.value}
          </p>
        </div>
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${kpi.color}18`, border: `1px solid ${kpi.color}30` }}
        >
          <kpi.Icon className="h-[18px] w-[18px]" style={{ color: kpi.color }} />
        </div>
      </div>

      <Sparkline
        data={[...kpi.spark]}
        color={kpi.color}
        height={44}
        trend={kpi.dir}
        formatter={kpi.fmt as (v: number) => string}
      />

      <div className="mt-2 flex items-center justify-between">
        <span
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: deltaColor }}
        >
          <DeltaIcon className="h-3.5 w-3.5" />
          {kpi.delta}
        </span>
        <span className="ml-2 truncate text-xs text-[var(--tb-text-3)]">{kpi.sub}</span>
      </div>
    </motion.div>
  );
}

/* ── Tab component ───────────────────────────────────────────────────────── */

export function OverviewTab() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--tb-text-1)]">Control Center</h1>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            Enterprise Tax Automation Platform · Last updated just now
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {QUICK_ACTIONS.map(({ label, Icon, fn }) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              aria-label={label}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-3',
                'border-[var(--tb-border)] bg-[var(--tb-surface-0)]',
                'text-xs font-medium text-[var(--tb-text-2)]',
                'hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-300',
                'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Hero Row — CFO 10-second test ── */}
      <section
        aria-label="Key performance indicators"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {KPI_CARDS.map((kpi, i) => (
          <KPICard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </section>

      {/* ── AI Insights Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className={cn(
          'rounded-xl border border-brand-800/50 p-4',
          'bg-gradient-to-r from-brand-950/90 via-[#0d1f3c]/80 to-brand-950/90',
          'dark:from-brand-950 dark:to-brand-900/70',
        )}
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/20">
            <Brain className="h-3.5 w-3.5 text-brand-300" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-300">
            AI Intelligence · 3 new insights
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {AI_INSIGHTS.map((ins, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                'group flex items-start gap-2.5 rounded-xl p-3 text-left',
                'border border-white/10 bg-white/5',
                'hover:border-white/20 hover:bg-white/10 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
              )}
            >
              <ins.Icon className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: ins.color }} />
              <p className="flex-1 text-xs leading-relaxed text-brand-100/90">{ins.text}</p>
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card variant="flush" padding="none" className="lg:col-span-2" delay={0.1}>
          <div className="flex items-center justify-between px-5 pb-0 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--tb-text-1)]">
                Platform Revenue
              </h3>
              <p className="mt-0.5 text-xs text-[var(--tb-text-3)]">Last 30 days</p>
            </div>
            <Badge variant="live" dot pulse>Live</Badge>
          </div>
          <div className="px-5 pb-5 pt-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={REVENUE_CHART_DATA}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--tb-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--tb-text-3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1_000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--tb-text-3)' }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.[0] ? (
                      <div className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] px-3 py-2 shadow-popover">
                        <p className="mb-0.5 text-xs text-[var(--tb-text-3)]">{label}</p>
                        <p className="text-sm font-bold text-[var(--tb-text-1)]">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#rev-grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Sync health widget */}
        <Card padding="md" delay={0.15}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--tb-text-1)]">Sync Health</h3>
            <Badge variant="live" dot pulse>Live</Badge>
          </div>
          <div className="space-y-2.5">
            {SYNC_SEGMENTS.map(({ label, count, color }) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--tb-text-2)]">{label}</span>
                  <span className="text-xs font-semibold text-[var(--tb-text-1)]">
                    {count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tb-surface-2)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / TOTAL_DEVICES) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-[var(--tb-border)] pt-3">
            <p className="text-[11px] text-[var(--tb-text-3)]">
              {TOTAL_DEVICES.toLocaleString()} total devices · updated 2m ago
            </p>
          </div>
        </Card>
      </div>

      {/* ── Bottom row: Activity Feed + Global Compliance Radar ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Recent Activity Feed */}
        <Card variant="flush" padding="none" delay={0.2}>
          <div className="flex items-center justify-between border-b border-[var(--tb-border)] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--tb-text-1)]">Recent Activity</h3>
            <Badge variant="live" dot pulse>Live</Badge>
          </div>
          <div className="divide-y divide-[var(--tb-border)]">
            {[
              { Icon: CheckCircle2, color: '#10b981', label: 'Filing F-98341 approved',    sub: 'Acme Corp · 2 min ago'       },
              { Icon: Smartphone,   color: '#3b82f6', label: 'Device dev_8821 synced',     sub: '1,240 records · 5 min ago'   },
              { Icon: Users,        color: '#8b5cf6', label: 'New organisation onboarded', sub: 'Retail Partners · 12 min ago' },
              { Icon: TrendingUp,   color: '#f59e0b', label: 'Q1 filing surge alert',      sub: 'AI predicted · 18 min ago'   },
              { Icon: CheckCircle2, color: '#10b981', label: 'Compliance audit passed',    sub: 'LegalTech Ltd · 31 min ago'  },
            ].map(({ Icon, color, label, sub }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--tb-surface-1)]"
              >
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${color}18`, border: `1px solid ${color}28` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--tb-text-1)]">{label}</p>
                  <p className="text-[11px] text-[var(--tb-text-3)]">{sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Global Tax Compliance Radar */}
        <Card padding="md" delay={0.22}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--tb-text-1)]">Global Compliance Radar</h3>
            <Badge variant="success" size="xs" dot>97.8% avg</Badge>
          </div>
          <div className="space-y-2.5">
            {([
              { region: 'Nigeria — FIRS',        pct: 98.4, color: '#10b981' },
              { region: 'United States — IRS',    pct: 97.1, color: '#3b82f6' },
              { region: 'United Kingdom — HMRC',  pct: 99.2, color: '#8b5cf6' },
              { region: 'South Africa — SARS',    pct: 95.6, color: '#f59e0b' },
              { region: 'Kenya — KRA',             pct: 93.8, color: '#06b6d4' },
              { region: 'Ghana — GRA',             pct: 96.7, color: '#10b981' },
            ] as const).map(({ region, pct, color }, i) => (
              <div key={region}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--tb-text-2)]">{region}</span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: pct >= 96 ? '#10b981' : pct >= 94 ? '#f59e0b' : '#ef4444' }}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tb-surface-2)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, delay: 0.35 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[var(--tb-border)] pt-3">
            <p className="text-[11px] text-[var(--tb-text-3)]">
              6 jurisdictions monitored · refreshed hourly
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}

── Step 7.2  Create src/components/admin-dashboard/tabs/SystemsTab.tsx ────────

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Database, Globe, Server,
} from 'lucide-react';
import {
  CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, Badge, StatusDot, type ServiceStatus } from '../ui';
import { cn } from '@/lib/utils';

/* ── Simulated real-time metrics hook ─────────────────────────────────────── */
/* Replace the setInterval body with your real WebSocket or polling hook.     */

interface Metrics {
  apiLatency:    number;
  errorRate:     number;
  queueDepth:    number;
  dlqVolume:     number;
  cpuUsage:      number;
  memUsage:      number;
  wsConnections: number;
  throughput:    number;
}

interface HistoryPoint {
  t:        string;
  latency:  number;
  errors:   number;
}

function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({
    apiLatency: 42, errorRate: 0.12, queueDepth: 847, dlqVolume: 3,
    cpuUsage: 34, memUsage: 61, wsConnections: 1_284, throughput: 2_847,
  });
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString('en-US', {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      setMetrics((prev) => {
        const next: Metrics = {
          apiLatency:    Math.max(10,    prev.apiLatency    + (Math.random() - 0.5) * 8),
          errorRate:     Math.max(0,     Math.min(5, prev.errorRate + (Math.random() - 0.5) * 0.1)),
          queueDepth:    Math.max(0,     prev.queueDepth    + Math.floor((Math.random() - 0.5) * 50)),
          dlqVolume:     Math.max(0,     prev.dlqVolume     + Math.floor((Math.random() - 0.4) * 2)),
          cpuUsage:      Math.max(5,     Math.min(95, prev.cpuUsage    + (Math.random() - 0.5) * 5)),
          memUsage:      Math.max(20,    Math.min(90, prev.memUsage    + (Math.random() - 0.5) * 3)),
          wsConnections: Math.max(0,     prev.wsConnections + Math.floor((Math.random() - 0.5) * 20)),
          throughput:    Math.max(1_000, prev.throughput    + Math.floor((Math.random() - 0.5) * 200)),
        };
        // Capture next.apiLatency INSIDE the functional update to avoid stale closure.
        // Reading from outer-scope `metrics` would use the value from the previous render.
        setHistory((h) =>
          [...h.slice(-29), { t, latency: next.apiLatency, errors: next.errorRate }],
        );
        return next;
      });
    };
    const id = setInterval(tick, 1_500);
    return () => clearInterval(id);
  }, []); // Empty deps — tick uses only functional setters, no stale closures.

  return { metrics, history };
}

/* ── Service list ─────────────────────────────────────────────────────────── */

const SERVICES: {
  name:    string;
  status:  ServiceStatus;
  latency: string;
  uptime:  string;
}[] = [
  { name: 'API Gateway',        status: 'online',      latency: '38ms',  uptime: '99.99%' },
  { name: 'Sync Worker',        status: 'online',      latency: '12ms',  uptime: '99.97%' },
  { name: 'Tax Engine',         status: 'online',      latency: '142ms', uptime: '99.95%' },
  { name: 'Filing Processor',   status: 'degraded',    latency: '890ms', uptime: '99.82%' },
  { name: 'Notification Hub',   status: 'online',      latency: '8ms',   uptime: '100%'   },
  { name: 'Analytics Pipeline', status: 'online',      latency: '55ms',  uptime: '99.90%' },
];

/* ── Static log entries ───────────────────────────────────────────────────── */

const LOG_ENTRIES = [
  { ts: '14:32:01', level: 'INFO',  msg: 'Sync completed for org_8821 · 1,240 records processed'              },
  { ts: '14:31:58', level: 'WARN',  msg: 'Device dev_4412 sync retry 2/3 · timeout after 5,000 ms'            },
  { ts: '14:31:45', level: 'INFO',  msg: 'Filing F-98341 submitted successfully · org_1023'                   },
  { ts: '14:31:30', level: 'ERROR', msg: 'DLQ threshold breached · queue: filing-processor · depth = 3'       },
  { ts: '14:31:15', level: 'INFO',  msg: 'AI model refreshed · compliance_rules_v4.2.1 deployed'              },
  { ts: '14:31:02', level: 'INFO',  msg: 'WebSocket connections stable · 1,284 active sessions'               },
] as const;

/* ── Component ────────────────────────────────────────────────────────────── */

export function SystemsTab() {
  const { metrics, history } = useRealtimeMetrics();

  const TOP_METRICS = [
    {
      label:  'API P95 Latency',
      value:  `${metrics.apiLatency.toFixed(0)} ms`,
      Icon:   Globe,
      color:  '#3b82f6',
      status: metrics.apiLatency < 200 ? 'Normal' : 'High',
      good:   metrics.apiLatency < 200,
    },
    {
      label:  'Error Rate',
      value:  `${metrics.errorRate.toFixed(2)}%`,
      Icon:   Activity,
      color:  metrics.errorRate > 1 ? '#ef4444' : '#10b981',
      status: metrics.errorRate < 1 ? 'Normal' : 'Elevated',
      good:   metrics.errorRate < 1,
    },
    {
      label:  'Queue Depth',
      value:  metrics.queueDepth.toLocaleString(),
      Icon:   Server,
      color:  metrics.queueDepth > 1_000 ? '#f59e0b' : '#3b82f6',
      status: metrics.queueDepth < 1_000 ? 'Normal' : 'High',
      good:   metrics.queueDepth < 1_000,
    },
    {
      label:  'DLQ Volume',
      value:  String(metrics.dlqVolume),
      Icon:   Database,
      color:  metrics.dlqVolume > 0 ? '#ef4444' : '#10b981',
      status: metrics.dlqVolume === 0 ? 'Clear' : 'Has Messages',
      good:   metrics.dlqVolume === 0,
    },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--tb-text-1)]">Systems Health</h2>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            Real-time infrastructure observability
          </p>
        </div>
        <Badge variant="live" dot pulse>Live · 1.5 s refresh</Badge>
      </div>

      {/* Live metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TOP_METRICS.map(({ label, value, Icon, color, status, good }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] p-4 shadow-card"
          >
            <div className="mb-2 flex items-start justify-between">
              <p className="text-xs font-medium text-[var(--tb-text-3)]">{label}</p>
              <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
            </div>
            <p className="text-2xl font-bold tracking-tight" style={{ color }}>
              {value}
            </p>
            <p
              className="mt-1 text-[11px] font-medium"
              style={{ color: good ? '#10b981' : '#ef4444' }}
            >
              ● {status}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Chart + Service list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Live latency chart */}
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-[var(--tb-text-1)]">
            API Latency — Live
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--tb-border)"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: 'var(--tb-text-3)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--tb-text-3)' }}
                axisLine={false}
                tickLine={false}
                width={36}
                unit=" ms"
              />
              <Tooltip
                contentStyle={{
                  background:   'var(--tb-surface-0)',
                  border:       '1px solid var(--tb-border)',
                  borderRadius: 12,
                  fontSize:     12,
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Service status */}
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-semibold text-[var(--tb-text-1)]">
            Service Status
          </h3>
          <div className="space-y-0">
            {SERVICES.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between border-b border-[var(--tb-border)] py-2 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <StatusDot status={svc.status} />
                  <span className="text-sm font-medium text-[var(--tb-text-1)]">
                    {svc.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--tb-text-3)]">
                    {svc.latency}
                  </span>
                  <span className="text-xs text-[var(--tb-text-3)]">{svc.uptime}</span>
                  <Badge
                    variant={
                      svc.status === 'online' ? 'success' :
                      svc.status === 'degraded' ? 'warning' : 'danger'
                    }
                  >
                    {svc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Live log stream */}
      <Card variant="flush" padding="none">
        <div className="flex items-center justify-between border-b border-[var(--tb-border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--tb-text-1)]">Live Log Stream</h3>
          <Badge variant="live" dot pulse>Streaming</Badge>
        </div>
        <div className="max-h-[220px] overflow-y-auto p-3 font-mono text-xs space-y-1.5">
          {LOG_ENTRIES.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface-1)] p-2"
            >
              <span className="flex-shrink-0 text-[var(--tb-text-3)]">{log.ts}</span>
              <span
                className={cn(
                  'w-10 flex-shrink-0 font-bold',
                  log.level === 'ERROR' ? 'text-danger'  :
                  log.level === 'WARN'  ? 'text-warning' : 'text-[var(--tb-text-3)]',
                )}
              >
                {log.level}
              </span>
              <span className="text-[var(--tb-text-2)]">{log.msg}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

── Step 7.3  Create src/components/admin-dashboard/tabs/SyncTab.tsx ───────────

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui';
import { cn } from '@/lib/utils';

type SyncStatus = 'synced' | 'syncing' | 'failed' | 'stale';

interface Device {
  id:              string;
  name:            string;
  org:             string;
  status:          SyncStatus;
  lastSync:        string;
  recordCount:     number;
  failureReason?:  string;
}

const INITIAL_DEVICES: Device[] = [
  { id: 'dev_001', name: 'Samsung Galaxy S24',  org: 'Acme Corp',       status: 'synced',  lastSync: '2 min ago',   recordCount: 1_240 },
  { id: 'dev_002', name: 'Pixel 8 Pro',          org: 'TechStart Inc.',  status: 'syncing', lastSync: 'In progress', recordCount: 876   },
  { id: 'dev_003', name: 'OnePlus 12',            org: 'Retail Partners', status: 'failed',  lastSync: '4 hours ago', recordCount: 0,    failureReason: 'Network timeout after 5,000 ms — check device connectivity.' },
  { id: 'dev_004', name: 'Galaxy A54',            org: 'SMB Solutions',   status: 'stale',   lastSync: '3 days ago',  recordCount: 543   },
  { id: 'dev_005', name: 'Pixel 7',               org: 'Finance Corp',    status: 'synced',  lastSync: '8 min ago',   recordCount: 2_100 },
  { id: 'dev_006', name: 'Samsung Galaxy S23',    org: 'LegalTech Ltd',   status: 'failed',  lastSync: '6 hours ago', recordCount: 0,    failureReason: 'Authentication token expired — device re-enrollment required.' },
];

const STATUS_CONFIG: Record<SyncStatus, {
  label:   string;
  variant: 'success' | 'info' | 'danger' | 'warning';
  Icon:    React.ComponentType<{ className?: string }>;
  color:   string;
}> = {
  synced:  { label: 'Synced',   variant: 'success', Icon: CheckCircle2, color: '#10b981' },
  syncing: { label: 'Syncing',  variant: 'info',    Icon: RefreshCw,    color: '#06b6d4' },
  failed:  { label: 'Failed',   variant: 'danger',  Icon: AlertCircle,  color: '#ef4444' },
  stale:   { label: 'Stale',    variant: 'warning', Icon: Clock,        color: '#f59e0b' },
};

type FilterType = 'all' | SyncStatus;

export function SyncTab() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [filter, setFilter]   = useState<FilterType>('all');

  const counts = {
    all:     devices.length,
    synced:  devices.filter((d) => d.status === 'synced').length,
    syncing: devices.filter((d) => d.status === 'syncing').length,
    failed:  devices.filter((d) => d.status === 'failed').length,
    stale:   devices.filter((d) => d.status === 'stale').length,
  };

  const filtered = filter === 'all' ? devices : devices.filter((d) => d.status === filter);

  const retryDevice = (id: string) => {
    const device = devices.find((d) => d.id === id);
    if (!device) return;
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: 'syncing', failureReason: undefined } : d,
      ),
    );
    toast.success(`Sync retry triggered for ${device.name}`);
    setTimeout(() => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: 'synced', lastSync: 'just now', recordCount: 1_100 }
            : d,
        ),
      );
    }, 3_000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--tb-text-1)]">Android Sync Monitor</h2>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            {counts.all} devices · {counts.failed + counts.stale} need attention
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.success('Global sync triggered for all devices')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white',
            'hover:bg-brand-600 active:scale-[0.98] transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sync All Devices
        </button>
      </div>

      {/* Filter summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['all', 'synced', 'failed', 'stale'] as FilterType[]).map((s) => {
          const cfg   = s === 'all' ? null : STATUS_CONFIG[s];
          const count = counts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                filter === s
                  ? 'border-brand-300 bg-brand-50 shadow-glow-brand dark:bg-brand-950/40'
                  : 'border-[var(--tb-border)] bg-[var(--tb-surface-0)] hover:border-brand-200',
              )}
            >
              <p className="text-2xl font-bold text-[var(--tb-text-1)]">{count}</p>
              <p
                className="mt-0.5 text-xs font-medium capitalize"
                style={{ color: cfg?.color ?? 'var(--tb-text-2)' }}
              >
                {s === 'all' ? 'Total Devices' : cfg?.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Device cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((device, i) => {
          const cfg = STATUS_CONFIG[device.status];
          return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] p-4 shadow-card"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--tb-surface-2)]">
                    <Smartphone className="h-[18px] w-[18px] text-[var(--tb-text-2)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-none text-[var(--tb-text-1)]">
                      {device.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--tb-text-3)]">{device.org}</p>
                  </div>
                </div>
                <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
              </div>

              <div className="space-y-1.5 text-xs text-[var(--tb-text-3)]">
                <div className="flex items-center justify-between">
                  <span>Last sync</span>
                  <span className="font-medium text-[var(--tb-text-2)]">
                    {device.lastSync}
                  </span>
                </div>
                {device.recordCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Records</span>
                    <span className="font-medium text-[var(--tb-text-2)]">
                      {device.recordCount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {device.failureReason && (
                <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/20 bg-danger/5 p-2.5 text-xs leading-relaxed text-danger">
                  <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>{device.failureReason}</span>
                </div>
              )}

              {(device.status === 'failed' || device.status === 'stale') && (
                <button
                  type="button"
                  onClick={() => retryDevice(device.id)}
                  className={cn(
                    'mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg',
                    'border border-brand-200 bg-brand-50 dark:bg-brand-950/40',
                    'text-xs font-medium text-brand-600 dark:text-brand-300',
                    'hover:bg-brand-100 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  )}
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry Sync
                </button>
              )}

              {device.status === 'syncing' && (
                <div className="mt-3">
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--tb-surface-2)]">
                    <motion.div
                      className="h-full rounded-full bg-info"
                      initial={{ width: '0%' }}
                      animate={{ width: '65%' }}
                      transition={{ duration: 2, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--tb-text-3)]">
                    Sync in progress...
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

── Step 7.4  Create src/components/admin-dashboard/tabs/TeamTab.tsx ───────────

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Search, Shield, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Badge } from '../ui';
import { cn } from '@/lib/utils';

const ROLES = [
  { id: 'super_admin', name: 'Super Admin',  color: '#ef4444', permissions: 'Full access — all modules, RBAC, billing, audit log' },
  { id: 'admin',       name: 'Admin',        color: '#f59e0b', permissions: 'All modules except billing and RBAC management'      },
  { id: 'analyst',     name: 'Tax Analyst',  color: '#3b82f6', permissions: 'Read/write: filings, compliance. Read: overview'     },
  { id: 'developer',   name: 'Developer',    color: '#8b5cf6', permissions: 'Systems tab, API keys, sync monitor'                },
  { id: 'viewer',      name: 'Viewer',       color: '#94a3b8', permissions: 'Read-only access to overview and reports'           },
] as const;

const MEMBERS = [
  { id: 1, name: 'Sarah Chen',    email: 'sarah@company.com',  role: 'super_admin', status: 'active',  lastActive: '2 min ago'   },
  { id: 2, name: 'James Rivera',  email: 'james@company.com',  role: 'admin',       status: 'active',  lastActive: '1 hour ago'  },
  { id: 3, name: 'Aisha Okonkwo', email: 'aisha@company.com',  role: 'analyst',     status: 'active',  lastActive: '3 hours ago' },
  { id: 4, name: 'Liam Torres',   email: 'liam@company.com',   role: 'developer',   status: 'active',  lastActive: '15 min ago'  },
  { id: 5, name: 'Maya Patel',    email: 'maya@company.com',   role: 'viewer',      status: 'pending', lastActive: 'Invite sent' },
] as const;

export function TeamTab() {
  const [search, setSearch] = useState('');

  const roleMap = Object.fromEntries(ROLES.map((r) => [r.id, r]));
  const filtered = MEMBERS.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--tb-text-1)]">Team & Access Control</h2>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            {MEMBERS.length} members · Role-based permissions
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('Opening invite member flow...')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white',
            'hover:bg-brand-600 active:scale-[0.98] transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          )}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite Member
        </button>
      </div>

      {/* Role matrix */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((role) => (
          <Card
            key={role.id}
            padding="sm"
            className="border-l-2"
            style={{ borderLeftColor: role.color }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: role.color }} />
              <span className="text-xs font-semibold text-[var(--tb-text-1)]">{role.name}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--tb-text-3)]">
              {role.permissions}
            </p>
            <p className="mt-2 text-xs font-medium" style={{ color: role.color }}>
              {MEMBERS.filter((m) => m.role === role.id).length} member
              {MEMBERS.filter((m) => m.role === role.id).length !== 1 ? 's' : ''}
            </p>
          </Card>
        ))}
      </div>

      {/* Member list */}
      <Card variant="flush" padding="none">
        {/* Search */}
        <div className="flex items-center gap-3 border-b border-[var(--tb-border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--tb-text-3)]" />
          <input
            type="search"
            placeholder="Search members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search members"
            className="flex-1 bg-transparent text-sm text-[var(--tb-text-1)] placeholder:text-[var(--tb-text-3)] outline-none"
          />
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--tb-border)]">
          {filtered.map((member, i) => {
            const role = roleMap[member.role];
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .join('');
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--tb-surface-1)]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: role?.color ?? '#94a3b8' }}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--tb-text-1)]">
                      {member.name}
                    </p>
                    <p className="text-xs text-[var(--tb-text-3)]">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant={member.status === 'active' ? 'success' : 'warning'}
                  >
                    {member.status}
                  </Badge>
                  <span className="hidden text-xs text-[var(--tb-text-3)] sm:block">
                    {member.lastActive}
                  </span>
                  <div
                    className="flex items-center gap-1.5 rounded-md bg-[var(--tb-surface-2)] px-2 py-1 text-xs font-medium"
                    style={{ color: role?.color }}
                  >
                    <Shield className="h-3 w-3" />
                    <span className="hidden md:block">{role?.name}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Options for ${member.name}`}
                    onClick={() => toast.info(`Editing ${member.name}...`)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--tb-text-3)] transition-colors hover:bg-[var(--tb-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

── Step 7.5  Create src/components/admin-dashboard/tabs/ComplianceTab.tsx ─────

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Filter, Search, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Badge } from '../ui';
import { cn } from '@/lib/utils';

const FRAMEWORKS = [
  { name: 'SOC 2 Type II', status: 'certified', expires: 'Dec 2025', variant: 'success' as const },
  { name: 'ISO 27001',     status: 'certified', expires: 'Aug 2025', variant: 'success' as const },
  { name: 'GDPR',          status: 'compliant', expires: 'N/A',      variant: 'success' as const },
  { name: 'PCI DSS',       status: 'in review', expires: 'Apr 2025', variant: 'warning' as const },
  { name: 'HIPAA',         status: 'N/A',       expires: 'N/A',      variant: 'default' as const },
] as const;

type Severity = 'high' | 'medium' | 'low';

const AUDIT_EVENTS = [
  { id: 'AE-001', ts: '14:32:01', user: 'sarah@company.com', action: 'ROLE_CHANGED',    target: 'james@company.com',   detail: 'Role changed from Viewer → Admin',             severity: 'medium' as Severity, ip: '192.168.1.45' },
  { id: 'AE-002', ts: '14:28:33', user: 'system',            action: 'SYNC_TRIGGERED',  target: 'All devices',         detail: 'Scheduled global sync executed',                severity: 'low'    as Severity, ip: '10.0.0.1'     },
  { id: 'AE-003', ts: '13:55:12', user: 'aisha@company.com', action: 'FILING_APPROVED', target: 'Filing F-98341',      detail: 'Q4 2024 corporate tax filing approved',         severity: 'low'    as Severity, ip: '192.168.1.78' },
  { id: 'AE-004', ts: '13:22:05', user: 'liam@company.com',  action: 'API_KEY_ROTATED', target: 'API Key pk_live_...', detail: 'Production API key rotated and invalidated',    severity: 'high'   as Severity, ip: '192.168.1.91' },
  { id: 'AE-005', ts: '12:10:44', user: 'sarah@company.com', action: 'MEMBER_INVITED',  target: 'maya@company.com',    detail: 'New member invited with Viewer role',           severity: 'low'    as Severity, ip: '192.168.1.45' },
  { id: 'AE-006', ts: '11:05:30', user: 'james@company.com', action: 'EXPORT_DATA',     target: 'Compliance Report',   detail: 'Q1 compliance report exported as PDF',          severity: 'medium' as Severity, ip: '192.168.1.62' },
] as const;

const SEVERITY_STYLES: Record<Severity, string> = {
  high:   'bg-danger/10  text-danger  ',
  medium: 'bg-warning/10 text-warning ',
  low:    'bg-[var(--tb-surface-2)] text-[var(--tb-text-3)]',
};

export function ComplianceTab() {
  const [search, setSearch] = useState('');

  const filtered = AUDIT_EVENTS.filter(
    (e) =>
      e.action.toUpperCase().includes(search.toUpperCase()) ||
      e.user.toLowerCase().includes(search.toLowerCase()) ||
      e.detail.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--tb-text-1)]">Compliance & Audit</h2>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            Zero-trust audit log · Immutable event history · SOC 2 ready
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('Generating compliance report...')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg border px-4',
            'border-[var(--tb-border)] bg-[var(--tb-surface-0)]',
            'text-sm font-medium text-[var(--tb-text-2)]',
            'hover:border-brand-300 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          <Download className="h-3.5 w-3.5" />
          Export Audit Report
        </button>
      </div>

      {/* Framework badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FRAMEWORKS.map((fw) => (
          <Card key={fw.name} padding="sm" className="text-center">
            <Shield className="mx-auto mb-2 h-5 w-5 text-brand-500" />
            <p className="text-xs font-bold text-[var(--tb-text-1)]">{fw.name}</p>
            <Badge variant={fw.variant} size="xs" className="mt-1.5">
              {fw.status}
            </Badge>
            {fw.expires !== 'N/A' && (
              <p className="mt-1 text-[10px] text-[var(--tb-text-3)]">
                Exp. {fw.expires}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Audit log */}
      <Card variant="flush" padding="none">
        <div className="flex items-center gap-3 border-b border-[var(--tb-border)] px-4 py-3">
          <Search className="h-4 w-4 flex-shrink-0 text-[var(--tb-text-3)]" />
          <input
            type="search"
            placeholder="Search by action, user, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit events"
            className="flex-1 bg-transparent text-sm text-[var(--tb-text-1)] placeholder:text-[var(--tb-text-3)] outline-none"
          />
          <button
            type="button"
            aria-label="Filter audit events"
            className="flex items-center gap-1.5 text-xs text-[var(--tb-text-3)] transition-colors hover:text-[var(--tb-text-1)]"
          >
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
        </div>

        <div className="divide-y divide-[var(--tb-border)]">
          {filtered.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-[var(--tb-surface-1)]"
            >
              {/* Severity chip */}
              <span
                className={cn(
                  'mt-0.5 inline-flex flex-shrink-0 items-center rounded px-1.5 py-0.5',
                  'text-[10px] font-bold uppercase',
                  SEVERITY_STYLES[event.severity],
                )}
              >
                {event.severity}
              </span>

              {/* Event body */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-brand-500">
                    {event.action}
                  </span>
                  <span className="text-xs text-[var(--tb-text-3)]">→ {event.target}</span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--tb-text-2)]">{event.detail}</p>
                <p className="mt-1 text-[11px] text-[var(--tb-text-3)]">
                  {event.user} · {event.ip}
                </p>
              </div>

              {/* Timestamp */}
              <span className="mt-0.5 flex-shrink-0 font-mono text-[11px] text-[var(--tb-text-3)]">
                {event.ts}
              </span>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

── Step 7.6  Create src/components/admin-dashboard/tabs/BillingTab.tsx ────────

'use client';

import {
  Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CheckCircle2, CreditCard, Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Badge } from '../ui';
import { cn, formatCurrency } from '@/lib/utils';

const USAGE_DATA = [
  { month: 'Oct', revenue: 248_000 },
  { month: 'Nov', revenue: 261_000 },
  { month: 'Dec', revenue: 273_000 },
  { month: 'Jan', revenue: 269_000 },
  { month: 'Feb', revenue: 278_000 },
  { month: 'Mar', revenue: 284_920 },
] as const;

const PLAN_FEATURES = [
  'Unlimited tax filings',
  'Real-time Android sync',
  'AI Intelligence module',
  'SOC 2 & ISO 27001 certified',
  'SLA: 99.99% uptime',
  'Priority support (4-hour response)',
  'Custom RBAC & SSO',
  'Audit log export',
  'Multi-jurisdiction tax rules',
] as const;

const USAGE_METRICS = [
  { label: 'Filings This Month', value: '98,341',  sub: '/ unlimited', Icon: TrendingUp  },
  { label: 'Active Devices',     value: '1,847',   sub: '/ unlimited', Icon: CreditCard  },
  { label: 'API Calls Today',    value: '284,921', sub: '/ unlimited', Icon: TrendingUp  },
] as const;

export function BillingTab() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--tb-text-1)]">Usage & Billing</h2>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            Enterprise Plan · Billed annually
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('Downloading latest invoice...')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg border px-4',
            'border-[var(--tb-border)] bg-[var(--tb-surface-0)]',
            'text-sm font-medium text-[var(--tb-text-2)]',
            'hover:border-brand-300 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          <Download className="h-3.5 w-3.5" />
          Download Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Enterprise plan card */}
        <Card
          padding="lg"
          className="border-brand-500 bg-gradient-to-br from-brand-600 to-brand-800 text-white"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-200">
              Current Plan
            </span>
            <Badge
              className="border-white/30 bg-white/20 text-white"
              size="sm"
            >
              Enterprise
            </Badge>
          </div>
          <p className="mb-1 text-3xl font-bold">
            $4,990
            <span className="text-lg font-normal text-brand-200">/mo</span>
          </p>
          <p className="mb-5 text-sm text-brand-200">
            Billed annually · Renews Mar 1, 2026
          </p>
          <div className="space-y-2">
            {PLAN_FEATURES.slice(0, 6).map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-brand-100">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-brand-300" />
                {f}
              </div>
            ))}
          </div>
        </Card>

        {/* Usage + chart */}
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            {USAGE_METRICS.map(({ label, value, sub, Icon }) => (
              <Card key={label} padding="sm">
                <p className="mb-1 text-xs text-[var(--tb-text-3)]">{label}</p>
                <p className="text-xl font-bold text-[var(--tb-text-1)]">{value}</p>
                <p className="text-[11px] text-[var(--tb-text-3)]">{sub}</p>
              </Card>
            ))}
          </div>

          <Card padding="lg">
            <h3 className="mb-3 text-sm font-semibold text-[var(--tb-text-1)]">
              Monthly Revenue (6 months)
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={USAGE_DATA}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--tb-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--tb-text-3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1_000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--tb-text-3)' }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  contentStyle={{
                    background:   'var(--tb-surface-0)',
                    border:       '1px solid var(--tb-border)',
                    borderRadius: 12,
                    fontSize:     12,
                  }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

── Step 7.7  Create src/components/admin-dashboard/tabs/IntelligenceTab.tsx ───

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Brain, Lightbulb, RefreshCw, Target, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui';
import { cn } from '@/lib/utils';

type InsightType  = 'opportunity' | 'risk' | 'optimization' | 'compliance';
type Priority     = 'high' | 'medium' | 'low';

interface Insight {
  id:      number;
  type:    InsightType;
  priority: Priority;
  title:   string;
  body:    string;
  action:  string;
  impact:  string;
  Icon:    React.ComponentType<{ className?: string }>;
  color:   string;
}

const INSIGHTS: Insight[] = [
  {
    id: 1, type: 'opportunity', priority: 'high',
    title:  'Q1 Filing Volume Surge Predicted',
    body:   'Historical patterns and current pipeline indicate a 34% volume increase by March 28. Pre-scaling sync workers now will prevent an estimated 847 delayed filings.',
    action: 'Scale Workers',
    impact: 'Prevents $42k in SLA penalties',
    Icon:   TrendingUp, color: '#10b981',
  },
  {
    id: 2, type: 'risk', priority: 'high',
    title:  'Stale Devices — Revenue at Risk',
    body:   '4 devices have not synced in 48+ hours across 3 enterprise accounts. This pattern historically correlates with churn within 30 days. Proactive outreach is recommended.',
    action: 'Contact Accounts',
    impact: '$38k ARR at risk',
    Icon:   AlertTriangle, color: '#ef4444',
  },
  {
    id: 3, type: 'optimization', priority: 'medium',
    title:  'Tax Rule Cache TTL Opportunity',
    body:   'Jurisdiction CA-2025-Q1 is queried 2,400× daily with a 1-hour cache TTL. Increasing to 24 hours would reduce API latency by ~18% and cut database read load.',
    action: 'Apply Optimization',
    impact: '18% latency reduction',
    Icon:   Lightbulb, color: '#3b82f6',
  },
  {
    id: 4, type: 'compliance', priority: 'medium',
    title:  'New IRS Regulation: Rev. Proc. 2025-14',
    body:   'IRS Revenue Procedure 2025-14 takes effect April 1, 2025. AI analysis indicates 12% of current filing templates require updates. An automated patch is available.',
    action: 'Apply Patch',
    impact: 'Compliance maintained',
    Icon:   Target, color: '#8b5cf6',
  },
];

const PRIORITY_VARIANT: Record<Priority, 'danger' | 'warning' | 'default'> = {
  high:   'danger',
  medium: 'warning',
  low:    'default',
};

export function IntelligenceTab() {
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('AI insights refreshed — 4 new signals analysed');
    }, 2_000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--tb-text-1)]">AI Tax Intelligence</h2>
          <p className="mt-0.5 text-sm text-[var(--tb-text-2)]">
            Powered by TaxBridge AI · Updated 4 minutes ago
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg border px-4',
            'border-[var(--tb-border)] bg-[var(--tb-surface-0)]',
            'text-sm font-medium text-[var(--tb-text-2)]',
            'hover:border-brand-300 transition-colors',
            'disabled:pointer-events-none disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh Insights
        </button>
      </div>

      {/* Intelligence summary banner */}
      <div className={cn(
        'rounded-xl border border-brand-800/60 p-5',
        'bg-gradient-to-r from-brand-950 to-[#0d1f3c]',
      )}>
        <div className="mb-2 flex items-center gap-2">
          <Brain className="h-4 w-4 text-brand-300" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-brand-300">
            Intelligence Summary
          </span>
        </div>
        <p className="text-base font-medium leading-relaxed text-white">
          Platform health is{' '}
          <span className="font-semibold text-success">strong</span>.
          Revenue trending{' '}
          <span className="font-semibold text-success">+12.4% MoM</span>.
          Two high-priority items need action before end of week to maintain
          compliance SLAs and prevent potential enterprise churn.
        </p>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {INSIGHTS.map((insight, i) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] p-5 shadow-card"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${insight.color}18`,
                    border:          `1px solid ${insight.color}30`,
                  }}
                >
                  <insight.Icon className="h-4 w-4" style={{ color: insight.color }} />
                </div>
                <h3 className="text-sm font-semibold leading-snug text-[var(--tb-text-1)]">
                  {insight.title}
                </h3>
              </div>
              <Badge variant={PRIORITY_VARIANT[insight.priority]} className="flex-shrink-0">
                {insight.priority}
              </Badge>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-[var(--tb-text-2)]">
              {insight.body}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--tb-text-3)]">
                Impact:{' '}
                <span className="font-medium text-[var(--tb-text-2)]">
                  {insight.impact}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toast.success(`Action initiated: ${insight.action}`)}
                className="flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                style={{
                  backgroundColor: `${insight.color}18`,
                  color:           insight.color,
                  border:          `1px solid ${insight.color}30`,
                }}
              >
                {insight.action}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

── Step 7.8  Create src/components/admin-dashboard/tabs/index.ts ──────────────

  export { OverviewTab     } from './OverviewTab';
  export { SystemsTab      } from './SystemsTab';
  export { SyncTab         } from './SyncTab';
  export { TeamTab         } from './TeamTab';
  export { ComplianceTab   } from './ComplianceTab';
  export { BillingTab      } from './BillingTab';
  export { IntelligenceTab } from './IntelligenceTab';

════════════════════════════════════════════════════════════════════════════════
PHASE 8 — ONBOARDING SYSTEM
src/components/admin-dashboard/onboarding/
════════════════════════════════════════════════════════════════════════════════

── Step 8.1  Create src/components/admin-dashboard/onboarding/steps.ts ────────

import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Activity, Shield } from 'lucide-react';
import type { TabId } from '@/store/enterpriseStore';

export interface OnboardingStep {
  index:      0 | 1 | 2;
  Icon:       LucideIcon;
  title:      string;
  subtitle:   string;
  body:       string;
  navigateTo: TabId;
  cta:        string;
  demo:       { label: string; value: string; color: string }[];
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    index:      0,
    Icon:       LayoutDashboard,
    title:      'Welcome to TaxBridge Enterprise',
    subtitle:   'Your mission control for tax automation at scale.',
    body:       'The Control Center gives your team real-time visibility into every filing, device sync, and compliance signal — from one unified surface. You\'ll be fully oriented in under 5 minutes.',
    navigateTo: 'overview',
    cta:        'Show me the overview',
    demo: [
      { label: 'Revenue tracked',   value: '$284,920',     color: '#10b981' },
      { label: 'Filings processed', value: '98,341',       color: '#3b82f6' },
      { label: 'Devices syncing',   value: '1,847 active', color: '#8b5cf6' },
    ],
  },
  {
    index:      1,
    Icon:       Activity,
    title:      'Real-Time Systems Observability',
    subtitle:   'Infrastructure health — no Datadog required.',
    body:       'The Systems tab surfaces live API latency, queue depth, error rates, and a streaming log feed. Your engineers and ops team get the signals they need in one pane of glass.',
    navigateTo: 'systems',
    cta:        'Explore systems health',
    demo: [
      { label: 'API P95 latency', value: '42 ms',  color: '#3b82f6' },
      { label: 'Error rate',      value: '0.12%',  color: '#10b981' },
      { label: 'Queue depth',     value: '847',    color: '#f59e0b' },
    ],
  },
  {
    index:      2,
    Icon:       Shield,
    title:      'Enterprise Security & Compliance',
    subtitle:   'SOC 2 Type II certified. Zero-trust by default.',
    body:       'Every action in TaxBridge writes to an immutable audit trail. Manage roles, assign permissions, and generate one-click compliance reports — always audit-ready for your enterprise clients.',
    navigateTo: 'compliance',
    cta:        'Go to live data',
    demo: [
      { label: 'Compliance rate', value: '97.8%',         color: '#10b981' },
      { label: 'Audit events',    value: '12,841 logged',  color: '#3b82f6' },
      { label: 'Frameworks',      value: 'SOC 2 + ISO',    color: '#8b5cf6' },
    ],
  },
];

── Step 8.2  Create src/components/admin-dashboard/onboarding/OnboardingModal.tsx

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, X, Zap } from 'lucide-react';
import { useEnterpriseStore } from '@/store/enterpriseStore';
import { ONBOARDING_STEPS } from './steps';
import { cn } from '@/lib/utils';

export function OnboardingModal() {
  const { onboarding, advanceOnboarding, skipOnboarding, setActiveTab } =
    useEnterpriseStore();

  const stepIndex = Math.min(onboarding.currentStep, 2) as 0 | 1 | 2;
  const step      = ONBOARDING_STEPS[stepIndex];
  const isLast    = stepIndex === 2;

  const handleCTA = () => {
    setActiveTab(step.navigateTo);
    if (isLast) skipOnboarding();
    else        advanceOnboarding();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="ob-backdrop"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
      />

      {/* Dialog */}
      <motion.div
        key="ob-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        aria-describedby="ob-body"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-1/2 top-1/2 z-[71] w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 px-4 sm:px-0"
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--tb-border)] bg-[var(--tb-surface-0)] shadow-popover">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-400/20 bg-brand-500/10">
                <Zap className="h-3.5 w-3.5 text-brand-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--tb-text-3)]">
                Getting Started — Enterprise Tour
              </span>
            </div>
            <button
              type="button"
              onClick={skipOnboarding}
              aria-label="Close onboarding tour"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--tb-text-3)] transition-colors hover:bg-[var(--tb-surface-2)] hover:text-[var(--tb-text-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-2 px-5 pt-4">
            {ONBOARDING_STEPS.map((s, i) => {
              const done   = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                      'text-[10px] font-bold transition-all duration-300',
                      done
                        ? 'bg-success text-white'
                        : active
                        ? 'bg-brand-500 text-white ring-2 ring-brand-300 ring-offset-1 ring-offset-[var(--tb-surface-0)]'
                        : 'bg-[var(--tb-surface-2)] text-[var(--tb-text-3)]',
                    )}
                    aria-label={
                      done ? `Step ${i + 1} complete` :
                      active ? `Step ${i + 1} current` :
                      `Step ${i + 1} upcoming`
                    }
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  {i < 2 && (
                    <div
                      className={cn(
                        'h-px w-8 transition-colors duration-500',
                        done ? 'bg-success' : 'bg-[var(--tb-border)]',
                      )}
                    />
                  )}
                </div>
              );
            })}
            <span className="ml-auto text-xs text-[var(--tb-text-3)]">
              Step {stepIndex + 1} of 3
            </span>
          </div>

          {/* Animated step body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="px-5 pb-0 pt-5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-400/20 bg-brand-500/10">
                <step.Icon className="h-5 w-5 text-brand-500" />
              </div>
              <h2
                id="ob-title"
                className="mb-1 text-lg font-bold text-[var(--tb-text-1)]"
              >
                {step.title}
              </h2>
              <p className="mb-3 text-sm font-semibold text-brand-600 dark:text-brand-300">
                {step.subtitle}
              </p>
              <p
                id="ob-body"
                className="mb-5 text-sm leading-relaxed text-[var(--tb-text-2)]"
              >
                {step.body}
              </p>

              {/* Live demo data preview */}
              <div className="mb-5 grid grid-cols-3 gap-2">
                {step.demo.map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--tb-border)] bg-[var(--tb-surface-1)] p-3"
                  >
                    <p
                      className="text-base font-bold leading-none"
                      style={{ color }}
                    >
                      {value}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--tb-text-3)]">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 px-5 pb-5">
            <button
              type="button"
              onClick={skipOnboarding}
              className="text-sm text-[var(--tb-text-3)] transition-colors hover:text-[var(--tb-text-2)] focus-visible:outline-none focus-visible:underline"
            >
              Skip to live data →
            </button>
            <button
              type="button"
              onClick={handleCTA}
              className={cn(
                'flex h-9 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white',
                'hover:bg-brand-600 active:scale-[0.98] transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              )}
            >
              {step.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

── Step 8.3  Create src/components/admin-dashboard/onboarding/OnboardingOrchestrator.tsx

'use client';

import { AnimatePresence } from 'framer-motion';
import { useOnboardingState } from '@/store/enterpriseStore';
import { OnboardingModal }    from './OnboardingModal';

export function OnboardingOrchestrator() {
  const { isFirstVisit, currentStep } = useOnboardingState();
  return (
    <AnimatePresence>
      {isFirstVisit && currentStep < 3 && (
        <OnboardingModal key="onboarding-modal" />
      )}
    </AnimatePresence>
  );
}

════════════════════════════════════════════════════════════════════════════════
PHASE 9 — MASTER ENTRY POINT
src/components/admin-dashboard/
════════════════════════════════════════════════════════════════════════════════

── Step 9.1  Create src/components/admin-dashboard/EnterpriseApp.tsx ──────────

'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useActiveTab } from '@/store/enterpriseStore';
import { EnterpriseLayout } from './shell/Layout';
import { TabSkeleton } from './ui';

/* ── SSR-safe lazy-loaded tab components ────────────────────────────────── */
/* next/dynamic is used instead of React.lazy to ensure SSR compatibility.  */

const OverviewTab     = dynamic(() => import('./tabs/OverviewTab').then(m => ({ default: m.OverviewTab })),     { loading: () => <TabSkeleton />, ssr: false });
const SystemsTab      = dynamic(() => import('./tabs/SystemsTab').then(m => ({ default: m.SystemsTab })),       { loading: () => <TabSkeleton />, ssr: false });
const SyncTab         = dynamic(() => import('./tabs/SyncTab').then(m => ({ default: m.SyncTab })),             { loading: () => <TabSkeleton />, ssr: false });
const TeamTab         = dynamic(() => import('./tabs/TeamTab').then(m => ({ default: m.TeamTab })),             { loading: () => <TabSkeleton />, ssr: false });
const ComplianceTab   = dynamic(() => import('./tabs/ComplianceTab').then(m => ({ default: m.ComplianceTab })), { loading: () => <TabSkeleton />, ssr: false });
const BillingTab      = dynamic(() => import('./tabs/BillingTab').then(m => ({ default: m.BillingTab })),       { loading: () => <TabSkeleton />, ssr: false });
const IntelligenceTab = dynamic(() => import('./tabs/IntelligenceTab').then(m => ({ default: m.IntelligenceTab })), { loading: () => <TabSkeleton />, ssr: false });

/* ── Per-tab error fallback ─────────────────────────────────────────────── */

function TabErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error:               Error;
  resetErrorBoundary:  () => void;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 p-8 text-center">
      <p className="mb-2 text-sm font-semibold text-danger">
        This tab encountered an error
      </p>
      <p className="mb-4 max-w-sm text-xs text-[var(--tb-text-3)]">{error.message}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="rounded-lg bg-danger px-4 py-2 text-xs font-semibold text-white hover:bg-danger/90 transition-colors"
      >
        Reload Tab
      </button>
    </div>
  );
}

function withBoundary(Component: React.ComponentType<Record<string, never>>) {
  // Giving the inner component a stable display name aids React DevTools debugging.
  const BoundedTab = function BoundedTab() {
    return (
      <ErrorBoundary FallbackComponent={TabErrorFallback}>
        <Component />
      </ErrorBoundary>
    );
  };
  BoundedTab.displayName = `WithBoundary(${Component.displayName ?? Component.name ?? 'Tab'})`;
  return BoundedTab;
}

/* ── Tab router ─────────────────────────────────────────────────────────── */

const TAB_MAP: Record<string, React.ComponentType> = {
  overview:     withBoundary(OverviewTab),
  systems:      withBoundary(SystemsTab),
  sync:         withBoundary(SyncTab),
  team:         withBoundary(TeamTab),
  compliance:   withBoundary(ComplianceTab),
  billing:      withBoundary(BillingTab),
  intelligence: withBoundary(IntelligenceTab),
};

function ActiveTabContent() {
  const tab       = useActiveTab();
  const TabComp   = TAB_MAP[tab] ?? TAB_MAP.overview;
  return (
    <Suspense fallback={<TabSkeleton />}>
      <TabComp />
    </Suspense>
  );
}

/* ── Root app component ─────────────────────────────────────────────────── */

export function EnterpriseApp() {
  return (
    <EnterpriseLayout>
      <ActiveTabContent />
    </EnterpriseLayout>
  );
}

── Step 9.2  Create src/components/admin-dashboard/index.ts ───────────────────

  // Public API for the admin-dashboard module.
  // Import only EnterpriseApp in consuming pages — all other exports are
  // available for unit tests and Storybook stories.

  export { EnterpriseApp }           from './EnterpriseApp';
  export { EnterpriseLayout }        from './shell/Layout';
  export * from './ui';
  export * from './tabs';
  export * from './onboarding/steps';

════════════════════════════════════════════════════════════════════════════════
PHASE 10 — ROUTE SURGERY
Modify exactly: ADMIN_ENTRY and NESTED_ROUTE_FILES.
Modify no other file.
════════════════════════════════════════════════════════════════════════════════

── Step 10.1  Pre-surgery snapshot ────────────────────────────────────────────

  # Create a timestamped safety snapshot of every file you are about to modify.
  # These .bak files are already gitignored (Step 4.2) — safe to create freely.
  cp "$ADMIN_ENTRY" "${ADMIN_ENTRY}.pre-enterprise.bak"
  for f in $NESTED_ROUTE_FILES; do
    cp "$f" "${f}.pre-enterprise.bak"
  done

  # Confirm snapshots were created:
  find . -name "*.pre-enterprise.bak" -not -path "*/node_modules/*"
  # Expected: one line per file you are about to modify.
  #
  # These files give you instant per-file rollback without needing git:
  #   cp "${ADMIN_ENTRY}.pre-enterprise.bak" "$ADMIN_ENTRY"
  # They will be deleted in Step 15.2 after production is verified stable.

── Step 10.2  Rewrite ADMIN_ENTRY ─────────────────────────────────────────────

  Open ADMIN_ENTRY. Read it completely. Then apply the following transformation:

  TRANSFORMATION RULES:
    1. Keep every existing import that relates to providers, auth, or context
       (e.g., QueryClientProvider, AuthGuard, SessionProvider, ThemeProvider).
    2. Comment out — do NOT delete — every import of an old dashboard component.
       Prefix each commented line with "// TB-REMOVED:".
    3. Add ONE new import at the end of the import block:
         import { EnterpriseApp } from '@/components/admin-dashboard';
    4. Keep the outer JSX (providers, guards) exactly as-is.
    5. Replace ONLY the innermost dashboard component with <EnterpriseApp />.

  BEFORE EXAMPLE (adapt to your actual file):
  ┌────────────────────────────────────────────────────────────────────────┐
  │ import { QueryClientProvider } from '@tanstack/react-query';           │
  │ import { queryClient }         from '@/lib/queryClient';               │
  │ import { AuthGuard }           from '@/components/auth/AuthGuard';     │
  │ import { AdminShell }          from '@/components/AdminShell';         │
  │                                                                        │
  │ export default function AdminPage() {                                  │
  │   return (                                                             │
  │     <QueryClientProvider client={queryClient}>                         │
  │       <AuthGuard>                                                      │
  │         <AdminShell />                                                 │
  │       </AuthGuard>                                                     │
  │     </QueryClientProvider>                                             │
  │   );                                                                   │
  │ }                                                                      │
  └────────────────────────────────────────────────────────────────────────┘

  AFTER EXAMPLE:
  ┌────────────────────────────────────────────────────────────────────────┐
  │ import { QueryClientProvider } from '@tanstack/react-query';           │
  │ import { queryClient }         from '@/lib/queryClient';               │
  │ import { AuthGuard }           from '@/components/auth/AuthGuard';     │
  │ // TB-REMOVED: import { AdminShell } from '@/components/AdminShell';   │
  │ import { EnterpriseApp }       from '@/components/admin-dashboard';    │
  │                                                                        │
  │ export default function AdminPage() {                                  │
  │   return (                                                             │
  │     <QueryClientProvider client={queryClient}>                         │
  │       <AuthGuard>                                                      │
  │         <EnterpriseApp />                                              │
  │       </AuthGuard>                                                     │
  │     </QueryClientProvider>                                             │
  │   );                                                                   │
  │ }                                                                      │
  └────────────────────────────────────────────────────────────────────────┘

  ⚠ CRITICAL: If ADMIN_ENTRY is a Next.js App Router layout.tsx (not page.tsx),
    do NOT replace children — instead, add EnterpriseApp as a sibling wrapper
    around {children}. Contact the team if unsure.

── Step 10.3  Handle NESTED_ROUTE_FILES ───────────────────────────────────────

  For EACH file in NESTED_ROUTE_FILES (e.g., /admin/sync/page.tsx,
  /admin/team/page.tsx, /admin/compliance/page.tsx):

  OPTION A — App Router (Next.js 13+):
  Replace the file's entire contents with:

    import { redirect } from 'next/navigation';

    // TB-NOTE: This route is now handled internally by EnterpriseApp via Zustand.
    // The sidebar navigation updates the active tab without a full page navigation.
    // ADMIN_BASE_PATH is derived in Step 0.9 — substitute its value below.
    export default function RedirectPage() {
      redirect(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? '/admin');
    }

  OPTION B — Pages Router (Next.js 12 or below):
  Replace the file's entire contents with:

    import { useEffect } from 'react';
    import { useRouter } from 'next/router';

    // TB-NOTE: This route is now handled internally by EnterpriseApp via Zustand.
    export default function RedirectPage() {
      const router = useRouter();
      useEffect(() => {
        router.replace(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? '/admin');
      }, [router]);
      return null;
    }

  After adding these redirect files, also add the variable to .env.local (Step C.1):
    NEXT_PUBLIC_ADMIN_BASE_PATH=$ADMIN_BASE_PATH
  And to Vercel environment variables (Step C.2):
    vercel env add NEXT_PUBLIC_ADMIN_BASE_PATH production <<< "$ADMIN_BASE_PATH"

── Step 10.4  Verify root layout neutrality ───────────────────────────────────

  Open ADMIN_LAYOUT (the layout file identified in Step 0.9).
  Confirm:
    [ ] It does NOT render an old sidebar, navbar, or topbar component
        that would visually conflict with EnterpriseApp's own shell.
    [ ] If it does, wrap those legacy components:
          {!isAdminDashboard && <OldSidebar />}
        using the appropriate routing hook to detect the current path.
    [ ] The <html> tag has NO hardcoded class="dark" — dark mode is now
        controlled by EnterpriseThemeProvider.
    [ ] QueryClientProvider in ADMIN_LAYOUT: ensure its `client` instance
        matches the one used by EnterpriseApp (or remove it from Layout
        if ADMIN_ENTRY already wraps the app with one — do not double-wrap).

════════════════════════════════════════════════════════════════════════════════
PHASE 11 — PRE-DEPLOY QUALITY GATES
Run every check. Fix every failure. Do not proceed with git commits
until all gates pass green.
════════════════════════════════════════════════════════════════════════════════

── Step 11.1  TypeScript compile check ────────────────────────────────────────

  npx tsc --noEmit 2>&1 | head -60

  # Required: zero errors.
  # Common fixes:
  #   - "motion.div ref type" → use (ref as React.RefObject<HTMLDivElement>)
  #   - "'as any' not allowed" → use type-safe overload shown in Card.tsx above
  #   - "TabId not assignable" → ensure all tab string literals match the union

── Step 11.2  Build check ─────────────────────────────────────────────────────

  npm run build 2>&1 | tail -30

  # Required: exits 0 with "✓ Compiled successfully" or equivalent.
  # If build fails on a specific tab, wrap that tab in the ErrorBoundary
  # and re-run.

── Step 11.3  Lint check ──────────────────────────────────────────────────────

  npm run lint 2>&1 | grep -E "(error|warning)" | head -30
  # Fix all errors. Warnings are acceptable if pre-existing.

── Step 11.4  Local runtime verification ──────────────────────────────────────

  npm run dev &
  DEV_PID=$!

  # Wait for the dev server to be ready (up to 30 seconds):
  NEXT_DEV_PORT=${NEXT_DEV_PORT:-3000}
  ADMIN_DEV_URL="http://localhost:${NEXT_DEV_PORT}${ADMIN_BASE_PATH}"
  echo "Waiting for dev server on port ${NEXT_DEV_PORT}..."
  for i in $(seq 1 15); do
    curl -sf -o /dev/null "$ADMIN_DEV_URL" && echo "✓ Dev server ready" && break
    sleep 2
  done

  # Page loads with HTTP 200:
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_DEV_URL")
  echo "Admin HTTP status: $HTTP"
  [ "$HTTP" = "200" ] || echo "✗ Expected 200, got $HTTP — check next dev output"

  # Open in browser and verify zero console errors:
  # Mac:     open "$ADMIN_DEV_URL"
  # Linux:   xdg-open "$ADMIN_DEV_URL" 2>/dev/null || echo "Open manually: $ADMIN_DEV_URL"
  # Windows: start "$ADMIN_DEV_URL"
  echo "Open: $ADMIN_DEV_URL — check DevTools Console for zero uncaught errors"

── Step 11.5  CFO 10-second test ──────────────────────────────────────────────

  1. Open $ADMIN_DEV_URL in a fresh incognito window.
  2. Start a stopwatch immediately upon page load completing.
  3. Confirm ALL of the following WITHOUT scrolling, at 1366×768 viewport:
     [ ] 4 KPI cards visible above the fold
     [ ] Each card shows: label, large value, sparkline, trend arrow, delta %
     [ ] AI insights banner visible below KPI row
  4. Stop stopwatch. Time MUST be < 10 seconds.
  If any card is below the fold: reduce TopBar height from h-[60px] to h-[52px]
  AND reduce the OverviewTab outer div padding from p-4 to p-3, then re-test.

── Step 11.6  Accessibility audit ─────────────────────────────────────────────

  npm install -g @axe-core/cli 2>/dev/null || true
  npx axe "$ADMIN_DEV_URL" \
    --include main \
    --tags wcag2a,wcag2aa \
    --reporter verbose 2>&1 | grep -E "(Violation|Pass|Incomplete)" | head -30

  # Required: zero critical or serious violations.
  # Fix any failure before proceeding to Phase 12.

── Step 11.7  Bundle size analysis ────────────────────────────────────────────

  # Install the Next.js bundle analyzer (dev dependency only):
  npm install --save-dev @next/bundle-analyzer

  # Add to next.config.js / next.config.ts — wrap the existing config:
  #
  #   const withBundleAnalyzer = require('@next/bundle-analyzer')({
  #     enabled: process.env.ANALYZE === 'true',
  #   });
  #   module.exports = withBundleAnalyzer(nextConfig);
  #
  # Run the analysis:
  ANALYZE=true npm run build 2>&1 | tail -5
  # This opens two browser tabs (client + server bundle treemaps).

  # Required targets:
  #   [ ] Each tab chunk (OverviewTab, SystemsTab, etc.) < 200 kB gzipped
  #   [ ] framer-motion and recharts appear in the SHARED vendor chunk,
  #       not duplicated in each tab chunk
  #   [ ] Total First Load JS for /admin < 400 kB

  # If a tab chunk is over 200 kB, look for barrel import re-exports pulling
  # in the entire lucide-react library. Fix: import icons individually:
  #   import { Brain } from 'lucide-react/dist/esm/icons/brain';
  #   (or use the default named import — lucide-react is tree-shakeable in v0.400+)

── Step 11.8  Kill dev server ─────────────────────────────────────────────────

  # Use the PID captured in Step 11.4 for a precise, reliable kill:
  kill "$DEV_PID" 2>/dev/null \
    || pkill -f "next dev" 2>/dev/null \
    || true
  echo "Dev server stopped"

════════════════════════════════════════════════════════════════════════════════
PHASE 12 — GIT COMMIT & PUSH
All quality gates must be green before this phase.
════════════════════════════════════════════════════════════════════════════════

── Step 12.1  Stage files precisely ───────────────────────────────────────────

  # Stage all new files under the admin-dashboard namespace:
  git add src/components/admin-dashboard/
  git add src/store/enterpriseStore.ts
  git add src/lib/utils.ts

  # Stage the two modified config files:
  git add "$TAILWIND_CONFIG"
  git add "$CSS_ENTRY"

  # Stage the font additions to root layout:
  git add src/app/layout.tsx  # OR src/pages/_app.tsx — use the correct path

  # Stage only ADMIN_ENTRY and the nested route redirects:
  git add "$ADMIN_ENTRY"
  for f in $NESTED_ROUTE_FILES; do git add "$f"; done

  # Stage package files:
  git add package.json package-lock.json

  # Verify nothing unintended is staged:
  git diff --staged --name-only

  # Expected output: only the files listed above.
  # If unexpected files appear: git restore --staged <unexpected-file>

── Step 12.2  Commit with full conventional message ───────────────────────────

  git commit -m "feat(admin): enterprise control center — 7-tab shell with real-time observability

  ## Summary
  Complete rebuild of the admin dashboard into a world-class Enterprise Control
  Center. The implementation is additive-first: all new code lives under
  src/components/admin-dashboard/. The admin entry point is the only existing
  file with substantive changes.

  ## New modules
  - Overview: CFO KPI hero row (4 cards + sparklines + trend arrows), AI insights
    banner, revenue area chart, sync health widget, recent activity feed (5 live
    items), global tax compliance radar (6 jurisdictions: FIRS/IRS/HMRC/SARS/KRA/GRA)
    — all above-fold on 1366×768
  - Systems: live API latency/error-rate/queue-depth/DLQ metrics (1.5 s poll),
    service status list with StatusDot, live log stream with Framer Motion stagger
  - Android Sync: per-device status cards, failure reason display, one-click retry
    with optimistic UI, global sync CTA, filter by status
  - Team & RBAC: role matrix (5 roles), searchable member table, invite flow
  - Compliance: SOC 2 / ISO 27001 / GDPR / PCI DSS framework badges, searchable
    immutable audit log with severity chips
  - Billing: gradient Enterprise plan card, usage metrics, 6-month revenue bar chart
  - Intelligence: 4 AI insight cards (opportunity/risk/optimisation/compliance),
    action buttons, refresh with loading state

  ## Shell
  - Collapsible sidebar (240 px ↔ 60 px) with Framer Motion animation
  - Sticky topbar with breadcrumb, ⌘K command bar trigger, theme cycle, notification
    panel, avatar
  - Command bar (cmdk) with keyboard navigation and 10 commands
  - 3-step onboarding modal with animated step transitions and demo data preview
  - Dark / light / system theme via CSS custom properties + next/font Inter
  - Skip-to-content link (WCAG 2.4.1), all buttons aria-labeled, focus rings
  - Zustand store (v2, persisted) with granular selector hooks

  ## Architecture decisions
  - next/dynamic (ssr: false) for all tabs — prevents hydration mismatch from
    persisted Zustand state
  - Per-tab ErrorBoundary via react-error-boundary
  - CSS custom properties prefixed --tb- to prevent collision with existing tokens
  - Tailwind tokens merged (not replaced) — no existing styles removed

  ## Non-breaking guarantees
  - Zero changes to API routes, auth middleware, database models, server actions,
    or data-fetching hooks
  - All existing providers preserved in ADMIN_ENTRY wrapper
  - OLD_COMPONENT_FILES marked @deprecated — not deleted (2-week monitoring window)
  - .pre-enterprise.bak snapshot files created for per-file rollback

  ## Testing
  - TypeScript: zero errors (npx tsc --noEmit)
  - Build:      passes (npm run build)
  - A11y:       zero critical violations (axe WCAG 2.2 AA)
  - CFO test:   4 KPI cards visible in < 10 s on 1366×768 incognito
  - Rollback:   git revert HEAD restores previous state in < 2 minutes

  BREAKING CHANGE: Admin entry point now renders EnterpriseApp. Nested admin
  sub-routes (e.g. ADMIN_BASE_PATH/sync, ADMIN_BASE_PATH/team) now redirect to
  ADMIN_BASE_PATH via NEXT_PUBLIC_ADMIN_BASE_PATH env var (default: /admin).
  "

── Step 12.3  Push to origin ──────────────────────────────────────────────────

  git push origin feature/enterprise-control-center

  # Verify push succeeded:
  git log --oneline -3
  # Should show the new commit at HEAD.

════════════════════════════════════════════════════════════════════════════════
PHASE 13 — PULL REQUEST & MERGE TO MASTER
════════════════════════════════════════════════════════════════════════════════

── Step 13.1  Create pull request via GitHub CLI ──────────────────────────────

  gh pr create \
    --base "$BASE_BRANCH" \
    --head feature/enterprise-control-center \
    --title "feat(admin): Enterprise Control Center — 7-tab shell with real-time observability" \
    --body "$(cat << 'PR_BODY'
## What this PR does
Rebuilds the TaxBridge admin dashboard into the Enterprise Control Center.
All 7 tabs are fully implemented. Architecture is additive-first.

## Verification checklist
- [x] TypeScript: `npx tsc --noEmit` — zero errors
- [x] Build: `npm run build` — exits 0
- [x] Lint: zero new errors
- [x] CFO 10-second test: 4 KPI cards visible above fold on 1366×768
- [x] Onboarding: 3-step modal appears on first visit, persists skip state
- [x] Command bar: ⌘K opens, all 10 commands navigate correctly
- [x] Theme: light → dark → system cycles with no flash
- [x] Sidebar: collapses to 60 px, tooltips show, expands to 240 px
- [x] Accessibility: zero axe critical/serious violations (WCAG 2.2 AA)
- [x] All 7 tabs render without console errors
- [x] Retry sync: optimistic update → syncing → synced in 3 s
- [x] Existing API routes unchanged (verified in Network tab)

## Files changed
- **New:** src/components/admin-dashboard/ (entire tree)
- **New:** src/store/enterpriseStore.ts
- **Modified:** ADMIN_ENTRY (one import swap, one JSX swap)
- **Modified:** src/lib/utils.ts (5 new exports: cn, formatCurrency, formatNumber, timeAgo, clamp — additive)
- **Modified:** tailwind.config — theme.extend merge (additive)
- **Modified:** globals.css — --tb- token prepend (additive)
- **Modified:** root layout — next/font Inter addition

## Rollback
\`git revert HEAD\` fully restores the previous state in < 2 minutes.
PR_BODY
)" \
    --label "enhancement" \
    --label "admin" \
    --assignee "@me"

  # Capture the PR URL:
  gh pr view --json url -q .url
  # Store as: PR_URL

── Step 13.2  Wait for CI / status checks ─────────────────────────────────────

  # Poll until all checks pass (max 10 minutes, 20 × 30-second intervals):
  for i in $(seq 1 20); do
    # gh pr checks returns one line per check with its state
    RESULTS=$(gh pr checks feature/enterprise-control-center \
      --json name,state,conclusion 2>/dev/null)
    PENDING=$(echo "$RESULTS" | grep -ic '"state":"PENDING"\|"state":"IN_PROGRESS"\|"state":"QUEUED"' || true)
    FAILED=$(echo  "$RESULTS" | grep -ic '"conclusion":"FAILURE"\|"conclusion":"ERROR"'               || true)
    PASSED=$(echo  "$RESULTS" | grep -ic '"conclusion":"SUCCESS"'                                      || true)
    echo "[$i/20] passed=$PASSED pending=$PENDING failed=$FAILED"
    if [ "$FAILED" -gt 0 ]; then
      echo "✗ CI failed — review logs at: $PR_URL"
      echo "  Run: gh pr checks feature/enterprise-control-center --watch"
      exit 1
    fi
    if [ "$PENDING" -eq 0 ] && [ "$PASSED" -gt 0 ]; then
      echo "✓ All CI checks passed"
      break
    fi
    sleep 30
  done

  # If no CI is configured on the repo, this loop exits on first iteration
  # (zero pending, zero passed). That is fine — skip to Step 13.3.
  # To confirm: gh repo view --json hasIssuesEnabled -q .hasIssuesEnabled
  # (CI config is separate from issues, but if the repo has no workflows:)
  #   ls .github/workflows/ 2>/dev/null || echo "No CI workflows configured — skip this step"

── Step 13.3  Squash and merge to BASE_BRANCH ─────────────────────────────────

  gh pr merge feature/enterprise-control-center \
    --squash \
    --delete-branch \
    --subject "feat(admin): Enterprise Control Center — 7-tab shell with real-time observability" \
    --body  "Squash merge of feature/enterprise-control-center. See PR for full details."

  # Verify merge:
  git fetch origin "$BASE_BRANCH"
  git log "origin/$BASE_BRANCH" --oneline -3
  # The squash commit should appear at HEAD.

════════════════════════════════════════════════════════════════════════════════
PHASE 14 — VERCEL DEPLOYMENT MONITORING
════════════════════════════════════════════════════════════════════════════════

── Step 14.1  Confirm Vercel auto-deploy triggered ────────────────────────────

  # Vercel automatically deploys when BASE_BRANCH receives a push.
  # The deployment is usually triggered within 10–30 seconds of the merge.

  # Poll deployment status using the Vercel CLI (most reliable method):
  echo "Waiting for Vercel deployment to start..."
  sleep 20   # Give Vercel time to detect the push

  for i in $(seq 1 24); do
    # `vercel deployments ls` returns structured output per deployment:
    STATUS=$(vercel deployments ls --limit 1 --meta gitBranch="$BASE_BRANCH" 2>/dev/null \
      | awk 'NR==2 {print $3}')   # column 3 is the status field
    # Fallback if the above returns empty (CLI version differences):
    if [ -z "$STATUS" ]; then
      STATUS=$(vercel ls 2>/dev/null | awk 'NR==2 {print $3}')
    fi
    echo "[$i/24] Vercel status: ${STATUS:-unknown}"
    if echo "$STATUS" | grep -qi "ready";   then echo "✓ Deployment ready"; break; fi
    if echo "$STATUS" | grep -qi "error";   then echo "✗ Deployment failed — check Vercel dashboard"; break; fi
    if echo "$STATUS" | grep -qi "canceled";then echo "✗ Deployment canceled"; break; fi
    sleep 15
  done

  # Alternative — if Vercel CLI is not installed or authentication fails:
  #   1. Open https://vercel.com/dashboard
  #   2. Click your TaxBridge project
  #   3. Click "Deployments" tab
  #   4. Confirm the latest deployment shows "Ready" status
  #   5. Click "Visit" to open the production URL

── Step 14.2  Get production URL ──────────────────────────────────────────────

  # Method 1 — Vercel CLI (most reliable):
  PROD_URL=$(vercel deployments ls --limit 1 --meta gitBranch="$BASE_BRANCH" 2>/dev/null \
    | awk 'NR==2 {print $2}')

  # Method 2 — fallback if method 1 returns empty:
  if [ -z "$PROD_URL" ]; then
    PROD_URL=$(vercel ls 2>/dev/null | awk 'NR==2 {print $2}')
  fi

  # Method 3 — gh deployment API (most stable across CLI versions):
  if [ -z "$PROD_URL" ]; then
    PROD_URL=$(gh api "repos/$REPO_SLUG/deployments" \
      --jq '.[0].payload.web_url // .[0].environment' 2>/dev/null | head -1)
  fi

  echo "Production URL: $PROD_URL"
  # Store as: PRODUCTION_URL
  # If all methods fail, retrieve manually from:
  #   https://vercel.com/dashboard → Project → Deployments → latest → "Visit"

── Step 14.3  Production smoke test ───────────────────────────────────────────

  # Basic HTTP check — uses ADMIN_BASE_PATH derived in Step 0.9:
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}${ADMIN_BASE_PATH}")
  echo "HTTP status: $HTTP_STATUS"
  # Required: 200

  # Run the critical path checks remotely:
  echo "Manual checks required — open in browser:"
  echo "  URL: ${PRODUCTION_URL}${ADMIN_BASE_PATH}"
  echo ""
  echo "  [ ] Page loads without blank screen"
  echo "  [ ] Onboarding modal appears (clear site data first)"
  echo "  [ ] 4 KPI cards visible above fold — CFO test passes"
  echo "  [ ] Systems tab: live metrics updating"
  echo "  [ ] Sync tab: device cards render"
  echo "  [ ] Command bar: ⌘K opens"
  echo "  [ ] Dark mode: theme toggle works"
  echo "  [ ] No console errors in DevTools"
  echo "  [ ] Network tab: /api/ routes return same status codes as before"

── Step 14.4  Performance verification ────────────────────────────────────────

  # Run Lighthouse against production using --output-path (cross-platform safe).
  # This avoids /dev/stdin issues that break the pipe on Windows/WSL.
  LH_REPORT="/tmp/tb-lighthouse-$(date +%s).json"
  npx lighthouse "${PRODUCTION_URL}${ADMIN_BASE_PATH}" \
    --only-categories=performance,accessibility \
    --output=json \
    --output-path="$LH_REPORT" \
    --chrome-flags="--headless" \
    --quiet 2>/dev/null

  # Parse and print results:
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('$LH_REPORT', 'utf8'));
    const p   = Math.round(d.categories.performance.score * 100);
    const a   = Math.round(d.categories.accessibility.score * 100);
    const lcp = d.audits['largest-contentful-paint'].numericValue;
    const cls = d.audits['cumulative-layout-shift'].numericValue;
    const tbt = d.audits['total-blocking-time'].numericValue;
    console.log('');
    console.log('══ Lighthouse Results ═══════════════════════');
    console.log('Performance:   ', p,   p   >= 85   ? '✓' : '✗ target ≥ 85');
    console.log('Accessibility: ', a,   a   >= 95   ? '✓' : '✗ target ≥ 95');
    console.log('LCP:           ', (lcp/1000).toFixed(2)+'s', lcp <= 1500 ? '✓' : '✗ target ≤ 1.5s');
    console.log('CLS:           ', cls.toFixed(3), cls <= 0.1 ? '✓' : '✗ target ≤ 0.1');
    console.log('TBT:           ', Math.round(tbt)+'ms', tbt <= 300 ? '✓' : '✗ target ≤ 300ms');
    console.log('═══════════════════════════════════════════');
    console.log('Full report:    $LH_REPORT');
    if (p < 85 || a < 95 || lcp > 1500)
      process.exit(1);
  "
  # If Lighthouse is not installed: npm install -g lighthouse
  # If Chrome is missing on CI: add --chrome-flags="--headless --no-sandbox"

════════════════════════════════════════════════════════════════════════════════
PHASE 15 — POST-DEPLOY CLEANUP & DEPRECATION
════════════════════════════════════════════════════════════════════════════════

── Step 15.1  Mark superseded components as deprecated ────────────────────────

  # For each file in OLD_COMPONENT_FILES (captured in Step 0.10):
  # Open the file and add the following JSDoc block at the very top,
  # above any existing imports:

  /**
   * @deprecated Superseded by src/components/admin-dashboard/
   * Safe to delete after 2 weeks of production monitoring with zero errors.
   * Do NOT delete before: <today's date + 14 calendar days>
   * Cleanup ticket: [create a ticket and paste its URL here]
   */

  # Script to add the marker to every OLD_COMPONENT_FILE in one pass:
  DEPRECATION_HEADER='/**\n * @deprecated Superseded by src\/components\/admin-dashboard\/\n * Safe to delete after 2-week monitoring window.\n */'
  for f in $OLD_COMPONENT_FILES; do
    # Only add if not already marked:
    grep -q "@deprecated" "$f" || sed -i "1s/^/$DEPRECATION_HEADER\n\n/" "$f"
    echo "Marked: $f"
  done

  # Commit the deprecation markers on a separate clean branch:
  git checkout -b chore/deprecate-old-admin-components
  git add $OLD_COMPONENT_FILES
  git commit -m "chore(admin): mark superseded dashboard components @deprecated

  Components replaced by src/components/admin-dashboard/ in the
  feat(admin) Enterprise Control Center PR.

  These files are preserved for rollback safety during the 2-week
  monitoring window. They will be deleted via a follow-up PR once
  no production errors are observed.

  Files marked:
  $(echo "$OLD_COMPONENT_FILES" | tr ' ' '\n' | sed 's/^/  - /')
  "
  git push origin chore/deprecate-old-admin-components

  gh pr create \
    --base "$BASE_BRANCH" \
    --head chore/deprecate-old-admin-components \
    --title "chore(admin): mark superseded dashboard components @deprecated" \
    --body "Follow-up housekeeping to the feat(admin) Enterprise Control Center PR.
No logic changes — JSDoc @deprecated markers only.
Delete window opens 14 days after this merges to production." \
    --label "chore" \
    --label "admin"

  gh pr merge chore/deprecate-old-admin-components --squash --delete-branch

── Step 15.2  Delete .bak snapshot files ──────────────────────────────────────

  # Now that production has been verified stable for at least 24 hours,
  # remove the per-file safety backups created in Step 10.1:
  find . -name "*.pre-enterprise.bak" -not -path "*/node_modules/*" -delete

  # Confirm deletion:
  find . -name "*.pre-enterprise.bak" 2>/dev/null | wc -l
  # Expected: 0

  # Also confirm they are already gitignored (from Step 4.2):
  git status --short | grep "\.bak"
  # Expected: no output (gitignored = not tracked)

  # Commit the removal to keep the working tree clean:
  git add -A
  git commit -m "chore(admin): remove pre-enterprise .bak snapshot files

  Safety backups from the Enterprise Control Center upgrade are no
  longer needed — production has been stable for 24+ hours.
  "
  git push origin "$BASE_BRANCH"

════════════════════════════════════════════════════════════════════════════════
PHASE 16 — ROLLBACK PROCEDURES
Three tiers — use the fastest one that fits the situation.
════════════════════════════════════════════════════════════════════════════════

── TIER 1: Instant full rollback (< 2 minutes) ────────────────────────────────

  # Reverts the squash-merge commit from BASE_BRANCH and pushes.
  # Vercel detects the push and redeploys the previous build automatically.
  git revert HEAD --no-edit
  git push origin "$BASE_BRANCH"

  # Vercel auto-deploys the revert within ~90 seconds.
  # Verify: watch the Vercel dashboard Deployments tab for a new "Building" entry.
  #
  # The src/components/admin-dashboard/ directory remains untouched in the repo —
  # it is completely inert until imported. No cleanup needed immediately.
  # The single reverted file is ADMIN_ENTRY (the one import + JSX swap).

── TIER 2: Vercel instant rollback (< 30 seconds, no git needed) ──────────────

  # In the Vercel dashboard:
  #   Project → Deployments → find the last known-good deployment → "..." → "Promote to Production"
  # This atomically routes production traffic back to the previous build.
  # Fastest option if git is unavailable.

  # Via CLI (if you have the previous deployment URL):
  # vercel promote <previous-deployment-url> --scope <team>

── TIER 3: Feature flag per-session (zero downtime) ───────────────────────────

  # ⚠ Prerequisite: ADMIN_ENTRY must be a Client Component for localStorage access.
  #   If it does not already have 'use client', add it as the very first line.
  #   Server Components cannot access localStorage — the typeof window guard below
  #   is correct but only works at runtime inside a Client Component.

  # In ADMIN_ENTRY, add the following AFTER the 'use client' directive and imports,
  # BEFORE the default export function:

  const useNewDashboard: boolean =
    process.env.NEXT_PUBLIC_ENTERPRISE_UI !== 'false' &&
    (typeof window === 'undefined'
      ? true                                         // SSR: default to new dashboard
      : localStorage.getItem('tb_legacy') !== '1'); // Client: check override flag

  # Then inside the component return, swap the rendered component:
  #   return (
  #     <Providers>
  #       {useNewDashboard ? <EnterpriseApp /> : <OldDashboard />}
  #     </Providers>
  #   );

  # Usage:
  #   Opt out (restore old dashboard for your session):
  #     localStorage.setItem('tb_legacy', '1');  location.reload();
  #   Opt back in:
  #     localStorage.removeItem('tb_legacy');     location.reload();

  # Global kill switch (disables new dashboard for ALL users, no deploy needed):
  #   Vercel → Project → Settings → Environment Variables
  #   Set NEXT_PUBLIC_ENTERPRISE_UI = false → Save → triggers auto-redeploy

── TIER 4: Per-tab error boundary — surgical isolation (already implemented) ──

  # Each tab is already wrapped in ErrorBoundary via withBoundary() in EnterpriseApp.
  # If a single tab crashes in production, only that tab shows the fallback UI.
  # All other tabs, the sidebar, command bar, and shell keep working normally.

  # The implemented fallback renders:
  #   ┌──────────────────────────────────────────┐
  #   │  This tab encountered an error            │
  #   │  <error message>                          │
  #   │  [ Reload Tab ]  ←── calls resetBoundary  │
  #   └──────────────────────────────────────────┘

  # To identify WHICH tab is erroring in production, add Sentry or similar:
  #   In TabErrorFallback (EnterpriseApp.tsx), add before the return:
  #
  #   useEffect(() => {
  #     Sentry.captureException(error, {
  #       tags: { component: 'tab-error-boundary', tab: activeTab },
  #     });
  #   }, [error]);

  # To force-trigger a specific tab's error boundary for testing:
  #   1. Open the tab
  #   2. In DevTools console: throw new Error('test boundary')
  #   OR add a temporary <ThrowError /> component inside the tab

  # To bypass the boundary and see the raw error (development only):
  #   Wrap the individual tab import with React DevTools ErrorBoundary inspector,
  #   OR temporarily remove withBoundary() from that tab's TAB_MAP entry.

  # No rollback needed for a boundary catch — the error is isolated.
  # If the error is systematic (affects all tabs), use TIER 1 or TIER 2.

════════════════════════════════════════════════════════════════════════════════
APPENDIX A — COMPLETE FILE MANIFEST
════════════════════════════════════════════════════════════════════════════════

NEW FILES (all additive — zero deletions until Phase 15):

  src/store/enterpriseStore.ts

  src/components/admin-dashboard/
  ├── index.ts
  ├── EnterpriseApp.tsx
  │
  ├── ui/
  │   ├── index.ts
  │   ├── Card.tsx
  │   ├── Badge.tsx
  │   ├── Sparkline.tsx
  │   ├── StatusDot.tsx
  │   └── Skeleton.tsx
  │
  ├── shell/
  │   ├── index.ts
  │   ├── ThemeProvider.tsx
  │   ├── Layout.tsx
  │   ├── Sidebar.tsx
  │   ├── TopBar.tsx
  │   └── CommandBar.tsx
  │
  ├── tabs/
  │   ├── index.ts
  │   ├── OverviewTab.tsx      ← Complete KPI hero, AI banner, revenue chart
  │   ├── SystemsTab.tsx       ← Complete real-time metrics, service list, log stream
  │   ├── SyncTab.tsx          ← Complete device cards, retry, progress bar
  │   ├── TeamTab.tsx          ← Complete role matrix, searchable member table
  │   ├── ComplianceTab.tsx    ← Complete framework badges, searchable audit log
  │   ├── BillingTab.tsx       ← Complete plan card, usage metrics, bar chart
  │   └── IntelligenceTab.tsx  ← Complete insight cards, action buttons, refresh
  │
  └── onboarding/
      ├── steps.ts
      ├── OnboardingModal.tsx
      └── OnboardingOrchestrator.tsx

MODIFIED FILES (exactly these — no others):

  ADMIN_ENTRY          → one import swap + one JSX swap
  NESTED_ROUTE_FILES   → redirect to /admin (App Router) or useRouter.replace
  ADMIN_LAYOUT         → read-only verify (no conflicting shell components)
  src/lib/utils.ts     → 5 new exports added (cn, formatCurrency, formatNumber,
                         timeAgo, clamp) — additive merge, existing exports preserved
  TAILWIND_CONFIG      → theme.extend merge + darkMode: 'class' — additive only
  CSS_ENTRY            → --tb- token block prepended — additive only
  src/app/layout.tsx   → next/font Inter + JetBrains_Mono className addition

BRANCH LIFECYCLE:

  feature/enterprise-control-center     → squash merged to BASE_BRANCH → deleted
  chore/deprecate-old-admin-components  → squash merged to BASE_BRANCH → deleted

VERCEL TRIGGER:

  Push to BASE_BRANCH → Vercel auto-deploys production
  No manual vercel deploy command required.

════════════════════════════════════════════════════════════════════════════════
APPENDIX B — DATA WIRING GUIDE
(Complete after UI is verified in production for at least 24 hours)
════════════════════════════════════════════════════════════════════════════════

⚠ PREREQUISITE — QueryClient availability:
  EnterpriseApp does not create its own QueryClient. It relies on the
  QueryClientProvider that already wraps ADMIN_ENTRY. Before wiring any
  useQuery call, confirm the provider is present:

    grep -n "QueryClientProvider" "$ADMIN_ENTRY" "$ADMIN_LAYOUT"
    # Must show at least one result. If missing:
    #   Wrap EnterpriseApp in ADMIN_ENTRY:
    #     import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    #     const queryClient = new QueryClient();
    #     // inside the return:  <QueryClientProvider client={queryClient}><EnterpriseApp /></QueryClientProvider>

Wire each tab independently. Test in staging. Promote to production tab-by-tab.

  1. OverviewTab — KPI_CARDS, REVENUE_CHART_DATA
     ─────────────────────────────────────────────
     In OverviewTab.tsx, replace the mock constants with:

       import { useQuery } from '@tanstack/react-query';

       function useOverviewKPIs() {
         return useQuery({
           queryKey:  ['admin', 'kpis'],
           queryFn:   () => fetch('/api/admin/kpis').then(r => r.json()),
           staleTime: 30_000,
           refetchInterval: 60_000,
         });
       }

     Then in OverviewTab(): const { data: liveKPIs } = useOverviewKPIs();
     Pass liveKPIs to KPICard: data={liveKPIs?.mrr ?? KPI_CARDS[0]}
     Keep static KPI_CARDS as skeleton/fallback until data loads.

  2. SystemsTab — useRealtimeMetrics()
     ────────────────────────────────────
     Replace the setInterval stub with your real WebSocket:

       useEffect(() => {
         const ws = new WebSocket(
           process.env.NEXT_PUBLIC_METRICS_WS_URL ??
           `wss://${window.location.host}/api/ws/metrics`
         );
         ws.onmessage = (e) => {
           const next = JSON.parse(e.data) as Metrics;
           setMetrics(next);
           setHistory(h => [...h.slice(-29), {
             t: new Date().toLocaleTimeString('en-US', { hour12:false }),
             latency: next.apiLatency,
             errors:  next.errorRate,
           }]);
         };
         ws.onerror = () => console.warn('Metrics WS error — falling back to polling');
         return () => ws.close();
       }, []);
       // Keep setInterval as fallback when ws.onerror fires.

  3. SyncTab — INITIAL_DEVICES
     ───────────────────────────
       const { data: devices = INITIAL_DEVICES, refetch } = useQuery({
         queryKey:       ['admin', 'sync-devices'],
         queryFn:        () => fetch('/api/admin/devices').then(r => r.json()),
         refetchInterval: 10_000,
       });
     Wire retryDevice():
       const retryMutation = useMutation({
         mutationFn: (id: string) => fetch(`/api/admin/devices/${id}/sync`, { method: 'POST' }),
         onSuccess: () => refetch(),
       });

  4. TeamTab — MEMBERS, ROLES
     ──────────────────────────
       const { data: members = MEMBERS } = useQuery({
         queryKey: ['admin', 'team'],
         queryFn:  () => fetch('/api/admin/team').then(r => r.json()),
       });

  5. ComplianceTab — AUDIT_EVENTS
     ─────────────────────────────
       const [page, setPage] = useState(1);
       const { data } = useQuery({
         queryKey: ['admin', 'audit-log', page],
         queryFn:  () => fetch(`/api/admin/audit?page=${page}&limit=50`).then(r => r.json()),
         placeholderData: keepPreviousData,   // TQ v5: keeps old data while new page loads
       });
     Note: keepPreviousData is imported from '@tanstack/react-query' in v5.

  6. BillingTab — USAGE_DATA
     ──────────────────────────
       const { data: billing } = useQuery({
         queryKey: ['admin', 'billing'],
         queryFn:  () => fetch('/api/admin/billing').then(r => r.json()),
         staleTime: 300_000,   // billing data changes slowly — 5 min stale time
       });

  7. IntelligenceTab — INSIGHTS
     ────────────────────────────
       const queryClient = useQueryClient();
       const { data: insights = INSIGHTS, isRefetching } = useQuery({
         queryKey: ['admin', 'ai-insights'],
         queryFn:  () => fetch('/api/admin/insights').then(r => r.json()),
         staleTime: 120_000,
       });
       // refreshInsights():
       const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'ai-insights'] });

  8. RecentActivityFeed (OverviewTab bottom-left widget)
     ─────────────────────────────────────────────────────
       const { data: activity = [] } = useQuery({
         queryKey:       ['admin', 'activity-feed'],
         queryFn:        () => fetch('/api/admin/activity?limit=5').then(r => r.json()),
         refetchInterval: 15_000,
       });

  9. Compliance Radar (OverviewTab bottom-right widget)
     ────────────────────────────────────────────────────
       const { data: radar } = useQuery({
         queryKey: ['admin', 'compliance-radar'],
         queryFn:  () => fetch('/api/admin/compliance/jurisdictions').then(r => r.json()),
         staleTime: 3_600_000,   // hourly refresh matches the display label
       });

════════════════════════════════════════════════════════════════════════════════
APPENDIX C — ENVIRONMENT VARIABLES
════════════════════════════════════════════════════════════════════════════════

── Step C.1  Create .env.local for local development ──────────────────────────

  # Run this heredoc once to scaffold your local environment file.
  # It will NOT overwrite existing values — it only adds missing ones.
  cat >> .env.local << 'ENV'

# ── TaxBridge Enterprise Control Center ────────────────────────────────────
# Feature flag — set to 'false' to force the old dashboard for all local users
NEXT_PUBLIC_ENTERPRISE_UI=true

# Admin base path — the URL segment where the admin dashboard lives.
# Derived automatically in Step 0.9 and set here for runtime redirect use.
# Examples: /admin   OR   /admin/dashboard
NEXT_PUBLIC_ADMIN_BASE_PATH=/admin

# WebSocket endpoint for SystemsTab live metrics.
# Replace with your actual TaxBridge API WebSocket URL.
# Falls back to setInterval polling if unset or connection fails.
NEXT_PUBLIC_METRICS_WS_URL=wss://localhost:3001/ws/metrics

# Your existing API base URL — verify this matches what's already in .env.local
# NEXT_PUBLIC_API_BASE_URL=https://api.taxbridge.com
ENV

  echo "✓ .env.local updated — review the new lines at the bottom of the file:"
  tail -10 .env.local

── Step C.2  Add variables to Vercel production environment ───────────────────

  # Using the Vercel CLI (requires vercel link from Step 0.14):
  vercel env add NEXT_PUBLIC_ENTERPRISE_UI production <<< "true"
  vercel env add NEXT_PUBLIC_ADMIN_BASE_PATH production <<< "$ADMIN_BASE_PATH"
  vercel env add NEXT_PUBLIC_METRICS_WS_URL production <<< "wss://api.taxbridge.com/ws/metrics"

  # Verify they appear in Vercel:
  vercel env ls production | grep "NEXT_PUBLIC_ENTERPRISE\|NEXT_PUBLIC_ADMIN\|NEXT_PUBLIC_METRICS"

  # Alternative — add via dashboard:
  #   Vercel → Project → Settings → Environment Variables → Add New
  #   Scope: Production (and optionally Preview + Development)

── Step C.3  Generate .env.example for team sharing ───────────────────────────

  # Creates a sanitised template without secret values — safe to commit:
  cat > .env.example << 'EXAMPLE'
# ── TaxBridge Enterprise Control Center ────────────────────────────────────
# Copy this file to .env.local and fill in the values.

# Feature flag: set to 'false' to force the legacy dashboard
NEXT_PUBLIC_ENTERPRISE_UI=true

# Admin base path — URL segment where the admin dashboard lives (e.g. /admin)
NEXT_PUBLIC_ADMIN_BASE_PATH=/admin

# WebSocket endpoint for live metrics in the Systems tab
NEXT_PUBLIC_METRICS_WS_URL=wss://your-api.taxbridge.com/ws/metrics

# Base URL for API calls (should already be in your .env.local)
NEXT_PUBLIC_API_BASE_URL=https://your-api.taxbridge.com
EXAMPLE

  git add .env.example
  git commit -m "chore: add .env.example for Enterprise Control Center vars"
  git push origin "$BASE_BRANCH"

── Reference: all environment variables used by the new system ────────────────

  NEXT_PUBLIC_ENTERPRISE_UI          Feature flag (true|false). Default: true.
                                     Set to 'false' in Vercel to instant-disable
                                     the new dashboard for ALL users without a
                                     code change.

  NEXT_PUBLIC_ADMIN_BASE_PATH        URL path prefix for the admin dashboard,
                                     derived automatically in Step 0.9.
                                     Used by nested-route redirects and smoke
                                     tests. Example: /admin or /admin/dashboard

  NEXT_PUBLIC_METRICS_WS_URL         WebSocket URL for SystemsTab live metrics.
                                     Optional — tab falls back to 1.5s polling.
                                     Format: wss://host/path (no trailing slash).

  NEXT_PUBLIC_API_BASE_URL           Base URL for REST API calls wired in
                                     Appendix B. Already present in your project.

  # The following are NOT new — verify they exist already:
  # NEXTAUTH_URL / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / SUPABASE_URL
  # (or whichever auth env vars your AUTH_PROVIDER requires)

```

---

## APPENDIX D — COMPLETE TESTING MATRIX

Use this checklist before every merge to `master` and after every production deploy.
Mark each item **✓** (pass), **✗** (fail — block the merge), or **—** (not applicable).

### D.1  Shell & Page Load

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | Cold load `/admin` | HTTP 200, no blank screen, zero JS errors in console |
| 2 | Sidebar renders | 7 nav items, uptime badge, collapse button present |
| 3 | Sidebar collapse | Animates 240 px → 60 px; tooltips on hover; re-expands |
| 4 | TopBar renders | Breadcrumb, ⌘K pill, bell, theme toggle, avatar all visible |
| 5 | Theme cycle | Light → Dark → System; CSS vars switch; no flash |
| 6 | Dark mode parity | Every surface/border/text uses `var(--tb-*)` — zero hardcoded hex |
| 7 | Persist on reload | Theme, sidebar state, onboarding-skip survive F5 |
| 8 | Skip-to-content | First Tab press reveals blue "Skip to main content" link |
| 9 | Mobile 375 px | No horizontal overflow; sidebar hidden by default |

### D.2  Onboarding

| # | Test | Pass criteria |
|---|------|---------------|
| 10 | First-visit modal | Auto-appears on cleared site data |
| 11 | Step progression | CTA navigates to correct tab AND advances step |
| 12 | Step animation | Content slides in from right on each advance |
| 13 | Skip button | Closes modal, lands on Overview, never reappears |
| 14 | Keyboard trap | Tab cycles inside modal; Escape closes |
| 15 | No second visit | Modal absent after skip or completion + reload |
| 16 | Under 5 minutes | Timed walkthrough of all 3 steps completes in < 5 min |

### D.3  Command Bar (⌘K)

| # | Test | Pass criteria |
|---|------|---------------|
| 17 | Opens from any tab | ⌘K / Ctrl+K works regardless of active tab |
| 18 | Fuzzy search | Typing "sys" surfaces "Systems Health" as first result |
| 19 | Keyboard nav | ↑↓ moves selection; Enter activates and closes |
| 20 | Escape closes | Focus returns to previously focused element |
| 21 | Backdrop click | Closes bar |
| 22 | "Trigger Sync" | Toast: "Global sync triggered for all devices" |

### D.4  Overview Tab — CFO Test

| # | Test | Pass criteria |
|---|------|---------------|
| 23 | **CFO 10-second test** | **4 KPI cards above fold at 1366×768, 100% zoom, in ≤ 10 s** |
| 24 | KPI card anatomy | Label, value, sparkline, trend icon, delta %, sub-text |
| 25 | Sparkline colours | Up = green, down = red, Sync Health = amber |
| 26 | AI insights banner | 3 clickable insight buttons; hover reveals chevron |
| 27 | Revenue chart | 8 data points; cursor tooltip shows formatted currency |
| 28 | Sync health bars | 4 bars animate from 0 width on mount |
| 29 | Activity feed | 5 rows with icon, label, relative timestamp |
| 30 | Compliance radar | 6 jurisdiction bars; ≥ 96% = green, < 96% = amber, < 94% = red |

### D.5  Systems Tab

| # | Test | Pass criteria |
|---|------|---------------|
| 31 | Live badge visible | "Live · 1.5 s refresh" badge in header |
| 32 | Metric cards tick | Values change every ~1.5 s without full re-render |
| 33 | History grows | Latency chart history array increments (no repeated values) |
| 34 | Service list | "Filing Processor" shows amber "degraded" badge |
| 35 | Log stream colours | ERROR rows red, WARN rows amber, INFO rows muted |
| 36 | No memory leak | Heap stable after 2 min on Systems tab (DevTools Memory) |

### D.6  Android Sync Tab

| # | Test | Pass criteria |
|---|------|---------------|
| 37 | 6 device cards | Mixed statuses: synced/syncing/failed/stale all present |
| 38 | Status filter | "Failed" button shows only failed devices |
| 39 | Retry flow | Click Retry → immediately "Syncing" → "Synced" after 3 s |
| 40 | Failure reason | Red box with error text on failed device cards |
| 41 | Syncing bar | Animated progress fill on syncing device |
| 42 | Global sync | Toast: "Global sync triggered for all devices" |

### D.7  Team & RBAC Tab

| # | Test | Pass criteria |
|---|------|---------------|
| 43 | Role matrix | 5 cards with coloured left border and member count |
| 44 | Member table | 5 rows with initials avatar, status badge, role chip |
| 45 | Search | Typing "sarah" shows only Sarah Chen |
| 46 | Row options | MoreHorizontal button fires "Editing..." toast |

### D.8  Compliance & Audit Tab

| # | Test | Pass criteria |
|---|------|---------------|
| 47 | Framework badges | SOC 2/ISO/GDPR = success, PCI = warning, HIPAA = default |
| 48 | Audit log | 6 rows; monospace brand-blue action codes |
| 49 | Search filters | Typing "API_KEY" shows only that event |
| 50 | Severity colours | high = red chip, medium = amber, low = grey |

### D.9  Billing Tab

| # | Test | Pass criteria |
|---|------|---------------|
| 51 | Plan card | Dark gradient, $4,990/mo, "Enterprise" badge, 6 features |
| 52 | Bar chart | 6 monthly bars; hover tooltip shows formatted USD |
| 53 | Download button | Toast fires |

### D.10  Intelligence Tab

| # | Test | Pass criteria |
|---|------|---------------|
| 54 | 4 insight cards | Opportunity/risk/optimisation/compliance all render |
| 55 | Priority badges | high = red, medium = amber |
| 56 | Refresh button | Spinner 2 s → "AI insights refreshed" toast |

### D.11  Accessibility — WCAG 2.2 AA

| # | Test | Pass criteria |
|---|------|---------------|
| 57 | axe-core scan | Zero critical + zero serious violations on `/admin` |
| 58 | Keyboard — sidebar | Tab reaches all 7 nav items; Enter activates; ring visible |
| 59 | Keyboard — command bar | All items reachable; Esc closes; focus restored |
| 60 | Keyboard — modal | Tab cycles inside; Esc closes |
| 61 | `aria-current="page"` | Active sidebar item has attribute; VoiceOver announces it |
| 62 | Bell aria-label | Includes unread count: "Notifications — 3 unread" |
| 63 | Colour contrast | All text ≥ 4.5:1 against background in light AND dark mode |
| 64 | Focus visible | Every interactive element shows ring on keyboard focus |
| 65 | Reduced motion | `prefers-reduced-motion: reduce` suppresses all animations |

> Add to `CSS_ENTRY` after Step 2.4 if not already present:
> ```css
> @media (prefers-reduced-motion: reduce) {
>   *, *::before, *::after {
>     animation-duration:       0.01ms !important;
>     animation-iteration-count: 1     !important;
>     transition-duration:       0.01ms !important;
>   }
> }
> ```

### D.12  Performance (Lighthouse — production, mobile simulation)

| # | Metric | Target |
|---|--------|--------|
| 66 | LCP | ≤ 1.5 s |
| 67 | CLS | ≤ 0.10 |
| 68 | TBT | ≤ 300 ms |
| 69 | Performance score | ≥ 85 |
| 70 | Accessibility score | ≥ 95 |
| 71 | Code splitting | 7 separate tab chunks in Network tab; none load before first click |
| 72 | First Load JS `/admin` | ≤ 400 kB total |

### D.13  Non-Regression (existing systems must be unchanged)

| # | Test | Pass criteria |
|---|------|---------------|
| 73 | API routes | All `/api/*` endpoints return same status codes as before the PR |
| 74 | Auth flow | Login, session persistence, logout all work normally |
| 75 | Non-admin pages | All public/user-facing routes are unaffected |
| 76 | Android sync (real) | Existing device sync processes normally — check server logs |
| 77 | Filing submission | End-to-end filing submit → process → confirm flow unbroken |
| 78 | Zero new console errors | DevTools shows no errors across all 7 tabs on load |
| 79 | No duplicate providers | QueryClientProvider not doubled in React DevTools component tree |
| 80 | `.env.local` intact | No pre-existing env vars overwritten by Step C.1 heredoc |
