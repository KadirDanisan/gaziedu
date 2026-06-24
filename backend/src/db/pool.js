import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:1234@localhost:5432/guzem",
});

export default pool;
