import {
  useListPendingUsers,
  useApproveUser,
  useDeclineUser,
  getListPendingUsersQueryKey,
  getListApprovedUsersQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import { Check, X, Image, Video, ExternalLink, Loader2 } from "lucide-react";

export default function PendingUsersPage() {
  const { data, isLoading } = useListPendingUsers();
  const queryClient = useQueryClient();

  const approve = useApproveUser();
  const decline = useDeclineUser();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListPendingUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListApprovedUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Pending Users</h1>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-32 rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pending Users</h1>
        <Badge variant="secondary">{data?.length ?? 0} awaiting approval</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Telegram ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Media Submitted</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.length > 0 ? (
                data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.telegramId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      @{user.username ?? "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Image className="h-3.5 w-3.5 text-muted-foreground" />
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {user.mediaCount}
                        </span>
                        {user.mediaCount >= 10 && (
                          <Badge
                            variant="outline"
                            className="ml-1 border-green-500/30 text-green-400 text-[10px]"
                          >
                            Ready
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/media?userId=${user.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                          onClick={() =>
                            approve.mutate(
                              { id: user.id },
                              { onSuccess: invalidate }
                            )
                          }
                          disabled={approve.isPending}
                        >
                          {approve.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() =>
                            decline.mutate(
                              { id: user.id },
                              { onSuccess: invalidate }
                            )
                          }
                          disabled={decline.isPending}
                        >
                          {decline.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Decline
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No pending users
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
