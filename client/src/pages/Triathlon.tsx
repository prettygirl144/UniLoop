import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { Trophy, Plus, Edit, History, Medal, Award, Star, Zap, BookOpen, Palette, Target, Trash2, MoreVertical, Upload, X, ImageIcon } from 'lucide-react';
import type { TriathlonTeam, InsertTriathlonTeam } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';

// Form schemas
const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  logoUrl: z.string().optional().or(z.literal('')),
});

const pointsSchema = z.object({
  category: z.enum(['academic', 'cultural', 'sports', 'surprise']),
  pointChange: z.number().int().min(-1000, 'Point change too low').max(1000, 'Point change too high'),
  reason: z.string().optional(),
});

type TeamForm = z.infer<typeof teamSchema>;
type PointsForm = z.infer<typeof pointsSchema>;

interface TeamWithRank extends TriathlonTeam {
  rank: number;
}

export default function Triathlon() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<TeamWithRank | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [showEditPoints, setShowEditPoints] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithRank | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = user && typeof user === 'object' && 'role' in user ? (user as any).role === 'admin' : false;
  const hasTriathlonPermission = user && typeof user === 'object' && 'permissions' in user ? 
    ((user as any).permissions?.triathlon || (user as any).role === 'admin') : false;

  // Fetch teams data
  const { data: teams = [], isLoading } = useQuery<TeamWithRank[]>({
    queryKey: ['/api/triathlon/teams'],
  });

  // Fetch point history for selected team
  const { data: pointHistory = [] } = useQuery({
    queryKey: ['/api/triathlon/history', selectedTeam?.id],
    enabled: !!selectedTeam?.id && showHistory,
  });

  // Team form
  const teamForm = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: '', logoUrl: '' },
  });

  // Points form
  const pointsForm = useForm<PointsForm>({
    resolver: zodResolver(pointsSchema),
    defaultValues: { category: 'academic', pointChange: 0, reason: '' },
  });

  // Image upload function
  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      setUploadedImageUrl(data.url);
      teamForm.setValue('logoUrl', data.url);
      
      toast({
        title: "Image uploaded successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Failed to upload image",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: (data: InsertTriathlonTeam) => apiRequest('POST', '/api/triathlon/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/triathlon/teams'] });
      setShowAddTeam(false);
      teamForm.reset();
      setUploadedImageUrl('');
      toast({ title: "Team created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create team", variant: "destructive" });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: TeamForm }) =>
      apiRequest('PUT', `/api/triathlon/teams/${teamId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/triathlon/teams'] });
      setShowEditTeam(false);
      teamForm.reset();
      toast({ title: "Team updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update team", variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: number) => apiRequest('DELETE', `/api/triathlon/teams/${teamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/triathlon/teams'] });
      setTeamToDelete(null);
      toast({ title: "Team deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete team", variant: "destructive" });
    },
  });

  const updatePointsMutation = useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: PointsForm }) => 
      apiRequest('POST', `/api/triathlon/teams/${teamId}/points`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/triathlon/teams'] });
      queryClient.invalidateQueries({ queryKey: ['/api/triathlon/history', selectedTeam?.id] });
      setShowEditPoints(false);
      pointsForm.reset();
      toast({ title: "Points updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update points", variant: "destructive" });
    },
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic': return <BookOpen className="h-4 w-4" />;
      case 'cultural': return <Palette className="h-4 w-4" />;
      case 'sports': return <Target className="h-4 w-4" />;
      case 'surprise': return <Zap className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'academic': return 'bg-blue-100 text-blue-800';
      case 'cultural': return 'bg-purple-100 text-purple-800';
      case 'sports': return 'bg-green-100 text-green-800';
      case 'surprise': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Award className="h-5 w-5 text-amber-600" />;
      default: return <div className="h-5 w-5 flex items-center justify-center text-small font-medium text-gray-600">#{rank}</div>;
    }
  };

  const onCreateTeam = async (data: TeamForm) => {
    if (!user) return;
    
    const teamData: InsertTriathlonTeam = {
      ...data,
      logoUrl: uploadedImageUrl || data.logoUrl || undefined,
      createdBy: user && typeof user === 'object' && 'id' in user ? user.id as string : '',
    };
    
    createTeamMutation.mutate(teamData);
  };

  const onUpdateTeam = async (data: TeamForm) => {
    if (!selectedTeam) return;
    const updatedData = {
      ...data,
      logoUrl: uploadedImageUrl || data.logoUrl || undefined,
    };
    updateTeamMutation.mutate({ teamId: selectedTeam.id, data: updatedData });
  };

  const onDeleteTeam = () => {
    if (!teamToDelete) return;
    deleteTeamMutation.mutate(teamToDelete.id);
  };

  const handleEditTeam = (team: TeamWithRank) => {
    setSelectedTeam(team);
    teamForm.reset({ name: team.name, logoUrl: team.logoUrl || '' });
    setUploadedImageUrl('');
    setShowEditTeam(true);
  };

  const onUpdatePoints = async (data: PointsForm) => {
    if (!selectedTeam) return;
    updatePointsMutation.mutate({ teamId: selectedTeam.id, data });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Trophy className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-large font-bold">Management Triathlon</h1>
            <p className="text-small text-gray-600">Team Rankings & Leaderboard</p>
          </div>
        </div>
        
        {hasTriathlonPermission && (
          <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
            <DialogTrigger asChild>
              <Button 
                className="w-full sm:w-auto"
                onClick={() => {
                  teamForm.reset({ name: '', logoUrl: '' });
                  setUploadedImageUrl('');
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Team</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
              </DialogHeader>
              <Form {...teamForm}>
                <form onSubmit={teamForm.handleSubmit(onCreateTeam)} className="space-y-4">
                  <FormField
                    control={teamForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter team name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={teamForm.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Logo</FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            {/* Image Preview */}
                            {(uploadedImageUrl || field.value) && (
                              <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
                                <img 
                                  src={uploadedImageUrl || field.value} 
                                  alt="Team logo preview"
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                                <div className="flex-1">
                                  <p className="text-small font-medium">Logo uploaded</p>
                                  <p className="text-xs text-gray-500">Ready to use</p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setUploadedImageUrl('');
                                    field.onChange('');
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            
                            {/* Upload Button or URL Input */}
                            {!(uploadedImageUrl || field.value) && (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <label className="flex-1">
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                                      <div className="space-y-2">
                                        <Upload className="h-6 w-6 text-gray-400 mx-auto" />
                                        <div>
                                          <span className="text-small text-blue-600 hover:text-blue-500">
                                            {isUploading ? 'Uploading...' : 'Click to upload logo'}
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          Images up to 5MB (PNG, JPG, GIF)
                                        </p>
                                      </div>
                                    </div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleImageUpload(file);
                                        }
                                      }}
                                      className="hidden"
                                      disabled={isUploading}
                                    />
                                  </label>
                                </div>
                                <div className="relative">
                                  <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                  </div>
                                  <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-500">Or use URL</span>
                                  </div>
                                </div>
                                <Input 
                                  placeholder="https://example.com/logo.png" 
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(value);
                                    // Clear uploaded image if user starts typing URL
                                    if (value && uploadedImageUrl) {
                                      setUploadedImageUrl('');
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddTeam(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTeamMutation.isPending}
                      className="flex-1"
                    >
                      Create
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Leaderboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {teams.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-medium mb-2">No teams yet</p>
              <p className="text-small">Add teams to start the competition</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 text-small font-medium text-gray-600 min-w-[80px]">Rank</th>
                    <th className="text-left p-4 text-small font-medium text-gray-600 min-w-[200px]">Team</th>
                    <th className="text-center p-4 text-small font-medium text-gray-600 min-w-[100px]">
                      <div className="flex items-center justify-center space-x-1">
                        <BookOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">Academic</span>
                        <span className="sm:hidden">Acad</span>
                      </div>
                    </th>
                    <th className="text-center p-4 text-small font-medium text-gray-600 min-w-[100px]">
                      <div className="flex items-center justify-center space-x-1">
                        <Palette className="h-4 w-4" />
                        <span className="hidden sm:inline">Cultural</span>
                        <span className="sm:hidden">Cult</span>
                      </div>
                    </th>
                    <th className="text-center p-4 text-small font-medium text-gray-600 min-w-[100px]">
                      <div className="flex items-center justify-center space-x-1">
                        <Target className="h-4 w-4" />
                        <span className="hidden sm:inline">Sports</span>
                        <span className="sm:hidden">Sport</span>
                      </div>
                    </th>
                    <th className="text-center p-4 text-small font-medium text-gray-600 min-w-[100px]">
                      <div className="flex items-center justify-center space-x-1">
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline">Surprise</span>
                        <span className="sm:hidden">Surp</span>
                      </div>
                    </th>
                    <th className="text-center p-4 text-small font-medium text-gray-600 min-w-[100px]">Total</th>
                    {hasTriathlonPermission && <th className="text-center p-4 text-small font-medium text-gray-600 min-w-[120px]">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teams.map((team) => (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          {getRankIcon(team.rank)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          {team.logoUrl && (
                            <img 
                              src={team.logoUrl} 
                              alt={`${team.name} logo`}
                              className="h-12 w-12 rounded-full object-cover flex-shrink-0 pl-[0px] pr-[0px]"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-small font-medium truncate">{team.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {team.academicPoints}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                          {team.culturalPoints}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {team.sportsPoints}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          {team.surprisePoints}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="default" className="font-medium">
                          {team.totalPoints}
                        </Badge>
                      </td>
                      {hasTriathlonPermission && (
                        <td className="p-4">
                          <div className="flex justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleEditTeam(team)}
                                  className="flex items-center space-x-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span>Edit Team</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTeam(team);
                                    setShowEditPoints(true);
                                  }}
                                  className="flex items-center space-x-2"
                                >
                                  <Trophy className="h-4 w-4" />
                                  <span>Edit Points</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTeam(team);
                                    setShowHistory(true);
                                  }}
                                  className="flex items-center space-x-2"
                                >
                                  <History className="h-4 w-4" />
                                  <span>View History</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setTeamToDelete(team)}
                                  className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete Team</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Edit Points Dialog */}
      {hasTriathlonPermission && (
        <Dialog open={showEditPoints} onOpenChange={setShowEditPoints}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Edit Points - {selectedTeam?.name}
              </DialogTitle>
            </DialogHeader>
            <Form {...pointsForm}>
              <form onSubmit={pointsForm.handleSubmit(onUpdatePoints)} className="space-y-4">
                <FormField
                  control={pointsForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="academic">
                            <div className="flex items-center space-x-2">
                              <BookOpen className="h-4 w-4" />
                              <span>Academic</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="cultural">
                            <div className="flex items-center space-x-2">
                              <Palette className="h-4 w-4" />
                              <span>Cultural</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="sports">
                            <div className="flex items-center space-x-2">
                              <Target className="h-4 w-4" />
                              <span>Sports</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="surprise">
                            <div className="flex items-center space-x-2">
                              <Zap className="h-4 w-4" />
                              <span>Surprise</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pointsForm.control}
                  name="pointChange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Point Change</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter points (+ or -)"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pointsForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Why are you changing these points?"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditPoints(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updatePointsMutation.isPending}
                    className="flex-1"
                  >
                    Update
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
      {/* History Dialog */}
      {hasTriathlonPermission && (
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Point History - {selectedTeam?.name}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-96">
              {Array.isArray(pointHistory) && pointHistory.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-small">No point changes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(pointHistory) && pointHistory.map((entry: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(entry.category)}
                          <Badge variant="secondary" className={getCategoryColor(entry.category)}>
                            {entry.category}
                          </Badge>
                        </div>
                        <div className="text-small text-gray-500">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-small">
                          {entry.previousPoints} → {entry.newPoints}
                        </span>
                        <span className={`text-small font-medium ${
                          entry.pointChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {entry.pointChange > 0 ? '+' : ''}{entry.pointChange}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="text-xs text-gray-600 mt-1">{entry.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
      {/* Edit Team Dialog */}
      {hasTriathlonPermission && (
        <Dialog open={showEditTeam} onOpenChange={setShowEditTeam}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Team - {selectedTeam?.name}</DialogTitle>
            </DialogHeader>
            <Form {...teamForm}>
              <form onSubmit={teamForm.handleSubmit(onUpdateTeam)} className="space-y-4">
                <FormField
                  control={teamForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter team name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={teamForm.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Logo</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          {/* Image Preview */}
                          {(uploadedImageUrl || field.value) && (
                            <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
                              <img 
                                src={uploadedImageUrl || field.value} 
                                alt="Team logo preview"
                                className="h-12 w-12 rounded-full object-cover"
                              />
                              <div className="flex-1">
                                <p className="text-small font-medium">Logo uploaded</p>
                                <p className="text-xs text-gray-500">Ready to use</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setUploadedImageUrl('');
                                  field.onChange('');
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          
                          {/* Upload Button or URL Input */}
                          {!(uploadedImageUrl || field.value) && (
                            <div className="space-y-3">
                              <div className="flex items-center space-x-2">
                                <label className="flex-1">
                                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                                    <div className="space-y-2">
                                      <Upload className="h-6 w-6 text-gray-400 mx-auto" />
                                      <div>
                                        <span className="text-small text-blue-600 hover:text-blue-500">
                                          {isUploading ? 'Uploading...' : 'Click to upload logo'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        Images up to 5MB (PNG, JPG, GIF)
                                      </p>
                                    </div>
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleImageUpload(file);
                                      }
                                    }}
                                    className="hidden"
                                    disabled={isUploading}
                                  />
                                </label>
                              </div>
                              <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                  <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                  <span className="bg-white px-2 text-gray-500">Or use URL</span>
                                </div>
                              </div>
                              <Input 
                                placeholder="https://example.com/logo.png" 
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value);
                                  // Clear uploaded image if user starts typing URL
                                  if (value && uploadedImageUrl) {
                                    setUploadedImageUrl('');
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditTeam(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateTeamMutation.isPending}
                    className="flex-1"
                  >
                    Update
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
      {/* Delete Team Confirmation Dialog */}
      <AlertDialog open={!!teamToDelete} onOpenChange={() => setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{teamToDelete?.name}"? This action cannot be undone and will also delete all point history for this team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteTeam}
              disabled={deleteTeamMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}