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
import { useAuthContext } from '@/context/AuthContext';
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
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading attendance sheet...</p>
        </div>
      </div>
    );
  }

  if (error || !attendanceData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Attendance Sheet Found</h3>
            <p className="text-muted-foreground mb-4">
              This event doesn't have an attendance sheet or you don't have permission to view it.
            </p>
            <Button onClick={() => setLocation('/calendar')} variant="outline">
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/calendar')}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Calendar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Attendance Sheet</h1>
            <p className="text-muted-foreground">
              {attendanceData.sheet.batch}::{attendanceData.sheet.section}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button 
                variant="outline" 
                onClick={() => syncStudentsMutation.mutate()}
                disabled={syncStudentsMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncStudentsMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Students
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalStudents}</div>
            <div className="text-sm text-muted-foreground">Total Students</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
            <div className="text-sm text-muted-foreground">Present</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
            <div className="text-sm text-muted-foreground">Absent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
            <div className="text-sm text-muted-foreground">Late</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{unmarkedCount}</div>
            <div className="text-sm text-muted-foreground">Unmarked</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkUpdateMutation.mutate({ status: 'PRESENT' })}
                disabled={bulkUpdateMutation.isPending}
                className="text-green-700 border-green-300 hover:bg-green-50"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark All Present
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkUpdateMutation.mutate({ status: 'ABSENT' })}
                disabled={bulkUpdateMutation.isPending}
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Mark All Absent
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkUpdateMutation.mutate({ status: 'UNMARKED' })}
                disabled={bulkUpdateMutation.isPending}
                className="text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="min-w-[150px]">
              <Select value={statusFilter} onValueChange={(value: AttendanceStatus | 'ALL') => setStatusFilter(value)}>
                <SelectTrigger>
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
          <CardTitle className="text-lg">
            Student Attendance ({filteredRecords.length} of {totalStudents})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-4 flex-1">
                  {getStatusIcon(record.status)}
                  <div className="flex-1">
                    <div className="font-medium">{record.studentName}</div>
                    <div className="text-sm text-muted-foreground">
                      {record.rollNumber} • {record.studentEmail}
                    </div>
                    {record.note && (
                      <div className="text-sm text-gray-600 mt-1 italic">
                        Note: {record.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(record.status)}
                    {record.markedBy && (
                      <div className="text-xs text-muted-foreground">
                        by {record.markedBy}
                      </div>
                    )}
                  </div>
                </div>
                
                {isAdmin && editingRecord === record.id ? (
                  <div className="flex items-center gap-2 ml-4">
                    <Select value={editStatus} onValueChange={(value: AttendanceStatus) => setEditStatus(value)}>
                      <SelectTrigger className="w-32">
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
                      className="w-32"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveRecord}
                      disabled={updateRecordMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : isAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditRecord(record)}
                    className="ml-4"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            
            {filteredRecords.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No students match the current filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
