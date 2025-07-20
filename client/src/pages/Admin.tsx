import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuthContext } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { Shield, Users, Flag, Search } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { User } from '@shared/schema';

interface UserPermissions {
  calendar?: boolean;
  attendance?: boolean;
  gallery?: boolean;
  forumMod?: boolean;
  diningHostel?: boolean;
  postCreation?: boolean;
}

export default function Admin() {
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/directory/users'],
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: UserPermissions }) => {
      await apiRequest('PUT', `/api/admin/users/${userId}/permissions`, { permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/directory/users'] });
      toast({
        title: 'Success',
        description: 'User permissions updated successfully!',
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
        description: 'Failed to update permissions. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleUserSelect = (selectedUser: User) => {
    setSelectedUser(selectedUser);
    setPermissions(selectedUser.permissions || {});
  };

  const handlePermissionChange = (permission: keyof UserPermissions, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: value,
    }));
  };

  const handleSavePermissions = () => {
    if (selectedUser) {
      updatePermissionsMutation.mutate({
        userId: selectedUser.id,
        permissions,
      });
    }
  };

  const filteredUsers = users?.filter(u => 
    !searchEmail || u.email?.toLowerCase().includes(searchEmail.toLowerCase())
  );

  return (
    <ProtectedRoute requireAdmin>
      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <Shield className="text-primary" size={24} />
          <h2 className="text-lg font-semibold">Admin Panel</h2>
        </div>

        {/* Admin Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary">{users?.length || 0}</p>
                  <p className="text-xs text-text-secondary">Total Users</p>
                </div>
                <Users className="text-lg text-primary opacity-60" size={20} />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-accent">23</p>
                  <p className="text-xs text-text-secondary">Pending Reviews</p>
                </div>
                <Flag className="text-lg text-accent opacity-60" size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Permissions Manager */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle>User Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search User */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={16} />
              <Input
                type="text"
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200"
              />
            </div>

            {/* User List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filteredUsers?.map((u) => (
                <div
                  key={u.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUser?.id === u.id 
                      ? 'bg-primary bg-opacity-10 border border-primary' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => handleUserSelect(u)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{u.email}</span>
                    <Badge 
                      variant="secondary"
                      className={`text-xs px-2 py-1 capitalize ${
                        u.role === 'admin' 
                          ? 'bg-error bg-opacity-10 text-error'
                          : u.role === 'committee_club'
                          ? 'bg-secondary bg-opacity-10 text-secondary'
                          : 'bg-primary bg-opacity-10 text-primary'
                      }`}
                    >
                      {u.role?.replace('_', ' ') || 'student'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-text-secondary">
                      {u.firstName} {u.lastName}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Permission Controls */}
            {selectedUser && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium">
                  Permissions for {selectedUser.email}
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={permissions.calendar || false}
                      onCheckedChange={(checked) => handlePermissionChange('calendar', checked)}
                      id="calendar"
                    />
                    <Label htmlFor="calendar" className="text-sm">Calendar Access</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={permissions.attendance || false}
                      onCheckedChange={(checked) => handlePermissionChange('attendance', checked)}
                      id="attendance"
                    />
                    <Label htmlFor="attendance" className="text-sm">Attendance</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={permissions.gallery || false}
                      onCheckedChange={(checked) => handlePermissionChange('gallery', checked)}
                      id="gallery"
                    />
                    <Label htmlFor="gallery" className="text-sm">Gallery Upload</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={permissions.forumMod || false}
                      onCheckedChange={(checked) => handlePermissionChange('forumMod', checked)}
                      id="forumMod"
                    />
                    <Label htmlFor="forumMod" className="text-sm">Forum Moderator</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={permissions.diningHostel || false}
                      onCheckedChange={(checked) => handlePermissionChange('diningHostel', checked)}
                      id="diningHostel"
                    />
                    <Label htmlFor="diningHostel" className="text-sm">Dining & Hostel</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={permissions.postCreation || false}
                      onCheckedChange={(checked) => handlePermissionChange('postCreation', checked)}
                      id="postCreation"
                    />
                    <Label htmlFor="postCreation" className="text-sm">Post Creation</Label>
                  </div>
                </div>

                <Button 
                  onClick={handleSavePermissions}
                  disabled={updatePermissionsMutation.isPending}
                  className="w-full bg-primary text-white"
                >
                  {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Moderation */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle>Content Moderation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 border border-accent border-opacity-30 bg-accent bg-opacity-5 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Flagged Forum Post</span>
                <span className="text-xs text-accent">2 reports</span>
              </div>
              <p className="text-xs text-text-secondary mb-2">
                "Inappropriate content about campus policies..."
              </p>
              <div className="flex space-x-2">
                <Button size="sm" variant="destructive" className="text-xs">
                  Remove
                </Button>
                <Button size="sm" variant="outline" className="text-xs">
                  Dismiss
                </Button>
                <Button size="sm" variant="ghost" className="text-primary text-xs">
                  View Full
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
