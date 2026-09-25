# Ezmora Realty CRM

A full-stack customer relationship management application for Ezmora Realty's sales, operations, lead-management, calling, follow-up, data-bank, team, and WhatsApp broadcast workflows.

> **Source of truth:** This repository contains the existing CRM exported from Lovable and continued on Manus/Vercel. The implementation has been preserved rather than redesigned or rebuilt.

## Live resources

- **Production website:** https://ezmora.vercel.app/
- **Public source repository:** https://github.com/hannanshaikh665/ezmora
- **Production Supabase project:** Ezmora Reality
- **Supabase region:** Mumbai / `ap-south-1`

## Important security rule

Never commit any of the following to this public repository:

- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase database passwords
- WhatsApp/Meta access tokens
- WhatsApp verify tokens
- Vercel tokens
- User passwords
- Private API keys or credentials

The service-role key has full administrative access to the Supabase project. It must exist only in a secure deployment secret store, such as **Vercel Project Settings → Environment Variables → Production**.

The `.env` and `.env.*` patterns are ignored by Git. Public browser variables beginning with `VITE_` are intentionally usable by the client; service credentials are server-only.

---

## 1. Product overview

Ezmora Realty CRM is designed around an owner-managed real-estate sales organization.

### Main capabilities

- Secure email/password authentication through Supabase Auth
- First-run owner account bootstrap
- Owner, supervisor, and employee roles
- Owner-managed team login creation and password resets
- Command-center dashboard
- Calling queue and call logging
- Lead pipeline management
- Follow-up and task management
- Site-visit tracking
- Contact and lead assignment
- Dataset/data-bank management
- Dataset assignment to employees
- WhatsApp broadcast creation and delivery tracking
- Media uploads for WhatsApp blasts
- Server-side Meta WhatsApp Cloud API integration
- Role-based Row Level Security in Supabase
- Responsive glass-style CRM interface
- TanStack Start server functions and SSR-compatible routing

---

## 2. Technology stack

### Frontend

- React 19
- TypeScript
- TanStack Router
- TanStack React Query
- TanStack Start
- Vite
- Tailwind CSS 4
- Radix UI primitives
- Lucide React icons
- Recharts
- React Hook Form
- Zod validation
- Sonner toast notifications

### Backend/runtime

- TanStack Start server functions
- Nitro runtime integration
- Supabase JavaScript client
- Supabase Auth
- Server-side Supabase admin client using the service-role key
- CSRF middleware for server functions
- Supabase-auth middleware for protected server functions

### Database and infrastructure

- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Row Level Security policies
- Database functions, triggers, indexes, and foreign keys
- Vercel production deployment

### Build and quality tools

- Vite
- TypeScript
- ESLint
- Prettier
- Bun lockfile (`bun.lock`)
- npm-compatible package scripts

---

## 3. Repository structure

