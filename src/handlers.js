const { storeSource, downloadSchemaByID, downloadSourceByAddress } = require('./db');


// TODO: Add request params validation

module.exports.getVerifyContractHandler = (dbConn) => {
    return async (req, res) => {

        const metadata = {
            optimizer: req.body.optimizer,
            address: req.body.address,
            timestamp: getTimestamp(),
            // TODO: Add username to mark ownership
        };

        if (req.body.crateName) {
            metadata['crateName'] = req.body.crateName;
        }

        try {
            const sourceID = await storeSource(req.file.buffer, metadata);
            
            const verificationInsertRes = await dbConn.verificationResultsCollection.insertOne({
                '_id': sourceID,
                'address': req.body.address,
                'verified': false,
                'error': '',
            });
            
            if (!verificationInsertRes.acknowledged) {
                throw 'inserting verification result not acknowledged';
            }
            
            const parsingInsertRes = await dbConn.parsingResultsCollection.insertOne({
                '_id': sourceID,
                'address': req.body.address,
                'parsed': false,
                'error': '',
            });
            
            if (!parsingInsertRes.acknowledged) {
                throw 'inserting parsing result not acknowledged';
            }

            await dbConn.verificationQueue.add(sourceID);
            
            console.log(`Verification handler. Successfully queued source '${sourceID}' for address '${req.body.address}'`);

            res.statusCode = 201;
            res.end(JSON.stringify({
                'id': sourceID,
            }));
        } catch (e) {
            console.error(`failed pushing source for verification: ${e}`);
            errorResponse(res, 500, e);
        }
    };
}

module.exports.getVerificationStatusHandler = (dbConn) => {
    return async (req, res) => {
        let dbQuery;

        if ('id' in req.query) {
            dbQuery = { _id: req.query.id };
        } else if ('address' in req.query) {
            dbQuery = { address: req.query.address };
        }

        if (!dbQuery) {
            res.status(400).end();
            return;
        }

        let response = {};

        let cursor = await dbConn.verificationResultsCollection.find(dbQuery).sort({_id:-1});
        let entries = await cursor.toArray();
        
        if (entries.length == 0) {
            res.status(404).end();
            return;
        }

        let result = entries[0];

        if ('error' in result && result['error']) {
            response['verificationError'] = result['error'];
        }

        if ('verified' in result) {
            response['verified'] = result['verified'];
        }

        cursor = await dbConn.parsingResultsCollection.find(dbQuery).sort({_id:-1});
        entries = await cursor.toArray();
        
        if (entries.length == 0) {
            res.status(404).end();
            return;
        }

        result = entries[0];

        if ('error' in result && result['error']) {
            response['parsingError'] = result['error'];
        }

        if ('parsed' in result) {
            response['parsed'] = result['parsed'];
        }

        res.statusCode = 200;
        res.end(JSON.stringify(response));
    };
}

module.exports.getParseContractHandler = (dbConn) => {
    return async (req, res) => {
        try {
            let metadata = {
                address: req.body.address,
                // TODO: Add username to mark ownership
            };

            if (req.body.crateName) {
                metadata['crateName'] = req.body.crateName;
            }

            const sourceID = await storeSource(req.file.buffer, metadata);

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

            res.statusCode = 201;
            res.end(JSON.stringify({
                'id': sourceID,
            }));
        } catch (e) {
            console.error(`failed pushing source for parsing: ${e}`);
            errorResponse(res, 500, e);
        }
    }
}

module.exports.getParsingStatusHandler = (dbConn) => {
    return async (req, res) => {
        const cursor = await dbConn.parsingResultsCollection.find({ _id: req.query.id });
        const entries = await cursor.toArray();
        
        if (entries.length == 0) {
            res.status(404).end();
            return;
        }

        const result = entries[0];

        if ('error' in result && result['error']) {
            res.statusCode = 200;
            res.end(JSON.stringify({ error: result['error'] }));
            return;
        }

        if ('parsed' in result) {
            res.statusCode = 200;
            res.end(JSON.stringify({ parsed: result['parsed'] }));
            return;
        }

        res.status(404).end();
    };
}

module.exports.getListContractSchemasHandler = (dbConn) => {
    return async (req, res) => {
        try {
            let results = await dbConn.parsingResultsCollection.find({ address: req.query.address }).sort({_id:-1});
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
                    'id': res['_id'],
                    'schemas': res['schemas'],
                });
            }

            res.statusCode = 200;
            res.end(JSON.stringify(sourcesSchemas));

        } catch (e) {
            console.error(`failed to get contract schema for address '${req.query.address}': ${e}`);
            errorResponse(res, 500, e);
        }
    }
}

module.exports.getDownloadSchemaHandler = (dbConn) => {
    return async (req, res) => {
        try {
            let query = { address: req.query.address, parsed: true };

            let results = await dbConn.parsingResultsCollection.find(query).sort({_id:-1});
            results = await results.toArray();

            if (!results || results.length == 0) {
                errorResponse(res, 400, `No scheme for address '${req.query.address}' with type '${req.query.type}' was found.`);
                return;
            }

            for (let i = 0; i < results[0]['schemas'].length; i++) {
                if (results[0]['schemas'][i]['funcName'] != req.query.type) {
                    continue;
                }

                await downloadSchemaByID(results[0]['schemas'][i]['id'], res, (e) => {
                    errorResponse(res, 500, e);
                });
                break;
            }

        } catch (e) {
            console.error(`failed to get schema by id '${req.query.id}': ${e}`);
            errorResponse(res, 500, e);
        }
    }   
}

module.exports.getDownloadSourceHandler = () => {
    return async (req, res) => {
        try {
            res.writeHead(200, { 'Content-Type': 'application/zip' });
            await downloadSourceByAddress(req.query.address, res, (e) => {
                errorResponse(res, 500, e);
            });

        } catch (e) {
            console.error(`failed to get schema by id '${req.query.id}': ${e}`);
            errorResponse(res, 500, e);
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
