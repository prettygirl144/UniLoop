import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Heart, Share, CalendarPlus, Users } from 'lucide-react';
import { Link } from 'wouter';
import type { Announcement } from '@shared/schema';

export default function Home() {
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements'],
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-large text-primary">5</p>
                <p className="text-xs text-text-secondary">New Events</p>
              </div>
              <Calendar className="text-medium text-primary opacity-60" size={20} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-large text-secondary">
                  {announcements?.length || 0}
                </p>
                <p className="text-xs text-text-secondary">Announcements</p>
              </div>
              <MessageSquare className="text-medium text-secondary opacity-60" size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Announcements */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-medium">Latest Updates</h3>
          <Link href="/announcements">
            <Button variant="ghost" size="sm" className="text-primary">
              See All
            </Button>
          </Link>
        </div>
        
        {announcements?.slice(0, 3).map((announcement) => (
          <Card key={announcement.id} className="shadow-sm border-gray-100">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs px-2 py-1 ${
                        announcement.tag === 'Event' 
                          ? 'bg-accent bg-opacity-10 text-accent' 
                          : announcement.tag === 'Academic'
                          ? 'bg-primary bg-opacity-10 text-primary'
                          : 'bg-secondary bg-opacity-10 text-secondary'
                      }`}
                    >
                      {announcement.tag}
                    </Badge>
                    <span className="text-xs text-text-secondary">
                      {new Date(announcement.createdAt!).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <h4 className="text-small mb-1">{announcement.title}</h4>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {announcement.description}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-primary ml-3 p-1">
                  <Heart size={14} />
                </Button>
              </div>
              
              {announcement.rsvpEnabled && (
                <div className="flex items-center space-x-4 pt-2 border-t border-gray-100">
                  <Button variant="ghost" size="sm" className="flex items-center space-x-1 text-xs text-text-secondary p-0 h-auto">
                    <CalendarPlus size={12} />
                    <span>RSVP</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-1 text-xs text-text-secondary p-0 h-auto">
                    <Share size={12} />
                    <span>Share</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming Events Preview */}
      <div className="space-y-3">
        <h3 className="text-medium">This Week's Events</h3>
        
        <div className="bg-gradient-to-r from-secondary to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-small mb-1">Guest Lecture: AI in Healthcare</h4>
              <p className="text-xs opacity-90">Tomorrow, 2:00 PM • Auditorium</p>
              <div className="flex items-center space-x-1 mt-2">
                <i className="fas fa-users text-xs"></i>
                <span className="text-xs">45 attending</span>
              </div>
            </div>
            <i className="fas fa-chalkboard-teacher text-large opacity-70"></i>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/forum">
          <Card className="shadow-sm border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
            <CardContent className="p-4 text-center space-y-2">
              <MessageSquare className="text-medium text-primary mx-auto" size={24} />
              <p className="text-small">Community</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/directory">
          <Card className="shadow-sm border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
            <CardContent className="p-4 text-center space-y-2">
              <Users className="h-6 w-6 text-secondary mx-auto" />
              <p className="text-small">Directory</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
