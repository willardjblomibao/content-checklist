import { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

// ---------- Button ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-pine-700 text-white hover:bg-pine-800 active:bg-pine-900 disabled:bg-ink-200 disabled:text-ink-400',
  secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100',
  danger: 'bg-clay-600 text-white hover:bg-clay-500',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'

// ---------- Card ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('bg-white border border-ink-100 rounded-card shadow-card', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 pt-5', className)}>{children}</div>
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>
}

// ---------- Badge ----------
type BadgeVariant = 'completed' | 'in_progress' | 'active' | 'inactive' | 'admin' | 'assistant' | 'neutral'

const badgeStyles: Record<BadgeVariant, string> = {
  completed: 'bg-pine-100 text-pine-800',
  in_progress: 'bg-amber-100 text-amber-600',
  active: 'bg-pine-100 text-pine-800',
  inactive: 'bg-ink-100 text-ink-600',
  admin: 'bg-clay-100 text-clay-600',
  assistant: 'bg-ink-100 text-ink-700',
  neutral: 'bg-ink-100 text-ink-700',
}

const badgeLabels: Record<BadgeVariant, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  active: 'Active',
  inactive: 'Inactive',
  admin: 'Admin',
  assistant: 'Assistant',
  neutral: '',
}

export function Badge({ variant, children }: { variant: BadgeVariant; children?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeStyles[variant]
      )}
    >
      {children ?? badgeLabels[variant]}
    </span>
  )
}

// ---------- Input ----------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400',
        'focus:border-pine-500 disabled:bg-ink-50 disabled:text-ink-400',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

// ---------- Select ----------
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900',
        'focus:border-pine-500 disabled:bg-ink-50 disabled:text-ink-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

// ---------- Field (label wrapper) ----------
export function Field({
  label,
  htmlFor,
  required,
  children,
  hint,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-clay-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

export function LabelText(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium text-ink-700" {...props} />
}

// ---------- Empty state ----------
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      <p className="text-sm text-ink-500 mt-1.5 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ---------- Loading spinner ----------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-ink-400', className)} />
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-6 w-6" />
    </div>
  )
}
