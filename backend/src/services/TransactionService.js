const { db } = require('../db/db')

async function transfer(fromAccountId, toAccountId, amount, note, userId, idempotencyKey) {

   const startTime = Date.now()
  const transferAmount = parseFloat(amount)

  if (transferAmount <= 0) {
    const error = new Error('Amount must be greater than zero')
    error.code = 'INVALID_AMOUNT'
    throw error
  }

  if (fromAccountId === toAccountId) {
    const error = new Error('You cannot transfer to the same account')
    error.code = 'SAME_ACCOUNT'
    throw error
  }

  if (idempotencyKey) {

    const existingTransaction = await db('transactions')
      .where({ idempotency_key: idempotencyKey })
      .first()

    if (existingTransaction) {
      console.log('Idempotency hit - returning existing transaction:', existingTransaction.id)
      const senderAccount = await db('accounts')
        .where({ id: fromAccountId })
        .first()

      return {
        transaction: existingTransaction,
        newBalance: senderAccount.balance,
        replayed: true   
      }
    }
  }

  const result = await db.transaction(async function(trx) {

    const lockStart = Date.now() 

    const lockedAccounts = await trx.raw(`
      SELECT * FROM accounts
      WHERE id IN (?, ?)
      ORDER BY id
      FOR UPDATE
    `, [fromAccountId, toAccountId])

    console.log('Lock acquired in:', Date.now() - lockStart, 'ms')
    const rows = lockedAccounts.rows

    const fromAccount = rows.find(function(row) {
      return row.id === fromAccountId
    })

    const toAccount = rows.find(function(row) {
      return row.id === toAccountId
    })

    if (!fromAccount) {
      const error = new Error('Source account not found')
      error.code = 'ACCOUNT_NOT_FOUND'
      throw error
    }

    if (fromAccount.user_id !== userId) {
      const error = new Error('Source account does not belong to you')
      error.code = 'ACCOUNT_NOT_FOUND'
      throw error
    }

    if (!toAccount) {
      const error = new Error('Destination account not found')
      error.code = 'DEST_NOT_FOUND'
      throw error
    }

    if (fromAccount.status !== 'ACTIVE') {
      const error = new Error('Your account is not active')
      error.code = 'ACCOUNT_INACTIVE'
      throw error
    }

    if (toAccount.status !== 'ACTIVE') {
      const error = new Error('Destination account is not active')
      error.code = 'DEST_INACTIVE'
      throw error
    }

    const fromBalance = parseFloat(fromAccount.balance)
    const toBalance = parseFloat(toAccount.balance)

    if (fromBalance < transferAmount) {
      const error = new Error('You do not have enough balance for this transfer')
      error.code = 'INSUFFICIENT_FUNDS'
      throw error
    }

    const newFromBalance = fromBalance - transferAmount
    const newToBalance = toBalance + transferAmount

    const newTransactions = await trx('transactions')
      .insert({
        from_account_id:  fromAccountId,
        to_account_id:    toAccountId,
        amount:           transferAmount.toFixed(8),
        type:             'TRANSFER',
        status:           'COMPLETED',
        note:             note || null,
        idempotency_key:  idempotencyKey || null,
        completed_at:     new Date()
      })
      .returning('*')

    const transaction = newTransactions[0]

    await trx('accounts')
      .where({ id: fromAccountId })
      .update({
        balance:    newFromBalance.toFixed(8),
        updated_at: new Date()
      })

    await trx('accounts')
      .where({ id: toAccountId })
      .update({
        balance:    newToBalance.toFixed(8),
        updated_at: new Date()
      })


    await trx('ledger_entries').insert([
      {

        transaction_id: transaction.id,
        account_id:     fromAccountId,
        entry_type:     'DEBIT',
        amount:         transferAmount.toFixed(8),
        balance_after:  newFromBalance.toFixed(8)  
      },
      {
        transaction_id: transaction.id,
        account_id:     toAccountId,
        entry_type:     'CREDIT',
        amount:         transferAmount.toFixed(8),
        balance_after:  newToBalance.toFixed(8)     
      }
    ])

    return {
      transaction: transaction,
      newBalance:  newFromBalance.toFixed(8),
      replayed:    false
    }

  })

  return result
}

async function deposit(accountId, amount, note, userId, idempotencyKey) {

  const depositAmount = parseFloat(amount)

  if (depositAmount <= 0) {
    const error = new Error('Amount must be greater than zero')
    error.code = 'INVALID_AMOUNT'
    throw error
  }

  if (idempotencyKey) {
    const existingTransaction = await db('transactions')
      .where({ idempotency_key: idempotencyKey })
      .first()

    if (existingTransaction) {
      console.log('Idempotency hit for deposit:', existingTransaction.id)

      const account = await db('accounts').where({ id: accountId }).first()

      return {
        transaction: existingTransaction,
        newBalance:  account.balance,
        replayed:    true
      }
    }
  }

  const result = await db.transaction(async function(trx) {

    const lockedAccounts = await trx.raw(`
      SELECT * FROM accounts
      WHERE id = ?
      FOR UPDATE
    `, [accountId])

    const account = lockedAccounts.rows[0]

    if (!account) {
      const error = new Error('Account not found')
      error.code = 'ACCOUNT_NOT_FOUND'
      throw error
    }

    if (account.user_id !== userId) {
      const error = new Error('Account does not belong to you')
      error.code = 'ACCOUNT_NOT_FOUND'
      throw error
    }

    if (account.status !== 'ACTIVE') {
      const error = new Error('Account is not active')
      error.code = 'ACCOUNT_INACTIVE'
      throw error
    }

    const currentBalance = parseFloat(account.balance)
    const newBalance = currentBalance + depositAmount

    const newTransactions = await trx('transactions')
      .insert({
        from_account_id: null,          
        to_account_id:   accountId,
        amount:          depositAmount.toFixed(8),
        type:            'DEPOSIT',
        status:          'COMPLETED',
        note:            note || null,
        idempotency_key: idempotencyKey || null,
        completed_at:    new Date()
      })
      .returning('*')

    const transaction = newTransactions[0]

    await trx('accounts')
      .where({ id: accountId })
      .update({
        balance:    newBalance.toFixed(8),
        updated_at: new Date()
      })

    await trx('ledger_entries').insert({
      transaction_id: transaction.id,
      account_id:     accountId,
      entry_type:     'CREDIT',
      amount:         depositAmount.toFixed(8),
      balance_after:  newBalance.toFixed(8)
    })

    return {
      transaction: transaction,
      newBalance:  newBalance.toFixed(8),
      replayed:    false
    }

  })
 console.log('Total transfer time:', Date.now() - startTime, 'ms') 
  return result
}

module.exports = { transfer, deposit }