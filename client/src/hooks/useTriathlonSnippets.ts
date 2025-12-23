import { useQuery } from '@tanstack/react-query';

interface TriathlonSnippet {
  id: string;
  title: string;
  date: string;
  source: 'event' | 'forum' | 'announcement';
  href: string;
}

interface RawEvent {
  id: number;
  title: string;
  date: string;
  startTime?: string;
  createdAt?: string;
  category?: string;
  hostCommittee?: string;
}

interface RawPost {
  id: number;
  title: string;
  createdAt: string;
  category?: string;
  source?: 'forum' | 'announcement';
}

const useTriathlonSnippets = () => {
  const { data: eventsData, isLoading: eventsLoading, error: eventsError } = useQuery<RawEvent[]>({
    queryKey: ['triathlon', 'events'],
    queryFn: async () => {
      console.log(`🔍 [TRIATHLON-SNIPPETS] Fetching triathlon events...`);
      
      const response = await fetch('/api/events?tag=triathlon&limit=5', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [TRIATHLON-SNIPPETS] Events error:`, errorText);
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ [TRIATHLON-SNIPPETS] Events received:`, data.length, 'events');
      return data;
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchOnWindowFocus: false,
  });

  const { data: postsData, isLoading: postsLoading, error: postsError } = useQuery<RawPost[]>({
    queryKey: ['triathlon', 'posts'],
    queryFn: async () => {
      console.log(`🔍 [TRIATHLON-SNIPPETS] Fetching triathlon forum posts...`);
      
      const response = await fetch('/api/community/posts?tag=triathlon&limit=5&scope=all', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [TRIATHLON-SNIPPETS] Posts error:`, errorText);
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ [TRIATHLON-SNIPPETS] Posts received:`, data.length, 'posts/announcements');
      return data;
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchOnWindowFocus: false,
  });

  // Transform and combine data
  const snippets: TriathlonSnippet[] = [];
  
  // Transform events
  if (eventsData) {
    eventsData.forEach(event => {
      snippets.push({
        id: `event-${event.id}`,
        title: event.title,
        date: event.date || event.createdAt || new Date().toISOString(),
        source: 'event',
        href: `/events/${event.id}`,
      });
    });
  }
  
  // Transform forum posts and announcements
  if (postsData) {
    postsData.forEach(post => {
      snippets.push({
        id: `${post.source || 'forum'}-${post.id}`,
        title: post.title,
        date: post.createdAt,
        source: post.source || 'forum',
        href: post.source === 'announcement' ? `/community?tab=announcements&highlight=${post.id}` : `/community?tab=posts&highlight=${post.id}`,
      });
    });
  }
  
  // Sort by date (newest first) and limit to 5
  const sortedSnippets = snippets
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  
  console.log(`🔄 [TRIATHLON-SNIPPETS] Combined snippets:`, sortedSnippets.length, 'from', (eventsData?.length || 0), 'events +', (postsData?.length || 0), 'posts');

  return {
    snippets: sortedSnippets,
    isLoading: eventsLoading || postsLoading,
    error: eventsError || postsError,
    sources: {
      events: eventsData?.length || 0,
      posts: postsData?.length || 0,
    },
  };
};

export default useTriathlonSnippets;