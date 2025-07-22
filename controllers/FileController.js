/Documents/atlas-atlas-files_manager/controllers/FilesController.js
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const VALID_TYPES = ['folder', 'file', 'image'];

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;
    if (parentId && parentId !== 0) {
      parentFile = await dbClient.filesCollection().findOne({ _id: dbClient.objectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

      // fileDocument for db
    const fileDocument = {
      userId: dbClient.objectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : dbClient.objectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.filesCollection().insertOne(fileDocument);
      fileDocument.id = result.insertedId;
      return res.status(201).json({
        id: fileDocument.id,
        userId: fileDocument.userId,
        name,
        type,
        isPublic,
        parentId: fileDocument.parentId,
      });
    }

    // Handle file/image storage
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await fs.mkdir(folderPath, { recursive: true });
    const filename = uuidv4();
    const localPath = path.join(folderPath, filename);

    await fs.writeFile(localPath, Buffer.from(data, 'base64'));

    fileDocument.localPath = localPath;
    const result = await dbClient.filesCollection().insertOne(fileDocument);

    // New file info
    return res.status(201).json({
      id: result.insertedId,
      userId: fileDocument.userId,
      name,
      type,
      isPublic,
      parentId: fileDocument.parentId,
      localPath,
    });
  }
  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    let file;
    try {
      file = await dbClient.filesCollection().findOne({
        _id: dbClient.objectId(fileId),
        userId: dbClient.objectId(userId),
      });
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Format response
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    });
  }


  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10) || 0;
    const matchQuery = {
      userId: dbClient.objectId(userId),
      parentId: parentId === 0 || parentId === '0'
        ? 0
        : dbClient.objectId(parentId),
    };

    const files = await dbClient.filesCollection()
      .aggregate([
        { $match: matchQuery },
        { $skip: page * 20 },
        { $limit: 20 },
      ])
      .toArray();

    const formatted = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    }));

    return res.status(200).json(formatted);
  }

  static async putPublish(req, res) {
    // Authenticate user
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    let file;
    try {
      file = await dbClient.filesCollection().findOne({
        _id: dbClient.objectId(fileId),
        userId: dbClient.objectId(userId),
      });
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.filesCollection().updateOne(
      { _id: dbClient.objectId(fileId) },
      { $set: { isPublic: true } }
    );

    // Return updated file
    file.isPublic = true;
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    let file;
    try {
      file = await dbClient.filesCollection().findOne({
        _id: dbClient.objectId(fileId),
        userId: dbClient.objectId(userId),
      });
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

  
    await dbClient.filesCollection().updateOne(
      { _id: dbClient.objectId(fileId) },
      { $set: { isPublic: false } }
    );

    // Return updated file
    file.isPublic = false;
    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    });
  }
}


export default FilesController;
