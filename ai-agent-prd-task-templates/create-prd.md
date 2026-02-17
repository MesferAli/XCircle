# Rule: Generating a Product Requirements Document (PRD)

## Goal

Guide an AI assistant agent to create a clear, actionable Product Requirements Document (PRD) in Markdown, based on an initial user prompt and any clarifications.

## Process

1. **Receive Initial Prompt:** The user provides a brief description or request for a new feature or functionality.
2. **Ask Clarifying Questions:** Before writing the PRD, the AI *must* ask only the most essential clarifying questions needed to write a clear PRD. Limit to 3-5 critical gaps. Focus on the "what" and "why" of the feature.
3. **Generate PRD:** Use the user's prompt and answers to generate a PRD with the structure below.
4. **Create Feature Folder:** Inside `/tasks`, create a feature subdirectory named after the feature using kebab-case (example: `/tasks/user-profile-editing/`).
5. **Save PRD:** Save the PRD inside that subdirectory as `prd.md`.

## Clarifying Questions (Guidelines)

Ask only the highest-impact questions when key information is ambiguous or missing. Common areas:

- **Problem/Goal:** If unclear, ask what user or business problem this solves.
- **Core Functionality:** If vague, ask what key actions users must be able to perform.
- **Scope Boundaries:** If broad, ask what should explicitly be out of scope.
- **Success Criteria:** If unstated, ask how success will be measured.

**Important:** If something is reasonably inferable from the prompt, do not ask about it. Prioritize questions that materially improve PRD quality.

### Formatting Requirements

- **Number all questions** (1, 2, 3, etc.)
- **List options for each question as A, B, C, D, etc.**
- Make it easy for the user to reply in a compact format like `1A, 2C, 3B`

### Example Format

```md
1. What is the primary goal of this feature?
   A. Improve user onboarding experience
   B. Increase user retention
   C. Reduce support burden
   D. Generate additional revenue

2. Who is the target user for this feature?
   A. New users only
   B. Existing users only
   C. All users
   D. Admin users only
```

## PRD Structure

The generated PRD should include:

1. **Introduction/Overview:** Brief description of the feature, problem, and goal.
2. **Goals:** Specific, measurable objectives.
3. **User Stories:** User narratives that explain value and usage.
4. **Functional Requirements:** Numbered requirements using clear language (example: "The system must allow users to upload a profile picture.").
5. **Non-Goals (Out of Scope):** Explicit scope exclusions.
6. **Design Considerations (Optional):** UI/UX notes, mockups, component constraints.
7. **Technical Considerations (Optional):** Constraints, dependencies, integration notes.
8. **Success Metrics:** Measurable outcomes (engagement, completion rate, error reduction, etc.).
9. **Open Questions:** Remaining unknowns needing follow-up.

## Output

- **Format:** Markdown (`.md`)
- **Directory:** `/tasks/[feature-name]/`
- **PRD Filename:** `prd.md`
- **Companion Task File in Same Folder:** `tasks.md` (created by the task-generation template)

## Final Instructions

1. Do **not** start implementation.
2. Ask clarifying questions only when required.
3. Incorporate the user's answers into the final PRD.
4. Ensure the file is saved to `/tasks/[feature-name]/prd.md` (create the directory if needed).
