import { User, UserRole } from '../types';
import { db } from './DatabaseService';

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // Check session storage for auto-login
    const stored = sessionStorage.getItem('ct_session_user');
    if (stored) {
      this.currentUser = JSON.parse(stored);
    }
  }

  login(username: string, password: string): boolean {
    const user = db.getUserByUsername(username);
    // Simple password check for demo (in prod, use bcrypt compare)
    if (user && user.passwordHash === password) {
      this.currentUser = user;
      sessionStorage.setItem('ct_session_user', JSON.stringify(user));
      db.logAudit(user.id, 'LOGIN', 'User logged in successfully');
      return true;
    }
    return false;
  }

  logout() {
    if (this.currentUser) {
      db.logAudit(this.currentUser.id, 'LOGOUT', 'User logged out');
    }
    this.currentUser = null;
    sessionStorage.removeItem('ct_session_user');
  }

  getUser(): User | null {
    return this.currentUser;
  }

  hasRole(roles: UserRole[]): boolean {
    if (!this.currentUser) return false;
    return roles.includes(this.currentUser.role);
  }
}

export const auth = new AuthService();