import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

/**
 * The label above a group of related rows, fields or nav items.
 *
 * There were four different treatments of this in the app — `text-xs
 * font-semibold tracking-wider uppercase`, `text-xs font-medium tracking-wide
 * uppercase`, `text-[11px] tracking-wider uppercase`, and a mono variant in the
 * sidebar — all doing the same job. One job, one component.
 *
 * Sentence case, not uppercase: at 12px, tracked-out caps cost legibility and
 * read as a marketing kicker rather than a structural label.
 *
 * Renders a `<p>` by default. Pass `render` a heading element where the label
 * genuinely heads a section, so the document outline is correct.
 */
function GroupLabel({
  className,
  render,
  ...props
}: React.ComponentProps<'p'> & { render?: React.ElementType }) {
  const Component = render ?? 'p';
  return (
    <Component
      data-slot="group-label"
      className={cn('text-muted-foreground text-xs font-medium', className)}
      {...props}
    />
  );
}

export { GroupLabel };
