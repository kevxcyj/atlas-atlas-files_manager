import Queue from 'bull';
import dbClient from './utils/db.js';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs/promises';
import path from 'path';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.filesCollection().findOne({
    _id: dbClient.objectId(fileId),
    userId: dbClient.objectId(userId),
  });
  if (!file) throw new Error('File not found');
  if (file.type !== 'image') return done();

  const sizes = [500, 250, 100];
  for (const size of sizes) {
    try {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const thumbPath = `${file.localPath}_${size}`;
      await fs.writeFile(thumbPath, thumbnail);
    } catch (err) {
      console.error(`Error generating thumbnail for size ${size}:`, err);
    }
  }
  done();
});
