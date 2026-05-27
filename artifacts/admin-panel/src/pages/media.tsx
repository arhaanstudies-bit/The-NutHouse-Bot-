import {
  useListMedia,
  useListUserMedia,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Image, Video, Film } from "lucide-react";

export default function MediaPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const userId = params.get("userId");

  const { data: allMedia, isLoading: allLoading } = useListMedia();
  const { data: userMedia, isLoading: userLoading } = useListUserMedia(
    Number(userId) || 0,
    { query: { enabled: !!userId, queryKey: ["userMedia", Number(userId)] } }
  );

  const media = userId ? userMedia : allMedia;
  const isLoading = userId ? userLoading : allLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">
          {userId ? "User Media" : "All Media Submissions"}
        </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {userId ? "User Media" : "All Media Submissions"}
        </h1>
        <Badge variant="secondary">{media?.length ?? 0} items</Badge>
      </div>

      {media && media.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {item.type === "photo" ? (
                      <Image className="h-4 w-4 text-primary" />
                    ) : (
                      <Video className="h-4 w-4 text-primary" />
                    )}
                    {item.type === "photo" ? "Photo" : "Video"}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    #{item.id}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-center rounded-md bg-secondary/50 py-8">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
                {item.caption && (
                  <p className="text-sm text-muted-foreground">{item.caption}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>User #{item.userId}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground truncate">
                  {item.telegramFileId}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            No media submissions found
          </CardContent>
        </Card>
      )}
    </div>
  );
}
