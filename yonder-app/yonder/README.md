This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
