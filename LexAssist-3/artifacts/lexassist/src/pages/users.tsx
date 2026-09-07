import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { USER_ROLES, DEPARTMENTS } from "@shared/schema";

interface SafeUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  department: string;
  organisationId: number;
  createdAt: string;
}

const roleLabelMap: Record<string, string> = {
  admin: "Admin",
  fee_earner: "Fee Earner",
  assistant: "Assistant",
  read_only: "Read Only",
};

const deptLabelMap: Record<string, string> = {
  conveyancing: "Conveyancing",
  immigration: "Immigration",
  both: "Both",
};

const roleColorMap: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  fee_earner: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  assistant: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  read_only: "bg-muted text-muted-foreground border-muted",
};

export default function UsersPage() {
  const { toast } = useToast();
  const { hasPermission, userId } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const { data: usersList, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; displayName: string; role: string; department: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreateOpen(false);
      toast({ title: "User created", description: "New user has been created successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditOpen(false);
      setEditUser(null);
      toast({ title: "User updated", description: "User has been updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted", description: "User has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const role = formData.get("role") as string;
    const department = formData.get("department") as string;
    if (!role) {
      toast({ title: "Error", description: "Please select a role", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      displayName: formData.get("displayName") as string,
      role,
      department: department || "conveyancing",
    });
  };

  const openEdit = (user: SafeUser) => {
    setEditUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role);
    setEditDepartment(user.department || "conveyancing");
    setEditPassword("");
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editUser) return;
    const data: Record<string, string> = {};
    if (editDisplayName !== editUser.displayName) data.displayName = editDisplayName;
    if (editRole !== editUser.role) data.role = editRole;
    if (editDepartment !== (editUser.department || "conveyancing")) data.department = editDepartment;
    if (editPassword) data.password = editPassword;
    if (Object.keys(data).length === 0) {
      setEditOpen(false);
      return;
    }
    updateMutation.mutate({ id: editUser.id, data });
  };

  if (!hasPermission("canManageUsers")) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-users-title">User Management</h1>
          <p className="text-muted-foreground">Manage team members and their roles</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="glass sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new team member account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">Username</Label>
                <Input id="new-username" name="username" placeholder="e.g., john.smith" required data-testid="input-new-username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-displayName">Display Name</Label>
                <Input id="new-displayName" name="displayName" placeholder="e.g., John Smith" required data-testid="input-new-display-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input id="new-password" name="password" type="password" required data-testid="input-new-password" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select name="role" defaultValue="assistant">
                  <SelectTrigger data-testid="select-new-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map(r => (
                      <SelectItem key={r} value={r}>{roleLabelMap[r] || r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select name="department" defaultValue="conveyancing">
                  <SelectTrigger data-testid="select-new-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>{deptLabelMap[d] || d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-create-user">
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card rounded-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members ({usersList?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : !usersList?.length ? (
            <p className="text-muted-foreground text-center py-8 text-sm">No users found</p>
          ) : (
            usersList.map(user => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md glass-subtle"
                data-testid={`row-user-${user.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs" data-testid={`badge-dept-${user.id}`}>
                    {deptLabelMap[user.department] || user.department || "Conveyancing"}
                  </Badge>
                  <Badge className={roleColorMap[user.role] || ""} data-testid={`badge-role-${user.id}`}>
                    {roleLabelMap[user.role] || user.role}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)} data-testid={`button-edit-user-${user.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {user.id !== userId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" data-testid={`button-delete-user-${user.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete user?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove {user.displayName} from the system.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(user.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-user-${user.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditUser(null); }}>
        <DialogContent className="glass sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} data-testid="input-edit-display-name" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map(r => (
                    <SelectItem key={r} value={r}>{roleLabelMap[r] || r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger data-testid="select-edit-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d}>{deptLabelMap[d] || d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave blank to keep current" data-testid="input-edit-password" />
            </div>
            <Button className="w-full" onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-submit-edit-user">
              {updateMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
