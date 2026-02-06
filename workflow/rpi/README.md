# RPI Workflow — Research, Plan, Implement

Structured workflow for feature development that prevents wasted effort on non-viable features.

## How It Works

Each feature goes through three phases in `workflow/rpi/{feature-slug}/`:

### 1. REQUEST.md
- Feature description and business justification
- User stories and acceptance criteria
- Created by: Product/User

### 2. RESEARCH.md
- Technical feasibility analysis
- Impact assessment on existing architecture
- Dependencies and risks
- **GO / NO-GO verdict**
- Created by: `/rpi:research` command

### 3. PLAN.md
- Detailed implementation roadmap
- UX specifications
- API design
- Database schema changes
- Test plan
- Created by: `/rpi:plan` command

### 4. IMPLEMENT.md
- Execution record
- Commit references
- Completion status and notes
- Created by: `/rpi:implement` command

## Usage

```
1. Create: workflow/rpi/{feature-slug}/REQUEST.md
2. Run: /rpi:research {feature-slug}
3. If GO: /rpi:plan {feature-slug}
4. Execute: /rpi:implement {feature-slug}
```

## Benefits

- Validates feasibility before investing development time
- Creates comprehensive documentation automatically
- Maintains audit trail of design decisions
- Enables async review at each gate
