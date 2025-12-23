import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

interface YourSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookSickFood?: () => void;
  onSubmitGrievance?: () => void;
}

interface SubmissionData {
  id: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'denied' | 'resolved' | 'open';
  type: 'sickFood' | 'grievance';
  title?: string;
  details?: string;
  dateRange?: { from: string; to?: string };
  meal?: string;
  hostel?: string;
}

interface PaginatedResponse {
  data: SubmissionData[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_COLOR_MAP = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  denied: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  open: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const SubmissionRow: React.FC<{ submission: SubmissionData }> = ({ submission }) => {
  const [expanded, setExpanded] = useState(false);

  const getTitle = () => {
    if (submission.type === 'sickFood') {
      const date = format(new Date(submission.dateRange?.from || submission.createdAt), 'dd MMM yyyy');
      const meal = submission.meal ? ` - ${submission.meal.charAt(0).toUpperCase() + submission.meal.slice(1)}` : '';
      return `Sick Food - ${date}${meal}`;
    }
    return submission.title || `Grievance - ${submission.details?.split(' ').slice(0, 3).join(' ')}...`;
  };

  const getSecondaryInfo = () => {
    const createdAt = new Date(submission.createdAt);
    const relative = formatDistanceToNow(createdAt, { addSuffix: true });
    const absolute = format(createdAt, 'dd MMM yyyy, HH:mm');
    
    let info = `${relative} (${absolute})`;
    if (submission.hostel) {
      info += ` • ${submission.hostel}`;
    }
    return info;
  };

  return (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-sm truncate pr-2" data-testid={`text-submission-title-${submission.id}`}>
                {getTitle()}
              </h4>
              <div className="flex items-center gap-2">
                <Badge 
                  className={`text-xs ${STATUS_COLOR_MAP[submission.status]} border-0`}
                  data-testid={`badge-status-${submission.id}`}
                >
                  {submission.status}
                </Badge>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground" data-testid={`text-submission-info-${submission.id}`}>
              {getSecondaryInfo()}
            </p>
          </div>
        </div>
        
        {expanded && submission.details && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground" data-testid={`text-submission-details-${submission.id}`}>
              {submission.details}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SubmissionsList: React.FC<{
  type: 'sickFood' | 'grievance';
  onBookSickFood?: () => void;
  onSubmitGrievance?: () => void;
}> = ({ type, onBookSickFood, onSubmitGrievance }) => {
  const [page, setPage] = useState(1);
  const limit = 5;

  const { data, isLoading, error } = useQuery<PaginatedResponse>({
    queryKey: ['userSubmissions', type, { page, limit }],
    queryFn: async () => {
      const endpoint = type === 'sickFood' 
        ? `/api/amenities/sick-food?scope=mine&page=${page}&limit=${limit}`
        : `/api/grievances?scope=mine&page=${page}&limit=${limit}`;
      
      console.log(`🔍 [USER-SUBMISSIONS] Fetching ${type} submissions from: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      
      console.log(`📊 [USER-SUBMISSIONS] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [USER-SUBMISSIONS] Error response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ [USER-SUBMISSIONS] Data received:`, data);
      return data;
    },
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="mb-2">
            <CardContent className="p-3">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load submissions. Please try again.
      </div>
    );
  }

  const submissions = data?.data || [];
  const totalPages = Math.ceil((data?.total || 0) / limit);

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          {type === 'sickFood' ? (
            <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          ) : (
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          )}
          <p className="text-muted-foreground mb-4">No submissions yet</p>
        </div>
        <div className="flex gap-2 justify-center">
          {type === 'sickFood' ? (
            <Button onClick={onBookSickFood} data-testid="button-book-sick-food-cta">
              Book Sick Food
            </Button>
          ) : (
            <Button onClick={onSubmitGrievance} data-testid="button-submit-grievance-cta">
              Submit Grievance
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2 mb-4">
        {submissions.map((submission) => (
          <SubmissionRow key={submission.id} submission={submission} />
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data?.total || 0} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const YourSubmissionsModal: React.FC<YourSubmissionsModalProps> = ({
  isOpen,
  onClose,
  onBookSickFood,
  onSubmitGrievance,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col"
        data-testid="dialog-your-submissions"
      >
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">Your Submissions</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="sickFood" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="sickFood" 
              className="flex items-center gap-2"
              data-testid="tab-sick-food"
            >
              <UserX className="h-4 w-4" />
              Sick Food
            </TabsTrigger>
            <TabsTrigger 
              value="grievances" 
              className="flex items-center gap-2"
              data-testid="tab-grievances"
            >
              <MessageCircle className="h-4 w-4" />
              Grievances
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="sickFood" className="flex-1 overflow-y-auto">
            <SubmissionsList 
              type="sickFood" 
              onBookSickFood={onBookSickFood}
            />
          </TabsContent>
          
          <TabsContent value="grievances" className="flex-1 overflow-y-auto">
            <SubmissionsList 
              type="grievance" 
              onSubmitGrievance={onSubmitGrievance}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default YourSubmissionsModal;