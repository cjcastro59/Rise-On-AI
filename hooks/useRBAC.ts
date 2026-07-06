"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";

const supabase = createClient();

type PermissionValue = "full" | "limited" | "rai-only" | "aggregated" | "none";

interface RolePermissions {
  [key: string]: {
    dashboard: boolean;
    userIds: PermissionValue;
    sentimentData: PermissionValue;
    alerts: boolean;
    settings: boolean;
    export: PermissionValue;
  };
}

const DEFAULT_PERMISSIONS: RolePermissions = {
  owner: {
    dashboard: true,
    userIds: "full",
    sentimentData: "full",
    alerts: true,
    settings: true,
    export: "full",
  },
  admin: {
    dashboard: true,
    userIds: "rai-only",
    sentimentData: "aggregated",
    alerts: true,
    settings: false,
    export: "limited",
  },
  counselor: {
    dashboard: true,
    userIds: "rai-only",
    sentimentData: "aggregated",
    alerts: true,
    settings: false,
    export: "limited",
  },
  user: {
    dashboard: true,
    userIds: "none",
    sentimentData: "none",
    alerts: false,
    settings: false,
    export: "none",
  },
};

export function useRBAC() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions[string] | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("user");

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user role
      const { data: userData } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = userData?.role || "user";
      setUserRole(role);

      // Try to get saved permissions
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "rbac_permissions")
          .single();

        if (data?.value) {
          const allPermissions = data.value as RolePermissions;
          setPermissions(allPermissions[role] || DEFAULT_PERMISSIONS[role]);
        } else {
          setPermissions(DEFAULT_PERMISSIONS[role]);
        }
      } catch (error) {
        setPermissions(DEFAULT_PERMISSIONS[role]);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user]);

  const hasPermission = (
    permission: keyof RolePermissions[string],
    requiredLevel: PermissionValue | boolean = true
  ) => {
    if (loading || !permissions) return false;
    
    const userPermission = permissions[permission];
    
    if (typeof requiredLevel === "boolean") {
      return userPermission === requiredLevel;
    }
    
    // For select permissions, check if user has at least the required level
    const levelOrder = ["none", "limited", "rai-only", "aggregated", "full"];
    const userLevel = levelOrder.indexOf(userPermission as PermissionValue);
    const requiredLevelIndex = levelOrder.indexOf(requiredLevel);
    
    return userLevel >= requiredLevelIndex;
  };

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
  };
}
