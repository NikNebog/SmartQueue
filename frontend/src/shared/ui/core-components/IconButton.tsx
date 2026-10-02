import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  icon: ReactNode
  label: string
}

export function IconButton({
  active = false,
  className = '',
  icon,
  label,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${active ? 'icon-button-active' : ''} ${className}`.trim()}
      title={label}
      type={type}
      {...props}
    >
      {icon}
    </button>
  )
}
