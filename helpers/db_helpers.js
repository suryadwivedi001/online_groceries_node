const fs = require('fs');
const path = require('path');
let dotenvLoaded = false;

// Try to load .env file from project root
try {
  const dotenvPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
    dotenvLoaded = true;
    console.log('[db_helpers] .env loaded from', dotenvPath);
  } else {
    console.log('[db_helpers] .env file not found, will use config/default.json');
  }
} catch (ex) {
  console.warn('[db_helpers] Error loading .env file:', ex);
}

const mysql = require('mysql');
const config = require('config');
const helper = require('./helpers');

// Function to get config values with fallback
function getConfigValue(envVarName, configPath, defaultValue = undefined) {
  if (dotenvLoaded && process.env[envVarName] !== undefined) {
    return process.env[envVarName];
  }
  try {
    if (config.has(configPath)) return config.get(configPath);
  } catch (_) {
    // silently ignore missing config path
  }
  return defaultValue;
}

// Build dbConfig using env vars if available, else fallback config/default.json
const dbConfig = {
  host: getConfigValue('DB_HOST', 'dbConfig.host', 'localhost'),
  user: getConfigValue('DB_USER', 'dbConfig.user', 'root'),
  password: getConfigValue('DB_PASS', 'dbConfig.password', ''),
  database: getConfigValue('DB_NAME', 'dbConfig.database', 'railway'),
  port: parseInt(getConfigValue('DB_PORT', 'dbConfig.port', '3306'), 10),
  multipleStatements: true,
  timezone: getConfigValue('DB_TIMEZONE', 'dbConfig.timezone', 'utc+5:30'),
  charset: getConfigValue('DB_CHARSET', 'dbConfig.charset', 'utf8mb4'),
};

let db = mysql.createConnection(dbConfig);

if (config.has('optionalFeature.detail')) {
  const detail = config.get('optionalFeature.detail');
  helper.Dlog('config: ' + detail);
}

reconnect(db, () => {});

function reconnect(connection, callback) {
  helper.Dlog("\n New connection tentative ... (" + helper.serverYYYYMMDDHHmmss() + ")");

  connection = mysql.createConnection(dbConfig);

  connection.connect((err) => {
    if (err) {
      helper.ThrowHtmlError(err);
      setTimeout(() => {
        helper.Dlog('----------------- DB ReConnecting Error (' + helper.serverYYYYMMDDHHmmss() + ') ....................');
        reconnect(connection, callback);
      }, 5 * 1000);
    } else {
      helper.Dlog('\n\t ----- New Connection established with database. -------');
      db = connection;
      return callback();
    }
  });

  connection.on('error', (err) => {
    helper.Dlog('----- App is connection Crash DB Helper (' + helper.serverYYYYMMDDHHmmss() + ') -------');

    if (
      err.code === "PROTOCOL_CONNECTION_LOST" ||
      err.code === "PROTOCOL_ENQUEUE_AFTER_QUIT" ||
      err.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR" ||
      err.code === "PROTOCOL_ENQUEUE_HANDSHAKE_TWICE" ||
      err.code === "ECONNREFUSED" ||
      err.code === "PROTOCOL_PACKETS_OUT_OF_ORDER"
    ) {
      helper.Dlog(`/!\\ ${err.code} Cannot establish a connection with the database. /!\\`);
      reconnect(db, callback);
    } else {
      throw err;
    }
  });
}

module.exports = {
  query: (sqlQuery, args, callback) => {
    if (db.state === 'authenticated' || db.state === "connected") {
      db.query(sqlQuery, args, (error, result) => {
        return callback(error, result);
      });
    } else if (db.state === "protocol_error") {
      reconnect(db, () => {
        db.query(sqlQuery, args, (error, result) => {
          return callback(error, result);
        });
      });
    } else {
      reconnect(db, () => {
        db.query(sqlQuery, args, (error, result) => {
          return callback(error, result);
        });
      });
    }
  }
};

process.on('uncaughtException', (err) => {
  helper.Dlog('------------------------ App is Crash DB helper (' + helper.serverYYYYMMDDHHmmss() + ')-------------------------');
  helper.Dlog(err.code);
  helper.ThrowHtmlError(err);
});
