# Rule: Generating a Task List from User Requirements

## Goal

Guide an AI assistant agent in creating a detailed, step-by-step task list in Markdown format based on user requirements, feature requests, or existing documentation.

## Output

- **Format:** Markdown (`.md`)
- **Directory:** `/tasks/[feature-name]/`
- **Filename:** `tasks.md`

## Process

1. **Receive Requirements:** The user provides a feature request, task description, or points to existing documentation.
2. **Analyze Requirements:** The AI analyzes functional requirements, user needs, constraints, and implementation scope from the provided input.
3. **Create Feature Folder:** Inside `/tasks`, create a feature-named subdirectory using kebab-case (example: `/tasks/user-profile-editing/`).
4. **Phase 1: Generate Parent Tasks:** Based on requirement analysis, generate only high-level parent tasks first.  
   **IMPORTANT:** Always include task `0.0 Create feature branch` as the first task, unless the user specifically requests not to create a branch.  
   Present parent tasks only and then say:  
   "I have generated the high-level tasks based on your requirements. Ready to generate the sub-tasks? Respond with 'Go' to proceed."
5. **Wait for Confirmation:** Pause and wait for the user to respond with `Go`.
6. **Phase 2: Generate Sub-Tasks:** After confirmation, break each parent task into smaller, actionable, ordered sub-tasks. Ensure sub-tasks logically follow from parent tasks and cover implementation details implied by the requirements.
7. **Identify Relevant Files:** Based on the tasks and requirements, identify files likely to be created or modified. Include corresponding test files where applicable.
8. **Generate Final Output:** Combine relevant files, notes, parent tasks, and sub-tasks into the final Markdown structure.
9. **Save Task List:** Save the generated task document to `/tasks/[feature-name]/tasks.md`.

## Output Format

The generated task list _must_ follow this structure:

```markdown
## Relevant Files

- `path/to/potential/file1.ts` - Brief description of why this file is relevant (e.g., contains the main logic for this feature).
- `path/to/file1.test.ts` - Unit tests for `file1.ts`.
- `path/to/another/file.tsx` - Brief description (e.g., API route handler for data submission).
- `path/to/another/file.test.tsx` - Unit tests for `another/file.tsx`.
- `lib/utils/helpers.ts` - Brief description (e.g., utility functions needed for calculations).
- `lib/utils/helpers.test.ts` - Unit tests for `helpers.ts`.

### Notes

- Unit tests should typically be placed alongside the code files they test (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Prefer project-specific validation commands in this repo (e.g., `pnpm typecheck`, `pnpm lint`, `pnpm test` or package-scoped equivalents).

## Instructions for Completing Tasks

**IMPORTANT:** As each task is completed, update this markdown file by changing `- [ ]` to `- [x]`.

Example:
- `- [ ] 1.1 Read file` -> `- [x] 1.1 Read file` (after completion)

Update the file after completing each sub-task, not only after finishing an entire parent task.

## Tasks

- [ ] 0.0 Create feature branch
  - [ ] 0.1 Create and checkout a new branch for this feature (e.g., `git checkout -b feature/[feature-name]`)
- [ ] 1.0 Parent Task Title
  - [ ] 1.1 [Sub-task description 1.1]
  - [ ] 1.2 [Sub-task description 1.2]
- [ ] 2.0 Parent Task Title
  - [ ] 2.1 [Sub-task description 2.1]
- [ ] 3.0 Parent Task Title (may not require sub-tasks if purely structural or configuration)
```

## Interaction Model

The process requires a pause after generating parent tasks to get user confirmation (`Go`) before generating detailed sub-tasks.

## Coordination with PRD Template

For the same feature folder, expected files are:

- `/tasks/[feature-name]/prd.md`
- `/tasks/[feature-name]/tasks.md`

If `prd.md` does not exist yet, generate `tasks.md` from the available requirements.
