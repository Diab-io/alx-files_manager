import sha1 from 'sha1';
import { v4 as uuid4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const authHeaderArr = req.headers.authorization.split(' ');
    const base64Str = authHeaderArr[authHeaderArr.length - 1];
    const decodedStr = Buffer.from(base64Str, 'base64').toString('utf-8');
    const splitBase64 = decodedStr.split(':');
    if (splitBase64.length !== 2) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const [email, password] = splitBase64;

    const user = await dbClient.getCollection('users').findOne({
      $and: [
        { email },
        { password: sha1(password) },
      ],
    });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = uuid4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id, 24 * 60 * 60);
    res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const xToken = req.headers['x-token'];
    const key = `auth_${xToken}`;
    const id = await redisClient.get(key);
    if (!id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await redisClient.del(key);
    res.status(204).json({});
  }
}

export default AuthController;
