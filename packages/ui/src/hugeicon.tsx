import type { ComponentProps } from 'react';

import { HugeiconsIcon } from '@hugeicons/react';

type HugeIconData = ComponentProps<typeof HugeiconsIcon>['icon'];

export type IconType = (props: { className?: string; size?: number }) => React.ReactElement;

/**
 * Wraps a Hugeicons icon object into a component with the same call-site API as
 * our previous Tabler icons (`<CarIcon className="size-4" />`), so the whole app
 * migrates to Hugeicons (shadcn preset "base-nova") without touching every JSX.
 */
export function hi(icon: HugeIconData): IconType {
  function Icon({ className, size }: { className?: string; size?: number }) {
    return <HugeiconsIcon icon={icon} className={className} size={size} strokeWidth={1.8} />;
  }
  return Icon;
}
