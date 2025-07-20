import { useState, useEffect } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Plus, LogOut, UserCheck, ChevronDown, Settings } from "lucide-react";

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

  // Store active account in localStorage
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem('activeAccountId', user.id);
      localStorage.setItem('activeRole', user.role || 'student');
    }
  }, [user]);

  return (
    <div className="flex items-center gap-2">
      {/* Enhanced Account Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant(user?.role || 'student')} className="text-xs">
                {user?.role?.replace('_', ' ') || 'Student'}
              </Badge>
              {linkedAccounts.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  +{linkedAccounts.length - 1}
                </span>
              )}
            </div>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Current Account */}
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Current Account</p>
              </div>
            </div>
          </div>
          
          <DropdownMenuSeparator />
          
          {/* Switch Account Options */}
          {linkedAccounts.filter((account: LinkedAccount) => account.id !== user?.id).map((account: LinkedAccount) => (
            <DropdownMenuItem 
              key={account.id}
              onClick={() => switchAccountMutation.mutate(account.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{account.email}</p>
                <Badge variant={getRoleBadgeVariant(account.role)} className="text-xs mt-1">
                  {account.role.replace('_', ' ')}
                </Badge>
              </div>
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          {/* Account Management */}
          <Dialog>
            <DialogTrigger asChild>
              <DropdownMenuItem className="cursor-pointer" onSelect={(e) => e.preventDefault()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </DropdownMenuItem>
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
          
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}