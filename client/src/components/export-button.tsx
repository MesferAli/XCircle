import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, Table, Loader2 } from "lucide-react";
import { exportData, ExportColumn, ExportFormat } from "@/lib/export-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface ExportButtonProps {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  formats?: ExportFormat[];
  orientation?: 'portrait' | 'landscape';
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  adminOnly?: boolean;
}

const formatLabels: Record<ExportFormat, { label: string; icon: typeof FileText }> = {
  pdf: { label: 'Export PDF', icon: FileText },
  excel: { label: 'Export Excel', icon: FileSpreadsheet },
  csv: { label: 'Export CSV', icon: Table },
};

export function ExportButton({
  title,
  subtitle,
  filename,
  columns,
  data,
  formats = ['pdf', 'excel'],
  orientation = 'landscape',
  variant = "outline",
  size = "default",
  disabled = false,
  adminOnly = true,
}: ExportButtonProps) {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.platformRole === 'platform_admin';

  if (adminOnly && !authLoading && !isAdmin) {
    return null;
  }

  const handleExport = async (format: ExportFormat) => {
    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no data available to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      // exportData is now async - libraries are loaded on demand
      await exportData({
        title,
        subtitle,
        filename: `${filename}-${new Date().toISOString().split('T')[0]}`,
        columns,
        data,
        format,
        orientation,
      });

      toast({
        title: "Export successful",
        description: `Data exported as ${format.toUpperCase()} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "An error occurred while exporting data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (formats.length === 1) {
    const format = formats[0];
    const { label, icon: Icon } = formatLabels[format];

    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(format)}
        disabled={disabled || isExporting || !data || data.length === 0}
        data-testid={`button-export-${format}`}
      >
        {isExporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icon className="mr-2 h-4 w-4" />
        )}
        {isExporting ? 'Exporting...' : label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting || !data || data.length === 0}
          data-testid="button-export"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => {
          const { label, icon: Icon } = formatLabels[format];
          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              disabled={isExporting}
              data-testid={`menu-export-${format}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
