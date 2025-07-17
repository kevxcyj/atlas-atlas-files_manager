import dbClient from '../utils/db.js';
import { createHash } from 'crypto';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userExists = await dbClient.usersCollection().findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = createHash('sha1').update(password).digest('hex');
    const result = await dbClient.usersCollection().insertOne({ email, password: hashedPassword });

    return res.status(201).json({ id: result.insertedId, email });
  }
}

export default UsersController;