```text
.
├── .lovable/
│   └── project.json                 Lovable project metadata
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── ui/                      Reusable Radix/shadcn-style UI primitives
│   │   ├── AppShell.tsx             Authenticated navigation shell
│   │   ├── Brand.tsx                Ezmora branding
│   │   ├── DropletField.tsx          Background visual component
│   │   └── GlassBits.tsx             Shared panels, stat tiles, headers, empty states
│   ├── integrations/
│   │   └── supabase/
│   │       ├── auth-attacher.ts     Attaches Supabase auth to server requests
│   │       ├── auth-middleware.ts    Protects authenticated server functions
│   │       ├── client.ts             Browser/SSR publishable Supabase client
│   │       ├── client.server.ts      Server-only service-role Supabase client
│   │       ├── previewAuthStorage.ts Preview authentication storage behavior
│   │       └── types.ts              Generated database TypeScript types
│   ├── lib/
│   │   ├── auth.tsx                 Auth context and session state
│   │   ├── blast.functions.ts       Blast server functions
│   │   ├── crm.ts                   CRM constants and domain options
│   │   ├── database.types.ts        Database type declarations
│   │   ├── error-page.ts            Server error page
│   │   ├── team.functions.ts        Owner/team server functions
│   │   ├── utils.ts                 Shared utilities
│   │   ├── whatsapp.functions.ts    WhatsApp server-function entry points
│   │   └── whatsapp.server.ts       Meta WhatsApp Cloud API implementation
│   ├── routes/
│   │   ├── __root.tsx               Root route, error boundary, shell
│   │   ├── index.tsx                Login and first-owner setup
│   │   ├── _authenticated.tsx       Authenticated route guard/layout
│   │   ├── _authenticated/
│   │   │   ├── dashboard.tsx        Command Center
│   │   │   ├── calling.tsx          Calling Engine
│   │   │   ├── leads.tsx             Lead Pipeline
│   │   │   ├── tasks.tsx             Follow-ups & Notes
│   │   │   ├── data.tsx              Data Bank
│   │   │   ├── blast.tsx             Blast Studio
│   │   │   └── team.tsx              Team & Logins
│   │   └── api/
│   │       └── public/
│   │           └── whatsapp-webhook.ts WhatsApp webhook endpoint
│   ├── routeTree.gen.ts              Generated TanStack route tree
│   ├── router.tsx                    Router configuration
│   ├── server.ts                     Server entry point
│   ├── start.ts                      TanStack Start middleware setup
│   └── styles.css                    Existing global styles and theme
├── supabase/
│   ├── migrations/                   Ordered database migrations
│   └── config.toml                   Local Supabase configuration
├── AGENTS.md                         Project instructions
├── bunfig.toml                      Bun configuration
├── components.json                  UI component configuration
├── eslint.config.js                 ESLint configuration
├── package.json                     Scripts and dependencies
├── tsconfig.json                    TypeScript configuration
├── vite.config.ts                   Vite/TanStack configuration
└── bun.lock                         Locked Bun dependency graph
```

Generated folders and local-only files are intentionally excluded from the public repository, including `node_modules`, build output, `.output`, `.vinxi`, `.tanstack`, and local `.env` files.

---

## 4. Routes and navigation

### Public route

| Route | Purpose | Access |
|---|---|---|
| `/` | Login page and one-time owner bootstrap | Public |

### Authenticated routes

| Route | Screen | Main responsibility |
|---|---|---|
| `/dashboard` | Command Center | Daily calls, connected calls, talk time, fresh leads, visits, hot leads, missed interactions, upcoming follow-ups, employee call view |
| `/calling` | Calling Engine | Calling queue, contact/lead context, call outcome logging, duration, connected status, follow-up creation |
| `/leads` | Lead Pipeline | Create, view, assign, filter, update, and progress leads through pipeline stages |
| `/tasks` | Follow-ups & Notes | View and manage follow-ups, tasks, due dates, missed reasons, assignments, and notes |
| `/data` | Data Bank | Create datasets, classify data, assign datasets to team members, work with dataset-linked contacts/leads/tasks |
| `/blast` | Blast Studio | Compose WhatsApp broadcasts, choose recipients, upload media, send blasts, review delivery results |
| `/team` | Team & Logins | Owner/supervisor team view, create employee/supervisor logins, manage roles and reset passwords |

### Server endpoint

| Endpoint | Purpose |
|---|---|
| `/api/public/whatsapp-webhook` | Meta WhatsApp webhook verification and incoming webhook handling |

The authenticated layout provides the existing navigation links for Command, Calling, Leads, Follow-ups, Data, Blast, and Team. The Team page is role-sensitive and is intended for managers/owners.

---

## 5. Authentication and roles

### Authentication provider

Authentication is implemented with Supabase Auth using email/password credentials.

The browser client uses the publishable key. Server-side administrative operations use the server-only service-role key.

### First owner setup

When the database has no `owner` role, the login screen changes to **Create the owner login**. The existing bootstrap flow:

1. Validates email, password, and full name with Zod.
2. Uses `supabaseAdmin.auth.admin.createUser`.
3. Confirms the email at creation time.
4. Inserts a matching row in `public.profiles`.
5. Inserts an `owner` row in `public.user_roles`.
6. Signs the new owner into the browser.
7. Redirects to `/dashboard`.

