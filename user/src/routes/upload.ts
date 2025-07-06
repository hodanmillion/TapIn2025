import { Router } from 'express';
import multer from 'multer';
import { s3Service, queueService } from '../services';
import { prisma } from '../services';
import sharp from 'sharp';

export const uploadRouter = Router();

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * @swagger
 * /api/v1/upload/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
uploadRouter.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { authId: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Process image
    const processedImage = await sharp(req.file.buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to S3
    const key = `avatars/${user.id}/${Date.now()}.webp`;
    const url = await s3Service.upload(key, processedImage, 'image/webp');

    // Update user
    const oldAvatarUrl = user.avatarUrl;
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: url },
    });

    // Queue old avatar deletion
    if (oldAvatarUrl) {
      await queueService.add('delete-file', {
        url: oldAvatarUrl,
      });
    }

    // Generate thumbnails in background
    await queueService.add('generate-thumbnails', {
      userId: user.id,
      originalUrl: url,
    });

    res.json({ avatarUrl: url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});