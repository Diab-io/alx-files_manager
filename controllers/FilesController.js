import { v4 as uuid4 } from 'uuid';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async getUser(req) {
    const token = `auth_${req.header('X-Token')}`;
    const userId = await redisClient.get(token);
    if (userId) {
      const user = await dbClient.getCollection('users').findOne({ _id: new ObjectID(userId) });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async postUpload(req, res) {
    const document = {
      name: '',
      type: '',
      parentId: 0,
      isPublic: false,
    };
    const user = await FilesController.getUser(req);
    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId) {
      const parentFile = await dbClient.getCollection('files').findOne({ _id: new ObjectID(parentId) });
      document.parentId = new ObjectID(parentId);
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile && parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (isPublic) document.isPublic = true;
    document.name = name;
    document.type = type;
    document.userId = new ObjectID(user._id);

    if (type === 'folder') {
      const insertedFolder = await dbClient.getCollection('files').insertOne(document);
      console.log('inserted file', insertedFolder);
      return res.status(201).json({
        id: insertedFolder.insertedId,
        userId: user._id,
        name,
        type,
        isPublic: document.isPublic,
        parentId: document.parentId,
      });
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
        return res.status(201).json({
          id: insertedFile.insertedId,
          userId: user._id,
          name,
          type,
          isPublic: document.isPublic,
          parentId: document.parentId,
        });
      }
      return 0;
    });
    return 0;
  }

  static async getShow(req, res) {
    try {
      const user = await FilesController.getUser(req);
      const fileId = req.params.id;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const file = await dbClient.getCollection('files').findOne({ _id: new ObjectID(fileId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(200).json(file);
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    try {
      let { parentId, page } = req.query;

      if (!parentId || parentId === '0') parentId = 0;
      else parentId = new ObjectID(parentId);

      if (!page) page = 0;
      else if (Number.isNaN(page)) page = 0;
      else page = Number(page);

      const pageSize = 20;
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const user = await FilesController.getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const files = await dbClient.getCollection('files').find({ userId: user._id, parentId }).toArray();
      if (!files) {
        return res.status(404).json({ error: 'Not Found' });
      }
      if (startIndex > files.length) {
        return res.status(404).json({ error: 'Not Found' });
      }
      const result = files.slice(startIndex, endIndex);
      return res.status(200).send(result);
    } catch (e) {
      console.error(e.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
