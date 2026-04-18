import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, MFA_REQUIRED_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const mfaRequired = this.reflector.getAllAndOverride<boolean>(MFA_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException();

    if (mfaRequired && !user.mfa) {
      throw new ForbiddenException('Akcia vyžaduje 2FA. Prihláste sa pomocou TOTP kódu.');
    }

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const userRoles: string[] = (user.memberships ?? []).map((m: { role: string }) => m.role);
    const ok = userRoles.some((r) => requiredRoles.includes(r));
    if (!ok) throw new ForbiddenException('Nedostatočné oprávnenia.');
    return true;
  }
}
