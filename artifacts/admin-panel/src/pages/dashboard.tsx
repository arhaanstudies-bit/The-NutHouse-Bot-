import {
  useGetDashboard,
  getListPendingUsersQueryKey,
  getListApprovedUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserCheck,
  UserX,
  Image,
  Radio,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

export default function DashboardPage() {
  const { data, isLoading } = useGetDashboard();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 w-20 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Total Users",
      value: data?.totalUsers ?? 0,
      icon: Users,
      color: "text-blue-400",
      href: "/approved-users",
    },
    {
      title: "Pending Approval",
      value: data?.pendingUsers ?? 0,
      icon: AlertCircle,
      color: "text-yellow-400",
      href: "/pending-users",
    },
    {
      title: "Approved",
      value: data?.approvedUsers ?? 0,
      icon: UserCheck,
      color: "text-green-400",
      href: "/approved-users",
    },
    {
      title: "Banned",
      value: data?.bannedUsers ?? 0,
      icon: UserX,
      color: "text-red-400",
      href: "/approved-users",
    },
    {
      title: "Total Media",
      value: data?.totalMedia ?? 0,
      icon: Image,
      color: "text-purple-400",
      href: "/media",
    },
    {
      title: "Broadcasts",
      value: data?.totalBroadcasts ?? 0,
      icon: Radio,
      color: "text-cyan-400",
      href: "/broadcasts",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/pending-users"
          className="text-sm text-primary hover:underline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: getListPendingUsersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListApprovedUsersQueryKey() });
          }}
        >
          Refresh Data
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-lg bg-secondary p-3 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      activity.type === "user_approved"
                        ? "bg-green-500"
                        : activity.type === "user_declined"
                        ? "bg-red-500"
                        : activity.type === "user_joined"
                        ? "bg-blue-500"
                        : activity.type === "media_submitted"
                        ? "bg-purple-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  <span className="flex-1">{activity.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
