import {
  useListApprovedUsers,
  useUpdateUser,
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
import { Ban, CheckCircle, Image, ExternalLink, Loader2 } from "lucide-react";

export default function ApprovedUsersPage() {
  const { data, isLoading } = useListApprovedUsers();
  const queryClient = useQueryClient();

  const update = useUpdateUser();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListApprovedUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Approved & Banned Users</h1>
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
      <h1 className="text-2xl font-bold">Approved & Banned Users</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Telegram ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Joined</TableHead>
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
                      <Badge
                        variant="outline"
                        className={
                          user.status === "approved"
                            ? "border-green-500/30 text-green-400"
                            : user.status === "banned"
                            ? "border-red-500/30 text-red-400"
                            : "border-yellow-500/30 text-yellow-400"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Image className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{user.mediaCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/media?userId=${user.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {user.status === "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() =>
                              update.mutate(
                                { id: user.id, data: { status: "banned" } },
                                { onSuccess: invalidate }
                              )
                            }
                            disabled={update.isPending}
                          >
                            {update.isPending && update.variables?.id === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Ban className="h-3.5 w-3.5" />
                            )}
                            Ban
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={() =>
                              update.mutate(
                                { id: user.id, data: { status: "approved" } },
                                { onSuccess: invalidate }
                              )
                            }
                            disabled={update.isPending}
                          >
                            {update.isPending && update.variables?.id === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Unban
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No approved or banned users
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
