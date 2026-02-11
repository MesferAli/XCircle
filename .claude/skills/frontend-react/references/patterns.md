# React Patterns Reference

## Compound Components

Use compound components for related UI that shares implicit state:

```tsx
// Usage: <Select><Select.Trigger /><Select.Content>...</Select.Content></Select>
const SelectContext = createContext<SelectContextType | null>(null);

function Select({ children, value, onChange }: SelectProps) {
  return (
    <SelectContext value={{ value, onChange }}>
      {children}
    </SelectContext>
  );
}

Select.Trigger = function Trigger() {
  const ctx = use(SelectContext);
  if (!ctx) throw new Error("Select.Trigger must be used within Select");
  return <button>{ctx.value}</button>;
};
```

## Polymorphic Components (as prop)

```tsx
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
} & Omit<React.ComponentPropsWithoutRef<E>, "as">;

function Box<E extends React.ElementType = "div">({
  as,
  ...props
}: PolymorphicProps<E>) {
  const Component = as || "div";
  return <Component {...props} />;
}

// Usage: <Box as="section" className="..." />
```

## Custom Hook: useDebounce

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## Custom Hook: useMediaQuery

```tsx
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
```

## Optimistic Updates with TanStack Query

```tsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ["todos"] });
    const previous = queryClient.getQueryData<Todo[]>(["todos"]);

    queryClient.setQueryData<Todo[]>(["todos"], (old) =>
      old?.map((t) => (t.id === newTodo.id ? { ...t, ...newTodo } : t))
    );

    return { previous };
  },
  onError: (_err, _newTodo, context) => {
    queryClient.setQueryData(["todos"], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  },
});
```

## Form Pattern with Zod + react-hook-form

```tsx
const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} aria-invalid={!!errors.email} />
      {errors.email && <p role="alert">{errors.email.message}</p>}
    </form>
  );
}
```

## Error Boundary Pattern

```tsx
function ErrorBoundary({ children, fallback }: {
  children: React.ReactNode;
  fallback: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
}) {
  return (
    <ErrorBoundaryInner fallback={fallback}>
      {children}
    </ErrorBoundaryInner>
  );
}

// Usage at route level:
// <ErrorBoundary fallback={(error, reset) => <ErrorPage error={error} onRetry={reset} />}>
//   <Dashboard />
// </ErrorBoundary>
```

## Conditional Rendering with Discriminated Unions

```tsx
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: Error };

function UserList({ state }: { state: State }) {
  switch (state.status) {
    case "idle":
      return null;
    case "loading":
      return <Skeleton />;
    case "error":
      return <ErrorMessage error={state.error} />;
    case "success":
      return state.data.map((user) => <UserCard key={user.id} user={user} />);
  }
}
```

## Component Variants with CVA

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
```

## Server Component + Client Component Split (Next.js)

```tsx
// app/dashboard/page.tsx (Server Component - fetches data)
async function DashboardPage() {
  const stats = await getStats(); // runs on server
  return <DashboardClient initialStats={stats} />;
}

// app/dashboard/dashboard-client.tsx (Client Component - handles interactivity)
"use client";
export function DashboardClient({ initialStats }: { initialStats: Stats }) {
  const [filter, setFilter] = useState("all");
  // interactive client-side logic here
}
```
