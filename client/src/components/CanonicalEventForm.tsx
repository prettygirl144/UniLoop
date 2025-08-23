import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Clock, MapPin, Users, X, Plus } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Event } from '@shared/schema';

// Canonical Event Schema - matches new backend data model
const canonicalEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startsAt: z.string().min(1, 'Start date and time is required'),
  endsAt: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  hostCommittee: z.string().min(1, 'Host committee is required'),
  category: z.string().min(1, 'Category is required'),
  rsvpRequired: z.boolean().default(false),
  mandatory: z.boolean().default(false),
  targets: z.object({
    batches: z.array(z.string()).min(1, 'At least one batch must be selected'),
    sections: z.array(z.string()).default([]),
    programs: z.array(z.string()).default([])
  })
}).refine((data) => {
  // Validate end time is after start time if both are provided
  if (!data.startsAt || !data.endsAt) {
    return true;
  }
  
  try {
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    return endsAt > startsAt;
  } catch (error) {
    return true;
  }
}, {
  message: "End date and time must be after start date and time",
  path: ["endsAt"],
});

type CanonicalEventFormData = z.infer<typeof canonicalEventSchema>;

interface CanonicalEventFormProps {
  event?: Event;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CanonicalEventForm({ event, onSuccess, onCancel }: CanonicalEventFormProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check permissions
  const canManageEvents = user?.permissions?.['events.manage'] || user?.role === 'admin' || user?.role === 'events_manager';

  // Fetch available batches and sections
  const { data: batches = [] } = useQuery<string[]>({
    queryKey: ['/api/batches'],
    enabled: canManageEvents,
  });

  const { data: sections = [] } = useQuery<string[]>({
    queryKey: ['/api/sections'],
    enabled: canManageEvents,
  });


  // Initialize form with canonical schema
  const form = useForm<CanonicalEventFormData>({
    resolver: zodResolver(canonicalEventSchema),
    defaultValues: {
      title: event?.title || '',
      description: event?.description || '',
      startsAt: event?.startsAt ? new Date(event.startsAt).toISOString().slice(0, 16) : '',
      endsAt: event?.endsAt ? new Date(event.endsAt).toISOString().slice(0, 16) : '',
      location: event?.location || '',
      hostCommittee: event?.hostCommittee || '',
      category: event?.category || 'Academic',
      rsvpRequired: event?.rsvpEnabled || false,
      mandatory: event?.meta?.mandatory || false,
      targets: {
        batches: event?.targets?.batches || [],
        sections: event?.targets?.sections || [],
        programs: []
      }
    }
  });

  // Create/Update event mutation
  const eventMutation = useMutation({
    mutationFn: async (data: CanonicalEventFormData) => {
      const endpoint = event ? `/api/events/${event.id}` : '/api/events';
      const method = event ? 'PUT' : 'POST';
      
      const payload = {
        ...data,
        meta: {
          mandatory: data.mandatory,
          tags: []
        },
        targets: {
          ...data.targets,
          programs: [] // Always empty since we removed program targeting
        }
      };
      
      return await apiRequest(method, endpoint, payload);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: event ? 'Event updated successfully' : 'Event created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save event',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: CanonicalEventFormData) => {
    setIsSubmitting(true);
    try {
      await eventMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canManageEvents) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2" />
            <p>You don't have permission to manage events.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          {event ? 'Edit Event' : 'Create New Event'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Event title"
                        data-testid="input-event-title"
                      />
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
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Academic">Academic</SelectItem>
                        <SelectItem value="Cultural">Cultural</SelectItem>
                        <SelectItem value="Sports">Sports</SelectItem>
                        <SelectItem value="Technical">Technical</SelectItem>
                        <SelectItem value="Social">Social</SelectItem>
                        <SelectItem value="Administrative">Administrative</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="Triathlon">Triathlon</SelectItem>
                        <SelectItem value="Placement">Placement</SelectItem>
                        <SelectItem value="Committee">Committee</SelectItem>
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
                    <Textarea
                      {...field}
                      placeholder="Event description..."
                      rows={3}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Start Date & Time
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="datetime-local"
                        data-testid="input-starts-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      End Date & Time (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="datetime-local"
                        data-testid="input-ends-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location and Host */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Location
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Event location"
                        data-testid="input-location"
                      />
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
                      <Input
                        {...field}
                        placeholder="Organizing committee"
                        data-testid="input-host-committee"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Targeting Section */}
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Event Targeting
                </h3>

                {/* Batches */}
                <FormField
                  control={form.control}
                  name="targets.batches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Batches (Required)</FormLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {field.value.map((batch, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {batch}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-1"
                              onClick={() => {
                                const newBatches = field.value.filter((_, i) => i !== index);
                                field.onChange(newBatches);
                              }}
                              data-testid={`button-remove-batch-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      <Select
                        onValueChange={(value) => {
                          if (!field.value.includes(value)) {
                            field.onChange([...field.value, value]);
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-batch">
                          <SelectValue placeholder="Add batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {batches.map((batch) => (
                            <SelectItem key={batch} value={batch}>
                              {batch}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sections */}
                <FormField
                  control={form.control}
                  name="targets.sections"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Target Sections (Optional - empty means all sections)</FormLabel>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {field.value.map((section, index) => (
                          <Badge key={index} variant="outline" className="flex items-center gap-1">
                            {section}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-1"
                              onClick={() => {
                                const newSections = field.value.filter((_, i) => i !== index);
                                field.onChange(newSections);
                              }}
                              data-testid={`button-remove-section-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      <Select
                        onValueChange={(value) => {
                          if (!field.value.includes(value)) {
                            field.onChange([...field.value, value]);
                          }
                        }}
                      >
                        <SelectTrigger data-testid="select-section">
                          <SelectValue placeholder="Add section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

              </div>
            </div>

            {/* Event Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rsvpRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">RSVP Required</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Students must confirm attendance
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-rsvp-required"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mandatory"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Mandatory Event</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Attendance is required
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-mandatory"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || eventMutation.isPending}
                data-testid="button-submit"
              >
                {isSubmitting || eventMutation.isPending 
                  ? (event ? 'Updating...' : 'Creating...') 
                  : (event ? 'Update Event' : 'Create Event')
                }
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}