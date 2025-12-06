"use client"

import { Check, X } from "lucide-react"

interface PasswordStrengthIndicatorProps {
  password: string
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "Number (0-9)", met: /[0-9]/.test(password) },
    { label: "Special character (!@#$%^&*)", met: /[!@#$%^&*]/.test(password) },
  ]

  const metCount = requirements.filter((req) => req.met).length
  const allMet = metCount === requirements.length

  return (
    <div className="space-y-3 mt-3 p-3 bg-muted/50 rounded-lg border border-muted">
      {requirements.map((req, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          {req.met ? (
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className={req.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>{req.label}</span>
        </div>
      ))}
      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            metCount === 0
              ? "w-0 bg-red-500"
              : metCount <= 2
                ? "w-1/3 bg-yellow-500"
                : metCount <= 4
                  ? "w-2/3 bg-blue-500"
                  : "w-full bg-green-500"
          }`}
        />
      </div>
    </div>
  )
}
