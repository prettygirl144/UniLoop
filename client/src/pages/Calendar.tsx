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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from 'lucide-react';
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
  location: z.string().min(1, 'Location is required'),
  hostCommittee: z.string().min(1, 'Host committee is required'),
  category: z.string().min(1, 'Category is required'),
  rsvpEnabled: z.boolean().default(false),
});

type CreateEventForm = z.infer<typeof createEventSchema>;

export default function Calendar() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      await apiRequest('POST', '/api/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowCreateDialog(false);
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

  const form = useForm<CreateEventForm>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      location: '',
      hostCommittee: '',
      category: '',
      rsvpEnabled: false,
    },
  });

  const onSubmit = (data: CreateEventForm) => {
    createEventMutation.mutate(data);
  };

  const rsvpMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: number; status: string }) => {
      await apiRequest('POST', `/api/events/${eventId}/rsvp`, { status });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'RSVP updated successfully!',
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
        description: 'Failed to RSVP. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleRsvp = (eventId: number) => {
    rsvpMutation.mutate({ eventId, status: 'attending' });
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
        <h2 className="text-lg font-semibold">Events Calendar</h2>
        {canCreateEvents && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white text-sm font-medium">
                <Plus size={16} className="mr-1" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date & Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Host Committee</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
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
      </div>

      {/* Calendar Header */}
      <Card className="shadow-sm border-gray-100">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                className="w-8 h-8 p-0"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 font-medium text-text-secondary">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => {
              const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i - 6);
              const isCurrentMonth = date.getMonth() === currentDate.getMonth();
              const isToday = date.toDateString() === new Date().toDateString();
              const hasEvent = events?.some(event => 
                new Date(event.date).toDateString() === date.toDateString()
              );
              
              return (
                <div
                  key={i}
                  className={`h-8 flex items-center justify-center text-sm relative ${
                    !isCurrentMonth ? 'text-text-secondary' : ''
                  } ${isToday ? 'bg-primary text-white rounded-lg font-medium' : ''}`}
                >
                  {date.getDate()}
                  {hasEvent && (
                    <div className="absolute bottom-0 w-1 h-1 bg-accent rounded-full"></div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Events */}
      <div className="space-y-3">
        <h3 className="font-semibold">Today's Events</h3>
        
        {todaysEvents?.length === 0 ? (
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-4 text-center text-text-secondary">
              <CalendarIcon size={48} className="mx-auto mb-2 opacity-30" />
              <p>No events scheduled for today</p>
            </CardContent>
          </Card>
        ) : (
          todaysEvents?.map((event) => (
            <Card key={event.id} className="shadow-sm border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-xl flex items-center justify-center">
                    <i className="fas fa-presentation text-primary"></i>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{event.title}</h4>
                    <p className="text-xs text-text-secondary mb-2">
                      {event.location} • {new Date(event.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <div className="flex items-center space-x-4">
                      <Badge 
                        variant="secondary"
                        className={`text-xs px-2 py-1 capitalize ${
                          event.category === 'cultural'
                            ? 'bg-accent bg-opacity-10 text-accent'
                            : 'bg-secondary bg-opacity-10 text-secondary'
                        }`}
                      >
                        {event.category}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        <Users size={12} className="text-text-secondary" />
                        <span className="text-xs text-text-secondary">32 registered</span>
                      </div>
                    </div>
                    {event.rsvpEnabled && (
                      <div className="flex items-center space-x-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => handleRsvp(event.id)}
                          disabled={rsvpMutation.isPending}
                          className="bg-primary text-white text-xs font-medium"
                        >
                          RSVP
                        </Button>
                        <Button variant="ghost" size="sm" className="text-primary text-xs font-medium">
                          Details
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
