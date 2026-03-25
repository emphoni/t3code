import { forwardRef, useState, useEffect, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const circleA =
  "M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z";

const infinity =
  "M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z";

const circleB =
  "M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z";

const defaultWords = ["Working", "Thinking", "Planning", "Refining"];

interface ThinkingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional elapsed time string like "25s" or "2m 15s" */
  elapsed?: string | null;
  /** Custom words to cycle through */
  words?: string[];
}

const ThinkingIndicator = forwardRef<HTMLDivElement, ThinkingIndicatorProps>(
  ({ className, elapsed, words = defaultWords, ...props }, ref) => {
    const [index, setIndex] = useState(0);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
      const interval = setInterval(() => {
        setAnimating(true);
        // Small delay to allow exit animation before changing word
        setTimeout(() => {
          setIndex((i) => (i + 1) % words.length);
          setAnimating(false);
        }, 160);
      }, 4000);
      return () => clearInterval(interval);
    }, [words.length]);

    // Find the longest word for invisible spacer
    const longestWord = words.reduce((a, b) =>
      a.length >= b.length ? a : b,
    );

    const displayText = elapsed
      ? `${words[index]} for ${elapsed}`
      : `${words[index]}...`;

    return (
      <div
        ref={ref}
        role="status"
        className={cn("flex items-center gap-2 px-1.5 py-1", className)}
        {...props}
      >
        <svg
          aria-hidden
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground/60 shrink-0"
        >
          <path className="thinking-morph" d={circleA}>
            <animate
              attributeName="d"
              values={`${circleA};${infinity};${circleB};${infinity};${circleA}`}
              dur="6s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
            />
          </path>
        </svg>
        <span className="inline-grid text-[11px] overflow-hidden">
          {/* Invisible spacer for stable width */}
          <span
            className="col-start-1 row-start-1 invisible shimmer-text"
            aria-hidden="true"
          >
            {longestWord} for 99m 59s
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 shimmer-text transition-all duration-200",
              animating
                ? "opacity-0 -translate-y-2"
                : "opacity-100 translate-y-0",
            )}
          >
            {displayText}
          </span>
        </span>
      </div>
    );
  },
);

ThinkingIndicator.displayName = "ThinkingIndicator";

export { ThinkingIndicator };
export default ThinkingIndicator;
