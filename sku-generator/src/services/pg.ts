import { Client, Pool } from 'pg';

const env = process.env.NODE_ENV || 'development';

export const pool = new Pool({
  user: env === 'development' ? 'postgres' : 'adalpro',
  host:
    env === 'development'
      ? '113.30.189.56'
      : 'database-adalpro.cutltnagvalm.us-east-2.rds.amazonaws.com',
  database: env === 'development' ? 'adaltest' : 'adalpro',
  password:
    env === 'development'
      ? 'Y00dc2q5mbJNj9VqGe8h1FUD*V'
      : 'hCjN3SINl6ddUHObUuz6',
  port: 5432,
});

export const client = new Client({
  user: env === 'development' ? 'postgres' : 'adalpro',
  host:
    env === 'development'
      ? '113.30.189.56'
      : 'database-adalpro.cutltnagvalm.us-east-2.rds.amazonaws.com',
  database: env === 'development' ? 'adaltest' : 'adalpro',
  password:
    env === 'development'
      ? 'Y00dc2q5mbJNj9VqGe8h1FUD*V'
      : 'hCjN3SINl6ddUHObUuz6',
  port: 5432,
});
