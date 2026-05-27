import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-4 lg:p-8">{children}</main>
    </div>
  );
}
