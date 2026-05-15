/**
 * Advanced Notifications System
 * Manages real-time notifications, alerts, and user messaging
 */

export type NotificationLevel = "info" | "success" | "warning" | "error";
export type NotificationCategory = "job" | "schedule" | "customer" | "invoice" | "system" | "alert";

export interface Notification {
  id: string;
  type: NotificationLevel;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export interface NotificationPreference {
  category: NotificationCategory;
  enabled: boolean;
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

/**
 * Create notification instance
 */
export function createNotification(
  category: NotificationCategory,
  type: NotificationLevel,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
): Notification {
  return {
    id: `notif-${Date.now()}-${Math.random()}`,
    type,
    category,
    title,
    message,
    timestamp: new Date(),
    read: false,
    actionUrl,
    actionLabel,
  };
}

/**
 * Generate smart notifications based on business events
 */
export function generateSmartNotifications(type: string, data: any): Notification[] {
  const notifications: Notification[] = [];

  switch (type) {
    case "job-completed":
      notifications.push(
        createNotification(
          "job",
          "success",
          "Job Completed",
          `Job #${data.jobId} for ${data.customerName} has been completed successfully.`,
          `/jobs/${data.jobId}`,
          "View Job"
        )
      );
      if (Number(data.revenue) > 1500) {
        notifications.push(
          createNotification(
            "alert",
            "success",
            "High-Value Job Completed",
            `High-value job completed worth $${data.revenue}. Revenue milestone reached!`,
            `/invoices`,
            "View Invoices"
          )
        );
      }
      break;

    case "job-overdue":
      notifications.push(
        createNotification(
          "job",
          "error",
          "Job Overdue",
          `Job #${data.jobId} is now overdue (due: ${data.dueDate})`,
          `/jobs/${data.jobId}`,
          "Take Action"
        )
      );
      break;

    case "schedule-conflict":
      notifications.push(
        createNotification(
          "schedule",
          "warning",
          "Schedule Conflict",
          `Employee ${data.employeeName} has overlapping jobs scheduled for ${data.date}`,
          `/schedule`,
          "Review Schedule"
        )
      );
      break;

    case "customer-inactive":
      notifications.push(
        createNotification(
          "customer",
          "warning",
          "Inactive Customer",
          `Customer ${data.customerName} hasn't had any jobs in ${data.daysSinceJob} days`,
          `/customers/${data.customerId}`,
          "Reach Out"
        )
      );
      break;

    case "invoice-unpaid":
      notifications.push(
        createNotification(
          "invoice",
          "warning",
          "Invoice Overdue",
          `Invoice #${data.invoiceNumber} is now ${data.daysOverdue} days overdue ($${data.amount})`,
          `/invoices/${data.invoiceId}`,
          "Send Reminder"
        )
      );
      break;

    case "low-inventory":
      notifications.push(
        createNotification(
          "system",
          "warning",
          "Low Inventory Alert",
          `${data.itemName} inventory is running low (${data.quantity} units remaining)`,
          `/inventory`,
          "Reorder"
        )
      );
      break;

    case "crew-available":
      notifications.push(
        createNotification(
          "job",
          "info",
          "Crew Available",
          `Team ${data.crewName} is now available for assignments`,
          `/jobs`,
          "Assign Jobs"
        )
      );
      break;
  }

  return notifications;
}

/**
 * Get notification icon class based on type and level
 */
export function getNotificationIcon(level: NotificationLevel): string {
  switch (level) {
    case "success":
      return "CheckCircle2";
    case "error":
      return "AlertCircle";
    case "warning":
      return "AlertTriangle";
    case "info":
    default:
      return "Info";
  }
}

/**
 * Get notification color class
 */
export function getNotificationColor(level: NotificationLevel): string {
  switch (level) {
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "error":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "info":
    default:
      return "text-blue-600 dark:text-blue-400";
  }
}

/**
 * Format notification timestamp
 */
export function formatNotificationTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Filter notifications by category and read status
 */
export function filterNotifications(
  notifications: Notification[],
  category?: NotificationCategory,
  unreadOnly: boolean = false
): Notification[] {
  return notifications.filter(n => {
    if (unreadOnly && n.read) return false;
    if (category && n.category !== category) return false;
    return true;
  });
}

/**
 * Get notification summary
 */
export function getNotificationSummary(notifications: Notification[]): {
  total: number;
  unread: number;
  byLevel: Record<NotificationLevel, number>;
  byCategory: Record<NotificationCategory, number>;
} {
  const summary = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    byLevel: { info: 0, success: 0, warning: 0, error: 0 },
    byCategory: { job: 0, schedule: 0, customer: 0, invoice: 0, system: 0, alert: 0 },
  };

  notifications.forEach(n => {
    summary.byLevel[n.type]++;
    summary.byCategory[n.category]++;
  });

  return summary;
}
