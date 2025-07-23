import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Users, TrendingUp, ArrowUp, ArrowDown, Reply, Trash2, Plus, UserCheck, Flag, Search, Crown, Image, Filter, Calendar, User, Heart, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import { RichTextEditor, FormattedText } from '@/components/ui/rich-text-editor';
import { MediaUpload } from '@/components/ui/media-upload';

// Zod schemas for form validation
const CommunityPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content too long'),
  category: z.string().min(1, 'Category is required'),
  isAnonymous: z.boolean().default(false),
  mediaUrls: z.array(z.string()).max(5, 'Maximum 5 images allowed').default([]),
});

const CommunityAnnouncementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  content: z.string().min(10, 'Content must be at least 10 characters').max(5000, 'Content too long'),
  category: z.string().min(1, 'Category is required'),
  mediaUrls: z.array(z.string()).max(5, 'Maximum 5 images allowed').default([]),
});

const ReplySchema = z.object({
  content: z.string().min(5, 'Reply must be at least 5 characters').max(2000, 'Reply too long'),
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
  upvotes: number;
  downvotes: number;
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
  upvotes: number;
  downvotes: number;
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

const TIME_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Year', value: 'year' }
];

const SORT_OPTIONS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Most Upvoted', value: 'upvotes' },
  { label: 'Most Discussed', value: 'replies' },
  { label: 'Trending', value: 'trending' }
];

