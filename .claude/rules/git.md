---
description: Git workflow and commit conventions
---

# Git Rules

## Commit Messages
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`
- Scopes: `client`, `server`, `shared`, `mlops`, `e2e`, `deploy`
- Keep subject line under 72 characters
- Use imperative mood: "add feature" not "added feature"

## Workflow
- Commit after each completed subtask
- Run `npm run check` before committing
- Never commit `.env` files or secrets
- Keep commits atomic — one logical change per commit
- Write meaningful commit messages explaining "why"

## Branch Strategy
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Never force push to main/master
