import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static async getStats(req, res) {
    const numUser = dbClient.nbUsers;
    const numFiles = dbClient.nbFiles;
    res.status(200).json({ users: numUser, files: numFiles });
  }
}

export default AppController;
