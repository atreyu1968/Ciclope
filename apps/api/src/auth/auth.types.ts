import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  centerId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  mustChangePassword: boolean;
  academicYearId?: string;
  academicYearName?: string;
  centerName: string;
  coordinatorNetworkIds: string[];
  coordinatorNetworkCodes: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
