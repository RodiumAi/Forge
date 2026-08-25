"use client";

import { Suspense } from "react";
import SettingsPageContent from "./SettingsPageContent";
import { useI18n } from "@/lib/i18n/I18nProvider";

function SettingsFallback() {
  const { t } = useI18n();
  return <p className="settings-panel-loading">{t("loading")}</p>;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
