import Redis from 'ioredis';

class RedisClient {
    constructor() {
        this.client = new Redis();
        this.client.on('error', (err) => console.error('Redis Client Error:', err));
    }

    isAlive() {
        return this.client.ping().then((result) => result === 'PONG');
    }

    async get(key) {
        try {
            return await this.client.get(key);
        } catch (err) {
            console.error('Error getting value from Redis:', err);
            throw err;
        }
    }

    async set(key, value, duration) {
        try {
            await this.client.setex(key, duration, value);
        } catch (err) {
            console.error('Error setting value in Redis:', err);
            throw err;
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
        } catch (err) {
            console.error('Error deleting value from Redis:', err);
            throw err;
        }
    }
}

const redisClient = new RedisClient();
export default redisClient;
