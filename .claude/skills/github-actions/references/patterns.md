# GitHub Actions Advanced Patterns

## Composite Actions

Create reusable action steps as a composite action:

```yaml
# .github/actions/setup-go-env/action.yml
name: Setup Go Environment
description: Setup Go with caching and tools

inputs:
  go-version:
    description: Go version
    default: '1.23'

runs:
  using: composite
  steps:
    - uses: actions/setup-go@v5
      with:
        go-version: ${{ inputs.go-version }}
        cache: true

    - name: Install tools
      shell: bash
      run: |
        go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
        go install gotest.tools/gotestsum@latest
```

## Path Filtering

```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'
      - '.github/workflows/ci.yml'
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

## Job Outputs

```yaml
jobs:
  build:
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      version: ${{ steps.version.outputs.version }}
    steps:
      - id: version
        run: echo "version=$(git describe --tags)" >> $GITHUB_OUTPUT

  deploy:
    needs: [build]
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.image-tag }}"
```

## Environment Protection Rules

Configure in GitHub Settings → Environments:
- **Required reviewers**: Manual approval before deploy
- **Wait timer**: Delay between approval and deploy
- **Deployment branches**: Restrict which branches can deploy
- **Environment secrets**: Scoped secrets per environment

## Workflow Dispatch with Inputs

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: Target environment
        required: true
        type: choice
        options:
          - staging
          - production
      version:
        description: Version to deploy
        required: true
        type: string
      dry-run:
        description: Dry run mode
        type: boolean
        default: false
```

## Artifact Management

```yaml
# Upload
- uses: actions/upload-artifact@v4
  with:
    name: build-${{ github.sha }}
    path: dist/
    retention-days: 7
    if-no-files-found: error

# Download
- uses: actions/download-artifact@v4
  with:
    name: build-${{ github.sha }}
    path: dist/
```

## Self-Hosted Runners

```yaml
jobs:
  build:
    runs-on: [self-hosted, linux, x64, gpu]
    steps:
      - # GPU-accelerated build
```

### Runner Groups and Labels
- Use labels for capability routing (gpu, high-memory, arm64)
- Runner groups for team/environment isolation
- Ephemeral runners for security (fresh environment each job)

## Scheduled Workflows

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6am UTC

jobs:
  dependency-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit
      - # Create issue if vulnerabilities found
```

## GitHub Actions with ArgoCD

```yaml
# Trigger ArgoCD sync after image push
deploy:
  steps:
    - name: Update image tag in GitOps repo
      run: |
        git clone https://x-access-token:${{ secrets.GITOPS_TOKEN }}@github.com/org/gitops-repo.git
        cd gitops-repo
        yq e '.spec.template.spec.containers[0].image = "ghcr.io/org/app:${{ github.sha }}"' \
          -i apps/myapp/deployment.yaml
        git add . && git commit -m "Update myapp to ${{ github.sha }}"
        git push

    - name: Wait for ArgoCD sync
      run: |
        argocd app sync myapp --grpc-web
        argocd app wait myapp --health --grpc-web
```

## Monorepo Patterns

```yaml
on:
  push:
    paths:
      - 'services/api/**'

jobs:
  detect-changes:
    outputs:
      api: ${{ steps.changes.outputs.api }}
      web: ${{ steps.changes.outputs.web }}
    steps:
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            api:
              - 'services/api/**'
            web:
              - 'services/web/**'

  build-api:
    needs: [detect-changes]
    if: needs.detect-changes.outputs.api == 'true'
    # ...
```

## Rate Limiting and Retries

```yaml
- name: Deploy with retry
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 30
    command: ./deploy.sh
```

## Release Automation

```yaml
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: |
            dist/*.tar.gz
            dist/*.zip
```
