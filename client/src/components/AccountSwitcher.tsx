import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { UserCheck, ChevronDown, LogOut, Plus, Users } from "lucide-react";

interface SessionAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: {
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
  };
  profileImageUrl?: string;
}

export default function AccountSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch session accounts
  const { data: accountData } = useQuery({
    queryKey: ["/api/auth/accounts"],
    retry: false,
    enabled: !!user,
  });
  
  const accounts = accountData?.accounts || [];
  const currentAccountId = accountData?.currentAccountId;

  // Fetch CSRF token
  const { data: csrfData } = useQuery({
    queryKey: ["/api/auth/csrf-token"],
    retry: false,
    enabled: !!user,
  });

  // Switch account mutation
  const switchAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch("/api/auth/switch-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData?.csrfToken || "",
        },
        body: JSON.stringify({ accountId }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${response.status}: ${error}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account switched",
        description: "Successfully switched accounts",
      });
      // Refresh user data, accounts, and CSRF token
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/csrf-token"] });
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

  // Logout current account mutation
  const logoutCurrentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout-current", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData?.csrfToken || "",
        },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${response.status}: ${error}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.fullyLoggedOut) {
        toast({
          title: "Logged out",
          description: "You have been logged out completely",
        });
        window.location.href = "/";
      } else {
        toast({
          title: "Account removed",
          description: "Switched to another account",
        });
        // Refresh user data, accounts, and CSRF token
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/csrf-token"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to logout current account",
        variant: "destructive",
      });
    },
  });

  const handleAddAccount = () => {
    window.location.href = "/api/login?mode=add";
  };
  
  const handleFullLogout = () => {
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

  if (!user) {
    return null;
  }

  const currentAccount = accounts.find((acc: SessionAccount) => acc.id === currentAccountId) || user;
  const otherAccounts = accounts.filter((acc: SessionAccount) => acc.id !== currentAccountId);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 min-w-[180px]" 
            data-testid="account-switcher-trigger"
          >
            <div className="flex items-center gap-2 flex-1">
              <Badge 
                variant={getRoleBadgeVariant(currentAccount.role || 'student')} 
                className="text-xs"
              >
                {(currentAccount.role || 'student').replace('_', ' ')}
              </Badge>
              {accounts.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  +{accounts.length - 1}
                </span>
              )}
            </div>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Current Account */}
          <div className="px-3 py-3 border-b">
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium" data-testid="text-current-email">
                  {currentAccount.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Current Account
                </p>
              </div>
            </div>
          </div>
          
          {/* Other Accounts */}
          {otherAccounts.length > 0 && (
            <>
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Switch Account</p>
                {otherAccounts.map((account: SessionAccount) => (
                  <DropdownMenuItem 
                    key={account.id}
                    onClick={() => switchAccountMutation.mutate(account.id)}
                    className="flex items-center gap-3 cursor-pointer py-2" 
                    data-testid={`switch-account-${account.id}`}
                  >
                    <Users className="h-4 w-4" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{account.email}</p>
                      <Badge variant={getRoleBadgeVariant(account.role)} className="text-xs mt-1">
                        {account.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          
          {/* Account Actions */}
          <DropdownMenuItem 
            onClick={handleAddAccount}
            className="cursor-pointer" 
            data-testid="add-account"
          >
            <Plus className="h-4 w-4 mr-2" />
            Sign in with another account
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Logout Options */}
          {accounts.length > 1 ? (
            <DropdownMenuItem 
              onClick={() => logoutCurrentMutation.mutate()}
              className="cursor-pointer text-orange-600 hover:text-orange-700" 
              data-testid="logout-current"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout current account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={handleFullLogout}
              className="cursor-pointer text-destructive" 
              data-testid="logout-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}