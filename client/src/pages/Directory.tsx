import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, GraduationCap, RefreshCw, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react';
import { useLocation } from 'wouter';

interface DirectoryInfo {
  name: string;
  email: string;
  profileImageUrl?: string;
  rollNumber: string | null;
  batch: string | null;
  phone?: string | null;
}

interface StudentListItem {
  id: number;
  fullName: string;
  email: string;
  rollNumber: string | null;
  batch: string | null;
  section: string | null;
  phone?: string | null;
}

interface StudentListResponse {
  data: StudentListItem[];
  total: number;
  page: number;
  limit: number;
}

export default function Directory() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Parse URL parameters (path agnostic - works with /student-book or /directory)
  const urlParams = useMemo(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
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

    // Include 'All' in URL to make it explicit
    if (newBatch) {
      params.set('batch', newBatch);
    }
    if (newQuery) params.set('q', newQuery);
    if (newPage > 1) params.set('page', newPage.toString());

    const queryString = params.toString();
    setLocation(queryString ? `/student-book?${queryString}` : '/student-book');
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateURL({ query: searchQuery, page: 1 });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Helper: fetch with credentials and throw on error (avoids parsing error body as data)
  const fetchApi = async (url: string) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Request failed: ${res.status}`);
    }
    return res.json();
  };

  // Fetch current user's directory info with fresh data
  const { data: myDirectoryInfo, isLoading: myInfoLoading, refetch: refetchMyInfo, isError: myInfoError } = useQuery<DirectoryInfo & { cacheVersion?: number }>({
    queryKey: ['directory', 'me'],
    queryFn: () => fetchApi('/api/directory/me'),
    staleTime: 0, // Always fetch fresh data during rollout
    refetchOnWindowFocus: true,
  });

  // Set default batch filter to user's batch (only if no URL param and no selection)
  useEffect(() => {
    // If URL explicitly has 'All', use that
    if (urlParams.batch === 'All') {
      if (selectedBatch !== 'All') {
        setSelectedBatch('All');
      }
    }
    // If URL has a specific batch, use that
    else if (urlParams.batch && urlParams.batch !== 'All') {
      if (selectedBatch !== urlParams.batch) {
        setSelectedBatch(urlParams.batch);
      }
    }
    // If no URL param and no selection yet, default to user's batch
    else if (myDirectoryInfo?.batch && !selectedBatch && !urlParams.batch) {
      setSelectedBatch(myDirectoryInfo.batch);
    }
  }, [myDirectoryInfo, selectedBatch, urlParams.batch]);

  // Fetch student directory list
  const { data: studentList, isLoading: studentsLoading, isError: studentsError } = useQuery<StudentListResponse>({
    queryKey: ['directory', 'list', { 
      batch: selectedBatch || 'All', 
      query: searchQuery, 
      page: currentPage 
    }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      
      // Only send batch parameter if a specific batch is selected (not 'All' or empty)
      if (selectedBatch && selectedBatch !== 'All') {
        params.set('batch', selectedBatch);
      } else {
        // Explicitly set batch to 'All' to search across all batches
        params.set('batch', 'All');
      }
      
      if (searchQuery) {
        params.set('query', searchQuery);
      }

      return fetchApi(`/api/directory/list?${params}`);
    },
    enabled: !myInfoLoading, // Wait for user info to load first
  });

  // Fetch all available batches (safely default to ['All', 'Alumni'] on error to avoid .map crash)
  const { data: batchesData, isError: batchesError } = useQuery<string[]>({
    queryKey: ['directory', 'batches'],
    queryFn: () => fetchApi('/api/directory/batches'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  const availableBatches = Array.isArray(batchesData) ? batchesData : ['All', 'Alumni'];


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

  if (myInfoError) {
    return (
      <div className="p-4 space-y-4">
        <Card className="border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-small text-destructive font-medium">Failed to load Student Book</p>
            <p className="text-xs text-muted-foreground mt-1">Check your connection and try again.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchMyInfo()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-large">Student Book</h2>
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

      {/* Current User's Student Book Entry */}
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
              <h3 className="text-small font-medium text-gray-700">My Entry</h3>
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
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Roll:</span> 
                      <span>{myDirectoryInfo.rollNumber || "—"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Batch:</span> 
                      <span>{myDirectoryInfo.batch || "—"}</span>
                    </span>
                    {myDirectoryInfo.phone && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Phone:</span> 
                        <span>{myDirectoryInfo.phone}</span>
                      </span>
                    )}
                  </div>
                  {!myDirectoryInfo.rollNumber && !myDirectoryInfo.batch && !myDirectoryInfo.phone && (
                    <div className="text-amber-600 text-xs mt-1">
                      Not found in Student Book. Contact Admin.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classmates Section */}
      <div className="space-y-4">
        <h3 className="text-medium font-medium text-gray-700">Classmates</h3>
        
        {batchesError && (
          <p className="text-xs text-amber-600">Could not load batch list. Using default options.</p>
        )}
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
        ) : studentsError ? (
          <Card className="border-destructive">
            <CardContent className="p-6 text-center">
              <p className="text-small text-destructive font-medium">Failed to load classmates</p>
              <p className="text-xs text-muted-foreground mt-1">Please try again later.</p>
            </CardContent>
          </Card>
        ) : !Array.isArray(studentList?.data) || !studentList.data.length ? (
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
              {studentList.data.map((student) => {
                // Extract name from email if fullName contains an email
                const isEmailInFullName = student.fullName && student.fullName.includes('@');
                const displayName = isEmailInFullName ? 
                  student.fullName.split('@')[0].replace(/[._]/g, ' ').split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  ).join(' ') : 
                  student.fullName;

                return (
                  <Card key={student.id} className="transition-all hover:shadow-md" data-testid={`card-student-${student.id}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                          <UserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-small sm:text-medium font-medium text-gray-900 truncate">
                            {displayName || "Unknown Student"}
                          </h4>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-small text-gray-600 mt-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-4">
                              <span className="font-mono text-xs">
                                {student.rollNumber || "—"}
                              </span>
                              <span className="text-xs sm:text-small">
                                {student.batch || "—"}
                              </span>
                              {student.phone && (
                                <span className="text-xs sm:text-small">
                                  {student.phone}
                                </span>
                              )}
                            </div>
                            <span className="truncate text-xs sm:text-small max-w-full">
                              {student.email}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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