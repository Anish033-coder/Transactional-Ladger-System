require('dotenv').config({ path: '.env.test' })
const { db } = require('../db/db')

beforeAll(async () => {
  await db.raw('SELECT 1')
})