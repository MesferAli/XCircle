# Brand Assets Reference

## Design Token Export Formats

### CSS Custom Properties (Primary)

```css
:root {
  /* Colors */
  --brand-primary: #2563eb;
  --brand-primary-hover: #1d4ed8;
  --brand-primary-active: #1e40af;
  --brand-secondary: #7c3aed;
  --brand-accent: #06b6d4;

  /* Semantic */
  --color-text-primary: #171717;
  --color-text-secondary: #525252;
  --color-text-muted: #a3a3a3;
  --color-text-inverse: #ffffff;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #fafafa;
  --color-bg-tertiary: #f5f5f5;
  --color-border-default: #e5e5e5;
  --color-border-strong: #d4d4d4;

  /* Typography */
  --font-family-display: 'Brand Display', Georgia, serif;
  --font-family-body: 'Brand Sans', system-ui, sans-serif;
  --font-family-mono: 'Brand Mono', 'Fira Code', monospace;

  /* Spacing */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #fafafa;
    --color-text-secondary: #a3a3a3;
    --color-text-muted: #737373;
    --color-text-inverse: #171717;
    --color-bg-primary: #0a0a0a;
    --color-bg-secondary: #171717;
    --color-bg-tertiary: #262626;
    --color-border-default: #404040;
    --color-border-strong: #525252;
  }
}
```

## Branded Component Templates

### Button System

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] font-semibold transition-all duration-[var(--transition-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] active:bg-[var(--brand-primary-active)] focus-visible:ring-[var(--brand-primary)]",
        secondary: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-default)] border border-[var(--color-border-default)]",
        ghost: "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]",
        danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
        link: "text-[var(--brand-primary)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
```

### Card Component

```tsx
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-[var(--card-padding,1.5rem)] shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 space-y-1", className)} {...props}>
      {children}
    </div>
  );
};

Card.Title = function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-display text-lg font-semibold text-[var(--color-text-primary)]", className)} {...props}>
      {children}
    </h3>
  );
};
```

## Email Template Brand Standards

```html
<!-- Email header -->
<table width="100%" style="background-color: var(--color-bg-secondary); padding: 40px 20px;">
  <tr>
    <td align="center">
      <table width="600" style="background: white; border-radius: 8px; overflow: hidden;">
        <!-- Logo -->
        <tr>
          <td style="padding: 32px 40px; border-bottom: 1px solid #e5e5e5;">
            <img src="logo.png" alt="Brand" height="32" />
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding: 40px; font-family: 'Brand Sans', system-ui, sans-serif; color: #171717; font-size: 16px; line-height: 1.5;">
            <!-- Email body -->
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding: 24px 40px; background: #fafafa; font-size: 12px; color: #737373;">
            &copy; 2026 Brand Name. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

## Brand Compliance Automation

### Stylelint Config for Brand Colors

```json
{
  "rules": {
    "color-no-hex": true,
    "declaration-property-value-disallowed-list": {
      "color": ["/^#/"],
      "background-color": ["/^#/"],
      "border-color": ["/^#/"]
    }
  }
}
```

This enforces CSS custom properties instead of hardcoded hex values, ensuring brand colors are always used from the design token system.

## Content Templates

### Blog Post Structure
```
# [Title - 50-60 chars, includes primary keyword]

[Lead paragraph - 2-3 sentences summarizing the post, includes primary keyword]

## [H2 - Major section with secondary keyword]

[Body paragraphs - 2-3 sentences each]

### [H3 - Subsection if needed]

[Supporting content]

## Key Takeaways

- [Bullet point summary]
- [Bullet point summary]
- [Bullet point summary]

## [CTA Section]

[Call to action aligned with brand voice]
```

### Social Media Templates
```
LinkedIn (max 3000 chars):
[Hook - first 2 lines visible in feed]

[Value - main insight or story]

[CTA - clear next step]

#hashtag1 #hashtag2 #hashtag3

---

Twitter/X (max 280 chars):
[Concise hook + value + CTA or link]
```
