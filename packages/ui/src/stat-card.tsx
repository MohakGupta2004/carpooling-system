import * as React from 'react';

import { Card, CardContent } from '@repo/ui/card';
import type { IconType } from '@repo/ui/hugeicon';
import { cn } from '@repo/ui/lib/utils';

// The icon tile is the only place accent colour appears. It marks which metric
// family a figure belongs to; it is not decoration, so there is no second
// accent element (edge rule, tinted border) repeating the same information.
const accents = {
  default: 'bg-muted text-muted-foreground',
  info: 'bg-info/10 text-info',
  eco: 'bg-eco/10 text-eco',
  warning: 'bg-warning/10 text-warning',
};

export type StatAccent = keyof typeof accents;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'default',
  className,
  ...props
}: React.ComponentProps<'div'> & {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: IconType;
  accent?: StatAccent;
}) {
  return (
    <Card size="sm" data-slot="stat-card" className={className} {...props}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {sub && <p className="text-muted-foreground mt-0.5 truncate text-xs">{sub}</p>}
        </div>
        {Icon && (
          <span
            aria-hidden
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              accents[accent]
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export { StatCard };
