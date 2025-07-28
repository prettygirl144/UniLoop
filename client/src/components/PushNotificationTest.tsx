import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Send, TestTube } from 'lucide-react';

export function PushNotificationTest() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [targetValue, setTargetValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and body are required',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const target = {
        type: targetType,
        ...(targetValue && { value: targetValue })
      };

      const result = await apiRequest('POST', '/api/push/send', {
        title,
        body,
        target,
        data: {
          url: '/',
          type: 'admin-test'
        }
      });

      toast({
        title: 'Notification Sent',
        description: `Successfully sent to ${result.success} users (${result.failed} failed)`,
      });

      // Reset form
      setTitle('');
      setBody('');
      setTargetValue('');
    } catch (error: any) {
      toast({
        title: 'Send Failed',
        description: error.message || 'Failed to send notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const result = await apiRequest('POST', '/api/push/test');
      toast({
        title: 'Test Sent',
        description: `Test notification sent successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Push Notification Test</CardTitle>
        <CardDescription>
          Send push notifications to test the system functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Notification title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            placeholder="Notification message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="target">Target Audience</Label>
          <Select value={targetType} onValueChange={setTargetType}>
            <SelectTrigger>
              <SelectValue placeholder="Select target audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="batch">Specific Batch</SelectItem>
              <SelectItem value="section">Specific Section</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(targetType === 'batch' || targetType === 'section') && (
          <div className="space-y-2">
            <Label htmlFor="targetValue">
              {targetType === 'batch' ? 'Batch Name' : 'Section Name'}
            </Label>
            <Input
              id="targetValue"
              placeholder={targetType === 'batch' ? 'e.g., MBA 2024-26' : 'e.g., A'}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSendNotification}
            disabled={isLoading}
            className="flex-1"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Notification
          </Button>
          
          <Button
            onClick={handleTestNotification}
            disabled={isLoading}
            variant="outline"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test to Self
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PushNotificationTest;