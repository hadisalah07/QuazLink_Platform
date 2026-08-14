# QuazLink - Next-Gen Workflow Automation

QuazLink is a next-generation workflow automation platform built with an AI-first approach. It orchestrates complex tasks across apps using intelligent browser agents.

## Architecture

This project is built using a highly scalable hybrid architecture:
- **Web UI (`apps/web`)**: Built with Next.js 16 (App Router), TailwindCSS v4, Framer Motion, and React Flow (`@xyflow/react`) for a stunning glassmorphic visual workflow builder.
- **API (`apps/api`)**: Express.js server to handle incoming webhook triggers, GraphQL/REST mutations, and dispatch tasks.
- **Worker (`apps/worker`)**: A BullMQ-based standalone Node.js consumer that runs Playwright and executes the AI browser automation.
- **Database**: PostgreSQL with Prisma ORM.
- **Queue**: Redis for task queuing and state management.
- **AI Core**: Google Gemini 3.5 Flash Lite used as a Spatial Vision AI for self-healing and resolving UI changes dynamically via DOM bounding boxes.

## Getting Started

### Prerequisites
- Node.js >= 18
- Docker & Docker Compose (for Postgres and Redis)

### Running Infrastructure
```bash
docker-compose up -d
```

### Running the Web UI
```bash
cd apps/web
npm install
npm run dev
```
Open `http://localhost:3000` to see the Landing Page, or `http://localhost:3000/dashboard` for the dashboard and workflow builder.

## Design Philosophy
"WOW outside, Calm inside"
The marketing pages are highly dynamic and visual, while the internal dashboard provides a clean, distraction-free environment for building complex automation logic.
