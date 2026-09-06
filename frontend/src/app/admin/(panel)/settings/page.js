"use client";

import { useAdminResource } from "@/hooks/useAdminResource";
import { getAdminSettings } from "@/lib/api/admin";
import SettingsForm from "@/components/admin/SettingsForm";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Site settings (§9, §11, administrator only) — the Settings singleton, previously
 * only editable via a direct database write.
 */
export default function SettingsPage() {
  const { data: settings, loading, error, refetch } = useAdminResource(getAdminSettings, []);

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="p-8 text-sm text-danger">{error.message}</p>;
  }

  return <SettingsForm settings={settings} onSaved={refetch} />;
}
