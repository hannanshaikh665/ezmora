const DROPS = [
  { size: 260, top: "-4%", left: "6%", duration: 26 },
  { size: 160, top: "22%", left: "78%", duration: 34 },
  { size: 320, top: "58%", left: "-6%", duration: 40 },
  { size: 120, top: "72%", left: "62%", duration: 30 },
  { size: 200, top: "40%", left: "42%", duration: 46 },
];

/** Slow-drifting water droplets that add depth without pulling focus. */
export function DropletField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-60">
      {DROPS.map((drop, i) => (
        <span
          key={i}
          className="droplet"
          style={{
            width: drop.size,
            height: drop.size,
            top: drop.top,
            left: drop.left,
            animationDuration: `${drop.duration}s`,
            animationDelay: `${i * -6}s`,
          }}
        />
      ))}
    </div>
  );
}