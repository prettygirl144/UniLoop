import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Users, TrendingUp, ArrowUp, ArrowDown, Reply, Trash2, Plus, UserCheck, Flag, Search, Crown, Image, Filter, Calendar, User, Heart, ChevronDown, Edit } from 'lucide-react';
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
  // Check URL parameters for default tab
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') === 'announcements' ? 'announcements' : 'posts';
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [showEditPostDialog, setShowEditPostDialog] = useState(false);
  const [showEditAnnouncementDialog, setShowEditAnnouncementDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CommunityAnnouncement | null>(null);
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

  const editPostMutation = useMutation({
    mutationFn: async (data: z.infer<typeof CommunityPostSchema> & { id: number }) => {
      return await apiRequest('PUT', `/api/community/posts/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/posts'] });
      postForm.reset();
      setShowEditPostDialog(false);
      setEditingPost(null);
      toast({
        title: 'Success',
        description: 'Your post has been updated!',
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
        description: 'Failed to update post. Please try again.',
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

  const editAnnouncementMutation = useMutation({
    mutationFn: async (data: z.infer<typeof CommunityAnnouncementSchema> & { id: number }) => {
      return await apiRequest('PUT', `/api/community/announcements/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/community/announcements'] });
      announcementForm.reset();
      setShowEditAnnouncementDialog(false);
      setEditingAnnouncement(null);
      toast({
        title: 'Success',
        description: 'Announcement has been updated!',
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
        description: 'Failed to update announcement. Please try again.',
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

  // Helper function to check if user can edit a specific post
  const canEditPost = (post: CommunityPost) => {
    if (!user) return false;
    const userRole = (user as any)?.role;
    const userId = (user as any)?.id;
    
    // Admins can edit any post at any time
    if (userRole === 'admin') return true;
    
    // Users can edit their own posts within 1 hour
    if (post.authorId === userId) {
      const createdAt = new Date(post.createdAt);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return createdAt >= oneHourAgo;
    }
    
    return false;
  };

  // Helper function to check if user can edit announcement
  const canEditAnnouncement = (announcement: CommunityAnnouncement) => {
    if (!user) return false;
    const userRole = (user as any)?.role;
    const userId = (user as any)?.id;
    
    // Admins can edit any announcement at any time
    if (userRole === 'admin') return true;
    
    // Users can edit their own announcements within 1 hour
    if (announcement.authorId === userId) {
      const createdAt = new Date(announcement.createdAt);
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return createdAt >= oneHourAgo;
    }
    
    return false;
  };

  // Helper function to check if user can delete announcement
  const canDeleteAnnouncement = (announcement: CommunityAnnouncement) => {
    if (!user) return false;
    const userRole = (user as any)?.role;
    const userId = (user as any)?.id;
    
    // Admins can delete any announcement at any time
    if (userRole === 'admin') return true;
    
    // Users can delete their own announcements within 1 hour
    if (announcement.authorId === userId) {
      const createdAt = new Date(announcement.createdAt);
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

  // Functions to handle editing
  const handleEditPost = (post: CommunityPost) => {
    setEditingPost(post);
    postForm.reset({
      title: post.title,
      content: post.content,
      category: post.category,
      isAnonymous: post.isAnonymous,
      mediaUrls: post.mediaUrls || [],
    });
    setShowEditPostDialog(true);
  };

  const handleEditAnnouncement = (announcement: CommunityAnnouncement) => {
    setEditingAnnouncement(announcement);
    announcementForm.reset({
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      mediaUrls: announcement.mediaUrls || [],
    });
    setShowEditAnnouncementDialog(true);
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
    <div className="w-full min-h-screen
                    /* Mobile: full width with minimal padding */
                    px-4 py-4
                    /* Desktop: centered with max width */
                    lg:max-w-6xl lg:mx-auto lg:px-6 lg:py-8">
      
      {/* Mobile-optimized header section */}
      <div className="mb-6 space-y-4 lg:mb-8">
        {/* Mobile-first search and filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
            <Input
              placeholder="Search posts and announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-small 
                         /* Mobile: larger tap target */
                         h-11 
                         /* Desktop: standard height */
                         lg:h-10
                         /* Touch optimization */
                         focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all duration-200"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="text-small
                       /* Mobile: full width on small screens */
                       w-full sm:w-auto
                       /* Mobile: larger tap target */
                       h-11 
                       /* Desktop: standard height */
                       lg:h-10
                       /* Touch feedback */
                       active:scale-98 transition-all duration-150"
          >
            <Filter className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Filters</span>
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* Mobile-optimized advanced filters */}
        {showFilters && (
          <Card className="p-4 lg:p-6
                           /* Mobile: rounded corners for modern feel */
                           rounded-xl
                           /* Animation for smooth expansion */
                           animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-small font-medium block">Time Range</label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="text-small
                                           /* Mobile: larger tap target */
                                           h-11 lg:h-10
                                           /* Touch optimization */
                                           focus:ring-2 focus:ring-primary focus:ring-opacity-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="/* Mobile: larger dropdown items */
                                           max-h-60 overflow-y-auto">
                    {TIME_FILTERS.map((filter) => (
                      <SelectItem 
                        key={filter.value} 
                        value={filter.value} 
                        className="text-small
                                   /* Mobile: larger tap targets */
                                   py-3 lg:py-2
                                   /* Touch feedback */
                                   active:bg-primary active:bg-opacity-10"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span>{filter.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-small font-medium block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="text-small h-11 lg:h-10 focus:ring-2 focus:ring-primary focus:ring-opacity-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all" className="text-small py-3 lg:py-2 active:bg-primary active:bg-opacity-10">
                      All Categories
                    </SelectItem>
                    {CATEGORIES.map((category) => (
                      <SelectItem 
                        key={category} 
                        value={category} 
                        className="text-small py-3 lg:py-2 active:bg-primary active:bg-opacity-10"
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <label className="text-small font-medium block">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="text-small h-11 lg:h-10 focus:ring-2 focus:ring-primary focus:ring-opacity-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value} 
                        className="text-small py-3 lg:py-2 active:bg-primary active:bg-opacity-10"
                      >
                        <div className="flex items-center gap-2">
                          {option.value === 'upvotes' && <Heart className="h-3 w-3 flex-shrink-0" />}
                          {option.value === 'recent' && <Calendar className="h-3 w-3 flex-shrink-0" />}
                          {option.value === 'replies' && <Reply className="h-3 w-3 flex-shrink-0" />}
                          {option.value === 'trending' && <TrendingUp className="h-3 w-3 flex-shrink-0" />}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile-optimized filter summary and clear action */}
            <div className="flex flex-col gap-3 mt-4 pt-4 border-t sm:flex-row sm:justify-between sm:items-center">
              <div className="text-small text-gray-500 text-center sm:text-left">
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
                className="text-small
                           /* Mobile: full width */
                           w-full sm:w-auto
                           /* Touch feedback */
                           active:scale-98 transition-all duration-150"
              >
                Clear All Filters
              </Button>
            </div>
          </Card>
        )}
      </div>
      {/* Mobile-optimized tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 
                             /* Mobile: larger height for easier tapping */
                             h-12 lg:h-10
                             /* Mobile: rounded for modern feel */
                             rounded-xl
                             /* Mobile: better contrast */
                             bg-gray-100 dark:bg-gray-800">
          <TabsTrigger 
            value="posts" 
            className="flex items-center gap-2 
                       /* Mobile: larger tap target */
                       h-10 lg:h-8
                       /* Touch feedback */
                       active:scale-98 transition-all duration-150
                       /* Typography */
                       text-small font-medium
                       /* Mobile: responsive text */
                       data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Community Board</span>
            <span className="sm:hidden">Community</span>
          </TabsTrigger>
          <TabsTrigger 
            value="announcements" 
            className="flex items-center gap-2 
                       h-10 lg:h-8
                       active:scale-98 transition-all duration-150
                       text-small font-medium
                       data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Official Announcements</span>
            <span className="sm:hidden">Announcements</span>
          </TabsTrigger>
        </TabsList>

        {/* Mobile-optimized Community Board Tab */}
        <TabsContent value="posts" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <h2 className="text-medium font-medium truncate">Community Discussions</h2>
                <Badge variant="secondary" className="text-small flex-shrink-0 
                                                     /* Mobile: smaller badge */
                                                     px-2 py-1">
                  {filteredAndSortedPosts.length}
                </Badge>
              </div>
              {isAuthenticated && (
                <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
                  <DialogTrigger asChild>
                    <Button className="text-small flex-shrink-0 
                                       /* Mobile: optimized spacing */
                                       px-3 py-2 h-9
                                       /* Desktop: standard spacing */
                                       lg:px-4 lg:h-10
                                       /* Touch feedback */
                                       active:scale-95 transition-all duration-150">
                      <Plus className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="hidden sm:inline">New Post</span>
                      <span className="sm:hidden">Post</span>
                    </Button>
                  </DialogTrigger>
                  {/* Mobile-optimized dialog content */}
                  <DialogContent className="w-full max-w-md 
                                           /* Mobile: full height with safe margins */
                                           max-h-[95vh] min-h-[50vh]
                                           /* Mobile: rounded corners */
                                           rounded-xl
                                           /* Scrolling for mobile */
                                           overflow-y-auto
                                           /* Touch optimization */
                                           touch-pan-y">
                    <DialogHeader className="space-y-3 pb-4 border-b">
                      <DialogTitle className="text-medium font-medium text-center sm:text-left">
                        Create New Post
                      </DialogTitle>
                      <DialogDescription className="text-small text-gray-600 text-center sm:text-left">
                        Share your thoughts with the community. You can add text, images, and format your content.
                      </DialogDescription>
                    </DialogHeader>
                    {/* Mobile-optimized form */}
                    <Form {...postForm}>
                      <form 
                        onSubmit={postForm.handleSubmit((data) => createPostMutation.mutate(data))} 
                        className="space-y-5 pt-4"
                      >
                        <FormField
                          control={postForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-small font-medium">Title</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter post title" 
                                  {...field} 
                                  className="text-small 
                                             /* Mobile: larger tap target */
                                             h-11 lg:h-10
                                             /* Touch optimization */
                                             focus:ring-2 focus:ring-primary focus:ring-opacity-20
                                             transition-all duration-200" 
                                />
                              </FormControl>
                              <FormMessage className="text-small" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={postForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-small font-medium">Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="text-small 
                                                           h-11 lg:h-10
                                                           focus:ring-2 focus:ring-primary focus:ring-opacity-20">
                                    <SelectValue placeholder="Select a category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                  {CATEGORIES.map((cat) => (
                                    <SelectItem 
                                      key={cat} 
                                      value={cat} 
                                      className="text-small py-3 lg:py-2 active:bg-primary active:bg-opacity-10"
                                    >
                                      {cat}
                                    </SelectItem>
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
                            <FormItem className="space-y-2">
                              <FormLabel className="text-small font-medium">Content</FormLabel>
                              <FormControl>
                                <RichTextEditor
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Share your thoughts... Use **bold**, *italic*, and _underline_ for formatting"
                                  minHeight="120px"
                                  className="/* Mobile: touch-friendly */
                                             focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-20"
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
                            <FormItem className="space-y-2">
                              <FormLabel className="text-small font-medium">Media (Optional)</FormLabel>
                              <FormControl>
                                <MediaUpload
                                  value={field.value}
                                  onChange={field.onChange}
                                  maxFiles={5}
                                  maxSize={5}
                                  accept="image/*,.gif"
                                  className="/* Mobile: touch-friendly upload area */
                                             min-h-[100px] border-2 border-dashed rounded-lg
                                             hover:border-primary transition-colors duration-200"
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
                            <FormItem className="flex items-center justify-between 
                                                 /* Mobile: better spacing */
                                                 py-3 px-4 bg-gray-50 rounded-lg">
                              <div className="space-y-1">
                                <FormLabel className="text-small font-medium">Post anonymously</FormLabel>
                                <div className="text-small text-gray-600">Hide your identity from other users</div>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="/* Mobile: larger touch target */
                                             data-[state=checked]:bg-primary"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        {/* Mobile-optimized submit button */}
                        <div className="pt-4 border-t">
                          <Button 
                            type="submit" 
                            className="w-full text-small font-medium
                                       /* Mobile: larger tap target */
                                       h-12 lg:h-10
                                       /* Touch feedback */
                                       active:scale-98 transition-all duration-150
                                       /* Loading state */
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={createPostMutation.isPending}
                          >
                            {createPostMutation.isPending ? (
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                              </div>
                            ) : (
                              'Create Post'
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>

          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mobile-optimized post grid */}
              <div className="grid gap-4">
                {paginatedPosts.map((post: CommunityPost) => (
                <Card 
                  key={post.id} 
                  className="/* Mobile: enhanced touch interaction */
                             hover:shadow-md active:scale-[0.99] transition-all duration-150 cursor-pointer
                             /* Mobile: rounded corners for modern feel */
                             rounded-xl
                             /* Touch optimization */
                             select-none" 
                  onClick={() => setSelectedPost(post)}
                >
                  <CardContent className="/* Mobile: optimized padding */
                                        p-4 lg:p-6">
                    <div className="flex gap-3 lg:gap-4">
                      {/* Mobile-optimized voting section */}
                      <div className="flex flex-col items-center gap-2 min-w-12 lg:min-w-14">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="/* Mobile: larger tap target */
                                     h-9 w-9 p-0 
                                     /* Desktop: standard size */
                                     lg:h-8 lg:w-8
                                     /* Touch feedback */
                                     active:scale-90 transition-all duration-150
                                     /* Focus ring */
                                     focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAuthenticated) {
                              voteMutation.mutate({ postId: post.id, voteType: 'upvote' });
                            }
                          }}
                          aria-label="Upvote post"
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
                          className="h-9 w-9 p-0 lg:h-8 lg:w-8
                                     active:scale-90 transition-all duration-150
                                     focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAuthenticated) {
                              voteMutation.mutate({ postId: post.id, voteType: 'downvote' });
                            }
                          }}
                          aria-label="Downvote post"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Mobile-responsive post metadata */}
                        <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:gap-2 sm:mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-small px-2 py-1 flex-shrink-0">
                              {post.category}
                            </Badge>
                            <span className="text-small text-gray-500 truncate">
                              by {post.isAnonymous ? 'Anonymous' : (post.authorName || 'Unknown')}
                            </span>
                          </div>
                          <span className="text-small text-gray-400 flex-shrink-0">
                            {formatDate(post.createdAt)}
                          </span>
                        </div>
                        {/* Mobile-optimized title and actions */}
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <h3 className="text-medium font-medium line-clamp-2 flex-1 break-words leading-snug">
                            {post.title}
                          </h3>
                          <div className="flex items-center gap-1">
                            {canEditPost(post) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="/* Mobile: larger tap target */
                                           h-8 w-8 p-0 
                                           /* Desktop: smaller */
                                           lg:h-6 lg:w-6
                                           /* Styling */
                                           text-blue-500 hover:text-blue-700 flex-shrink-0
                                           /* Touch feedback */
                                           active:scale-90 transition-all duration-150
                                           /* Focus ring */
                                           focus:ring-2 focus:ring-blue-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditPost(post);
                                }}
                                aria-label="Edit post"
                              >
                                <Edit className="h-3 w-3 lg:h-3 lg:w-3" />
                              </Button>
                            )}
                            {canDeletePost(post) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="/* Mobile: larger tap target */
                                           h-8 w-8 p-0 
                                           /* Desktop: smaller */
                                           lg:h-6 lg:w-6
                                           /* Styling */
                                           text-red-500 hover:text-red-700 flex-shrink-0
                                           /* Touch feedback */
                                           active:scale-90 transition-all duration-150
                                           /* Focus ring */
                                           focus:ring-2 focus:ring-red-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Are you sure you want to delete this post?')) {
                                    deletePostMutation.mutate(post.id);
                                  }
                                }}
                                disabled={deletePostMutation.isPending}
                                aria-label="Delete post"
                              >
                                <Trash2 className="h-3 w-3 lg:h-3 lg:w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {/* Mobile-optimized content display */}
                        <div className="text-gray-600 dark:text-gray-400 mb-3">
                          <FormattedText 
                            className={expandedPosts.has(post.id) ? "break-words text-small leading-relaxed" : "break-words line-clamp-3 text-small leading-relaxed"}
                          >
                            {expandedPosts.has(post.id) ? post.content : getTruncatedContent(post.content)}
                          </FormattedText>
                          {shouldTruncateContent(post.content) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePostExpansion(post.id);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-small mt-2 font-medium 
                                         /* Mobile: larger tap target */
                                         py-1 px-2 -mx-2 rounded
                                         /* Touch feedback */
                                         active:bg-blue-50 transition-all duration-150
                                         /* Focus ring */
                                         focus:outline-none focus:ring-2 focus:ring-blue-200"
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Flag className="h-5 w-5 text-green-600 flex-shrink-0" />
                <h2 className="text-medium font-medium truncate">Official Announcements</h2>
                <Badge variant="secondary" className="text-small flex-shrink-0">
                  {filteredAnnouncements.length}
                </Badge>
              </div>
              {canCreateAnnouncement && (
                <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                  <DialogTrigger asChild>
                    <Button className="text-small flex-shrink-0 ml-[4px] mr-[4px] pl-[8px] pr-[8px]">
                      <Plus className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">New Post</span>
                      <span className="sm:hidden">Add</span>
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
                      <div className="flex items-center gap-1">
                        {canEditAnnouncement(announcement) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700 
                                       active:scale-90 transition-all duration-150
                                       focus:ring-2 focus:ring-blue-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditAnnouncement(announcement);
                            }}
                            aria-label="Edit announcement"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        {canDeleteAnnouncement(announcement) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700
                                       active:scale-90 transition-all duration-150
                                       focus:ring-2 focus:ring-red-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this announcement?')) {
                                deleteAnnouncementMutation.mutate(announcement.id);
                              }
                            }}
                            disabled={deleteAnnouncementMutation.isPending}
                            aria-label="Delete announcement"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
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

      {/* Edit Post Dialog */}
      <Dialog open={showEditPostDialog} onOpenChange={setShowEditPostDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-medium">Edit Post</DialogTitle>
            <DialogDescription className="text-small text-gray-600">
              Make changes to your post. You can edit within 1 hour of posting.
            </DialogDescription>
          </DialogHeader>
          <Form {...postForm}>
            <form onSubmit={postForm.handleSubmit((data) => {
              if (editingPost) {
                editPostMutation.mutate({ ...data, id: editingPost.id });
              }
            })} className="space-y-4">
              <FormField
                control={postForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-small font-medium">Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter post title..."
                        {...field}
                        className="text-small h-11 lg:h-10"
                      />
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
                    <FormLabel className="text-small font-medium">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-small h-11 lg:h-10">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
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
                    <FormLabel className="text-small font-medium">Content</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Share your thoughts..."
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
                    <FormLabel className="text-small font-medium">Images (Optional)</FormLabel>
                    <FormControl>
                      <MediaUpload
                        onUpload={field.onChange}
                        maxFiles={5}
                        maxSize={5}
                        accept="image/*,.gif"
                        className="min-h-[100px] border-2 border-dashed rounded-lg
                                   hover:border-primary transition-colors duration-200"
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
                  <FormItem className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                    <div className="space-y-1">
                      <FormLabel className="text-small font-medium">Post anonymously</FormLabel>
                      <div className="text-small text-gray-600">Hide your identity from other users</div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="pt-4 border-t">
                <Button 
                  type="submit" 
                  className="w-full text-small font-medium h-12 lg:h-10
                             active:scale-98 transition-all duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={editPostMutation.isPending}
                >
                  {editPostMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    'Update Post'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Announcement Dialog */}
      <Dialog open={showEditAnnouncementDialog} onOpenChange={setShowEditAnnouncementDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-medium">Edit Announcement</DialogTitle>
            <DialogDescription className="text-small text-gray-600">
              Make changes to your announcement. You can edit within 1 hour of posting.
            </DialogDescription>
          </DialogHeader>
          <Form {...announcementForm}>
            <form onSubmit={announcementForm.handleSubmit((data) => {
              if (editingAnnouncement) {
                editAnnouncementMutation.mutate({ ...data, id: editingAnnouncement.id });
              }
            })} className="space-y-4">
              <FormField
                control={announcementForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-small font-medium">Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter announcement title..."
                        {...field}
                        className="text-small h-11 lg:h-10"
                      />
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
                    <FormLabel className="text-small font-medium">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-small h-11 lg:h-10">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
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
                    <FormLabel className="text-small font-medium">Content</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Write your announcement..."
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
                    <FormLabel className="text-small font-medium">Images (Optional)</FormLabel>
                    <FormControl>
                      <MediaUpload
                        onUpload={field.onChange}
                        maxFiles={5}
                        maxSize={5}
                        accept="image/*,.gif"
                        className="min-h-[100px] border-2 border-dashed rounded-lg
                                   hover:border-primary transition-colors duration-200"
                      />
                    </FormControl>
                    <FormMessage className="text-small" />
                  </FormItem>
                )}
              />
              
              <div className="pt-4 border-t">
                <Button 
                  type="submit" 
                  className="w-full text-small font-medium h-12 lg:h-10
                             active:scale-98 transition-all duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={editAnnouncementMutation.isPending}
                >
                  {editAnnouncementMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    'Update Announcement'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}