export type UserRole = 'admin' | 'manager' | 'specialist';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
}

// Для формы логина
export interface LoginCredentials {
  email: string;
  password: string;
}