export default function Forum() {
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postsPage, setPostsPage] = useState(1);
  const [announcementsPage, setAnnouncementsPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<number>>(new Set());
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const POSTS_PER_PAGE = 10;

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
      mediaUrls: [],
    },
  });

  const announcementForm = useForm({
    resolver: zodResolver(CommunityAnnouncementSchema),
    defaultValues: {
      title: '',
      content: '',
      category: CATEGORIES[0],
      mediaUrls: [],
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
      return await apiRequest('POST', '/api/community/posts', data);
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
      return await apiRequest('POST', '/api/community/announcements', data);
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

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      return await apiRequest('DELETE', `/api/community/announcements/${announcementId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/announcements'] });
      toast({
        title: 'Success',
        description: 'Announcement has been deleted!',
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
        description: error instanceof Error ? error.message : 'Failed to delete announcement. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const createReplyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof ReplySchema>) => {
      return await apiRequest('POST', `/api/community/posts/${selectedPost?.id}/replies`, data);
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

  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      return await apiRequest('DELETE', `/api/community/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      toast({
        title: 'Success',
        description: 'Post has been deleted!',
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
        description: error instanceof Error ? error.message : 'Failed to delete post. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteReplyMutation = useMutation({
    mutationFn: async (replyId: number) => {
      return await apiRequest('DELETE', `/api/community/replies/${replyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts', selectedPost?.id, 'replies'] });
      toast({
        title: 'Success',
        description: 'Reply has been deleted!',
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
        description: error instanceof Error ? error.message : 'Failed to delete reply. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: number; voteType: 'upvote' | 'downvote' }) => {
      return await apiRequest('POST', `/api/community/posts/${postId}/vote`, { voteType });
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

  // Helper functions for content expansion
  const togglePostExpansion = (postId: number) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const toggleAnnouncementExpansion = (announcementId: number) => {
    setExpandedAnnouncements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(announcementId)) {
        newSet.delete(announcementId);
      } else {
        newSet.add(announcementId);
      }
      return newSet;
    });
  };

  // Helper function to check if content should be truncated
  const shouldTruncateContent = (content: string) => {
    return content.length > 200; // Adjust threshold as needed
  };

  // Helper function to get truncated content
  const getTruncatedContent = (content: string) => {
    if (content.length <= 200) return content;
    return content.substring(0, 200) + '...';
  };

  const canCreateAnnouncement = (user as any)?.role === 'admin' || (user as any)?.role === 'committee_club';
  const canDeletePosts = (user as any)?.role === 'admin';

  // Helper function to check if user can delete a specific post
  const canDeletePost = (post: CommunityPost) => {
    if (!user) return false;
    const userRole = (user as any)?.role;
    const userId = (user as any)?.id;
    
    // Admins can delete any post at any time
    if (userRole === 'admin') return true;
    
    // Users can delete their own posts within 1 hour
    if (post.authorId === userId) {
      const createdAt = new Date(post.createdAt);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return createdAt >= oneHourAgo;
    }
    
    return false;
  };

  // Helper function to check if user can delete a specific reply
  const canDeleteReply = (reply: CommunityReply) => {
    if (!user) return false;
    const userRole = (user as any)?.role;
    const userId = (user as any)?.id;
    
    // Admins can delete any reply at any time
    if (userRole === 'admin') return true;
    
    // Users can delete their own replies within 1 hour
    if (reply.authorId === userId) {
      const createdAt = new Date(reply.createdAt);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return createdAt >= oneHourAgo;
    }
    
    return false;
  };

  // Helper function to check if date is within time filter
  const isWithinTimeFilter = (dateString: string, filter: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return date >= today;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return date >= monthAgo;
      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return date >= yearAgo;
      default:
        return true;
    }
  };

  // Enhanced filter and sort posts
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = [...communityPosts];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((post: CommunityPost) =>
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query) ||
        (post.authorName && post.authorName.toLowerCase().includes(query))
      );
    }

    // Apply time filter
    if (timeFilter !== 'all') {
      filtered = filtered.filter((post: CommunityPost) => 
        isWithinTimeFilter(post.createdAt, timeFilter)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((post: CommunityPost) => 
        post.category === categoryFilter
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'upvotes':
        filtered.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
        break;
      case 'replies':
        // Would need reply count from backend, for now sort by upvotes
        filtered.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
        break;
      case 'trending':
        // Basic trending algorithm: recent posts with high engagement
        filtered.sort((a, b) => {
          const aScore = (a.upvotes || 0) + (a.downvotes || 0) + 
                        (isWithinTimeFilter(a.createdAt, 'week') ? 10 : 0);
          const bScore = (b.upvotes || 0) + (b.downvotes || 0) + 
                        (isWithinTimeFilter(b.createdAt, 'week') ? 10 : 0);
          return bScore - aScore;
        });
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return filtered;
  }, [communityPosts, searchQuery, timeFilter, categoryFilter, sortBy]);

  // Enhanced filter announcements
  const filteredAnnouncements = useMemo(() => {
    let filtered = [...communityAnnouncements];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((announcement: CommunityAnnouncement) =>
        announcement.title.toLowerCase().includes(query) ||
        announcement.content.toLowerCase().includes(query) ||
        announcement.authorName.toLowerCase().includes(query)
      );
    }

    if (timeFilter !== 'all') {
      filtered = filtered.filter((announcement: CommunityAnnouncement) => 
        isWithinTimeFilter(announcement.createdAt, timeFilter)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((announcement: CommunityAnnouncement) => 
        announcement.category === categoryFilter
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [communityAnnouncements, searchQuery, timeFilter, categoryFilter]);

  // Pagination logic
  const paginatedPosts = useMemo(() => {
    const startIndex = (postsPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    return filteredAndSortedPosts.slice(0, endIndex);
  }, [filteredAndSortedPosts, postsPage]);

  const paginatedAnnouncements = useMemo(() => {
    const startIndex = (announcementsPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    return filteredAnnouncements.slice(0, endIndex);
  }, [filteredAnnouncements, announcementsPage]);

  const hasMorePosts = filteredAndSortedPosts.length > paginatedPosts.length;
  const hasMoreAnnouncements = filteredAnnouncements.length > paginatedAnnouncements.length;

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
      <div className="mb-8 space-y-4">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search posts, announcements, and users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-small"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="text-small"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-small font-medium mb-2 block">Time Range</label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="text-small">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value} className="text-small">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {filter.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-small font-medium mb-2 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="text-small">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-small">All Categories</SelectItem>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category} className="text-small">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-small font-medium mb-2 block">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="text-small">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-small">
                        <div className="flex items-center gap-2">
                          {option.value === 'upvotes' && <Heart className="h-3 w-3" />}
                          {option.value === 'recent' && <Calendar className="h-3 w-3" />}
                          {option.value === 'replies' && <Reply className="h-3 w-3" />}
                          {option.value === 'trending' && <TrendingUp className="h-3 w-3" />}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-small text-gray-500">
                Showing {paginatedPosts.length} of {filteredAndSortedPosts.length} posts
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setTimeFilter('all');
                  setCategoryFilter('all');
                  setSortBy('recent');
                  setPostsPage(1);
                  setAnnouncementsPage(1);
                }}
                className="text-small"
              >
                Clear All
              </Button>
            </div>
          </Card>
        )}
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
          <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h2 className="text-medium font-medium">Community Discussions</h2>
              <Badge variant="secondary" className="text-small">
                {filteredAndSortedPosts.length} posts
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
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-medium">Create New Post</DialogTitle>
                    <DialogDescription className="text-small">
                      Share your thoughts with the community. You can add text, images, and format your content.
                    </DialogDescription>
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="text-small">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat} className="text-small">{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                              <RichTextEditor
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Share your thoughts... Use **bold**, *italic*, and _underline_ for formatting"
                                minHeight="120px"
                              />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={postForm.control}
                        name="mediaUrls"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Media (Optional)</FormLabel>
                            <FormControl>
                              <MediaUpload
                                value={field.value}
                                onChange={field.onChange}
                                maxFiles={5}
                                maxSize={5}
                                accept="image/*,.gif"
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
            <div className="space-y-4">
              <div className="grid gap-4">
                {paginatedPosts.map((post: CommunityPost) => (
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
                        <div className="flex items-center gap-2">
                          <span className="text-small font-medium text-green-600">{post.upvotes || 0}</span>
                          <span className="text-small font-medium text-red-600">{post.downvotes || 0}</span>
                        </div>
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
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-medium font-medium line-clamp-2 flex-1 break-words">
                            {post.title}
                          </h3>
                          {canDeletePost(post) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this post?')) {
                                  deletePostMutation.mutate(post.id);
                                }
                              }}
                              disabled={deletePostMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          <FormattedText 
                            className={expandedPosts.has(post.id) ? "break-words" : "break-words line-clamp-3"}
                          >
                            {expandedPosts.has(post.id) ? post.content : getTruncatedContent(post.content)}
                          </FormattedText>
                          {shouldTruncateContent(post.content) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePostExpansion(post.id);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-small mt-1 font-medium"
                            >
                              {expandedPosts.has(post.id) ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                        {post.mediaUrls && post.mediaUrls.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <Image className="h-3 w-3" />
                            <span className="text-small text-gray-500">{post.mediaUrls.length} image{post.mediaUrls.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>

              {/* Load More Button for Posts */}
              {hasMorePosts && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setPostsPage(postsPage + 1)}
                    className="text-small"
                  >
                    Load More Posts ({filteredAndSortedPosts.length - paginatedPosts.length} remaining)
                  </Button>
                </div>
              )}
              {paginatedPosts.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-medium text-gray-500 mb-2">
                      {searchQuery ? 'No posts found' : 'No posts yet'}
                    </p>
                    <p className="text-small text-gray-400">
                      {searchQuery ? 'Try a different search term' : 'Be the first to start a discussion!'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Official Announcements Tab */}
        <TabsContent value="announcements" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-green-600" />
              <h2 className="text-medium font-medium">Official Announcements</h2>
              <Badge variant="secondary" className="text-small">
                {filteredAnnouncements.length} announcements
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
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-medium">Create Official Announcement</DialogTitle>
                    <DialogDescription className="text-small">
                      Create an official announcement for the campus community. Only admins and committee members can create announcements.
                    </DialogDescription>
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="text-small">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat} className="text-small">{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                              <RichTextEditor
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Enter announcement content... Use **bold**, *italic*, and _underline_ for formatting"
                                minHeight="120px"
                              />
                            </FormControl>
                            <FormMessage className="text-small" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={announcementForm.control}
                        name="mediaUrls"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-small">Media (Optional)</FormLabel>
                            <FormControl>
                              <MediaUpload
                                value={field.value}
                                onChange={field.onChange}
                                maxFiles={5}
                                maxSize={5}
                                accept="image/*,.gif"
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
            <div className="space-y-4">
              <div className="grid gap-4">
                {paginatedAnnouncements.map((announcement: CommunityAnnouncement) => (
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
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-medium font-medium flex-1 break-words line-clamp-2">
                        {announcement.title}
                      </h3>
                      {canDeletePosts && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this announcement?')) {
                              deleteAnnouncementMutation.mutate(announcement.id);
                            }
                          }}
                          disabled={deleteAnnouncementMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      <FormattedText 
                        className={expandedAnnouncements.has(announcement.id) ? "break-words" : "break-words line-clamp-3"}
                      >
                        {expandedAnnouncements.has(announcement.id) ? announcement.content : getTruncatedContent(announcement.content)}
                      </FormattedText>
                      {shouldTruncateContent(announcement.content) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAnnouncementExpansion(announcement.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-small mt-1 font-medium"
                        >
                          {expandedAnnouncements.has(announcement.id) ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                    {announcement.mediaUrls && announcement.mediaUrls.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          <Image className="h-3 w-3 text-gray-500" />
                          <span className="text-small text-gray-500">
                            {announcement.mediaUrls.length} image{announcement.mediaUrls.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>

              {/* Load More Button for Announcements */}
              {hasMoreAnnouncements && (
                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setAnnouncementsPage(announcementsPage + 1)}
                    className="text-small"
                  >
                    Load More Announcements ({filteredAnnouncements.length - paginatedAnnouncements.length} remaining)
                  </Button>
                </div>
              )}

              {paginatedAnnouncements.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-medium text-gray-500 mb-2">
                      {searchQuery ? 'No announcements found' : 'No announcements yet'}
                    </p>
                    <p className="text-small text-gray-400">
                      {searchQuery ? 'Try a different search term' : 'Official updates will appear here'}
                    </p>
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
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-small">
                  {selectedPost.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-small text-gray-500">
                    by {selectedPost.isAnonymous ? 'Anonymous' : (selectedPost.authorName || 'Unknown')}
                  </span>
                  {!selectedPost.isAnonymous && (
                    <Badge variant="secondary" className="text-small px-1 py-0">
                      <Crown className="h-3 w-3 mr-1" />
                      OP
                    </Badge>
                  )}
                </div>
                <span className="text-small text-gray-400">
                  {formatDate(selectedPost.createdAt)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3 text-green-600" />
                    <span className="text-small font-medium text-green-600">{selectedPost.upvotes || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDown className="h-3 w-3 text-red-600" />
                    <span className="text-small font-medium text-red-600">{selectedPost.downvotes || 0}</span>
                  </div>
                </div>
              </div>
              
              <FormattedText className="text-small break-words">
                {selectedPost.content}
              </FormattedText>
              
              {/* Media Display */}
              {selectedPost.mediaUrls && selectedPost.mediaUrls.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedPost.mediaUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Post media ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(url, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              )}
              
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
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="text-small text-gray-500">
                                {reply.isAnonymous ? 'Anonymous' : (reply.authorName || 'Unknown')}
                              </span>
                              {!reply.isAnonymous && reply.authorId === selectedPost?.authorId && (
                                <Badge variant="secondary" className="text-small px-1 py-0">
                                  <Crown className="h-3 w-3 mr-1" />
                                  OP
                                </Badge>
                              )}
                            </div>
                            <span className="text-small text-gray-400">
                              {formatDate(reply.createdAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <ArrowUp className="h-3 w-3 text-green-600" />
                                <span className="text-small font-medium text-green-600">{reply.upvotes || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowDown className="h-3 w-3 text-red-600" />
                                <span className="text-small font-medium text-red-600">{reply.downvotes || 0}</span>
                              </div>
                              {canDeleteReply(reply) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 ml-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this reply?')) {
                                      deleteReplyMutation.mutate(reply.id);
                                    }
                                  }}
                                  disabled={deleteReplyMutation.isPending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <FormattedText className="text-small break-words">
                            {reply.content}
                          </FormattedText>
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