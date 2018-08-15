const Webu = require('webu');
const fs = require('fs');
const solc = require('solc');
const Tx = require('icjs-tx');

let webu = new Webu(new Webu.providers.HttpProvider('http://192.168.1.95:8545'));

const Sends = function() {};

module.exports = Sends;

Sends.sendTx = function(privateKey, from, to, value, gasPrice, gasLimit, data, cb) {
    const nonce = webu.irc.getTransactionCount(from);
    const rawTx = {
        from: from,
        to: to,
        nonce: nonce,
        gasPrice: gasPrice,
        gas: gasLimit,
        value: value,
        data: data,
    };
    const tx = new Tx(rawTx);
    tx.sign(new Buffer(privateKey, 'hex'));
    const serializedTx = tx.serialize().toString('hex');
    webu.irc.sendRawTransaction('0x' + serializedTx, cb);
};

Sends.createContract = function(privKey, sender, value, price, params, cb) {
    const contractName = 'IrIP20.sol:IrIP20';
    const input = {
        'IrIP20.sol': Sends.readContract('IrIP20.sol'),
        'IrIP20Interface.sol': Sends.readContract('IrIP20Interface.sol'),
    };
    const output = solc.compile({sources: input}, 1);
    const bytecode = output.contracts[contractName].bytecode;
    const abi = JSON.parse(output.contracts[contractName].interface);
    const factory = webu.irc.contract(abi);
    const data = factory.new.getData(params.name, params.symbol, params.supply, params.costmin, params.costmax, params.costpc, params.extend, {data: bytecode});
    value = webu.toWei(value, 'irc');
    price = webu.toWei(price, 'gwei');
    Sends.sendTx(privKey, sender, '0x', value, price, 2700000, '0x' + data, makeTxReceiptCb(receipt => {
        const contract = factory.at(receipt.contractAddress);
        if (cb) cb(contract);
    }));
};

Sends.sendIrcer = function(privKey, sender, to, value, price, cb) {
    value = webu.toWei(value, 'irc');
    price = webu.toWei(price, 'gwei');
    Sends.sendTx(privKey, sender, to, value, price, 90000, '0x', makeTxReceiptCb(cb));
};

Sends.sendToken = function(contract, privKey, sender, to, value, price, cb) {
    value = webu.toWei(value, 'irc');
    price = webu.toWei(price, 'gwei');
    const data = contract.transfer.getData(to, value);
    Sends.sendTx(privKey, sender, contract.address, 0, price, 90000, data, makeTxReceiptCb(cb));
};

Sends.sendTokenFrom = function(contract, privKey, sender, from, to, value, price) {
    value = webu.toWei(value, 'irc');
    price = webu.toWei(price, 'gwei');
    const data = contract.transferFrom.getData(from, to, value);
    Sends.sendTx(privKey, sender, contract.address, 0, price, 90000, data, makeTxReceiptCb(cb));
};

Sends.sendTokenMul = function(contract, privKey, sender, tos, values, price, cb) {
    values = webu.toWei(values, 'irc');
    price = webu.toWei(price, 'gwei');
    const data = contract.mulTransfer.getData(tos, values);
    Sends.sendTx(privKey, sender, contract.address, 0, price, 210000, data, makeTxReceiptCb(cb));
};

Sends.TokenWithdraw = function(contract, privKey, sender, to, currency, value, price, cb) {
    value = webu.toWei(value, 'irc');
    price = webu.toWei(price, 'gwei');
    const data = contract.withdraw.getData(to, currency, value);
    Sends.sendTx(privKey, sender, contract.address, 0, price, 90000, data, makeTxReceiptCb(cb));
};

Sends.readContract = function(filePath) {
    const contract = fs.readFileSync(filePath, 'utf8');
    return contract.split(/\s+|\n/).join(' ');
};

const makeTxReceiptCb = cb => (err, hash) => {
    if (err) throw err;
    let count = 0;
    webu.irc.getTransactionReceipt(hash, function receiptCb(err, receipt) {
        if (err) throw err;
        if (count > 10) throw `Contract transaction couldn't be found`;
        if (receipt) {
            if (cb) cb(receipt);
        } else {
            setTimeout(webu.irc.getTransactionReceipt.bind(webu.irc), 1000, hash, receiptCb);
            count++;
        }
    });
};

const privKey = '5645de1815c17c541ea461aaad7e388f73cab197256a246352c09ad6ef3e2974';
const sender = '0x0986a8273fa2c69398deecd1d69ec49d91f19aba';
const to = '0xd0ca89a6d9435a6a4857c1083f165af01fbfda7d';
const name = 'IrIP20 Coin - Test';
const symbol = 'IrIP20';