Once an owner exists, the bootstrap operation rejects further first-owner creation.

### Roles

The database enum is:

```text
owner
supervisor
employee
```

#### Owner

- Full organization control
- Team login creation
- Team password resets
- Owner-only project deletion
- Manager-level access to organization records
- Team and role administration
- Dashboard supervisor view

#### Supervisor

- Manager-level operational visibility where allowed by RLS
- Access to shared CRM records
- Assignment and operational workflows supported by the existing policies
- No owner-only account administration

#### Employee

- Access to assigned contacts, leads, tasks, calls, and visits according to RLS
- Personal call and follow-up workflow
- Dataset access only when assigned

### Important security behavior

Role checks are implemented with private `SECURITY DEFINER` helper functions:

- `private.has_role(user_id, role)`
- `private.is_manager(user_id)`
- `private.can_access_dataset(user_id, dataset_id)`

The public helper functions are removed/locked down by the migrations so that role checks are not publicly callable.

---

## 6. CRM modules in detail

### Command Center

The dashboard reads live Supabase counts and displays:

- Calls today
- Connected calls
- Not-connected call count
- Talk time
- New leads
- Site visits scheduled today
- Hot leads
- Missed interactions
- Upcoming follow-ups
- Employee call summary for managerial users

### Calling Engine

The calling module is designed for an employee-oriented calling queue. It supports:

- Viewing contact/lead phone data
- Starting a call from the CRM workflow
- Recording whether a call connected
- Recording duration
- Recording outcomes
- Saving call history in `public.calls`
- Creating a follow-up task from the calling flow
- Assignment-aware visibility

### Lead Pipeline

Leads contain sales qualification and pipeline information, including:

- Name and phone
- Looking-for category
- Configuration
- Budget
- Locality
- Temperature: cold, warm, or hot
- Stage
- Follow-up timestamp
- Notes
- Assignment
- Optional linked contact and dataset

### Follow-ups and Tasks

Tasks support:

- Follow-up titles and task types
- Due dates/times
- Related leads and contacts
- Project text
- Open/completed or other existing status values
- Assignment
- Created-by tracking
- Missed-reason tracking
- Dataset linkage

### Data Bank

Datasets provide controlled distribution of contacts and related work. A dataset includes:

- Title
- Location
- Data type
- Description
- Created-by information
- Assigned employees

Dataset RLS ensures that managers can manage datasets while assigned employees can access only datasets assigned to them. Contacts, leads, and tasks can link to datasets.

### Blast Studio

The blast module supports:

- WhatsApp channel broadcasts
- Message text
- Attachments
- Recipient lists
- Recipient validation and de-duplication
- Delivery tracking per recipient
- Sent, failed, invalid, duplicate, and retry-related counts
- Server-side Meta WhatsApp API calls
- Draft and sent blast states

Media uses the `blast-media` Supabase Storage bucket and role-aware storage policies.

### Team and Logins

The owner can create supervisor and employee accounts. The existing server function validates:

- Email
- Password length
- Full name
- Optional phone
- Optional designation
- Optional branch
- Role restricted to `supervisor` or `employee`

The owner can also reset team-member passwords through the server-side admin client.

---

## 7. Database schema

The current migration set creates and evolves these public objects.

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile information and organization metadata |
| `user_roles` | User-to-role assignments |
| `projects` | Real-estate projects and RERA details |
| `contacts` | Contact/phone records and assignment state |
| `calls` | Call history and outcomes |
| `leads` | Qualified sales leads and pipeline state |
| `tasks` | Follow-ups and operational tasks |
| `site_visits` | Scheduled visits, feedback, sentiment, likelihood |
| `blasts` | Broadcast definitions and aggregate delivery counters |
| `whatsapp_settings` | Server-only Meta WhatsApp sender settings |
| `blast_recipients` | Per-recipient blast delivery tracking |
| `datasets` | Data-bank collections |
| `dataset_assignments` | Dataset-to-user assignments |

### Key database relationships

