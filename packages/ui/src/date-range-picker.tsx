'use client';

import { useState } from 'react';

import { Button } from '@repo/ui/button';
import { Calendar } from '@repo/ui/calendar';
import { cn } from '@repo/ui/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/popover';
import { endOfDay, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

export interface Range {
  from: Date;
  to: Date;
}

const PRESETS: { label: string; range: () => Range | null }[] = [
  {
    label: 'Last 7 days',
    range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }),
  },
  {
    label: 'Last 30 days',
    range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }),
  },
  {
    label: 'This month',
    range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: 'Last 90 days',
    range: () => ({ from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }),
  },
  { label: 'All time', range: () => null },
];

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: Range | null;
  onChange: (r: Range | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined
  );

  const label = value
    ? `${format(value.from, 'd MMM')} – ${format(value.to, 'd MMM yyyy')}`
    : 'All time';

  const applyPreset = (r: Range | null) => {
    onChange(r);
    setDraft(r ? { from: r.from, to: r.to } : undefined);
    setOpen(false);
  };

  const applyDraft = () => {
    if (draft?.from && draft?.to) {
      onChange({ from: startOfDay(draft.from), to: endOfDay(draft.to) });
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn('justify-start gap-2 font-normal', className)} />
        }
      >
        <CalendarIcon className="text-muted-foreground size-4" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-auto gap-0 p-0">
        {/* presets */}
        <div className="border-border flex w-40 flex-col gap-1 border-r p-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.range())}
              className="hover:bg-accent rounded-md px-3 py-1.5 text-left text-sm"
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* calendar */}
        <div className="flex flex-col">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={draft}
            onSelect={setDraft}
            defaultMonth={value?.from}
          />
          <div className="border-border flex items-center justify-end gap-2 border-t p-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyDraft} disabled={!draft?.from || !draft?.to}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
