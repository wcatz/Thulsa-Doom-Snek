async function fetchPoolMetadata(poolId) {
  try {
    const response = await fetch('https://api.koios.rest/api/v1/pool_metadata', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
      body: JSON.stringify({
        _pool_bech32_ids: [poolId],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    throw error;
  }
}

module.exports = {
  fetchPoolMetadata,
};
