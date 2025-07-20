import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Search, Filter, Send, Users } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { z } from 'zod';
import type { User } from '@shared/schema';

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

type MessageForm = z.infer<typeof messageSchema>;

const filters = ['All', 'CS', 'ECE', 'ME', 'Batch \'25', 'Batch \'24', 'Batch \'26'];

export default function Directory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/directory/users'],
  });

  const messageMutation = useMutation({
    mutationFn: async (data: MessageForm & { recipientId: string }) => {
      // This would typically send to a messaging API
      // For now, we'll just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      return data;
    },
    onSuccess: () => {
      setShowMessageDialog(false);
      form.reset();
      toast({
        title: 'Message Sent',
        description: 'Your message has been sent successfully!',
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
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<MessageForm>({
    defaultValues: {
      message: '',
    },
  });

  const onSubmit = (data: MessageForm) => {
    if (selectedUser) {
      messageMutation.mutate({ ...data, recipientId: selectedUser.id });
    }
  };

  const handlePing = (user: User) => {
    setSelectedUser(user);
    setShowMessageDialog(true);
  };

  const filteredUsers = users?.filter(user => {
    const matchesSearch = !searchQuery || 
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = activeFilter === 'All' || 
      user.email?.includes(activeFilter.toLowerCase()) ||
      (activeFilter.includes('Batch') && user.email?.includes(activeFilter.split(' ')[1]?.replace('\'', '')));

    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Student Directory</h2>
        <Button variant="ghost" size="sm" className="text-primary p-2">
          <Filter size={18} />
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={16} />
        <Input
          type="text"
          placeholder="Search students..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-surface border-gray-200"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <Button
            key={filter}
            variant={activeFilter === filter ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter)}
            className={`whitespace-nowrap text-xs ${
              activeFilter === filter
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* Student List */}
      <div className="space-y-3">
        {filteredUsers?.length === 0 ? (
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-8 text-center text-text-secondary">
              <Users size={48} className="mx-auto mb-2 opacity-30" />
              <p>No students found matching your search.</p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers?.map((user) => (
            <Card key={user.id} className="shadow-sm border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  {user.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">
                      {user.firstName} {user.lastName}
                    </h4>
                    <p className="text-xs text-text-secondary">
                      {user.email?.includes('cs') ? 'Computer Science' : 
                       user.email?.includes('ece') ? 'Electronics & Communications' :
                       user.email?.includes('me') ? 'Mechanical Engineering' : 'Student'} 
                      {user.email?.includes('2025') ? ' • Batch 2025' :
                       user.email?.includes('2024') ? ' • Batch 2024' :
                       user.email?.includes('2026') ? ' • Batch 2026' : ''}
                    </p>
                    <p className="text-xs text-text-secondary">{user.email}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePing(user)}
                    className="bg-primary text-white text-xs font-medium"
                  >
                    <Send size={12} className="mr-1" />
                    Ping
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>
              Send Message to {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Type your message here..."
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowMessageDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={messageMutation.isPending}>
                  {messageMutation.isPending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
