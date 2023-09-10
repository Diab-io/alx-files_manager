import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email } = req.body;
    const { password } = req.body;
    const user = await dbClient.getCollection('users');

    if (email === undefined) {
      res.status(400).json({ error: 'Missing email' });
    }
    if (password === undefined) {
      res.status(400).json({ error: 'Missing password' });
    }

    user.findOne({ email }, async (err, user) => {
      if (err) {
        console.log(err);
      }
      if (user) {
        res.status(400).json({ error: 'Already exist' });
      } else {
        const hashPassword = sha1(password);
        const newDocument = {
          email,
          password: hashPassword,
        };
        const result = await user.insertOne(newDocument);
        res.status(201).json({ id: result._id, email: result.email });
      }
    });
  }
}

export default UsersController;
