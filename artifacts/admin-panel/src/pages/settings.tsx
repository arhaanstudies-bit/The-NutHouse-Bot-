import {
  useGetSettings,
  useUpdateSettings,
  useListApprovedUsers,
  useUpdateUser,
  getGetSettingsQueryKey,
  getListApprovedUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Bot, Save, Loader2, Shield, ShieldOff, UserCheck } from "lucide-react";

export default function SettingsPage() {
  const { data, isLoading } = useGetSettings();
  const { data: usersData } = useListApprovedUsers();
  const queryClient = useQueryClient();
  const update = useUpdateSettings();
  const updateUser = useUpdateUser();

  const [form, setForm] = useState({
    botName: "",
    adminPassword: "",
    minMediaRequired: 10,
    welcomeMessage: "",
    approvalMessage: "",
    declineMessage: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        botName: data.botName,
        adminPassword: data.adminPassword ?? "",
        minMediaRequired: data.minMediaRequired,
        welcomeMessage: data.welcomeMessage ?? "",
        approvalMessage: data.approvalMessage ?? "",
        declineMessage: data.declineMessage ?? "",
      });
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      { data: form },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        },
      }
    );
  };

  const toggleAdmin = (userId: number, isAdmin: boolean) => {
    updateUser.mutate(
      { id: userId, data: { status: "approved", isAdmin } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListApprovedUsersQueryKey() });
        },
      }
    );
  };

  const users = usersData ?? [];
  const admins = users.filter((u) => u.isAdmin);
  const nonAdmins = users.filter((u) => !u.isAdmin && u.status === "approved");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Bot Settings</h1>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-64 rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Bot Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botName">Bot Name</Label>
              <Input
                id="botName"
                value={form.botName}
                onChange={(e) => setForm({ ...form, botName: e.target.value })}
                placeholder="BR0 PR0 BOT"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minMedia">Minimum Media Required for Approval</Label>
              <Input
                id="minMedia"
                type="number"
                min={1}
                value={form.minMediaRequired}
                onChange={(e) =>
                  setForm({ ...form, minMediaRequired: Number(e.target.value) })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="welcome">Welcome Message</Label>
              <Textarea
                id="welcome"
                rows={2}
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm({ ...form, welcomeMessage: e.target.value })
                }
                placeholder="Sent when a new user joins the bot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval">Approval Message</Label>
              <Textarea
                id="approval"
                rows={2}
                value={form.approvalMessage}
                onChange={(e) =>
                  setForm({ ...form, approvalMessage: e.target.value })
                }
                placeholder="Sent when user is approved"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decline">Decline Message</Label>
              <Textarea
                id="decline"
                rows={2}
                value={form.declineMessage}
                onChange={(e) =>
                  setForm({ ...form, declineMessage: e.target.value })
                }
                placeholder="Sent when user is declined"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Admins</Label>
              {admins.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admins yet. Use /agentbro in Telegram or promote users below.</p>
              ) : (
                <div className="space-y-2">
                  {admins.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="font-medium">{u.firstName}</span>
                        <span className="text-muted-foreground">@{u.username || u.telegramId}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAdmin(u.id, false)}
                        disabled={updateUser.isPending}
                      >
                        <ShieldOff className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Promote to Admin</Label>
              {nonAdmins.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved users available to promote.</p>
              ) : (
                <div className="space-y-2">
                  {nonAdmins.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{u.firstName}</span>
                        <span className="text-muted-foreground">@{u.username || u.telegramId}</span>
                        <span className="text-muted-foreground">({u.mediaCount} media)</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAdmin(u.id, true)}
                        disabled={updateUser.isPending}
                      >
                        <Shield className="mr-1 h-3.5 w-3.5" />
                        Promote
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
