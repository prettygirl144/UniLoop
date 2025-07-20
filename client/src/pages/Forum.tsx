import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, ThumbsUp, Heart, MessageSquare, Share, Bookmark } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { z } from 'zod';
import type { ForumPost } from '@shared/schema';

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().default('general'),
  isAnonymous: z.boolean().default(false),
});

type CreatePostForm = z.infer<typeof createPostSchema>;

const categories = [
  { value: 'general', label: 'All Posts' },
  { value: 'questions', label: 'Questions' },
  { value: 'discussions', label: 'Discussions' },
  { value: 'events', label: 'Events' },
];

export default function Forum() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeCategory, setActiveCategory] = useState('general');
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery<ForumPost[]>({
    queryKey: ['/api/forum/posts'],
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: CreatePostForm) => {
      await apiRequest('POST', '/api/forum/posts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/posts'] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Post created successfully!',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const reactToPostMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: number; type: string }) => {
      await apiRequest('POST', `/api/forum/posts/${postId}/react`, { type });
    },
    onSuccess: () => {
      // Optionally refetch reactions or update optimistically
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    },
  });

  const form = useForm<CreatePostForm>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      title: '',
      content: '',
      category: 'general',
      isAnonymous: false,
    },
  });

  const onSubmit = (data: CreatePostForm) => {
    createPostMutation.mutate(data);
  };

  const handleReact = (postId: number, type: string) => {
    reactToPostMutation.mutate({ postId, type });
  };

  const filteredPosts = posts?.filter(post => 
    activeCategory === 'general' || post.category === activeCategory
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Community Forum</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white w-10 h-10 rounded-full p-0">
              <Plus size={20} />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Create New Post</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="What's on your mind?" />
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
                        <Textarea {...field} placeholder="Share your thoughts..." rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isAnonymous"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">Post anonymously</FormLabel>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createPostMutation.isPending}>
                    {createPostMutation.isPending ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Forum Categories */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <Button
            key={category.value}
            variant={activeCategory === category.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(category.value)}
            className={`whitespace-nowrap text-xs ${
              activeCategory === category.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            {category.label}
          </Button>
        ))}
      </div>

      {/* Forum Posts */}
      <div className="space-y-4">
        {filteredPosts?.length === 0 ? (
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-8 text-center text-text-secondary">
              <MessageSquare size={48} className="mx-auto mb-2 opacity-30" />
              <p>No posts yet. Be the first to start a conversation!</p>
            </CardContent>
          </Card>
        ) : (
          filteredPosts?.map((post) => (
            <Card key={post.id} className="shadow-sm border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  {post.isAnonymous ? (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      A
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {user?.firstName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-medium">
                        {post.isAnonymous ? 'Anonymous' : 'User'}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {new Date(post.createdAt!).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm mb-2">{post.title}</h4>
                    <p className="text-xs text-text-secondary mb-3 whitespace-pre-wrap">
                      {post.content}
                    </p>
                    
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReact(post.id, 'like')}
                        className="flex items-center space-x-1 text-xs text-text-secondary p-0 h-auto hover:text-primary"
                      >
                        <ThumbsUp size={14} />
                        <span>12</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReact(post.id, 'heart')}
                        className="flex items-center space-x-1 text-xs text-text-secondary p-0 h-auto hover:text-red-500"
                      >
                        <Heart size={14} />
                        <span>3</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center space-x-1 text-xs text-text-secondary p-0 h-auto"
                      >
                        <MessageSquare size={14} />
                        <span>Comment</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center space-x-1 text-xs text-text-secondary p-0 h-auto"
                      >
                        <Bookmark size={14} />
                        <span>Save</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
