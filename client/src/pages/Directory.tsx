import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Search, Filter, Send, Users, GraduationCap, RefreshCw, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { z } from 'zod';
import type { User } from '@shared/schema';
import { useLocation } from 'wouter';

interface DirectoryInfo {
  name: string;
  email: string;
  profileImageUrl?: string;
  rollNumber: string | null;
  batch: string | null;
}

interface StudentListItem {
  id: number;
  fullName: string;
  email: string;
  rollNumber: string | null;
  batch: string | null;
  section: string | null;
}

interface StudentListResponse {
  data: StudentListItem[];
  total: number;
  page: number;
  limit: number;
}

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

type MessageForm = z.infer<typeof messageSchema>;

export default function Directory() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<StudentListItem | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse URL parameters
  const urlParams = useMemo(() => {
    const params = new URLSearchParams(location.split('?')[1]);
    return {
      batch: params.get('batch') || '',
      query: params.get('q') || '',
      page: parseInt(params.get('page') || '1'),
    };
  }, [location]);

  // Update state from URL
  useEffect(() => {
    setSearchQuery(urlParams.query);
    setSelectedBatch(urlParams.batch);
    setCurrentPage(urlParams.page);
  }, [urlParams]);

  // Update URL when filters change
  const updateURL = (updates: { batch?: string; query?: string; page?: number }) => {
    const params = new URLSearchParams();
    const newBatch = updates.batch !== undefined ? updates.batch : selectedBatch;
    const newQuery = updates.query !== undefined ? updates.query : searchQuery;
    const newPage = updates.page !== undefined ? updates.page : currentPage;

    if (newBatch && newBatch !== 'All') params.set('batch', newBatch);
    if (newQuery) params.set('q', newQuery);
    if (newPage > 1) params.set('page', newPage.toString());

    const queryString = params.toString();
    setLocation(queryString ? `/directory?${queryString}` : '/directory');
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL({ query: searchQuery, page: 1 });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch current user's directory info with fresh data
  const { data: myDirectoryInfo, isLoading: myInfoLoading, refetch: refetchMyInfo } = useQuery<DirectoryInfo & { cacheVersion?: number }>({
    queryKey: ['directory', 'me'],
    queryFn: () => fetch('/api/directory/me').then(res => res.json()),
    staleTime: 0, // Always fetch fresh data during rollout
    refetchOnWindowFocus: true,
  });

  // Set default batch filter to user's batch
  useEffect(() => {
    if (myDirectoryInfo?.batch && !selectedBatch && !urlParams.batch) {
      setSelectedBatch(myDirectoryInfo.batch);
    }
  }, [myDirectoryInfo, selectedBatch, urlParams.batch]);

  // Fetch student directory list
  const { data: studentList, isLoading: studentsLoading } = useQuery<StudentListResponse>({
    queryKey: ['directory', 'list', { 
      batch: selectedBatch || myDirectoryInfo?.batch || 'All', 
      query: searchQuery, 
      page: currentPage 
    }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      
      if (selectedBatch && selectedBatch !== 'All') {
        params.set('batch', selectedBatch);
      } else if (myDirectoryInfo?.batch && selectedBatch !== 'All') {
        params.set('batch', myDirectoryInfo.batch);
      }
      
      if (searchQuery) {
        params.set('query', searchQuery);
      }

      return fetch(`/api/directory/list?${params}`).then(res => res.json());
    },
    enabled: !myInfoLoading, // Wait for user info to load first
  });

  // Fetch all available batches
  const { data: availableBatches = ['All'] } = useQuery<string[]>({
    queryKey: ['directory', 'batches'],
    queryFn: () => fetch('/api/directory/batches').then(res => res.json()),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const messageMutation = useMutation({
    mutationFn: async (data: MessageForm & { recipientEmail: string }) => {
      // This would typically send to a messaging API
      // For now, we'll just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      setShowMessageDialog(false);
      form.reset();
      toast({
        title: 'Message Sent',
        description: 'Your message has been sent successfully!',
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
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<MessageForm>({
    defaultValues: {
      message: '',
    },
  });

  const handleSendMessage = (data: MessageForm) => {
    if (selectedStudent) {
      messageMutation.mutate({
        ...data,
        recipientEmail: selectedStudent.email,
      });
    }
  };

  const handleContactStudent = (student: StudentListItem) => {
    setSelectedStudent(student);
    setShowMessageDialog(true);
  };

  // Pagination handlers
  const totalPages = Math.ceil((studentList?.total || 0) / 20);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateURL({ page });
  };

  const handleBatchChange = (batch: string) => {
    setSelectedBatch(batch);
    setCurrentPage(1);
    updateURL({ batch, page: 1 });
  };

  if (myInfoLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-large">Student Directory</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary p-2"
          onClick={() => refetchMyInfo()}
          disabled={myInfoLoading}
        >
          <RefreshCw className={`h-4 w-4 ${myInfoLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Current User's Directory Info */}
      {myInfoLoading ? (
        <Card className="mb-6 shadow-sm border-gray-100">
          <CardContent className="p-4">
            <div className="animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : myDirectoryInfo && (
        <Card className="mb-6 shadow-sm border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-small font-medium text-gray-700">My Directory Information</h3>
              <Badge variant="outline" className="text-xs">Me</Badge>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white">
                {myDirectoryInfo.profileImageUrl ? (
                  <img 
                    src={myDirectoryInfo.profileImageUrl} 
                    alt={myDirectoryInfo.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <GraduationCap className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-medium font-medium text-gray-900 mb-1">
                  {myDirectoryInfo.name}
                </h4>
                <div className="space-y-1 text-small text-gray-600">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Roll:</span> 
                      <span>{myDirectoryInfo.rollNumber || "—"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Batch:</span> 
                      <span>{myDirectoryInfo.batch || "—"}</span>
                    </span>
                  </div>
                  {!myDirectoryInfo.rollNumber && !myDirectoryInfo.batch && (
                    <div className="text-amber-600 text-xs mt-1">
                      Not found in directory. Contact Admin.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Directory Section */}
      <div className="space-y-4">
        <h3 className="text-medium font-medium text-gray-700">Class Directory</h3>
        
        {/* Controls Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search by name, email, or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <Select value={selectedBatch} onValueChange={handleBatchChange}>
              <SelectTrigger data-testid="select-batch">
                <SelectValue placeholder="Select Batch" />
              </SelectTrigger>
              <SelectContent>
                {availableBatches.map((batch) => (
                  <SelectItem key={batch} value={batch}>
                    {batch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Students List */}
        {studentsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !studentList?.data?.length ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-small text-muted-foreground">
                {searchQuery 
                  ? 'No students found for your search criteria' 
                  : 'No students found in this batch'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {studentList.data.map((student) => (
                <Card key={student.id} className="transition-all hover:shadow-md" data-testid={`card-student-${student.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                          <UserIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-medium font-medium text-gray-900">
                            {student.fullName}
                          </h4>
                          <div className="flex items-center gap-4 text-small text-gray-600 mt-1">
                            <span className="font-mono">
                              {student.rollNumber || "—"}
                            </span>
                            <span>
                              {student.batch || "—"}
                            </span>
                            <span className="truncate">
                              {student.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Dialog open={showMessageDialog && selectedStudent?.id === student.id} onOpenChange={setShowMessageDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleContactStudent(student)}
                            className="flex items-center space-x-1"
                            data-testid={`button-message-${student.id}`}
                          >
                            <Send size={14} />
                            <span>Message</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Send Message to {student.fullName}</DialogTitle>
                          </DialogHeader>
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSendMessage)} className="space-y-4">
                              <FormField
                                control={form.control}
                                name="message"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Message</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Type your message here..."
                                        {...field}
                                        data-testid="textarea-message"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  onClick={() => setShowMessageDialog(false)}
                                  data-testid="button-cancel-message"
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  type="submit" 
                                  disabled={messageMutation.isPending}
                                  data-testid="button-send-message"
                                >
                                  {messageMutation.isPending ? 'Sending...' : 'Send'}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-small text-gray-600">
                  Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, studentList.total)} of {studentList.total} students
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-small text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}