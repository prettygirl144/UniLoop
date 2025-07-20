import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Users, Plus, LogOut, UserCheck } from "lucide-react";

interface LinkedAccount {
  id: string;
  email: string;
  role: string;
  permissions: {
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
  };
  accountType: string;
}

export default function AccountSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    role: "committee_club",
    permissions: {
      calendar: false,
      attendance: false,
      gallery: false,
      forumMod: false,
      diningHostel: false,
      postCreation: false,
    }
  });

  // Fetch linked accounts
  const { data: linkedAccounts = [] } = useQuery({
    queryKey: ["/api/auth/linked-accounts"],
    retry: false,
    enabled: !!user,
  });

  // Switch account mutation
  const switchAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest("/api/auth/switch-account", {
        method: "POST",
        body: JSON.stringify({ accountId }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Account switched",
        description: "Successfully switched to the selected account",
      });
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to switch account",
        variant: "destructive",
      });
    },
  });

  // Create alternate account mutation
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/auth/create-alternate-account", {
        method: "POST",
        body: JSON.stringify({
          role: newAccountForm.role,
          permissions: newAccountForm.permissions,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Alternate account created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/linked-accounts"] });
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create alternate account",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'committee_club': return 'default';
      case 'student': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Current Account Display */}
      <div className="flex items-center gap-2">
        <Badge variant={getRoleBadgeVariant(user?.role || 'student')}>
          {user?.role?.replace('_', ' ') || 'Student'}
        </Badge>
        {linkedAccounts.length > 1 && (
          <Badge variant="outline" className="text-xs">
            {linkedAccounts.length} accounts
          </Badge>
        )}
      </div>

      {/* Account Switcher */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1" />
            Accounts
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account Management</DialogTitle>
            <DialogDescription>
              Switch between your accounts or create new ones
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Account */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Current Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{user?.email}</div>
                    <Badge variant={getRoleBadgeVariant(user?.role || 'student')} className="mt-1">
                      {user?.role?.replace('_', ' ') || 'Student'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Other Linked Accounts */}
            {linkedAccounts.filter((account: LinkedAccount) => account.id !== user?.id).map((account: LinkedAccount) => (
              <Card key={account.id} className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => switchAccountMutation.mutate(account.id)}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{account.email}</div>
                      <Badge variant={getRoleBadgeVariant(account.role)} className="mt-1">
                        {account.role.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" disabled={switchAccountMutation.isPending}>
                      {switchAccountMutation.isPending ? "Switching..." : "Switch"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Create New Account */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/50 border-dashed">
                  <CardContent className="pt-6 text-center">
                    <Plus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <div className="text-sm font-medium">Create Alternate Account</div>
                    <div className="text-xs text-muted-foreground">
                      Add committee or admin privileges
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Alternate Account</DialogTitle>
                  <DialogDescription>
                    Create an account with different role and permissions
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newAccountForm.role} onValueChange={(value) => 
                      setNewAccountForm(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="committee_club">Committee/Club</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Permissions (only for committee_club) */}
                  {newAccountForm.role === 'committee_club' && (
                    <div className="space-y-3">
                      <Label>Permissions</Label>
                      <div className="grid gap-3">
                        {Object.entries(newAccountForm.permissions).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <Label htmlFor={key} className="text-sm">
                              {key === 'forumMod' ? 'Forum Moderation' : 
                               key === 'diningHostel' ? 'Dining & Hostel' :
                               key === 'postCreation' ? 'Post Creation' :
                               key.charAt(0).toUpperCase() + key.slice(1)}
                            </Label>
                            <Switch
                              id={key}
                              checked={value}
                              onCheckedChange={(checked) => 
                                setNewAccountForm(prev => ({ 
                                  ...prev, 
                                  permissions: { ...prev.permissions, [key]: checked }
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createAccountMutation.mutate()}
                    disabled={createAccountMutation.isPending}
                  >
                    {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Logout from All Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}