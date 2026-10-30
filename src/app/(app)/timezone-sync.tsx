"use client";

import { useEffect } from "react";
import { saveDetectedTimezone } from "./actions";

export function TimezoneSync() {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone !== "UTC") {
      saveDetectedTimezone(timeZone);
    }
  }, []);

  return null;
}
