import { MongoClient } from 'mongodb';

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || '27017';
        const database = process.env.DB_DATABASE || 'files_manager';
        const url = `mongodb://${host}:${port}`;

        this.client = new MongoClient(url, { useUnifiedTopology: true });

        this.client.connect()
            .then(() => {
                this.db = this.client.db(database);
                console.log('MongoDB connected successfully');
            })
            .catch((err) => {
                console.error('MongoDB connection error:', err);
            });
    }

    isAlive() {
        return this.client && this.client.topology && this.client.topology.isConnected();
    }

    async nbUsers() {
        return this.db ? this.db.collection('users').countDocuments() : 0;
    }

    async nbFiles() {
        return this.db ? this.db.collection('files').countDocuments() : 0;
    }
}

const dbClient = new DBClient();
export default dbClient;