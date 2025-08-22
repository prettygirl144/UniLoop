import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Heart, Share, CalendarPlus, Users, Clock, MapPin, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Trophy, Activity, GraduationCap } from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';
import type { Announcement } from '@shared/schema';

interface DirectoryInfo {
  name: string;
  email: string;
  profileImageUrl?: string;
  rollNumber: string | null;
  batch: string | null;
}
import triathlonLogo from '@assets/TMT2.0_1753605901392.webp';
import triathlonBannerBg from '@assets/triathlon-banner-bg.png';

import Asset_12_3x from "@assets/Asset 12@3x.png";

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  category: string;
  hostCommittee: string;
  isMandatory: boolean;
  targetBatchSections: string[];
  rsvpCount?: number;
}

export default function Home() {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/community/announcements'],
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Query user's directory information
  const { data: directoryInfo, isLoading: directoryLoading } = useQuery<DirectoryInfo>({
    queryKey: ['/api/directory/me'],
  });

  // Filter events for this week
  const getThisWeeksEvents = () => {
    const now = new Date();
    
    // Get start of week (Sunday) at 00:00:00
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get end of week (Saturday) at 23:59:59
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return events.filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Filter upcoming events (today and future)
  const getUpcomingEvents = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now;
    });
  };

  const thisWeeksEvents = getThisWeeksEvents();
  const upcomingEvents = getUpcomingEvents();

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const nextEvent = () => {
    if (thisWeeksEvents.length > 0) {
      setCurrentEventIndex((prev) => (prev + 1) % thisWeeksEvents.length);
    }
  };

  const prevEvent = () => {
    if (thisWeeksEvents.length > 0) {
      setCurrentEventIndex((prev) => (prev - 1 + thisWeeksEvents.length) % thisWeeksEvents.length);
    }
  };

  const getCategoryGradient = (category: string) => {
    switch (category.toLowerCase()) {
      case 'academic':
        return 'from-blue-500 to-blue-700';
      case 'cultural':
        return 'from-purple-500 to-purple-700';
      case 'sports':
        return 'from-green-500 to-green-700';
      case 'technical':
        return 'from-indigo-500 to-indigo-700';
      case 'social':
        return 'from-pink-500 to-pink-700';
      case 'workshop':
        return 'from-orange-500 to-orange-700';
      case 'seminar':
        return 'from-teal-500 to-teal-700';
      case 'competition':
        return 'from-red-500 to-red-700';
      case 'celebration':
        return 'from-yellow-500 to-yellow-700';
      default:
        return 'from-gray-500 to-gray-700';
    }
  };

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
    <div className="min-h-screen 
                    /* Mobile: full width with padding */
                    p-4 space-y-4
                    /* Desktop: more generous spacing */
                    lg:p-6 lg:space-y-6">
      {/* Mobile-optimized welcome header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="font-medium text-gray-900 text-[24px] mt-[3px] mb-[3px]">
          Good day! ✨ Triage v1.0.3
        </h1>
        <p className="text-small text-gray-600">
          Here's what's happening at IIM Ranchi today.
        </p>
      </div>

      {/* User Directory Card */}
      {directoryLoading ? (
        <Card className="mb-6 shadow-sm border-gray-100">
          <CardContent className="p-4">
            <div className="animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : directoryInfo && (
        <Card className="mb-6 shadow-sm border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center text-white">
                {directoryInfo.profileImageUrl ? (
                  <img 
                    src={directoryInfo.profileImageUrl} 
                    alt={directoryInfo.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <GraduationCap className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-medium font-medium text-gray-900 mb-1">
                  {directoryInfo.name}
                </h3>
                <div className="space-y-1 text-small text-gray-600">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Roll:</span> 
                      <span>{directoryInfo.rollNumber || "—"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Batch:</span> 
                      <span>{directoryInfo.batch || "—"}</span>
                    </span>
                  </div>
                  {!directoryInfo.rollNumber && !directoryInfo.batch && (
                    <div className="text-amber-600 text-xs mt-1">
                      Not found in directory. Contact Admin.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Mobile-optimized quick stats */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 mt-[12px] mb-8">
        <Link href="/calendar">
          <Card className="shadow-sm border-gray-100 cursor-pointer 
                           /* Mobile: enhanced touch interaction */
                           hover:shadow-md active:scale-[0.98] transition-all duration-150
                           /* Mobile: rounded corners */
                           rounded-xl">
            <CardContent className="/* Mobile: optimized padding */
                                    p-4 lg:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-large text-primary font-medium">
                    {eventsLoading ? "..." : upcomingEvents.length}
                  </p>
                  <p className="text-small text-gray-600 mt-1">New Events</p>
                </div>
                <Calendar className="text-primary opacity-60 flex-shrink-0" size={20} />
              </div>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/forum?tab=announcements">
          <Card className="shadow-sm border-gray-100 cursor-pointer 
                           hover:shadow-md active:scale-[0.98] transition-all duration-150
                           rounded-xl">
            <CardContent className="p-4 lg:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-large text-primary font-medium">
                    {isLoading ? "..." : (announcements?.length || 0)}
                  </p>
                  <p className="text-small text-gray-600 mt-1">Announcements</p>
                </div>
                <MessageSquare className="text-primary opacity-60 flex-shrink-0" size={20} />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
      {/* Management Triathlon Banner */}
      <Link href="/triathlon">
        <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 active:scale-[0.98] rounded-xl border-0 mt-4">
          <div className="relative p-4 lg:p-6" style={{
            backgroundImage: `url(${triathlonBannerBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}>
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <img 
                    src={Asset_12_3x} 
                    alt="Management Triathlon"
                    className="w-8 h-8 lg:w-10 lg:h-10 object-contain"
                  />
                </div>
                <div>
                  <h3 className="lg:text-large font-bold text-white bg-[#0000002e] pl-[4px] pr-[4px]">
                    Management Triathlon
                  </h3>
                  <p className="text-white/90 mt-1 bg-[#635d4b7d] pl-[5px] pr-[5px] ml-[0px] mr-[0px]">
                    View team rankings and leaderboard
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-2 text-white/80">
                <Trophy className="h-5 w-5" />
                <span className="text-small">View Leaderboard</span>
              </div>
            </div>
          </div>
        </Card>
      </Link>
      {/* This Week's Events Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-medium">This Week's Events</h3>
          {thisWeeksEvents.length > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevEvent}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentEventIndex + 1} / {thisWeeksEvents.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextEvent}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        {eventsLoading ? (
          <div className="bg-muted rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-2/3"></div>
          </div>
        ) : thisWeeksEvents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-small text-muted-foreground">No events scheduled this week</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentEventIndex * 100}%)` }}
            >
              {thisWeeksEvents.map((event, index) => (
                <div key={event.id} className="w-full flex-shrink-0">
                  <div className={`bg-gradient-to-r ${getCategoryGradient(event.category)} rounded-xl p-4 text-white relative overflow-hidden`}>
                    {/* Mandatory/Optional indicator */}
                    <div className="absolute top-2 right-2">
                      {event.isMandatory ? (
                        <div className="flex items-center space-x-1 bg-red-500/30 rounded-full px-2 py-1">
                          <AlertCircle className="h-3 w-3" />
                          <span className="text-xs font-medium">Mandatory</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 bg-white/20 rounded-full px-2 py-1">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs font-medium">Optional</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-start justify-between pr-20">
                      <div className="flex-1">
                        <h4 className="text-small mb-1 font-medium">{event.title}</h4>
                        <div className="space-y-1 text-xs opacity-90">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatEventDate(event.date)}</span>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>{event.startTime}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                            {event.category}
                          </Badge>
                          {event.rsvpCount && (
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span className="text-xs">{event.rsvpCount} attending</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Quick Actions - Always Visible */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Link href="/forum">
          <Card className="shadow-sm border-gray-100 cursor-pointer hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 text-center space-y-2">
              <MessageSquare className="text-medium text-primary mx-auto" size={24} />
              <p className="text-small font-medium">Forum</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/directory">
          <Card className="shadow-sm border-gray-100 cursor-pointer hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 text-center space-y-2">
              <Users className="h-6 w-6 text-secondary mx-auto" />
              <p className="text-small font-medium">Directory</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Verification Section */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-600" />
            <span className="text-small font-medium text-gray-700">System Status</span>
            <Badge variant="outline" className="text-xs">v1.0.2</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setHealthLoading(true);
              console.log("🏥 Running comprehensive health verification...");
              
              try {
                // Test 1: Basic health check
                console.log("🔍 Test 1: Basic database health...");
                const healthResponse = await fetch("/api/health");
                const healthData = await healthResponse.json();
                
                // Test 2: Database write test
                console.log("🔍 Test 2: Database write test...");
                const dbTestResponse = await fetch("/api/db-test", { method: "POST" });
                const dbTestData = await dbTestResponse.json();
                
                // Test 3: Sick food endpoint accessibility (GET)
                console.log("🔍 Test 3: Sick food endpoint accessibility...");
                const sickFoodResponse = await fetch("/api/amenities/sick-food");
                const sickFoodAccessible = sickFoodResponse.status !== 404;
                
                const combinedStatus = {
                  ...healthData,
                  dbWriteTest: dbTestData.ok,
                  sickFoodEndpoint: sickFoodAccessible,
                  allTests: healthData.ok && dbTestData.ok && sickFoodAccessible
                };
                
                setHealthStatus(combinedStatus);
                console.log("✅ Comprehensive health check completed:", combinedStatus);
              } catch (error) {
                console.error("❌ Health check failed:", error);
                setHealthStatus({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
              } finally {
                setHealthLoading(false);
              }
            }}
            disabled={healthLoading}
            data-testid="button-health-check"
          >
            {healthLoading ? "Checking..." : "🧪 Test"}
          </Button>
        </div>
        
        {healthStatus && (
          <div className="p-3 rounded-lg bg-gray-50 text-xs space-y-2">
            <div className="flex items-center gap-2">
              {healthStatus.allTests ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-600" />
              )}
              <span className={healthStatus.allTests ? "text-green-700" : "text-red-700"}>
                Overall: {healthStatus.allTests ? "All Systems Operational" : "Issues Detected"}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className={healthStatus.ok ? "text-green-600" : "text-red-600"}>●</span>
                <span>DB Connect</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={healthStatus.dbWriteTest ? "text-green-600" : "text-red-600"}>●</span>
                <span>DB Write</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={healthStatus.sickFoodEndpoint ? "text-green-600" : "text-red-600"}>●</span>
                <span>Sick Food API</span>
              </div>
            </div>
            
            {healthStatus.requestId && (
              <div className="text-gray-500">
                Request ID: <code className="bg-gray-200 px-1 rounded">{healthStatus.requestId}</code>
              </div>
            )}
            {healthStatus.responseTime && (
              <div className="text-gray-500">Response: {healthStatus.responseTime}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
