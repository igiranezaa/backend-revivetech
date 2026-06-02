import { UserRole, UserStatus } from "@prisma/client";

export const frontendRoleToBackend = (role: string): UserRole | null => {
  const map: Record<string, UserRole> = {
    Customer: UserRole.CUSTOMER,
    Admin: UserRole.ADMIN,
    Technician: UserRole.TECHNICIAN,
    "Finance Officer": UserRole.FINANCE_OFFICER,
    "Support Agent": UserRole.SUPPORT_AGENT,
    CUSTOMER: UserRole.CUSTOMER,
    ADMIN: UserRole.ADMIN,
    TECHNICIAN: UserRole.TECHNICIAN,
    FINANCE_OFFICER: UserRole.FINANCE_OFFICER,
    SUPPORT_AGENT: UserRole.SUPPORT_AGENT,
  };
  return map[role] ?? null;
};

export const frontendStatusToBackend = (status: string): UserStatus | null => {
  const map: Record<string, UserStatus> = {
    Active: UserStatus.ACTIVE,
    Deactivated: UserStatus.SUSPENDED,
    ACTIVE: UserStatus.ACTIVE,
    SUSPENDED: UserStatus.SUSPENDED,
    DELETED: UserStatus.DELETED,
  };
  return map[status] ?? null;
};
