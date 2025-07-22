import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Settings, Shield, Search } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: string;
  permissions: {
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export default function Admin() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "",
    permissions: {
      calendar: false,
      attendance: false,
      gallery: false,
      forumMod: false,
      diningHostel: false,
      postCreation: false,
    }
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 1000);
      return;
    }
  }, [isAuthenticated, isLoading, user, toast]);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: { userId: string; role: string; permissions: any }) => {
      return await apiRequest(`/api/admin/users/${userData.userId}`, {
        method: "PUT",
        body: JSON.stringify({
          role: userData.role,
          permissions: userData.permissions
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditModalOpen(false);
      setSelectedUser(null);
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
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      permissions: {
        calendar: user.permissions?.calendar || false,
        attendance: user.permissions?.attendance || false,
        gallery: user.permissions?.gallery || false,
        forumMod: user.permissions?.forumMod || false,
        diningHostel: user.permissions?.diningHostel || false,
        postCreation: user.permissions?.postCreation || false,
      }
    });
    setIsEditModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      userId: selectedUser.id,
      role: editForm.role,
      permissions: editForm.permissions
    });
  };

  const filteredUsers = users.filter((user: User) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'committee_club': return 'default';
      case 'student': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              Admin privileges required to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              <h1 className="text-large">Admin Dashboard</h1>
            </div>
            <Badge variant="outline" className="text-primary">
              {users.length} Total Users
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user roles and permissions across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Calendar</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Gallery</TableHead>
                    <TableHead>Forum Mod</TableHead>
                    <TableHead>Dining/Hostel</TableHead>
                    <TableHead>Post Creation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {user.profileImageUrl && (
                              <img
                                src={user.profileImageUrl}
                                alt="Profile"
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <div className="text-medium">
                                {user.firstName || user.lastName 
                                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                  : 'Unknown'
                                }
                              </div>
                              <div className="text-small text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.calendar ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.attendance ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.gallery ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.forumMod ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.diningHostel ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.postCreation ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
            <DialogDescription>
              Update role and permissions for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="committee_club">Committee/Club</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permissions (only shown for committee_club) */}
            {editForm.role === 'committee_club' && (
              <div className="space-y-4">
                <Label>Permissions</Label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="calendar" className="text-sm">Calendar Access</Label>
                    <Switch
                      id="calendar"
                      checked={editForm.permissions.calendar}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, calendar: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="attendance" className="text-sm">Attendance Access</Label>
                    <Switch
                      id="attendance"
                      checked={editForm.permissions.attendance}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, attendance: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gallery" className="text-sm">Gallery Access</Label>
                    <Switch
                      id="gallery"
                      checked={editForm.permissions.gallery}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, gallery: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="forumMod" className="text-sm">Forum Moderation</Label>
                    <Switch
                      id="forumMod"
                      checked={editForm.permissions.forumMod}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, forumMod: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="diningHostel" className="text-sm">Dining & Hostel</Label>
                    <Switch
                      id="diningHostel"
                      checked={editForm.permissions.diningHostel}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, diningHostel: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="postCreation" className="text-sm">Post Creation</Label>
                    <Switch
                      id="postCreation"
                      checked={editForm.permissions.postCreation}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, postCreation: checked }
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {editForm.role === 'admin' && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Admin role grants full access to all features and overrides individual permissions.
                </p>
              </div>
            )}

            {editForm.role === 'student' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Student role provides view-only access to most features.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}