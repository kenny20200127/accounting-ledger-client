export type AdministrationProps = {
  token: string;
  companyId: string;
  platform?: boolean;
  onChanged?: () => void;
  onSelect?: (id: string) => void;
  onManage?: (id: string) => void;
};

export type Role = {
  roleId: string;
  roleName: string;
  isCompanyAdmin?: boolean;
};

export type ManagedUser = {
  userId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  isPlatformAdmin: boolean;
  roles: Role[];
};

export type Permission = {
  menuId: string;
  menuName: string;
  menuCode: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
};
