const express = require('express');
const multer = require('multer');

const config = require('./config');
const { connectDB } = require('./db');
const { getVerifyContractHandler, getParseContractHandler, 
        getListContractSchemasHandler, getReturnSchemaHandler, } = require('./handlers');


config.verifyConfig();

const app = express();

const LISTEN_PORT = process.env.PORT || 3000;

app.listen(LISTEN_PORT, () => {
    console.log(`listening on ${LISTEN_PORT}`);
});

connectDB('contracts_scan', 'sources', 'schemas', 'verification_results', 'parsing_results').then((dbConn) => {

    app.post('/verify-contract', multer().single('source'), getVerifyContractHandler(dbConn));
    app.post('/parse-contract', multer().single('source'), getParseContractHandler(dbConn));

    app.get('/contract-schemas', getListContractSchemasHandler(dbConn));
    app.get('/schema', getReturnSchemaHandler(dbConn));

    console.info('connected to database');

}).catch((reason) => {
    console.error('failed to connect to database ', reason);
    throw reason;
});