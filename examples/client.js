const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');


const API_URL = 'http://34.172.163.122:3333';

const verifyContract = async (crateName, optimizer, address, sourceCodeZIP) => {
    try {
        const sourceCodeZIPData = fs.createReadStream(sourceCodeZIP);

        const form = new FormData();
        form.append('crateName', crateName);
        form.append('optimizer', optimizer);
        form.append('address', address);
        form.append('source', sourceCodeZIPData);
        console.log(`${API_URL}/verify-contract`);
        const resp = await axios.post(`${API_URL}/verify-contract`, form, {
            headers: {
                ...form.getHeaders(),
            }
        });

        if (resp.status != 201) {
            console.log(resp);
            throw 'request failed';
        }

        let id = resp['data']['id'];
        
        console.log(`Processing ID: ${id}`);

        let interval = setInterval(async () => {
            const { data } = await axios.get(`${API_URL}/verification-status?id=${id}`);

            if ((data['verificationError'] && data['verificationError'].length > 0) 
                || data['parsed'] === true || (data['parsingError'] && data['parsingError'].length > 0)) {
                console.log(data);
                clearInterval(interval);
            }
        }, 5000);

    } catch(err) {
        console.error(err);
        throw err;
    }
}

if (process.argv.length != 6) {
    console.error('Example usage: node ./examples/client.js crateName optimizer address sourceCodeZIP');
    return;
}

verifyContract(process.argv[2], process.argv[3], process.argv[4], process.argv[5]).then(() => {});

// verifyContract('nft-bindings-tester', 'cosmwasm/workspace-optimizer:0.12.6', 'cudos1mf6ptkssddfmxvhdx0ech0k03ktp6kf9yk59renau2gvht3nq2gqjnlanp', '/Users/angelvalkov/git/cudos-cosmwasm-bindings/source.zip');