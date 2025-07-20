import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, LogOut, UserCheck, ChevronDown } from "lucide-react";

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

export default function CompactAccountSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.reload(); // Refresh to load new role permissions
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch account",
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 px-2 py-1">
          <Badge variant={getRoleBadgeVariant(user?.role || 'student')} className="text-xs mr-1">
            {user?.role?.replace('_', ' ') || 'Student'}
          </Badge>
          {linkedAccounts.length > 1 && (
            <span className="text-xs text-white/70 mr-1">
              +{linkedAccounts.length - 1}
            </span>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Current Account */}
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Current Account</p>
            </div>
          </div>
        </div>
        
        {linkedAccounts.length > 1 && <DropdownMenuSeparator />}
        
        {/* Switch Account Options */}
        {linkedAccounts.filter((account: LinkedAccount) => account.id !== user?.id).map((account: LinkedAccount) => (
          <DropdownMenuItem 
            key={account.id}
            onClick={() => switchAccountMutation.mutate(account.id)}
            className="flex items-center gap-2 cursor-pointer"
            disabled={switchAccountMutation.isPending}
          >
            <div className="flex-1">
              <p className="text-sm font-medium truncate">{account.email}</p>
              <Badge variant={getRoleBadgeVariant(account.role)} className="text-xs mt-1">
                {account.role.replace('_', ' ')}
              </Badge>
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}