import { type RegisterInput, SYSTEM_ROLES } from '@carpool/types';

import { BadRequest, Conflict, NotFound, Unauthorized } from '../../lib/errors.js';
import { signAccessToken, signRefreshToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { generateOtp, hashPassword, hashToken, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';

async function resolveOrganization(input: RegisterInput) {
  if (input.organizationSlug) {
    const org = await prisma.organization.findUnique({ where: { slug: input.organizationSlug } });
    if (org) return org;
  }
  // email-domain auto-join (e.g. jane@acme.com → org with domain "acme.com")
  const domain = input.email.split('@')[1];
  if (domain) {
    const org = await prisma.organization.findFirst({ where: { domain } });
    if (org) return org;
  }
  throw BadRequest('No organization matched. Provide a valid organizationSlug or company email.');
}

export async function register(input: RegisterInput) {
  const org = await resolveOrganization(input);

  const existing = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email: input.email } },
  });
  if (existing) throw Conflict('An account with this email already exists');

  const employeeRole = await prisma.role.findUnique({
    where: { organizationId_key: { organizationId: org.id, key: SYSTEM_ROLES.EMPLOYEE } },
  });
  if (!employeeRole)
    throw NotFound('Organization is not fully provisioned (missing Employee role)');

  const otp = generateOtp();
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: input.email,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
      status: 'PENDING',
      otpCode: otp,
      otpExpiresAt: new Date(Date.now() + 15 * 60_000),
      roles: { create: { roleId: employeeRole.id } },
      wallet: { create: {} },
    },
  });

  // In production this is emailed. For the hackathon we log it.
  logger.info({ email: user.email, otp }, 'email verification OTP (dev)');
  return { userId: user.id, email: user.email, organization: org.slug, devOtp: otp };
}

export async function verifyEmail(email: string, otp: string) {
  // (organizationId, email) is the unique key — the same address can exist in two
  // organizations, so the OTP is what picks the account, not the address alone.
  const candidates = await prisma.user.findMany({ where: { email } });
  if (candidates.length === 0) throw NotFound('User not found');

  const user = candidates.find((u) => u.otpCode === otp);
  if (!user) {
    if (candidates.every((u) => u.emailVerified)) return { verified: true };
    throw BadRequest('Invalid or expired OTP');
  }
  if (user.emailVerified) return { verified: true };
  if (!user.otpExpiresAt || user.otpExpiresAt < new Date())
    throw BadRequest('Invalid or expired OTP');

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, otpCode: null, otpExpiresAt: null },
  });
  return { verified: true };
}

export async function login(
  email: string,
  password: string,
  ctx: { ua?: string; ip?: string },
  organizationSlug?: string
) {
  // Users are unique per (organizationId, email), so one address may belong to
  // several organizations. Picking the first row would hand the caller a token
  // for an arbitrary company — resolve it deliberately instead.
  const candidates = await prisma.user.findMany({
    where: {
      email,
      ...(organizationSlug ? { organization: { slug: organizationSlug } } : {}),
    },
  });

  const matches: typeof candidates = [];
  for (const candidate of candidates) {
    if (!candidate.passwordHash) continue;
    if (await verifyPassword(candidate.passwordHash, password)) matches.push(candidate);
  }
  if (matches.length === 0) throw Unauthorized('Invalid credentials');
  if (matches.length > 1)
    throw BadRequest('This email belongs to multiple organizations — provide organizationSlug');

  const user = matches[0]!;
  if (user.status === 'SUSPENDED') throw Unauthorized('Account suspended');

  const tokens = await issueSession(user.id, user.organizationId, user.email, ctx);
  return { ...tokens, user: publicUser(user) };
}

export async function issueSession(
  userId: string,
  orgId: string,
  email: string,
  ctx: { ua?: string; ip?: string }
) {
  const { token: accessToken, expiresIn } = signAccessToken({ sub: userId, orgId, email });
  const refreshToken = signRefreshToken(userId);
  await prisma.session.create({
    data: {
      userId,
      refreshHash: hashToken(refreshToken),
      userAgent: ctx.ua,
      ip: ctx.ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    },
  });
  return { accessToken, refreshToken, expiresIn };
}

export async function refresh(refreshToken: string, userId: string) {
  const hash = hashToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: { userId, refreshHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!session) throw Unauthorized('Invalid refresh token');

  // rotate
  const rotated = signRefreshToken(userId);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshHash: hashToken(rotated) },
  });
  const { token: accessToken, expiresIn } = signAccessToken({
    sub: userId,
    orgId: session.user.organizationId,
    email: session.user.email,
  });
  return { accessToken, refreshToken: rotated, expiresIn };
}

export async function logout(refreshToken: string, userId: string) {
  await prisma.session.updateMany({
    where: { userId, refreshHash: hashToken(refreshToken) },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: { select: { key: true, name: true } } } },
      department: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!user) throw NotFound('User not found');
  return {
    ...publicUser(user),
    organization: user.organization,
    department: user.department,
    roles: user.roles.map((r: { role: { key: string; name: string } }) => r.role),
    preferences: user.preferences,
    ecoPoints: user.ecoPoints,
  };
}

function publicUser(u: {
  id: string;
  email: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
  photoUrl: string | null;
  organizationId: string;
  gender: string | null;
}) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    status: u.status,
    emailVerified: u.emailVerified,
    photoUrl: u.photoUrl,
    organizationId: u.organizationId,
    gender: u.gender,
  };
}
