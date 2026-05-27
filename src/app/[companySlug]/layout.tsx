import { FreshStackLogo } from "@/components/customer/FreshStackLogo";

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-fs-surface">
      {/* Top brand bar */}
      <header className="sticky top-0 z-10 border-b border-fs-green-pale/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/gm" className="flex items-center gap-2">
            <FreshStackLogo className="h-7 w-auto" />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
        {children}
      </main>

      {/* Simple footer */}
      <footer className="border-t border-fs-green-pale/40 py-6 text-center text-xs text-fs-muted">
        <p>Powered by FreshStack Fulfillment</p>
      </footer>
    </div>
  );
}
