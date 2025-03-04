import { cn } from '@/lib/utils';
import * as React from 'react';

interface KeyboardShortcutProps extends React.HTMLAttributes<HTMLSpanElement> {
  shortcut: string;
}

export function KeyboardShortcut({ shortcut, className, ...props }: KeyboardShortcutProps) {
  return (
    <span
      className={cn(
        'ml-auto text-xs tracking-widest text-muted-foreground',
        className
      )}
      {...props}
    >
      {shortcut}
    </span>
  );
}

interface ShortcutTooltipProps {
  shortcut: string;
  children: React.ReactNode;
}

export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map(key => key.trim())
    .map(key => {
      switch (key.toLowerCase()) {
        case 'ctrl':
          return '⌃';
        case 'shift':
          return '⇧';
        case 'alt':
          return '⌥';
        case 'cmd':
        case 'meta':
          return '⌘';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        default:
          return key.toUpperCase();
      }
    })
    .join(' ');
}
