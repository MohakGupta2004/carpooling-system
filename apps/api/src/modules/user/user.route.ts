import { savedPlaceSchema, updateProfileSchema } from '@carpool/types';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { isCloudinaryConfigured, uploadImage } from '../../lib/cloudinary';
import { BadRequest } from '../../lib/errors';
import { asyncHandler, created, ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/requirePermission';
import { validate, vbody, vparams } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

// In-memory upload, images only, max 5 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// Upload a profile photo to Cloudinary and save the hosted URL on the user.
router.post(
  '/me/photo',
  requirePermission('profile:update'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!isCloudinaryConfigured()) throw BadRequest('Image uploads are not configured');
    const file = (req as typeof req & { file?: Express.Multer.File }).file;
    if (!file) throw BadRequest("No image file provided (field name must be 'file')");
    const photoUrl = await uploadImage(file.buffer, file.mimetype);
    await prisma.user.update({ where: { id: req.user!.id }, data: { photoUrl } });
    ok(res, { photoUrl });
  })
);

router.get(
  '/me',
  requirePermission('profile:read'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      omit: { passwordHash: true, otpCode: true, otpExpiresAt: true },
      include: {
        department: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true, slug: true, domain: true } },
        roles: { select: { role: { select: { key: true, name: true } } } },
        savedPlaces: true,
      },
    });
    ok(res, user);
  })
);

router.patch(
  '/me',
  requirePermission('profile:update'),
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const body = vbody<z.infer<typeof updateProfileSchema>>(req);
    const { preferences, ...rest } = body;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...rest,
        ...(preferences ? { preferences: preferences as object } : {}),
      },
      omit: { passwordHash: true, otpCode: true, otpExpiresAt: true },
    });
    ok(res, user);
  })
);

router.get(
  '/me/saved-places',
  requirePermission('profile:read'),
  asyncHandler(async (req, res) =>
    ok(res, await prisma.savedPlace.findMany({ where: { userId: req.user!.id } }))
  )
);

router.post(
  '/me/saved-places',
  requirePermission('profile:update'),
  validate({ body: savedPlaceSchema }),
  asyncHandler(async (req, res) =>
    created(
      res,
      await prisma.savedPlace.create({
        data: { userId: req.user!.id, ...vbody<z.infer<typeof savedPlaceSchema>>(req) },
      })
    )
  )
);

router.delete(
  '/me/saved-places/:id',
  requirePermission('profile:update'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await prisma.savedPlace.deleteMany({
      where: { id: vparams<{ id: string }>(req).id, userId: req.user!.id },
    });
    ok(res, { deleted: true });
  })
);

// Public-safe profile of a co-worker (same org enforced).
router.get(
  '/:id',
  requirePermission('user:read'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: vparams<{ id: string }>(req).id, organizationId: req.user!.organizationId },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        rating: true,
        ecoPoints: true,
        department: { select: { name: true } },
      },
    });
    ok(res, user);
  })
);

export default router;
