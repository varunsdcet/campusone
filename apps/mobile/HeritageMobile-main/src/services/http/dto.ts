/**
 * PROPOSED DTO shapes and mappers for the future HTTP backend.
 * Nothing here is approved; see docs/API_HANDOFF.md.
 */
import type { UserAccount, Session, Programme, Section } from '../../domain/types';

export interface LoginRequestDto { loginId: string; password: string; rememberMe: boolean; deviceName?: string }
export interface LoginResponseDto { accessToken: string; refreshToken?: string; expiresAt: string; user: UserDto }
export interface UserDto { id: string; role: 'student' | 'instructor'; loginId: string; firstName: string; lastName: string; preferredName?: string; email: string; capabilities: string[] }
export interface PageDto<T> { items: T[]; nextCursor?: string; total?: number }
export interface ErrorDto { error: { code: string; message: string; details?: Record<string, string> } }
export interface ProgrammeDto { id: string; title: string; subject: string; level: string; hours: number; priceCents: number; currency: string; chapters: unknown[] }
export interface SectionDto { id: string; courseId: string; code: string; termId: string; instructorId: string; startsOn: string; endsOn: string; schedule: string }

export const mapUser = (dto: UserDto): UserAccount => ({
  id: dto.id,
  role: dto.role,
  loginId: dto.loginId,
  demoPassword: '',
  displayName: `${dto.firstName} ${dto.lastName}`,
  firstName: dto.firstName,
  lastName: dto.lastName,
  preferredName: dto.preferredName,
  email: dto.email,
  avatarInitials: `${dto.firstName[0] ?? ''}${dto.lastName[0] ?? ''}`,
  capabilities: dto.capabilities as UserAccount['capabilities'],
});

export const mapSession = (dto: LoginResponseDto, rememberMe: boolean): Session => ({ userId: dto.user.id, role: dto.user.role, rememberMe, createdAt: new Date().toISOString() });

export const mapProgramme = (dto: ProgrammeDto): Partial<Programme> => ({ id: dto.id, title: dto.title, subject: dto.subject, level: dto.level as Programme['level'], hours: dto.hours, priceCad: dto.priceCents / 100 });

export const mapSection = (dto: SectionDto): Partial<Section> => ({ id: dto.id, courseId: dto.courseId, sectionCode: dto.code, termId: dto.termId, instructorId: dto.instructorId, startDate: dto.startsOn, endDate: dto.endsOn, scheduleLabel: dto.schedule });
