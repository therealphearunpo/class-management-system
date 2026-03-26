import React from 'react';

const variantStyles = {
  primary:
    'border border-primary-700/10 bg-primary-600 text-white shadow-[0_10px_24px_rgba(30,79,168,0.18)] hover:bg-primary-700 focus:ring-primary-500 dark:border-primary-300/10 dark:bg-primary-700 dark:hover:bg-primary-600',
  secondary:
    'border border-slate-200 bg-white text-gray-700 shadow-sm hover:bg-slate-50 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  success:
    'border border-green-700/10 bg-green-600 text-white shadow-[0_10px_24px_rgba(22,163,74,0.18)] hover:bg-green-700 focus:ring-green-500 dark:border-green-300/10 dark:bg-green-700 dark:hover:bg-green-600',
  danger:
    'border border-red-700/20 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.18)] hover:bg-red-700 focus:ring-red-500 dark:border-red-300/10 dark:bg-red-700 dark:hover:bg-red-600',
  ghost:
    'border border-transparent bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-500 dark:text-slate-300 dark:hover:bg-slate-800',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button',
  icon: Icon,
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-[0.01em]
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
        active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none
        dark:focus:ring-offset-slate-950
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {Icon && !loading && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
