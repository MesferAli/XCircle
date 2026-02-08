import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon | React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  } | React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  const isIconElement = React.isValidElement(icon);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center",
      className
    )}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        {isIconElement ? icon : (() => { const Icon = icon as LucideIcon; return <Icon className="h-8 w-8 text-muted-foreground" />; })()}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        React.isValidElement(action) ? action : (
          <Button onClick={(action as { label: string; onClick: () => void }).onClick} data-testid="button-empty-state-action">
            {(action as { label: string; onClick: () => void }).label}
          </Button>
        )
      )}
    </div>
  );
}
