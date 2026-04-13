let seeded: boolean | null = null;

export function markDemoSeeded(value: boolean): void {
  seeded = value;
}

export function getDemoSeededStatus(): boolean | null {
  return seeded;
}
