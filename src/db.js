const { MongoClient, GridFSBucket } = require('mongodb');
const mongoDbQueue = require('@openwar/mongodb-queue');
const { ObjectID } = require('bson');


let sourcesBucket, schemasBucket;

module.exports.connectDB = async (dbName, sourcesBucketName, schemasBucketName, verificationResultsCollName, parsingResultsCollName) => {
    const client = await MongoClient.connect(process.env.MONGO_URI, {
        connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    const db = client.db(dbName);
    sourcesBucket = new GridFSBucket(db, {bucketName: sourcesBucketName});
    schemasBucket = new GridFSBucket(db, {bucketName: schemasBucketName});

    return {
        verificationResultsCollection: db.collection(verificationResultsCollName),
        parsingResultsCollection: db.collection(parsingResultsCollName),
        verificationQueue: mongoDbQueue(db, 'verification-queue', {
            visibility: Number(process.env.QUEUE_ITEM_VISIBILITY),
        }),
        parsingQueue: mongoDbQueue(db, 'parsing-queue', {
            visibility: Number(process.env.QUEUE_ITEM_VISIBILITY),
        })
    };
}

module.exports.storeSource = async (buffer, metadata) => {
    // TODO: Maybe we will not have username but just API key
    // TODO: Generate filename in the format username-datetime
    const uploadStream = sourcesBucket.openUploadStream('myFile', {
        metadata: metadata
    });

    uploadStream.write(buffer);
    uploadStream.end();

    return uploadStream.id.toString();
}

module.exports.downloadSchemaByID = async (schemaID, dest, errCallback) => {
    schemaID = new ObjectID(schemaID);
    const downloadStream = schemasBucket.openDownloadStream(schemaID);
    downloadStream.on('error', errCallback);
    downloadStream.pipe(dest);
}

