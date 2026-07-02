import { Loader2 } from "lucide-react";

export function AppStartupFallback() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">資産管理を起動しています...</span>
        </div>
    );
}
