# Yonder App

Next.js application for the Yonder platform - a real estate plot discovery and analysis tool.

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Better Auth with Google OAuth
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI, shadcn/ui
- **Maps**: Mapbox GL
- **AI**: OpenAI, Google Gemini

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL database

## Getting Started

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Required variables:

```env
DATABASE_URL=postgres://user:pass@host:5432/dbname
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Optional:

```env
RESEND_API_KEY=your-resend-key
MAPBOX_ACCESS_TOKEN=your-mapbox-token
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

### 3. Build shared packages

```bash
pnpm --filter @yonder/persistence build
```

### 4. Run the development server

```bash
pnpm dev
```

Or from monorepo root:

```bash
pnpm dev:app
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run tests with Vitest |
| `pnpm db:push` | Push schema changes to database |

## Project Structure

```
yonder/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── lib/           # Shared utilities, db, auth
│   ├── server/        # tRPC routers and server logic
│   └── components/    # React components
├── public/            # Static assets
└── scripts/           # Database and utility scripts
```

## Deployment

Deployed on Vercel. The build command automatically builds the `@yonder/persistence` dependency first.

### Vercel Settings

- **Root Directory**: `yonder-app/yonder`
- **Build Command**: `pnpm build`
- **Install Command**: `pnpm install`

## Database ERD

The following ER diagram describes the main tables and relationships defined in `src/server/db/schema.ts`.

```mermaid
erDiagram
  users {
    text id PK
  }
  accounts {
    text id PK
    text userId FK
  }
  sessions {
    text id PK
    text userId FK
    text activeOrganizationId FK
  }
  verifications {
    text id PK
  }
  organizations {
    text id PK
    text slug UK
    uuid selectedPlotId FK
    text currentStage FK
  }
  members {
    text id PK
    text userId FK
    text organizationId FK
  }
  invitations {
    text id PK
    text inviterId FK
    text organizationId FK
  }
  chats {
    text id PK
    text organizationId FK
    text createdBy FK
  }
  messages {
    text id PK
    text chatId FK
    text createdBy FK
  }
  plots {
    uuid id PK
  }
  enriched_plots {
    uuid id PK
    int municipalityId FK
  }
  plot_fetch_logs {
    serial id PK
  }
  municipalities {
    serial id PK
  }
  organization_plots {
    text id PK
    text organizationId FK
    uuid plotId FK
  }
  conversations {
    text id PK
    text organizationId FK
    text organizationPlotId FK
  }
  conversation_messages {
    text id PK
    text conversationId FK
    text senderId FK
  }
  process_steps {
    text id PK
    text yonderPartnerId FK
  }
  yonder_partners {
    text id PK
  }
  organization_steps {
    text id PK
    text organizationId FK
    text processStepId FK
    text assignedTo FK
  }

  users ||--o{ accounts : has
  users ||--o{ sessions : has
  users ||--o{ invitations : invites
  users ||--o{ chats : creates
  users ||--o{ messages : writes
  users ||--o{ conversation_messages : may_send

  organizations ||--o{ members : has
  users ||--o{ members : belongs
  organizations ||--o{ invitations : has
  organizations ||--o{ chats : has
  chats ||--o{ messages : has

  municipalities ||--o{ enriched_plots : has
  organizations ||--o{ organization_plots : tracks
  enriched_plots ||--o{ organization_plots : linked
  organization_plots ||--o{ conversations : has
  conversations ||--o{ conversation_messages : has

  process_steps ||--o{ organization_steps : instantiated
  organizations ||--o{ organization_steps : has
  yonder_partners ||--o{ process_steps : referenced_by
  yonder_partners ||--o{ organization_steps : assigned_to

  organizations }o--|| enriched_plots : selectedPlot
  organizations }o--|| process_steps : currentStage
  sessions }o--|| organizations : activeOrg
```

Notes:
- Nullable FKs: `sessions.activeOrganizationId`, `organizations.selectedPlotId`, `organizations.currentStage`, `process_steps.yonderPartnerId`, `organization_steps.assignedTo`, `conversations.organizationPlotId`, `conversation_messages.senderId`.
- `plots` is a raw import table; `enriched_plots` is the primary plot entity referenced by other tables.
