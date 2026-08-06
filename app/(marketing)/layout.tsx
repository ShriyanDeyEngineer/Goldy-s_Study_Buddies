/**
 * Layout for the public marketing pages: shared header + footer around
 * each page's content. These pages are statically rendered (they fetch
 * nothing per-user) — that's what makes them fast and indexable.
 */
import { PublicHeader } from "@/components/marketing/public-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
