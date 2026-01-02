import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-2">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border border-border bg-background-card px-3 py-2 text-sm text-foreground',
            'placeholder:text-foreground-muted',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'hover:border-border-light transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-accent-red focus:ring-accent-red',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-accent-red">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
