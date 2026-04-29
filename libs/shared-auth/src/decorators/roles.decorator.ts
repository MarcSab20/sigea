import { SetMetadata } from '@nestjs/common';
import { RoleUtilisateur } from '@sigea/shared-types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleUtilisateur[]) => SetMetadata(ROLES_KEY, roles);
