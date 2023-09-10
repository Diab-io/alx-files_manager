import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    const usersCollection = dbClient.getCollection('users');

    try {
      if (email === undefined) {
        res.status(400).json({ error: 'Missing email' });
      }
      if (password === undefined) {
        res.status(400).json({ error: 'Missing password' });
      }

      // Check if the user already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        res.status(400).json({ error: 'User already exists' });
      }

      // Hash the password before storing it
      const hashedPassword = await sha1(password);

      // Create a new user document
      const newUser = {
        email,
        password: hashedPassword,
      };

      // Insert the user into the database
      const result = await usersCollection.insertOne(newUser);

      res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default UsersController;