- `calls.contact_id` → `contacts.id`
- `leads.contact_id` → `contacts.id`
- `tasks.lead_id` → `leads.id`
- `tasks.contact_id` → `contacts.id`
- `site_visits.lead_id` → `leads.id`
- `blast_recipients.blast_id` → `blasts.id`
- `contacts.dataset_id` → `datasets.id`
- `leads.dataset_id` → `datasets.id`
- `tasks.dataset_id` → `datasets.id`
- `dataset_assignments.dataset_id` → `datasets.id`

### Seed data

The initial migration seeds four projects:

- Ezmora Vista Heights
- Ezmora Marine Crest
- Ezmora Skyline Bandra
- Ezmora Grand Borivali

### RLS

RLS is enabled on CRM tables. In general:

- Managers can see shared organization records.
- Employees see records assigned to them or created by them where the policy permits.
- Owners receive owner-only operations such as project deletion and team administration.
- WhatsApp settings are not client-readable.
- Service-role operations bypass RLS and must remain server-only.

---

## 8. Supabase Storage

The existing migration references the `blast-media` bucket through policies on `storage.objects`.

Expected behavior:

- Authenticated users can insert media they own into `blast-media`.
- Users can read their own media.
- Managers can read media where the policy permits.
- Users can delete their own media.

If the bucket does not exist in a newly created Supabase project, create the bucket named exactly:

```text
blast-media
```

Keep bucket access aligned with the checked-in storage policies. Do not make sensitive WhatsApp or CRM data publicly readable unless that is an intentional, separately reviewed change.

---

## 9. Environment variables

### Public/browser-compatible variables

These are needed for the Supabase browser client and can be exposed through Vite when prefixed with `VITE_`:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

