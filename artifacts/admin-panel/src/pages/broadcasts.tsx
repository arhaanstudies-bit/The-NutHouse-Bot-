import { useListBroadcasts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Radio, CheckCircle, XCircle } from "lucide-react";

export default function BroadcastsPage() {
  const { data, isLoading } = useListBroadcasts();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Broadcast History</h1>
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
      <h1 className="text-2xl font-bold">Broadcast History</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broadcast ID</TableHead>
                <TableHead>Media ID</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.length > 0 ? (
                data.map((broadcast) => {
                  const total = broadcast.sentCount + broadcast.failedCount;
                  const rate = total > 0 ? Math.round((broadcast.sentCount / total) * 100) : 0;
                  return (
                    <TableRow key={broadcast.id}>
                      <TableCell className="font-mono text-xs">
                        #{broadcast.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{broadcast.mediaId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span className="text-sm font-medium">
                            {broadcast.sentCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="text-sm font-medium">
                            {broadcast.failedCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            rate >= 90
                              ? "border-green-500/30 text-green-400"
                              : rate >= 70
                              ? "border-yellow-500/30 text-yellow-400"
                              : "border-red-500/30 text-red-400"
                          }
                        >
                          {rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(broadcast.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No broadcasts yet
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
