const UNITS: { limitMs: number; divisorMs: number; suffix: string }[] = [
  { limitMs: 60_000, divisorMs: 1_000, suffix: "초 전" },
  { limitMs: 3_600_000, divisorMs: 60_000, suffix: "분 전" },
  { limitMs: 86_400_000, divisorMs: 3_600_000, suffix: "시간 전" },
  { limitMs: 604_800_000, divisorMs: 86_400_000, suffix: "일 전" },
];

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();

  if (diffMs < 0 || diffMs < 30_000) {
    return "방금 전";
  }

  for (const unit of UNITS) {
    if (diffMs < unit.limitMs) {
      return `${Math.floor(diffMs / unit.divisorMs)}${unit.suffix}`;
    }
  }

  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}
