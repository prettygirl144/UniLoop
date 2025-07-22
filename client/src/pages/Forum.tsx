import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Users, TrendingUp, ArrowUp, ArrowDown, Reply, Trash2, Plus, UserCheck, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';

// Zod schemas for form validation
const CommunityPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  isAnonymous: z.boolean().default(false),
});

const CommunityAnnouncementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
});

const ReplySchema = z.object({
  content: z.string().min(5, 'Reply must be at least 5 characters'),
  isAnonymous: z.boolean().default(false),
});

type CommunityPost = {
  id: number;
  title: string;
  content: string;
  category: string;
  authorId: string | null;
  authorName: string | null;
  isAnonymous: boolean;
  score: number;
  createdAt: string;
  mediaUrls?: string[];
};

type CommunityAnnouncement = {
  id: number;
  title: string;
  content: string;
  category: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  mediaUrls?: string[];
};

type CommunityReply = {
  id: number;
  postId: number;
  content: string;
  authorId: string | null;
  authorName: string | null;
  isAnonymous: boolean;
  score: number;
  createdAt: string;
};

const CATEGORIES = [
  'General Discussion',
  'Academic Help',
  'Campus Life',
  'Events & Activities',
  'Feedback & Suggestions',
  'Technical Support',
  'Clubs & Societies'
];

