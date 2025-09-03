import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Clock, AlertTriangle, Info, Check, X, Edit, Trash2, List, Grid3X3, MapPin, Upload, FileSpreadsheet, UserCheck } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { z } from 'zod';
import type { Event } from '@shared/schema';

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  location: z.string().min(1, 'Location is required'),
  hostCommittee: z.string().min(1, 'Host committee is required'),
  category: z.string().min(1, 'Category is required'),
  rsvpEnabled: z.boolean().default(false),
  isMandatory: z.boolean().default(false),
  targetBatches: z.array(z.string()).default([]),
  batchSections: z.record(z.array(z.string())).default({}), // batch -> sections mapping
  targetBatchSections: z.array(z.string()).default([]), // Store batch::section pairs
  rollNumberAttendees: z.array(z.object({
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    rollNumber: z.string(),
    batch: z.string(),
    section: z.string(),
    source: z.enum(['batch-section', 'roll-number']),
  })).default([]), // Store individual attendees from roll number upload
}).refine((data) => {
  // Skip validation if either time is empty (let required field validation handle it)
  if (!data.startTime || !data.endTime) {
    return true;
  }
  
  // Validate end time is after start time
  try {
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    
    // Check for invalid time formats
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      return true; // Let the field validation handle invalid formats
    }
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  } catch (error) {
    // If there's any error in parsing, skip this validation
    return true;
  }
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type CreateEventForm = z.infer<typeof createEventSchema>;

// Calendar Grid Component
function CalendarGrid({ events, onEventClick }: { events: Event[], onEventClick: (event: Event) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(date.getDate() - day);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getCurrentDay = (date: Date) => {
    return [new Date(date)];
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewType === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (viewType === 'day') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const getDays = () => {
    switch (viewType) {
      case 'week':
        return getWeekDays(currentDate);
      case 'day':
        return getCurrentDay(currentDate);
      default:
        return getDaysInMonth(currentDate);
    }
  };

  const days = getDays();
  const getTitle = () => {
    switch (viewType) {
      case 'week':
        const weekStart = getWeekDays(currentDate)[0];
        const weekEnd = getWeekDays(currentDate)[6];
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-medium">{getTitle()}</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewType} onValueChange={(value: 'month' | 'week' | 'day') => setViewType(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewType === 'month' && (
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-1 border rounded-sm ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className={`text-xs ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="text-xs p-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200 truncate"
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewType === 'week' && (
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-1 border rounded-sm bg-white ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="text-xs font-medium text-gray-900 mb-1">
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="text-xs p-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200 truncate"
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewType === 'day' && (
          <div className="space-y-2">
            {days.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div key={index} className="space-y-2">
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  {dayEvents.length === 0 ? (
                    <div className="text-sm text-gray-500 py-4 text-center">No events scheduled</div>
                  ) : (
                    <div className="space-y-2">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className="p-3 border rounded-md cursor-pointer hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{event.title}</div>
                            <div className="text-xs text-gray-500">
                              {event.startTime} - {event.endTime}
                            </div>
                          </div>
                          {event.location && (
                            <div className="text-xs text-gray-600 mt-1">{event.location}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rollNumberAttendees, setRollNumberAttendees] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events data - moved before useEffect to fix variable declaration order
  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // No longer using student directory for eligibility - will check attendance sheets per event



  // Helper function to calculate event duration
  const calculateDuration = (startTime: string, endTime: string) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const durationMinutes = endMinutes - startMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Component to handle individual event eligibility checking
  const EventEligibilityBadge = ({ event }: { event: Event }) => {
    const { data: isEligible = null } = useQuery({
      queryKey: ['/api/event-eligibility', event.id, user?.email],
      queryFn: async () => {
        if (!user?.email) return false;
        
        // Check if user's email is in roll number attendees (manually added attendees)
        if (event.rollNumberAttendees?.includes(user?.email || '')) {
          return true;
        }
        
        // If no targeting specified, event is for everyone
        if (!event.targetBatches?.length && !event.targetSections?.length && !event.targetBatchSections?.length && !event.rollNumberAttendees?.length) {
          return true;
        }
        
        // For targeted events, check attendance records
        // Skip if neither batch-sections nor roll number attendees are specified
        if (!event.targetBatchSections?.length && !event.rollNumberAttendees?.length) {
          return false; // No targeting specified, user not eligible
        }
        
        try {
          const response = await fetch(`/api/events/${event.id}/attendance`);
          if (!response.ok) {
            return false; // Can't access attendance data
          }
          
          const attendanceData = await response.json();
          if (!attendanceData.sheets) {
            return false;
          }
          
          // Check if user's email exists in any attendance sheet for this event
          for (const sheetData of attendanceData.sheets) {
            if (sheetData.records) {
              const userExists = sheetData.records.some((record: any) => 
                record.studentEmail?.toLowerCase() === user.email?.toLowerCase()
              );
              if (userExists) {
                return true;
              }
            }
          }
          
          return false;
        } catch (error) {
          return false;
        }
      },
      enabled: !!user?.email,
      staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    // Show loading state or eligibility result
    if (isEligible === null) {
      return null; // Still loading, don't show anything yet
    }

    return (
      <>
        {!isEligible && (
          <Badge variant="secondary" className="text-xs">
            Not Applicable
          </Badge>
        )}
        {isEligible && (
          <div className="flex items-center gap-1 text-green-600">
            <Check className="w-3 h-3" />
            <span className="text-xs">Eligible</span>
          </div>
        )}
      </>
    );
  };

  // Fetch batches and sections for admin event creation
  const { data: batchesAndSections, isLoading: batchesLoading } = useQuery({
    queryKey: ['/api/admin/students'],
    enabled: user?.role === 'admin' && showCreateDialog,
  });

  const form = useForm<CreateEventForm>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      hostCommittee: '',
      category: '',
      rsvpEnabled: false,
      isMandatory: false,
      targetBatches: [],
      batchSections: {},
      targetBatchSections: [],
      rollNumberAttendees: [],
    },
  });

  // Handle file upload for roll numbers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large", 
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/events/parse-roll-numbers', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      const result = await response.json();
      
      if (result.attendees && result.attendees.length > 0) {
        const newAttendees = result.attendees.map((attendee: any) => ({
          ...attendee,
          source: 'roll-number' as const,
        }));
        
        setRollNumberAttendees(prev => [...prev, ...newAttendees]);
        
        toast({
          title: "File Uploaded Successfully",
          description: `Found ${result.attendees.length} matching students.`,
        });
      } else {
        toast({
          title: "No Matches Found",
          description: "No matching students found for the roll numbers in this file.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove attendee from roll number list
  const removeAttendee = (email: string) => {
    setRollNumberAttendees(prev => prev.filter(attendee => attendee.email !== email));
  };

  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      // Generate batch-section pairs from batch-specific selections
      const batchSectionPairs: string[] = [];
      Object.entries(data.batchSections).forEach(([batch, sections]) => {
        sections.forEach(section => {
          batchSectionPairs.push(`${batch}::${section}`);
        });
      });

      // Extract emails from roll number attendees for storage
      const rollNumberEmails = rollNumberAttendees.map(attendee => attendee.email);
      
      // Combine roll number attendees with batch/section selections
      const combinedData = {
        ...data,
        targetBatchSections: batchSectionPairs,
        rollNumberAttendees: rollNumberEmails, // Store only emails in database
      };

      return apiRequest('POST', '/api/events', {
        ...combinedData,
        date: new Date(data.date).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Event created successfully!',
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
        description: 'Failed to create event. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: CreateEventForm & { id: number }) => {
      // Generate batch-section pairs from batch-specific selections
      const batchSectionPairs: string[] = [];
      Object.entries(data.batchSections).forEach(([batch, sections]) => {
        sections.forEach(section => {
          batchSectionPairs.push(`${batch}::${section}`);
        });
      });

      await apiRequest('PUT', `/api/events/${data.id}`, {
        ...data,
        date: new Date(data.date).toISOString(),
        targetBatches: data.targetBatches,
        targetSections: [], // Legacy field, keep empty
        targetBatchSections: batchSectionPairs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowEditDialog(false);
      setShowEventDetails(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Event updated successfully!',
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
        description: 'Failed to update event. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Fetch batches for form
  const { data: availableBatches = [] } = useQuery({
    queryKey: ['/api/batches'],
    enabled: user?.role === 'admin' || user?.permissions?.calendar,
  });

  // Filter sections based on selected batches with custom ordering
  const selectedBatches = form.watch('targetBatches') || [];
  const sectionOrder = ['A', 'B', 'C', 'D', 'E', 'BA', 'HRM'];

  // Fetch sections for selected batches
  const { data: batchSectionsData = [] } = useQuery({
    queryKey: ['/api/batch-sections', selectedBatches],
    enabled: selectedBatches.length > 0 && (user?.role === 'admin' || user?.permissions?.calendar),
  });

  // Process sections by batch to maintain independence
  const sectionsByBatch: Record<string, string[]> = {};
  if (Array.isArray(batchSectionsData)) {
    batchSectionsData.forEach((item: any) => {
      if (!sectionsByBatch[item.batch]) {
        sectionsByBatch[item.batch] = [];
      }
      // Extract just the section name from batch::section format for display
      const displaySection = item.section.includes('::') ? item.section.split('::')[1] : item.section;
      if (!sectionsByBatch[item.batch].includes(displaySection)) {
        sectionsByBatch[item.batch].push(displaySection);
      }
    });
    
    // Sort sections for each batch using custom order
    Object.keys(sectionsByBatch).forEach(batch => {
      sectionsByBatch[batch].sort((a: string, b: string) => {
        const indexA = sectionOrder.indexOf(a);
        const indexB = sectionOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    });
  }

  // Store batch-section mapping for form validation and submission
  const batchSectionMap = Array.isArray(batchSectionsData) 
    ? batchSectionsData.reduce((acc: Record<string, string[]>, item: any) => {
        if (!acc[item.batch]) acc[item.batch] = [];
        acc[item.batch].push(item.section);
        return acc;
      }, {})
    : {};

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest('DELETE', `/api/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Success",
        description: "Event deleted successfully!",
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
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteEvent = (event: Event) => {
    const canDelete = user?.role === 'admin' || event.authorId === user?.id;
    if (!canDelete) {
      toast({
        title: 'Permission Denied',
        description: 'You can only delete events you created.',
        variant: 'destructive',
      });
      return;
    }

    if (confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone.`)) {
      deleteEventMutation.mutate(event.id);
    }
  };

  const onSubmit = (data: CreateEventForm) => {
    if (showEditDialog && selectedEvent) {
      updateEventMutation.mutate({ ...data, id: selectedEvent.id });
    } else {
      createEventMutation.mutate(data);
    }
  };

  const handleEditEvent = (event: Event) => {
    // Check if user can edit this event
    const canEdit = user?.role === 'admin' || event.authorId === user?.id;
    if (!canEdit) {
      toast({
        title: 'Permission Denied',
        description: 'You can only edit events you created.',
        variant: 'destructive',
      });
      return;
    }

    // Populate form with existing event data
    // Convert targetBatchSections back to batch-specific sections for editing
    const batchSections: Record<string, string[]> = {};
    if (event.targetBatchSections?.length) {
      event.targetBatchSections.forEach(batchSection => {
        const [batch, section] = batchSection.split('::');
        if (batch && section) {
          if (!batchSections[batch]) batchSections[batch] = [];
          batchSections[batch].push(section);
        }
      });
    }
    
    form.reset({
      title: event.title,
      description: event.description || '',
      date: new Date(event.date).toISOString().split('T')[0],
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      hostCommittee: event.hostCommittee,
      category: event.category,
      rsvpEnabled: event.rsvpEnabled || false,
      isMandatory: event.isMandatory || false,
      targetBatches: event.targetBatches || [],
      batchSections,
    });

    setSelectedEvent(event);
    setShowEventDetails(false);
    setShowEditDialog(true);
  };

  const canCreateEvents = user?.permissions?.calendar || user?.role === 'admin';

  const todaysEvents = events?.filter(event => {
    const eventDate = new Date(event.date);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full
                    /* Mobile: full width with padding */
                    p-4 space-y-4
                    /* Desktop: more generous spacing */
                    lg:p-6 lg:space-y-6">
      
      {/* Mobile-optimized header */}
      <div className="flex items-center justify-between">
        <h2 className="text-large font-medium">Events Calendar</h2>
        <div className="flex items-center gap-2 lg:gap-3">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'calendar')}>
            <TabsList className="/* Mobile: larger height for easier tapping */
                               h-10 lg:h-8
                               /* Mobile: rounded corners */
                               rounded-xl">
              <TabsTrigger value="list" className="/* Mobile: larger tap targets */
                                                  px-3 py-2 lg:px-2 lg:py-1
                                                  /* Touch feedback */
                                                  active:scale-95 transition-all duration-150">
                <List size={16} className="flex-shrink-0" />
              </TabsTrigger>
              <TabsTrigger value="calendar" className="px-3 py-2 lg:px-2 lg:py-1
                                                       active:scale-95 transition-all duration-150">
                <Grid3X3 size={16} className="flex-shrink-0" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canCreateEvents && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white text-small font-medium
                                  /* Mobile: larger tap target */
                                  px-3 py-2 h-10 lg:h-8
                                  /* Touch feedback */
                                  active:scale-95 transition-all duration-150
                                  /* Mobile: rounded corners */
                                  rounded-xl lg:rounded-lg">
                  <Plus size={14} className="mr-1 flex-shrink-0" />
                  <span className="hidden sm:inline">Add Event</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Basic Event Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Title *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter event title" />
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
                          <FormLabel>Category *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="academic">Academic</SelectItem>
                              <SelectItem value="cultural">Cultural</SelectItem>
                              <SelectItem value="sports">Sports</SelectItem>
                              <SelectItem value="technical">Technical</SelectItem>
                              <SelectItem value="committee">Committee</SelectItem>
                              <SelectItem value="triathlon">Triathlon</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Event description" rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date and Time */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time *</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time *</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                          {form.watch('startTime') && form.watch('endTime') && (
                            <p className="text-xs text-muted-foreground">
                              Duration: {calculateDuration(form.watch('startTime'), form.watch('endTime'))}
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Event location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hostCommittee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Host Committee *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Organizing committee" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Event Settings */}
                  <div className="space-y-4">
                    <h4 className="text-medium font-medium">Event Settings</h4>
                    
                    <div className="flex items-center space-x-4">
                      <FormField
                        control={form.control}
                        name="isMandatory"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="text-sm">
                              Mandatory Event
                              {field.value && <AlertTriangle className="inline w-4 h-4 ml-1 text-red-500" />}
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="rsvpEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="text-sm">Enable RSVP</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Batch and Section Selection */}
                  {user?.role === 'admin' && (
                    <div className="space-y-4">
                      <h4 className="text-medium font-medium">Target Attendees</h4>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to make event visible to all users
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="targetBatches"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Batches</FormLabel>
                              <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                                {Array.isArray(availableBatches) && availableBatches.map((batch: string) => (
                                  <div key={batch} className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={field.value?.includes(batch)}
                                      onCheckedChange={(checked) => {
                                        const updatedBatches = checked
                                          ? [...(field.value || []), batch]
                                          : field.value?.filter(b => b !== batch) || [];
                                        field.onChange(updatedBatches);
                                      }}
                                    />
                                    <label className="text-sm">{batch}</label>
                                  </div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="batchSections"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Sections by Batch</FormLabel>
                              {selectedBatches.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Select batches first to see available sections
                                </p>
                              )}
                              {selectedBatches.length > 0 && (
                                <div className="space-y-4 max-h-64 overflow-y-auto border rounded p-3">
                                  {selectedBatches.map((batch: string) => (
                                    <div key={batch} className="space-y-2">
                                      <div className="flex items-center justify-between border-b pb-1">
                                        <div className="font-medium text-sm text-primary">
                                          {batch}
                                        </div>
                                        {sectionsByBatch[batch]?.length > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              checked={field.value?.[batch]?.length === sectionsByBatch[batch]?.length}
                                              onCheckedChange={(checked) => {
                                                const currentBatchSections = field.value || {};
                                                field.onChange({
                                                  ...currentBatchSections,
                                                  [batch]: checked ? sectionsByBatch[batch] : []
                                                });
                                              }}
                                            />
                                            <label className="text-xs font-medium">Select All</label>
                                          </div>
                                        )}
                                      </div>
                                      {sectionsByBatch[batch]?.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                          {sectionsByBatch[batch].map((section: string) => (
                                            <div key={`${batch}-${section}`} className="flex items-center space-x-2">
                                              <Checkbox
                                                checked={field.value?.[batch]?.includes(section) || false}
                                                onCheckedChange={(checked) => {
                                                  const currentBatchSections = field.value || {};
                                                  const currentSections = currentBatchSections[batch] || [];
                                                  
                                                  let updatedSections;
                                                  if (checked) {
                                                    updatedSections = [...currentSections, section];
                                                  } else {
                                                    updatedSections = currentSections.filter(s => s !== section);
                                                  }
                                                  
                                                  field.onChange({
                                                    ...currentBatchSections,
                                                    [batch]: updatedSections
                                                  });
                                                }}
                                              />
                                              <label className="text-sm">{section}</label>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground pl-2">
                                          No sections found for this batch
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Roll Number Upload Section */}
                  {user?.role === 'admin' && (
                    <div className="space-y-4">
                      <div className="border-t pt-4">
                        <h4 className="text-medium font-medium flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4" />
                          Roll Number Upload
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Upload an Excel/CSV file with student roll numbers to add specific attendees
                        </p>
                      </div>

                      {/* File Upload */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                            className="hidden"
                            id="roll-number-file"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingFile}
                            className="cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploadingFile ? 'Processing...' : 'Choose File'}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Excel (.xlsx, .xls) or CSV files only, max 5MB
                          </span>
                        </div>

                        {/* Uploaded Attendees List */}
                        {rollNumberAttendees.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-medium flex items-center gap-2">
                                <UserCheck className="w-4 h-4" />
                                Selected Attendees from Roll Numbers ({rollNumberAttendees.length})
                              </h5>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRollNumberAttendees([])}
                              >
                                Clear All
                              </Button>
                            </div>

                            <div className="max-h-48 overflow-y-auto border rounded p-3 space-y-2">
                              {rollNumberAttendees.map((attendee, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <div className="flex-1 grid grid-cols-4 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium">{attendee.firstName} {attendee.lastName}</span>
                                    </div>
                                    <div className="text-muted-foreground">
                                      {attendee.rollNumber}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {attendee.batch}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {attendee.section?.includes('::') ? attendee.section.split('::')[1] : attendee.section}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeAttendee(attendee.email)}
                                    className="ml-2 h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>

                            {/* Summary */}
                            <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded">
                              <strong>Summary:</strong> This event will include {rollNumberAttendees.length} specific student(s) 
                              {selectedBatches.length > 0 && (
                                <span> plus all students from the selected batch/section combinations</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowCreateDialog(false);
                        form.reset();
                        setRollNumberAttendees([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createEventMutation.isPending}>
                      {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Event Dialog */}
        {showEditDialog && selectedEvent && (
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-large">Edit Event</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter event title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter event description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
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
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter event location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="hostCommittee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Host Committee</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter hosting committee" {...field} />
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="academic">Academic</SelectItem>
                              <SelectItem value="cultural">Cultural</SelectItem>
                              <SelectItem value="sports">Sports</SelectItem>
                              <SelectItem value="social">Social</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <FormField
                      control={form.control}
                      name="rsvpEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Enable RSVP</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isMandatory"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Mandatory Event</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Target Batch/Section Selection */}
                  {(user?.role === 'admin' || user?.permissions?.calendar) && (
                    <div className="space-y-4">
                      <h3 className="text-medium font-medium">Target Audience (Optional)</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="targetBatches"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Batches</FormLabel>
                              <div className="space-y-2 max-h-24 overflow-y-auto border rounded p-2">
                                {Array.isArray(availableBatches) && availableBatches.map((batch: string) => (
                                  <div key={batch} className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={field.value?.includes(batch)}
                                      onCheckedChange={(checked) => {
                                        const updatedBatches = checked
                                          ? [...(field.value || []), batch]
                                          : field.value?.filter(b => b !== batch) || [];
                                        field.onChange(updatedBatches);
                                      }}
                                    />
                                    <label className="text-sm">{batch}</label>
                                  </div>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="batchSections"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Sections by Batch</FormLabel>
                              {selectedBatches.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Select batches first to see available sections
                                </p>
                              )}
                              {selectedBatches.length > 0 && (
                                <div className="space-y-4 max-h-64 overflow-y-auto border rounded p-3">
                                  {selectedBatches.map((batch: string) => (
                                    <div key={batch} className="space-y-2">
                                      <div className="flex items-center justify-between border-b pb-1">
                                        <div className="font-medium text-sm text-primary">
                                          {batch}
                                        </div>
                                        {sectionsByBatch[batch]?.length > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <Checkbox
                                              checked={field.value?.[batch]?.length === sectionsByBatch[batch]?.length}
                                              onCheckedChange={(checked) => {
                                                const currentBatchSections = field.value || {};
                                                field.onChange({
                                                  ...currentBatchSections,
                                                  [batch]: checked ? sectionsByBatch[batch] : []
                                                });
                                              }}
                                            />
                                            <label className="text-xs font-medium">Select All</label>
                                          </div>
                                        )}
                                      </div>
                                      {sectionsByBatch[batch]?.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                          {sectionsByBatch[batch].map((section: string) => (
                                            <div key={`${batch}-${section}`} className="flex items-center space-x-2">
                                              <Checkbox
                                                checked={field.value?.[batch]?.includes(section) || false}
                                                onCheckedChange={(checked) => {
                                                  const currentBatchSections = field.value || {};
                                                  const currentSections = currentBatchSections[batch] || [];
                                                  
                                                  let updatedSections;
                                                  if (checked) {
                                                    updatedSections = [...currentSections, section];
                                                  } else {
                                                    updatedSections = currentSections.filter(s => s !== section);
                                                  }
                                                  
                                                  field.onChange({
                                                    ...currentBatchSections,
                                                    [batch]: updatedSections
                                                  });
                                                }}
                                              />
                                              <label className="text-sm">{section}</label>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground pl-2">
                                          No sections found for this batch
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowEditDialog(false);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateEventMutation.isPending}>
                      {updateEventMutation.isPending ? 'Updating...' : 'Update Event'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Temporary Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">Notice:</span> Event editing is temporarily unavailable. To make changes to an event, please delete and recreate it. Enhanced edit functionality coming soon!
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - List or Calendar View */}
      {viewMode === 'list' ? (
        <>
          {/* Today's Events */}
          {todaysEvents && todaysEvents.length > 0 && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-medium flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Today's Events
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
            {todaysEvents.map((event) => {
              const isEligible = isUserEligibleForEvent(event);
              return (
                <div
                  key={event.id}
                  className="rounded-lg border hover:bg-gray-50 cursor-pointer p-4 min-h-[160px]"
                  onClick={() => {
                    setSelectedEvent(event);
                    setShowEventDetails(true);
                  }}
                >
                  <div className="space-y-3">
                    {/* Header with title, badges, and action buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-small font-medium truncate">{event.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {event.isMandatory && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Mandatory
                            </Badge>
                          )}
                          {!isEligible && (
                            <Badge variant="secondary" className="text-xs">
                              Not Applicable
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Action buttons - Admin only */}
                      {user?.role === 'admin' && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(event);
                            }}
                            className="p-1 h-6 w-6"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(event);
                            }}
                            className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Event details */}
                    <div className="text-xs text-muted-foreground space-y-2">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {event.startTime} - {event.endTime}
                        </span>
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="truncate">Host: {event.hostCommittee}</span>
                      </div>
                    </div>

                    {/* Eligible status */}
                    {isEligible && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Check className="w-3 h-3" />
                        <span className="text-xs">Eligible</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-medium">All Events</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[400px] overflow-y-auto">
          {events && events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => {
                const eventDate = new Date(event.date);
                
                return (
                  <div
                    key={event.id}
                    className="rounded-lg border hover:bg-gray-50 cursor-pointer p-4 min-h-[160px]"
                    onClick={() => {
                      console.log('EVENT CLICKED:', event.title, event.id);
                      setSelectedEvent(event);
                      setShowEventDetails(true);
                      console.log('AFTER SETTING STATE - selectedEvent should be:', event.title);
                    }}
                  >
                    <div className="space-y-3">
                      {/* Header with title, badges, and action buttons */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-small font-medium truncate">{event.title}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {event.isMandatory && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Mandatory
                              </Badge>
                            )}
                            <EventEligibilityBadge event={event} />
                            <Badge variant="outline" className="text-xs">
                              {event.category}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Action buttons - Admin only */}
                        {user?.role === 'admin' && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEvent(event);
                              }}
                              className="p-1 h-6 w-6"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(event);
                              }}
                              className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Event details */}
                      <div className="text-xs text-muted-foreground space-y-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 shrink-0" />
                            {eventDate.toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            {event.startTime} - {event.endTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="truncate">{event.location}</span>
                          <span className="truncate">Host: {event.hostCommittee}</span>
                        </div>
                      </div>

                      {/* Eligible status - handled by EventEligibilityBadge above */}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-small">No events scheduled</p>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      ) : (
        /* Calendar View */
        <CalendarGrid events={events || []} onEventClick={(event) => {
          console.log('CALENDAR GRID EVENT CLICKED:', event.title, event.id);
          setSelectedEvent(event);
          setShowEventDetails(true);
          console.log('CALENDAR GRID - AFTER SETTING STATE');
        }} />
      )}

      {/* Event Details Modal */}
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="max-w-md">
          <div id="event-details-description" className="sr-only">Event details and options</div>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedEvent.isMandatory && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Mandatory Event
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {selectedEvent.category}
                </Badge>
              </div>

              {selectedEvent.description && (
                <p className="text-small text-muted-foreground">
                  {selectedEvent.description}
                </p>
              )}

              <div className="space-y-2 text-small">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{new Date(selectedEvent.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {selectedEvent.startTime} - {selectedEvent.endTime}
                    {selectedEvent.startTime && selectedEvent.endTime && (
                      <span className="text-muted-foreground ml-2">
                        ({calculateDuration(selectedEvent.startTime, selectedEvent.endTime)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{selectedEvent.location}</span>
                </div>
                <div className="text-muted-foreground">
                  Host: {selectedEvent.hostCommittee}
                </div>
              </div>

              {/* Attendee Status */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 text-gray-600">
                  <Info className="w-4 h-4" />
                  <span className="text-small">Registration status will be checked based on attendance records</span>
                </div>
              </div>

              {/* Attendance Management Button - Admin Only */}
              {(() => {
                const hasAdminAccess = user?.role === 'admin' || user?.permissions?.attendance;
                const hasTargetSections = (selectedEvent.targetBatchSections && selectedEvent.targetBatchSections.length > 0) || 
                                           (selectedEvent.rollNumberAttendees && selectedEvent.rollNumberAttendees.length > 0);
                
                // Show button for admin users if event has target sections or is mandatory
                const shouldShowButton = hasAdminAccess && (hasTargetSections || selectedEvent.isMandatory);
                
                return shouldShowButton ? (
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setShowEventDetails(false);
                        window.location.href = `/attendance/${selectedEvent.id}`;
                      }}
                      data-testid="button-view-attendance"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      View Attendance Sheet
                    </Button>
                  </div>
                ) : null;
              })()}

              {/* Target Audience Info */}
              {selectedEvent.targetBatchSections && selectedEvent.targetBatchSections.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-2">
                  <div>
                    <strong>Target Audience:</strong>
                  </div>
                  <div className="space-y-1 ml-2">
                    {(() => {
                      // Group batch-section pairs by batch
                      const batchGroups: Record<string, string[]> = {};
                      selectedEvent.targetBatchSections.forEach(batchSection => {
                        const [batch, section] = batchSection.split('::');
                        if (batch && section) {
                          if (!batchGroups[batch]) batchGroups[batch] = [];
                          batchGroups[batch].push(section);
                        }
                      });

                      return Object.entries(batchGroups).map(([batch, sections]) => (
                        <div key={batch} className="text-xs">
                          <span className="font-medium">{batch}:</span> {sections.join(', ')}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}