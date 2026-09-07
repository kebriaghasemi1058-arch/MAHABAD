export default function SunBadge({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "w-full h-full relative" : "mx-auto mb-4 w-20 h-20 relative"}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full animate-sun-spin"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="48"
            y="2"
            width="4"
            height="18"
            rx="2"
            fill="#C98A1F"
            opacity={0.85}
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={small ? "w-4 h-4 rounded-full bg-brick" : "w-10 h-10 rounded-full bg-brick"} />
      </div>
    </div>
  );
}
