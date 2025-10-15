import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Settings, X, Check, Trash2, Filter, Search, Clock, AlertCircle, Info, Calendar, MessageSquare, Home, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

interface SmartNotification {
  id: number;
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  scheduledFor?: string;
  deliveryChannels: string[];
  contextualData?: any;
  metadata?: any;
}

interface NotificationPreferences {
  id: number;
  userId: string;
  globalSettings: {
    enabled: boolean;
    quietHours: { start: string; end: string };
    maxDailyNotifications: number;
    batchDelay: number;
  };
  categoryPreferences: {
    [key: string]: {
      enabled: boolean;
      priority: string;
      channels: string[];
    };
  };
  contextualRules: {
    academicHours: boolean;
    locationBased: boolean;
    roleSpecific: boolean;
    eventProximity: boolean;
    engagementBased: boolean;
  };
}

const categoryIcons = {
  announcement: <AlertCircle className="w-4 h-4" />,
  event: <Calendar className="w-4 h-4" />,
  calendar: <Clock className="w-4 h-4" />,
  forum: <MessageSquare className="w-4 h-4" />,
  amenities: <Home className="w-4 h-4" />,
  system: <Shield className="w-4 h-4" />
};

const priorityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500'
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications (will be updated via WebSocket)
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications'],
  });

  // Fetch unread count (will be updated via WebSocket)
  const { data: unreadData } = useQuery({
    queryKey: ['/api/notifications/unread'],
  });

  // Fetch preferences
  const { data: preferences } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/preferences'],
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, { 
        method: 'PATCH',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
    },
  });

  // Dismiss notification mutation
  const dismissMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/dismiss`, { 
        method: 'PATCH',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to dismiss notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
      toast({ title: "Notification dismissed" });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      const response = await fetch('/api/notifications/preferences', { 
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
      toast({ title: "Preferences updated successfully" });
    },
  });

  // Filter notifications based on current filter and search
  const filteredNotifications = (notifications as SmartNotification[]).filter((notification: SmartNotification) => {
    const matchesFilter = filter === 'all' || 
      (filter === 'unread' && !notification.isRead) ||
      (filter === 'important' && (notification.priority === 'critical' || notification.priority === 'high')) ||
      notification.category === filter;

    const matchesSearch = searchQuery === '' || 
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.content.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch && !notification.isDismissed;
  });

  const handleMarkAsRead = (notificationId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    markAsReadMutation.mutate(notificationId);
  };

  const handleDismiss = (notificationId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    dismissMutation.mutate(notificationId);
  };

  const unreadCount = (unreadData as any)?.count || 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl w-full h-[80vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} unread</Badge>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-notification-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={showSettings ? "settings" : "notifications"} className="h-full flex flex-col">
            <TabsList className="mx-6 grid w-auto grid-cols-2">
              <TabsTrigger 
                value="notifications" 
                onClick={() => setShowSettings(false)}
                data-testid="tab-notifications"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                onClick={() => setShowSettings(true)}
                data-testid="tab-settings"
              >
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications" className="flex-1 overflow-hidden mt-0">
              <div className="p-6 pt-4 space-y-4">

                {/* Notifications List */}
                <ScrollArea className="h-[50vh]">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No notifications found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredNotifications.map((notification: SmartNotification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onMarkAsRead={handleMarkAsRead}
                          onDismiss={handleDismiss}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <NotificationSettings 
                  preferences={preferences}
                  onUpdate={(data) => updatePreferencesMutation.mutate(data)}
                  isLoading={updatePreferencesMutation.isPending}
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotificationItem({ 
  notification, 
  onMarkAsRead, 
  onDismiss 
}: { 
  notification: SmartNotification;
  onMarkAsRead: (id: number, event: React.MouseEvent) => void;
  onDismiss: (id: number, event: React.MouseEvent) => void;
}) {
  const priorityColor = priorityColors[notification.priority as keyof typeof priorityColors];
  const categoryIcon = categoryIcons[notification.category as keyof typeof categoryIcons];

  return (
    <Card 
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
        !notification.isRead ? 'border-l-4 border-l-primary bg-muted/20' : ''
      }`}
      data-testid={`notification-item-${notification.id}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className={`w-3 h-3 rounded-full ${priorityColor}`} />
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header with title and actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="flex-shrink-0 mt-0.5">
                  {categoryIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm leading-tight break-words pr-1">
                    {notification.title}
                  </h4>
                  {notification.priority === 'critical' && (
                    <Badge variant="destructive" className="text-xs mt-1">Urgent</Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => onMarkAsRead(notification.id, e)}
                    data-testid={`button-mark-read-${notification.id}`}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={(e) => onDismiss(notification.id, e)}
                  data-testid={`button-dismiss-${notification.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {/* Content */}
            <p className="text-sm text-muted-foreground leading-relaxed break-words line-clamp-3">
              {notification.content}
            </p>
            
            {/* Footer - stack on mobile, inline on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-xs text-muted-foreground">
              <span className="flex-shrink-0">
                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {notification.deliveryChannels.map(channel => (
                  <Badge key={channel} variant="outline" className="text-xs flex-shrink-0">
                    {channel === 'in_app' ? 'In-App' : 
                     channel === 'push' ? 'Push' : 
                     channel}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettings({ 
  preferences, 
  onUpdate, 
  isLoading 
}: { 
  preferences?: NotificationPreferences;
  onUpdate: (data: Partial<NotificationPreferences>) => void;
  isLoading: boolean;
}) {
  const [localPrefs, setLocalPrefs] = useState(preferences);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  if (!localPrefs) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading preferences...</p>
      </div>
    );
  }

  const updateGlobalSetting = (key: string, value: any) => {
    const updated = {
      ...localPrefs,
      globalSettings: {
        ...localPrefs.globalSettings,
        [key]: value
      }
    };
    setLocalPrefs(updated);
    onUpdate(updated);
  };

  const updateCategorySetting = (category: string, key: string, value: any) => {
    const updated = {
      ...localPrefs,
      categoryPreferences: {
        ...localPrefs.categoryPreferences,
        [category]: {
          ...localPrefs.categoryPreferences[category],
          [key]: value
        }
      }
    };
    setLocalPrefs(updated);
    onUpdate(updated);
  };

  const updateContextualRule = (rule: string, value: boolean) => {
    const updated = {
      ...localPrefs,
      contextualRules: {
        ...localPrefs.contextualRules,
        [rule]: value
      }
    };
    setLocalPrefs(updated);
    onUpdate(updated);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable notifications</Label>
            <Switch
              id="enabled"
              checked={localPrefs.globalSettings.enabled}
              onCheckedChange={(checked) => updateGlobalSetting('enabled', checked)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Quiet hours</Label>
            <div className="flex gap-2">
              <Input
                type="time"
                value={localPrefs.globalSettings.quietHours.start}
                onChange={(e) => updateGlobalSetting('quietHours', {
                  ...localPrefs.globalSettings.quietHours,
                  start: e.target.value
                })}
                className="flex-1"
                disabled={isLoading}
              />
              <span className="text-muted-foreground self-center">to</span>
              <Input
                type="time"
                value={localPrefs.globalSettings.quietHours.end}
                onChange={(e) => updateGlobalSetting('quietHours', {
                  ...localPrefs.globalSettings.quietHours,
                  end: e.target.value
                })}
                className="flex-1"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maxDaily">Max daily notifications</Label>
            <Input
              id="maxDaily"
              type="number"
              min="1"
              max="100"
              value={localPrefs.globalSettings.maxDailyNotifications}
              onChange={(e) => updateGlobalSetting('maxDailyNotifications', parseInt(e.target.value))}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="batchDelay">Batch delay (minutes)</Label>
            <Input
              id="batchDelay"
              type="number"
              min="0"
              max="60"
              value={localPrefs.globalSettings.batchDelay}
              onChange={(e) => updateGlobalSetting('batchDelay', parseInt(e.target.value))}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Category Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(localPrefs.categoryPreferences).map(([category, prefs]) => (
            <div key={category} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {categoryIcons[category as keyof typeof categoryIcons]}
                  <h4 className="font-medium capitalize">{category}</h4>
                </div>
                <Switch
                  checked={prefs.enabled}
                  onCheckedChange={(checked) => updateCategorySetting(category, 'enabled', checked)}
                  disabled={isLoading}
                />
              </div>
              
              {prefs.enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={prefs.priority}
                      onValueChange={(value) => updateCategorySetting(category, 'priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Delivery channels</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Choose how you want to receive these notifications
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {['in_app', 'push', 'email'].map(channel => (
                        <Badge
                          key={channel}
                          variant={prefs.channels.includes(channel) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const newChannels = prefs.channels.includes(channel)
                              ? prefs.channels.filter(c => c !== channel)
                              : [...prefs.channels, channel];
                            updateCategorySetting(category, 'channels', newChannels);
                          }}
                          title={
                            channel === 'in_app' ? 'Show in notification center' :
                            channel === 'push' ? 'Browser push notifications' :
                            'Email notifications'
                          }
                        >
                          {channel === 'in_app' ? 'In-App' : 
                           channel === 'push' ? 'Push' : 
                           'Email'}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <strong>In-App:</strong> Shows in notification center • <strong>Push:</strong> Browser notifications • <strong>Email:</strong> Email alerts
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contextual Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Smart Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Academic hours adjustment</Label>
              <p className="text-sm text-muted-foreground">Reduce notifications during class time</p>
            </div>
            <Switch
              checked={localPrefs.contextualRules.academicHours}
              onCheckedChange={(checked) => updateContextualRule('academicHours', checked)}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Role-specific priority</Label>
              <p className="text-sm text-muted-foreground">Adjust notifications based on your role</p>
            </div>
            <Switch
              checked={localPrefs.contextualRules.roleSpecific}
              onCheckedChange={(checked) => updateContextualRule('roleSpecific', checked)}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Event proximity boost</Label>
              <p className="text-sm text-muted-foreground">Prioritize notifications for nearby events</p>
            </div>
            <Switch
              checked={localPrefs.contextualRules.eventProximity}
              onCheckedChange={(checked) => updateContextualRule('eventProximity', checked)}
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Engagement-based tuning</Label>
              <p className="text-sm text-muted-foreground">Learn from your interaction patterns</p>
            </div>
            <Switch
              checked={localPrefs.contextualRules.engagementBased}
              onCheckedChange={(checked) => updateContextualRule('engagementBased', checked)}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}