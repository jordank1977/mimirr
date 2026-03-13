import { cn } from '@/lib/utils/cn'

interface RequestStatusBadgeProps {
  status: 'pending' | 'approved' | 'declined' | 'available' | 'processing'
}

const statusConfig = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  declined: {
    label: 'Declined',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  available: {
    label: 'Available',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  processing: {
    label: 'Processing',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
}

export function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
