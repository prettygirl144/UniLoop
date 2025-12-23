import { Calendar, MessageSquare, Megaphone, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'wouter';
import useTriathlonSnippets from '@/hooks/useTriathlonSnippets';

const TriathlonNews = () => {
  const { snippets, isLoading, error, sources } = useTriathlonSnippets();

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'event':
        return <Calendar className="h-4 w-4" />;
      case 'announcement':
        return <Megaphone className="h-4 w-4" />;
      case 'forum':
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'event':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'announcement':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'forum':
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'event':
        return 'Event';
      case 'announcement':
        return 'Announcement';
      case 'forum':
      default:
        return 'Forum';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isRecent = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
    
    return {
      relative: formatDistanceToNow(date, { addSuffix: true }),
      absolute: format(date, 'dd MMM yyyy'),
      isRecent,
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="p-1 bg-orange-100 rounded">
              <MessageSquare className="h-4 w-4 text-orange-600" />
            </div>
            <span>Triathlon News</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start space-x-3 p-3">
              <div className="h-6 w-16 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="p-1 bg-orange-100 rounded">
              <MessageSquare className="h-4 w-4 text-orange-600" />
            </div>
            <span>Triathlon News</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-6">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-small">Failed to load triathlon updates</p>
            <p className="text-xs text-gray-400 mt-1">Please try refreshing the page</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <div className="p-1 bg-orange-100 dark:bg-orange-900 rounded">
              <MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span>Triathlon News</span>
          </CardTitle>
          {import.meta.env.DEV && (
            <div className="text-xs text-gray-500">
              {sources.events}E + {sources.posts}P
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {snippets.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-small">No recent triathlon updates yet</p>
            <p className="text-xs text-gray-400 mt-1">Check back later for news and events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {snippets.map((snippet) => {
              const dateInfo = formatDate(snippet.date);
              return (
                <Link
                  key={snippet.id}
                  to={snippet.href}
                  className="block"
                  data-testid={`triathlon-news-item-${snippet.id}`}
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group">
                    <Badge
                      variant="secondary"
                      className={`${getSourceColor(snippet.source)} flex items-center space-x-1 px-2 py-1 text-xs font-medium flex-shrink-0`}
                    >
                      {getSourceIcon(snippet.source)}
                      <span>{getSourceLabel(snippet.source)}</span>
                    </Badge>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-small font-medium truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {snippet.title}
                        </h4>
                        <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span className={dateInfo.isRecent ? 'text-green-600 dark:text-green-400' : ''}>
                          {dateInfo.relative}
                        </span>
                        <span>•</span>
                        <span>{dateInfo.absolute}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            <div className="pt-2 text-center">
              <Link
                to="/community"
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                data-testid="triathlon-news-view-all"
              >
                View all community updates
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TriathlonNews;