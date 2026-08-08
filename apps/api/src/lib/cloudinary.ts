import { v2 as cloudinary } from 'cloudinary';

import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

export const isCloudinaryConfigured = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

/**
 * Upload an image buffer to Cloudinary; returns the hosted secure URL.
 * `face: true` (default) does a square face-focused crop for avatars; logos use
 * `face: false` to fit within bounds keeping their aspect ratio.
 */
export async function uploadImage(
  buffer: Buffer,
  mimetype: string,
  opts: { folder?: string; face?: boolean } = {}
): Promise<string> {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const transformation =
    opts.face === false
      ? [{ width: 512, height: 512, crop: 'limit' }]
      : [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }];
  const res = await cloudinary.uploader.upload(dataUri, {
    folder: opts.folder ?? 'ridebuddy/avatars',
    resource_type: 'image',
    transformation,
  });
  return res.secure_url;
}
