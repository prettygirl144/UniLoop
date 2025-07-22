import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { ClipboardCheck, Users, Check } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Event, User } from '@shared/schema';

export default function Attendance() {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: events } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/directory/users'],
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async ({ eventId, attendees }: { eventId: number; attendees: string[] }) => {
      await apiRequest('POST', '/api/attendance', { eventId, attendees });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Attendance saved successfully!',
      });
      setAttendees([]);
      setSelectedEventId('');
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
        description: 'Failed to save attendance. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleAttendeeToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setAttendees(prev => [...prev, userId]);
    } else {
      setAttendees(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSaveAttendance = () => {
    if (!selectedEventId) {
      toast({
        title: 'Error',
        description: 'Please select an event first.',
        variant: 'destructive',
      });
      return;
    }

    saveAttendanceMutation.mutate({
      eventId: parseInt(selectedEventId),
      attendees,
    });
  };

  const selectedEvent = events?.find(event => event.id.toString() === selectedEventId);

  return (
    <ProtectedRoute requiredPermission="attendance">
      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <ClipboardCheck className="text-primary" size={24} />
          <h2 className="text-large">Attendance Logging</h2>
        </div>

        {/* Event Selection */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle>Select Event</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an event..." />
              </SelectTrigger>
              <SelectContent>
                {events?.map((event) => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    {event.title} - {new Date(event.date).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Attendance List */}
        {selectedEventId && (
          <Card className="shadow-sm border-gray-100">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Mark Attendance</CardTitle>
                <div className="flex items-center space-x-2 text-sm text-text-secondary">
                  <Users size={16} />
                  <span>{attendees.length}/{users?.length || 0} checked in</span>
                </div>
              </div>
              {selectedEvent && (
                <p className="text-sm text-text-secondary">
                  {selectedEvent.title} • {new Date(selectedEvent.date).toLocaleString()}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {users?.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary">
                    <Users size={48} className="mx-auto mb-2 opacity-30" />
                    <p>No users found</p>
                  </div>
                ) : (
                  users?.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {user.profileImageUrl ? (
                          <img 
                            src={user.profileImageUrl}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {user.email?.includes('cs') ? 'CS' : 
                             user.email?.includes('ece') ? 'ECE' :
                             user.email?.includes('me') ? 'ME' : 'Student'} • {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`attendee-${user.id}`}
                          checked={attendees.includes(user.id)}
                          onCheckedChange={(checked) => 
                            handleAttendeeToggle(user.id, checked as boolean)
                          }
                        />
                        <Label htmlFor={`attendee-${user.id}`} className="text-sm">
                          Present
                        </Label>
                        {attendees.includes(user.id) && (
                          <Check className="text-green-500" size={16} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {users && users.length > 0 && (
                <Button 
                  onClick={handleSaveAttendance}
                  disabled={saveAttendanceMutation.isPending || attendees.length === 0}
                  className="w-full mt-4 bg-primary text-white"
                >
                  {saveAttendanceMutation.isPending 
                    ? 'Saving...' 
                    : `Save Attendance (${attendees.length} students)`
                  }
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
