import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Clock, AlertTriangle, Info, Check, X, Edit, Trash2, List, Grid3X3, MapPin } from 'lucide-react';
import { useAuthContext } from '@/context/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Event } from '@shared/schema';
import CanonicalEventForm from '@/components/CanonicalEventForm';

// Helper function to format date/time for display
function formatEventTime(event: Event): { date: string; time: string } {
  // Use canonical startsAt if available, otherwise fall back to legacy date + startTime
  const startsAt = event.startsAt ? new Date(event.startsAt) : 
    (event.date ? new Date(event.date) : new Date());
  
  const date = startsAt.toLocaleDateString();
  const time = event.startsAt ? 
    startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
    (event.startTime || 'TBD');
    
  return { date, time };
}

// Helper function to check if user is eligible for event
function isUserEligible(user: any, event: Event): boolean {
  // Admin can see all events
  if (user?.role === 'admin' || user?.role === 'events_manager') {
    return true;
  }
  
  // Check canonical targets if available
  if (event.targets && event.targets.batches && event.targets.batches.length > 0) {
    const batchOK = event.targets.batches.includes(user?.batch || '');
    const sectionOK = !event.targets.sections?.length || event.targets.sections.includes(user?.section || '');
    const programOK = !event.targets.programs?.length || event.targets.programs.includes(user?.program || '');
    return batchOK && sectionOK && programOK;
  }
  
  // Fall back to legacy targeting
  if (event.targetBatches && event.targetBatches.length > 0) {
    return event.targetBatches.includes(user?.batch || '');
  }
  
  // If no targeting specified, show to all
  return true;
}

function CalendarGrid({ events, onEventClick }: { events: Event[]; onEventClick: (event: Event) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get days in month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Previous month navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  // Next month navigation
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  // Get events for a specific date
  const getEventsForDate = (date: number) => {
    const targetDate = new Date(year, month, date);
    return events.filter(event => {
      const eventDate = event.startsAt ? new Date(event.startsAt) : 
        (event.date ? new Date(event.date) : null);
      if (!eventDate) return false;
      
      return eventDate.toDateString() === targetDate.toDateString();
    });
  };
  
  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="h-24"></div>);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = getEventsForDate(day);
    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
    
    calendarDays.push(
      <div key={day} className={`h-24 border border-gray-200 p-1 ${isToday ? 'bg-blue-50' : ''}`}>
        <div className="text-sm font-medium mb-1">{day}</div>
        <div className="space-y-1">
          {dayEvents.slice(0, 2).map(event => (
            <div
              key={event.id}
              className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded cursor-pointer hover:bg-blue-200"
              onClick={() => onEventClick(event)}
            >
              {event.title}
            </div>
          ))}
          {dayEvents.length > 2 && (
            <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-0 border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-100 p-2 text-center text-sm font-medium border border-gray-200">
              {day}
            </div>
          ))}
          {calendarDays}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const { user, isAuthenticated } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: isAuthenticated,
  });

  // Check permissions
  const canManageEvents = user?.permissions?.['events.manage'] || user?.role === 'admin' || user?.role === 'events_manager';

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest('DELETE', `/api/events/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Event deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowEventDetails(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteEvent = (event: Event) => {
    if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
      deleteEventMutation.mutate(event.id);
    }
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setShowEditDialog(true);
    setShowEventDetails(false);
  };

  // Filter events for display
  const filteredEvents = events?.filter(event => isUserEligible(user, event)) || [];

  // Get today's events
  const today = new Date();
  const todaysEvents = filteredEvents.filter(event => {
    const eventDate = event.startsAt ? new Date(event.startsAt) : 
      (event.date ? new Date(event.date) : null);
    return eventDate && eventDate.toDateString() === today.toDateString();
  });

  if (eventsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Events Calendar</h2>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'calendar')}>
            <TabsList>
              <TabsTrigger value="list">
                <List size={16} className="mr-1" />
                List
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <Grid3X3 size={16} className="mr-1" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {canManageEvents && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-event">
                  <Plus size={16} className="mr-1" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl mx-auto max-h-[90vh] overflow-y-auto">
                <CanonicalEventForm
                  onSuccess={() => {
                    setShowCreateDialog(false);
                    queryClient.invalidateQueries({ queryKey: ['/api/events'] });
                  }}
                  onCancel={() => setShowCreateDialog(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
          {/* Today's Events */}
          {todaysEvents.length > 0 && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Today's Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todaysEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border hover:bg-gray-50 cursor-pointer p-4"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDetails(true);
                      }}
                      data-testid={`event-card-${event.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{event.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatEventTime(event).time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.meta?.mandatory && (
                            <Badge variant="destructive" className="text-xs">
                              Mandatory
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Events */}
          <Card>
            <CardHeader>
              <CardTitle>All Events</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredEvents.length > 0 ? (
                <div className="space-y-3">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border hover:bg-gray-50 cursor-pointer p-4"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDetails(true);
                      }}
                      data-testid={`event-card-${event.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{event.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {formatEventTime(event).date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatEventTime(event).time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {event.meta?.mandatory && (
                            <Badge variant="destructive" className="text-xs">
                              Mandatory
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                          {canManageEvents && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditEvent(event);
                                }}
                                data-testid={`button-edit-event-${event.id}`}
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
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-event-${event.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No events scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Calendar View */
        <CalendarGrid events={filteredEvents} onEventClick={(event) => {
          setSelectedEvent(event);
          setShowEventDetails(true);
        }} />
      )}

      {/* Edit Event Dialog */}
      {showEditDialog && selectedEvent && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-6xl mx-auto max-h-[90vh] overflow-y-auto">
            <CanonicalEventForm
              event={selectedEvent}
              onSuccess={() => {
                setShowEditDialog(false);
                setSelectedEvent(null);
                queryClient.invalidateQueries({ queryKey: ['/api/events'] });
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedEvent(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Event Details Modal */}
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedEvent.meta?.mandatory && (
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
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.description}
                </p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{formatEventTime(selectedEvent).date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatEventTime(selectedEvent).time}</span>
                  {selectedEvent.endsAt && (
                    <span> - {new Date(selectedEvent.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{selectedEvent.location}</span>
                </div>
                {selectedEvent.hostCommittee && (
                  <div className="text-muted-foreground">
                    Host: {selectedEvent.hostCommittee}
                  </div>
                )}
              </div>

              {/* Eligibility Status */}
              <div className="p-3 rounded-lg border">
                {isUserEligible(user, selectedEvent) ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    <span className="text-sm">You are eligible for this event</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Info className="w-4 h-4" />
                    <span className="text-sm">You are not eligible for this event</span>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {canManageEvents && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEvent(selectedEvent)}
                    data-testid="button-edit-event-details"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteEvent(selectedEvent)}
                    className="text-red-600 hover:text-red-700"
                    data-testid="button-delete-event-details"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}