import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email } = req.body;
    const { password } = req.body;
    const usersCollection = dbClient.getCollection('users');

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
      const existingUser = await usersCollection.findOne({ email });
      existingUser.then((user) => {
        if (user) {
          res.status(400).json({ error: 'User already exists' });
        } else {
          // Hash the password before storing it
          const hashedPassword = sha1(password);
          const newUser = {
            email,
            password: hashedPassword,
          };
          usersCollection.insertOne(newUser).then((result) => {
            res.status(201).json({ id: result.insertedId, email });
          }).catch((error) => {
            console.error('Error inserting user:', error);
            res.status(500).json({ error: 'Internal server error' });
          });
        }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default UsersController;
