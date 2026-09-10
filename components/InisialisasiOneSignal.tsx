"use client";

import { useEffect } from "react";
import { inisialisasiOneSignalSdk } from "@/lib/onesignal-klien";

export default function InisialisasiOneSignal() {
  useEffect(() => {
    void inisialisasiOneSignalSdk();
  }, []);
  return null;
}
