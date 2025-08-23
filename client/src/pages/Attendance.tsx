import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  UserCheck, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  RefreshCw,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type AttendanceStatus = 'UNMARKED' | 'PRESENT' | 'ABSENT' | 'LATE';

interface AttendanceRecord {
  id: number;
  studentEmail: string;
  studentName: string;
  rollNumber: string | null;
  status: AttendanceStatus;
  note: string | null;
  markedBy: string | null;
  markedAt: string | null;
}

interface AttendanceSheet {
  id: number;
  eventId: number;
  batch: string;
  section: string;
  createdBy: string;
  createdAt: string;
}

interface AttendanceData {
  sheet: AttendanceSheet;
  records: AttendanceRecord[];
}

export default function Attendance() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('UNMARKED');
  const [editNote, setEditNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL');

  // Fetch attendance data
  const { data: attendanceData, isLoading, error } = useQuery<AttendanceData>({
    queryKey: ['/api/events', eventId, 'attendance'],
    enabled: !!eventId,
  });

  // Update individual record mutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ recordId, status, note }: { recordId: number; status: AttendanceStatus; note?: string }) => {
      return await apiRequest('PUT', `/api/attendance/records/${recordId}`, { status, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'attendance'] });
      setEditingRecord(null);
      toast({ title: 'Attendance updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive',
        title: 'Failed to update attendance',
        description: error.message || 'An error occurred'
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ status }: { status: AttendanceStatus }) => {
      if (!attendanceData?.sheet?.id) throw new Error('No attendance sheet found');
      return await apiRequest('PUT', `/api/attendance/sheets/${attendanceData.sheet.id}/bulk`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'attendance'] });
      toast({ title: 'Bulk attendance update successful' });
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive',
        title: 'Failed to bulk update attendance',
        description: error.message || 'An error occurred'
      });
    },
  });

  // Sync students mutation
  const syncStudentsMutation = useMutation({
    mutationFn: async () => {
      if (!attendanceData?.sheet) throw new Error('No attendance sheet found');
      return await apiRequest('POST', `/api/attendance/sheets/${attendanceData.sheet.id}/sync`, { 
        batch: attendanceData.sheet.batch, 
        section: attendanceData.sheet.section 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'attendance'] });
      toast({ title: 'Student roster synced successfully' });
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive',
        title: 'Failed to sync students',
        description: error.message || 'An error occurred'
      });
    },
  });

  // Handle CSV export
  const handleExport = async () => {
    if (!attendanceData?.sheet?.id) return;
    
    try {
      const response = await fetch(`/api/attendance/sheets/${attendanceData.sheet.id}/export`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `attendance-${attendanceData.sheet.batch}-${attendanceData.sheet.section}-${eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Attendance sheet exported successfully' });
    } catch (error) {
      toast({ 
        variant: 'destructive',
        title: 'Failed to export attendance sheet',
        description: 'An error occurred while exporting'
      });
    }
  };

  const handleEditRecord = (record: AttendanceRecord) => {
    setEditingRecord(record.id);
    setEditStatus(record.status);
    setEditNote(record.note || '');
  };

  const handleSaveRecord = () => {
    if (editingRecord === null) return;
    updateRecordMutation.mutate({
      recordId: editingRecord,
      status: editStatus,
      note: editNote,
    });
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditStatus('UNMARKED');
    setEditNote('');
  };

  // Filter records based on search and status
  const filteredRecords = attendanceData?.records?.filter(record => {
    const matchesSearch = searchTerm === '' || 
      record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.studentEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.rollNumber && record.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Calculate statistics
  const stats = attendanceData?.records?.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {
    UNMARKED: 0,
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0
  } as Record<AttendanceStatus, number>) || {
    UNMARKED: 0,
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0
  };

  const totalStudents = attendanceData?.records?.length || 0;
  const presentCount = stats.PRESENT;
  const absentCount = stats.ABSENT;
  const lateCount = stats.LATE;
  const unmarkedCount = stats.UNMARKED;

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">Present</Badge>;
      case 'ABSENT':
        return <Badge variant="destructive">Absent</Badge>;
      case 'LATE':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Late</Badge>;
      case 'UNMARKED':
        return <Badge variant="outline">Unmarked</Badge>;
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'ABSENT':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'LATE':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'UNMARKED':
        return <UserCheck className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 lg:p-6">
        <div className="text-center py-8 lg:py-12">
          <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm lg:text-base text-muted-foreground mt-4">Loading attendance sheet...</p>
        </div>
      </div>
    );
  }

  if (error || !attendanceData) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 lg:p-6">
        <Card>
          <CardContent className="text-center py-8 lg:py-12">
            <XCircle className="w-8 h-8 lg:w-12 lg:h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-base lg:text-lg font-medium mb-2">No Attendance Sheet Found</h3>
            <p className="text-sm lg:text-base text-muted-foreground mb-4">
              This event doesn't have an attendance sheet or you don't have permission to view it.
            </p>
            <Button onClick={() => setLocation('/calendar')} variant="outline" size="sm" className="w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Calendar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/calendar')}
            className="shrink-0 w-fit"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back to Calendar</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl lg:text-2xl font-bold">Attendance Sheet</h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              {attendanceData.sheet.batch}::{attendanceData.sheet.section}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => syncStudentsMutation.mutate()}
              disabled={syncStudentsMutation.isPending}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncStudentsMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Students</span>
              <span className="sm:hidden">Sync</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        <Card>
          <CardContent className="p-3 lg:p-4 text-center">
            <div className="text-xl lg:text-2xl font-bold">{totalStudents}</div>
            <div className="text-xs lg:text-sm text-muted-foreground">Total Students</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 lg:p-4 text-center">
            <div className="text-xl lg:text-2xl font-bold text-green-600">{presentCount}</div>
            <div className="text-xs lg:text-sm text-muted-foreground">Present</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 lg:p-4 text-center">
            <div className="text-xl lg:text-2xl font-bold text-red-600">{absentCount}</div>
            <div className="text-xs lg:text-sm text-muted-foreground">Absent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 lg:p-4 text-center">
            <div className="text-xl lg:text-2xl font-bold text-yellow-600">{lateCount}</div>
            <div className="text-xs lg:text-sm text-muted-foreground">Late</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 lg:p-4 text-center">
            <div className="text-xl lg:text-2xl font-bold text-gray-600">{unmarkedCount}</div>
            <div className="text-xs lg:text-sm text-muted-foreground">Unmarked</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkUpdateMutation.mutate({ status: 'PRESENT' })}
                disabled={bulkUpdateMutation.isPending}
                className="text-green-700 border-green-300 hover:bg-green-50 w-full"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Mark All Present</span>
                <span className="sm:hidden">All Present</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkUpdateMutation.mutate({ status: 'ABSENT' })}
                disabled={bulkUpdateMutation.isPending}
                className="text-red-700 border-red-300 hover:bg-red-50 w-full"
              >
                <XCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Mark All Absent</span>
                <span className="sm:hidden">All Absent</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkUpdateMutation.mutate({ status: 'UNMARKED' })}
                disabled={bulkUpdateMutation.isPending}
                className="text-gray-700 border-gray-300 hover:bg-gray-50 w-full"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Clear All</span>
                <span className="sm:hidden">Clear</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 lg:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
            <div>
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Select value={statusFilter} onValueChange={(value: AttendanceStatus | 'ALL') => setStatusFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="UNMARKED">Unmarked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base lg:text-lg">
            Student Attendance ({filteredRecords.length} of {totalStudents})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="border rounded-lg p-3 lg:p-4 hover:bg-gray-50 space-y-3"
              >
                {/* Mobile-first student info */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(record.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm lg:text-base truncate">{record.studentName}</div>
                    <div className="text-xs lg:text-sm text-muted-foreground mt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-mono">{record.rollNumber}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate">{record.studentEmail}</span>
                      </div>
                    </div>
                    {record.note && (
                      <div className="text-xs lg:text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded italic">
                        Note: {record.note}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status and actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(record.status)}
                    {record.markedBy && (
                      <div className="text-xs text-muted-foreground">
                        by {record.markedBy}
                      </div>
                    )}
                  </div>
                  
                  {isAdmin && editingRecord === record.id ? (
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <Select value={editStatus} onValueChange={(value: AttendanceStatus) => setEditStatus(value)}>
                        <SelectTrigger className="w-full sm:w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRESENT">Present</SelectItem>
                          <SelectItem value="ABSENT">Absent</SelectItem>
                          <SelectItem value="LATE">Late</SelectItem>
                          <SelectItem value="UNMARKED">Unmarked</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Note..."
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="w-full sm:w-28 text-xs"
                      />
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          onClick={handleSaveRecord}
                          disabled={updateRecordMutation.isPending}
                          className="flex-1 sm:flex-none"
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleCancelEdit}
                          className="flex-1 sm:flex-none"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : isAdmin ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRecord(record)}
                      className="w-full sm:w-auto"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            
            {filteredRecords.length === 0 && (
              <div className="text-center py-8 lg:py-12 text-muted-foreground">
                <Users className="w-8 h-8 lg:w-12 lg:h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm lg:text-base">No students match the current filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
