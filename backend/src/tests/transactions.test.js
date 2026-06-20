require('dotenv').config({ path: '.env.test' })
const { db } = require('../db/db')
const { transfer, deposit } = require('../services/TransactionService')

async function createTestAccount(email, startingBalance) {
  const [user] = await db('users')
    .insert({ email, password_hash: 'fake-hash-for-tests' })
    .returning('*')

  const [account] = await db('accounts')
    .insert({ user_id: user.id, name: 'Test Account', balance: startingBalance })
    .returning('*')

  return { user, account }
}

describe('Transfer Logic', () => {

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE ledger_entries, transactions, accounts, users RESTART IDENTITY CASCADE;');
  })

  afterAll(async () => {
    await db.destroy()
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  test('successfully moves money and creates ledger entries', async () => {

    const anish = await createTestAccount('anish@test.com', 1000)
    const rahul = await createTestAccount('rahul@test.com', 0)

    const result = await transfer(
      anish.account.id,
      rahul.account.id,
      '200',
      'test transfer',
      anish.user.id,
      'test-key-001'
    )

    // transaction was created and marked completed
    expect(result.transaction.status).toBe('COMPLETED')
    expect(result.newBalance).toBe('800.00000000')

    // check the actual balances in the database
    const anishAfter = await db('accounts').where({ id: anish.account.id }).first()
    const rahulAfter = await db('accounts').where({ id: rahul.account.id }).first()

    expect(parseFloat(anishAfter.balance)).toBe(800)
    expect(parseFloat(rahulAfter.balance)).toBe(200)

    const entries = await db('ledger_entries')
      .where({ transaction_id: result.transaction.id })

    expect(entries.length).toBe(2) 

    const debitEntry  = entries.find(e => e.entry_type === 'DEBIT')
    const creditEntry = entries.find(e => e.entry_type === 'CREDIT')

    expect(parseFloat(debitEntry.balance_after)).toBe(800)   
    expect(parseFloat(creditEntry.balance_after)).toBe(200)  
  })

  test('fails with INSUFFICIENT_FUNDS when balance too low', async () => {

    const anish = await createTestAccount('anish2@test.com', 100)
    const rahul = await createTestAccount('rahul2@test.com', 0)

 
    await expect(
      transfer(anish.account.id, rahul.account.id, '500', null, anish.user.id, 'test-key-002')
    ).rejects.toThrow()

    const anishAfter = await db('accounts').where({ id: anish.account.id }).first()
    const rahulAfter = await db('accounts').where({ id: rahul.account.id }).first()

    expect(parseFloat(anishAfter.balance)).toBe(100) 
    expect(parseFloat(rahulAfter.balance)).toBe(0)   

    const txns = await db('transactions').where({ idempotency_key: 'test-key-002' })
    expect(txns.length).toBe(0)
  })

  test('duplicate idempotency key replays original response without double charging', async () => {

    const anish = await createTestAccount('anish3@test.com', 1000)
    const rahul = await createTestAccount('rahul3@test.com', 0)

    const sameKey = 'test-key-duplicate-003'

    const firstCall  = await transfer(anish.account.id, rahul.account.id, '100', null, anish.user.id, sameKey)
    const secondCall = await transfer(anish.account.id, rahul.account.id, '100', null, anish.user.id, sameKey)

    expect(firstCall.transaction.id).toBe(secondCall.transaction.id)

    expect(secondCall.replayed).toBe(true)

    
    const anishAfter = await db('accounts').where({ id: anish.account.id }).first()
    expect(parseFloat(anishAfter.balance)).toBe(900)

    const txns = await db('transactions').where({ idempotency_key: sameKey })
    expect(txns.length).toBe(1)
  })

})