import { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
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
  primary:
    'bg-pine-600 text-white shadow-btn hover:bg-pine-700 active:bg-pine-800 disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none',
  secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100/70',
  danger: 'bg-clay-600 text-white hover:bg-clay-500',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors whitespace-nowrap disabled:cursor-not-allowed',
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
    <div className={cn('bg-white border border-ink-100 rounded-2xl shadow-card', className)}>
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
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
        'h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400',
        'focus:border-pine-500 focus:ring-2 focus:ring-pine-500/15 focus:outline-none disabled:bg-ink-50 disabled:text-ink-400',
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
        'h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900',
        'focus:border-pine-500 focus:ring-2 focus:ring-pine-500/15 focus:outline-none disabled:bg-ink-50 disabled:text-ink-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

// ---------- Textarea ----------
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 resize-y',
        'focus:border-pine-500 focus:ring-2 focus:ring-pine-500/15 focus:outline-none disabled:bg-ink-50 disabled:text-ink-400',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

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

// ---------- Page header ----------
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

// ---------- Section title ----------
export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
      <h2 className="text-[15px] font-semibold text-ink-900 flex items-center gap-2">{children}</h2>
      {aside && <div className="text-xs font-medium text-ink-500">{aside}</div>}
    </div>
  )
}

// ---------- Segmented control ----------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled,
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-[10px] bg-ink-100/80 p-[3px] gap-0.5',
        disabled && 'opacity-40 pointer-events-none',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-lg font-medium transition-all whitespace-nowrap inline-flex items-center gap-1.5',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'bg-white text-ink-900 shadow-card font-semibold' : 'text-ink-500 hover:text-ink-800'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Stat card ----------
export function StatCard({
  label,
  value,
  delta,
  deltaGood,
  hint,
  icon,
  highlight,
  className,
  sub,
}: {
  label: ReactNode
  value: ReactNode
  /** Percentage or absolute change text, e.g. "12% vs last week". Arrow is added from the sign of `deltaGood`. */
  delta?: ReactNode
  /** true = good (green), false = bad (red), undefined = neutral. */
  deltaGood?: boolean
  /** "up" or "down" arrow for the delta. */
  hint?: 'up' | 'down' | 'flat'
  icon?: ReactNode
  highlight?: boolean
  className?: string
  /** Small secondary line under the value, e.g. a breakdown. */
  sub?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 sm:p-5 flex flex-col min-w-0',
        highlight
          ? 'bg-gradient-to-br from-pine-700 to-pine-900 border-transparent text-white'
          : 'bg-white border-ink-100 shadow-card',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[13px] font-medium truncate', highlight ? 'text-pine-100' : 'text-ink-500')}>
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
              highlight ? 'bg-white/15 text-white' : 'bg-pine-50 text-pine-700'
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="text-[26px] leading-tight font-bold tracking-tight mt-2 tabular-nums">{value}</span>
      {sub && <span className={cn('text-xs mt-0.5', highlight ? 'text-pine-100' : 'text-ink-500')}>{sub}</span>}
      {delta !== undefined && (
        <span
          className={cn(
            'text-xs font-semibold mt-1 inline-flex items-center gap-1',
            highlight
              ? 'text-pine-100'
              : deltaGood === undefined
                ? 'text-ink-500'
                : deltaGood
                  ? 'text-pine-600'
                  : 'text-clay-600'
          )}
        >
          {hint && <span aria-hidden="true">{hint === 'up' ? '▲' : hint === 'down' ? '▼' : '–'}</span>}
          <span>{delta}</span>
        </span>
      )}
    </div>
  )
}
