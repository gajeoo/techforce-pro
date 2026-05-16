import { useState, useMemo, useEffect } from "react";
import {
  Bell, X, Archive, Trash2, Filter, Zap, AlertTriangle, CheckCircle2, Info,
  AlertCircle, Eye, EyeOff, Settings, Clock, MapPin, DollarSign, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createNotification, generateSmartNotifications, getNotificationIcon,
  getNotificationColor, formatNotificationTime, filterNotifications,
  getNotificationSummary, type Notification, type NotificationCategory,
} from "@/lib/notifications";

// ─── Page Component ───────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | null>(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Generate sample notifications on mount
  useEffect(() => {
    const sampleNotifications: Notification[] = [
      createNotification(
        "job",
        "success",
        "Job #2504 Completed",
        "Hood suppression system inspection completed for Gold Coast Restaurant",
        "/jobs/2504",
        "View Job"
      ),
      createNotification(
        "alert",
        "error",
        "Critical: Overdue Invoice",
        "Invoice INV-2024-001 is now 5 days overdue ($1,450)",
        "/invoices/INV-2024-001",
        "Send Reminder"
      ),
      createNotification(
        "schedule",
        "warning",
        "Schedule Conflict Detected",
        "Employee Tyler Beaumont has overlapping jobs on May 16",
        "/schedule",
        "Resolve"
      ),
      createNotification(
        "customer",
        "info",
        "Inactive Customer Alert",
        "Harbor View Condominiums hasn't had any jobs in 30 days",
        "/customers/harbor-view",
        "Reach Out"
      ),
      createNotification(
        "invoice",
        "warning",
        "Low Inventory Alert",
        "Hood suppression cartridges inventory dropping below minimum threshold",
        "/inventory",
        "Reorder Now"
      ),
    ];

    // Mark first few as unread
    sampleNotifications[0].read = false;
    sampleNotifications[1].read = false;
    sampleNotifications[2].read = false;

    setNotifications(sampleNotifications);
  }, []);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    if (searchTerm) {
      result = result.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      result = filterNotifications(result, selectedCategory);
    }

    if (showUnreadOnly) {
      result = result.filter(n => !n.read);
    }

    return result;
  }, [notifications, searchTerm, selectedCategory, showUnreadOnly]);

  // Notification summary
  const summary = useMemo(() => getNotificationSummary(notifications), [notifications]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const categories: { value: NotificationCategory; label: string; count: number }[] = [
    { value: "job", label: "Jobs", count: summary.byCategory.job },
    { value: "schedule", label: "Schedule", count: summary.byCategory.schedule },
    { value: "customer", label: "Customers", count: summary.byCategory.customer },
    { value: "invoice", label: "Invoices", count: summary.byCategory.invoice },
    { value: "system", label: "System", count: summary.byCategory.system },
    { value: "alert", label: "Alerts", count: summary.byCategory.alert },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {summary.unread} unread out of {summary.total} notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            Mark All Read
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearAll}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <SummaryCard label="Unread" value={summary.unread} type="info" />
        <SummaryCard label="Errors" value={summary.byLevel.error} type="error" />
        <SummaryCard label="Warnings" value={summary.byLevel.warning} type="warning" />
        <SummaryCard label="Success" value={summary.byLevel.success} type="success" />
        <SummaryCard label="Total" value={summary.total} type="info" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar - Categories */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={selectedCategory === null ? "default" : "ghost"}
              className="w-full justify-between"
              onClick={() => setSelectedCategory(null)}
            >
              All
              <Badge variant="secondary">{summary.total}</Badge>
            </Button>

            {categories.map(cat => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "ghost"}
                className="w-full justify-between"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
                <Badge variant="secondary">{cat.count}</Badge>
              </Button>
            ))}

            <div className="pt-4 border-t space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={showUnreadOnly}
                  onCheckedChange={(checked) => setShowUnreadOnly(checked as boolean)}
                />
                <span className="text-sm">Unread Only</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Main - Notifications List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <div className="mt-4">
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-muted"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredNotifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredNotifications.map((notif) => (
                  <NotificationItem
                    key={notif.id}
                    notification={notif}
                    onMarkRead={() => handleMarkAsRead(notif.id)}
                    onDelete={() => handleDelete(notif.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Customize how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.value} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium text-sm">{cat.label}</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox defaultChecked />
                    <span>In App</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox />
                    <span>SMS</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notification Item Component ──────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
}

function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        notification.read
          ? "bg-muted/30 border-muted"
          : "bg-primary/5 border-primary/20"
      }`}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0 pt-0.5">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{notification.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {notification.message}
              </p>
            </div>
            {!notification.read && (
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {notification.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatNotificationTime(notification.timestamp)}
            </span>
            {notification.actionLabel && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                  }
                }}
              >
                {notification.actionLabel}
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkRead}
              title="Mark as read"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Card Component ───────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: number;
  type: "info" | "error" | "warning" | "success";
}

function SummaryCard({ label, value, type }: SummaryCardProps) {
  const colorClasses = {
    info: "text-blue-600 bg-blue-50 dark:bg-blue-950",
    error: "text-red-600 bg-red-50 dark:bg-red-950",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950",
    success: "text-green-600 bg-green-50 dark:bg-green-950",
  };

  return (
    <Card className={colorClasses[type]}>
      <CardContent className="pt-6">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
