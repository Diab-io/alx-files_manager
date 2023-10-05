import { v4 as uuid4 } from 'uuid';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const document = {
      name: '',
      type: '',
      parentId: 0,
      isPublic: false,
    };
    const token = `auth_${req.header('X-Token')}`
    const userId = await redisClient.get(token);
    const user = await dbClient.getCollection('users').findOne({ _id: new ObjectID(userId) })
    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }
    if (!type) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }
    if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing data' });
      return;
    }
    if (parentId) {
      const parentFile = await dbClient.getCollection('files').findOne({ _id: new ObjectID(parentId) });
      document.parentId = new ObjectID(parentId);
      if (!parentFile) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (parentFile && parentFile.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }
    if (isPublic) document.isPublic = false;
    document.name = name;
    document.type = type;
    document.userId = new ObjectID(user);

    if (type === 'folder') {
      const insertedFolder = await dbClient.getCollection('files').insertOne(document);
      console.log('inserted file', insertedFolder);
      res.status(201).json({
        id: insertedFolder.insertedId,
        userId: insertedFolder.userId,
        name: insertedFolder.name,
        type: insertedFolder.type,
        isPublic: insertedFolder.isPublic,
        parentId: insertedFolder.parentId,
      });
      return;
    }
    const storingFolder = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileData = Buffer.from(data, 'base64').toString('utf-8');
    const fileName = uuid4();
    const localPath = `${storingFolder}/${fileName}`;

    const directory = path.dirname(localPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFile(localPath, fileData, async (err) => {
      if (err) {
        console.error('Error creating the file:', err);
      } else {
        console.log('File created successfully.');
        document.localPath = localPath;
        console.log(document);
        const insertedFile = await dbClient.getCollection('files').insertOne(document);
        res.status(201).json({
          id: insertedFile.insertedId,
          userId: insertedFile.userId,
          name: insertedFile.name,
          type: insertedFile.type,
          isPublic: insertedFile.isPublic,
          parentId: insertedFile.parentId,
        });
      }
    });
  }
}

export default FilesController;
