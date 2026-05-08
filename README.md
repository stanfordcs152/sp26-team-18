# sp26-team-18
CS 152 Spring 2026 project repository for Team 18
## Project Summary

VisioGuard is a safety layer for prompt-based image generation platforms that helps prevent AI-generated non-consensual intimate imagery before harmful images are created. Our project focuses on the “AI-as-abuser” abuse path by placing a moderation layer between the user’s prompt and the image-generation model. The system reviews prompts before generation, allowing safe prompts, rejecting clearly abusive ones, and routing uncertain cases to a moderator for review.

## Tech Stack and Hosting Target

- Frontend: Next.js / React
- Backend: Next.js API routes
- Database: Supabase / Postgres
- Image Generation: Pollinations AI
- Moderation: KoalaAI/Text-Moderation through Hugging Face Inference API
- Hosting: Vercel
- Repository Hosting: GitHub

## How to Run Locally

1. Clone the repository:

```bash
git clone https://github.com/stanfordcs152/sp26-team-04.git
```

2. Move into the project folder:

```bash
cd sp26-team-04
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

5. Open the app in your browser:

```text
http://localhost:3000
```

## Deployment

This project is deployed on Vercel. Changes pushed or merged into the `main` branch are automatically deployed through the connected Vercel project.

- [Deployed App](https://sp26-team-04.vercel.app/auth/login)
- [Repository](https://github.com/stanfordcs152/sp26-team-04)

## AI Use Statement

Our team used AI tools to support parts of the development process, but all AI-generated code was reviewed through pull requests before being committed to `main`. Nathania used Claude Code to help engineer the AI moderation layer and dashboard. Rebecca used Claude Code for frontend design, bug fixes, and deployment to Vercel.

## Links

- [PRD](https://github.com/stanfordcs152/sp26-team-04/blob/main/docs/PRD.md)
- [Deployed URL](https://sp26-team-04.vercel.app/auth/login)
- [GitHub Repository](https://github.com/stanfordcs152/sp26-team-04)

## Team Members

- Sally Lee — [@sunminl03](https://github.com/sunminl03)
- Chayse W LaJoie — [@chaysel](https://github.com/chaysel)
- Rebecca Wu — [@rswu](https://github.com/rswu)
- Nathania Lim — [@ntlim77](https://github.com/ntlim77)
- Bolu Aminu — [@baminu](https://github.com/baminu)
