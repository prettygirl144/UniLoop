import { useState, useRef, useEffect } from 'react';
import { useLocation, useRouter } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { 
  Utensils, 
  UserX, 
  Home, 
  AlertTriangle, 
  CalendarDays, 
  Upload, 
  Edit, 
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Download,
  FileSpreadsheet,
  Check,
  X,
  Filter,
  History,
  Eye,
  EyeOff
} from 'lucide-react';
import { YourSubmissionsModal } from '@/components/YourSubmissionsModal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { useWebSocket } from '@/hooks/useWebSocket';

// Enhanced schemas with all required fields
const sickFoodSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  mealType: z.string().min(1, 'Meal type is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  specialRequirements: z.string().optional(),
  phoneNumber: z.string()
    .min(1, 'Phone number is required')
    .regex(/^[+0-9]{10,15}$/, 'Enter a valid phone number (10-15 digits; + allowed)'),
  parcelMode: z.enum(['dine_in', 'takeaway'], {
    required_error: 'Please select how you want to receive your food',
  }),
});

const leaveApplicationSchema = z.object({
  // Google Form required fields
  email: z.string().email('Please enter a valid email address'),
  reason: z.string().min(1, 'Reason for leave is required'),
  startDate: z.string().min(1, 'Leave From date is required'),
  endDate: z.string().min(1, 'Leave To date is required'),
  leaveCity: z.string().min(1, 'Leave city is required'),
  // App-specific fields (kept for internal use)
  emergencyContact: z.string().min(1, 'Emergency contact is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
}).refine((data) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  return endDate >= startDate;
}, {
  message: 'Leave To date must be on or after Leave From date',
  path: ['endDate'],
});


const menuUploadSchema = z.object({
  date: z.string().optional(),
  mealType: z.string().optional(),
  items: z.string().optional(),
}).refine((data) => {
  // Skip validation if uploading Excel file
  return true;
}, { message: "Please either upload an Excel file or fill all manual fields" });

type SickFoodForm = z.infer<typeof sickFoodSchema>;
type LeaveApplicationForm = z.infer<typeof leaveApplicationSchema>;
type MenuUploadForm = z.infer<typeof menuUploadSchema>;

