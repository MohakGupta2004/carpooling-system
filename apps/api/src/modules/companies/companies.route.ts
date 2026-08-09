import { departmentSchema, officeLocationSchema, updateCompanySchema } from '@carpool/types';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { isCloudinaryConfigured, uploadImage } from '../../lib/cloudinary.js';
import { BadRequest } from '../../lib/errors.js';
import { asyncHandler, created, ok } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';

const router = Router();
router.use(authenticate);
const idParam = z.object({ id: z.string() });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// Upload the company logo to Cloudinary and save the hosted URL on the org.
router.post(
  '/me/logo',
  requirePermission('company:configure'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!isCloudinaryConfigured()) throw BadRequest('Image uploads are not configured');
    const file = (req as typeof req & { file?: Express.Multer.File }).file;
    if (!file) throw BadRequest("No image file provided (field name must be 'file')");
    const logoUrl = await uploadImage(file.buffer, file.mimetype, {
      folder: 'workway/logos',
      face: false,
    });
    await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: { logoUrl },
    });
    ok(res, { logoUrl });
  })
);

// ---- Company config ----
router.get(
  '/me',
  requirePermission('company:read'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.organization.findUnique({
        where: { id: req.user!.organizationId },
        include: { departments: true, officeLocations: true },
      })
    )
  )
);

router.patch(
  '/me',
  requirePermission('company:configure'),
  validate({ body: updateCompanySchema }),
  asyncHandler(async (req, res) => {
    const body = vbody<z.infer<typeof updateCompanySchema>>(req);
    ok(
      res,
      await prisma.organization.update({
        where: { id: req.user!.organizationId },
        data: body as object,
      })
    );
  })
);

// ---- Departments ----
router.post(
  '/me/departments',
  requirePermission('department:manage'),
  validate({ body: departmentSchema }),
  asyncHandler(async (req, res) =>
    created(
      res,
      await prisma.department.create({
        data: { organizationId: req.user!.organizationId, ...vbody<{ name: string }>(req) },
      })
    )
  )
);

router.delete(
  '/me/departments/:id',
  requirePermission('department:manage'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await prisma.department.deleteMany({
      where: { id: vparams<{ id: string }>(req).id, organizationId: req.user!.organizationId },
    });
    ok(res, { deleted: true });
  })
);

// ---- Office locations ----
router.post(
  '/me/offices',
  requirePermission('officeLocation:manage'),
  validate({ body: officeLocationSchema }),
  asyncHandler(async (req, res) =>
    created(
      res,
      await prisma.officeLocation.create({
        data: {
          organizationId: req.user!.organizationId,
          ...vbody<z.infer<typeof officeLocationSchema>>(req),
        },
      })
    )
  )
);

router.delete(
  '/me/offices/:id',
  requirePermission('officeLocation:manage'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await prisma.officeLocation.deleteMany({
      where: { id: vparams<{ id: string }>(req).id, organizationId: req.user!.organizationId },
    });
    ok(res, { deleted: true });
  })
);

export default router;
