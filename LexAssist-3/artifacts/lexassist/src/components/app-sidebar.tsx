import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Mail,
  Bell,
  Bot,
  Scale,
  BookOpen,
  Library,
  Users,
  ShieldCheck,
  Plane,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; dept?: "conveyancing" | "immigration" };

const navItems: NavItem[] = [
  { title: "Dashboard",    url: "/dashboard", icon: LayoutDashboard },
  { title: "Matters",      url: "/matters",   icon: Briefcase },
  { title: "Draft Emails", url: "/emails",    icon: Mail, dept: "conveyancing" },
  { title: "Reminders",    url: "/reminders", icon: Bell, dept: "conveyancing" },
  { title: "Journal",      url: "/journal",   icon: BookOpen, dept: "conveyancing" },
  { title: "Resources",    url: "/resources", icon: Library },
  { title: "Immigration Assessment", url: "/immigration", icon: Plane, dept: "immigration" },
  { title: "AI Assistant", url: "/assistant", icon: Bot },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { hasPermission, department } = useAuth();

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/dashboard";
    return location.startsWith(url);
  };

  const filteredNav = navItems.filter(item => {
    if (!item.dept) return true;
    if (department === "both") return true;
    return item.dept === department;
  });

  const allItems: NavItem[] = [
    ...filteredNav,
    ...(hasPermission("canViewReports")  ? [{ title: "Compliance", url: "/compliance", icon: ShieldCheck }] : []),
    ...(hasPermission("canManageUsers")  ? [{ title: "Users",      url: "/users",      icon: Users       }] : []),
  ];

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0"
            style={{
              background: "rgba(245,240,230,0.15)",
              border: "1px solid rgba(245,240,230,0.25)",
            }}
          >
            <Scale className="h-4 w-4 text-sidebar-foreground" />
          </div>
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold truncate text-sidebar-foreground"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                letterSpacing: "0.02em",
              }}
              data-testid="text-app-name"
            >
              LexAssist
            </h2>
            <p
              className="text-xs truncate"
              style={{ color: "rgba(245,240,230,0.50)", letterSpacing: "0.04em" }}
            >
              {department === "immigration" ? "Immigration Practice" : department === "both" ? "Legal Practice" : "Conveyancing Assistant"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel
            className="text-xs uppercase tracking-widest px-4 py-3"
            style={{ color: "rgba(245,240,230,0.40)", letterSpacing: "0.12em" }}
          >
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={active}
                      className="mx-2 rounded-md transition-colors duration-150"
                    >
                      <Link
                        href={item.url}
                        data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                        className="flex items-center gap-2.5 px-3 py-2"
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span
                          className="text-sm font-medium"
                          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <p
          className="text-xs text-center"
          style={{ color: "rgba(245,240,230,0.35)", letterSpacing: "0.06em" }}
        >
          {department === "immigration" ? "Immigration workflow management" : department === "both" ? "Legal workflow management" : "Property workflow management"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