export default function Forum() {
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
  const { data: communityPosts = [], isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ['/api/community/posts'],
    retry: false,
  });

  const { data: communityAnnouncements = [], isLoading: announcementsLoading } = useQuery<CommunityAnnouncement[]>({
    queryKey: ['/api/community/announcements'],
    retry: false,
  });

  const { data: replies = [], isLoading: repliesLoading } = useQuery<CommunityReply[]>({
    queryKey: ['/api/community/posts', selectedPost?.id, 'replies'],
    enabled: !!selectedPost,
    retry: false,
  });

  // Forms
  const postForm = useForm({
    resolver: zodResolver(CommunityPostSchema),
    defaultValues: {
      title: '',
      content: '',
      category: CATEGORIES[0],
      isAnonymous: false,
    },
  });

  const announcementForm = useForm({
    resolver: zodResolver(CommunityAnnouncementSchema),
    defaultValues: {
      title: '',
      content: '',
      category: CATEGORIES[0],
    },
  });

  const replyForm = useForm({
    resolver: zodResolver(ReplySchema),
    defaultValues: {
      content: '',
      isAnonymous: false,
    },
  });

  // Mutations
  const createPostMutation = useMutation({
    mutationFn: async (data: z.infer<typeof CommunityPostSchema>) => {
      return await apiRequest('/api/community/posts', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      postForm.reset();
      setShowPostDialog(false);
      toast({
        title: 'Success',
        description: 'Your post has been created!',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
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

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: z.infer<typeof CommunityAnnouncementSchema>) => {
      return await apiRequest('/api/community/announcements', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/announcements'] });
      announcementForm.reset();
      setShowAnnouncementDialog(false);
      toast({
        title: 'Success',
        description: 'Announcement has been created!',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to create announcement. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const createReplyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ReplySchema>) => {
      return await apiRequest(`/api/community/posts/${selectedPost?.id}/replies`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts', selectedPost?.id, 'replies'] });
      replyForm.reset();
      toast({
        title: 'Success',
        description: 'Your reply has been posted!',
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to post reply. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: number; voteType: 'upvote' | 'downvote' }) => {
      return await apiRequest(`/api/community/posts/${postId}/vote`, 'POST', { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: 'Unauthorized',
          description: 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: 'Failed to vote. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canCreateAnnouncement = (user as any)?.role === 'admin' || (user as any)?.role === 'committee_club';

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-large font-semibold text-gray-900 dark:text-white mb-2">
          Community Space
        </h1>
        <p className="text-small text-gray-600 dark:text-gray-400">
          Connect, discuss, and stay updated with the campus community
        </p>
      </div>

      <Tabs defaultValue="board" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="board" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-small">Community Board</span>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-small">Official Announcements</span>
          </TabsTrigger>
        </TabsList>

        {/* Community Board Tab */}
        <TabsContent value="board" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h2 className="text-medium font-medium">Community Discussions</h2>
              <Badge variant="secondary" className="text-small">
                {communityPosts.length} posts
              </Badge>
            </div>
            {isAuthenticated && (
              <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
                <DialogTrigger asChild>
                  <Button className="text-small">
                    <Plus className="h-4 w-4 mr-2" />
                    New Post
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-medium">Create New Post</DialogTitle>
                  </DialogHeader>
                  <Form {...postForm}>
                    <form onSubmit={postForm.handleSubmit((data) => createPostMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={postForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter post title" {...field} className="text-small" />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={postForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Category</FormLabel>
                            <FormControl>
                              <select {...field} className="w-full p-2 border rounded text-small">
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={postForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Share your thoughts..."
                                className="min-h-24 text-small"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={postForm.control}
                        name="isAnonymous"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel className="text-small">Post anonymously</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full text-small"
                        disabled={createPostMutation.isPending}
                      >
                        {createPostMutation.isPending ? 'Creating...' : 'Create Post'}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {communityPosts.map((post: CommunityPost) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center gap-1 min-w-12">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAuthenticated) {
                              voteMutation.mutate({ postId: post.id, voteType: 'upvote' });
                            }
                          }}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <span className="text-small font-medium">{post.score || 0}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAuthenticated) {
                              voteMutation.mutate({ postId: post.id, voteType: 'downvote' });
                            }
                          }}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-small">
                            {post.category}
                          </Badge>
                          <span className="text-small text-gray-500">
                            by {post.isAnonymous ? 'Anonymous' : (post.authorName || 'Unknown')}
                          </span>
                          <span className="text-small text-gray-400">
                            {formatDate(post.createdAt)}
                          </span>
                        </div>
                        <h3 className="text-medium font-medium mb-2 line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-small text-gray-600 dark:text-gray-400 line-clamp-3">
                          {post.content}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {communityPosts.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-medium text-gray-500 mb-2">No posts yet</p>
                    <p className="text-small text-gray-400">Be the first to start a discussion!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Official Announcements Tab */}
        <TabsContent value="announcements" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-green-600" />
              <h2 className="text-medium font-medium">Official Announcements</h2>
              <Badge variant="secondary" className="text-small">
                {communityAnnouncements.length} announcements
              </Badge>
            </div>
            {canCreateAnnouncement && (
              <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                <DialogTrigger asChild>
                  <Button className="text-small">
                    <Plus className="h-4 w-4 mr-2" />
                    New Announcement
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-medium">Create Official Announcement</DialogTitle>
                  </DialogHeader>
                  <Form {...announcementForm}>
                    <form onSubmit={announcementForm.handleSubmit((data) => createAnnouncementMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={announcementForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter announcement title" {...field} className="text-small" />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={announcementForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Category</FormLabel>
                            <FormControl>
                              <select {...field} className="w-full p-2 border rounded text-small">
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={announcementForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter announcement content..."
                                className="min-h-24 text-small"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full text-small"
                        disabled={createAnnouncementMutation.isPending}
                      >
                        {createAnnouncementMutation.isPending ? 'Creating...' : 'Create Announcement'}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {announcementsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {communityAnnouncements.map((announcement: CommunityAnnouncement) => (
                <Card key={announcement.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="h-4 w-4 text-green-600" />
                      <Badge variant="outline" className="text-small">
                        {announcement.category}
                      </Badge>
                      <span className="text-small text-gray-500">
                        by {announcement.authorName}
                      </span>
                      <span className="text-small text-gray-400">
                        {formatDate(announcement.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-medium font-medium mb-2">
                      {announcement.title}
                    </h3>
                    <p className="text-small text-gray-600 dark:text-gray-400">
                      {announcement.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {communityAnnouncements.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-medium text-gray-500 mb-2">No announcements yet</p>
                    <p className="text-small text-gray-400">Official updates will appear here</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Post Detail Dialog */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-medium">{selectedPost.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-small">
                  {selectedPost.category}
                </Badge>
                <span className="text-small text-gray-500">
                  by {selectedPost.isAnonymous ? 'Anonymous' : (selectedPost.authorName || 'Unknown')}
                </span>
                <span className="text-small text-gray-400">
                  {formatDate(selectedPost.createdAt)}
                </span>
              </div>
              <p className="text-small">{selectedPost.content}</p>
              
              {/* Replies Section */}
              <div className="border-t pt-4">
                <h4 className="text-medium font-medium mb-4">Replies</h4>
                
                {isAuthenticated && (
                  <Form {...replyForm}>
                    <form onSubmit={replyForm.handleSubmit((data) => createReplyMutation.mutate(data))} className="space-y-3 mb-4">
                      <FormField
                        control={replyForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea 
                                placeholder="Write a reply..."
                                className="min-h-20 text-small"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center justify-between">
                        <FormField
                          control={replyForm.control}
                          name="isAnonymous"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-small">Reply anonymously</FormLabel>
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          size="sm"
                          className="text-small"
                          disabled={createReplyMutation.isPending}
                        >
                          <Reply className="h-4 w-4 mr-2" />
                          {createReplyMutation.isPending ? 'Posting...' : 'Reply'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
                
                {repliesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {replies.map((reply: CommunityReply) => (
                      <Card key={reply.id} className="bg-gray-50 dark:bg-gray-800">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-small text-gray-500">
                              {reply.isAnonymous ? 'Anonymous' : (reply.authorName || 'Unknown')}
                            </span>
                            <span className="text-small text-gray-400">
                              {formatDate(reply.createdAt)}
                            </span>
                          </div>
                          <p className="text-small">{reply.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                    {replies.length === 0 && (
                      <p className="text-small text-gray-500 text-center py-4">
                        No replies yet. Be the first to respond!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}