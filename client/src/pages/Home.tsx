import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Heart, Share, CalendarPlus } from 'lucide-react';
import type { Announcement } from '@shared/schema';

export default function Home() {
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements'],
  });

  if (isLoading) {
    return (
      <div className="content-spacing">
        <div className="grid-tablet gap-md">
          <div className="card-elevated p-md animate-pulse">
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
          <div className="card-elevated p-md animate-pulse">
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-spacing">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-primary to-accent rounded-xl p-lg text-primary-foreground section-spacing">
        <h2 className="text-heading mb-2">Welcome back!</h2>
        <p className="text-body opacity-90">Ready to explore campus life?</p>
      </div>

      {/* Quick Stats */}
      <div className="grid-tablet gap-md section-spacing">
        <div className="card-interactive p-md">
          <div className="flex-between">
            <div>
              <p className="text-lg font-bold text-primary">5</p>
              <p className="text-caption">New Events</p>
            </div>
            <Calendar className="h-6 w-6 text-primary opacity-60" />
          </div>
        </div>
        
        <div className="card-interactive p-md">
          <div className="flex-between">
            <div>
              <p className="text-lg font-bold text-accent">
                {announcements?.length || 0}
              </p>
              <p className="text-caption">Announcements</p>
            </div>
            <MessageSquare className="h-6 w-6 text-accent opacity-60" />
          </div>
        </div>
      </div>

      {/* Recent Announcements */}
      <div className="content-spacing section-spacing">
        <div className="flex-between">
          <h3 className="text-heading">Latest Updates</h3>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
            See All
          </Button>
        </div>
        
        <div className="mobile-flex">
          {announcements?.slice(0, 3).map((announcement) => (
            <div key={announcement.id} className="card-interactive p-md">
              <div className="flex-between mb-3">
                <div>
                  <h4 className="text-body font-medium line-clamp-1">
                    {announcement.title}
                  </h4>
                  <p className="text-caption mt-1">
                    {new Date(announcement.createdAt || '').toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-primary text-primary-foreground text-sm">
                  New
                </Badge>
              </div>
              
              <p className="text-body text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                {announcement.description || announcement.content}
              </p>
              
              <div className="flex-between">
                <div className="flex items-center gap-lg text-muted-foreground">
                  <button className="flex items-center gap-xs text-caption transition-smooth hover:text-accent">
                    <Heart className="h-4 w-4" />
                    <span>12</span>
                  </button>
                  <button className="flex items-center gap-xs text-caption transition-smooth hover:text-primary">
                    <Share className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>
                <Button variant="ghost" size="sm" className="text-primary text-caption">
                  Read More
                </Button>
              </div>
            </div>
          ))}
          
          {/* Empty State */}
          {!announcements || announcements.length === 0 ? (
            <div className="card-elevated p-xl text-center">
              <CalendarPlus className="mx-auto h-12 w-12 text-muted-foreground mb-md" />
              <p className="text-body text-muted-foreground">No announcements yet</p>
              <p className="text-caption text-muted-foreground">Check back later for updates</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid-tablet gap-md section-spacing">
        <Button className="btn-primary rounded-xl p-lg h-auto">
          <div className="text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2" />
            <p className="text-body font-medium">View Calendar</p>
          </div>
        </Button>
        
        <Button variant="secondary" className="btn-secondary rounded-xl p-lg h-auto">
          <div className="text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" />
            <p className="text-body font-medium">Browse Forum</p>
          </div>
        </Button>
      </div>
    </div>
  );
}