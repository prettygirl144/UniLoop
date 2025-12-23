import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import MediaUploader from "./MediaUploader";

const forumPostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  isAnonymous: z.boolean().default(false),
});

interface EnhancedForumFormProps {
  onSuccess?: () => void;
}

export default function EnhancedForumForm({ onSuccess }: EnhancedForumFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const form = useForm<z.infer<typeof forumPostSchema>>({
    resolver: zodResolver(forumPostSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "General",
      isAnonymous: false,
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (values: z.infer<typeof forumPostSchema>) => {
      return await apiRequest("/api/forum/posts", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          mediaUrls,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Forum post created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      form.reset();
      setMediaUrls([]);
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create forum post",
        variant: "destructive",
      });
    },
  });

  const handleMediaUpload = (url: string) => {
    setMediaUrls(prev => [...prev, url]);
  };

  const removeMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => createPostMutation.mutate(values))} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter post title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="What's on your mind?" 
                  className="resize-none min-h-[120px]" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Academic">Academic</SelectItem>
                  <SelectItem value="Events">Events</SelectItem>
                  <SelectItem value="Sports">Sports</SelectItem>
                  <SelectItem value="Cultural">Cultural</SelectItem>
                  <SelectItem value="Tech">Tech</SelectItem>
                  <SelectItem value="Career">Career</SelectItem>
                  <SelectItem value="Housing">Housing</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isAnonymous"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Post Anonymously</FormLabel>
                <FormDescription>
                  Your name will not be shown with this post
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Media Upload Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Attachments</h3>
            <p className="text-sm text-muted-foreground">
              Add images or files to your post
            </p>
          </div>
          
          <MediaUploader 
            onUploadComplete={handleMediaUpload}
            existingUrls={mediaUrls}
            maxFiles={5}
            acceptedTypes={["image/*", "video/*", "application/pdf"]}
          />

          {/* Uploaded Media Preview */}
          {mediaUrls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Attachments ({mediaUrls.length})</h4>
              <div className="grid grid-cols-2 gap-2">
                {mediaUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Attachment ${index + 1}`}
                      className="w-full h-20 object-cover rounded border"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="50" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="12" fill="%236b7280">File</text></svg>`;
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMedia(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full"
          disabled={createPostMutation.isPending}
        >
          {createPostMutation.isPending ? "Creating Post..." : "Create Post"}
        </Button>
      </form>
    </Form>
  );
}