export default function Amenities() {
  const [location, navigate] = useLocation();
  
  // Initialize WebSocket connection for real-time updates
  useWebSocket();
  
  const [showSickFoodDialog, setShowSickFoodDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showGoogleFormDialog, setShowGoogleFormDialog] = useState(false);
  const [sickFoodDateFilter, setSickFoodDateFilter] = useState('');
  const [showGrievanceDialog, setShowGrievanceDialog] = useState(false);
  const [showMenuUploadDialog, setShowMenuUploadDialog] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editingMenu, setEditingMenu] = useState<{id: number, date: string, mealType: string, items: string[]} | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [hideLeaveApplications, setHideLeaveApplications] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user is admin
  const isAdmin = (user as any)?.role === 'admin';
  
  // Check if user has records access (Dining/Hostel, Sick Food, Leave Application, or Grievance Access)
  const hasRecordsAccess = isAdmin || 
    (user as any)?.permissions?.diningHostel || 
    (user as any)?.permissions?.sickFoodAccess || 
    (user as any)?.permissions?.leaveApplicationAccess || 
    (user as any)?.permissions?.grievanceAccess;
  
  // Check if user can edit menus (admin role OR diningHostel permission)
  const canEditMenu = isAdmin || (user as any)?.permissions?.diningHostel;
  
  // Determine current tab from URL
  const getCurrentTab = () => {
    if (location === '/amenities/services') return 'services';
    if (location === '/amenities/records') return 'records';
    if (location === '/amenities/menu') return 'menu';
    return 'menu'; // default
  };
  
  const currentTab = getCurrentTab();
  
  // Handle tab navigation
  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'services':
        navigate('/amenities/services');
        break;
      case 'records':
        navigate('/amenities/records');
        break;
      default:
        navigate('/amenities/menu');
    }
  };

  // Form instances
  const sickFoodForm = useForm<SickFoodForm>({
    resolver: zodResolver(sickFoodSchema),
    defaultValues: {
      date: '',
      mealType: '',
      roomNumber: '',
      specialRequirements: '',
      phoneNumber: '',
      parcelMode: 'dine_in',
    },
  });

  const leaveForm = useForm<LeaveApplicationForm>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      email: '',
      reason: '',
      startDate: '',
      endDate: '',
      leaveCity: '',
      emergencyContact: '',
      roomNumber: '',
    },
  });


  const menuUploadForm = useForm<MenuUploadForm>({
    resolver: zodResolver(menuUploadSchema),
    defaultValues: {
      date: '',
      mealType: '',
      items: '',
    },
  });

  const menuEditForm = useForm({
    defaultValues: {
      items: '',
    },
  });

  // Weekly menu query - gets today + 9 days by default
  const { data: weeklyMenuData = [], isLoading: menuLoading } = useQuery({
    queryKey: ['/api/amenities/menu'],
  });

  // Helper function to get date offset
  const getDateOffset = (daysOffset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  };

  // Helper function to format date display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const diffDays = Math.floor((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === 2) return 'Day After Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Get menu data for specific date
  const getMenuForDate = (dateStr: string) => {
    return (weeklyMenuData as any[]).find((menu: any) => menu.date === dateStr);
  };

  // Get menu data for date ranges
  const getTodayMenu = () => getMenuForDate(getDateOffset(0));
  const getTomorrowMenu = () => getMenuForDate(getDateOffset(1));
  const getDayAfterMenu = () => getMenuForDate(getDateOffset(2));
  const getNext7DaysMenu = () => {
    const menus = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = getDateOffset(i);
      const menu = getMenuForDate(dateStr);
      if (menu) {
        menus.push({
          ...menu,
          displayDate: formatDateDisplay(dateStr),
          dateStr
        });
      } else {
        menus.push({
          date: dateStr,
          displayDate: formatDateDisplay(dateStr),
          dateStr,
          breakfast: null,
          lunch: null,
          eveningSnacks: null,
          dinner: null
        });
      }
    }
    return menus;
  };

  // Standardized query key
  const baseKey = ['sick-food', 'bookings', { date: sickFoodDateFilter || null, scope: 'all' }];
  
  const { data: sickFoodBookings = [], isLoading: sickFoodLoading, error: sickFoodError } = useQuery({
    queryKey: baseKey,
    queryFn: async () => {
      const requestId = `sf_fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`📋 [CLIENT-SICK-FOOD-FETCH] Fetching bookings - Filter: ${sickFoodDateFilter || 'None'}, RequestID: ${requestId}`);
      
      const params = new URLSearchParams();
      if (sickFoodDateFilter) params.set('date', sickFoodDateFilter);
      params.set('scope', 'all');
      const endpoint = `/api/amenities/sick-food?${params.toString()}`;
      
      console.log(`🔑 [CLIENT-TRIAGE] EXACT QUERY KEY:`, JSON.stringify(baseKey));
      console.log(`🔗 [CLIENT-SICK-FOOD-FETCH] Full endpoint: ${window.location.origin}${endpoint}`);
      
      try {
        // Normalized fetcher function
        const res = await fetch(`${window.location.origin}${endpoint}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        
        // Accept common shapes: array | {data} | {rows} | {items}
        const list = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.rows)
          ? json.rows
          : Array.isArray(json?.items)
          ? json.items
          : [];
          
        // Optional: expose total for pagination
        const total = json?.total ?? json?.count ?? (Array.isArray(list) ? list.length : 0);
        
        console.debug('records payload', {
          typeof: typeof json,
          isArray: Array.isArray(json),
          keys: Object.keys(json || {}),
          sample: list.slice(0, 2),
          total,
          requestId
        });
        
        console.log(`✅ [CLIENT-SICK-FOOD-FETCH] Normalized bookings - Count: ${list.length}, RequestID: ${requestId}`);
        console.log(`🧪 [CLIENT-TRIAGE] NORMALIZED RESPONSE:`, { list: list.slice(0, 2), total });
        
        return list;
      } catch (error) {
        console.error(`❌ [CLIENT-SICK-FOOD-FETCH] Fetch failed - RequestID: ${requestId}:`, error);
        throw error;
      }
    },
    enabled: hasRecordsAccess,
    staleTime: 0,
    gcTime: 0,
  });
  
  // TRIAGE: Log query state changes
  useEffect(() => {
    console.log(`🧪 [CLIENT-TRIAGE] QUERY STATE CHANGE:`, {
      data: sickFoodBookings,
      isLoading: sickFoodLoading, 
      error: sickFoodError,
      enabled: hasRecordsAccess,
      length: Array.isArray(sickFoodBookings) ? sickFoodBookings.length : 'Not Array',
      type: typeof sickFoodBookings,
      filter: sickFoodDateFilter
    });
  }, [sickFoodBookings, sickFoodLoading, sickFoodError, isAdmin, sickFoodDateFilter]);

  const { data: leaveApplications = [] } = useQuery({
    queryKey: ['/api/hostel/leave'],
    enabled: hasRecordsAccess,
  });

  const { data: grievances = [] } = useQuery({
    queryKey: ['/api/grievances'],
    enabled: hasRecordsAccess,
  });

  // Mutations
  const sickFoodMutation = useMutation({
    mutationFn: async (data: SickFoodForm) => {
      const requestId = `sf_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🍽️ [CLIENT-SICK-FOOD] Starting booking submission - RequestID: ${requestId}`);
      console.log(`📝 [CLIENT-SICK-FOOD] Form data:`, {
        hasDate: !!data.date,
        hasMealType: !!data.mealType,
        hasRoomNumber: !!data.roomNumber,
        hasSpecialRequirements: !!data.specialRequirements,
        requestId
      });
      console.log(`🌐 [CLIENT-SICK-FOOD] API Base URL: ${window.location.origin}`);
      console.log(`🔗 [CLIENT-SICK-FOOD] Full endpoint: ${window.location.origin}/api/amenities/sick-food`);
      
      try {
        const response = await apiRequest('POST', '/api/amenities/sick-food', {
          ...data,
          _clientRequestId: requestId // Add client request ID for correlation
        });
        
        console.log(`✅ [CLIENT-SICK-FOOD] Booking successful - RequestID: ${requestId}`, response);
        return response;
      } catch (error) {
        console.error(`❌ [CLIENT-SICK-FOOD] Booking failed - RequestID: ${requestId}:`, error);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log(`🎉 [CLIENT-SICK-FOOD] Success handler triggered:`, response);
      setShowSickFoodDialog(false);
      sickFoodForm.reset();
      toast({
        title: 'Success',
        description: `Sick food booking submitted successfully! ${(response as any)?._diagnostics?.requestId ? `(ID: ${(response as any)._diagnostics.requestId})` : ''}`,
      });
      // Standardized invalidation with exact key matching
      const currentBaseKey = ['sick-food', 'bookings', { date: sickFoodDateFilter || null, scope: 'all' }];
      const safetyKey = ['sick-food', 'bookings'];
      
      console.log(`🔄 [CLIENT-TRIAGE] INVALIDATION KEY (exact):`, JSON.stringify(currentBaseKey));
      console.log(`🔄 [CLIENT-TRIAGE] INVALIDATION KEY (safety):`, JSON.stringify(safetyKey));
      
      queryClient.invalidateQueries({ queryKey: currentBaseKey, exact: true });
      queryClient.invalidateQueries({ queryKey: safetyKey, exact: true });
      
      // Invalidate user submissions cache for the modal
      queryClient.invalidateQueries({ queryKey: ['userSubmissions', 'sickFood'] });
      
      console.log(`🔄 [CLIENT-TRIAGE] Cache invalidation completed`);
    },
    onError: (error) => {
      console.error(`🚨 [CLIENT-SICK-FOOD] Error handler triggered:`, error);
      if (isUnauthorizedError(error)) {
        console.log(`🔐 [CLIENT-SICK-FOOD] Unauthorized error - redirecting to login`);
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
        description: `Failed to submit booking. Please try again. ${error instanceof Error ? `(${error.message})` : ''}`,
        variant: 'destructive',
      });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (data: LeaveApplicationForm) => {
      await apiRequest('POST', '/api/hostel/leave', data);
    },
    onSuccess: () => {
      setShowLeaveDialog(false);
      leaveForm.reset();
      toast({
        title: 'Success',
        description: 'Leave application submitted successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hostel/leave'] });
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
        description: 'Failed to submit application. Please try again.',
        variant: 'destructive',
      });
    },
  });


  const retryGoogleSync = useMutation({
    mutationFn: async (applicationId: string) => {
      const result = await apiRequest('POST', `/api/hostel/leave/${applicationId}/retry-google-sync`);
      return result;
    },
    onSuccess: () => {
      toast({ title: 'Google sync retry initiated' });
      queryClient.invalidateQueries({ queryKey: ['/api/hostel/leave'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        return;
      }
      console.error('Error retrying Google sync:', error);
      toast({
        title: 'Error',
        description: 'Failed to retry Google sync',
        variant: 'destructive',
      });
    },
  });

  const menuUploadMutation = useMutation({
    mutationFn: async (data: MenuUploadForm) => {
      if (!uploadedFile) {
        throw new Error('Please select an Excel file to upload');
      }
      
      console.log('Starting menu upload with file:', uploadedFile.name);
      
      const formData = new FormData();
      formData.append('menuFile', uploadedFile);
      
      console.log('FormData created, sending request...');
      
      const response = await fetch('/api/amenities/menu/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upload failed with error:', errorData);
        throw new Error(errorData.message || 'Failed to upload menu');
      }
      
      const result = await response.json();
      console.log('Upload successful:', result);
      return result;
    },
    onSuccess: (result: any) => {
      setShowMenuUploadDialog(false);
      menuUploadForm.reset();
      setUploadedFile(null);
      toast({
        title: 'Success',
        description: `Weekly menu uploaded successfully! ${result.data?.length || 0} entries added.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/amenities/menu'] });
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
        description: 'Failed to upload menu. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resolveGrievanceMutation = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: number; adminNotes?: string }) => {
      await apiRequest('POST', `/api/grievances/${id}/resolve`, { adminNotes });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Grievance resolved successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/grievances'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to resolve grievance.',
        variant: 'destructive',
      });
    },
  });

  // Leave status update mutations
  const approveLeaveApplication = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/hostel/leave/${id}/approve`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave application approved successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hostel/leave'] });
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
        description: 'Failed to approve leave application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const denyLeaveApplication = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/hostel/leave/${id}/deny`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Leave application denied successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/hostel/leave'] });
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
        description: 'Failed to deny leave application. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Sick food approval mutations
  const approveSickFoodMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/amenities/sick-food/${id}/approve`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Sick food booking approved successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['sick-food', 'bookings'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to approve sick food booking.',
        variant: 'destructive',
      });
    },
  });

  const rejectSickFoodMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('POST', `/api/amenities/sick-food/${id}/reject`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Sick food booking rejected successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['sick-food', 'bookings'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to reject sick food booking.',
        variant: 'destructive',
      });
    },
  });

  // Handlers for approval actions
  const handleApproveSickFood = (id: number) => {
    approveSickFoodMutation.mutate(id);
  };

  const handleRejectSickFood = (id: number) => {
    rejectSickFoodMutation.mutate(id);
  };

  // File upload handlers
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Check file extension instead of MIME type (more reliable)
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        toast({
          title: 'Invalid File',
          description: 'Please select an Excel (.xlsx) file.',
          variant: 'destructive',
        });
        return;
      }
      
      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: 'File size must be less than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('File validation passed, setting uploaded file');
      setUploadedFile(file);
    }
  };

  // Remove the processExcelFile function - let backend handle parsing

  // Download reports
  const downloadReports = async (reportType: 'sick-food' | 'leave-applications' | 'grievances') => {
    try {
      let data: any[] = [];
      let filename = '';
      
      switch (reportType) {
        case 'sick-food':
          // Transform sick food data for better CSV/Excel format
          data = (sickFoodBookings as any[]).map(booking => ({
            'ID': booking.id,
            'Date': new Date(booking.date).toLocaleDateString(),
            'Meal Type': booking.mealType,
            'Room Number': booking.roomNumber,
            'Phone Number': booking.phoneNumber || '—',
            'Parcel Mode': booking.parcelMode === 'dine_in' ? 'Mess' : booking.parcelMode === 'takeaway' ? 'Takeaway' : 'Mess',
            'Special Requirements': booking.specialRequirements || '',
            'User ID': booking.userId,
            'Created At': new Date(booking.createdAt).toLocaleString()
          }));
          filename = 'sick-food-bookings.xlsx';
          break;
        case 'leave-applications':
          // Enhanced data with Google Form fields
          data = (leaveApplications as any[]).map((app: any) => ({
            'ID': app.id,
            'Email': app.email || '',
            'Leave From': new Date(app.startDate).toLocaleDateString(),
            'Leave To': new Date(app.endDate).toLocaleDateString(),
            'Leave City': app.leaveCity || '',
            'Reason': app.reason,
            'Room Number': app.roomNumber,
            'Emergency Contact': app.emergencyContact,
            'Status': app.status,
            'Correlation ID': app.correlationId || '',
            'Google Sync Status': app.googleStatus?.ok ? 'Synced' : `Failed (${app.googleStatus?.attempts || 0} attempts)`,
            'Google Last Attempt': app.googleStatus?.lastAttempt ? new Date(app.googleStatus.lastAttempt).toLocaleString() : '',
            'Created At': new Date(app.createdAt).toLocaleString()
          }));
          filename = 'leave-applications.xlsx';
          break;
        case 'grievances':
          data = grievances as any[];
          filename = 'grievances.xlsx';
          break;
      }

      if (data.length === 0) {
        toast({
          title: 'No Data',
          description: 'No data available to download.',
          variant: 'destructive',
        });
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      XLSX.writeFile(workbook, filename);
      
      toast({
        title: 'Success',
        description: 'Report downloaded successfully!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download report.',
        variant: 'destructive',
      });
    }
  };

  // Edit menu functionality
  const editMenuMutation = useMutation({
    mutationFn: async ({ id, items, mealType }: { id: number; items: string | string[]; mealType?: string }) => {
      // If editing a specific meal type, send the mealType and items
      const payload = mealType ? { items, mealType } : { items };
      await apiRequest('PUT', `/api/amenities/menu/${id}`, payload);
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setEditingMenu(null);
      menuEditForm.reset();
      toast({
        title: 'Success',
        description: 'Menu updated successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/amenities/menu'] });
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
        description: 'Failed to update menu.',
        variant: 'destructive',
      });
    },
  });

  const handleEditMenu = (menuItem: any) => {
    setEditingMenu(menuItem);
    menuEditForm.setValue('items', menuItem.items.join('\n'));
    setShowEditDialog(true);
  };

  const handleSaveMenuEdit = (data: { items: string }) => {
    if (!editingMenu) return;
    
    // For specific meal type edits, send the items as a string (comma-separated)
    if (editingMenu.mealType && editingMenu.mealType !== 'all') {
      editMenuMutation.mutate({ 
        id: editingMenu.id, 
        items: data.items, // Send as string, not array
        mealType: editingMenu.mealType 
      });
    } else {
      // For full menu edits, split by lines
      const items = data.items.split('\n').filter(item => item.trim() !== '');
      editMenuMutation.mutate({ id: editingMenu.id, items });
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large">Amenities</h1>
          <p className="text-small text-muted-foreground">Campus dining, accommodation, and services</p>
        </div>
        {canEditMenu && (
          <div className="flex gap-2 flex-wrap">
            <Dialog open={showMenuUploadDialog} onOpenChange={setShowMenuUploadDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Menu
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Menu</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Excel File Upload */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="text-center">
                      <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <div className="text-small text-gray-600 mb-2">
                        Upload Excel file (.xlsx)
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleFileSelect}
                        className="mb-2"
                      >
                        Choose File
                      </Button>
                      {uploadedFile && (
                        <div className="text-small text-green-600">
                          Selected: {uploadedFile.name}
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  
                  <div className="text-center text-small text-gray-500">OR</div>
                  
                  {/* Manual Form */}
                  <Form {...menuUploadForm}>
                    <form onSubmit={menuUploadForm.handleSubmit((data) => menuUploadMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={menuUploadForm.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={menuUploadForm.control}
                        name="mealType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meal Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select meal type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="breakfast">Breakfast</SelectItem>
                                <SelectItem value="lunch">Lunch</SelectItem>
                                <SelectItem value="snacks">Snacks</SelectItem>
                                <SelectItem value="dinner">Dinner</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={menuUploadForm.control}
                        name="items"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Menu Items (one per line)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Rice&#10;Dal&#10;Sabzi&#10;Roti"
                                className="min-h-[100px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        disabled={menuUploadMutation.isPending || (!uploadedFile && (!menuUploadForm.watch('date') || !menuUploadForm.watch('mealType') || !menuUploadForm.watch('items')))}
                        className="w-full"
                      >
                        {menuUploadMutation.isPending ? 'Uploading...' : 'Upload Menu'}
                      </Button>
                    </form>
                  </Form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="menu">Weekly Menu</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          {hasRecordsAccess && <TabsTrigger value="records">Records</TabsTrigger>}
        </TabsList>

        <TabsContent value="menu" className="space-y-4">
          {menuLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">Loading weekly menu...</div>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="today" className="text-small">Today</TabsTrigger>
                <TabsTrigger value="tomorrow" className="text-small">Tomorrow</TabsTrigger>
                <TabsTrigger value="dayafter" className="text-small">Day After</TabsTrigger>
                <TabsTrigger value="week" className="text-small">Next 7 Days</TabsTrigger>
              </TabsList>

              {/* Today's Menu */}
              <TabsContent value="today" className="space-y-4">
                {(() => {
                  const todayMenu = getTodayMenu();
                  const todayDate = getDateOffset(0);
                  const todayMenuData = (weeklyMenuData as any[])?.find(m => m.date === todayDate);
                  
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Utensils className="h-5 w-5" />
                          Today's Menu
                          {canEditMenu && (
                            <Badge variant="secondary" className="text-xs ml-2">Click meal types to edit</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {todayMenu ? (
                          <div className="space-y-0">
                            <MealSection 
                              title="Breakfast" 
                              items={todayMenu.breakfast}
                              isAdmin={canEditMenu}
                              onEdit={() => {
                                if (todayMenuData) {
                                  setEditingMenu({
                                    id: todayMenuData.id,
                                    date: todayDate,
                                    mealType: 'breakfast',
                                    items: todayMenu.breakfast ? todayMenu.breakfast.split(',').map((item: string) => item.trim()) : []
                                  });
                                  menuEditForm.setValue('items', todayMenu.breakfast || '');
                                  setShowEditDialog(true);
                                }
                              }}
                            />
                            <MealSection 
                              title="Lunch" 
                              items={todayMenu.lunch}
                              isAdmin={canEditMenu}
                              onEdit={() => {
                                if (todayMenuData) {
                                  setEditingMenu({
                                    id: todayMenuData.id,
                                    date: todayDate,
                                    mealType: 'lunch',
                                    items: todayMenu.lunch ? todayMenu.lunch.split(',').map((item: string) => item.trim()) : []
                                  });
                                  menuEditForm.setValue('items', todayMenu.lunch || '');
                                  setShowEditDialog(true);
                                }
                              }}
                            />
                            <MealSection 
                              title="Evening Snacks" 
                              items={todayMenu.eveningSnacks}
                              isAdmin={canEditMenu}
                              onEdit={() => {
                                if (todayMenuData) {
                                  setEditingMenu({
                                    id: todayMenuData.id,
                                    date: todayDate,
                                    mealType: 'eveningSnacks',
                                    items: todayMenu.eveningSnacks ? todayMenu.eveningSnacks.split(',').map((item: string) => item.trim()) : []
                                  });
                                  menuEditForm.setValue('items', todayMenu.eveningSnacks || '');
                                  setShowEditDialog(true);
                                }
                              }}
                            />
                            <MealSection 
                              title="Dinner" 
                              items={todayMenu.dinner}
                              isAdmin={canEditMenu}
                              onEdit={() => {
                                if (todayMenuData) {
                                  setEditingMenu({
                                    id: todayMenuData.id,
                                    date: todayDate,
                                    mealType: 'dinner',
                                    items: todayMenu.dinner ? todayMenu.dinner.split(',').map((item: string) => item.trim()) : []
                                  });
                                  menuEditForm.setValue('items', todayMenu.dinner || '');
                                  setShowEditDialog(true);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            No menu available for {new Date(todayDate + 'T00:00:00').toLocaleDateString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* Tomorrow's Menu */}
              <TabsContent value="tomorrow" className="space-y-4">
                <WeeklyMenuCard 
                  title="Tomorrow's Menu"
                  menu={getTomorrowMenu()}
                  date={getDateOffset(1)}
                />
              </TabsContent>

              {/* Day After Tomorrow's Menu */}
              <TabsContent value="dayafter" className="space-y-4">
                <WeeklyMenuCard 
                  title="Day After Tomorrow's Menu"
                  menu={getDayAfterMenu()}
                  date={getDateOffset(2)}
                />
              </TabsContent>

              {/* Next 7 Days Menu */}
              <TabsContent value="week" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5" />
                      Next 7 Days Menu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {getNext7DaysMenu().map((dayMenu: any, index: number) => (
                        <div key={dayMenu.dateStr} className="border-b pb-4 last:border-b-0 last:pb-0">
                          <h3 className="text-medium mb-3 font-medium">{dayMenu.displayDate}</h3>
                          <div className="space-y-0">
                            <MealSection title="Breakfast" items={dayMenu.breakfast} />
                            <MealSection title="Lunch" items={dayMenu.lunch} />
                            <MealSection title="Evening Snacks" items={dayMenu.eveningSnacks} />
                            <MealSection title="Dinner" items={dayMenu.dinner} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          {/* Services Tab Header with View Submissions Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Services</h2>
              <p className="text-sm text-muted-foreground">Request amenities and submit feedback</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowSubmissionsModal(true)}
              className="flex items-center gap-2"
              data-testid="button-view-submissions"
            >
              <History className="h-4 w-4" />
              View Submissions
            </Button>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Sick Food Booking */}
            <Card className="w-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-medium">
                  <UserX className="h-5 w-5 flex-shrink-0" />
                  <span>Sick Food Booking</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-small text-muted-foreground mb-4 leading-relaxed">
                  Request sick food when you're unwell
                </p>
                <Dialog open={showSickFoodDialog} onOpenChange={setShowSickFoodDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">Book Sick Food</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Book Sick Food</DialogTitle>
                    </DialogHeader>
                    <Form {...sickFoodForm}>
                      <form onSubmit={sickFoodForm.handleSubmit((data) => sickFoodMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={sickFoodForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sickFoodForm.control}
                          name="mealType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meal Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select meal type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="breakfast">Breakfast</SelectItem>
                                  <SelectItem value="lunch">Lunch</SelectItem>
                                  <SelectItem value="dinner">Dinner</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sickFoodForm.control}
                          name="roomNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room Number</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., A-101" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sickFoodForm.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  inputMode="tel"
                                  pattern="^[+0-9]{10,15}$"
                                  placeholder="+91XXXXXXXXXX or 10-digit number"
                                  data-testid="input-phone-number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sickFoodForm.control}
                          name="parcelMode"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel>Food Collection *</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      id="dine_in"
                                      value="dine_in"
                                      checked={field.value === 'dine_in'}
                                      onChange={() => field.onChange('dine_in')}
                                      className="h-4 w-4"
                                      data-testid="radio-dine-in"
                                    />
                                    <label htmlFor="dine_in" className="text-sm">Have food in the mess itself</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      id="takeaway"
                                      value="takeaway"
                                      checked={field.value === 'takeaway'}
                                      onChange={() => field.onChange('takeaway')}
                                      className="h-4 w-4"
                                      data-testid="radio-takeaway"
                                    />
                                    <label htmlFor="takeaway" className="text-sm">Takeaway through friends</label>
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sickFoodForm.control}
                          name="specialRequirements"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Special Requirements</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Any dietary restrictions or special needs..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          disabled={sickFoodMutation.isPending}
                          className="w-full"
                        >
                          {sickFoodMutation.isPending ? 'Submitting...' : 'Submit Booking'}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Leave Application */}
            <Card className="w-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-medium">
                  <Home className="h-5 w-5 flex-shrink-0" />
                  <span>Leave Application</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-small text-muted-foreground mb-4 leading-relaxed">
                  Apply for hostel leave with approval workflow
                </p>
                <Dialog open={showGoogleFormDialog} onOpenChange={setShowGoogleFormDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full text-white hover:opacity-90" style={{ backgroundColor: '#2094F3' }}>Fill Form</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl w-[90vw] h-[90vh] p-0 flex flex-col">
                    <DialogHeader className="p-4 pb-2 flex-shrink-0">
                      <DialogTitle>Hostel Leave Application Form</DialogTitle>
                      <p className="text-small text-muted-foreground">
                        Complete the official leave application form. Your email may be automatically populated if you're signed in to Google.
                      </p>
                    </DialogHeader>
                    <div className="flex-1 p-4 pt-2 overflow-hidden">
                      <iframe
                        src="https://docs.google.com/forms/u/0/d/e/1FAIpQLScdAqB_-aEvPRBh4xJVmSPDv9tuYJWFAimPbspKZXwnLHEwFQ/viewform?pli=1&embedded=true"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        marginHeight={0}
                        marginWidth={0}
                        title="Hostel Leave Application Form"
                        className="rounded-lg"
                        allow="camera; microphone"
                        loading="lazy"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Submit Grievance */}
            <Card className="w-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-medium">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span>Submit Grievance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-small text-muted-foreground mb-4 leading-relaxed">
                  Report issues with mess, hostel, IT, or other services
                </p>
                <Dialog open={showGrievanceDialog} onOpenChange={setShowGrievanceDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">Submit Grievance</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-4xl w-[95vw] h-[90vh] max-h-[600px]">
                    <DialogHeader>
                      <DialogTitle>Submit Grievance</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 w-full h-full min-h-[500px]">
                      <iframe
                        src="https://docs.google.com/forms/d/e/1FAIpQLSf0DLDbtzJfKUNe2J4vlL1UKwk31WWAzz9qW5Qs4JjTY66DnA/viewform?embedded=true&usp=pp_url&chrome=false"
                        width="100%"
                        height="100%"
                        frameBorder={0}
                        marginHeight={0}
                        marginWidth={0}
                        title="Submit Grievance Form"
                        className="rounded-lg"
                        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                        allow="camera; microphone; clipboard-write; encrypted-media"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {hasRecordsAccess && (
          <TabsContent value="records" className="space-y-4">
            <div className="grid gap-4">
              {/* Sick Food Bookings */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <CardTitle className="text-medium">Sick Food Bookings</CardTitle>
                    <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-2">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 flex-shrink-0" />
                        <Input
                          type="date"
                          value={sickFoodDateFilter}
                          onChange={(e) => setSickFoodDateFilter(e.target.value)}
                          className="w-full sm:w-36 h-8 min-w-0"
                          placeholder="Filter by date"
                        />
                        {sickFoodDateFilter && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSickFoodDateFilter('')}
                            className="h-8 px-2 flex-shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadReports('sick-food')}
                        className="flex items-center gap-1 h-8 px-2 justify-center"
                      >
                        <Download className="h-3 w-3" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-48 flex flex-col">
                    {(() => {
                      console.log(`🧪 [CLIENT-TRIAGE] RENDER CHECK - sickFoodBookings:`, sickFoodBookings);
                      console.log(`🧪 [CLIENT-TRIAGE] RENDER CHECK - Length:`, (sickFoodBookings as any[]).length);
                      console.log(`🧪 [CLIENT-TRIAGE] RENDER CHECK - Type:`, typeof sickFoodBookings);
                      console.log(`🧪 [CLIENT-TRIAGE] RENDER CHECK - IsArray:`, Array.isArray(sickFoodBookings));
                      return null;
                    })()}
                    
                    {(() => {
                      const hasData = Array.isArray(sickFoodBookings) && sickFoodBookings.length > 0;
                      const isLoadingOrError = sickFoodLoading || sickFoodError;
                      
                      if (!isLoadingOrError && hasData) {
                        return (
                          <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                            <div className="text-xs text-green-600 mb-2 p-1 bg-green-50 rounded">
                              🧪 NORMALIZED: Showing {sickFoodBookings.length} booking(s)
                            </div>
                            {sickFoodBookings.map((booking: any, index: number) => {
                              console.log(`🧪 [CLIENT-TRIAGE] RENDER ITEM ${index}:`, booking);
                              return (
                                <div key={booking.id} className="flex flex-col p-3 border rounded-lg space-y-2 flex-shrink-0">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <p className="text-small font-medium break-words">{booking.mealType} - {new Date(booking.date).toLocaleDateString()}</p>
                                      <p className="text-small text-muted-foreground break-words">Room: {booking.roomNumber}</p>
                                      <p className="text-xs text-blue-600 break-words">ID: {booking.id}</p>
                                      <p className="text-xs text-blue-600 break-words">User: {booking.userId?.substring(0, 20)}...</p>
                                      <p className="text-xs text-muted-foreground break-words">
                                        Phone: {booking.phoneNumber || '—'}
                                      </p>
                                      <p className="text-xs text-muted-foreground break-words">
                                        Mode: {booking.parcelMode === 'dine_in' ? 'Mess' : booking.parcelMode === 'takeaway' ? 'Takeaway' : 'Mess'}
                                      </p>
                                      {booking.specialRequirements && (
                                        <p className="text-small text-muted-foreground break-words">Special: {booking.specialRequirements}</p>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                      <Badge 
                                        variant={
                                          booking.status === 'approved' ? 'default' :
                                          booking.status === 'rejected' ? 'destructive' :
                                          'secondary'
                                        }
                                        className="w-fit"
                                      >
                                        {booking.status === 'approved' ? 'Approved' :
                                         booking.status === 'rejected' ? 'Rejected' :
                                         'Pending'}
                                      </Badge>
                                      {booking.status === 'pending' && (isAdmin || (user as any)?.permissions?.diningHostel) && (
                                        <div className="flex gap-1">
                                          <Button 
                                            size="sm"
                                            variant="outline"
                                            className="text-green-600 border-green-200 hover:bg-green-50 px-2 py-1 h-6 text-xs"
                                            onClick={() => handleApproveSickFood(booking.id)}
                                            disabled={approveSickFoodMutation.isPending || rejectSickFoodMutation.isPending}
                                          >
                                            {approveSickFoodMutation.isPending ? 'Approving...' : 'Approve'}
                                          </Button>
                                          <Button 
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 border-red-200 hover:bg-red-50 px-2 py-1 h-6 text-xs"
                                            onClick={() => handleRejectSickFood(booking.id)}
                                            disabled={approveSickFoodMutation.isPending || rejectSickFoodMutation.isPending}
                                          >
                                            {rejectSickFoodMutation.isPending ? 'Rejecting...' : 'Reject'}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        // Show diagnostics and empty state
                        return (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <p className="text-center text-muted-foreground text-small">
                                {sickFoodLoading ? 'Loading...' : sickFoodError ? 'Error loading bookings' : 'No bookings found'}
                              </p>
                              <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded max-w-xs">
                                🧪 NORMALIZED TRIAGE:<br/>
                                Type: {typeof sickFoodBookings}<br/>
                                IsArray: {Array.isArray(sickFoodBookings) ? 'YES' : 'NO'}<br/>
                                Length: {Array.isArray(sickFoodBookings) ? sickFoodBookings.length : 'N/A'}<br/>
                                Loading: {sickFoodLoading ? 'YES' : 'NO'}<br/>
                                Error: {sickFoodError ? 'YES' : 'NO'}<br/>
                                IsAdmin: {isAdmin ? 'YES' : 'NO'}<br/>
                                Filter: {sickFoodDateFilter || 'None'}<br/>
                                Raw: {JSON.stringify(sickFoodBookings).substring(0, 50)}...
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Leave Applications */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <CardTitle className="text-medium flex items-center gap-2">
                      Leave Applications
                      <Badge variant="secondary" className="text-xs">Future Use</Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHideLeaveApplications(!hideLeaveApplications)}
                        className="flex items-center gap-1 h-8 px-2"
                        title={hideLeaveApplications ? 'Show Leave Applications' : 'Hide Leave Applications'}
                      >
                        {hideLeaveApplications ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        <span className="hidden sm:inline">{hideLeaveApplications ? 'Show' : 'Hide'}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadReports('leave-applications')}
                        className="flex items-center gap-1 h-8 px-2 justify-center"
                      >
                        <Download className="h-3 w-3" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {!hideLeaveApplications && (
                  <CardContent className="pt-2">
                    <div className="h-48 flex flex-col">
                      {(leaveApplications as any[]).length > 0 ? (
                        <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                          {(leaveApplications as any[]).map((application: any) => (
                            <div key={application.id} className="p-3 border rounded-lg space-y-3 flex-shrink-0">
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <p className="text-small font-medium break-words">
                                      {new Date(application.startDate).toLocaleDateString()} - {new Date(application.endDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-small text-muted-foreground break-words">
                                      Email: {application.email || '—'}
                                    </p>
                                    <p className="text-small text-muted-foreground break-words">
                                      City: {application.leaveCity || '—'}
                                    </p>
                                    <p className="text-small text-muted-foreground break-words">Room: {application.roomNumber}</p>
                                    <p className="text-small text-muted-foreground break-words">Contact: {application.emergencyContact}</p>
                                    <p className="text-small text-muted-foreground break-words">Reason: {application.reason}</p>
                                    {application.correlationId && (
                                      <p className="text-xs text-blue-600 break-words">Correlation ID: {application.correlationId}</p>
                                    )}
                                    {application.googleStatus && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge 
                                          variant={application.googleStatus.ok ? 'default' : 'destructive'} 
                                          className="text-xs px-1 py-0 h-5"
                                        >
                                          Google: {application.googleStatus.ok ? '✓ Synced' : `✗ Failed (${application.googleStatus.attempts} attempts)`}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                  <Badge variant={application.status === 'pending' ? 'secondary' : application.status === 'approved' ? 'default' : 'destructive'} className="w-fit self-start">
                                    {application.status}
                                  </Badge>
                                </div>
                                {application.status === 'pending' && (
                                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => approveLeaveApplication.mutate(application.id)}
                                      disabled={approveLeaveApplication.isPending || denyLeaveApplication.isPending}
                                      className="h-8 px-3 bg-green-600 hover:bg-green-700 flex items-center justify-center"
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => denyLeaveApplication.mutate(application.id)}
                                      disabled={approveLeaveApplication.isPending || denyLeaveApplication.isPending}
                                      className="h-8 px-3 flex items-center justify-center"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Deny
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-center text-muted-foreground text-small">No applications found</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Grievance Management */}
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <CardTitle className="text-medium">Grievance Management</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadReports('grievances')}
                      className="flex items-center gap-1 h-8 px-2 justify-center"
                    >
                      <Download className="h-3 w-3" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-48 flex flex-col">
                    {(grievances as any[]).length > 0 ? (
                      <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                        {(grievances as any[]).map((grievance: any) => (
                          <div key={grievance.id} className="p-3 border rounded-lg space-y-3 flex-shrink-0">
                            <div className="space-y-2">
                              <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                                <div className="flex flex-col space-y-2 sm:flex-row sm:gap-2">
                                  <Badge variant="outline" className="w-fit">{grievance.category}</Badge>
                                  <Badge variant={grievance.status === 'pending' ? 'secondary' : 'default'} className="w-fit">
                                    {grievance.status}
                                  </Badge>
                                </div>
                                {grievance.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => resolveGrievanceMutation.mutate({ id: grievance.id })}
                                    disabled={resolveGrievanceMutation.isPending}
                                    className="h-8 px-3 w-full sm:w-auto"
                                  >
                                    Mark Resolved
                                  </Button>
                                )}
                              </div>
                              <p className="text-small break-words">{grievance.description}</p>
                              <p className="text-small text-muted-foreground break-words">Room: {grievance.roomNumber}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-center text-muted-foreground text-small">No grievances found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}


      </Tabs>

      {/* Edit Menu Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMenu?.mealType && editingMenu.mealType !== 'all' 
                ? `Edit ${editingMenu.mealType.charAt(0).toUpperCase() + editingMenu.mealType.slice(1)} - Today's Menu`
                : `Edit Menu - ${editingMenu?.mealType}`
              }
            </DialogTitle>
          </DialogHeader>
          <Form {...menuEditForm}>
            <form onSubmit={menuEditForm.handleSubmit(handleSaveMenuEdit)} className="space-y-4">
              <FormField
                control={menuEditForm.control}
                name="items"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu Items (one per line)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={editingMenu?.mealType && editingMenu.mealType !== 'all' 
                          ? "Enter menu items separated by commas (e.g. Rice, Dal, Sabzi, Roti)"
                          : "Rice&#10;Dal&#10;Sabzi&#10;Roti"
                        }
                        className="min-h-[150px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editMenuMutation.isPending}
                  className="flex-1"
                >
                  {editMenuMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Your Submissions Modal */}
      <YourSubmissionsModal
        isOpen={showSubmissionsModal}
        onClose={() => setShowSubmissionsModal(false)}
        onBookSickFood={() => {
          setShowSubmissionsModal(false);
          setShowSickFoodDialog(true);
        }}
        onSubmitGrievance={() => {
          setShowSubmissionsModal(false);
          setShowGrievanceDialog(true);
        }}
      />
    </div>
  );
}

