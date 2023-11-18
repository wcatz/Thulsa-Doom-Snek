const { bech32 } = require('bech32');

function toBech32PoolId(input, hrp) {
  const bytes = Buffer.from(input, 'hex');
  const words = bech32.toWords(bytes);
  return bech32.encode(hrp, words);
}

module.exports = {
    toBech32PoolId,
};

