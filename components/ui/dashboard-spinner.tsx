"use client";

/**
 * Spinner used for dashboard loading states.
 * Matches the Dashboard Home page loading animation.
 */
export function DashboardSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full bg-transparent">
      <style>{`
        .dashboard-spinner-svg {
          animation: dashboard-spinner-rotate 2s linear infinite;
        }
        .dashboard-spinner-circle {
          stroke-dasharray: 1, 200;
          stroke-dashoffset: 0;
          animation: dashboard-spinner-stretch 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }
        @keyframes dashboard-spinner-rotate {
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes dashboard-spinner-stretch {
          0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -35px;
          }
          100% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -124px;
          }
        }
      `}</style>

      <svg
        className="h-10 w-10 text-zinc-800 dark:text-zinc-200 dashboard-spinner-svg"
        viewBox="25 25 50 50"
      >
        <circle
          className="dashboard-spinner-circle"
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}