The application also accepts the corresponding non-`VITE_` names for SSR/server resolution:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_PROJECT_ID=<project-ref>
```

### Server-only required variable

```text
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
```

This is required for:

- First owner bootstrap
- Admin Auth user creation
- Team login creation
- Password resets
- Server-side WhatsApp settings access
- WhatsApp blast delivery
- Server-side administrative database operations

Never use this variable with a `VITE_` prefix.

### WhatsApp/Meta credentials

The application expects WhatsApp Cloud API settings to be stored server-side in `public.whatsapp_settings`. The relevant values include:

- Provider, currently Meta-oriented
- Phone number ID
- WhatsApp Business Account ID
- Meta access token
- Webhook verify token
- Active status

These are not client-readable. Configure them through the existing server-side settings workflow when the WhatsApp feature is being enabled.

### Webhook configuration

For Meta WhatsApp webhooks, configure the Meta developer application to point to:

```text
https://ezmora.vercel.app/api/public/whatsapp-webhook
```

Use the same verify token configured for the CRM's WhatsApp settings. The webhook endpoint is separate from authenticated dashboard routes.

---

## 10. Local development

### Requirements

- Node.js 22+ recommended
- npm or Bun
- A Supabase project
- The required environment variables

### Install dependencies

```bash
npm install
```

Or, if using the checked-in Bun lockfile:

```bash
bun install
```

### Configure local secrets

Create a local `.env` file. It is ignored by Git.

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
SUPABASE_PROJECT_ID=<project-ref>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

Do not commit this file.

### Run the development server

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

### Available scripts

```bash
npm run dev          # Start Vite development server
npm run build        # Production build
npm run build:dev    # Development-mode build
npm run preview      # Preview built output
npm run lint         # Run ESLint
npm run format       # Format source with Prettier
```

---

## 11. Database setup and migrations

The ordered SQL files under `supabase/migrations/` are the database source of truth. Apply them in filename order to a new Supabase project.

Migration themes include:

1. Initial CRM schema, roles, tables, policies, functions, trigger, and seed projects
2. Function permission cleanup
3. Private role-check helpers and tightened RLS policies
4. Blast status and delivery fields
5. Storage policies for blast media
6. WhatsApp settings and blast-recipient tracking
7. WhatsApp settings client lockdown
8. Datasets and dataset assignments
9. Dataset foreign keys on leads and tasks

After applying migrations, verify:

- All expected tables exist
- RLS is enabled
- `private` role helpers exist
- The `blast-media` bucket exists
- The first owner is created through the application bootstrap
- Public client access cannot read `whatsapp_settings`

The checked-in migrations do not contain production user passwords, service-role keys, or WhatsApp tokens.

---

## 12. Deployment on Vercel

The production project is deployed as a TanStack Start/Vite application.

### Vercel project settings

- Framework: detected TanStack Start
- Build command: `vite build` via the existing project configuration
- Production branch: `main` when Git integration is available
- Required production environment variables: all Supabase variables listed above

### Secure deployment process

1. Create or select the Supabase project.
2. Apply the ordered migrations.
3. Configure public Supabase URL/key variables.
4. Configure `SUPABASE_SERVICE_ROLE_KEY` as a Vercel Production secret.
5. Configure WhatsApp credentials only if WhatsApp sending is required.
6. Deploy the existing source.
7. Open `/` and complete the first-owner bootstrap.
8. Verify `/dashboard`, `/calling`, `/leads`, `/tasks`, `/data`, `/blast`, and `/team`.
9. Configure the Meta webhook URL if WhatsApp is enabled.

### GitHub integration

The source repository is public at:

```text
https://github.com/hannanshaikh665/ezmora
```

Vercel can deploy directly from the repository once the Vercel GitHub integration is authorized. The project can also be deployed from a checked-out working copy with the Vercel CLI.

---

## 13. Existing production owner

The production Supabase project currently contains an owner account created through the existing application bootstrap flow.

For security, this README intentionally does not contain the password. Passwords must be managed through Supabase Auth/Vercel-safe operational workflows and never stored in Git.

---

## 14. Operational checklist

### Before a release

- [ ] Confirm no `.env` file is tracked.
- [ ] Confirm no service-role key or Meta token appears in source.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Verify Supabase Production variables.
- [ ] Verify the server-only service-role key is present in Vercel.
- [ ] Review Vercel deployment logs.

### After a release

- [ ] Open the login page.
- [ ] Sign in as owner.
- [ ] Open the dashboard.
- [ ] Verify authenticated navigation.
- [ ] Verify team access for the owner.
- [ ] Verify lead/contact/task pages.
- [ ] Verify dataset restrictions with a non-manager account.
- [ ] Verify WhatsApp only if Meta credentials are configured.
- [ ] Check webhook verification if WhatsApp is enabled.

### If the login page shows a generic error

Check, in order:

1. `SUPABASE_URL`
2. `SUPABASE_PUBLISHABLE_KEY`
3. `VITE_SUPABASE_URL`
4. `VITE_SUPABASE_PUBLISHABLE_KEY`
5. `SUPABASE_SERVICE_ROLE_KEY`
6. Vercel Production deployment status
7. Supabase project status
8. Browser console and Vercel runtime logs

Do not bypass the missing secret by changing authentication code.

---

## 15. Known external dependencies

### Required for core CRM

- Supabase project URL
- Supabase publishable key
- Supabase service-role key in server environment
- Supabase Auth enabled
- Applied database migrations

### Required only for WhatsApp features

- Meta WhatsApp Business account
- Phone number ID
- WhatsApp Business Account ID
- Meta access token
- Webhook verify token
- Correct Meta webhook configuration
- Publicly reachable Vercel webhook endpoint

### Not required for ordinary CRM operation

- WhatsApp credentials are not required for login, dashboard, leads, calling, follow-ups, data bank, or basic team workflows.
- The service-role key is required for server-admin flows even though ordinary browser queries use the publishable key.

---

## 16. Preservation policy

This project should be continued in place. Before making future changes:

- Preserve the existing route structure.
- Preserve existing table names and column meanings.
- Preserve authentication and RLS behavior unless an explicit security change is requested.
- Avoid dependency upgrades unless required for a documented runtime/security issue.
- Do not replace the Supabase backend with another provider without an explicit migration plan.
- Do not redesign the existing UI without a separate design instruction.
- Treat the checked-in migrations and current source as the baseline.

## License and ownership

This repository is an Ezmora Realty project. Add the organization's preferred license and contribution policy before accepting external contributions.
