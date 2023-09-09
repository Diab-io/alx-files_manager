import { MongoClient } from "mongodb";

class DBClient {
    constructor() {
        this.host = process.env.DB_HOST || 'localhost'
        this.port = process.env.DB_PORT || 27017
        this.database = process.env.DB_DATABASE || 'files_manager'
        const uri = `mongodb://${this.host}:${this.port}/${this.database}`
        this.client = new MongoClient(uri, { useUnifiedTopology: true })
        this.client.connect()
    }

    isAlive() {
        return this.client.isConnected()
    }

    async nbUsers() {
        const usersCollection = this.getCollection('users')
        const documentCount = await usersCollection.find().count()
        return documentCount;
    }

    async nbFiles() {
        const collection = this.getCollection('files')
        const documentCount = await collection.find().count()
        return documentCount
    }

    getCollection(collectionName) {
        const db = this.client.db()
        const collection = db.collection(collectionName)
        return collection
    }
}

const dbClient = new DBClient();
export default dbClient;
