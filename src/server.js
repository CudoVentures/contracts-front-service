const express = require('express');
const cors = require('cors');
const multer = require('multer');

const config = require('./config');
const { connectDB } = require('./db');
const { getVerifyContractHandler, getDownloadSchemaHandler, getVerificationStatusHandler } = require('./handlers');


config.verifyConfig();

const app = express();
app.use(cors());

const LISTEN_PORT = process.env.PORT || 3000;

app.listen(LISTEN_PORT, () => {
    console.log(`listening on ${LISTEN_PORT}`);
});

connectDB('contracts_scan', 'sources', 'schemas', 'verification_results', 'parsing_results').then((dbConn) => {

    const multerOptions = { limits: { fileSize: parseInt(process.env.MAX_SOURCE_CODE_SIZE_LIMIT, 10) }};

    app.post('/verify-contract', multer(multerOptions).single('source'), getVerifyContractHandler(dbConn));
    app.get('/verification-status', getVerificationStatusHandler(dbConn));
    app.get('/schema', getDownloadSchemaHandler(dbConn));

    console.info('connected to database');

}).catch((reason) => {
    console.error('failed to connect to database ', reason);
    throw reason;
});