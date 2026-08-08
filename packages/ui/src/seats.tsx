import { cn } from './lib/utils';

/**
 * Seat availability strip — one cell per seat. Occupied seats are muted, open
 * seats use the brand color, so a passenger can see at a glance how full the
 * ride is (and whether it's full at all).
 */
export function SeatIndicator({
  total,
  available,
  className,
}: {
  total: number;
  available: number;
  className?: string;
}) {
  const booked = Math.max(0, total - available);
  const full = available <= 0;
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={`${available} of ${total} seats available`}
    >
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const occupied = i < booked;
          return (
            <span
              key={i}
              className={cn(
                'h-4 w-3.5 rounded-[3px] border transition-colors',
                occupied
                  ? 'bg-muted-foreground/35 border-transparent'
                  : 'border-primary/40 bg-primary'
              )}
            />
          );
        })}
      </div>
      <span
        className={cn('text-xs font-medium', full ? 'text-destructive' : 'text-muted-foreground')}
      >
        {full ? 'Full' : `${available}/${total} free`}
      </span>
    </div>
  );
}
