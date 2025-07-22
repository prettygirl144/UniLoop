import { useState, useRef } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
  FileSpreadsheet
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { z } from 'zod';
import * as XLSX from 'xlsx';

// Enhanced schemas with all required fields
const sickFoodSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  mealType: z.string().min(1, 'Meal type is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  specialRequirements: z.string().optional(),
});

const leaveApplicationSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
  emergencyContact: z.string().min(1, 'Emergency contact is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
});

const grievanceSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
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
type GrievanceForm = z.infer<typeof grievanceSchema>;
type MenuUploadForm = z.infer<typeof menuUploadSchema>;

export default function Amenities() {
  const [showSickFoodDialog, setShowSickFoodDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showGrievanceDialog, setShowGrievanceDialog] = useState(false);
  const [showMenuUploadDialog, setShowMenuUploadDialog] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editingMenu, setEditingMenu] = useState<{id: number, date: string, mealType: string, items: string[]} | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if user is admin
  const isAdmin = (user as any)?.role === 'admin';

  // Form instances
  const sickFoodForm = useForm<SickFoodForm>({
    resolver: zodResolver(sickFoodSchema),
    defaultValues: {
      date: '',
      mealType: '',
      roomNumber: '',
      specialRequirements: '',
    },
  });

  const leaveForm = useForm<LeaveApplicationForm>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      reason: '',
      emergencyContact: '',
      roomNumber: '',
    },
  });

  const grievanceForm = useForm<GrievanceForm>({
    resolver: zodResolver(grievanceSchema),
    defaultValues: {
      category: '',
      description: '',
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

  // Data queries
  const { data: todaysMenu = [], isLoading: menuLoading } = useQuery({
    queryKey: ['/api/dining/menu'],
  });

  const { data: sickFoodBookings = [] } = useQuery({
    queryKey: ['/api/dining/sick-food'],
    enabled: isAdmin,
  });

  const { data: leaveApplications = [] } = useQuery({
    queryKey: ['/api/hostel/leave'],
    enabled: isAdmin,
  });

  const { data: grievances = [] } = useQuery({
    queryKey: ['/api/grievances'],
    enabled: isAdmin,
  });

  // Mutations
  const sickFoodMutation = useMutation({
    mutationFn: async (data: SickFoodForm) => {
      await apiRequest('POST', '/api/dining/sick-food', data);
    },
    onSuccess: () => {
      setShowSickFoodDialog(false);
      sickFoodForm.reset();
      toast({
        title: 'Success',
        description: 'Sick food booking submitted successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dining/sick-food'] });
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
        description: 'Failed to submit booking. Please try again.',
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

  const grievanceMutation = useMutation({
    mutationFn: async (data: GrievanceForm) => {
      await apiRequest('POST', '/api/grievances', data);
    },
    onSuccess: () => {
      setShowGrievanceDialog(false);
      grievanceForm.reset();
      toast({
        title: 'Success',
        description: 'Grievance submitted successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/grievances'] });
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
        description: 'Failed to submit grievance. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const menuUploadMutation = useMutation({
    mutationFn: async (data: MenuUploadForm | { menuItems: any[] }) => {
      if ('menuItems' in data) {
        // Excel file upload
        await apiRequest('POST', '/api/dining/menu/upload', data);
      } else {
        // Manual text input - validate required fields only if no file uploaded
        if (!uploadedFile && (!data.date || !data.mealType || !data.items)) {
          throw new Error('All fields are required when not uploading an Excel file');
        }
        const items = (data.items || '').split('\n').filter(item => item.trim() !== '');
        await apiRequest('POST', '/api/dining/menu/upload', {
          menuItems: [{
            date: data.date,
            mealType: data.mealType,
            items,
          }]
        });
      }
    },
    onSuccess: () => {
      setShowMenuUploadDialog(false);
      menuUploadForm.reset();
      setUploadedFile(null);
      toast({
        title: 'Success',
        description: 'Menu uploaded successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dining/menu'] });
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

  // File upload handlers
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setUploadedFile(file);
      processExcelFile(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please select an Excel (.xlsx) file.',
        variant: 'destructive',
      });
    }
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Process Excel data and create menu items
        const menuItems: any[] = [];
        for (let i = 1; i < jsonData.length; i++) { // Skip header row
          const row = jsonData[i] as any[];
          if (row.length >= 3) {
            menuItems.push({
              date: row[0],
              mealType: row[1],
              items: row.slice(2).filter(item => item && item.toString().trim() !== '')
            });
          }
        }

        menuUploadMutation.mutate({ menuItems });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to process Excel file. Please check the format.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download reports
  const downloadReports = async (reportType: 'sick-food' | 'leave-applications' | 'grievances') => {
    try {
      let data: any[] = [];
      let filename = '';
      
      switch (reportType) {
        case 'sick-food':
          data = sickFoodBookings as any[];
          filename = 'sick-food-bookings.xlsx';
          break;
        case 'leave-applications':
          data = leaveApplications as any[];
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
    mutationFn: async ({ id, items }: { id: number; items: string[] }) => {
      await apiRequest('PUT', `/api/dining/menu/${id}`, { items });
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setEditingMenu(null);
      menuEditForm.reset();
      toast({
        title: 'Success',
        description: 'Menu updated successfully!',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dining/menu'] });
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
    const items = data.items.split('\n').filter(item => item.trim() !== '');
    editMenuMutation.mutate({ id: editingMenu.id, items });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Amenities</h1>
          <p className="text-muted-foreground">Campus dining, accommodation, and services</p>
        </div>
        {isAdmin && (
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
                      <div className="text-sm text-gray-600 mb-2">
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
                        <div className="text-xs text-green-600">
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
                  
                  <div className="text-center text-sm text-gray-500">OR</div>
                  
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

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="menu">Today's Menu</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          {isAdmin && <TabsTrigger value="bookings">Bookings</TabsTrigger>}
          {isAdmin && <TabsTrigger value="admin">Admin Panel</TabsTrigger>}
        </TabsList>

        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Today's Menu
              </CardTitle>
            </CardHeader>
            <CardContent>
              {menuLoading ? (
                <div className="text-center py-8">Loading menu...</div>
              ) : (todaysMenu as any[]).length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {(todaysMenu as any[]).map((menu: any) => (
                    <div key={`${menu.id}`} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold capitalize">{menu.mealType}</h3>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditMenu(menu)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <ul className="space-y-1">
                        {menu.items.map((item: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No menu available for today
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex flex-col gap-4">
            {/* Sick Food Booking */}
            <Card className="w-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-medium">
                  <UserX className="h-5 w-5 flex-shrink-0" />
                  <span>Sick Food Booking</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Request food delivery to your room when you're unwell
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
                <CardTitle className="flex items-center gap-3 text-base font-medium">
                  <Home className="h-5 w-5 flex-shrink-0" />
                  <span>Leave Application</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Apply for hostel leave with approval workflow
                </p>
                <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">Apply for Leave</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Hostel Leave Application</DialogTitle>
                    </DialogHeader>
                    <Form {...leaveForm}>
                      <form onSubmit={leaveForm.handleSubmit((data) => leaveMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={leaveForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={leaveForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={leaveForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reason for Leave</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Explain the reason for your leave..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={leaveForm.control}
                          name="emergencyContact"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Emergency Contact</FormLabel>
                              <FormControl>
                                <Input placeholder="Phone number for emergency contact" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={leaveForm.control}
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
                        <Button 
                          type="submit" 
                          disabled={leaveMutation.isPending}
                          className="w-full"
                        >
                          {leaveMutation.isPending ? 'Submitting...' : 'Submit Application'}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Submit Grievance */}
            <Card className="w-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-base font-medium">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <span>Submit Grievance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  Report issues with mess, hostel, IT, or other services
                </p>
                <Dialog open={showGrievanceDialog} onOpenChange={setShowGrievanceDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">Submit Grievance</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Submit Grievance</DialogTitle>
                    </DialogHeader>
                    <Form {...grievanceForm}>
                      <form onSubmit={grievanceForm.handleSubmit((data) => grievanceMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={grievanceForm.control}
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
                                  <SelectItem value="Mess">Mess</SelectItem>
                                  <SelectItem value="IT">IT Services</SelectItem>
                                  <SelectItem value="Hostel">Hostel Maintenance</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={grievanceForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Describe your grievance in detail..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={grievanceForm.control}
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
                        <Button 
                          type="submit" 
                          disabled={grievanceMutation.isPending}
                          className="w-full"
                        >
                          {grievanceMutation.isPending ? 'Submitting...' : 'Submit Grievance'}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="bookings" className="space-y-4">
            <div className="grid gap-4">
              {/* Sick Food Bookings */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Sick Food Bookings</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadReports('sick-food')}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  {(sickFoodBookings as any[]).length > 0 ? (
                    <div className="space-y-2">
                      {(sickFoodBookings as any[]).map((booking: any) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{booking.mealType} - {new Date(booking.date).toLocaleDateString()}</p>
                            <p className="text-sm text-muted-foreground">Room: {booking.roomNumber}</p>
                            {booking.specialRequirements && (
                              <p className="text-sm text-muted-foreground">Special: {booking.specialRequirements}</p>
                            )}
                          </div>
                          <Badge variant={booking.status === 'pending' ? 'secondary' : 'default'}>
                            {booking.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No bookings found</p>
                  )}
                </CardContent>
              </Card>

              {/* Leave Applications */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Leave Applications</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadReports('leave-applications')}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  {(leaveApplications as any[]).length > 0 ? (
                    <div className="space-y-2">
                      {(leaveApplications as any[]).map((application: any) => (
                        <div key={application.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">
                              {new Date(application.startDate).toLocaleDateString()} - {new Date(application.endDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">Room: {application.roomNumber}</p>
                            <p className="text-sm text-muted-foreground">Contact: {application.emergencyContact}</p>
                            <p className="text-sm text-muted-foreground">Reason: {application.reason}</p>
                          </div>
                          <Badge variant={application.status === 'pending' ? 'secondary' : 'default'}>
                            {application.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No applications found</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="admin" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Grievance Management</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadReports('grievances')}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </CardHeader>
              <CardContent>
                {(grievances as any[]).length > 0 ? (
                  <div className="space-y-3">
                    {(grievances as any[]).map((grievance: any) => (
                      <div key={grievance.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{grievance.category}</Badge>
                          <Badge variant={grievance.status === 'pending' ? 'secondary' : 'default'}>
                            {grievance.status}
                          </Badge>
                        </div>
                        <p className="text-sm">{grievance.description}</p>
                        <p className="text-xs text-muted-foreground">Room: {grievance.roomNumber}</p>
                        {grievance.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => resolveGrievanceMutation.mutate({ id: grievance.id })}
                            disabled={resolveGrievanceMutation.isPending}
                          >
                            Mark as Resolved
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No grievances found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Menu Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu - {editingMenu?.mealType}</DialogTitle>
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
                        placeholder="Rice&#10;Dal&#10;Sabzi&#10;Roti"
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
    </div>
  );
}