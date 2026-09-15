/** @param {string | undefined} paymentMode */
export function databaseSchema(paymentMode) {
  return paymentMode === 'dodo-live' ? 'paper_live' : 'public';
}

/** Pin every live transaction, including reads, for transaction-pooling compatibility.
 * The public schema is deliberately absent from the live search path.
 * @template T
 * @param {{query: Function}} client
 * @param {string} schema
 * @param {(client: any) => Promise<T>} operation
 * @returns {Promise<T>}
 */
export async function inDatabaseSchema(client, schema, operation) {
  if (schema !== 'public' && schema !== 'paper_live') throw new Error('Invalid application database schema');
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL search_path = ${schema}`);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}
