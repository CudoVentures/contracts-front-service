require('dotenv').config();


const CONFIG_KEYS = ['MONGO_URI', 'QUEUE_ITEM_VISIBILITY'];

module.exports.verifyConfig = () => {
    for (const configKey of CONFIG_KEYS) {
        if (!process.env[configKey]) {
            throw `config value '${configKey}' is not set`;
        }
    }
}