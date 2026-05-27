export function FreshStackLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Leaf icon */}
      <path
        d="M4 16C4 8.268 10.268 2 18 2h2v6a8 8 0 01-8 8H4z"
        className="fill-fs-green"
      />
      <path
        d="M4 16h8a8 8 0 008 8v6h-2C7.164 30 4 23.732 4 16z"
        className="fill-fs-green-light"
      />
      <path
        d="M12 8c0 4.418-3.582 8-8 8"
        className="stroke-fs-green-pale stroke-[1.5]"
        strokeLinecap="round"
      />
      {/* Text */}
      <text
        x="28"
        y="20"
        className="fill-fs-green text-[13px] font-bold"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.5"
      >
        FreshStack
      </text>
    </svg>
  );
}

export function GoldMarryBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-fs-gold/40 bg-fs-warm px-3 py-1 text-xs font-medium text-fs-orange">
      <span className="text-[10px]">⭐</span>
      Gold Marry Fresh Fruits
    </div>
  );
}
