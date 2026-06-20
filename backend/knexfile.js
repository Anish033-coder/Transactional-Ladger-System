require('dotenv').config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const localConnection = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'ledger_test'
};

const devConnection = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : localConnection;

const baseConfig = {
  client: 'pg',
  connection: devConnection,
  migrations: {
    directory: './src/db/migrations'
  }
};

module.exports = {
  development: baseConfig,
  dev: baseConfig,
  local: baseConfig,
  
  test: {
    client: 'pg',
    connection: localConnection,
    migrations: { 
      directory: './src/db/migrations' 
    }
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: './src/db/migrations'
    }
  }
};