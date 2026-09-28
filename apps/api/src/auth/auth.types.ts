export type AuthenticatedUser = {
  id: string;
  centerId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  academicYearId?: string;
  coordinatorNetworkIds: string[];
  coordinatorNetworkCodes: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
