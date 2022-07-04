const { storeSource, downloadSchemaByID } = require('./db');


// TODO: Add request params validation

module.exports.getVerifyContractHandler = (dbConn) => {
    return async (req, res) => {
        try {
            const sourceID = await storeSource(req.file.buffer, {
                optimizer: req.body.optimizer,
                address: req.body.address,
                timestamp: getTimestamp(),
                // TODO: Add username to mark ownership
            });
            
            const insertRes = await dbConn.verificationResultsCollection.insertOne({
                '_id': sourceID,
                'verified': false,
                'error': '',
            });
            
            if (!insertRes.acknowledged) {
                throw 'inserting verification result not acknowledged';
            }
            
            await dbConn.verificationQueue.add(sourceID);
            
            console.log(`Verification handler. Successfully queued source '${sourceID}' for address '${req.body.address}'`);

            res.statusCode = 200;
            res.end(JSON.stringify({
                'id': sourceID,
            }));
        } catch (e) {
            console.error(`failed pushing source for verification: ${e}`);
            res.sendStatus(500);
        }
    };
}

module.exports.getParseContractHandler = (dbConn) => {
    return async (req, res) => {
        try {
            const sourceID = await storeSource(req.file.buffer, {
                address: req.body.address,
                // TODO: Add username to mark ownership
            });

            const insertRes = await dbConn.parsingResultsCollection.insertOne({
                '_id': sourceID,
                'address': req.body.address,
                'parsed': false,
                'error': '',
            });
            
            if (!insertRes.acknowledged) {
                throw 'inserting verification result not acknowledged';
            }

            await dbConn.parsingQueue.add(sourceID);
            
            console.log(`Parsing handler. Successfully queued source '${sourceID}' for address '${req.body.address}'`);

            res.statusCode = 200;
            res.end(JSON.stringify({
                'id': sourceID,
            }));
        } catch (e) {
            console.error(`failed pushing source for parsing: ${e}`);
            errorResponse(res, 500, e);
        }
    }
}

module.exports.getListContractSchemasHandler = (dbConn) => {
    return async (req, res) => {
        try {
            let results = await dbConn.parsingResultsCollection.find({ address: req.query.address });
            results = await results.toArray();

            if (!results) {
                errorResponse(res, 400, `No source code for address '${req.query.address}' was parsed.`);
                return;
            }

            let sourcesSchemas = {
                'sources': [],
            };

            for (const res of results) {
                if (!res['parsed']) {
                    continue;
                }

                sourcesSchemas['sources'].push({
                    [res['_id']]: {
                        'schemas': res['schemas'],
                    },
                });
            }

            res.statusCode = 200;
            res.end(JSON.stringify(sourcesSchemas));

        } catch (e) {
            console.error(`failed to get contract schema for address '${req.query.address}': ${e}`);
            res.sendStatus(500);
        }
    }
}

module.exports.getReturnSchemaHandler = (_) => {
    return async (req, res) => {
        try {
            await downloadSchemaByID(req.query.id, res, (e) => {
                errorResponse(res, 500, e);
            });
        } catch (e) {
            console.error(`failed to get schema by id '${req.query.id}': ${e}`);
        }
    }   
}

const errorResponse = (res, code, err) => {
    res.statusCode = code;
    res.end(JSON.stringify({
        'error': err,
    }));
}

const getTimestamp = () => {
    return Math.floor(new Date().getTime() / 1000);
}
