"use client";

import { useEffect, useState, useCallback } from "react";

interface PromotionFeatureState {
  isSuperAdmin: boolean;
  isPromotionEnabled: boolean;
  canAccess: boolean;
  loading: boolean;
  error: string | null;
}

export function usePromotionFeature() {
  const [state, setState] = useState<PromotionFeatureState>({
    isSuperAdmin: false,
    isPromotionEnabled: false,
    canAccess: false,
    loading: true,
    error: null,
  });

  const checkAccess = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch("/api/admin/super-admin-settings", {
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 403) {
          // Not a super admin
          setState({
            isSuperAdmin: false,
            isPromotionEnabled: false,
            canAccess: false,
            loading: false,
            error: "Super Admin access required",
          });
          return;
        }
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();

      setState({
        isSuperAdmin: true,
        isPromotionEnabled: data.promotionEnabled ?? false,
        canAccess: data.promotionEnabled ?? false,
        loading: false,
        error: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setState({
        isSuperAdmin: false,
        isPromotionEnabled: false,
        canAccess: false,
        loading: false,
        error: errorMessage,
      });
    }
  }, []);

  const togglePromotionFeature = useCallback(
    async (enabled: boolean) => {
      try {
        const response = await fetch("/api/admin/super-admin-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promotionEnabled: enabled }),
        });

        if (!response.ok) {
          throw new Error("Failed to update settings");
        }

        const data = await response.json();

        setState((prev) => ({
          ...prev,
          isPromotionEnabled: data.promotionEnabled,
          canAccess: data.promotionEnabled,
        }));

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
        }));
        return false;
      }
    },
    []
  );

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return {
    ...state,
    checkAccess,
    togglePromotionFeature,
  };
}
