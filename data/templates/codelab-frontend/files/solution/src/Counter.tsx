import { useState } from "react";

export function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <div className="counter">
      <button onClick={() => setCount((c) => c - 1)} aria-label="Moins">-</button>
      <output>{count}</output>
      <button onClick={() => setCount((c) => c + 1)} aria-label="Plus">+</button>
    </div>
  );
}
