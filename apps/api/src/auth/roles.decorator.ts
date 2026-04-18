import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (Role | keyof typeof Role)[]) => SetMetadata(ROLES_KEY, roles);

export const MFA_REQUIRED_KEY = 'mfaRequired';
export const MfaRequired = () => SetMetadata(MFA_REQUIRED_KEY, true);
