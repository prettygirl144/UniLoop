import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Utensils, UserX, Home, AlertTriangle, CalendarDays } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { z } from 'zod';

const sickFoodSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  mealType: z.string().min(1, 'Meal type is required'),
  specialRequirements: z.string().optional(),
});

const leaveApplicationSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

const grievanceSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  category: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
});

type SickFoodForm = z.infer<typeof sickFoodSchema>;
type LeaveApplicationForm = z.infer<typeof leaveApplicationSchema>;
type GrievanceForm = z.infer<typeof grievanceSchema>;

export default function Dining() {
  const [showSickFoodDialog, setShowSickFoodDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showGrievanceDialog, setShowGrievanceDialog] = useState(false);
  const { toast } = useToast();

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

  const sickFoodForm = useForm<SickFoodForm>({
    resolver: zodResolver(sickFoodSchema),
    defaultValues: {
      date: '',
      mealType: '',
      specialRequirements: '',
    },
  });

  const leaveForm = useForm<LeaveApplicationForm>({
    resolver: zodResolver(leaveApplicationSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  const grievanceForm = useForm<GrievanceForm>({
    resolver: zodResolver(grievanceSchema),
    defaultValues: {
      type: '',
      category: '',
      description: '',
    },
  });

  const onSickFoodSubmit = (data: SickFoodForm) => {
    sickFoodMutation.mutate(data);
  };

  const onLeaveSubmit = (data: LeaveApplicationForm) => {
    leaveMutation.mutate(data);
  };

  const onGrievanceSubmit = (data: GrievanceForm) => {
    grievanceMutation.mutate(data);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Dining & Hostel</h2>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4 text-center space-y-2">
            <Utensils className="text-xl text-primary mx-auto" size={24} />
            <p className="text-sm font-medium">Today's Menu</p>
          </CardContent>
        </Card>
        
        <Dialog open={showSickFoodDialog} onOpenChange={setShowSickFoodDialog}>
          <DialogTrigger asChild>
            <Card className="shadow-sm border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
              <CardContent className="p-4 text-center space-y-2">
                <UserX className="text-xl text-accent mx-auto" size={24} />
                <p className="text-sm font-medium">Sick Food</p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Book Sick Food</DialogTitle>
            </DialogHeader>
            <Form {...sickFoodForm}>
              <form onSubmit={sickFoodForm.handleSubmit(onSickFoodSubmit)} className="space-y-4">
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
                  name="specialRequirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Requirements (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Any special dietary requirements..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowSickFoodDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sickFoodMutation.isPending}>
                    {sickFoodMutation.isPending ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's Menu */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CalendarDays className="text-primary" size={20} />
            <span>Today's Menu</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-sm">Breakfast</h4>
              <p className="text-xs text-text-secondary">6:30 AM - 9:30 AM</p>
            </div>
            <div className="text-right">
              <p className="text-xs">Paratha, Sabzi, Curd</p>
              <p className="text-xs text-text-secondary">Tea/Coffee</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-sm">Lunch</h4>
              <p className="text-xs text-text-secondary">12:00 PM - 3:00 PM</p>
            </div>
            <div className="text-right">
              <p className="text-xs">Rice, Dal, Paneer Curry</p>
              <p className="text-xs text-text-secondary">Roti, Salad</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-sm">Dinner</h4>
              <p className="text-xs text-text-secondary">7:00 PM - 10:00 PM</p>
            </div>
            <div className="text-right">
              <p className="text-xs">Chicken Curry, Rice</p>
              <p className="text-xs text-text-secondary">Chapati, Dal</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <div className="space-y-3">
        <h3 className="font-semibold">Services</h3>
        
        <div className="space-y-3">
          <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
            <DialogTrigger asChild>
              <Card className="shadow-sm border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="p-4 flex items-center space-x-3">
                  <div className="w-12 h-12 bg-secondary bg-opacity-10 rounded-xl flex items-center justify-center">
                    <Home className="text-secondary" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Hostel Leave Application</h4>
                    <p className="text-xs text-text-secondary">Submit leave requests online</p>
                  </div>
                  <i className="fas fa-chevron-right text-text-secondary"></i>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle>Hostel Leave Application</DialogTitle>
              </DialogHeader>
              <Form {...leaveForm}>
                <form onSubmit={leaveForm.handleSubmit(onLeaveSubmit)} className="space-y-4">
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
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Please provide reason for leave..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowLeaveDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={leaveMutation.isPending}>
                      {leaveMutation.isPending ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showGrievanceDialog} onOpenChange={setShowGrievanceDialog}>
            <DialogTrigger asChild>
              <Card className="shadow-sm border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="p-4 flex items-center space-x-3">
                  <div className="w-12 h-12 bg-error bg-opacity-10 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="text-error" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Food Quality Grievance</h4>
                    <p className="text-xs text-text-secondary">Report food quality issues</p>
                  </div>
                  <i className="fas fa-chevron-right text-text-secondary"></i>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle>Submit Grievance</DialogTitle>
              </DialogHeader>
              <Form {...grievanceForm}>
                <form onSubmit={grievanceForm.handleSubmit(onGrievanceSubmit)} className="space-y-4">
                  <FormField
                    control={grievanceForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select grievance type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="food_quality">Food Quality</SelectItem>
                            <SelectItem value="hostel_maintenance">Hostel Maintenance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={grievanceForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="undercooked">Undercooked</SelectItem>
                            <SelectItem value="item_missing">Item Missing</SelectItem>
                            <SelectItem value="hygiene_issue">Hygiene Issue</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
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
                          <Textarea {...field} placeholder="Please describe the issue in detail..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowGrievanceDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={grievanceMutation.isPending}>
                      {grievanceMutation.isPending ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
