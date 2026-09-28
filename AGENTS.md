# FeeTrust // Agent Guidelines & gstack Suite

This workspace is powered by **Antigravity** enhanced with the **gstack** virtual team workflow suite created by Garry Tan (CEO of Y Combinator).

## Project Overview
- **Application**: FeeTrust — Merit Rating & Reputation System
- **Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Express, Supabase (PostgreSQL + RLS)
- **Design Aesthetic**: Premium glassmorphic interface with high contrast light & black modes, Outfit typography, and micro-interactions.

---

## Active gstack Skills Suite

The following role-based skills are installed in `.agents/skills/`:

| Skill | Role | Purpose |
| :--- | :--- | :--- |
| **`gstack-cso`** | Chief Security Officer | OWASP Top 10, Supabase RLS security audit, auth/secret audit, input sanitization. |
| **`gstack-ceo-review`** | CEO & Founder Mode | 10-star product vision, scope expansion/reduction, product differentiation, office hours. |
| **`gstack-eng-review`** | Engineering Manager | Architecture guardrails, type safety, database performance, compound indexing. |
| **`gstack-design-review`** | Design Lead | Anti-slop UI review, contrast checks, typography hierarchy, micro-interactions. |
| **`gstack-qa`** | QA Lead | Browser verification, user journeys, edge-case testing, mobile responsiveness. |
| **`gstack-investigate`** | Principal Debugger | Systematic root cause analysis and surgical bug remediation. |
| **`gstack-health`** | Release Engineer | Static typechecking (`tsc --noEmit`), Vite build validation, dependency audit. |

---

## Core Engineering Commands
- **Type Check**: `npm run lint` (`tsc --noEmit`)
- **Production Build**: `npm run build` (`vite build && esbuild ...`)
- **Dev Server**: `npm run dev` (`tsx server.ts`)
