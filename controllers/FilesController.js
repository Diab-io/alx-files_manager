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
    const user = await FilesController.getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    if (!fileId) {
      return res.status(400).json({ error: 'Missing file ID' });
    }

    const file = await dbClient.getCollection('files').findOne({
      _id: new ObjectID(fileId),
      userId: new ObjectID(user._id),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const {
      parentId,
      page,
    } = request.query;
    const pageNum = page || 0;
    const files = dbClient.db.collection('files');
    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        return response.status(200).json(final);
      }
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }
}

export default FilesController;
