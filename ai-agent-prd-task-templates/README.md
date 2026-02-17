# AI Agent PRD + Task Templates

Lightweight templates for AI assistants to:

- generate a Product Requirements Document (`create-prd.md`)
- generate an implementation task list (`generate-tasks.md`)

These templates are designed to work together and enforce a consistent output structure:

- `tasks/[feature-name]/prd.md`
- `tasks/[feature-name]/tasks.md`

## Files

- `create-prd.md` - PRD generation workflow and structure
- `generate-tasks.md` - two-phase task generation workflow (parent tasks -> `Go` -> sub-tasks)

## Usage

1. Copy the relevant template into your AI assistant's instruction set.
2. Provide your feature request.
3. Follow the guided clarifying questions.
4. Let the assistant create:
   - a feature folder inside `tasks/`
   - `prd.md` and `tasks.md` inside that folder

## Sharing

This repository is public and intended to be reused, remixed, and shared.
