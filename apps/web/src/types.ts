export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: 'SK' | 'CS';
  seniorMode: boolean;
  memberships: Array<{
    role: string;
    building: { id: string; name: string; city: string };
    apartment?: { id: string; unitNumber: string } | null;
  }>;
}