// Helper component for individual meal sections - Row-based design for mobile
function MealSection({ title, items, isAdmin = false, onEdit }: { 
  title: string; 
  items: string | null;
  isAdmin?: boolean;
  onEdit?: () => void;
}) {
  const menuItems = items ? items.split(',').map(item => item.trim()).filter(item => item) : [];
  
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-medium font-medium capitalize">{title}:</h4>
        {isAdmin && onEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="h-6 px-2 text-xs"
            title={`Edit ${title.toLowerCase()}`}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>
      {menuItems.length > 0 ? (
        <div className="text-small text-muted-foreground leading-relaxed pl-2">
          {menuItems.join(' • ')}
        </div>
      ) : (
        <p className="text-small text-muted-foreground pl-2">No items available</p>
      )}
    </div>
  );
}

// Helper component for weekly menu cards - Row-based mobile-friendly design
function WeeklyMenuCard({ title, menu, date }: { title: string; menu: any; date: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {menu ? (
          <div className="space-y-0">
            <MealSection title="Breakfast" items={menu.breakfast} />
            <MealSection title="Lunch" items={menu.lunch} />
            <MealSection title="Evening Snacks" items={menu.eveningSnacks} />
            <MealSection title="Dinner" items={menu.dinner} />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No menu available for {new Date(date + 'T00:00:00').toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}