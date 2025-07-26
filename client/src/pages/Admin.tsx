import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuthContext } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Settings, Shield, Search, Upload, Database, FileText, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: string;
  permissions: {
    calendar?: boolean;
    attendance?: boolean;
    gallery?: boolean;
    forumMod?: boolean;
    diningHostel?: boolean;
    postCreation?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface StudentDirectory {
  id: number;
  email: string;
  batch: string;
  section: string;
  rollNumber?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface StudentUploadLog {
  id: number;
  adminUserId: string;
  batchName: string;
  fileName: string;
  sheetsProcessed: number;
  studentsProcessed: number;
  sectionsCreated: string[];
  uploadTimestamp: string;
}

export default function Admin() {
  const { user: currentUser, isAuthenticated, isLoading } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [editForm, setEditForm] = useState({
    role: "",
    permissions: {
      calendar: false,
      attendance: false,
      gallery: false,
      forumMod: false,
      diningHostel: false,
      postCreation: false,
    }
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || currentUser?.role !== 'admin')) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 1000);
      return;
    }
  }, [isAuthenticated, isLoading, currentUser, toast]);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
    enabled: isAuthenticated && currentUser?.role === 'admin',
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: { userId: string; role: string; permissions: any }) => {
      return await apiRequest("PUT", `/api/admin/users/${userData.userId}`, {
        role: userData.role,
        permissions: userData.permissions
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Fetch student directory
  const { data: students = [], isLoading: studentsLoading } = useQuery<StudentDirectory[]>({
    queryKey: ["/api/admin/students"],
    retry: false,
    enabled: isAuthenticated && currentUser?.role === 'admin',
  });

  // Fetch upload logs
  const { data: uploadLogs = [], isLoading: logsLoading } = useQuery<StudentUploadLog[]>({
    queryKey: ["/api/admin/student-uploads"],
    retry: false,
    enabled: isAuthenticated && currentUser?.role === 'admin',
  });

  // Get unique batches and sections for filter options
  const uniqueBatches = Array.from(new Set(students.map(s => s.batch))).sort();
  
  // Get sections filtered by selected batch (similar to event creation logic)
  const getFilteredSections = () => {
    if (selectedBatch === "all") {
      return Array.from(new Set(students.map(s => s.section))).sort();
    }
    return Array.from(new Set(students
      .filter(s => s.batch === selectedBatch)
      .map(s => s.section)
    )).sort();
  };
  const filteredSections = getFilteredSections();

  // Filter students based on search term and filters
  const filteredStudents = students.filter((student: StudentDirectory) => {
    const searchText = studentSearchTerm.toLowerCase();
    const email = student.email?.toLowerCase() || '';
    const rollNumber = student.rollNumber?.toLowerCase() || '';
    const batch = student.batch?.toLowerCase() || '';
    const section = student.section?.toLowerCase() || '';
    
    // Search filter
    const matchesSearch = !studentSearchTerm || 
      email.includes(searchText) || 
      rollNumber.includes(searchText) ||
      batch.includes(searchText) ||
      section.includes(searchText);
    
    // Batch filter
    const matchesBatch = selectedBatch === "all" || student.batch === selectedBatch;
    
    // Section filter
    const matchesSection = selectedSection === "all" || student.section === selectedSection;
    
    return matchesSearch && matchesBatch && matchesSection;
  });

  // Student upload mutation
  const uploadStudentsMutation = useMutation({
    mutationFn: async ({ file, batchName }: { file: File; batchName: string }) => {
      const formData = new FormData();
      formData.append('studentsFile', file);
      formData.append('batchName', batchName);
      
      const response = await fetch('/api/admin/upload-students', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        // Handle roll number conflicts specially
        if (errorData.conflicts && errorData.conflicts.length > 0) {
          const conflictError = new Error(errorData.message || 'Upload failed');
          (conflictError as any).conflicts = errorData.conflicts;
          (conflictError as any).conflictDetails = errorData.conflictDetails;
          throw conflictError;
        }
        throw new Error(errorData.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Processed ${data.studentsProcessed} students from batch "${data.batchName}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/student-uploads"] });
      setSelectedFile(null);
      setBatchName("");
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Handle roll number conflicts specially
      if (error.conflicts && error.conflictDetails) {
        const conflictList = error.conflictDetails.slice(0, 3).join('\n');
        const moreConflicts = error.conflicts.length > 3 ? `\n... and ${error.conflicts.length - 3} more conflicts` : '';
        
        toast({
          title: "Roll Number Conflicts Detected",
          description: `Cannot upload due to roll number conflicts:\n${conflictList}${moreConflicts}`,
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleStudentUpload = () => {
    if (!selectedFile || !batchName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a file and enter a batch name",
        variant: "destructive",
      });
      return;
    }

    uploadStudentsMutation.mutate({
      file: selectedFile,
      batchName: batchName.trim(),
    });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      permissions: {
        calendar: user.permissions?.calendar || false,
        attendance: user.permissions?.attendance || false,
        gallery: user.permissions?.gallery || false,
        forumMod: user.permissions?.forumMod || false,
        diningHostel: user.permissions?.diningHostel || false,
        postCreation: user.permissions?.postCreation || false,
      }
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      userId: selectedUser.id,
      role: editForm.role,
      permissions: editForm.permissions
    });
  };

  const handleDeleteUser = (userId: string, userEmail: string) => {
    if (confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    
    updateUserMutation.mutate({
      userId: selectedUser.id,
      role: editForm.role,
      permissions: editForm.permissions
    });
  };

  const handleRoleChange = (role: string) => {
    // Set default permissions based on role
    let defaultPermissions = {
      calendar: false,
      attendance: false,
      gallery: false,
      forumMod: false,
      diningHostel: false,
      postCreation: false,
    };

    if (role === 'admin') {
      defaultPermissions = {
        calendar: true,
        attendance: true,
        gallery: true,
        forumMod: true,
        diningHostel: true,
        postCreation: true,
      };
    } else if (role === 'committee_club') {
      defaultPermissions = {
        calendar: true,
        attendance: false,
        gallery: true,
        forumMod: true,
        diningHostel: false,
        postCreation: true,
      };
    } else if (role === 'student') {
      // Students start with basic view permissions but can be customized
      defaultPermissions = {
        calendar: false,
        attendance: false,
        gallery: false,
        forumMod: false,
        diningHostel: false,
        postCreation: false,
      };
    }

    setEditForm(prev => ({
      ...prev,
      role,
      permissions: defaultPermissions
    }));
  };

  const filteredUsers = users.filter((user: User) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'committee_club': return 'default';
      case 'student': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              Admin privileges required to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary" />
              <h1 className="text-large">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-primary">
                {users.length} Users
              </Badge>
              <Badge variant="outline" className="text-primary">
                {students.length} Students
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Student Directory
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Upload History
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage user roles and permissions across the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by email or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Calendar</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Gallery</TableHead>
                    <TableHead>Forum Mod</TableHead>
                    <TableHead>Dining/Hostel</TableHead>
                    <TableHead>Post Creation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {user.profileImageUrl && (
                              <img
                                src={user.profileImageUrl}
                                alt="Profile"
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <div className="text-medium">
                                {user.firstName || user.lastName 
                                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                  : 'Unknown'
                                }
                              </div>
                              <div className="text-small text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.calendar ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.attendance ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.gallery ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.forumMod ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.diningHostel ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            {user.permissions?.postCreation ? '✅' : '❌'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditUser(user)}
                              disabled={updateUserMutation.isPending}
                            >
                              Edit
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                disabled={deleteUserMutation.isPending}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Student Directory Tab */}
          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Student Directory
                </CardTitle>
                <CardDescription>
                  Upload an Excel file to add students to the directory
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batchName">Batch Name</Label>
                  <Input
                    id="batchName"
                    placeholder="e.g., 2024 B.Tech CSE"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentsFile">Excel File</Label>
                  <Input
                    id="studentsFile"
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-small text-muted-foreground">
                    Each sheet represents a section. Include emails and optional roll numbers in the cells.
                  </p>
                </div>
                <Button 
                  onClick={handleStudentUpload}
                  disabled={!selectedFile || !batchName.trim() || uploadStudentsMutation.isPending}
                  className="w-full"
                >
                  {uploadStudentsMutation.isPending ? "Uploading..." : "Upload Students"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Student Directory ({filteredStudents.length} of {students.length})
                </CardTitle>
                <CardDescription>
                  All students in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filter Controls */}
                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email, roll number, batch, or section..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-48">
                      <Label htmlFor="batch-filter" className="text-sm mb-2 block">Filter by Batch</Label>
                      <Select 
                        value={selectedBatch} 
                        onValueChange={(value) => {
                          setSelectedBatch(value);
                          // Reset section when batch changes
                          setSelectedSection("all");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Batches" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Batches</SelectItem>
                          {uniqueBatches.map(batch => (
                            <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex-1 min-w-48">
                      <Label htmlFor="section-filter" className="text-sm mb-2 block">Filter by Section</Label>
                      <Select 
                        value={selectedSection} 
                        onValueChange={setSelectedSection}
                        key={selectedBatch} // Reset section when batch changes
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Sections" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {filteredSections.map(section => (
                            <SelectItem key={section} value={section}>
                              {selectedBatch === "all" ? section : section.split("::")[1] || section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {(studentSearchTerm || selectedBatch !== "all" || selectedSection !== "all") && (
                      <div className="flex items-end">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setStudentSearchTerm("");
                            setSelectedBatch("all");
                            setSelectedSection("all");
                          }}
                          className="mb-0"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {studentsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    Loading students...
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students found. Upload an Excel file to add students.
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students match your search criteria. Try adjusting your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Roll Number</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Uploaded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student: StudentDirectory) => (
                          <TableRow key={student.id}>
                            <TableCell className="text-small">{student.email}</TableCell>
                            <TableCell className="text-small text-muted-foreground">
                              {student.rollNumber || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{student.batch}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{student.section}</Badge>
                            </TableCell>
                            <TableCell className="text-small text-muted-foreground">
                              {new Date(student.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Upload History
                </CardTitle>
                <CardDescription>
                  History of student directory uploads
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    Loading upload logs...
                  </div>
                ) : uploadLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No upload history found.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uploadLogs.map((log: StudentUploadLog) => (
                      <Card key={log.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-medium">{log.fileName}</span>
                            </div>
                            <div className="space-y-1 text-small text-muted-foreground">
                              <p>Batch: <span className="text-foreground">{log.batchName}</span></p>
                              <p>Students: <span className="text-foreground">{log.studentsProcessed}</span></p>
                              <p>Sections: <span className="text-foreground">{log.sectionsCreated.join(', ')}</span></p>
                            </div>
                          </div>
                          <div className="text-right text-small text-muted-foreground">
                            {new Date(log.uploadTimestamp).toLocaleString()}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
            <DialogDescription>
              Update role and permissions for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={editForm.role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="committee_club">Committee/Club</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permissions (shown for all roles except admin) */}
            {editForm.role !== 'admin' && (
              <div className="space-y-4">
                <Label>Permissions</Label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="calendar" className="text-sm">Calendar Access</Label>
                    <Switch
                      id="calendar"
                      checked={editForm.permissions.calendar}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, calendar: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="attendance" className="text-sm">Attendance Access</Label>
                    <Switch
                      id="attendance"
                      checked={editForm.permissions.attendance}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, attendance: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gallery" className="text-sm">Gallery Access</Label>
                    <Switch
                      id="gallery"
                      checked={editForm.permissions.gallery}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, gallery: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="forumMod" className="text-sm">Forum Moderation</Label>
                    <Switch
                      id="forumMod"
                      checked={editForm.permissions.forumMod}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, forumMod: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="diningHostel" className="text-sm">Dining & Hostel</Label>
                    <Switch
                      id="diningHostel"
                      checked={editForm.permissions.diningHostel}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, diningHostel: checked }
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="postCreation" className="text-sm">Post Creation</Label>
                    <Switch
                      id="postCreation"
                      checked={editForm.permissions.postCreation}
                      onCheckedChange={(checked) => 
                        setEditForm(prev => ({ 
                          ...prev, 
                          permissions: { ...prev.permissions, postCreation: checked }
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {editForm.role === 'admin' && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Admin role grants full access to all features and overrides individual permissions.
                </p>
              </div>
            )}

            {editForm.role === 'student' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Student role now supports individual permissions that can be customized as needed.
                </p>
              </div>
            )}

            {editForm.role === 'committee_club' && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  Committee/Club role has expanded permissions and access to additional features.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUser}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}