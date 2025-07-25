import { useState } from 'react';
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
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Clock, AlertTriangle, Info, Check, X, Edit, Trash2 } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
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
  targetSections: z.array(z.string()).default([]),
}).refine((data) => {
  // Validate end time is after start time
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type CreateEventForm = z.infer<typeof createEventSchema>;

export default function Calendar() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Helper function to check if user is eligible for event based on batch/section
  const isUserEligibleForEvent = (event: Event) => {
    if (!event.targetBatches?.length && !event.targetSections?.length) {
      return true; // Event is for everyone
    }
    
    const userBatch = user?.batch;
    const userSection = user?.section;
    
    // Check if user's batch is in target batches
    const batchMatch = !event.targetBatches?.length || event.targetBatches?.includes(userBatch || '');
    
    // Check if user's section is in target sections
    const sectionMatch = !event.targetSections?.length || event.targetSections?.includes(userSection || '');
    
    return batchMatch && sectionMatch;
  };

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

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
      targetSections: [],
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      await apiRequest('POST', '/api/events', {
        ...data,
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
      await apiRequest('PUT', `/api/events/${data.id}`, {
        ...data,
        date: new Date(data.date).toISOString(),
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
    queryFn: () => {
      if (selectedBatches.length === 0) return [];
      return apiRequest(`/api/batch-sections?batches=${selectedBatches.join(',')}`);
    },
  });

  const availableSections = Array.from(new Set(
    batchSectionsData.map((item: any) => item.section).filter(Boolean)
  )).sort((a, b) => {
    const indexA = sectionOrder.indexOf(a);
    const indexB = sectionOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
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
      targetSections: event.targetSections || [],
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-large">Events Calendar</h2>
        {canCreateEvents && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white text-small">
                <Plus size={16} className="mr-1" />
                Add Event
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
                                {availableBatches.map((batch) => (
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
                          name="targetSections"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Sections</FormLabel>
                              {selectedBatches.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Select batches first to see available sections
                                </p>
                              )}
                              {selectedBatches.length > 0 && (
                                <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                                {availableSections.length > 0 && (
                                  <div className="flex items-center space-x-2 pb-2 border-b">
                                    <Checkbox
                                      checked={field.value?.length === availableSections.length}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.onChange(availableSections);
                                        } else {
                                          field.onChange([]);
                                        }
                                      }}
                                    />
                                    <label className="text-sm font-medium">Select All</label>
                                  </div>
                                )}
                                {availableSections.map((section) => (
                                  <div key={section} className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={field.value?.includes(section)}
                                      onCheckedChange={(checked) => {
                                        const updatedSections = checked
                                          ? [...(field.value || []), section]
                                          : field.value?.filter(s => s !== section) || [];
                                        field.onChange(updatedSections);
                                      }}
                                    />
                                    <label className="text-sm">{section}</label>
                                  </div>
                                ))}
                                {availableSections.length === 0 && selectedBatches.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    No sections found for selected batches
                                  </p>
                                )}
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
                        setShowCreateDialog(false);
                        form.reset();
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
                                {availableBatches.map((batch) => (
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
                          name="targetSections"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Target Sections</FormLabel>
                              {selectedBatches.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Select batches first to see available sections
                                </p>
                              )}
                              {selectedBatches.length > 0 && (
                                <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-2">
                                  {availableSections.length > 0 && (
                                    <div className="flex items-center space-x-2 pb-2 border-b">
                                      <Checkbox
                                        checked={field.value?.length === availableSections.length}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange(availableSections);
                                          } else {
                                            field.onChange([]);
                                          }
                                        }}
                                      />
                                      <label className="text-sm font-medium">Select All</label>
                                    </div>
                                  )}
                                  {availableSections.map((section) => (
                                    <div key={section} className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={field.value?.includes(section)}
                                        onCheckedChange={(checked) => {
                                          const updatedSections = checked
                                            ? [...(field.value || []), section]
                                            : field.value?.filter(s => s !== section) || [];
                                          field.onChange(updatedSections);
                                        }}
                                      />
                                      <label className="text-sm">{section}</label>
                                    </div>
                                  ))}
                                  {availableSections.length === 0 && selectedBatches.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      No sections found for selected batches
                                    </p>
                                  )}
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

      {/* Today's Events */}
      {todaysEvents && todaysEvents.length > 0 && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-medium flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Today's Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todaysEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setSelectedEvent(event);
                  setShowEventDetails(true);
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-small font-medium">{event.title}</h4>
                    {event.isMandatory && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Mandatory
                      </Badge>
                    )}
                    {!isUserEligibleForEvent(event) && (
                      <Badge variant="secondary" className="text-xs">
                        Not Applicable
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.startTime} - {event.endTime}
                    </span>
                    <span>{event.location}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {event.category}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-medium">All Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => {
                const eventDate = new Date(event.date);
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
                        
                        {/* Action buttons */}
                        {(user?.role === 'admin' || event.authorId === user?.id) && (
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-small">No events scheduled</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Modal */}
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="max-w-md" aria-describedby="event-details-description">
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
                {isUserEligibleForEvent(selectedEvent) ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    <span className="text-small">You are registered for this event</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="w-4 h-4" />
                    <span className="text-small">You are not registered for this event</span>
                  </div>
                )}
              </div>

              {/* Target Audience Info */}
              {(selectedEvent.targetBatches?.length || selectedEvent.targetSections?.length) && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {selectedEvent.targetBatches && selectedEvent.targetBatches.length > 0 && (
                    <div>
                      <strong>Target Batches:</strong> {selectedEvent.targetBatches.join(', ')}
                    </div>
                  )}
                  {selectedEvent.targetSections && selectedEvent.targetSections.length > 0 && (
                    <div>
                      <strong>Target Sections:</strong> {selectedEvent.targetSections.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}