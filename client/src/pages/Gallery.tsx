import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, MapPin, Users, Search, Image as ImageIcon, Plus, ExternalLink, FolderOpen, Trash2, MoreVertical } from "lucide-react";

interface Event {
  id: number;
  title: string;
  description?: string;
  date: string;
  location: string;
  hostCommittee: string;
  category: string;
  mediaUrls?: string[];
  authorId: string;
}

interface GalleryFolder {
  id: number;
  name: string;
  category: string;
  driveUrl: string;
  description?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
}

const folderFormSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  category: z.string().min(1, "Category is required"),
  driveUrl: z.string().url("Please enter a valid Google Drive URL"),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
});

export default function Gallery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"events" | "folders">("folders");
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<GalleryFolder | null>(null);

  const form = useForm<z.infer<typeof folderFormSchema>>({
    resolver: zodResolver(folderFormSchema),
    defaultValues: {
      name: "",
      category: "Events",
      driveUrl: "",
      description: "",
      isPublic: true,
    },
  });

  // Fetch events with media
  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    retry: false,
  });

  // Fetch gallery folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery<GalleryFolder[]>({
    queryKey: ["/api/gallery/folders"],
    retry: false,
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (values: z.infer<typeof folderFormSchema>) => {
      const response = await apiRequest("POST", "/api/gallery/folders", values);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Gallery folder created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/folders"] });
      form.reset();
      setIsAddFolderOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const response = await apiRequest("DELETE", `/api/gallery/folders/${folderId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Gallery folder deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/folders"] });
      setDeleteConfirmOpen(false);
      setFolderToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete folder",
        variant: "destructive",
      });
    },
  });

  // Function to check if user can delete a folder
  const canDeleteFolder = (folder: GalleryFolder) => {
    if (!user) return false;
    return user.role === 'admin' || folder.createdBy === user.id;
  };

  // Function to handle delete confirmation
  const handleDeleteFolder = (folder: GalleryFolder) => {
    setFolderToDelete(folder);
    setDeleteConfirmOpen(true);
  };

  // Function to confirm deletion
  const confirmDelete = () => {
    if (folderToDelete) {
      deleteFolderMutation.mutate(folderToDelete.id);
    }
  };

  const eventsWithMedia = events.filter((event: Event) => 
    event.mediaUrls && event.mediaUrls.length > 0
  );

  const filteredEvents = eventsWithMedia.filter((event: Event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.hostCommittee.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folders.filter((folder: GalleryFolder) =>
    folder.isPublic && (
      folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      folder.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const canManageFolders = user?.role === 'admin' || user?.permissions?.gallery;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (eventsLoading || foldersLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-sm mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-6 w-6 text-primary" />
              <h1 className="text-large">Gallery</h1>
            </div>
            {canManageFolders && (
              <Dialog open={isAddFolderOpen} onOpenChange={setIsAddFolderOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Folder
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Gallery Folder</DialogTitle>
                    <DialogDescription>
                      Add a Google Drive folder to the gallery
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => createFolderMutation.mutate(values))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Folder Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Tech Fest 2025" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
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
                                <SelectItem value="Events">Events</SelectItem>
                                <SelectItem value="Celebrations">Celebrations</SelectItem>
                                <SelectItem value="Competitions">Competitions</SelectItem>
                                <SelectItem value="Academic">Academic</SelectItem>
                                <SelectItem value="Sports">Sports</SelectItem>
                                <SelectItem value="Cultural">Cultural</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="driveUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Drive URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://drive.google.com/drive/folders/..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Brief description of the folder contents" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddFolderOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createFolderMutation.isPending}>
                          {createFolderMutation.isPending ? "Adding..." : "Add Folder"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "folders" ? "Search folders..." : "Search events..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content based on active tab */}
        {activeTab === "folders" ? (
          /* Google Drive Folders */
          filteredFolders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-medium mb-2">No Folders Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "No folders match your search." : "No gallery folders have been added yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFolders.map((folder: GalleryFolder) => (
                <Card key={folder.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-medium leading-tight mb-2 flex items-center gap-2">
                          <FolderOpen className="h-5 w-5 text-primary" />
                          {folder.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs mb-2">
                          {folder.category}
                        </Badge>
                        {folder.description && (
                          <CardDescription className="mt-2">
                            {folder.description}
                          </CardDescription>
                        )}
                      </div>
                      {canDeleteFolder(folder) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDeleteFolder(folder)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(folder.createdAt).toLocaleDateString()}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(folder.driveUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          /* Events with Media */
          filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-medium mb-2">No Media Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "No events match your search." : "No events have uploaded media yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-4">
            {filteredEvents.map((event: Event) => (
              <Card key={event.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-medium leading-tight mb-2">
                        {event.title}
                      </CardTitle>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(event.date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{event.hostCommittee}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {event.category}
                    </Badge>
                  </div>
                  {event.description && (
                    <CardDescription className="mt-2">
                      {event.description}
                    </CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Media Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-small">Media ({event.mediaUrls?.length})</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {event.mediaUrls?.map((url, index) => (
                        <div key={index} className="relative aspect-square">
                          <img
                            src={url}
                            alt={`${event.title} - Photo ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg border"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="100" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="14" fill="%236b7280">Media ${index + 1}</text></svg>`;
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity rounded-lg cursor-pointer"
                               onClick={() => window.open(url, '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gallery Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{folderToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteFolderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}