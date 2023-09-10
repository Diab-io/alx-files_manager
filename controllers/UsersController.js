import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email } = req.body;
    const { password } = req.body;
    const users = dbClient.getCollection('users');

    try {
      if (!email) {
        res.status(400).json({ error: 'Missing email' });
        return;
      }
      if (!password) {
        res.status(400).json({ error: 'Missing password' });
        return;
      }

      // Check if the user already exists
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        res.status(400).json({ error: 'Already exist' });
        return;
      }

      // Hash the password before storing it
      const hashedPassword = sha1(password);

      // Create a new user document
      const newUser = {
        email,
        password: hashedPassword,
      };

      // Insert the user into the database
      const result = await users.insertOne(newUser);

      res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    const userObjectId = new ObjectID(userId);
    const user = await dbClient.getCollection('users').findOne({ _id: userObjectId });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    console.log(user);
    res.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;
