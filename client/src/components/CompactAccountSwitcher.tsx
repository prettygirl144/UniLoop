import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, LogOut, UserCheck, ChevronDown, Plus } from "lucide-react";

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

interface AccountsResponse {
  accounts: SessionAccount[];
  currentAccountId: string;
}

interface CsrfResponse {
  csrfToken: string;
}

export default function CompactAccountSwitcher() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch session accounts
  const { data: accountData } = useQuery<AccountsResponse>({
    queryKey: ["/api/auth/accounts"],
    retry: false,
    enabled: !!user,
  });
  
  const accounts = accountData?.accounts || [];
  const currentAccountId = accountData?.currentAccountId;

  // Fetch CSRF token
  const { data: csrfData } = useQuery<CsrfResponse>({
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
        description: "Successfully switched to the selected account",
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
        window.location.href = "/api/login";
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
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to logout current account",
        variant: "destructive",
      });
    },
  });

  const handleFullLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleAddAccount = () => {
    window.location.href = "/api/login?mode=add";
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

  if (!user) {
    return null;
  }

  const currentAccount = accounts.find((acc: SessionAccount) => acc.id === currentAccountId);
  const otherAccounts = accounts.filter((acc: SessionAccount) => acc.id !== currentAccountId);
  const hasMultipleAccounts = accounts.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="bg-white bg-opacity-10 hover:bg-opacity-20 transition-colors duration-200 rounded-lg
                     text-white border border-white border-opacity-20 hover:border-opacity-30
                     px-3 py-2 h-auto min-w-0 
                     /* Mobile optimization */
                     text-small lg:text-medium
                     /* Prevent text overflow */
                     max-w-[120px] lg:max-w-[160px]"
          data-testid="account-switcher-trigger"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <Users className="h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <Badge 
                variant={getRoleBadgeVariant(user.role || 'student')} 
                className="text-xs px-1.5 py-0.5 font-medium truncate"
              >
                {user.role || 'student'}
              </Badge>
              {hasMultipleAccounts && (
                <span className="text-xs opacity-70 ml-1">({accounts.length})</span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 opacity-70 flex-shrink-0" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg p-1"
        data-testid="account-switcher-menu"
      >
        {/* Current account info */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user.firstName?.charAt(0) || (user.email?.[0] || '').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Current Account
              </p>
            </div>
            <Badge 
              variant={getRoleBadgeVariant(user.role || 'student')} 
              className="text-xs"
            >
              {user.role || 'student'}
            </Badge>
          </div>
        </div>

        {/* Other accounts */}
        {otherAccounts.length > 0 && (
          <>
            <div className="px-3 py-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Switch Account
              </p>
            </div>
            {otherAccounts.map((account: SessionAccount) => (
              <DropdownMenuItem
                key={account.id}
                onClick={() => switchAccountMutation.mutate(account.id)}
                className="cursor-pointer px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md mx-1"
                data-testid={`switch-account-${account.id}`}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {account.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {account.email}
                    </p>
                  </div>
                  <Badge 
                    variant={getRoleBadgeVariant(account.role)} 
                    className="text-xs"
                  >
                    {account.role}
                  </Badge>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="my-1" />
          </>
        )}

        {/* Add another account */}
        <DropdownMenuItem 
          onClick={handleAddAccount}
          className="cursor-pointer px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md mx-1" 
          data-testid="add-account"
        >
          <Plus className="h-4 w-4 mr-3" />
          Sign in with another account
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        {/* Logout options */}
        {hasMultipleAccounts && (
          <DropdownMenuItem 
            onClick={() => logoutCurrentMutation.mutate()}
            className="cursor-pointer px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md mx-1 text-orange-600 dark:text-orange-400" 
            data-testid="logout-current"
          >
            <UserCheck className="h-4 w-4 mr-3" />
            Logout current account
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={handleFullLogout}
          className="cursor-pointer px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md mx-1 text-red-600 dark:text-red-400" 
          data-testid="logout-full"
        >
          <LogOut className="h-4 w-4 mr-3" />
          {hasMultipleAccounts ? "Logout all accounts" : "Logout"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}